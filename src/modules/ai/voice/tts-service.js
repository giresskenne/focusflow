// Unified TTS service with provider toggle.
// Text-to-speech service with multiple providers and safe loading
// Default provider: iOS native via expo-speech (with crash protection).
// Fallback: OpenAI TTS (when enabled).

import { safeSpeech } from '../../../utils/safeSpeech';
// Optional provider: OpenAI TTS (gpt-4o-mini-tts) via fetch + expo-av playback.

// DO NOT import expo-speech directly - it causes TurboModule crashes
// Use safeSpeech wrapper instead
import { isAvailable as openaiAvailable, speak as openaiSpeak, stop as openaiStop, isSpeaking as openaiIsSpeaking } from './openai-tts-service';
import { getVoiceSettings } from '../../../storage';


function getEnv(name, fallback = undefined) {
  try {
    const v = process?.env?.[name];
    return typeof v === 'string' ? v : fallback;
  } catch {
    return fallback;
  }
}

function provider() {
  const p = (getEnv('EXPO_PUBLIC_AI_TTS_PROVIDER', 'ios') || 'ios').toLowerCase();
  return p === 'openai' ? 'openai' : 'ios';
}

// Cache available voices to avoid async lookup on every speak call
let voicesCache = null;
let preferredVoiceId = null;

// Safe voice initialization that won't crash the app
async function initializeVoices() {
  if (voicesCache !== null) return; // Already initialized
  
  try {
    // PRODUCTION SAFETY: Skip voice initialization in production
    if (process.env.EXPO_PUBLIC_ENV === 'production') {
      console.log('[TTS] Voice initialization skipped in production');
      voicesCache = [];
      preferredVoiceId = null;
      return;
    }
    
    if (safeSpeech.isAvailable() && safeSpeech.initialize()) {
      // Use predefined voices to avoid getAvailableVoicesAsync() crash
      voicesCache = [
        { identifier: 'com.apple.ttsbundle.Samantha-compact', name: 'Samantha', language: 'en-US', quality: 'Enhanced' },
        { identifier: 'com.apple.ttsbundle.Alex-compact', name: 'Alex', language: 'en-US' }
      ];
      preferredVoiceId = 'com.apple.ttsbundle.Samantha-compact';
      console.log('[TTS] Initialized with predefined voices to prevent crash');
    } else {
      voicesCache = [];
      preferredVoiceId = null;
      console.log('[TTS] Speech not available, no voices initialized');
    }
  } catch (error) {
    console.warn('[TTS] Voice initialization failed:', error.message);
    voicesCache = [];
    preferredVoiceId = null;
  }
}

// PRODUCTION SAFETY: Only initialize voices in development
if (process.env.EXPO_PUBLIC_ENV !== 'production') {
  initializeVoices().catch(() => {});
}

export function isAvailable() {
  const p = provider();
  if (p === 'openai') return openaiAvailable();
  
  // PRODUCTION SAFETY: TTS disabled in production
  if (process.env.EXPO_PUBLIC_ENV === 'production') {
    console.log('[TTS] TTS disabled in production for stability');
    return false;
  }
  
  const available = safeSpeech.isAvailable();
  console.log('[TTS] isAvailable (ios):', available);
  return available;
}

export async function isSpeaking() {
  try {
    const p = provider();
    if (p === 'openai') return await openaiIsSpeaking();
    return safeSpeech.isSpeaking();
  } catch {}
  return false;
}

export function stop() {
  try {
    const p = provider();
    if (p === 'openai') { openaiStop(); return; }
    safeSpeech.stop();
  } catch {}
}

export function speak(text, opts = {}) {
  try {
    // Check user settings first
    getVoiceSettings().then((voiceSettings) => {
      // If voice is disabled or TTS is disabled, don't speak
      if (!voiceSettings.voiceEnabled || !voiceSettings.ttsEnabled) {
        console.log('[TTS] speak skipped - user settings disabled');
        return;
      }

      // Apply user-configured rate and pitch if not overridden in opts
      const userRate = voiceSettings.ttsRate || 0.85;
      const userPitch = voiceSettings.ttsPitch || 1.0;
      
      const p = provider();
      console.log('[TTS] speak provider:', p, 'text len:', (text || '').length);
      if (!text) return;
      if (p === 'openai') {
        // If OpenAI TTS isn't actually available (e.g., missing native expo-av), fall back to iOS
        if (!openaiAvailable()) {
          console.warn('[TTS] OpenAI provider selected but not available; falling back to iOS Speech');
        } else {
          // Fire-and-forget; openai-tts-service manages playback
          openaiSpeak(text, opts);
          return;
        }
      }
      if (!isAvailable()) return;
      const {
        language = 'en-US',
        pitch = userPitch,
        rate = userRate,
        voice: requestedVoiceId = 'com.apple.voice.enhanced.en-US.Samantha',
        volume = 1.0,
        onDone,
        onError,
      } = opts || {};
      // Cancel any ongoing utterance to avoid overlap
      safeSpeech.stop();
      // Determine a safe voice to use; if requested isn't available, fall back
      let voiceToUse = requestedVoiceId;
      try {
        if (Array.isArray(voicesCache) && voicesCache.length > 0) {
          const matchRequested = voicesCache.find((v) => v?.identifier === requestedVoiceId);
          if (!matchRequested) {
            // Prefer our prefetched enhanced en-US, else any en-US, else omit
            const enUS = voicesCache.find((v) => v?.identifier?.includes('en-US'));
            voiceToUse = preferredVoiceId || enUS?.identifier || null;
          }
        }
      } catch {}
      const speakOptions = { language, pitch, rate, onDone, onError, volume };
      if (voiceToUse) speakOptions.voice = voiceToUse;
      console.log('[TTS] iOS speak voice:', voiceToUse || '(default)', 'rate:', rate, 'pitch:', pitch, 'volume:', volume);
      safeSpeech.speak(String(text), speakOptions);
    }).catch((err) => {
      console.warn('[TTS] Error loading voice settings:', err);
      // Fallback to default behavior if settings load fails
      const p = provider();
      if (!text || !isAvailable()) return;
      safeSpeech.stop();
      safeSpeech.speak(String(text), { language: 'en-US', pitch: 1.0, rate: 0.85, volume: 1.0 });
    });
  } catch (e) {
    console.warn('[TTS] speak error:', e?.message);
  }
}
