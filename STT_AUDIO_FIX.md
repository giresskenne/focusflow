# STT Audio Session Fix

## Issue
```
WARN  [STT] error required condition is false: IsFormatSampleRateAndChannelCountValid(format)
```

## Root Cause
iOS audio session conflict between:
1. TTS playback (OpenAI TTS or iOS Speech)
2. STT recording (@react-native-voice/voice)

When TTS finishes playing and immediately starts STT, the audio session format isn't properly reset.

## Fixes Applied

### 1. Added Audio Session Delay (`stt-service.js`)
```javascript
// Added 200ms delay after stop() before start()
await stop();
await new Promise(resolve => setTimeout(resolve, 200));
```

### 2. Enhanced iOS-Specific Options (`stt-service.js`)
```javascript
const options = {
  locale: 'en-US',
  ...(Platform.OS === 'ios' ? {
    interimResults: true,
    maxResults: 5,
  } : {}),
};
await RNVoice.start?.(options.locale, options);
```

### 3. TTS Stop + Delay (`VoiceMicButton.js`)
```javascript
// Stop TTS
if (ttsEnabled && ttsAvailable()) ttsStop();

// Wait for audio session to fully release (critical for iOS)
await new Promise(resolve => setTimeout(resolve, 300));

// Now safe to start STT
await STTService.start(...);
```

### 4. Increased Watchdog Timeout (`stt-service.js`)
```javascript
// Changed from 1200ms to 1500ms to account for delays
startWatchdog = setTimeout(async () => {
  if (!didStart) {
    onError?.(new Error('stt-not-started'));
  }
}, 1500);
```

## Testing

1. **Rebuild native app:**
   ```bash
   cd ios
   pod install
   cd ..
   npx expo run:ios --device
   ```

2. **Test voice flow:**
   - Tap voice button
   - Wait for listening animation
   - Speak command: "Block Instagram for 30 minutes"
   - Check console for success (no format errors)

3. **Expected logs:**
   ```
   [VoiceMicButton] Starting STT...
   [VoiceMicButton] STT result: block instagram for 30 minutes final: true
   [VoiceMicButton] Parse: local (confidence: 1.0, 8ms)
   ```

## If Issue Persists

### Option 1: Disable TTS Before Testing
```bash
# In .env
EXPO_PUBLIC_AI_TTS_ENABLED=false
```

This isolates STT testing without TTS interference.

### Option 2: Use iOS System Speech (Faster Audio Session)
```bash
# In .env
EXPO_PUBLIC_AI_TTS_PROVIDER=ios
```

iOS Speech API (`expo-speech`) releases audio session faster than OpenAI TTS.

### Option 3: Check Xcode Audio Session Logs
1. Open Xcode
2. Run app on device
3. View full device logs in Console app
4. Filter by "AVAudioSession" to see session state changes

### Option 4: Reset Simulator/Device Audio
Sometimes iOS audio session gets stuck:

**Simulator:**
```bash
xcrun simctl shutdown all
xcrun simctl erase all
```

**Device:**
- Settings → General → Reset → Reset All Settings (keeps data)

## Prevention

The 300ms delay in `VoiceMicButton` and 200ms in `stt-service` should prevent this issue going forward. If you experience it again:

1. Check that TTS is actually stopping (`ttsStop()` called)
2. Verify delays are present in both files
3. Ensure no other audio is playing (music, videos, etc.)
4. Check iOS Do Not Disturb/Focus Mode isn't blocking audio

## Related Files

- `src/modules/ai/voice/stt-service.js` - STT implementation
- `src/components/ai/VoiceMicButton.js` - Voice button UI
- `ios/focusflowapp/Info.plist` - Audio permissions
