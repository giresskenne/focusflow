// Safe expo-speech wrapper to prevent TurboModule crashes
// The crash occurs when expo-speech tries to load AVSpeechSynthesisVoice.speechVoices()
// during module initialization, which can fail and crash the entire app

import { Platform } from 'react-native';

let Speech = null;
let speechInitialized = false;
let speechAvailable = false;

// Lazy load expo-speech with error handling
function initializeSpeech() {
  if (speechInitialized) {
    return speechAvailable;
  }

  try {
    // PRODUCTION SAFETY: Completely disable TTS in production to prevent TurboModule crashes
    const isProduction = process.env.EXPO_PUBLIC_ENV === 'production';
    const ttsEnabled = process.env.EXPO_PUBLIC_AI_TTS_ENABLED === 'true';
    
    if (isProduction) {
      console.log('[Speech] TTS disabled in production for stability');
      speechAvailable = false;
      speechInitialized = true;
      return false;
    }

    // Only try to load on iOS, and only if TTS is enabled
    if (Platform.OS === 'ios' && ttsEnabled) {
      Speech = require('expo-speech');
      speechAvailable = true;
      console.log('[Speech] expo-speech loaded successfully');
    } else {
      console.log('[Speech] Speech disabled or not on iOS');
      speechAvailable = false;
    }
  } catch (error) {
    console.warn('[Speech] Failed to load expo-speech:', error.message);
    speechAvailable = false;
    Speech = null;
  } finally {
    speechInitialized = true;
  }

  return speechAvailable;
}

// Safe speech functions with fallbacks
export const safeSpeech = {
  speak: async (text, options = {}) => {
    try {
      if (!initializeSpeech() || !Speech) {
        console.log('[Speech] Speech not available, skipping TTS');
        return false;
      }

      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 1.0,
        ...options
      });
      return true;
    } catch (error) {
      console.warn('[Speech] TTS failed:', error.message);
      return false;
    }
  },

  stop: () => {
    try {
      if (speechAvailable && Speech) {
        Speech.stop();
      }
    } catch (error) {
      console.warn('[Speech] Stop TTS failed:', error.message);
    }
  },

  isSpeaking: () => {
    try {
      if (speechAvailable && Speech) {
        return Speech.isSpeaking();
      }
      return false;
    } catch (error) {
      console.warn('[Speech] isSpeaking check failed:', error.message);
      return false;
    }
  },

  pause: () => {
    try {
      if (speechAvailable && Speech) {
        Speech.pause();
      }
    } catch (error) {
      console.warn('[Speech] Pause TTS failed:', error.message);
    }
  },

  resume: () => {
    try {
      if (speechAvailable && Speech) {
        Speech.resume();
      }
    } catch (error) {
      console.warn('[Speech] Resume TTS failed:', error.message);
    }
  },

  // Check if speech is available without triggering module load
  isAvailable: () => {
    // PRODUCTION SAFETY: Always return false in production
    if (process.env.EXPO_PUBLIC_ENV === 'production') {
      return false;
    }
    return Platform.OS === 'ios' && process.env.EXPO_PUBLIC_AI_TTS_ENABLED === 'true';
  },

  // Initialize speech module safely
  initialize: () => {
    return initializeSpeech();
  }
};

export default safeSpeech;