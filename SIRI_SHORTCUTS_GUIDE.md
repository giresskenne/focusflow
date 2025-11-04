# Siri Shortcuts & App Intents Integration

## Overview

FocusFlow supports Siri Shortcuts and App Intents, allowing you to start and stop focus sessions using voice commands without opening the app.

## Available Intents

### 1. Start Focus Session
**Siri phrase**: "Start a focus session in FocusFlow"

**Parameters**:
- `alias` (required): The nickname for apps to block (e.g., "social", "work", "telegram")
- `durationMinutes` (optional, default: 30): How long to block apps

**Example Siri commands**:
- "Start a focus session in FocusFlow"
- "Block social apps in FocusFlow"

### 2. Stop Blocking
**Siri phrase**: "Stop blocking apps in FocusFlow"

**Parameters**: None

**Example Siri commands**:
- "Stop blocking in FocusFlow"
- "End my focus session in FocusFlow"

## Setup for Testing

### 1. Build with App Intents support

The App Intents are already configured in the iOS project. Rebuild the app to include them:

```bash
# Clean build
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/focusflowapp-*

# Rebuild
npx expo prebuild
npx expo run:ios --device
```

### 2. Add shortcuts via Shortcuts.app

1. Open the **Shortcuts** app on your iOS device
2. Tap the **+** button to create a new shortcut
3. Search for "FocusFlow" in the Apps list
4. You should see:
   - "Start Focus Session"
   - "Stop Blocking"
5. Add one to your shortcut and configure parameters
6. Save the shortcut

### 3. Test via Siri

Once you've created a shortcut:

1. Say "Hey Siri, [your shortcut name]"
2. Siri will execute the intent
3. FocusFlow will open and process the command
4. If the alias exists, blocking will start with confirmation
5. If the alias doesn't exist, you'll be prompted to create it

## Deep Link Schema

The intents use the `focusflow://siri` deep link scheme:

### Start Focus Session
```
focusflow://siri?action=start_focus&alias=social&duration=30
```

### Stop Blocking
```
focusflow://siri?action=stop_blocking
```

## Suggested Shortcuts

The app automatically suggests these shortcuts to iOS:

- **"Start a focus session"** - Opens app to start a session
- **"Block apps"** - Quick access to blocking
- **"Block [alias]"** - Direct blocking with a saved alias

These appear in:
- iOS Settings → Siri & Search → FocusFlow
- Shortcuts app suggestions
- Lock screen suggestions (after first use)

## Implementation Details

### Swift App Intents
Located in `ios/focusflowapp/AppIntents/`:

- `StartFocusIntent.swift` - Implements "Start Focus Session"
- `StopBlockingIntent.swift` - Implements "Stop Blocking"

Both intents:
1. Write intent data to App Group shared storage
2. Open the app via deep link with parameters
3. Return a dialog response to Siri

### JavaScript Handler
Located in `src/modules/ai/siri-intents.js`:

- Listens for `focusflow://siri` deep links
- Parses intent parameters
- Routes to existing `handleUtterance` function
- Reuses all existing voice flow logic (alias resolution, confirmation, blocking)

### App.js Integration
Initializes Siri intent listener on app startup:

```javascript
import { initializeSiriIntents } from './src/modules/ai/siri-intents';

useEffect(() => {
  initializeSiriIntents();
}, []);
```

## Troubleshooting

### Shortcuts don't appear in Shortcuts.app

1. Ensure you've rebuilt the app after adding App Intents
2. Check that `NSUserActivityTypes` is in Info.plist
3. Restart the Shortcuts app
4. Restart your device (iOS sometimes needs this to refresh)

### "App not found" error in Siri

1. Make sure the app is installed on the device (not simulator)
2. Check that the bundle ID matches in:
   - Xcode project settings
   - Info.plist `CFBundleIdentifier`
   - Deep link scheme

### Intent opens app but nothing happens

1. Check Metro logs for `[SiriIntents]` messages
2. Ensure the alias exists (create it via voice first)
3. Verify deep link scheme is registered: `focusflow://`

### "App Group not configured" error

1. Check that `REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP` is set in Info.plist
2. Verify entitlements include the App Group
3. Ensure the App Group ID matches across all targets

## Testing Checklist

- [ ] Build app with App Intents included
- [ ] Create a shortcut in Shortcuts.app
- [ ] Test "Start Focus Session" with existing alias
- [ ] Test "Start Focus Session" with non-existent alias (should prompt to create)
- [ ] Test "Stop Blocking" during active session
- [ ] Test Siri activation: "Hey Siri, [shortcut name]"
- [ ] Verify app opens and processes intent
- [ ] Check that confirmation flow works as expected
- [ ] Test on physical device (Siri doesn't work in simulator)

## Future Enhancements

- [ ] Background execution (start sessions without opening app)
- [ ] Widget support for quick access
- [ ] Custom Siri responses with more context
- [ ] App Shortcuts donation (suggest shortcuts based on usage)
- [ ] Spotlight integration
- [ ] Focus Mode integration (iOS 15+)

## Resources

- [Apple App Intents Documentation](https://developer.apple.com/documentation/appintents)
- [Siri Shortcuts Guide](https://developer.apple.com/design/human-interface-guidelines/siri)
- [Deep Linking in React Native](https://reactnative.dev/docs/linking)
