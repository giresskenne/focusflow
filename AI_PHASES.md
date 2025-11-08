# AI Voice Assistant Implementation Phases

## Phase 1: Foundation ✅ COMPLETE
**Goal**: Basic voice infrastructure and UI

### Deliverables
- [x] VoiceMicButton component with pulse animation
- [x] STT service (@react-native-voice/voice) with dynamic import
- [x] TTS service (expo-speech) with enhanced voice quality
- [x] Feature flags (AI_VOICE_ENABLED, AI_INTENTS_ENABLED, AI_TTS_ENABLED)
- [x] iOS permissions (microphone, speech recognition)
- [x] Dev environment setup and .env configuration

### Key Files
- `src/components/ai/VoiceMicButton.js`
- `src/modules/ai/voice/stt-service.js`
- `src/modules/ai/voice/tts-service.js`
- `src/modules/ai/index.js`

---

## Phase 2: Natural Language Understanding ✅ COMPLETE
**Goal**: Parse user intents from voice/text

### Deliverables
- [x] OpenAI-powered intent parser (gpt-4o-mini)
- [x] JSON structured output with normalization
- [x] Regex fallback parser for offline/error cases
- [x] Intent schema: action, target, targetType, durationMinutes
- [x] Support for "Block X for Y minutes" and "Stop blocking"
- [x] Environment configuration for OpenAI API

### Key Files
- `src/modules/ai/nlu/intent-parser.js` - Main parser with AI-first approach
- `src/modules/ai/nlu/ai-intent-parser.js` - OpenAI integration
- `src/modules/ai/nlu/regex-intent-parser.js` - Fallback parser
- `AI_AGENT_SETUP.md` - Setup documentation

---

## Phase 3: Execution & Alias System ✅ COMPLETE
**Goal**: Map nicknames to apps and execute blocking

### Deliverables
- [x] Alias storage with TokenBundle shape (apps, categories, domains)
- [x] AsyncStorage implementation (dev)
- [x] Fuzzy matching for nicknames and synonyms
- [x] Focus executor with plan/apply pattern
- [x] Confirmation flow (confirm-first, then apply)
- [x] Undo functionality
- [x] Dev Family Picker modal for first-time alias creation
- [x] Re-run utterance after alias creation
- [x] AppBlocker DevStub integration

### Key Files
- `src/modules/ai/aliases/alias-store.js` - Alias CRUD and resolution
- `src/modules/ai/aliases/alias-native.js` - FamilyActivityPicker wrapper
- `src/modules/ai/executor/focus-executor.js` - Plan and apply logic
- `src/components/AppBlocker.js` - DevStub for simulator

---

## Phase 4: Native iOS Integration ✅ COMPLETE
**Goal**: Use real Screen Time opaque tokens via existing libraries; unify manual and voice flows

### What we shipped
- ✅ Integrated `react-native-device-activity` for FamilyActivitySelection (native picker component) and Screen Time blocking
- ✅ Single source of truth: manual and voice flows both use `FocusSessionScreen` → `ActiveSessionScreen`
- ✅ Opaque tokens persisted in alias store; voice-created aliases store `tokens.opaqueToken`
- ✅ Stable selection id: `focusflow_selection` shared across flows for consistent metadata/blocking
- ✅ Pre-register selection id before navigating to `ActiveSession` so metadata loads and id-based blocking works
- ✅ Robust unblock at end: unblock by id and token, stop monitoring, and clear ManagedSettings shields as safety net

### Key files (JS)
- `src/screens/FocusSessionScreen.js` — native picker + alias save (voice mode auto-open)
- `src/modules/ai/executor/focus-executor.js` — register selection id, hand off to ActiveSession
- `src/screens/ActiveSessionScreen.js` — shield config, block/unblock, monitoring, timers
- `src/components/ai/VoiceMicButton.js` — navigate to picker on first use, then to ActiveSession

### Native pieces in repo
- `ios/Modules/ManagedSettingsModule.m` — provides `removeShield()` used as a final cleanup step

### Deferred/Optional (not required for current MVP)
- App Group alias storage (`AliasesStore.swift`) for cross-target sharing (e.g., Siri) — optional
- Token serialization helpers (`TokensCodable.swift`) — unnecessary while we store base64 payloads in JS

### Notes
- We did not implement a custom FamilyActivityPicker bridge; the library’s `DeviceActivitySelectionView` covers it.
- Monitoring windows are set conservatively (≥30m) with JS-timer unblock at the requested end for reliability during dev.

---

