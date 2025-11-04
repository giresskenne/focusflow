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

## Phase 4: Native iOS Bridges 🔨 IN PROGRESS
**Goal**: Replace bundle IDs with real Screen Time opaque tokens

### Critical Native Modules

#### 4.1 FamilyActivityPicker Bridge
**File**: `ios/PickerModule.mm`
```objective-c
// Present FamilyActivityPicker and return serialized tokens
RCT_EXPORT_METHOD(showPicker:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  // Present FamilyActivitySelection view
  // Return JSON: { apps: [...], categories: [...], domains: [...] }
}
```

#### 4.2 ManagedSettings Shield Bridge
**File**: `ios/ManagedSettingsModule.mm`
```objective-c
// Apply shields using opaque tokens
RCT_EXPORT_METHOD(shieldApps:(NSArray *)tokenStrings
                  durationSeconds:(NSInteger)duration
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  // Decode tokens, apply shield, schedule end time
}

RCT_EXPORT_METHOD(removeShield:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  // Clear all shields
}
```

#### 4.3 App Group Alias Storage
**File**: `ios/AliasesStore.swift`
```swift
// Read/write aliases.json to App Group container
func loadAliases() -> [String: Alias]
func saveAliases(_ aliases: [String: Alias])
```

#### 4.4 Token Serialization
**File**: `ios/TokensCodable.swift`
```swift
// Encode/decode ApplicationToken, WebDomainToken, etc.
struct SerializableToken: Codable {
  let type: String // "app", "category", "domain"
  let data: Data   // Opaque token bytes
}
```

### Integration Tasks
- [ ] Create native module stubs in Xcode
- [ ] Implement FamilyActivityPicker presentation
- [ ] Wire picker results to JS bridge
- [ ] Implement ManagedSettings shield application
- [ ] Add App Group entitlement and container access
- [ ] Implement token serialization helpers
- [ ] Update alias-store.js to use native storage
- [ ] Update AppBlocker to use ManagedSettings
- [ ] Replace DevStub with real native calls
- [ ] Test end-to-end with real Screen Time blocking

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

## Phase 7: Voice Quality Upgrades 📋 TODO
**Goal**: Natural, human-like responses

### Options

#### Option A: OpenAI TTS API
- Use same OpenAI endpoint as NLU
- Voices: alloy, echo, fable, onyx, nova, shimmer
- Streaming support for low latency
- Cost: ~$15 per million characters

#### Option B: ElevenLabs
- Ultra-realistic voices
- Voice cloning for custom "Mada" voice
- Higher cost but best quality

#### Option C: Google Cloud TTS
- Neural2 voices
- SSML support for prosody control
- Wavenet quality

### Implementation
- [ ] Add TTS provider config to .env
- [ ] Implement OpenAI TTS service
- [ ] Cache audio locally for common phrases
- [ ] Fallback to iOS system voice

---

## Phase 8: Conversation Context 📋 TODO
**Goal**: Multi-turn conversations and memory

### Features
- [ ] Session context (remember last command)
- [ ] Clarification prompts ("Which app?", "For how long?")
- [ ] Command chaining ("Block social and work apps")
- [ ] Personalization ("My usual focus session")
- [ ] History and analytics

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
