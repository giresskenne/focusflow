# FocusFlow — AI Voice Assistant (“Mada”) Implementation Brief

**Goal:** Add a voice-first assistant that can start/stop focus sessions and block specific apps/categories **without breaking** any existing flows.  
**Stack:** React Native (Expo), **JavaScript** codebase (not TypeScript). iOS-first using Screen Time APIs via existing native plugin(s).

---

## 1) What we’re building (in one line)

> “Mada, block **{app|preset|category}** for **{duration}**” — with a one-time user confirmation/picker to map spoken names to Apple’s **opaque tokens**, then fast, repeatable voice actions thereafter.

---

## 2) Non-negotiable constraints (Apple Screen Time)

- Apps to block must be chosen by the **user** via **FamilyActivityPicker**.  
- Returned **Application/Category/WebDomain tokens are opaque** (no bundle IDs/names in code).  
- We may **display** tokens using Apple’s `Label(token)` but not introspect them.  
- We can **shield** tokens via `ManagedSettingsStore` and **schedule** end times with `DeviceActivity`.

**Design implication:** We use a local **alias** (“tiktok”, “social”, “deep work”) → **TokenBundle** map that the user creates/approves once, then Mada reuses.

---

## 3) Guiding principles

1) **Zero regressions:** Do not alter existing preset, picker, or shielding behavior.  
2) **Feature-gated:** AI features are controlled by env flags; when OFF, the app behaves exactly as today.  
3) **Confirm first:** Default flow shows a confirmation sheet; “Auto-apply” is an advanced opt-in.  
4) **Encapsulated:** Voice → NLU → Resolver → Executor are isolated modules; only the executor calls the existing blocker API.  
5) **Undo:** Always offer a quick undo after applying shields.

---

## 4) Feature flags & env

Create `config/ai.sample.env` → copy to `.env(.production)`:

```
# OpenAI or gateway for intent parsing
OPENAI_API_KEY=replace_me
OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTENT_MODEL=gpt-4o-mini
AI_TEMPERATURE=0.2

# Feature flags
AI_VOICE_ENABLED=true
AI_INTENTS_ENABLED=true
AI_AUTO_APPLY=false
SIRI_SHORTCUTS_ENABLED=true

# iOS App Group (must match entitlements)
IOS_APP_GROUP_ID=group.cc.focusflow.shared

# Logging & privacy
LOG_LEVEL=info
FF_PRIVACY_MODE=standard
```

**Expo config:** ensure `IOS_APP_GROUP_ID` lands in entitlements (Screen Time + Device Activity already present).

**Info.plist strings:** mic/speech usage descriptions.

---

## 5) New file structure (JS-first, additive only)

> **Do not rename/move existing files.** Add the following:

