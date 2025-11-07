# Double Voice Response Fix

## Issue
After STT audio session fix, voice commands were executing twice and getting double voice responses (~100ms apart).

## Root Cause
**Two sources of duplicate execution:**

### 1. Double Parsing
```javascript
// STT final result handler (line ~665)
const intent = await parseIntentHybrid(lastUtterance, ...);  // Parse #1
...
runText(lastUtterance);  // This calls parseIntentHybrid AGAIN! Parse #2
```

**Result:** Same command parsed twice, causing:
- Double OpenAI API calls (if cloud fallback)
- Double execution logic
- Double voice responses

### 2. Multiple Final Results
iOS Speech Recognition sends multiple `final: true` results for the same utterance:

```
LOG  [VoiceMicButton] STT result: Block WhatsApp for two minutes final: true
LOG  [VoiceMicButton] STT result: Block WhatsApp for two minutes final: false
...
LOG  [VoiceMicButton] STT result: Block WhatsApp for two minutes final: true  ← Duplicate!
```

The 800ms debounce timer fires for EACH final result, causing duplicate processing.

## Logs Analysis

**Before Fix:**
```
LOG  [VoiceMicButton] STT Parse: cloud (confidence: 0.9, 1400ms)  ← STT handler parse
LOG  [VoiceMicButton] Running utterance: Block WhatsApp for two minutes
LOG  [VoiceMicButton] Parse: cloud (confidence: 0.9, 2821ms)  ← runText() re-parse!
```

**Expected After Fix:**
```
LOG  [VoiceMicButton] STT Parse: cloud (confidence: 0.9, 1400ms)  ← STT handler parse
LOG  [VoiceMicButton] Running utterance: Block WhatsApp for two minutes
(No duplicate parse - uses pre-parsed intent)
```

## Solution Applied

### Fix 1: Pass Pre-Parsed Intent to `runText()`

**Modified `runText()` signature:**
```javascript
const runText = async (utterance, preParsedIntent = null) => {
  // Use pre-parsed intent if provided (from STT), otherwise parse now
  const intent = preParsedIntent || await parseIntentHybrid(utterance, ...);
  
  // Log telemetry only if we just parsed (not if pre-parsed)
  if (!preParsedIntent && intent?.metadata) {
    console.log(`[VoiceMicButton] Parse: ${intent.metadata.source} ...`);
  }
  ...
}
```

**Updated STT handler call:**
```javascript
if (readyToApply || (intent && intent.action === 'remind')) {
  accepted = true;
  await cleanup();
  runText(lastUtterance, intent); // ← Pass intent to avoid re-parsing
}
```

### Fix 2: Duplicate Utterance Detection

**Added tracking variable:**
```javascript
let lastUtterance = '';
let finalResultTimer = null;
let processedUtterance = null; // ← Track what we've already processed
```

**Skip duplicates:**
```javascript
if (meta?.final) {
  if (finalResultTimer) clearTimeout(finalResultTimer);
  finalResultTimer = setTimeout(async () => {
    if (!sessionActive) return;
    
    // Skip if we already processed this exact utterance
    if (processedUtterance === lastUtterance) {
      console.log('[VoiceMicButton] Skipping duplicate utterance:', lastUtterance);
      return;
    }
    processedUtterance = lastUtterance;
    
    // Parse and execute...
  }, 800);
}
```

## Files Changed
- ✅ `src/components/ai/VoiceMicButton.js`
  - Modified `runText()` to accept optional `preParsedIntent` parameter
  - Added `processedUtterance` tracking to skip duplicates
  - Updated STT handler to pass pre-parsed intent

## Expected Behavior After Fix

1. **Single Parse:** Each utterance parsed exactly once
2. **Single Execution:** Command logic runs once
3. **Single Voice Response:** TTS speaks once
4. **Telemetry Accuracy:** Parse counts reflect actual parses, not duplicates

## Testing

**Test Command:** "Block Instagram for 30 minutes"

**Expected Logs:**
```
LOG  [VoiceMicButton] Starting STT...
LOG  [VoiceMicButton] STT result: Block Instagram for 30 minutes final: true
LOG  [VoiceMicButton] STT Parse: local (confidence: 1.0, 8ms)
LOG  [VoiceMicButton] Running utterance: Block Instagram for 30 minutes
(No duplicate parse log)
LOG  [AI] handleUtterance called with: Block Instagram for 30 minutes confirm: true
LOG  [TTS] speak provider: openai text len: 82
(Single voice response)
```

**No More:**
- ❌ Double "Parse:" logs
- ❌ Two TTS calls 100ms apart
- ❌ Duplicate handleUtterance calls

## Impact on Telemetry

**Before:** Telemetry showed inflated numbers (2x actual parses)
```javascript
{
  totalParses: 100,   // Actually only 50 unique commands
  localSuccess: 90,   // 45 unique
  cloudFallback: 10,  // 5 unique
}
```

**After:** Accurate counts
```javascript
{
  totalParses: 50,    // Correct
  localSuccess: 45,   // Correct
  cloudFallback: 5,   // Correct
}
```

## Related Fixes

This fix builds on:
1. **STT Audio Session Fix** - Ensures STT starts cleanly (no format errors)
2. **Hybrid Intent Service** - Provides confidence-based parsing
3. **Telemetry Logging** - Tracks parse performance

All three fixes work together to provide:
- ✅ Reliable voice input (STT works)
- ✅ Single execution (no duplicates)
- ✅ Accurate metrics (telemetry correct)
- ✅ Cost efficiency (hybrid local-first)

---

**Status:** ✅ Fixed
**Rebuild Required:** Yes (changes to VoiceMicButton.js)
**Breaking:** No (backwards compatible)
