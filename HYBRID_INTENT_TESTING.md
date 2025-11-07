# Hybrid Intent Parsing - Testing Guide

## Overview
The hybrid intent parsing system combines local regex parsing (fast, private, free) with cloud AI fallback (accurate for ambiguous commands). This gives you:
- **95%+ local parsing** for clear commands (< 10ms, free)
- **Cloud fallback** for ambiguous/complex utterances (only when needed)
- **Full telemetry** to measure real-world performance

## Configuration

### Environment Variables
Add to your `.env` or `.env.production`:

```bash
# Enable hybrid mode
EXPO_PUBLIC_AI_HYBRID_MODE=true

# Confidence threshold (0.0-1.0)
# Commands below this threshold trigger cloud fallback
EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD=0.7

# Enable cloud fallback
EXPO_PUBLIC_AI_CLOUD_FALLBACK_ENABLED=true

# Cloud AI (required for fallback)
EXPO_PUBLIC_AI_INTENTS_ENABLED=true
EXPO_PUBLIC_OPENAI_API_KEY=your_key_here
```

### Testing Without Cloud (Local-Only Mode)
To test local parsing only (no OpenAI costs):

```bash
EXPO_PUBLIC_AI_HYBRID_MODE=true
EXPO_PUBLIC_AI_CLOUD_FALLBACK_ENABLED=false
EXPO_PUBLIC_AI_INTENTS_ENABLED=false
```

## Test Scenarios

### 1. High-Confidence Commands (Should Use Local)
These clear commands should score >= 0.7 confidence and use local parsing only:

- ✅ "Block Instagram for 30 minutes"
- ✅ "Start a focus session for 1 hour"
- ✅ "Block social media for 2 hours"
- ✅ "Stop the session"
- ✅ "Remind me to call mom in 15 minutes"

**Expected:**
- Console log: `Parse: local (confidence: 0.8-1.0, <10ms)`
- No OpenAI API call
- Fast response

### 2. Medium-Confidence Commands (May Trigger Fallback)
These commands should score 0.5-0.7 and may trigger cloud fallback if threshold is 0.7:

- ⚠️ "Block that app for a bit"
- ⚠️ "Start focus"
- ⚠️ "Block stuff"
- ⚠️ "Remind me later"

**Expected with threshold 0.7:**
- Console log: `Parse: cloud (confidence: 0.9, ~650ms)`
- OpenAI API call if `CLOUD_FALLBACK_ENABLED=true`
- Slower response but better intent extraction

**Expected with threshold 0.5:**
- Console log: `Parse: local (confidence: 0.5-0.7, <10ms)`
- No cloud call

### 3. Low-Confidence Commands (Should Always Fall Back)
These ambiguous commands should score < 0.5 and always trigger cloud fallback:

- ❌ "Do it"
- ❌ "Yeah"
- ❌ "Now"
- ❌ "That one"
- ❌ "What about the thing?"

**Expected:**
- Console log: `Parse: cloud (confidence: 0.9, ~650ms)` if cloud enabled
- Console log: `Parse: local (confidence: 0.2-0.4, <10ms, note: low-confidence-no-cloud)` if cloud disabled

### 4. Questions/Off-Topic (Should Guide User)
These should be detected as off-topic and provide guidance:

- ❓ "How do I use this?"
- ❓ "What can you do?"
- ❓ "Why isn't it working?"

**Expected:**
- Guidance prompt via TTS or alert
- No intent execution

## Viewing Telemetry

### Dev Console Logs
Every parse logs metadata to console:

```
[VoiceMicButton] Parse: local (confidence: 0.85, 8ms)
[VoiceMicButton] STT Parse: cloud (confidence: 0.9, 652ms)
```

### Settings Screen Viewer (Dev Only)
1. Open **Settings** screen
2. Scroll to **AI Dev** section (only visible in `__DEV__` mode)
3. Tap **View AI Telemetry**

