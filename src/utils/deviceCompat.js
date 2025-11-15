// Device compatibility utilities for iPad crash prevention
import { Platform, Dimensions } from 'react-native';

/**
 * Detects if the app is running on iPad
 * Used as a safety guard against iPad-specific crashes
 */
export function isIPad() {
  if (Platform.OS !== 'ios') return false;
  
  try {
    const { width, height } = Dimensions.get('window');
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    
    // iPad detection heuristics:
    // 1. Aspect ratio is closer to 4:3 (iPad) than 16:9 (iPhone)
    // 2. Minimum dimension is typically larger than iPhone
    const isTabletAspectRatio = aspectRatio < 1.6; // Less elongated than phones
    const isTabletSize = Math.min(width, height) > 700; // Larger than most phones
    
    return isTabletAspectRatio && isTabletSize;
  } catch {
    return false;
  }
}

/**
 * Shows iPad compatibility warning and navigates to safe screen
 * Call this early in App.js if iPad is detected
 */
export function handleIPadLaunch(navigation) {
  if (!isIPad()) return false;
  
  console.warn('[DeviceCompat] iPad detected - app designed for iPhone only');
  
  // Show a friendly message instead of crashing
  setTimeout(() => {
    if (navigation?.navigate) {
      navigation.navigate('TabNavigator');
    }
  }, 100);
  
  return true; // iPad was detected and handled
}

/**
 * Wraps TurboModule calls to prevent iPad crashes
 * Use this around any native module calls that might crash on iPad
 */
export function safeTurboModuleCall(fn, fallbackValue = null) {
  if (isIPad()) {
    console.warn('[DeviceCompat] Skipping TurboModule call on iPad to prevent crash');
    return Promise.resolve(fallbackValue);
  }
  
  try {
    const result = fn();
    // Handle both sync and async results
    if (result && typeof result.catch === 'function') {
      return result.catch(error => {
        console.error('[DeviceCompat] TurboModule call failed:', error);
        return fallbackValue;
      });
    }
    return result;
  } catch (error) {
    console.error('[DeviceCompat] TurboModule call failed:', error);
    return fallbackValue;
  }
}

/**
 * Safe wrapper for DeviceActivity calls specifically
 */
export function safeDeviceActivityCall(fn, fallbackValue = null) {
  if (isIPad()) {
    console.warn('[DeviceCompat] DeviceActivity not supported on iPad');
    return Promise.resolve(fallbackValue);
  }
  
  return safeTurboModuleCall(fn, fallbackValue);
}