```
focusflow/
├─ app/
│  ├─ components/
│  │  ├─ ai/
│  │  │  ├─ VoiceMicButton.js          # shows when AI_VOICE_ENABLED
│  │  │  ├─ VoiceHintSheet.js          # “Try saying…”
│  │  │  └─ AliasChips.js              # renders existing aliases as chips
│  │  └─ presets/
│  │     └─ (import AliasChips inside preset detail screen)
│  ├─ modules/
│  │  ├─ ai/
│  │  │  ├─ voice/
│  │  │  │  ├─ stt-service.js          # Apple Speech now; Whisper later
│  │  │  │  └─ tts-service.js
│  │  │  ├─ nlu/
│  │  │  │  ├─ intent-parser.js        # calls model, returns strict JSON
│  │  │  │  └─ grammar.js              # regex helpers: duration, keywords
│  │  │  ├─ aliases/
│  │  │  │  ├─ alias-store.js          # JS facade over native storage
│  │  │  │  ├─ alias-types.js          # JSDoc shapes (see §6)
│  │  │  │  └─ fuzzy-match.js          # Levenshtein + simple phonetics
│  │  │  ├─ executor/
│  │  │  │  └─ focus-executor.js       # maps intents → native shield calls
│  │  │  └─ index.js
│  │  └─ blockers/
│  │     └─ index.js                    # existing shield api (unchanged)
│  ├─ screens/
│  │  └─ (Presets screen)               # import mic & hint UI only
│  └─ utils/
│     └─ time.js                        # “1h30”, “until 6pm” → minutes
│
├─ ios/
│  ├─ FocusFlow/
│  │  ├─ Shared/
│  │  │  ├─ AppGroup.swift              # resolve IOS_APP_GROUP_ID
│  │  │  ├─ TokensCodable.swift         # serialize/deserialize tokens
│  │  │  ├─ AliasesStore.swift          # read/write aliases.json in App Group
│  │  │  ├─ AliasResolver.swift         # native fuzzy/phonetic (optional)
│  │  │  ├─ ManagedSettingsBridge.swift # shield/unshields + timers
│  │  │  └─ FamilyPickerBridge.swift    # show picker, return serialized tokens
│  │  ├─ Intents/
│  │  │  ├─ StartFocusIntent.swift
│  │  │  └─ StopFocusIntent.swift
│  │  └─ RNBridge/
│  │     ├─ AliasesModule.mm            # expose AliasesStore to JS
│  │     ├─ PickerModule.mm
│  │     └─ ManagedSettingsModule.mm
│  └─ FocusFlow.entitlements            # Screen Time + Device Activity + App Group
│
├─ config/
│  ├─ ai.sample.env
│  └─ ai-presets.sample.json            # optional starter preset file
│
└─ docs/
   └─ ai-voice-assistant-implementation.md (this file)
```

All new imports are **lazy** and **guarded** by flags so nothing touches existing logic unless enabled.

---

## 6) Data model (JS shapes via JSDoc)

> Stored in App Group as `aliases.json` (read/written through native module). Tokens are base64’d `Data` from Swift.

```js
/** @typedef {{apps?: string[], categories?: string[], domains?: string[]}} TokenBundle */

/** @typedef {{
 *  id: string,                 // uuid
 *  nickname: string,           // "tiktok", "no socials"
 *  tokens: TokenBundle,        // one or more token arrays
 *  synonyms?: string[],        // "tik tok"
 *  createdAt: number, updatedAt: number, usageCount: number
 * }} Alias */

/** @typedef {{ [nickname: string]: Alias }} AliasesMap */
```

- **Aliases**: one nickname can refer to **one app OR multiple apps OR categories**.  
- **Presets**: continue to live where they are; AI **reads** their selections but **doesn’t** mutate them.

---

## 7) UX flows (end-to-end)

### A) Known alias (happy path)
1. User taps the **mic** or uses a **Siri Shortcut**.  
2. STT → “Block TikTok for 30 minutes.”  
3. NLU returns `{ action:'block', targetType:'app', target:'tiktok', durationMinutes:30 }`.  
4. **Resolve alias** → tokens found.  
5. **Confirmation sheet** (default): “Blocking TikTok for 30 minutes (ends 3:30 PM).”  
6. Apply shields → show **Undo** bar for 5 seconds.

### B) First-time app name (no alias yet)
1. Same as above → alias not found.  
2. Mada: “I need you to pick this once.”  
3. Open **FamilyActivityPicker**; user selects TikTok.  
4. Save alias `“tiktok” → TokenBundle`.  
5. Confirmation → apply.

### C) Preset by voice
- “Block Social for 45 minutes.” → We fetch the **Social preset’s** tokens and apply the same confirmation → executor path.

### D) Fuzzy/ambiguous names
- If 2–5 candidates: show bottom sheet list (chips rendered with token labels).  
- If 0 or >5: offer preset names or “Create nickname now” flow.

**Micro-copy:**  
- First-run: “**Teach Mada a name.** Say it later to block these apps instantly.”  
- Fuzzy: “Did you mean… TikTok / Tik Tok / TikTak?”

---

## 8) Implementation phases (safest rollout)

**Phase 1 — Listen only (no behavior change)**  
- Add mic UI (flagged).  
- STT to text, display transcript toast. No NLU, no executor.

