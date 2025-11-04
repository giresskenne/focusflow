# Phase 5 Complete: Testing Instructions

## ✅ What's Been Implemented

### Siri Shortcuts with App Intents
- **StartFocusIntent**: Start a focus session with a saved alias
- **StopBlockingIntent**: End the current focus session
- Deep link handling via `focusflow://siri` scheme
- Automatic suggested shortcuts in iOS Settings
- Full integration with existing voice flow

## 🔨 Next Steps to Test

### 1. Rebuild the iOS app

The App Intents are Swift code that need to be compiled into your app:

```bash
# Clean any existing builds
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/focusflowapp-*

# Rebuild with new App Intents
npx expo prebuild --clean
npx expo run:ios --device
```

**Note**: Select your physical iOS device when prompted. Siri doesn't work in the iOS Simulator.

### 2. Create a Shortcut

Once the app is installed:

1. Open the **Shortcuts** app on your iPhone
2. Tap **+** to create a new shortcut
3. Search for **"FocusFlow"** in the Apps list
4. You should see two actions:
   - **Start Focus Session**
   - **Stop Blocking**
5. Add "Start Focus Session" to your shortcut
6. Configure parameters:
   - **Alias**: Enter a nickname you've already created (e.g., "social", "telegram")
   - **Duration**: Enter minutes (e.g., 30)
7. Name your shortcut (e.g., "Block Social")
8. Tap **Done**

### 3. Test via Siri

Now test with Siri:

```
"Hey Siri, Block Social"
```

**Expected behavior**:
1. Siri acknowledges the command
2. FocusFlow app opens
3. You see the confirmation dialog: "Block social for 30 minutes (ends 3:30 PM)?"
4. Tap **OK** to start blocking
5. App navigates to ActiveSession screen with countdown

### 4. Test Stopping

While a session is active:

1. Create another shortcut with **Stop Blocking** action
2. Say "Hey Siri, Stop Blocking"
3. App should open and end the session

### 5. Test First-Time Alias

If you use an alias that doesn't exist yet:

1. Say "Hey Siri, Block TikTok"
2. App opens and shows: "I couldn't find a nickname for TikTok"
3. Tap **Pick apps** button
4. Select apps using the native picker
5. Save the alias
6. The command will automatically re-run and start blocking

## 📝 What to Check

### Success Criteria
- [ ] Shortcut appears in Shortcuts.app after rebuild
- [ ] Siri command opens the app
- [ ] Deep link is parsed correctly (check Metro logs for `[SiriIntents]`)
- [ ] Existing aliases work immediately
- [ ] New aliases trigger picker flow
- [ ] Confirmation dialog appears before blocking
- [ ] Session starts and apps are blocked
- [ ] Stop command ends the session

### Metro Console Logs

Watch for these logs:

```
[SiriIntents] Initializing...
[SiriIntents] Processing deep link: focusflow://siri?action=start_focus&alias=social&duration=30
[SiriIntents] Executing: Block social for 30 minutes
[AI] handleUtterance called with: Block social for 30 minutes
[AI] parseIntent result: {"action": "block", "target": "social", "durationMinutes": 30}
[VoiceMicButton] Navigating to ActiveSession
[ActiveSession] Initial sessionEndAt: ...
```

## 🐛 Troubleshooting

### Shortcut doesn't appear in Shortcuts.app

1. Make sure you rebuilt the app after adding the Swift files
2. Check Xcode build logs for errors in `StartFocusIntent.swift`
3. Restart the Shortcuts app
4. Restart your device (iOS caches App Intents)

### "No such scheme" error when testing

1. Check that `focusflow` is in Info.plist under `CFBundleURLSchemes`
2. Rebuild the app
3. Try uninstalling and reinstalling

### Siri says "There was a problem"

1. Check that all Swift files are in the Xcode project
2. Make sure `NSUserActivityTypes` is in Info.plist
3. Check Metro logs for errors when the deep link opens

### App opens but nothing happens

1. Check Metro logs for `[SiriIntents]` messages
2. Make sure the alias you're testing exists (create it via voice first)
3. Verify the deep link format in the logs

## 📚 Documentation

For more details, see:
- **SIRI_SHORTCUTS_GUIDE.md** - Complete setup and testing guide
- **AI_PHASES.md** - Phase 5 implementation details
- **AI_PROGRESS.md** - Latest updates and what's next

## 🎯 What's Next After Testing

Once Siri Shortcuts are working:

### Optional Enhancements (Future)
- Background execution (App Extension)
- Widget support (Today Extension)
- Custom Siri responses
- Spotlight integration
- Focus Mode integration

### Other Phases to Consider
- **Phase 6**: Wake word detection ("Hey Mada")
- **Phase 8**: Conversation context and memory
- **Phase 9**: UI polish and onboarding
- **Phase 10**: Testing and gradual rollout

---

**Ready to test?** Follow steps 1-5 above and report any issues. Happy testing! 🚀
