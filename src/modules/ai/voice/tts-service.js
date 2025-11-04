// TTS service using expo-speech (installed in dependencies). If the
// native module isn't present, calls no-op via guards below.
import * as Speech from 'expo-speech';

console.log('[TTS] Module loaded, Speech object:', typeof Speech, 'speak function:', typeof Speech?.speak);

export function isAvailable() {
  const available = !!(Speech && typeof Speech.speak === 'function');
  console.log('[TTS] isAvailable:', available);
  return available;
}

export async function isSpeaking() {
  try {
    if (Speech?.isSpeakingAsync) return !!(await Speech.isSpeakingAsync());
  } catch {}
  return false;
}

export function stop() {
  try {
    if (Speech?.stop) Speech.stop();
  } catch {}
}

export function speak(text, opts = {}) {
  try {
    console.log('[TTS] speak called with text:', text);
    if (!text || !isAvailable()) {
      console.log('[TTS] speak skipped - text:', !!text, 'available:', isAvailable());
      return;
    }
    const {
      language = 'en-US',
      pitch = 1.0,
      rate = 0.85, // More natural speaking pace (was 0.55 - too slow)
      voice: voiceId = 'com.apple.voice.enhanced.en-US.Samantha', // Enhanced quality Samantha voice
      onDone,
      onError,
    } = opts || {};
    // Cancel any ongoing utterance to avoid overlap
    if (Speech?.stop) Speech.stop();
    console.log('[TTS] Calling Speech.speak with:', String(text).substring(0, 50));
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
