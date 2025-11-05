// Intent Classifier
// Determines if a user utterance is on-topic (app blocking, reminders)
// or needs guidance/clarification

/**
 * @typedef {Object} IntentClassification
 * @property {'valid'|'off-topic'|'unclear-action'|'unclear-target'} type
 * @property {'high'|'medium'|'low'} confidence
 * @property {string} [suggestedAction] - Suggested action for unclear intents
 * @property {string} [detectedTarget] - Detected target if any
 */

// Action keywords for app blocking
const BLOCK_ACTIONS = [
  'block', 'stop', 'unblock', 'end', 'pause', 'disable', 
  'restrict', 'limit', 'lock', 'shield'
];

// Action keywords for reminders
const REMINDER_ACTIONS = [
  'remind', 'reminder', 'notify', 'notification', 'alert',
  'tell', 'ping', 'nudge'
];

// Focus session keywords
const FOCUS_ACTIONS = [
  'start', 'begin', 'focus', 'session', 'concentrate',
  'deep work', 'distraction free'
];

// Target keywords
const TARGET_KEYWORDS = [
  'app', 'apps', 'application', 'applications',
  'social', 'work', 'game', 'games', 'chat',
  'instagram', 'tiktok', 'facebook', 'twitter', 'snapchat',
  'youtube', 'reddit', 'whatsapp', 'messenger'
];

// Time-related keywords (helps identify duration/schedule intent)
const TIME_KEYWORDS = [
  'minute', 'minutes', 'min', 'mins',
  'hour', 'hours', 'hr', 'hrs',
  'day', 'days', 'daily', 'everyday',
  'week', 'weekly', 'monday', 'tuesday', 'wednesday', 
  'thursday', 'friday', 'saturday', 'sunday',
  'morning', 'afternoon', 'evening', 'night',
  'am', 'pm', 'o\'clock'
];

/**
 * Classify user intent to determine if it's on-topic and actionable
 * @param {string} text - User utterance
 * @param {Array} [aliases] - Known aliases for app detection
 * @returns {IntentClassification}
 */
export function classifyIntent(text, aliases = []) {
  if (!text || typeof text !== 'string') {
    return { type: 'off-topic', confidence: 'high' };
  }

  const lowerText = text.toLowerCase().trim();

  // Check for action keywords
  const hasBlockAction = BLOCK_ACTIONS.some(action => 
    lowerText.includes(action)
  );
  
  const hasReminderAction = REMINDER_ACTIONS.some(action => 
    lowerText.includes(action)
  );
  
  const hasFocusAction = FOCUS_ACTIONS.some(action => 
    lowerText.includes(action)
  );

  const hasAnyAction = hasBlockAction || hasReminderAction || hasFocusAction;

  // Check for target keywords or known aliases
  const hasTargetKeyword = TARGET_KEYWORDS.some(keyword => 
    lowerText.includes(keyword)
  );

  const detectedAlias = aliases.find(alias => 
    lowerText.includes(alias.nickname?.toLowerCase())
  );

  const hasKnownAlias = !!detectedAlias;

  // Check for time-related keywords
  const hasTimeKeyword = TIME_KEYWORDS.some(keyword => 
    lowerText.includes(keyword)
  );

  // Check for numbers (likely duration)
  const hasNumber = /\d+/.test(lowerText);

  // Classification logic

  // Case 1: No action, no target, no time → Off-topic
  if (!hasAnyAction && !hasTargetKeyword && !hasKnownAlias && !hasTimeKeyword) {
    return { 
      type: 'off-topic', 
      confidence: 'high' 
    };
  }

  // Case 2: Has target/alias but no action → Unclear action
  // Example: "Instagram 30 minutes", "social apps"
  if ((hasKnownAlias || hasTargetKeyword) && !hasAnyAction) {
    const suggestedAction = hasTimeKeyword || hasNumber ? 'block' : 'block';
    return { 
      type: 'unclear-action', 
      confidence: 'medium',
      suggestedAction,
      detectedTarget: detectedAlias?.nickname || 'apps'
    };
  }

  // Case 3: Has action but unclear target
  // Example: "block stuff", "remind me", "start session"
  if (hasAnyAction && !hasTargetKeyword && !hasKnownAlias) {
    // Reminder without specific thing to remind is still unclear
    if (hasReminderAction && !hasTimeKeyword && !hasNumber) {
      return {
        type: 'unclear-target',
        confidence: 'medium',
        suggestedAction: 'remind'
      };
    }
    
    // Block/focus without target is unclear
    if ((hasBlockAction || hasFocusAction) && !hasTargetKeyword) {
      return {
        type: 'unclear-target',
        confidence: 'medium',
        suggestedAction: hasBlockAction ? 'block' : 'focus'
      };
    }
  }

  // Case 4: Has action and target → Valid (parser will validate details)
  if (hasAnyAction && (hasTargetKeyword || hasKnownAlias || hasTimeKeyword)) {
    return { 
      type: 'valid', 
      confidence: 'high',
      detectedTarget: detectedAlias?.nickname
    };
  }

  // Case 5: Has action but ambiguous → Low confidence valid
  // Let parser handle it and potentially ask for clarification
  if (hasAnyAction) {
    return { 
      type: 'valid', 
      confidence: 'medium' 
    };
  }

  // Fallback: off-topic
  return { 
    type: 'off-topic', 
    confidence: 'low' 
  };
}

