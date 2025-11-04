// Unified TTS service with provider toggle.
// Default provider: iOS native via expo-speech.
// Optional provider: OpenAI TTS (gpt-4o-mini-tts) via fetch + expo-av playback.

import * as Speech from 'expo-speech';
import { isAvailable as openaiAvailable, speak as openaiSpeak, stop as openaiStop, isSpeaking as openaiIsSpeaking } from './openai-tts-service';

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
    const p = provider();
    console.log('[TTS] speak provider:', p, 'text len:', (text || '').length);
    if (!text) return;
    if (p === 'openai') {
      // Fire-and-forget; openai-tts-service manages playback
      openaiSpeak(text, opts);
      return;
    }
    if (!isAvailable()) return;
    const {
      language = 'en-US',
      pitch = 1.0,
      rate = 0.85,
      voice: voiceId = 'com.apple.voice.enhanced.en-US.Samantha',
      onDone,
      onError,
    } = opts || {};
    // Cancel any ongoing utterance to avoid overlap
    if (Speech?.stop) Speech.stop();
    Speech.speak(String(text), { 
      language, 
      pitch, 
      rate,
      voice: voiceId,
      onDone, 
      onError 
    });
  } catch (e) {
    console.warn('[TTS] speak error:', e?.message);
  }
}
