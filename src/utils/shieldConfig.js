// Shield configuration utilities for customizing the DeviceActivity shield
import { getRotatedQuote } from './quotes';

// Enhanced shield configuration with styling attempts
export function createCustomShield(sessionMinutes, appCount = 0, categoryCount = 0, websiteCount = 0) {
  const quote = getRotatedQuote();
  
  // Calculate total blocked items for display
  const totalBlocked = appCount + categoryCount + websiteCount;
  
  // Create contextual messaging
  let blockedText = '';
  if (appCount > 0) blockedText += `${appCount} app${appCount === 1 ? '' : 's'}`;
  if (categoryCount > 0) {
    if (blockedText) blockedText += ', ';
    blockedText += `${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'}`;
  }
  if (websiteCount > 0) {
    if (blockedText) blockedText += ', ';
    blockedText += `${websiteCount} website${websiteCount === 1 ? '' : 's'}`;
  }
  
  // Fallback if no specific counts
  if (!blockedText && totalBlocked > 0) {
    blockedText = `${totalBlocked} item${totalBlocked === 1 ? '' : 's'}`;
  }
  
  return {
    title: '🎯 Stay Focused', // Adding emoji for visual appeal
    subtitle: quote,
    primaryButtonLabel: 'Work It!', // Match the button text from the image
    secondaryButtonLabel: totalBlocked > 0 ? `${blockedText} blocked` : 'Focus mode active',
    // Note: iOS shields have limited styling options, but we can try these
    icon: '🎯', // Some versions support icon
    color: '#0072ff', // Primary color attempt
  };
}

// Alternative shield configurations for variety
export const SHIELD_THEMES = {
  focus: {
    title: '🎯 Deep Focus Mode',
    buttonLabel: 'Stay Strong!',
    emoji: '🎯'
  },
  productivity: {
    title: '⚡ Productivity Time',
    buttonLabel: 'Keep Going!',
    emoji: '⚡'
  },
  success: {
    title: '🚀 Success Mode',
    buttonLabel: 'Work It!',
    emoji: '🚀'
  },
  mindful: {
    title: '🧘 Mindful Focus',
    buttonLabel: 'Be Present',
    emoji: '🧘'
  }
};

export function getThemeForDuration(minutes) {
  if (minutes <= 5) return SHIELD_THEMES.focus;
  if (minutes <= 15) return SHIELD_THEMES.productivity;  
  if (minutes <= 30) return SHIELD_THEMES.success;
  return SHIELD_THEMES.mindful;
}