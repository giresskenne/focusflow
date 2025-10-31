# FocusFlow AI Features Implementation Tasks

## Context
FocusFlow is an Expo React Native app (iOS focus) for focus sessions and app blocking. Current stack: Expo SDK, React Navigation, AsyncStorage, Supabase, RevenueCat. App structure exists at `focusflow-app/` with screens, components, and services.

---

## TASK 1: Background Relaxation Music Player

### Requirements
Implement background audio player that continues playing when app is backgrounded or screen is locked. Must show lock screen controls (play/pause/skip) and handle audio interruptions (calls, Siri).

### Implementation Strategy

**Step 1: Install Dependencies**
```bash
cd focusflow-app
pnpm add react-native-track-player
```

**Step 2: Update app.json**
Add to `ios.infoPlist`:
```json
{
  "UIBackgroundModes": ["audio"],
  "NSAppleMusicUsageDescription": "FocusFlow plays relaxation music during focus sessions to help you maintain concentration."
}
```

**Step 3: Create Audio Service**
Create `focusflow-app/services/AudioService.ts`:
- Initialize TrackPlayer with background capability
- Create playlist of relaxation tracks (lo-fi, rain, ocean, white noise)
- Implement play, pause, stop, skip, setVolume methods
- Handle audio interruptions (pause on call, resume after)
- Configure lock screen controls with session metadata
- Export singleton instance

**Step 4: Create Music Player UI**
Create `focusflow-app/components/MusicPlayer.tsx`:
- Mini player bar (shows current track, play/pause, skip)
- Full player modal (track list, volume slider, timer)
- Integration with focus session (auto-start option)
- Persistent state (remember last playing track)

**Step 5: Integration**
- Add MusicPlayer component to Home screen bottom
- Add "Play music during session" toggle in Focus Session settings
- Auto-start music when focus session begins (if enabled)
- Stop music when session ends

**Technical Notes:**
- Use `TrackPlayer.setupPlayer()` in App.tsx on mount
- Register playback service for background updates
- Use `TrackPlayer.updateOptions()` for lock screen controls
- Store music preferences in AsyncStorage

---

## TASK 2: Voice Command System

### Requirements
Implement AI-powered voice assistant for hands-free control. User says commands like "Start 30 minute focus session" or "Add reminder for tomorrow at 9am" and app executes actions. Should provide voice feedback.

### Implementation Strategy

**Step 1: Install Dependencies**
```bash
cd focusflow-app
pnpm add @react-native-voice/voice
pnpm add react-native-tts
pnpm add openai
```

**Step 2: Update app.json Permissions**
Add to `ios.infoPlist`:
```json
{
  "NSMicrophoneUsageDescription": "FocusFlow uses your microphone to enable voice commands for hands-free focus session control, like 'Start 30-minute session' or 'Add reminder'.",
  "NSSpeechRecognitionUsageDescription": "FocusFlow uses speech recognition to understand your voice commands and control the app hands-free during focus sessions."
}
```

**Step 3: Create Voice Service**
Create `focusflow-app/services/VoiceService.ts`:
- Initialize Voice SDK and TTS
- Implement `startListening()` - begins speech recognition
- Implement `stopListening()` - ends recognition
- Implement `speak(text)` - text-to-speech response
- Handle speech recognition events (onSpeechResults, onSpeechError)
- Request microphone permission on first use
- Export singleton instance

**Step 4: Create AI Command Parser**
Create `focusflow-app/services/AICommandParser.ts`:
- Initialize OpenAI client with API key from env
- Implement `parseCommand(spokenText: string)` that calls GPT-4o-mini
- System prompt: "You are FocusFlow voice assistant. Parse user commands into JSON actions. Supported actions: start_session (duration, apps), add_reminder (title, time, date), play_music, pause_music, get_stats, end_session. Return JSON: {action, parameters}. Be flexible with natural language."
- Return parsed intent object: `{action: string, params: Record<string, any>}`
- Handle API errors gracefully (fallback to error message)

**Step 5: Create Command Executor**
Create `focusflow-app/services/CommandExecutor.ts`:
- Implement `executeCommand(intent)` that routes to appropriate service
- Map actions to functions:
  - `start_session` → appBlockingService.startSession()
  - `add_reminder` → reminderService.addReminder()
  - `play_music` → audioService.play()
  - `pause_music` → audioService.pause()
  - `get_stats` → fetch and format user stats
  - `end_session` → appBlockingService.endSession()
- Generate confirmation message for each action
- Return success/error status and response message

**Step 6: Create Voice Assistant UI**
Create `focusflow-app/components/VoiceAssistant.tsx`:
- Floating microphone button (bottom-right of screen)
- Animated listening indicator (pulsing circle when active)
- Text display showing transcribed speech
- Response message display
- Error handling UI
- Hold-to-talk interaction (press and hold mic button)

**Step 7: Wire Everything Together**
- Add VoiceAssistant component to Home screen
- Connect Voice.onSpeechResults → AICommandParser.parseCommand
- Connect parsed intent → CommandExecutor.executeCommand
- Speak confirmation message via VoiceService.speak()
- Add voice command history to Settings (last 10 commands)