## Phase 5: Siri Shortcuts & App Intents 📋 TODO
**Goal**: Voice commands from Siri without opening app

### Deliverables
- [ ] App Intent for "Start Focus Session"
- [ ] App Intent for "Stop Blocking"
- [ ] Shortcuts.app integration
- [ ] Suggested shortcuts on device
- [ ] Background execution support

### Key Files
- `ios/AppIntents/StartFocusIntent.swift`
- `ios/AppIntents/StopBlockingIntent.swift`
- `app.json` - NSUserActivityTypes

---

## Phase 6: Wake Word Detection 📋 TODO
**Goal**: Hands-free activation with "Hey Mada"

### Deliverables
- [ ] Wake word library integration (Porcupine or Snowboy)
- [ ] Continuous listening mode (low power)
- [ ] Wake word detection → activate STT
- [ ] Privacy controls (opt-in, indicator)
- [ ] Battery optimization

### Options
- **Porcupine** - Offline, custom wake words
- **Snowboy** - Open source, trainable
- **iOS Speech Recognition** - "Hey Mada" detection via STT

---

## Phase 7: Voice Quality Upgrades ✅ COMPLETE (OpenAI TTS)
**Goal**: Natural, human-like responses

### What we shipped
- ✅ OpenAI TTS API integration (gpt-4o-mini-tts model)
- ✅ Provider toggle via `EXPO_PUBLIC_AI_TTS_PROVIDER` (ios|openai)
- ✅ Voice selection via `EXPO_PUBLIC_AI_TTS_VOICE` (alloy, aria, verse, sol, luna)
- ✅ Audio playback via expo-av with auto-cleanup
- ✅ Graceful fallback to iOS expo-speech when OpenAI unavailable
- ✅ Availability check with native module detection
- ✅ iOS voice prefetch and dynamic selection for better quality

### Implementation
- `src/modules/ai/voice/openai-tts-service.js` — OpenAI audio fetch + expo-av playback
- `src/modules/ai/voice/tts-service.js` — Unified provider with fallback logic
- Uses `expo-file-system/legacy` for Expo SDK 54 compatibility

### Optional future enhancements
- [ ] Audio caching for common phrases
- [ ] Streaming support for lower latency
- [ ] ElevenLabs integration for ultra-realistic voices
- [ ] Custom "Mada" voice cloning

---

## Phase 8: Conversation Context ✅ COMPLETE
**Goal**: Multi-turn conversations and conversational assistant behavior

### What we shipped
- ✅ Intent classification system - Detects if user request is on-topic (block/remind/focus)
- ✅ Conversational guidance - Politely redirects off-topic requests with helpful suggestions
- ✅ Action detection - Validates presence of action verbs (block, stop, remind, start)
- ✅ Smart clarification - Asks "Which apps?" or "For how long?" when info missing
- ✅ Conversation context store with AsyncStorage (5-minute TTL)
- ✅ Pronoun resolution ("block it", "that app", "do it again")
- ✅ Relative duration support ("for longer", "add 10 minutes")
- ✅ Context-aware suggestions based on conversation history
- ✅ Reminder command support (one-time, daily, weekly, custom)

### Implementation
- `src/modules/ai/nlu/intent-classifier.js` — Classifies intent as 'valid', 'off-topic', or 'unclear-action'
  - Detects action keywords: block, stop, remind, start, focus
  - Validates against known aliases and app names
  - Returns guidance prompts for different scenarios
- `src/modules/ai/conversation-context.js` — Context store and smart prompts
  - `getGuidancePrompt()` — Returns helpful messages based on classification
  - `resolvePronouns()` — Replace "it", "that", "them" with last target
  - `resolveRelativeDuration()` — Handle "longer", "add X minutes"
  - `needsClarification()` — Check if intent needs user input
- `src/modules/ai/nlu/intent-parser.js` — Context-aware parsing with classification
- `src/components/ai/VoiceMicButton.js` — Classification-first flow with guidance

### Conversational Behavior
**Off-topic requests:**
- User: "What's the weather?"
- Mada: "I help you block distracting apps and set focus reminders. Try saying 'Block social media for 30 minutes' or 'Remind me to check messages in 1 hour'."

**Unclear action:**
- User: "Instagram 30 minutes" (missing verb)
- Mada: "Did you want to block Instagram for 30 minutes? Say 'yes' to confirm."

**Missing target:**
- User: "Block stuff" or "Start focus session"
- Mada: "Which apps would you like to block? Try 'social apps', 'Instagram', or say an app name."

