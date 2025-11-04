import { parseCommand } from './grammar';
import { parseDurationToMinutes } from '../../../utils/time';
import { parseIntentWithAI, isAIParserAvailable } from './ai-intent-parser';
import { 
  getContext, 
  resolvePronouns, 
  resolveRelativeDuration 
} from '../conversation-context';
import { classifyIntent } from './intent-classifier';

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
 * Shape for block: {
 *   action: 'block'|'start'|'stop',
 *   targetType: 'alias'|'preset',
 *   target: string,
 *   durationMinutes?: number,
 * }
 * 
 * Shape for remind: {
 *   action: 'remind',
 *   message: string,
 *   reminderType: 'one-time'|'daily'|'weekly'|'custom',
 *   time?: string,  // For scheduled reminders
 *   durationMinutes?: number,  // For "remind me in X minutes"
 *   days?: string[],  // For weekly/custom: ['monday', 'wednesday']
 * }
 */
export async function parseIntent(text, { allowDefaultDuration = true, aliases = [] } = {}) {
  // Get conversation context for resolving references
  const context = await getContext();

  // First, classify the intent
  const classification = classifyIntent(text, aliases);
  console.log('[parseIntent] Classification:', classification.type, classification.confidence);

  // If off-topic or unclear, return classification info
  if (classification.type === 'off-topic' || classification.type === 'unclear-action' || classification.type === 'unclear-target') {
    return {
      action: 'classification',
      classification,
      needsGuidance: true,
    };
  }

  // Resolve relative durations like "for longer", "add 10 minutes"
  const relativeDuration = resolveRelativeDuration(text, context);
  if (relativeDuration) {
    console.log('[parseIntent] Using relative duration:', relativeDuration);
    return {
      action: 'block',
      targetType: 'alias',
      target: relativeDuration.target,
      durationMinutes: relativeDuration.durationMinutes,
    };
  }

  // Resolve pronouns like "it", "that", "again"
  const resolvedText = resolvePronouns(text, context);

  // Try AI parser first if available and enabled
  if (AI_INTENTS_ENABLED && isAIParserAvailable()) {
    try {
      const aiResult = await parseIntentWithAI(resolvedText);
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
  const cmd = parseCommand(resolvedText);
  if (!cmd) return null;

  let action = cmd.action;
  // normalize action synonyms
  if (action === 'start') action = 'block';
  if (action !== 'block' && action !== 'stop' && action !== 'remind') action = 'block';

  // Handle reminder intent
  if (action === 'remind' || /\b(remind|reminder)\b/i.test(resolvedText)) {
    return parseReminderIntent(resolvedText, cmd);
  }

  // Handle block/stop intent
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

/**
 * Parse reminder-specific intent
 * @param {string} text - Resolved text
 * @param {Object} cmd - Parsed command from grammar
 * @returns {Object} Reminder intent
 */
function parseReminderIntent(text, cmd) {
  const lowerText = text.toLowerCase();

  // Extract message (what to remind about)
  let message = '';
  const toMatch = lowerText.match(/remind me to (.+?)(?:\s+in\s+|\s+at\s+|\s+every\s+|\s+on\s+|$)/i);
  if (toMatch) {
    message = toMatch[1].trim();
  } else {
    // Fallback: extract everything after "remind me"
    const aboutMatch = lowerText.match(/remind me (.+)/i);
    if (aboutMatch) {
      message = aboutMatch[1].trim();
    }
  }

  // Detect reminder type
  let reminderType = 'one-time';
  let time = null;
  let durationMinutes = null;
  let days = [];

  // Daily reminder: "every day", "daily", "each day"
  if (/\b(every day|daily|each day|everyday)\b/i.test(lowerText)) {
    reminderType = 'daily';
    // Extract time: "at 9 AM", "at 9:00"
    const timeMatch = lowerText.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
    }
  }
  // Weekly reminder: "every week", "weekly", "every monday"
  else if (/\b(every week|weekly|every (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.test(lowerText)) {
    reminderType = 'weekly';
    // Extract day
    const dayMatch = lowerText.match(/every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (dayMatch) {
      days = [dayMatch[1].toLowerCase()];
    }
    // Extract time
    const timeMatch = lowerText.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
    }
  }
  // Custom reminder: "on mondays and wednesdays", "mondays, tuesdays"
  else if (/\b(on|every)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(lowerText)) {
    reminderType = 'custom';
    // Extract all days
    const dayMatches = lowerText.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi);
    if (dayMatches) {
      days = dayMatches.map(d => d.toLowerCase());
    }
    // Extract time
    const timeMatch = lowerText.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
    }
  }
  // One-time: "in X minutes/hours", "in 30 minutes"
  else if (/\bin\s+\d+/i.test(lowerText)) {
    reminderType = 'one-time';
    // Extract duration
    const durationMatch = lowerText.match(/in\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)/i);
    if (durationMatch) {
      const num = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      durationMinutes = unit.startsWith('h') ? num * 60 : num;
    }
  }

  return {
    action: 'remind',
    message,
    reminderType,
    time,
    durationMinutes,
    days: days.length > 0 ? days : null,
  };
}
