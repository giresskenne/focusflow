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

## Phase 9: UI Polish & Onboarding 📋 TODO
**Goal**: Smooth first-time experience

### Deliverables
- [ ] Voice tutorial/tips modal
- [ ] AliasChips in preset screens
- [ ] Non-blocking undo snackbar
- [ ] Voice hints ("Try: Block social for 30 minutes")
- [ ] Permission request flow with explanations
- [ ] Settings toggle for TTS, wake word, etc.

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