**Missing duration:**
- User: "Block social apps"
- Mada: "For how long? Try '30 minutes', '1 hour', or say a duration."

**Reminder support:**
- User: "Remind me to exercise in 30 minutes" → One-time reminder
- User: "Remind me to drink water every day at 9 AM" → Daily reminder
- User: "Remind me to check emails every Monday" → Weekly reminder
- User: "Remind me on Mondays and Wednesdays at 2 PM" → Custom reminder

### User Experience Improvements
- **Focused assistant**: Only handles app blocking and reminders, politely redirects other requests
- **Natural conversation**: Feels like talking to a personal assistant, not a command parser
- **Helpful guidance**: Suggests what Mada can do when user is unclear
- **Context continuity**: "Block it for longer" → extends last app automatically
- **Smart suggestions**: Prompts include last-used values for faster input

### Optional future enhancements
- [ ] Location-based reminders ("Remind me when I get home")
- [ ] Reminder editing/deletion via voice
- [ ] Reminder list view with voice navigation
- [ ] Smart reminder suggestions based on patterns

---

## Phase 8.5: AI Voice Reminders Execution ✅ COMPLETE
## Phase 8.6: Focus Session End Notifications & Auto‑Unblock ✅ COMPLETE
**Goal**: Reliable end-of-session notifications in all app states and automatic unblocking at session end.

### What we shipped
- Interval-based primary notification (avoids foreground early-callback bug)
- Date-based backup notification when app backgrounds (`{ type: 'date', date }`)
- Foreground fallbacks at end + 5s verification fallback
- Stale banner cleanup (only dismiss if >15s past intended time)
- Safe DeviceActivity monitoring refinement to end at the intended time when ≥5m remain
- Guarded refine (single attempt) and restore long window on failure

### Why
- Foreground absolute-date triggers fired receive-callback immediately at schedule time → no banner later
- Background delivery needed redundancy during suspension (date backup mirrors reminder behavior)
- Auto-unblock without foreground should work for longer sessions; short sessions (<5m) are constrained by iOS

### Notes
- For short sessions, we keep the ≥30m monitoring window; unblocking still occurs via completion flow.
- The new backup trigger uses the non-deprecated shape `{ type: 'date', date }`.
- Global notification handler suppresses early banners except explicit fallbacks.

**Goal**: Execute parsed reminder intents with notifications

### Deliverables
- [x] Reminder parsing (completed in Phase 8)
- [x] Notification scheduling system
- [x] One-time reminder execution (X minutes/hours from now)
- [x] Daily reminder execution (every day at HH:MM)
- [x] Weekly reminder execution (every Monday/Tuesday/etc at HH:MM)
- [x] Custom reminder execution (multiple days at HH:MM)
- [x] Reminder storage and persistence
- [x] Notification permissions handling
- [x] Voice confirmation after setting reminder
- [x] Number word parsing (e.g., "five minutes", "one hour")
- [x] Special phrase support ("half an hour", "quarter hour")
- [x] Legacy storage integration (reminders appear in UI immediately)

### Implementation
- `src/modules/reminders/reminder-scheduler.js` — Schedule notifications with expo-notifications
  - Android-only notification channel setup
  - Correct weekday mapping (Sunday=1 for Expo)
  - One-time, daily, weekly, custom scheduling
  - Permission requests with settings deep-link
- `src/modules/reminders/reminder-store.js` — Persist reminders in AsyncStorage
  - CRUD operations for reminder metadata
  - Notification ID tracking for cancellation
- `src/modules/ai/executor/reminder-executor.js` — Execute reminder intents (plan/apply pattern)
  - Validation and permission checks
  - Dual storage (new + legacy for UI)
  - Confirmation message generation
- `src/modules/ai/nlu/intent-parser.js` — Enhanced reminder parsing
  - Number word support: "five", "twenty-five", "an hour"
  - Special phrases: "half an hour" → 30 min
- `src/components/ai/VoiceMicButton.js` — Full reminder flow integration
  - STT inline handling for reminders (no timeout)
  - Confirmation dialog before scheduling
  - TTS success confirmations

### Reminder Types

**One-time:**
```javascript
{
  action: 'remind',
  message: 'exercise',
  reminderType: 'one-time',
  durationMinutes: 30
}
→ Schedule notification 30 minutes from now
```

**Daily:**
```javascript
{
  action: 'remind',
  message: 'drink water',
  reminderType: 'daily',
  time: '9 AM'
}
→ Schedule repeating notification daily at 9:00 AM
```

