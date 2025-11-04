// Maps intents to existing blocker API.
// For MVP we handle action='block' with alias tokens.apps as bundle identifiers.

import { Alert } from 'react-native';
import AppBlocker from '../../../components/AppBlocker';
import { resolveAlias } from '../aliases/alias-store';
import { isFamilyPickerAvailable, createAliasViaPicker } from '../aliases/alias-native';
import { formatMinutesToEndTime } from '../../../utils/time';
import { speak as ttsSpeak } from '../voice/tts-service';

export async function planFromIntent(intent) {
  if (!intent) return null;
  if (intent.action === 'stop') {
    return { action: 'stop' };
  }
  // Resolve alias to tokens; MVP: use apps only
  const alias = await resolveAlias(intent.target);
  if (!alias || !alias.tokens || !Array.isArray(alias.tokens.apps) || alias.tokens.apps.length === 0) {
    return { action: 'noop', reason: 'alias-not-found', target: intent.target };
  }
  const apps = alias.tokens.apps;
  const durationMinutes = Math.max(1, intent.durationMinutes || 30);
  const endLabel = formatMinutesToEndTime(durationMinutes);
  return { action: 'block', apps, durationMinutes, endLabel, alias };
}

export async function applyPlan(plan) {
  if (!plan) return false;
  if (plan.action === 'stop') {
    await AppBlocker.stopBlocking();
    return true;
  }
  if (plan.action === 'noop') {
    // Offer to create alias via FamilyActivityPicker when available (spec §7B)
    if (isFamilyPickerAvailable()) {
      return await new Promise((resolve) => {
        ttsSpeak(`I couldn't find a nickname for ${plan.target}. Pick the apps once, and I'll remember it.`);
        Alert.alert(
          'Teach Mada a name',
          `Pick the apps/categories for "${plan.target}" once. Mada will remember this name.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Pick apps', style: 'default', onPress: async () => {
              const alias = await createAliasViaPicker(plan.target);
              if (!alias || !alias.tokens?.apps?.length) {
                Alert.alert('No selection', 'No apps/categories were selected.');
                return resolve(false);
              }
              // Re-plan and apply with the new alias
              const nextPlan = await planFromIntent({ ...plan, action: 'block', target: plan.target, durationMinutes: plan.durationMinutes || 30 });
              const ok = await applyPlan(nextPlan);
              resolve(ok);
            }},
          ]
        );
      });
    }
    Alert.alert('Not found', `I couldn't find an alias for "${plan.target}". Create a nickname first from Settings.`);
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
