// OpenAI TTS provider using expo-av for playback and expo-file-system for temp storage
// Requires:
// - EXPO_PUBLIC_OPENAI_API_KEY set in env (do NOT hardcode secrets)
// - EXPO_PUBLIC_AI_TTS_VOICE optional (defaults to 'alloy'). Valid examples: 'alloy', 'aria', 'verse', 'sol', 'luna'
// - expo-av and expo-file-system deps

// Use legacy API for writeAsStringAsync/deleteAsync on Expo SDK 54+
import * as FileSystem from 'expo-file-system/legacy';

let Audio; // lazy import expo-av to avoid issues in web builds
let currentSound = null;

const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';

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
  if (!key) { console.log('[OpenAI TTS] isAvailable: false (no API key)'); return false; }
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
  console.log('[OpenAI TTS] isAvailable:', !!key && avAvailable);
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

    const voice = (opts?.voice || getEnv('EXPO_PUBLIC_AI_TTS_VOICE', 'alloy')).trim();
    const format = 'mp3';

    // Stop any existing sound
    await stop();
    try {
      await ensureAudioMode();
    } catch (e) {}

    // Call OpenAI TTS API
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
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

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[OpenAI TTS] request failed', res.status, errText?.slice(0, 200));
      return;
    }

    // React Native fetch doesn't support res.blob reliably; use base64 path
    const base64 = await res.arrayBuffer().then((buf) => toBase64(new Uint8Array(buf)));

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
