// Maps intents to existing blocker API.
// Handles both opaque tokens (Screen Time) and legacy bundle IDs.

import { Alert, Platform } from 'react-native';
import AppBlocker from '../../../components/AppBlocker';
import { resolveAlias } from '../aliases/alias-store';
import { formatMinutesToEndTime } from '../../../utils/time';
import { speak as ttsSpeak } from '../voice/tts-service';
import { setSession, setSelectedApps } from '../../../storage';

// Import react-native-device-activity for Screen Time blocking
let DeviceActivity = null;
if (Platform.OS === 'ios') {
  try {
    const lib = require('react-native-device-activity');
    DeviceActivity = lib;
  } catch (error) {
    console.log('[FocusExecutor] react-native-device-activity not available:', error.message);
  }
}

export async function planFromIntent(intent) {
  if (!intent) return null;
  if (intent.action === 'stop') {
    return { action: 'stop' };
  }
  // Resolve alias to tokens
  const alias = await resolveAlias(intent.target);
  if (!alias || !alias.tokens) {
    return { action: 'noop', reason: 'alias-not-found', target: intent.target };
  }
  
  // Check if alias has either opaqueToken or apps array
  const hasOpaqueToken = alias.tokens.opaqueToken && typeof alias.tokens.opaqueToken === 'string';
  const hasApps = Array.isArray(alias.tokens.apps) && alias.tokens.apps.length > 0;
  
  if (!hasOpaqueToken && !hasApps) {
    return { action: 'noop', reason: 'alias-not-found', target: intent.target };
  }
  
  const durationMinutes = Math.max(1, intent.durationMinutes || 30);
  const endLabel = formatMinutesToEndTime(durationMinutes);
  
  // Return plan with either opaque token or apps array
  if (hasOpaqueToken) {
    // Mark that this needs navigation to ActiveSession for proper blocking
    return { 
      action: 'block', 
      opaqueToken: alias.tokens.opaqueToken, 
      durationMinutes, 
      endLabel, 
      alias,
      needsActiveSession: true  // Signal to navigate instead of applying inline
    };
  } else {
    return { action: 'block', apps: alias.tokens.apps, durationMinutes, endLabel, alias };
  }
}

export async function applyPlan(plan) {
  if (!plan) return false;
  
  if (plan.action === 'stop') {
    // Stop any active blocking
    if (DeviceActivity) {
      try {
        DeviceActivity.stopMonitoring(['focusSession']);
        console.log('[FocusExecutor] DeviceActivity monitoring stopped');
      } catch (e) {
        console.log('[FocusExecutor] Error stopping monitoring:', e);
      }
    }
    await AppBlocker.stopBlocking();
    await setSession({ active: false, endAt: null, totalSeconds: null });
    return true;
  }
  
  if (plan.action === 'noop') {
    // Alias not found - caller (VoiceMicButton) should handle navigation to picker
    return false;
  }
  
  // If plan needs ActiveSession navigation (opaque token), just prepare state
  if (plan.needsActiveSession && plan.opaqueToken) {
    console.log('[FocusExecutor] Preparing for ActiveSession navigation');
    // Store the opaque token selection so ActiveSessionScreen can use it
    await setSelectedApps({
      familyActivitySelectionId: `voice_${plan.alias.nickname}_${Date.now()}`,
      nativeFamilyActivitySelection: plan.opaqueToken,
    });
    // Return true with special flag - caller should navigate
    return { success: true, needsNavigation: true, durationSeconds: plan.durationMinutes * 60 };
  }
  
  // Handle legacy bundle ID blocking
  const hasApps = Array.isArray(plan.apps) && plan.apps.length > 0;
  if (hasApps) {
    return await applyLegacyBlock(plan);
  }
  
  Alert.alert('Not Available', 'Screen Time blocking is not available in this build.');
  return false;
}

async function applyLegacyBlock(plan) {
  const { apps, durationMinutes, endLabel } = plan;
  
  if (!AppBlocker.isAvailable) {
    Alert.alert('Not Available', 'Screen Time blocking is not available in this build.');
    return false;
  }
  
  try {
    await AppBlocker.requestAuthorization();
  } catch {}
  
  const ok = await AppBlocker.startBlocking(apps, durationMinutes * 60);
  
  if (ok) {
    setTimeout(() => {
      ttsSpeak(`Blocking started for ${durationMinutes} minutes. It will end at ${endLabel}.`);
      Alert.alert(
        'Blocking started',
        `Will end at ${endLabel}. Undo?`,
        [
          { text: 'Keep', style: 'default' },
          { text: 'Undo', style: 'destructive', onPress: () => AppBlocker.stopBlocking() },
        ]
      );
    }, 300);
  }
  
  return !!ok;
}