**Technical Notes:**
- Store OpenAI API key in `.env` as `EXPO_PUBLIC_OPENAI_API_KEY`
- Use GPT-4o-mini model for cost efficiency (~$0.15/1M tokens)
- Implement request timeout (5 seconds max)
- Cache common commands to reduce API calls
- Add permission request flow with explanation screen

---

## TASK 3: OCR Schedule Scanner

### Requirements
User takes photo or selects screenshot of schedule (handwritten or typed). App extracts text using OCR, parses with AI to identify tasks/events, and auto-creates reminders and focus sessions. Must show preview before confirming.

### Implementation Strategy

**Step 1: Install Dependencies**
```bash
cd focusflow-app
pnpm add expo-image-picker
pnpm add openai
```

**Step 2: Update app.json Permissions**
Add to `ios.infoPlist`:
```json
{
  "NSCameraUsageDescription": "FocusFlow uses your camera to scan handwritten or printed schedules and automatically create focus sessions and reminders.",
  "NSPhotoLibraryUsageDescription": "FocusFlow needs access to your photos to scan schedule screenshots and extract tasks, events, and reminders using AI.",
  "NSPhotoLibraryAddUsageDescription": "FocusFlow can save scanned schedule screenshots to your photo library for future reference."
}
```

**Step 3: Create Native OCR Module**
Create `focusflow-app/modules/OCRModule.ts`:
- Create Expo module that wraps iOS Vision framework
- Native Swift implementation using `VNRecognizeTextRequest`
- Expose `recognizeText(imageUri: string): Promise<string>` method
- Handle Vision framework errors
- Return raw extracted text

**Alternative (Simpler):** Use `expo-image-manipulator` + call cloud OCR API if native module too complex.

**Step 4: Create Schedule Parser Service**
Create `focusflow-app/services/ScheduleParser.ts`:
- Initialize OpenAI client
- Implement `parseSchedule(ocrText: string)` that calls GPT-4o-mini
- System prompt: "You are a schedule parser. Extract tasks and events from text. Return JSON with structure: {reminders: [{title, date, time, description}], focusSessions: [{title, startTime, duration, suggestedApps: [bundleIds]}]}. Be smart about extracting times, dates, and context. Today is [current date]."
- Parse response JSON
- Validate and normalize dates/times
- Return structured schedule object

**Step 5: Create Scanner UI**
Create `focusflow-app/screens/ScheduleScanner.tsx`:
- Two options: "Take Photo" and "Choose from Photos"
- Camera preview (if taking photo)
- Loading state while processing (OCR + AI parsing)
- Results preview screen showing:
  - Extracted text (collapsible)
  - Parsed reminders (list with edit buttons)
  - Parsed focus sessions (list with edit buttons)
  - "Confirm & Create" button
  - "Cancel" button
- Allow user to edit items before confirming

**Step 6: Create Confirmation Flow**
Create `focusflow-app/components/SchedulePreview.tsx`:
- Display parsed items in organized layout
- Each reminder: title, date, time, delete/edit buttons
- Each focus session: title, duration, suggested apps, delete/edit buttons
- Implement edit modal for each item type
- "Create All" button that:
  - Saves reminders to storage
  - Schedules notifications
  - Saves focus session templates
  - Shows success message
  - Navigates back to home

**Step 7: Integration**
- Add "Scan Schedule" button to Home screen (camera icon)
- Add to premium features gate (OCR requires premium)
- Track usage analytics (scans per user, success rate)
- Add onboarding tutorial showing example schedule photo

**Technical Notes:**
- Use iOS Vision framework for OCR (free, on-device, private)
- Compress images before OCR (max 2048px width)
- Show progress indicator: "Scanning..." → "Analyzing..." → "Creating..."
- Handle low-quality images gracefully (show error, suggest better photo)
- Store scan history (last 5 scans) for debugging
- Add fallback: if OCR fails, allow manual text input

---

## TASK 4: Environment & Configuration

### Requirements
Set up environment variables, API keys, and configuration for all AI features.

### Implementation Strategy

**Step 1: Update .env File**
Add to `focusflow-app/.env`:
```env
# OpenAI API Configuration
EXPO_PUBLIC_OPENAI_API_KEY=sk-...your-key-here...
EXPO_PUBLIC_OPENAI_MODEL=gpt-4o-mini
EXPO_PUBLIC_OPENAI_MAX_TOKENS=500

# Feature Flags
EXPO_PUBLIC_ENABLE_VOICE_COMMANDS=true
EXPO_PUBLIC_ENABLE_OCR_SCANNER=true
EXPO_PUBLIC_ENABLE_BACKGROUND_MUSIC=true

# Audio Configuration
EXPO_PUBLIC_DEFAULT_MUSIC_VOLUME=0.5
EXPO_PUBLIC_MUSIC_FADE_DURATION=3000
```

**Step 2: Update .env.example**
Create template without actual keys for repository.

**Step 3: Create Config Service**
Create `focusflow-app/config/ai.config.ts`:
- Export typed configuration object
- Validate required env vars on app start
- Provide defaults for optional configs
- Export feature flag checks

