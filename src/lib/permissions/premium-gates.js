/**
 * Premium Feature Gates
 * 
 * Centralized permission checks for premium features.
 * All functions check the user's subscription status via IAP.
 * 
 * Free tier limits:
 * - 5 AI cloud calls per day
 * - No presets
 * - No voice reminders
 * - 30-day history
 * - Basic stats
 * - System TTS only
 * 
 * Premium ($5.99/month):
 * - Unlimited AI
 * - Unlimited presets
 * - Voice reminders
 * - Unlimited history
 * - Detailed stats
 * - OpenAI TTS
 * - Conversation mode
 */

import IAP from '../iap';

/**
 * Check if user can save presets
 * @returns {Promise<{allowed: boolean, reason: string}>}
 */
export async function canSavePreset() {
  const isPremium = await IAP.hasPremiumEntitlement();
  
  if (isPremium) {
    return { allowed: true, reason: 'premium' };
  }
  
  return {
    allowed: false,
    reason: 'Presets are a Premium feature. Upgrade to save unlimited custom presets.'
  };
}

/**
 * Check if user can use voice reminders
 * @returns {Promise<{allowed: boolean, reason: string}>}
 */
export async function canUseVoiceReminders() {
  const isPremium = await IAP.hasPremiumEntitlement();
  
  if (isPremium) {
    return { allowed: true, reason: 'premium' };
  }
  
  return {
    allowed: false,
    reason: 'Voice reminders are a Premium feature. Upgrade to create reminders with voice commands.'
  };
}

/**
 * Get AI cloud calls limit for the user
 * @returns {Promise<{limit: number, isPremium: boolean}>}
 */
export async function getDailyVoiceLimit() {
  const isPremium = await IAP.hasPremiumEntitlement();
  
  return {
    limit: isPremium ? Infinity : 5,
    isPremium
  };
}

/**
 * Get history retention limit in days
 * @returns {Promise<{days: number, isPremium: boolean}>}
 */
export async function getHistoryDaysLimit() {
  const isPremium = await IAP.hasPremiumEntitlement();
  
  return {
    days: isPremium ? Infinity : 30,
    isPremium
  };
}

/**
 * Check if user can access detailed stats
 * @returns {Promise<{allowed: boolean, reason: string}>}
 */
export async function canAccessDetailedStats() {
  const isPremium = await IAP.hasPremiumEntitlement();
  
  if (isPremium) {
    return { allowed: true, reason: 'premium' };
  }
  
  return {
    allowed: false,
    reason: 'Detailed analytics are a Premium feature. Upgrade to see advanced productivity insights.'
  };
}

/**
 * Check if user can use conversation mode (back-and-forth with AI)
 * @returns {Promise<{allowed: boolean, reason: string}>}
 */
export async function canUseConversationMode() {
  const isPremium = await IAP.hasPremiumEntitlement();
  
  if (isPremium) {
    return { allowed: true, reason: 'premium' };
  }
  
  return {
    allowed: false,
    reason: 'Conversation mode is a Premium feature. Upgrade for unlimited back-and-forth with your AI assistant.'
  };
}

/**
 * Get TTS voice type for the user
 * @returns {Promise<{type: 'openai'|'system', isPremium: boolean}>}
 */
export async function getTTSVoiceType() {
  const isPremium = await IAP.hasPremiumEntitlement();
  
  return {
    type: isPremium ? 'openai' : 'system',
    isPremium
  };
}

/**
 * Helper: Show upgrade prompt (for UI components to call)
 * @param {string} feature - Feature name for tracking
 * @returns {object} - Message and action config
 */
export function getUpgradePrompt(feature) {
  return {
    title: 'Premium Feature',
    message: `${feature} is available in Premium. Upgrade to unlock unlimited AI features, presets, voice reminders, and more.`,
    primaryAction: 'Upgrade to Premium',
    secondaryAction: 'Not Now',
    feature // for telemetry
  };
}
