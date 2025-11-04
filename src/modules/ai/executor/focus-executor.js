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
    return { action: 'block', opaqueToken: alias.tokens.opaqueToken, durationMinutes, endLabel, alias };
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
  
  // Handle block action with either opaqueToken or apps array
  const hasOpaqueToken = plan.opaqueToken && typeof plan.opaqueToken === 'string';
  const hasApps = Array.isArray(plan.apps) && plan.apps.length > 0;
  
  if (!hasOpaqueToken && !hasApps) {
    Alert.alert('No Selection', 'No apps or categories were selected for blocking.');
    return false;
  }
  
  // Use Screen Time API if we have an opaque token and DeviceActivity is available
  if (hasOpaqueToken && DeviceActivity) {
    return await applyScreenTimeBlock(plan);
  }
  
  // Fallback to legacy bundle ID blocking
  if (hasApps) {
    return await applyLegacyBlock(plan);
  }
  
  Alert.alert('Not Available', 'Screen Time blocking is not available in this build.');
  return false;
}

async function applyScreenTimeBlock(plan) {
  const { opaqueToken, durationMinutes, endLabel, alias } = plan;
  
  try {
    console.log('[FocusExecutor] Starting Screen Time block with opaque token');
    
    // Create a unique selection ID for this voice-initiated session
    const selectionId = `voice_${alias.nickname}_${Date.now()}`;
    
    // Store the selection in AsyncStorage so it persists
    await setSelectedApps({
      familyActivitySelectionId: selectionId,
      nativeFamilyActivitySelection: opaqueToken,
    });
    
    // Configure shield UI
    const shieldConfig = {
      title: 'Stay Focused',
      subtitle: `Blocking ${alias.nickname} for ${durationMinutes} minutes`,
      primaryButtonLabel: 'Work It!',
      backgroundColor: { red: 137, green: 0, blue: 245, alpha: 0.95 },
      backgroundBlurStyle: 4,
      titleColor: { red: 255, green: 255, blue: 255, alpha: 1.0 },
      subtitleColor: { red: 200, green: 200, blue: 255, alpha: 1.0 },
      iconSystemName: 'hourglass',
      iconTint: { red: 0, green: 114, blue: 255, alpha: 1.0 },
      primaryButtonBackgroundColor: { red: 255, green: 255, blue: 255, alpha: 1.0 },
      primaryButtonLabelColor: { red: 0, green: 114, blue: 255, alpha: 1.0 },
    };
    
    DeviceActivity.updateShield(shieldConfig, {
      primary: { type: 'dismiss', behavior: 'close' },
    });
    
    // Configure blocking actions
    DeviceActivity.configureActions({
      activityName: 'focusSession',
      callbackName: 'intervalDidStart',
      actions: [
        { type: 'blockSelection', familyActivitySelection: opaqueToken },
      ],
    });
    
    DeviceActivity.configureActions({
      activityName: 'focusSession',
      callbackName: 'intervalDidEnd',
      actions: [
        { type: 'unblockSelection', familyActivitySelection: opaqueToken },
      ],
    });
    
    // Immediately block
    try {
      DeviceActivity.blockSelection({ familyActivitySelection: opaqueToken });
      console.log('[FocusExecutor] Immediate block applied');
    } catch (e) {
      console.log('[FocusExecutor] Immediate block error:', e);
    }
    
    // Set up monitoring schedule
    const nowDate = new Date();
    const startDate = new Date(nowDate.getTime() + 5 * 1000);
    const monitorMinutes = Math.max(30, durationMinutes);
    const monitorEnd = new Date(startDate.getTime() + monitorMinutes * 60 * 1000);
    
    const schedule = {
      intervalStart: {
        year: startDate.getFullYear(),
        month: startDate.getMonth() + 1,
        day: startDate.getDate(),
        hour: startDate.getHours(),
        minute: startDate.getMinutes(),
        second: startDate.getSeconds(),
      },
      intervalEnd: {
        year: monitorEnd.getFullYear(),
        month: monitorEnd.getMonth() + 1,
        day: monitorEnd.getDate(),
        hour: monitorEnd.getHours(),
        minute: monitorEnd.getMinutes(),
        second: monitorEnd.getSeconds(),
      },
      repeats: false,
    };
    
    await DeviceActivity.startMonitoring('focusSession', schedule, []);
    console.log('[FocusExecutor] Monitoring started');
    
    // Save session state
    const endAt = Date.now() + durationMinutes * 60 * 1000;
    await setSession({
      active: true,
      endAt,
      totalSeconds: durationMinutes * 60,
      startedAt: Date.now(),
    });
    
    // Success feedback
    setTimeout(() => {
      ttsSpeak(`Blocking started for ${durationMinutes} minutes. It will end at ${endLabel}.`);
      Alert.alert(
        'Blocking started',
        `${alias.nickname} blocked until ${endLabel}. Undo?`,
        [
          { text: 'Keep', style: 'default' },
          { 
            text: 'Undo', 
            style: 'destructive', 
            onPress: async () => {
              try {
                DeviceActivity.unblockSelection({ familyActivitySelection: opaqueToken });
                DeviceActivity.stopMonitoring(['focusSession']);
                await setSession({ active: false, endAt: null, totalSeconds: null });
              } catch (e) {
                console.log('[FocusExecutor] Undo error:', e);
              }
            }
          },
        ]
      );
    }, 300);
    
    return true;
  } catch (error) {
    console.log('[FocusExecutor] Screen Time block error:', error);
    Alert.alert('Error', 'Failed to start blocking. Please try again.');
    return false;
  }
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
