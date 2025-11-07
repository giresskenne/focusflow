# Hybrid Intent Parsing - Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER SPEAKS COMMAND                             │
│               "Block Instagram for 30 minutes"                      │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   VoiceMicButton.js                                 │
│              parseIntentHybrid(utterance)                           │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│              hybrid-intent-service.js                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ STEP 1: Local Parse (Always First)                         │  │
│  │ - Call grammar.js parseCommand()                            │  │
│  │ - Regex-based matching                                      │  │
│  │ - Extract: action, target, duration, confidence             │  │
│  │ - Time: 5-15ms                                              │  │
│  └─────────────────────┬───────────────────────────────────────┘  │
│                        │                                            │
│                        ▼                                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ STEP 2: Check Confidence                                    │  │
│  │                                                              │  │
│  │ High Confidence (≥ 0.7)?                                    │  │
│  │                                                              │  │
│  │  YES ──────► Use Local Result ──► Return                   │  │
│  │                                                              │  │
│  │  NO ───────► Continue to Step 3                            │  │
│  └─────────────────────┬───────────────────────────────────────┘  │
│                        │                                            │
│                        ▼                                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ STEP 3: Cloud Fallback (If Enabled)                         │  │
│  │                                                              │  │
│  │ Cloud Enabled?                                               │  │
│  │                                                              │  │
│  │  YES ──► Call ai-intent-parser.js                          │  │
│  │          - OpenAI API call                                   │  │
│  │          - Time: 500-800ms                                   │  │
│  │          - Cost: ~$0.00001                                   │  │
│  │          ─► Return Cloud Result                              │  │
│  │                                                              │  │
│  │  NO ───► Use Local Result Anyway                           │  │
│  │          (low confidence, but offline works)                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ STEP 4: Track Telemetry                                     │  │
│  │ - Increment totalParses                                      │  │
│  │ - Update localSuccess or cloudSuccess                        │  │
│  │ - Track parse time (avgLocalTime, avgCloudTime)             │  │
│  │ - Update confidence distribution                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   RETURN PARSED INTENT                              │
│                                                                     │
│  {                                                                  │
│    action: 'block',                                                 │
│    targetText: 'instagram',                                         │
│    durationText: '30 minutes',                                      │
│    metadata: {                                                      │
│      source: 'local',         // or 'cloud'                        │
│      confidence: 0.85,                                              │
│      parseTime: 8             // milliseconds                       │
│    }                                                                │
│  }                                                                  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│              EXECUTE INTENT (Existing Logic)                        │
│  - Create blocking session                                         │
│  - Set reminder                                                     │
│  - Provide voice feedback                                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Confidence Scoring Detail

```
calculateConfidence(parsed, originalText)
│
├─ Base Score: 0.5
│
├─ Action Match? (+0.2)
│  ├─ "block" found ──► +0.2
│  ├─ "start" found ──► +0.2
│  ├─ "stop" found ──► +0.2
│  └─ No action ──► +0.0
│
├─ Duration Present? (+0.15)
│  ├─ "30 minutes" found ──► +0.15
│  ├─ "1 hour" found ──► +0.15
│  └─ No duration ──► +0.0
│
├─ Target Clarity? (+0.15)
│  ├─ target.length > 2 ──► +0.15
│  └─ target.length ≤ 2 ──► +0.0
│
├─ Short Input? (-0.1)
│  ├─ input.length < 5 ──► -0.1
│  └─ input.length ≥ 5 ──► +0.0
│
└─ Question Word? (-0.2)
   ├─ Contains "what"/"how"/"why" ──► -0.2
   └─ No question words ──► +0.0
```

### Examples

| Input | Action | Duration | Target | Short? | Question? | Score | Route |
|-------|--------|----------|--------|--------|-----------|-------|-------|
| "Block Instagram for 30 minutes" | ✅ +0.2 | ✅ +0.15 | ✅ +0.15 | ❌ 0 | ❌ 0 | **1.0** | Local |
| "Start focus session for 1 hour" | ✅ +0.2 | ✅ +0.15 | ✅ +0.15 | ❌ 0 | ❌ 0 | **1.0** | Local |
| "Block social" | ✅ +0.2 | ❌ 0 | ✅ +0.15 | ❌ 0 | ❌ 0 | **0.85** | Local |
| "Block stuff" | ✅ +0.2 | ❌ 0 | ❌ 0 | ❌ 0 | ❌ 0 | **0.7** | Local |
| "Block it" | ✅ +0.2 | ❌ 0 | ❌ 0 | ❌ 0 | ❌ 0 | **0.7** | Local |
| "Block" | ✅ +0.2 | ❌ 0 | ❌ 0 | ✅ -0.1 | ❌ 0 | **0.6** | Cloud¹ |
| "What?" | ❌ 0 | ❌ 0 | ❌ 0 | ✅ -0.1 | ✅ -0.2 | **0.2** | Cloud¹ |

¹ If cloud enabled; otherwise uses local result

## Telemetry Flow

```
Every parseIntentHybrid() call:
│
├─ Increment totalParses
│
├─ Local parse completes
│  ├─ Update avgLocalTime
│  └─ Update confidenceDistribution
│
├─ High confidence?
│  ├─ YES ──► Increment localSuccess
│  └─ NO ──► Continue
│
├─ Cloud fallback triggered?
│  ├─ YES ──► Increment cloudFallback
│  │         ├─ Cloud succeeds ──► Increment cloudSuccess
│  │         │                  └─ Update avgCloudTime
│  │         └─ Cloud fails ──► Use local (no cloudSuccess++)
│  └─ NO ──► Increment localSuccess
│
└─ getTelemetry() returns:
   {
     totalParses: 50,
     localSuccess: 47,        // 94% local
     cloudFallback: 3,         // 6% fallback
     cloudSuccess: 2,          // 4% cloud
     avgLocalTime: 8.2,        // 8ms local
     avgCloudTime: 648.5,      // 648ms cloud
     confidenceDistribution: {
       high: 45,               // ≥ 0.8
       medium: 3,              // 0.5-0.8
       low: 2                  // < 0.5
     },
     rates: {
       local: '94.0%',
       cloud: '4.0%',
       fallback: '6.0%'
     }
   }
```

## Cost Comparison

### Before Hybrid (All Cloud)
```
Every command ──► OpenAI API
│
├─ Parse "Block Instagram for 30 minutes" ──► $0.00001
├─ Parse "Start focus" ──► $0.00001
├─ Parse "Stop" ──► $0.00001
├─ Parse "Block social for 1 hour" ──► $0.00001
└─ ... (1000 commands/day) ──► $10-15/month
```

### After Hybrid (Local-First)
```
95 commands ──► Local (FREE)
│
└─ 5 commands ──► OpenAI API ──► $0.00005
   
1000 commands/day ──► $0.50-0.75/month (95% savings)
```

---

**Key Insight:** The hybrid system optimizes for the common case (clear commands) while gracefully handling the edge case (ambiguous commands), resulting in massive cost savings without sacrificing UX.
