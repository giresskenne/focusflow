// Maps intents to existing blocker API.
// For MVP we handle action='block' with alias tokens.apps as bundle identifiers.

import { Alert } from 'react-native';
import AppBlocker from '../../../components/AppBlocker';
import { resolveAlias } from '../aliases/alias-store';
import { formatMinutesToEndTime } from '../../../utils/time';
import { speak as ttsSpeak } from '../voice/tts-service';

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
    await AppBlocker.stopBlocking();
    return true;
  }
  if (plan.action === 'noop') {
    // Alias not found - caller (VoiceMicButton) should handle navigation to picker
    return false;
  }
  if (!AppBlocker.isAvailable) {
    Alert.alert('Not Available', 'Screen Time blocking is not available in this build.');
    return false;
  }
  try {
    await AppBlocker.requestAuthorization();
  } catch {}
  const ok = await AppBlocker.startBlocking(plan.apps, plan.durationMinutes * 60);
  if (ok) {
    // Offer undo
    setTimeout(() => {
      ttsSpeak(`Blocking started for ${plan.durationMinutes} minutes. It will end at ${plan.endLabel}.`);
      Alert.alert(
        'Blocking started',
        `Will end at ${plan.endLabel}. Undo?`,
        [
          { text: 'Keep', style: 'default' },
          { text: 'Undo', style: 'destructive', onPress: () => AppBlocker.stopBlocking() },
        ]
      );
    }, 300);
  }
  return !!ok;
}
