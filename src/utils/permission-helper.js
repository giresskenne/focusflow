import { Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';

// Lazy import expo-av to avoid issues when native module isn't available
let Audio = null;

async function getAudio() {
  if (!Audio) {
    try {
      const av = await import('expo-av');
      Audio = av.Audio;
    } catch (error) {
      console.warn('[PermissionHelper] expo-av not available:', error.message);
      return null;
    }
  }
  return Audio;
}

/**
 * Permission Helper
 * Centralized permission management with better UX:
 * - Check current status
 * - Request with proper flow
 * - Handle denied states with guidance to settings
 */

/**
 * Check microphone permission status
 * @returns {Promise<'granted'|'denied'|'undetermined'>}
 */
export async function checkMicrophonePermission() {
  try {
    const AudioModule = await getAudio();
    if (!AudioModule) return 'undetermined';
    
    const { status } = await AudioModule.getPermissionsAsync();
    return status;
  } catch (error) {
    console.error('[PermissionHelper] Error checking mic permission:', error);
    return 'undetermined';
  }
}

/**
 * Request microphone permission
 * @returns {Promise<boolean>} true if granted, false otherwise
 */
export async function requestMicrophonePermission() {
  try {
    const AudioModule = await getAudio();
    if (!AudioModule) return false;
    
    const { status } = await AudioModule.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[PermissionHelper] Error requesting mic permission:', error);
    return false;
  }
}

/**
 * Check notification permission status
 * @returns {Promise<'granted'|'denied'|'undetermined'>}
 */
export async function checkNotificationPermission() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (error) {
    console.error('[PermissionHelper] Error checking notification permission:', error);
    return 'undetermined';
  }
}

/**
 * Request notification permission
 * @returns {Promise<boolean>} true if granted, false otherwise
 */
export async function requestNotificationPermission() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[PermissionHelper] Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Show alert to guide user to settings if permission was denied
 * @param {string} permissionType - 'microphone' or 'notifications'
 */
export function showPermissionDeniedAlert(permissionType) {
  const config = {
    microphone: {
      title: 'Microphone Access Needed',
      message: 'To use voice commands with Mada, please allow microphone access in Settings.',
      settingsLabel: 'Open Settings'
    },
    notifications: {
      title: 'Notification Access Needed',
      message: 'To receive focus reminders and alerts, please allow notifications in Settings.',
      settingsLabel: 'Open Settings'
    }
  };

  const info = config[permissionType] || config.microphone;

  Alert.alert(
    info.title,
    info.message,
    [
      {
        text: 'Cancel',
        style: 'cancel'
      },
      {
        text: info.settingsLabel,
        onPress: () => Linking.openSettings()
      }
    ]
  );
}

/**
 * Complete permission flow with status check and guidance
 * @param {string} permissionType - 'microphone' or 'notifications'
 * @param {Function} showExplainer - Function to show custom explainer modal
 * @returns {Promise<boolean>} true if permission granted, false otherwise
 */
export async function requestPermissionWithFlow(permissionType, showExplainer) {
  const checkFn = permissionType === 'microphone' 
    ? checkMicrophonePermission 
    : checkNotificationPermission;
  
  const requestFn = permissionType === 'microphone'
    ? requestMicrophonePermission
    : requestNotificationPermission;

  // 1. Check current status
  const currentStatus = await checkFn();
  
  // Already granted
  if (currentStatus === 'granted') {
    return true;
  }

  // Previously denied - guide to settings
  if (currentStatus === 'denied') {
    showPermissionDeniedAlert(permissionType);
    return false;
  }

  // Undetermined - show explainer if provided, then request
  if (showExplainer) {
    // Return a promise that resolves when user grants from explainer
    return new Promise((resolve) => {
      showExplainer(async () => {
        // User tapped grant button in explainer
        const granted = await requestFn();
        resolve(granted);
        
        // If denied after request, show settings guidance
        if (!granted) {
          showPermissionDeniedAlert(permissionType);
        }
      });
    });
  } else {
    // No explainer, request directly
    const granted = await requestFn();
    
    if (!granted) {
      showPermissionDeniedAlert(permissionType);
    }
    
    return granted;
  }
}

/**
 * Get permission status display info
 * @param {string} status - 'granted'|'denied'|'undetermined'
 * @returns {Object} Display info with icon, color, label
 */
export function getPermissionStatusInfo(status) {
  switch (status) {
    case 'granted':
      return {
        icon: 'checkmark-circle',
        color: '#4ADE80',
        label: 'Allowed',
        description: 'Permission granted'
      };
    case 'denied':
      return {
        icon: 'close-circle',
        color: '#F87171',
        label: 'Denied',
        description: 'Permission denied. Tap to open Settings.'
      };
    default:
      return {
        icon: 'help-circle',
        color: '#FBBF24',
        label: 'Not Set',
        description: 'Permission not requested yet'
      };
  }
}
