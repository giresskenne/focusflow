# Native iOS App Blocking Integration

## Overview
This document describes the integration of `react-native-device-activity` library for real iOS app blocking functionality, replacing the previous placeholder implementation.

## Changes Made

### 1. ActiveSessionScreen.js
**Before:** Used a broken `AppBlocker` wrapper that couldn't find the native module
**After:** Directly imports and uses `react-native-device-activity`

#### Key Changes:
- **Import Statement:** Now imports the library directly with proper error handling
  ```javascript
  let DeviceActivity = null;
  if (Platform.OS === 'ios') {
    try {
      DeviceActivity = require('react-native-device-activity');
    } catch (error) {
      console.log('[ActiveSession] react-native-device-activity not available:', error.message);
    }
  }
  ```

- **Authorization Request:** Properly requests Screen Time permission
  ```javascript
  const status = await DeviceActivity.requestAuthorization();
  setAuthStatus(status);
  ```

- **Start Monitoring:** Calls the actual native API to block apps
  ```javascript
  if (status === DeviceActivity.AuthorizationStatus.approved) {
    await DeviceActivity.startMonitoring({
      applications: appIds,
      duration: duration, // in seconds
    });
  }
  ```

- **Stop Monitoring:** Properly stops blocking when session ends
  ```javascript
  DeviceActivity.stopMonitoring().catch((error) => {
    console.log('[ActiveSession] Error stopping monitoring:', error);
  });
  ```

- **Dynamic Warning Banner:** Shows different messages based on actual authorization status instead of hardcoded "Expo Go" message

### 2. FocusSessionScreen.js
**Before:** Used hardcoded list of apps (Instagram, TikTok, etc.) with no connection to real device apps
**After:** Integrates native `FamilyActivityPicker` component for real app selection

#### Key Changes:
- **Import FamilyActivityPicker:**
  ```javascript
  let FamilyActivityPicker = null;
  if (Platform.OS === 'ios') {
    try {
      const lib = require('react-native-device-activity');
      FamilyActivityPicker = lib.FamilyActivityPicker;
    } catch (error) {
      console.log('[FocusSession] react-native-device-activity not available');
    }
  }
  ```

- **Native Picker Button:** Added new UI element to launch the native picker
  - Shows "Choose Apps from Device" button when library is available
  - Displays badge showing number of selected apps
  - Falls back to search input for non-native builds

- **FamilyActivityPicker Component:** Added modal that shows iOS native app picker
  ```javascript
  <FamilyActivityPicker
    visible={showNativePicker}
    onClose={() => setShowNativePicker(false)}
    onSelectionChange={(selection) => {
      setFamilyActivitySelection(selection);
      // Store application tokens for blocking
      if (selection?.applicationTokens) {
        setSelectedAppsState(selection.applicationTokens);
      }
    }}
  />
  ```

- **Application Tokens:** Now stores iOS application tokens instead of bundle IDs
  - These tokens are what the Screen Time API uses to identify apps
  - They're more secure and don't expose actual bundle IDs

### 3. Removed AppBlocker Wrapper
The `components/AppBlocker/index.js` wrapper is no longer used in these screens. It was trying to access `NativeModules.AppBlocker` which doesn't exist. The library is actually registered as `ReactNativeDeviceActivity`.

## How It Works Now

### User Flow:
1. **App Selection Screen (FocusSessionScreen):**
   - User taps "Choose Apps from Device" button
   - Native iOS FamilyActivityPicker modal appears
   - User selects apps from their actual installed apps
   - Selection is stored as application tokens

2. **Active Session Screen (ActiveSessionScreen):**
   - On mount, requests Screen Time authorization if needed
   - If authorized, calls `startMonitoring()` with selected app tokens and duration
   - Apps are now actually blocked by iOS Screen Time API
   - Timer counts down normally
   - When session ends or is cancelled, calls `stopMonitoring()` to unblock apps

### Authorization States:
- **Not Determined:** First time - shows permission prompt
- **Approved:** Blocking works, no warning shown
- **Denied:** Shows warning banner asking user to enable in Settings

## Testing on Device

### Prerequisites:
- Physical iPhone with iOS 16+
- Development build (not Expo Go)
- Family Controls entitlement enabled
- App Groups configured

### Testing Steps:
1. Launch app on device via Metro bundler
2. Navigate to "New Focus Session"
3. Tap "Choose Apps from Device"
4. Verify native iOS picker appears with real installed apps
5. Select apps (e.g., Instagram, Safari, Messages)
6. Start session
7. If first time, approve Screen Time permission
8. Try to open blocked app - should see iOS Screen Time shield
9. Wait for session to complete or cancel early
10. Verify apps are unblocked

### Expected Behavior:
- ✅ Native picker shows all installed apps with real icons
- ✅ Selected apps display in confirmation screen
- ✅ Authorization prompt appears on first use
- ✅ Apps are blocked during session (iOS shows shield screen)
- ✅ Apps unblock when session ends
- ✅ Warning banner only shows if permission denied

### Debugging:
Check Metro logs for:
```
[ActiveSession] Authorization status: approved
[ActiveSession] Starting monitoring for apps: [...]
[ActiveSession] Monitoring started successfully
```

Or if there's an issue:
```
[ActiveSession] Authorization not approved, status: denied
[ActiveSession] Error starting monitoring: [error details]
```

## Fallback Behavior

The code gracefully handles environments where the library isn't available:
- If `react-native-device-activity` fails to import, falls back to hardcoded app list
- Shows informative warning banner when blocking isn't available
- App still functions for UI testing without native capabilities

## Next Steps

1. **Test on physical device** to verify blocking works
2. **Test authorization flow** - deny permission, then grant in Settings
3. **Test "Block All Applications"** option (may need additional implementation)
4. **Add better error handling** for edge cases
5. **Consider adding retry logic** for authorization requests
6. **Add analytics** to track blocking effectiveness

## Known Limitations

- FamilyActivityPicker only works on physical iOS devices (not simulator)
- Requires iOS 16.0+ and proper entitlements
- Authorization status persists across app launches (cached by iOS)
- Some system apps cannot be blocked by Screen Time API
