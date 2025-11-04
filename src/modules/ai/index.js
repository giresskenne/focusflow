import { parseIntent } from './nlu/intent-parser';
import { planFromIntent, applyPlan } from './executor/focus-executor';
import * as STT from './voice/stt-service';
import * as TTS from './voice/tts-service';

function flag(name, def = false) {
  const direct = process.env[name];
  const expo = process.env[`EXPO_PUBLIC_${name}`];
  const v = typeof direct === 'string' ? direct : expo;
  if (typeof v === 'string') return v === 'true';
  return def;
}

export const FLAGS = {
  AI_VOICE_ENABLED: flag('AI_VOICE_ENABLED', false),
  AI_INTENTS_ENABLED: flag('AI_INTENTS_ENABLED', false),
  AI_AUTO_APPLY: flag('AI_AUTO_APPLY', false),
  AI_TTS_ENABLED: flag('AI_TTS_ENABLED', true),
};

export async function handleUtterance(text, { confirm = true } = {}) {
  console.log('[AI] handleUtterance called with:', text, 'confirm:', confirm);
  const intent = await parseIntent(text);
  console.log('[AI] parseIntent result:', intent);
  if (!intent) return { ok: false, reason: 'no-intent' };
  
  const plan = await planFromIntent(intent);
  console.log('[AI] planFromIntent result:', plan);
  if (!plan) return { ok: false, reason: 'no-plan' };

  // Handle noop case (alias not found)
  if (plan.action === 'noop') {
    console.log('[AI] Plan is noop, returning for caller to handle');
    return { ok: true, intent, plan, isNoop: true };
  }

  if (confirm && plan.action === 'block') {
    // caller should present confirmation UI; return plan for rendering
    console.log('[AI] Returning plan for confirmation');
    return { ok: true, intent, plan, pendingConfirmation: true };
  }

  const applied = await applyPlan(plan);
  console.log('[AI] applyPlan result:', applied);
  
  // Check if plan needs navigation to ActiveSession
  if (applied && typeof applied === 'object' && applied.needsNavigation) {
    console.log('[AI] Plan requires ActiveSession navigation');
    return { ok: true, intent, plan, applied: true, needsNavigation: true, durationSeconds: applied.durationSeconds };
  }
  
  return { ok: applied, intent, plan, applied };
}

export const STTService = STT;
export const TTSService = TTS;