Shows:
- Total parses
- Local vs cloud success rates
- Average parse times
- Confidence distribution (high/medium/low)
- Current config

### Programmatic Access

```javascript
import { getTelemetry, resetTelemetry } from '../modules/ai/nlu/hybrid-intent-service';

// Get current stats
const stats = getTelemetry();
console.log(stats);
// {
//   totalParses: 50,
//   localSuccess: 47,
//   cloudFallback: 3,
//   cloudSuccess: 2,
//   avgLocalTime: 8.2,
//   avgCloudTime: 648.5,
//   confidenceDistribution: { high: 45, medium: 3, low: 2 },
//   rates: { local: '94.0%', cloud: '4.0%', fallback: '6.0%' },
//   config: { hybridMode: true, threshold: 0.7, cloudEnabled: true }
// }

// Reset for new test session
resetTelemetry();
```

## Confidence Scoring Algorithm

The system calculates confidence based on:

| Factor | Bonus/Penalty | Rationale |
|--------|---------------|-----------|
| Action match | +0.2 | Clear action verb found (block/start/stop) |
| Duration present | +0.15 | Time specified (30 minutes, 1 hour) |
| Target clarity | +0.15 | App/category identified (Instagram, social media) |
| Short input | -0.1 | Input < 5 chars (likely incomplete) |
| Question word | -0.2 | Contains what/how/why (off-topic) |

**Base score:** 0.5

**Example calculations:**
- "Block Instagram for 30 minutes" → 0.5 + 0.2 + 0.15 + 0.15 = **1.0** ✅ local
- "Block stuff" → 0.5 + 0.2 - 0.1 = **0.6** ⚠️ local or cloud (depends on threshold)
- "What?" → 0.5 - 0.1 - 0.2 = **0.2** ❌ cloud fallback

## Expected Performance

With default threshold (0.7):
- **Local rate:** 92-97% of commands
- **Cloud rate:** 3-8% of commands
- **Avg local time:** 5-15ms
- **Avg cloud time:** 500-800ms
- **Cost reduction:** 95% vs full cloud

## Troubleshooting

### Issue: All commands using cloud
**Cause:** Threshold too high (> 0.8)
**Fix:** Lower `EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD` to 0.6-0.7

### Issue: No cloud fallback happening
**Cause:** Cloud disabled or API key missing
**Fix:** Set `EXPO_PUBLIC_AI_CLOUD_FALLBACK_ENABLED=true` and verify OpenAI API key

### Issue: Telemetry not updating
**Cause:** Using old `parseIntent` instead of `parseIntentHybrid`
**Fix:** Verify imports in `VoiceMicButton.js`:
```javascript
import { parseIntentHybrid } from '../../modules/ai/nlu/hybrid-intent-service';
```

### Issue: Cloud calls even when disabled
**Cause:** `parseIntent` (old) calls AI directly when `AI_INTENTS_ENABLED=true`
**Fix:** Use `parseIntentHybrid` everywhere, or set `AI_INTENTS_ENABLED=false` when testing local-only

## Next Steps

1. ✅ Copy `config/ai.sample.env` to `.env` and configure
2. ✅ Run app and test high-confidence commands (should be local)
3. ✅ Test low-confidence commands (should fall back if enabled)
4. ✅ Check telemetry in Settings → View AI Telemetry
5. ✅ Tune threshold based on real-world confidence scores
6. ✅ Monitor cloud fallback rate (target < 10%)

## Production Recommendations

```bash
# Recommended production config
EXPO_PUBLIC_AI_HYBRID_MODE=true
EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD=0.65  # Conservative for accuracy
EXPO_PUBLIC_AI_CLOUD_FALLBACK_ENABLED=true  # Better UX
EXPO_PUBLIC_AI_INTENTS_ENABLED=true
```

This balances accuracy (cloud available), privacy (local-first), cost (95% savings), and UX (graceful fallback).