**Weekly:**
```javascript
{
  action: 'remind',
  message: 'check emails',
  reminderType: 'weekly',
  days: ['monday'],
  time: '2 PM'
}
→ Schedule notification every Monday at 2:00 PM
```

**Custom:**
```javascript
{
  action: 'remind',
  message: 'team meeting',
  reminderType: 'custom',
  days: ['monday', 'wednesday', 'friday'],
  time: '10 AM'
}
→ Schedule notification on Mon/Wed/Fri at 10:00 AM
```

### User Experience
- Voice: "Remind me to exercise in 30 minutes"
- Mada: "Set a reminder to exercise in 30 minutes?"
- User: [taps "Set Reminder"]
- Mada: "I'll remind you to exercise in 30 minutes. Notification set for 3:45 PM."
- At 3:45 PM: Notification appears with "Time to exercise!"

**What works:**
- ✅ "Remind me to [action] in five minutes" → One-time (number word support)
- ✅ "Remind me to [action] in one hour" → One-time (60 minutes)
- ✅ "Remind me to [action] in half an hour" → One-time (30 minutes)
- ✅ "Remind me to [action] every day at 9 AM" → Daily
- ✅ "Remind me to [action] every Monday at 6 PM" → Weekly
- ✅ "Remind me to [action] on Mondays and Wednesdays at 2 PM" → Custom
- ✅ Confirmation dialog with natural language message
- ✅ TTS confirmation after successful scheduling
- ✅ Reminders appear immediately in Reminders screen
- ✅ Permission guidance with Settings deep-link

### Dependencies
- `expo-notifications` — Scheduling and permission management
- `AsyncStorage` — Dual storage (new store + legacy UI store)
- Permission handling — iOS notification permissions with guidance alerts

---

## Phase 9: UI Polish & Onboarding ✅ COMPLETE
**Goal**: Smooth first-time experience with voice features

### Phase 9.1: Voice Tutorial Modal ✅ COMPLETE
**Deliverables:**
- [x] 5-step onboarding modal explaining voice features
- [x] Visual examples for each command type
- [x] "Try it now" CTA button
- [x] Storage flag to show only once
- [x] Accessible from Settings for re-watching

**Files:**
- `src/components/ai/VoiceTutorialModal.js`
- `src/storage/index.js` (tutorial shown flag)

### Phase 9.2: Permission UX Improvements ✅ COMPLETE
**Deliverables:**
- [x] PermissionExplainerModal with visual icons
- [x] Step-by-step permission request flow
- [x] Deep-link to Settings for manual permission grant
- [x] Permission status indicators in Settings
- [x] Graceful degradation when permissions denied

**Files:**
- `src/components/ai/PermissionExplainerModal.js`
- `src/utils/permission-helper.js`

### Phase 9.3: Voice Settings Toggles ✅ COMPLETE
**Deliverables:**
- [x] VoiceSettings storage with AsyncStorage
- [x] Settings screen UI for voice toggles
- [x] Voice enabled/disabled toggle
- [x] TTS enabled/disabled toggle
- [x] Integration with VoiceMicButton (conditional rendering)
- [x] Integration with TTS service (respect settings)

**Files:**
- `src/storage/index.js` (voice settings CRUD)
- `src/screens/SettingsScreen.js` (UI toggles)
- `src/components/ai/VoiceMicButton.js` (conditional rendering)
- `src/modules/ai/voice/tts-service.js` (respect settings)

### Phase 9.4: Voice Hints ✅ COMPLETE
**Deliverables:**
- [x] VoiceHint component with contextual examples
- [x] Rotating hints with auto-refresh (10s intervals)
- [x] Screen-specific examples (Home vs Reminders)
- [x] Subtle glass card design
- [x] Integration in HomeScreen and RemindersScreen

**Files:**
- `src/components/ai/VoiceHint.js`
- `src/screens/HomeScreen.js`
- `src/screens/RemindersScreen.js`

### Phase 9.5: Non-Blocking Toast Notifications ✅ COMPLETE
**Goal**: Replace blocking Alert dialogs with modern toast notifications and undo functionality

**Deliverables:**
- [x] Toast component with slide-in/out animations
- [x] ToastContext for global state management
- [x] App-wide integration with ToastProvider
- [x] Converted 8 blocking Alerts to Toast in VoiceMicButton
- [x] Undo system for reminders (cancel notification + storage)
- [x] Grace period undo for blocking sessions (4s window)
- [x] Action buttons on toasts for undo/dismiss

