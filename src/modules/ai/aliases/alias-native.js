// Native alias/token helpers per spec §5 with graceful fallbacks
import { Platform } from 'react-native';

// Check if react-native-device-activity is available
let DeviceActivity = null;
let DeviceActivitySelectionView = null;
if (Platform.OS === 'ios') {
  try {
    const lib = require('react-native-device-activity');
    DeviceActivity = lib;
    DeviceActivitySelectionView = lib.DeviceActivitySelectionView;
  } catch (error) {
    console.log('[AliasNative] react-native-device-activity not available:', error.message);
  }
}

export function isFamilyPickerAvailable() {
  return Platform.OS === 'ios' && DeviceActivitySelectionView !== null;
}
