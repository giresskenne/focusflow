// OpenAI TTS provider using expo-av for playback and expo-file-system for temp storage
// Requires:
// - EXPO_PUBLIC_OPENAI_API_KEY set in env (do NOT hardcode secrets)
// - EXPO_PUBLIC_AI_TTS_VOICE optional (defaults to 'alloy'). Valid examples (as of 2025-11):
//   'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'verse', 'ballad', 'ash', 'sage', 'marin', 'cedar'
// - expo-av and expo-file-system deps

// Use legacy API for writeAsStringAsync/deleteAsync on Expo SDK 54+
import * as FileSystem from 'expo-file-system/legacy';

let Audio; // lazy import expo-av to avoid issues in web builds
let currentSound = null;

const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';

// Keep an allowlist in code so we can validate and avoid 400s that force a fallback
const SUPPORTED_VOICES = new Set([
  'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer',
  'coral', 'verse', 'ballad', 'ash', 'sage', 'marin', 'cedar',
]);

function getEnv(name, fallback = undefined) {
  try {
    const v = process?.env?.[name];
    return typeof v === 'string' ? v : fallback;
  } catch {
    return fallback;
  }
}

let avCheckDone = false;
let avAvailable = false;
export async function isAvailable() {
  const key = getEnv('EXPO_PUBLIC_OPENAI_API_KEY');
  try {
    if (!avCheckDone) {
      try {
        Audio = await import('expo-av');
        avAvailable = !!(Audio?.Audio?.Sound?.createAsync);
      } catch (e) {
        avAvailable = false;
      }
      avCheckDone = true;
    }
  } catch {}
  return !!key && avAvailable;
}

// Encode Uint8Array → base64 without relying on global btoa/Buffer
function toBase64(u8) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  while (i < u8.length) {
    const chr1 = u8[i++];
    const chr2 = i < u8.length ? u8[i++] : NaN;
    const chr3 = i < u8.length ? u8[i++] : NaN;

    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    const enc3 = isNaN(chr2) ? 64 : (((chr2 & 15) << 2) | (chr3 >> 6));
    const enc4 = isNaN(chr3) ? 64 : (chr3 & 63);

    output += alphabet.charAt(enc1) + alphabet.charAt(enc2) + alphabet.charAt(enc3) + alphabet.charAt(enc4);
  }
  return output;
}

export async function isSpeaking() {
  try {
    if (!currentSound) return false;
    if (!Audio) {
      Audio = await import('expo-av');
    }
    const status = await currentSound.getStatusAsync();
    return !!(status?.isLoaded && status?.isPlaying);
  } catch {
    return false;
  }
}

export async function stop() {
  try {
    if (!currentSound) return;
    if (!Audio) {
      Audio = await import('expo-av');
    }
    await currentSound.stopAsync().catch(() => {});
    await currentSound.unloadAsync().catch(() => {});
  } catch {}
  finally {
    currentSound = null;
  }
}

async function ensureAudioMode() {
  if (!Audio) {
    Audio = await import('expo-av');
  }
  try {
    await Audio.Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: Audio?.InterruptionModeIOS?.DoNotMix ?? 1,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {}
}

async function fallbackSpeakWithSpeech(text, opts) {
  try {
    const Speech = await import('expo-speech');
    const { language = 'en-US', pitch = 1.0, rate = 0.9, onDone, onError } = opts || {};
    Speech?.stop?.();
    Speech?.speak?.(String(text), { language, pitch, rate, onDone, onError });
  } catch (e) {
    console.warn('[OpenAI TTS] fallback to expo-speech failed:', e?.message);
  }
}

export async function speak(text, opts = {}) {
  try {
    const key = getEnv('EXPO_PUBLIC_OPENAI_API_KEY');
    if (!key || !text) {
      console.log('[OpenAI TTS] speak skipped - key/text missing');
      return;
    }

    let voice = (opts?.voice || getEnv('EXPO_PUBLIC_AI_TTS_VOICE', 'alloy') || 'alloy').trim().toLowerCase();
    if (!SUPPORTED_VOICES.has(voice)) {
      console.warn(
        `[OpenAI TTS] voice "${voice}" not supported. Falling back to 'alloy'.`
      );
      voice = 'alloy';
    }
    const format = 'mp3';

    // Stop any existing sound
    await stop();
    try {
      await ensureAudioMode();
    } catch (e) {}

    // Call OpenAI TTS API
    let resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice,
        input: String(text),
        format,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.warn('[OpenAI TTS] request failed', resp.status, errText?.slice(0, 200));
      // If the error is due to voice param, try one more time with 'alloy' before falling back
      if (!SUPPORTED_VOICES.has(voice)) {
        voice = 'alloy';
      }
      if (!errText || /Invalid value: '.*'/.test(errText)) {
        try {
          const retry = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: OPENAI_TTS_MODEL, voice, input: String(text), format }),
          });
          if (!retry.ok) {
            // Fallback to device speech
            await fallbackSpeakWithSpeech(text, opts);
            return;
          }
          resp = retry;
        } catch {
          await fallbackSpeakWithSpeech(text, opts);
          return;
        }
      } else {
        // Fallback to device speech if OpenAI returns an error
        await fallbackSpeakWithSpeech(text, opts);
        return;
      }
    }

    // React Native fetch doesn't support res.blob reliably; use base64 path
  const base64 = await resp.arrayBuffer().then((buf) => toBase64(new Uint8Array(buf)));

    // Write temp file
    const fileUri = FileSystem.cacheDirectory + `openai-tts-${Date.now()}.mp3`;
    const encoding = FileSystem?.EncodingType?.Base64 ?? 'base64';
    try {
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding });
    } catch (e) {
      console.warn('[OpenAI TTS] write file failed, falling back to Speech:', e?.message);
      await fallbackSpeakWithSpeech(text, opts);
      return;
    }

    try {
      if (!Audio) {
        Audio = await import('expo-av');
      }
      const { sound } = await Audio.Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true });
      currentSound = sound;

      // Auto cleanup on finish
      sound.setOnPlaybackStatusUpdate(async (status) => {
        try {
          if (status?.didJustFinish || status?.isLoaded === false) {
            await stop();
            // remove file best-effort
            FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
          }
        } catch {}
      });
    } catch (e) {
      console.warn('[OpenAI TTS] playback failed, falling back to Speech:', e?.message);
      await fallbackSpeakWithSpeech(text, opts);
      // try to remove file best-effort
      FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
      return;
    }
  } catch (e) {
    console.warn('[OpenAI TTS] speak error:', e?.message);
  }
}
