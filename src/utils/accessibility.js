import { AccessibilityInfo } from 'react-native';

// Enhanced accessibility helpers
export const AccessibilityHelpers = {
  // Announce messages to screen readers
  announce: (message) => {
    AccessibilityInfo.announceForAccessibility(message);
  },

  // Common accessibility props for different UI elements
  button: (label, hint, state = {}) => ({
    accessibilityRole: 'button',
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityState: {
      disabled: state.disabled || false,
      selected: state.selected || false,
      ...state
    }
  }),

  text: (label, traits = []) => ({
    accessibilityRole: 'text',
    accessibilityLabel: label,
    accessibilityTraits: traits
  }),

  header: (label, level = 1) => ({
    accessibilityRole: 'header',
    accessibilityLabel: label,
    accessibilityLevel: level
  }),

  list: (label, itemCount) => ({
    accessibilityRole: 'list',
    accessibilityLabel: `${label}, ${itemCount} items`
  }),

  listItem: (label, position, total) => ({
    accessibilityRole: 'text',
    accessibilityLabel: `${label}, ${position} of ${total}`
  }),

  timer: (label, remaining) => ({
    accessibilityRole: 'timer',
    accessibilityLabel: `${label}, ${remaining} remaining`,
    accessibilityLiveRegion: 'polite'
  }),

  progressBar: (label, progress, max = 100) => ({
    accessibilityRole: 'progressbar',
    accessibilityLabel: label,
    accessibilityValue: {
      min: 0,
      max,
      now: progress,
      text: `${progress} of ${max}`
    }
  }),

  // Semantic helpers for focus flow specific elements
  focusSession: (duration, remaining) => ({
    accessibilityRole: 'timer',
    accessibilityLabel: `Focus session, ${duration} minutes`,
    accessibilityValue: {
      text: `${remaining} remaining`
    },
    accessibilityLiveRegion: 'polite'
  }),

  reminder: (text, time, index, total) => ({
    accessibilityRole: 'text',
    accessibilityLabel: `Reminder ${index} of ${total}: ${text}, ${time}`,
    accessibilityHint: 'Tap to edit reminder'
  }),

  analyticsCard: (title, value, subtitle = '') => ({
    accessibilityRole: 'text',
    accessibilityLabel: `${title}: ${value}${subtitle ? `, ${subtitle}` : ''}`,
    accessibilityTraits: ['summary']
  }),

  // Dynamic content helpers
  loadingContent: (message = 'Loading') => ({
    accessibilityRole: 'progressbar',
    accessibilityLabel: message,
    accessibilityLiveRegion: 'polite'
  }),

  errorContent: (message, retry = true) => ({
    accessibilityRole: 'alert',
    accessibilityLabel: `Error: ${message}${retry ? '. Tap to retry' : ''}`,
    accessibilityLiveRegion: 'assertive'
  }),

  // Navigation helpers
  tab: (label, selected, index, total) => ({
    accessibilityRole: 'tab',
    accessibilityLabel: label,
    accessibilityState: { selected },
    accessibilityHint: `Tab ${index} of ${total}. ${selected ? 'Currently selected' : 'Tap to select'}`
  }),

  // Settings and forms
  switch: (label, value, hint) => ({
    accessibilityRole: 'switch',
    accessibilityLabel: label,
    accessibilityState: { checked: value },
    accessibilityHint: hint
  }),

  textInput: (label, value, placeholder) => ({
    accessibilityRole: 'text',
    accessibilityLabel: label,
    accessibilityValue: { text: value || '' },
    placeholder: placeholder
  })
};

// Check if screen reader is enabled
export const checkScreenReaderEnabled = async () => {
  try {
    return await AccessibilityInfo.isScreenReaderEnabled();
  } catch {
    return false;
  }
};

// Check if bold text is enabled (useful for adjusting font weights)
export const checkBoldTextEnabled = async () => {
  try {
    return await AccessibilityInfo.isBoldTextEnabled();
  } catch {
    return false;
  }
};

// Check if reduced motion is enabled
export const checkReducedMotionEnabled = async () => {
  try {
    return await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    return false;
  }
};

// Focus management
export const focusElement = (ref) => {
  if (ref?.current?.focus) {
    ref.current.focus();
  } else if (ref?.current?.setNativeProps) {
    ref.current.setNativeProps({ accessibilityElementsHidden: false });
  }
};

export default AccessibilityHelpers;