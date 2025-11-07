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

  // If the utterance is a reminder, handle via reminder parser even if the grammar doesn't parse
  if (/\b(remind|reminder)\b/i.test(resolvedText)) {
    console.log('[parseIntent] Reminder keyword detected, using reminder parser');
    return parseReminderIntent(resolvedText, null);
  }

  // Fallback: Regex/grammar-based parser for block/stop intents
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
  let confidence = 0.4; // Base confidence for reminder detection

  // Daily reminder: "every day", "daily", "each day"
  if (/\b(every day|daily|each day|everyday)\b/i.test(lowerText)) {
    reminderType = 'daily';
    confidence += 0.2; // Boost for clear pattern
    // Extract time: "at 9 AM", "at 9:00"
    const timeMatch = lowerText.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
      confidence += 0.15; // Boost for having time
    }
  }
  // Weekly reminder: "every week", "weekly", "every monday"
  else if (/\b(every week|weekly|every (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.test(lowerText)) {
    reminderType = 'weekly';
    confidence += 0.2; // Boost for clear pattern
    // Extract day
    const dayMatch = lowerText.match(/every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (dayMatch) {
      days = [dayMatch[1].toLowerCase()];
      confidence += 0.1; // Boost for having day
    }
    // Extract time
    const timeMatch = lowerText.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
      confidence += 0.15; // Boost for having time
    }
  }
  // Custom reminder: "on mondays and wednesdays", "mondays, tuesdays"
  else if (/\b(on|every)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(lowerText)) {
    reminderType = 'custom';
    confidence += 0.15; // Boost for custom pattern
    // Extract all days
    const dayMatches = lowerText.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi);
    if (dayMatches) {
      days = dayMatches.map(d => d.toLowerCase());
      confidence += 0.1; // Boost for having days
    }
    // Extract time
    const timeMatch = lowerText.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
      confidence += 0.15; // Boost for having time
    }
  }
  // One-time: "in X minutes/hours", supporting digits and number words
  else if (/\bin\s+/i.test(lowerText)) {
    reminderType = 'one-time';
    confidence += 0.15; // Boost for "in" pattern
    // First try digits
    let dm = lowerText.match(/in\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)/i);
    if (dm) {
      const num = parseInt(dm[1], 10);
      const unit = dm[2].toLowerCase();
      durationMinutes = unit.startsWith('h') ? num * 60 : num;
      confidence += 0.2; // Strong boost for complete duration
    } else {
      // Try number words (e.g., "five", "twenty five", "a", "an")
      const wm = lowerText.match(/in\s+([a-z\-\s]+?)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/i);
      if (wm) {
        const quantity = wm[1].trim();
        const unit = wm[2].toLowerCase();

        // Special phrases
        if (/half\s+(an\s+)?hour/.test(lowerText)) {
          durationMinutes = 30;
          confidence += 0.2;
        } else if (/(quarter\s+of\s+an\s+hour|quarter\s+hour)/.test(lowerText)) {
          durationMinutes = 15;
          confidence += 0.2;
        } else {
          const num = wordsToNumber(quantity);
          if (Number.isFinite(num) && num > 0) {
            durationMinutes = unit.startsWith('h') ? num * 60 : num;
            confidence += 0.15; // Moderate boost for word numbers
          }
        }
      }
    }
  }
  
  // Bonus if has meaningful message (more than 3 chars)
  if (message && message.length > 3) {
    confidence += 0.1;
  }
  
  // Cap confidence at 1.0
  confidence = Math.min(1.0, confidence);

  return {
    action: 'remind',
    message,
    reminderType,
    time,
    durationMinutes,
    days: days.length > 0 ? days : null,
    confidence, // Add confidence to result
  };
}

// Convert simple English number words to ints (covers 0-99 + 'a'/'an')
function wordsToNumber(words) {
  if (!words) return NaN;
  const s = words.trim().toLowerCase().replace(/\s+-\s+/g, '-');
  if (s === 'a' || s === 'an' || s === 'one') return 1;
  const ones = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19,
  };
  const tens = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

  // direct match
  if (s in ones) return ones[s];
  if (s in tens) return tens[s];

  // hyphenated like twenty-five
  if (s.includes('-')) {
    const [t, o] = s.split('-');
    const tv = tens[t] || 0;
    const ov = ones[o] || 0;
    const v = tv + ov;
    return v || NaN;
  }

  // two words like 'twenty five'
  const parts = s.split(/\s+/);
  if (parts.length === 2 && parts[0] in tens && parts[1] in ones) {
    return tens[parts[0]] + ones[parts[1]];
  }

  // fallback: try to parse a leading number if present
  const m = s.match(/^(\d+)/);
  if (m) return parseInt(m[1], 10);

  return NaN;
}