**Step 4: Add Error Boundaries**
- Wrap AI features in error boundaries
- Graceful degradation if API keys missing
- Show user-friendly error messages
- Log errors to analytics (without exposing keys)

---

## TASK 5: Premium Feature Gating

### Requirements
Voice commands and OCR scanner are premium features. Background music is free. Implement proper gating and upgrade prompts.

### Implementation Strategy

**Step 1: Update Premium Features List**
Modify `focusflow-app/services/PremiumService.ts`:
- Add to premium features enum: `VOICE_COMMANDS`, `OCR_SCANNER`
- Add to free features: `BACKGROUND_MUSIC`

**Step 2: Create Feature Gate Component**
Create `focusflow-app/components/PremiumFeatureGate.tsx`:
- Props: feature name, children
- Check if user has premium subscription
- If no premium: show upgrade modal with feature description
- If premium: render children
- Track "attempted use" analytics for conversion optimization

**Step 3: Implement Gates**
- Wrap VoiceAssistant with PremiumFeatureGate
- Wrap ScheduleScanner with PremiumFeatureGate
- Show "Premium" badge on gated feature buttons
- Update Settings screen to show which AI features are premium

**Step 4: Upgrade Modal**
- Highlight AI features in RevenueCat paywall
- Add feature preview videos/screenshots
- Show cost savings: "Worth $10/month elsewhere"
- A/B test messaging

---

## TASK 6: Analytics & Monitoring

### Requirements
Track usage of AI features for optimization and debugging.

### Implementation Strategy

**Step 1: Define Events**
```typescript
// Voice Commands
- voice_command_started
- voice_command_completed { command, success, duration }
- voice_command_failed { error }

// OCR Scanner
- schedule_scan_started
- schedule_scan_completed { items_created, duration }
- schedule_scan_failed { error }

// Background Music
- music_started { track }
- music_stopped
- music_skipped
```

**Step 2: Implement Tracking**
- Use existing analytics service
- Add AI-specific event tracking
- Track API latency and errors
- Monitor OpenAI costs (tokens used)

**Step 3: Add Debug Screen**
Create `focusflow-app/screens/AIDebugScreen.tsx` (dev only):
- Show last 10 voice commands with intents
- Show last 10 OCR scans with extracted text
- Show API usage stats (requests, tokens, costs)
- Show feature success rates
- Export logs button

---

## Success Criteria

### Background Music
- [ ] Music plays continuously when app is backgrounded
- [ ] Lock screen shows controls (play/pause/skip)
- [ ] Pauses during phone calls, resumes after
- [ ] User can select from 5+ ambient tracks
- [ ] Volume control works
- [ ] Integrates with focus session auto-start

### Voice Commands
- [ ] User can start focus session via voice
- [ ] User can add reminder via voice
- [ ] User can control music playback via voice
- [ ] Voice feedback confirms actions
- [ ] 90%+ command accuracy
- [ ] Works with natural language variations
- [ ] Response time < 3 seconds

### OCR Scanner
- [ ] Extracts text from photos accurately (80%+ success)
- [ ] Extracts text from screenshots accurately (90%+ success)
- [ ] Parses schedules correctly (identifies times, dates, tasks)
- [ ] Creates valid reminders and focus sessions
- [ ] User can preview and edit before confirming
- [ ] Handles poor quality images gracefully
- [ ] Works offline for OCR (only AI parsing needs internet)

---

## Code Quality Requirements

- All services must be singleton instances with proper TypeScript types
- All async operations must have error handling and timeouts
- All API calls must be rate-limited (max 10/min per user)
- All user-facing errors must be friendly (no technical jargon)
- All premium features must be properly gated
- All components must work on iOS 16+ (no deprecated APIs)
- All permissions must be requested with clear explanations
- All AI responses must be sanitized before execution

---

## File Structure

```
focusflow-app/
├── services/
│   ├── AudioService.ts (background music)
│   ├── VoiceService.ts (speech recognition + TTS)
│   ├── AICommandParser.ts (GPT intent extraction)
│   ├── CommandExecutor.ts (action routing)
│   ├── ScheduleParser.ts (OCR text → structured data)
│   └── PremiumService.ts (updated with AI features)
├── components/
│   ├── MusicPlayer.tsx (mini player + full modal)
│   ├── VoiceAssistant.tsx (mic button + listening UI)
│   ├── SchedulePreview.tsx (parsed items preview)
│   └── PremiumFeatureGate.tsx (subscription gate)
├── screens/
│   ├── ScheduleScanner.tsx (camera + results)
│   └── AIDebugScreen.tsx (dev only)
├── modules/
│   └── OCRModule.ts (native iOS Vision wrapper)
└── config/
    └── ai.config.ts (env vars + feature flags)
```

---

## Priority Order

1. **Background Music** (highest impact, easiest to implement)
2. **Voice Commands** (differentiator feature, medium complexity)
3. **OCR Scanner** (nice-to-have, most complex)

Build in this order. Each feature can be tested and shipped independently.