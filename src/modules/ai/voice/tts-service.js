// Unified TTS service with provider toggle.
// Default provider: iOS native via expo-speech.
// Optional provider: OpenAI TTS (gpt-4o-mini-tts) via fetch + expo-av playback.

import * as Speech from 'expo-speech';
import { isAvailable as openaiAvailable, speak as openaiSpeak, stop as openaiStop, isSpeaking as openaiIsSpeaking } from './openai-tts-service';
import { getVoiceSettings } from '../../../storage';

console.log('[TTS] Module loaded. Speech.speak:', typeof Speech?.speak);

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
(async () => {
  try {
    if (Speech?.getAvailableVoicesAsync) {
      voicesCache = await Speech.getAvailableVoicesAsync();
      // Try to choose an enhanced en-US voice if available
      const enhanced = voicesCache?.find?.((v) => v?.identifier?.includes('en-US') && v?.quality === 'Enhanced');
      preferredVoiceId = enhanced?.identifier || null;
      console.log('[TTS] Prefetched voices:', Array.isArray(voicesCache) ? voicesCache.length : 0, 'preferred:', preferredVoiceId || '(none)');
    }
  } catch {}
})();

export function isAvailable() {
  const p = provider();
  if (p === 'openai') return openaiAvailable();
  const available = !!(Speech && typeof Speech.speak === 'function');
  console.log('[TTS] isAvailable (ios):', available);
  return available;
}

export async function isSpeaking() {
  try {
    const p = provider();
    if (p === 'openai') return await openaiIsSpeaking();
    if (Speech?.isSpeakingAsync) return !!(await Speech.isSpeakingAsync());
  } catch {}
  return false;
}

export function stop() {
  try {
    const p = provider();
    if (p === 'openai') { openaiStop(); return; }
    if (Speech?.stop) Speech.stop();
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
      if (Speech?.stop) Speech.stop();
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
      Speech.speak(String(text), speakOptions);
    }).catch((err) => {
      console.warn('[TTS] Error loading voice settings:', err);
      // Fallback to default behavior if settings load fails
      const p = provider();
      if (!text || !isAvailable()) return;
      if (Speech?.stop) Speech.stop();
      Speech.speak(String(text), { language: 'en-US', pitch: 1.0, rate: 0.85, volume: 1.0 });
    });
  } catch (e) {
    console.warn('[TTS] speak error:', e?.message);
  }
}
