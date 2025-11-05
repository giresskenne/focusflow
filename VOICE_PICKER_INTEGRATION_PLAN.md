# Voice-to-Picker Integration Plan

## Current Architecture Discovery

### ✅ What Already Exists (Great News!)

1. **FocusSessionScreen.js** - Production picker with:
   - Beautiful template cards: Social Media, Gaming, Entertainment, Block All
   - Native FamilyActivityPicker integration via `react-native-device-activity` library
   - Opaque Screen Time token storage per template
   - Template persistence system (saves selections to AsyncStorage)
   - Modal presentation of native iOS picker
   - Automatic token serialization and app group storage

2. **react-native-device-activity** - Already installed (v0.5.0):
   - Provides `DeviceActivitySelectionView` React Native component
   - Wraps Apple's FamilyControls.FamilyActivityPicker
   - Returns opaque Screen Time tokens
   - No Expo config plugin needed - library handles native code

3. **Voice Assistant** - Fully functional (Phases 1-3 complete):
   - STT, TTS, AI NLU working
   - Alias system with storage
   - Executor that applies shields
   - Confirmation flows
   - Alias-not-found detection (noop action)

### ⚠️ Current Gap

**VoiceMicButton** uses dev mock picker instead of production FocusSessionScreen:
- Shows JS-based app selector modal
- Saves bundle IDs (not opaque tokens)
- Separate flow from manual template selection
- User asked: "why creating another picker since the app already had a picker working"

## Integration Solution

### Single Source of Truth Architecture ✅

Wire voice flow to **navigate to FocusSessionScreen** with special params:
- User says: "Block TikTok for 30 minutes"
- AI detects alias not found → noop action
- Instead of showing dev modal → navigate to FocusSession with `voiceAlias` param
- User picks apps using production template system
- After save → navigate back and re-run voice command
- Now alias exists → command succeeds with opaque tokens

### Benefits
1. ✅ One picker for all flows (manual + voice)
2. ✅ Consistent UX - same beautiful template cards
3. ✅ Proper opaque tokens from real Screen Time APIs
4. ✅ Template system works for both manual and voice
5. ✅ No duplicate picker code
6. ✅ Easier to maintain and test

## Implementation Steps

### Step 1: Update VoiceMicButton.js
**File**: `src/components/ai/VoiceMicButton.js`

**Changes**:
1. Import `useNavigation` from React Navigation
2. Get `navigation` object in component
3. Replace dev picker flow with navigation:
   ```javascript
   if (isFamilyPickerAvailable()) {
     navigation.navigate('FocusSession', {
       voiceAlias: target,  // The nickname user spoke
       onAliasCreated: () => runText(utterance)  // Re-run command after alias saved
     });
   }
   ```
4. Remove dev picker modal JSX
5. Remove dev picker state (`devPickerOpen`, `devPickerNickname`, `devSelectedApps`, `devCustomBundleId`)
6. Keep fallback logic for when native picker unavailable (development mode)

### Step 2: Enhance FocusSessionScreen.js
**File**: `src/screens/FocusSessionScreen.js`

**Changes**:
1. Check for `route.params.voiceAlias` on mount
2. If present:
   - Show instruction banner: "Pick apps for '{alias}'. Mada will remember this name."
   - Auto-set `pendingTemplateId` to `voiceAlias` (for special template)
   - Auto-open native picker modal
3. After picker saves selection:
   - Save as special template with ID: `voice:${alias}`
   - Also save to alias store (for voice system)
   - Call `route.params.onAliasCreated?.()` callback
   - Navigate back with `navigation.goBack()`
4. Add voice instruction banner component
5. Handle voice-specific templates (prefix: `voice:`)

### Step 3: Update Alias Store
**File**: `src/modules/ai/aliases/alias-store.js`

**Changes**:
1. Add `saveAliasFromTokens` helper function
2. Accept opaque tokens instead of just bundle IDs
3. Store token structure: `{ apps: [...], categories: [...], domains: [...] }`
4. Keep backward compatibility with bundle ID format

### Step 4: Clean Up
**Files**: 
- `src/modules/ai/aliases/alias-native.js`
- `src/components/ai/VoiceMicButton.js`

**Changes**:
1. Remove `createAliasViaPicker` implementation (no longer needed)
2. Keep `isFamilyPickerAvailable()` helper
3. Remove DEV_APPS constant
4. Remove dev picker styles

### Step 5: Test End-to-End
**Test Flow**:
1. **Voice → New Alias**:
   - Say: "Block gaming for 30 minutes"
   - Alias not found → navigates to FocusSession
   - Shows instruction banner
   - Auto-opens native picker
   - Select apps/categories
   - Tap Done
   - Returns to home
   - Re-runs command with saved alias
   - Shield applied successfully