/**
 * Get guidance prompt based on classification
 * @param {IntentClassification} classification
 * @param {Object} [parseResult] - Optional parse result for context
 * @returns {Object} { message, suggestions, shouldSpeak }
 */
export function getGuidancePrompt(classification, parseResult = null) {
  switch (classification.type) {
    case 'off-topic':
      return {
        message: "I help you block distracting apps and set focus reminders. Try saying 'Block social media for 30 minutes' or 'Remind me to check messages in 1 hour'.",
        suggestions: [
          'Block social apps for 30 minutes',
          'Remind me to exercise in 1 hour',
          'Start a focus session'
        ],
        shouldSpeak: true
      };

    case 'unclear-action':
      const target = classification.detectedTarget || parseResult?.target || 'those apps';
      return {
        message: `Did you want to block ${target}? Say 'yes' to confirm, or tell me what you'd like to do.`,
        suggestions: [
          `Block ${target}`,
          `Remind me about ${target}`,
          'Cancel'
        ],
        shouldSpeak: true
      };

    case 'unclear-target':
      if (classification.suggestedAction === 'remind') {
        return {
          message: "What would you like to be reminded about? Try 'Remind me to exercise in 30 minutes' or 'Remind me to take a break every hour'.",
          suggestions: [
            'Remind me to exercise',
            'Remind me to drink water',
            'Remind me to take a break'
          ],
          shouldSpeak: true
        };
      }
      
      return {
        message: "Which apps would you like to block? Try saying 'social apps', an app name like 'Instagram', or 'all apps'.",
        suggestions: [
          'Social apps',
          'Work apps',
          'Instagram',
          'All distracting apps'
        ],
        shouldSpeak: true
      };

    case 'valid':
      // Parser will handle missing details, no guidance needed here
      return null;

    default:
      return null;
  }
}

/**
 * Check if utterance is a confirmation response
 * @param {string} text
 * @returns {boolean|null} true=yes, false=no, null=unclear
 */
export function isConfirmation(text) {
  const lowerText = text.toLowerCase().trim();
  
  // Yes responses
  if (/^(yes|yeah|yep|sure|ok|okay|correct|right|affirm|do it|go ahead)$/i.test(lowerText)) {
    return true;
  }
  
  // No responses
  if (/^(no|nope|nah|cancel|stop|nevermind|never mind)$/i.test(lowerText)) {
    return false;
  }
  
  // Unclear
  return null;
}
