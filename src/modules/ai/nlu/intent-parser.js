import { parseCommand } from './grammar';
import { parseDurationToMinutes } from '../../../utils/time';
import { parseIntentWithAI, isAIParserAvailable } from './ai-intent-parser';

function envFlag(name, def = false) {
  const v = process.env[name] ?? process.env[`EXPO_PUBLIC_${name}`];
  if (typeof v === 'string') return v === 'true';
  return def;
}

const AI_INTENTS_ENABLED = envFlag('AI_INTENTS_ENABLED', false);

/**
 * Parse a user utterance into a structured intent.
 * Returns null if no intent can be parsed.
 *
 * Shape: {
 *   action: 'block'|'start'|'stop',
 *   targetType: 'alias'|'preset',
 *   target: string,            // nickname or preset name
 *   durationMinutes?: number,  // optional for stop
 * }
 */
export async function parseIntent(text, { allowDefaultDuration = true } = {}) {
  // Try AI parser first if available and enabled
  if (AI_INTENTS_ENABLED && isAIParserAvailable()) {
    try {
      const aiResult = await parseIntentWithAI(text);
      if (aiResult) {
        // AI parser doesn't auto-default duration; apply flag if needed
        if (allowDefaultDuration && aiResult.action === 'block' && (!aiResult.durationMinutes || aiResult.durationMinutes < 1)) {
          aiResult.durationMinutes = 30;
        }
        return aiResult;
      }
    } catch (e) {
      console.warn('[parseIntent] AI parser failed, falling back to regex:', e?.message);
    }
  }

  // Fallback: Regex-based parser for offline/no-API scenarios
  const cmd = parseCommand(text);
  if (!cmd) return null;

  let action = cmd.action;
  // normalize action synonyms
  if (action === 'start') action = 'block';
  if (action !== 'block' && action !== 'stop') action = 'block';

  const targetRaw = cmd.targetText || '';
  // heuristic: if user says "preset ...", treat as preset
  let targetType = targetRaw.startsWith('preset ') ? 'preset' : 'alias';
  const target = targetRaw.replace(/^preset\s+/, '').trim();

  let durationMinutes = 0;
  if (cmd.durationText) {
    durationMinutes = parseDurationToMinutes(cmd.durationText);
  }

  // Provide a basic default if missing duration and action is block
  if (allowDefaultDuration && action === 'block' && (!durationMinutes || durationMinutes < 1)) {
    durationMinutes = 30;
  }

  return { action, targetType, target, durationMinutes };
}