2. **Manual → Template**:
   - Navigate to FocusSession manually
   - Tap "Gaming" template card
   - Opens native picker
   - Select apps
   - Template saved
   - Returns to screen
   - Template shows "X items"

3. **Voice → Existing Template**:
   - Say: "Block social for 1 hour"
   - Uses saved Social Media template
   - Shield applied immediately
   - No picker shown

## Technical Details

### Navigation Params Structure
```javascript
{
  voiceAlias: string,           // "gaming", "social", "tiktok", etc.
  onAliasCreated: () => void    // Callback to re-run voice command
}
```

### Template ID Conventions
- Manual templates: `'social'`, `'gaming'`, `'entertainment'`, `'all'`
- Voice templates: `'voice:gaming'`, `'voice:tiktok'`, etc.
- Both stored in same AsyncStorage key: `ff:templates`

### Token Storage Format (Already Implemented)
```javascript
{
  selectionToken: string,          // Opaque base64 token from FamilyActivityPicker
  appCount: number,                // Number of individual apps selected
  categoryCount: number,           // Number of categories selected
  webDomainCount: number,          // Number of web domains selected
  savedAt: number                  // Timestamp
}
```

### Voice Instruction Banner UI
```javascript
<View style={styles.voiceBanner}>
  <Ionicons name="mic" size={20} color={colors.secondary} />
  <Text style={styles.voiceBannerText}>
    Pick apps for "{voiceAlias}". Mada will remember this name.
  </Text>
</View>
```

## Migration Notes

### Backward Compatibility
- Existing manual templates continue to work
- Old alias format (bundle IDs) still supported
- Dev picker remains as fallback when native unavailable
- No breaking changes to existing flows

### Testing Strategy
1. Test with device connected (native picker available)
2. Test in simulator (fallback to dev picker)
3. Test voice → picker → re-run flow
4. Test manual template creation
5. Verify tokens persist across app restarts
6. Verify shields work with opaque tokens

## Architecture Benefits

### Before (Current)
```
Voice → Noop → Dev Modal → Bundle IDs → Alias Store
Manual → Templates → Native Picker → Opaque Tokens → Template Store
```
❌ Two separate pickers
❌ Two storage systems
❌ Inconsistent token types

### After (Integrated)
```
Voice → Noop → Navigate to FocusSession → Native Picker → Opaque Tokens → Alias + Template Store
Manual → FocusSession → Native Picker → Opaque Tokens → Template Store
```
✅ Single picker (FocusSession)
✅ Unified storage (templates + aliases)
✅ Consistent tokens (opaque)
✅ Better UX (same beautiful UI)

## Next Phase (After Integration)

Once this integration is complete, we can proceed with:
1. ✅ Phase 4: Native bridges (already done via react-native-device-activity!)
2. 🔄 Phase 5: Production polish
   - Wake word detection ("Hey Mada")
   - Better TTS voice (OpenAI TTS or ElevenLabs)
   - Siri Shortcuts integration
3. 🔄 Phase 6: Advanced features
   - Schedule management
   - Break reminders
   - Analytics
   - Social features

## Files to Modify

1. ✏️ `src/components/ai/VoiceMicButton.js` - Wire to navigation
2. ✏️ `src/screens/FocusSessionScreen.js` - Add voice params support
3. ✏️ `src/modules/ai/aliases/alias-store.js` - Add token support
4. ✏️ `src/modules/ai/aliases/alias-native.js` - Remove createAliasViaPicker
5. 📄 `AI_PROGRESS.md` - Update status
6. 📄 `AI_PHASES.md` - Mark Phase 4 as complete

## Estimated Implementation Time

- Step 1 (VoiceMicButton): 15 minutes
- Step 2 (FocusSessionScreen): 30 minutes
- Step 3 (Alias Store): 15 minutes
- Step 4 (Cleanup): 10 minutes
- Step 5 (Testing): 30 minutes
- **Total: ~2 hours**

## Risk Assessment

**Low Risk** ✅
- Using existing working components
- No native code changes needed
- react-native-device-activity already installed and working
- Graceful fallback to dev picker if needed
- Backup branch already created
- Can revert to backup-phase3-complete if issues

## Success Criteria

✅ Voice command with unknown alias opens FocusSessionScreen
✅ FocusSessionScreen shows voice instruction banner
✅ Native picker opens automatically for voice flow
✅ After saving, returns and re-runs command
✅ Command succeeds with opaque tokens
✅ Manual template flow still works unchanged
✅ No regressions in existing functionality

## Ready to Implement ✅

All requirements understood. Architecture validated. Ready to proceed with implementation.
