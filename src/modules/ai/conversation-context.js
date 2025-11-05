// Conversation Context Store
// Maintains session memory for multi-turn conversations
// Enables commands like "Block it for longer", "Stop that", "Do it again"

import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTEXT_KEY = 'ai_conversation_context';
const CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 minutes - context expires after this

let memoryContext = null; // In-memory cache for faster access

/**
 * @typedef {Object} ConversationContext
 * @property {string|null} lastAction - Last action performed ('block' | 'stop')
 * @property {string|null} lastTarget - Last app/alias/category blocked
 * @property {number|null} lastDurationMinutes - Last duration used
 * @property {number} timestamp - When context was last updated
 * @property {Object|null} lastIntent - Full last intent object
 * @property {Object|null} lastPlan - Full last plan object
 */

/**
 * Get current conversation context
 * @returns {Promise<ConversationContext|null>}
 */
export async function getContext() {
  try {
    // Return in-memory if fresh
    if (memoryContext && Date.now() - memoryContext.timestamp < CONTEXT_TTL_MS) {
      return memoryContext;
    }

    // Load from storage
    const stored = await AsyncStorage.getItem(CONTEXT_KEY);
    if (!stored) return null;

    const context = JSON.parse(stored);
    
    // Check if expired
    if (Date.now() - context.timestamp > CONTEXT_TTL_MS) {
      await clearContext();
      return null;
    }

    memoryContext = context;
    return context;
  } catch (e) {
    console.warn('[ConversationContext] getContext error:', e?.message);
    return null;
  }
}

/**
 * Update conversation context after an action
 * @param {Object} data - Context data to save
 * @param {string} data.action - Action performed
 * @param {string} [data.target] - Target app/alias
 * @param {number} [data.durationMinutes] - Duration used
 * @param {Object} [data.intent] - Full intent object
 * @param {Object} [data.plan] - Full plan object
 */
export async function updateContext(data) {
  try {
    const context = {
      lastAction: data.action || null,
      lastTarget: data.target || null,
      lastDurationMinutes: data.durationMinutes || null,
      timestamp: Date.now(),
      lastIntent: data.intent || null,
      lastPlan: data.plan || null,
    };

    memoryContext = context;
    await AsyncStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
    console.log('[ConversationContext] Updated:', {
      action: context.lastAction,
      target: context.lastTarget,
      duration: context.lastDurationMinutes,
    });
  } catch (e) {
    console.warn('[ConversationContext] updateContext error:', e?.message);
  }
}

/**
 * Clear conversation context
 */
export async function clearContext() {
  try {
    memoryContext = null;
    await AsyncStorage.removeItem(CONTEXT_KEY);
    console.log('[ConversationContext] Cleared');
  } catch (e) {
    console.warn('[ConversationContext] clearContext error:', e?.message);
  }
}

/**
 * Resolve pronoun references using context
 * @param {string} text - User utterance
 * @param {ConversationContext|null} context - Current context
 * @returns {string} - Resolved utterance
 */
export function resolvePronouns(text, context) {
  if (!context || !text) return text;

  const lowerText = text.toLowerCase();
  
  // Replace "it", "that", "them" with last target
  if (context.lastTarget) {
    const pronouns = /\b(it|that|them|those)\b/gi;
    if (pronouns.test(lowerText)) {
      text = text.replace(pronouns, context.lastTarget);
      console.log('[ConversationContext] Resolved pronoun:', text);
    }
  }

  // Handle "again" - repeat last action
  if (/\bagain\b/i.test(lowerText) && context.lastIntent) {
    const { action, target, durationMinutes } = context.lastIntent;
    if (action === 'block' && target) {
      const duration = durationMinutes || context.lastDurationMinutes || 30;
      text = `Block ${target} for ${duration} minutes`;
      console.log('[ConversationContext] Resolved "again":', text);
    }
  }

  return text;
}

/**
 * Resolve relative durations like "for longer", "add 10 minutes"
 * @param {string} text - User utterance
 * @param {ConversationContext|null} context - Current context
 * @returns {Object|null} - { target, durationMinutes } or null
 */
export function resolveRelativeDuration(text, context) {
  if (!context) return null;

  const lowerText = text.toLowerCase();

  // "for longer" / "extend" / "more time"
  if (/\b(longer|extend|more time|keep going)\b/i.test(lowerText)) {
    if (context.lastTarget && context.lastDurationMinutes) {
      // Add 50% more time
      const newDuration = Math.round(context.lastDurationMinutes * 1.5);
      console.log('[ConversationContext] Resolved "longer":', newDuration, 'minutes');
      return {
        target: context.lastTarget,
        durationMinutes: newDuration,
      };
    }
  }

  // "add X minutes"
  const addMatch = lowerText.match(/add\s+(\d+)\s*(minutes?|mins?|m)/i);
  if (addMatch && context.lastTarget && context.lastDurationMinutes) {
    const additional = parseInt(addMatch[1], 10);
    const newDuration = context.lastDurationMinutes + additional;
    console.log('[ConversationContext] Resolved "add":', newDuration, 'minutes');
    return {
      target: context.lastTarget,
      durationMinutes: newDuration,
    };
  }

  // "for X more minutes"
  const moreMatch = lowerText.match(/for\s+(\d+)\s*more\s*(minutes?|mins?|m)/i);
  if (moreMatch && context.lastTarget) {
    const additional = parseInt(moreMatch[1], 10);
    const baseDuration = context.lastDurationMinutes || 30;
    const newDuration = baseDuration + additional;
    console.log('[ConversationContext] Resolved "more":', newDuration, 'minutes');
    return {
      target: context.lastTarget,
      durationMinutes: newDuration,
    };
  }

  return null;
}

/**
 * Check if utterance needs clarification
 * @param {Object} intent - Parsed intent
 * @param {ConversationContext|null} context - Current context
 * @returns {Object|null} - { question, suggestions, missing } or null
 */
export function needsClarification(intent, context) {
  if (!intent) return null;

  // Reminder action
  if (intent.action === 'remind') {
    if (!intent.message && !intent.target) {
      return {
        question: 'What would you like to be reminded about?',
        suggestions: ['Exercise', 'Drink water', 'Take a break'],
        missing: 'message',
      };
    }

    if (!intent.reminderType && !intent.time && !intent.durationMinutes) {
      return {
        question: 'When should I remind you?',
        suggestions: ['In 30 minutes', 'Every day at 9 AM', 'Every Monday'],
        missing: 'time',
      };
    }

    return null; // Reminder has all required info
  }

  // Block action
  if (intent.action === 'block') {
    if (!intent.target) {
      // No target - ask which app
      const suggestions = context?.lastTarget 
        ? [context.lastTarget, 'social apps', 'work apps']
        : ['social apps', 'work apps', 'all apps'];
      
      return {
        question: 'Which apps would you like to block?',
        suggestions,
        missing: 'target',
      };
    }

    if (!intent.durationMinutes || intent.durationMinutes < 1) {
      // No duration - ask how long
      const suggestions = context?.lastDurationMinutes
        ? [`${context.lastDurationMinutes} minutes`, '30 minutes', '1 hour']
        : ['30 minutes', '1 hour', '2 hours'];
      
      return {
        question: 'For how long?',
        suggestions,
        missing: 'duration',
      };
    }
  }

  return null;
}
