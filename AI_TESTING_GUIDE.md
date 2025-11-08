# AI Voice Assistant Testing Guide

## Quick Start

### 1. Enable AI Features
Make sure these flags are set in your `.env`:
```bash
EXPO_PUBLIC_AI_VOICE_ENABLED=true
EXPO_PUBLIC_AI_INTENTS_ENABLED=true
EXPO_PUBLIC_AI_AUTO_APPLY=false  # Keep false for confirmation prompts

# For dev/simulator testing (enables stub that simulates blocking)
EXPO_PUBLIC_ENABLE_IOS_BLOCKING_DEV=true
```

**Important**: After changing `.env`, restart Metro bundler:
```bash
# Stop Metro (Ctrl+C), then:
npm start -- --reset-cache
# or
pnpm start --reset-cache
```

### 2. Seed Test Aliases
Before you can test voice commands, you need to create some aliases:

**Option A: Use the Settings UI (Easiest)**
1. Open the app
2. Go to **Settings** tab
3. Scroll to the **ABOUT** section
4. Tap **"Seed AI Test Aliases"** (only visible in dev mode)
5. Confirm the success message

**Option B: Manual AsyncStorage (Advanced)**
Use React Native Debugger or Flipper to set:
- Key: `ff:aliases`
- Value: See `src/utils/devAliasSeeder.js` for the structure

### 3. Test Voice Commands
1. On the Home screen, tap the **purple microphone button** (bottom right)
2. If STT (Speech-to-Text) isn't available, a text input modal appears
3. Type or say: **"Block social for 30 minutes"**
4. You'll see:
   - A confirmation alert: "Block social for 30 minutes (ends 8:34 PM)?"
   - Tap OK to start blocking
   - An "Undo" prompt appears after blocking starts
   - In **dev mode** (with `ENABLE_IOS_BLOCKING_DEV=true`): Blocking is simulated, no actual Screen Time restrictions
   - On **device with native build**: Apps are actually blocked via Screen Time

**Dev Mode vs. Real Device:**
- **Dev stub** (simulator/Expo Go): Simulates the flow, logs to console, no actual blocking
- **Native build** (device): Uses real Screen Time API, apps are truly blocked

## Seeded Test Aliases

The dev seeder creates 5 test aliases:

| Alias | Synonyms | Apps Included |
|-------|----------|---------------|
| **social** | social media, socials | Instagram, Twitter, Facebook, TikTok, Reddit |
| **entertainment** | videos, streaming | YouTube, Netflix, Hulu, Twitch |
| **news** | - | Apple News, Reddit, Flipboard |
| **shopping** | shop, stores | Amazon, eBay, Etsy |
| **safari** | browser, web | Safari (for quick testing) |

## Example Commands

```
Block social for 30 minutes
Block entertainment for 1h30
Block safari for 45m
Stop blocking
```

## Understanding the Flow

1. **Voice/Text Input** → VoiceMicButton captures utterance
2. **Intent Parsing** → grammar.js extracts action + target + duration
3. **Alias Resolution** → alias-store finds matching alias (exact → synonyms → fuzzy)
4. **Plan Generation** → focus-executor creates execution plan
5. **Confirmation** → User sees alert with details
6. **Execution** → AppBlocker starts Screen Time blocking
7. **Undo Option** → 300ms delay, then undo prompt

## Troubleshooting

### "Try again" Alert
- Check console logs: `[AI] parseIntent result: ...`
- The grammar might not match your input
- Valid format: `block <target> for <duration>`

### "Not found" Alert
- You haven't seeded aliases yet
- Go to Settings → Seed AI Test Aliases
- Or the alias name doesn't match (try: social, safari, entertainment)

### "Not Available" Alert
- Screen Time authorization not granted (on real device)
- AppBlocker.isAvailable is false
- **Solution for dev/simulator**: Ensure `EXPO_PUBLIC_ENABLE_IOS_BLOCKING_DEV=true` in .env
- **Solution for device**: Build with native modules: `npx expo prebuild --clean && npx expo run:ios --device`
- The dev stub simulates blocking without actual Screen Time integration

### End notification doesn’t show in background
- Ensure you backgrounded the app at least once during the session so the date‑backup is scheduled (mirrors reminders)
- Check global handler logic in `App.js` isn’t suppressing a banner unless it’s >2s early and not a fallback
- For ultra‑short sessions, wait for the fallback/verification path (banner will appear at end or within +5s)

### Apps remain blocked until opening the app
- On short sessions (<5 minutes) iOS may reject refining the monitoring window; we keep a long (≥30m) window for reliability
- Unblocking is guaranteed when the app resumes (JS completion flow)
- For sessions ≥5 minutes, auto‑unblock should occur at the intended end time even if you stay suspended

### No Mic Button
- Check `EXPO_PUBLIC_AI_VOICE_ENABLED=true` in .env
- Restart Metro bundler after changing .env

## Console Logs to Watch

Enable dev logging to see the full pipeline:

```javascript
[VoiceMicButton] Running utterance: Block social for 30 minutes
[AI] handleUtterance called with: Block social for 30 minutes confirm: true
[AI] parseIntent result: { action: 'block', targetType: 'alias', target: 'social', durationMinutes: 30 }
[AI] planFromIntent result: { action: 'block', apps: [...], durationMinutes: 30, endLabel: '8:34 PM', alias: {...} }
[AI] Returning plan for confirmation
[VoiceMicButton] handleUtterance result: { ok: true, intent: {...}, plan: {...}, pendingConfirmation: true }
```

## Next Steps

- **Native Tokens**: Replace bundle ID strings with FamilyActivityPicker tokens
- **Preset Integration**: Link voice commands to existing app presets
- **Siri Shortcuts**: Expose commands via App Intents
- **Alias Management UI**: Full CRUD interface for user-created aliases
- **Smart Suggestions**: Show relevant aliases based on context

## Files Modified

### New Files
- `src/modules/ai/` - Core AI pipeline
- `src/components/ai/` - UI components (VoiceMicButton, etc.)
- `src/utils/devAliasSeeder.js` - Testing utility
- `config/ai.sample.env` - Configuration template

### Modified Files
- `src/screens/HomeScreen.js` - Added VoiceMicButton
- `src/screens/SettingsScreen.js` - Added dev seeding buttons
- `src/utils/time.js` - Duration parsing helpers

## Safety Notes

- All AI features are **feature-gated** (flags must be explicitly enabled)
- When flags are OFF, zero overhead and zero UI changes
- Confirmation required before any blocking action
- Undo prompt appears after blocking starts
- Non-destructive: Works alongside existing manual flow
