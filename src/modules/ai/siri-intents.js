// Siri Intent Handler for App Intents integration
// Processes intents triggered via Siri/Shortcuts by reading from App Group storage

import { Linking, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleUtterance } from './index';

const INTENT_CHECK_KEY = 'last_siri_intent_check';
const INTENT_COOLDOWN_MS = 2000; // Don't reprocess same intent within 2s

let intentListener = null;
let appStateListener = null;

/**
 * Check for pending Siri intent in App Group storage and process it
 */
async function checkPendingSiriIntent() {
  try {
    // Throttle checks to avoid duplicate processing
    const lastCheck = await AsyncStorage.getItem(INTENT_CHECK_KEY);
    if (lastCheck && Date.now() - parseInt(lastCheck, 10) < INTENT_COOLDOWN_MS) {
      return null;
    }
    await AsyncStorage.setItem(INTENT_CHECK_KEY, String(Date.now()));

    // In RN, we can't directly read App Group UserDefaults, so we rely on deep link params
    // The Swift intent already opens the app with focusflow://siri?action=...
    // This function is called when the app receives that deep link
    return null;
  } catch (e) {
    console.warn('[SiriIntents] checkPendingSiriIntent error:', e?.message);
    return null;
  }
}

/**
 * Process a Siri intent from deep link URL
 * @param {string} url - Deep link URL from Siri shortcut
 */
async function processSiriDeepLink(url) {
  try {
    console.log('[SiriIntents] Processing deep link:', url);
    const urlObj = new URL(url);
    const action = urlObj.searchParams.get('action');
    
    if (action === 'start_focus') {
      const alias = urlObj.searchParams.get('alias');
      const duration = parseInt(urlObj.searchParams.get('duration'), 10) || 30;
      
      if (!alias) {
        console.warn('[SiriIntents] Missing alias parameter');
        return;
      }
      
      // Construct a natural language utterance for handleUtterance
      const utterance = `Block ${alias} for ${duration} minutes`;
      console.log('[SiriIntents] Executing:', utterance);
      
      // Process through existing voice flow (with confirmation)
      const result = await handleUtterance(utterance, { confirm: true });
      console.log('[SiriIntents] Result:', result);
      
      // If needs navigation, caller (App.js deep link handler) should handle it
      return result;
      
    } else if (action === 'stop_blocking') {
      console.log('[SiriIntents] Executing: Stop blocking');
      const result = await handleUtterance('Stop blocking', { confirm: false });
      console.log('[SiriIntents] Result:', result);
      return result;
    }
    
    console.warn('[SiriIntents] Unknown action:', action);
    return null;
  } catch (e) {
    console.error('[SiriIntents] processSiriDeepLink error:', e?.message);
    return null;
  }
}

/**
 * Initialize Siri intent listener
 * Call this in App.js on mount
 */
export function initializeSiriIntents() {
  if (intentListener) return; // Already initialized
  
  console.log('[SiriIntents] Initializing...');
  
  // Listen for deep links when app is already open
  intentListener = Linking.addEventListener('url', async ({ url }) => {
    if (url?.includes('focusflow://siri')) {
      await processSiriDeepLink(url);
    }
  });
  
  // Check for deep link that opened the app (cold start)
  Linking.getInitialURL().then(async (url) => {
    if (url?.includes('focusflow://siri')) {
      // Small delay to ensure navigation is ready
      setTimeout(async () => {
        await processSiriDeepLink(url);
      }, 500);
    }
  });
  
  // Also check on app state change (background → foreground)
  appStateListener = AppState.addEventListener('change', async (state) => {
    if (state === 'active') {
      const url = await Linking.getInitialURL();
      if (url?.includes('focusflow://siri')) {
        await processSiriDeepLink(url);
      }
    }
  });
  
  console.log('[SiriIntents] Initialized');
}

/**
 * Clean up listeners (call on unmount if needed)
 */
export function cleanupSiriIntents() {
  intentListener?.remove();
  appStateListener?.remove();
  intentListener = null;
  appStateListener = null;
  console.log('[SiriIntents] Cleaned up');
}

export { checkPendingSiriIntent, processSiriDeepLink };