**Phase 2 — Parse, don’t act**  
- Add NLU → structured JSON.  
- Show a non-actionable **preview** sheet of what would happen. (Log only.)

**Phase 3 — Act with guardrails**  
- Wire executor to existing shield API.  
- Default **Require confirmation** ON; **Undo** snackbar.

**Phase 4 — Siri & quality**  
- App Intents for lock-screen entry.  
- Fuzzy matching & synonyms; “Auto-apply” toggle (OFF by default).

> At any time, if flags are OFF, app reverts to today’s behavior.

---

## 9) Where to touch UI (non-destructive)

- **Presets screen:**  
  - Add **VoiceMicButton** (visible if `AI_VOICE_ENABLED`).  
  - Add **VoiceHintSheet** CTA (“Try: Block Social for 45 minutes”).

- **Preset detail screen (where the user already configures tokens):**  
  - Add **“Voice nicknames (AI)”** section that lists/edits aliases linked to the preset’s tokens (uses AliasChips).

- **Settings → AI & Voice:**  
  - Toggles for feature flags, mic/speech permission helpers, and a personalized examples list.

> Existing “Tap to configure”, “Choose Apps from Device”, and **shield application** flows remain unchanged.

---

## 10) Executor behavior (safety rules)

- **Dry-run compute** the result first (which apps/categories will be shielded and for how long) and show in the confirmation.  
- **Conflict note:** If a category and specific apps overlap, add a one-line callout (“Category rules apply to all listed apps”).  
- **Timers:** Unshield after `durationMinutes`; if user starts another session, extend or warn (existing behavior wins).

---

## 11) Permissions & fallbacks

- Ask **Microphone**/**Speech** only when the user taps the mic or enables the voice feature.  
- If denied, hide mic and optionally show a **“Type your command”** input (non-blocking).  
- If Screen Time permissions or entitlements are missing, reuse the **existing** error education UI.

---

## 12) Error handling (user-friendly)

- **STT/NLU failure:** “I didn’t catch that. Try ‘Block Social for 30 minutes’.”  
- **Unknown name:** Offer up to five nearest aliases; or open picker to **create a nickname now**.  
- **Shield failure:** display the same message we already use today (no new error surfaces).

---

## 13) Analytics (lightweight, privacy-respecting)

- Local or anonymized counters: **voice invocations**, **NLU success rate**, **confirm vs undo**, **unknown name frequency**, **top used aliases**.  
- Never log app identities (we don’t have them anyway — tokens are opaque).  
- “Delete all voice data” button wipes `aliases.json` only; presets remain.

---

## 14) Acceptance criteria (what “done” looks like)

- With **all flags OFF**, the app is visually and functionally identical to today.  
- With **AI_VOICE_ENABLED + AI_INTENTS_ENABLED**, user can:  
  - Start a preset by voice with confirmation & undo.  
  - Create a first-time alias via picker and reuse it later hands-free.  
  - See and edit aliases under a preset and in a global list.  
- With **SIRI_SHORTCUTS_ENABLED**, user can:  
  - Say “Hey Siri, start FocusFlow 45 minutes” and complete confirmation in-app.  
- Unit/behavior tests cover: duration parsing, fuzzy match, confirmation flow, and undo.  
- No crashes or regressions in existing preset selection, picker, or shielding.

---

## 15) Don’t-touch list (to avoid regressions)

- Do **not** change any existing preset storage shape or shielding APIs.  
- Do **not** hijack the current “Start/Continue” buttons.  
- Do **not** auto-apply shields without either confirmation or the explicit **Auto-apply** opt-in.

---

## 16) Future (post-MVP) — optional

- **On-device STT:** WhisperKit bridge (privacy/offline).  
- **On-device NLU:** small GGUF model via swift-llama-cpp or MLX (native module).  
- **iCloud sync for aliases:** optional toggle with “relink” flow if tokens don’t deserialize on a new device.

---

### In short
We add a **feature-flagged** voice stack that **reads** the same selections users already configured, **confirms** the action, then calls the **same** shield API you use today. If anything goes wrong, flipping the flags returns the app to its current stable state.