**Implementation Details:**

**Toast Component** (`src/components/Toast.js`):
- Smooth animations (slide from bottom, translateY)
- Three variants: success ✓, error ✗, info ℹ️
- Auto-dismiss after 4s (configurable)
- Optional action button with callback
- GlassCard design matching app theme

**Toast Context** (`src/contexts/ToastContext.js`):
- Global toast state management
- `showToast(message, options)` API
- `useToast()` hook for components
- Single active toast (new replaces old)

**Undo Logic** (`src/components/ai/VoiceMicButton.js`):

*Reminder Undo:*
- Stores `{ type: 'reminder', data: { result } }` after success
- On undo: Cancel scheduled notification(s) via `Notifications.cancelScheduledNotificationAsync()`
- Delete reminder from storage via `deleteReminder(reminderId)`
- Show confirmation toast: "Reminder cancelled"

*Session Undo (Grace Period):*
- Stores `{ type: 'session', data: { target, duration } }` after confirmation
- 4-second grace period where user can tap "Undo"
- On undo within grace period:
  - Stop DeviceActivity monitoring: `DeviceActivity.stopMonitoring(['focusSession'])`
  - Unblock selection: `DeviceActivity.unblockSelection()`
  - Remove shield: `ManagedSettingsModule.removeShield()`
  - Clear session storage: `setSession({ active: false })`
  - Navigate back to Home
  - Show confirmation: "Session cancelled"
- After grace period: Toast disappears, session is committed, must use manual "End Session" (with sarcastic message)

**UX Flow:**
```
Before Phase 9.5:
User: "Block Instagram for 30 minutes"
→ Alert blocks screen: "Confirm?"
→ User taps OK
→ Alert blocks screen: "Instagram blocked!"
→ User taps OK
→ Finally done

After Phase 9.5:
User: "Block Instagram for 30 minutes"
→ Alert: "Confirm?" [Cancel] [OK]
→ User taps OK
→ Toast slides in: "✓ Instagram blocked for 30 minutes" [Undo]
→ Auto-dismisses after 4s
→ User can tap Undo within grace period
→ Done! Non-blocking, responsive
```

**Design Decisions:**
- Keep Alert dialogs for:
  - Clarification questions (multiple choice buttons)
  - Pre-action confirmations (requires user choice)
  - Navigation prompts (teaching aliases)
- Use Toast for:
  - Success messages after actions
  - Error messages and info
  - Quick dismissible notifications
- Undo only makes sense for:
  - ✅ Reminders (easily reversible)
  - ✅ Sessions within grace period (4s window before commitment)
  - ❌ Not for active sessions (defeats unbreakable focus model)

**Files Modified:**
- `src/components/Toast.js` (NEW)
- `src/contexts/ToastContext.js` (NEW)
- `App.js` (wrapped with ToastProvider)
- `src/components/ai/VoiceMicButton.js` (8 Alerts → Toast, undo logic)

**Dependencies Added:**
- `expo-notifications` (already existed for reminders)
- `react-native-device-activity` (already existed for blocking)
- `deleteReminder` from `reminder-store.js`
- `setSession` from `storage/index.js`

---

## Phase 10: Testing & Rollout 📋 TODO
**Goal**: Safe, gradual feature release

### Testing
- [ ] Unit tests for intent parser
- [ ] Integration tests for alias resolution
- [ ] E2E tests for voice flow
- [ ] Device testing (various iOS versions)
- [ ] Performance profiling (battery, CPU)

### Rollout Strategy
1. **Listen-only mode**: Voice works, but no actions (logging only)
2. **Parse-only mode**: Show parsed intent, require manual confirmation
3. **Full mode**: Auto-apply with confirm-first pattern

### Feature Flags
- `AI_VOICE_LISTEN_ONLY` - Just STT logging
- `AI_INTENTS_PARSE_ONLY` - Parse but don't execute
- `AI_AUTO_APPLY` - Skip confirmation (advanced users)
- `AI_WAKE_WORD_ENABLED` - "Hey Mada" activation

---

## Success Metrics
- Voice command success rate > 90%
- Alias recognition accuracy > 95%
- Time to create alias < 30 seconds
- Battery impact < 3% per day
- User satisfaction (surveys) > 4.5/5

---

## Dependencies & Prerequisites
- iOS 16.0+ (Screen Time API)
- Apple Developer Program (for Family Controls entitlement)
- OpenAI API key (for NLU and optional TTS)
- App Group container for shared storage
- Microphone and Speech Recognition permissions
