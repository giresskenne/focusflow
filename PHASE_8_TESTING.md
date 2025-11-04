# Phase 8: Conversation Context Testing Guide

## Overview
Phase 8 adds conversation memory to Mada, enabling multi-turn dialogues and contextual understanding. Users can now say "block it for longer", "do it again", or get smart clarification prompts.

---

## Testing Conversation Context

### 1. Basic Context Memory
Test that Mada remembers your last command:

1. **Start a session**:
   - Say: "Block social apps for 30 minutes"
   - Confirm and start the session
   
2. **Use pronoun reference**:
   - Say: "Block it for longer"
   - Expected: Mada extends "social apps" to 45 minutes (1.5x)
   - Verify: Alert shows correct target and duration

3. **Repeat command**:
   - Say: "Do it again"
   - Expected: Mada repeats last command (social apps for 30 minutes)
   - Verify: Same target and duration as original

### 2. Relative Duration Commands
Test that Mada understands relative time adjustments:

1. **Base command**:
   - Say: "Block Instagram for 30 minutes"
   
2. **Add time**:
   - Say: "Add 10 minutes"
   - Expected: Blocks Instagram for 40 minutes
   - Verify: Total duration is cumulative
   
3. **Extend further**:
   - Say: "For 20 more minutes"
   - Expected: Blocks Instagram for 60 minutes (40 + 20)
   - Verify: Continues adding to previous total

4. **Generic "longer"**:
   - Say: "Block TikTok for 1 hour"
   - Then: "For longer"
   - Expected: Extends to 90 minutes (1.5x of 60)
   - Verify: Math is correct

### 3. Smart Clarification Prompts
Test that Mada asks intelligent follow-up questions:

1. **Missing duration**:
   - Say: "Block social apps"
   - Expected: Alert appears: "For how long?"
   - Verify: Suggestions include:
     - Last used duration (if available)
     - "30 minutes"
     - "1 hour"
   - Tap any suggestion and verify it applies
   
2. **Missing target**:
   - Say: "Start focus session" (without app name)
   - Expected: Alert appears: "Which apps would you like to block?"
   - Verify: Suggestions include:
     - Last target (if available)
     - "social apps"
     - "work apps"
   - Tap suggestion and continue
   
3. **Context-aware suggestions**:
   - First: "Block Instagram for 45 minutes"
   - Then: "Block TikTok"
   - Expected: Duration prompt suggests "45 minutes" first (from context)
   - Verify: Previous duration appears in suggestions

### 4. Context Expiry (5-minute TTL)
Test that context clears after inactivity:

1. **Set initial context**:
   - Say: "Block Facebook for 30 minutes"
   - Note the time
   
2. **Wait 6 minutes**
   - Don't interact with the app
   
3. **Try pronoun reference**:
   - Say: "Block it for longer"
   - Expected: Mada doesn't resolve "it" (context expired)
   - Should treat as new command or ask for clarification
   
4. **Verify fresh start**:
   - Say: "Block Twitter for 1 hour"
   - Then immediately: "Do it again"
   - Expected: Repeats Twitter command (context refreshed)

### 5. Complex Scenarios

#### Scenario A: Multi-step with corrections
1. Say: "Block social"
2. Prompted: "For how long?" → Select "30 minutes"
3. Mada executes block
4. Say: "Add 15 minutes"
5. Expected: Extends to 45 minutes (30 + 15)

#### Scenario B: Context switching
1. Say: "Block Instagram for 20 minutes"
2. Say: "Block TikTok for 40 minutes"
3. Say: "Block it for longer"
4. Expected: Extends **TikTok** to 60 minutes (uses most recent context)

#### Scenario C: Stop with context
1. Say: "Block social apps for 1 hour"
2. Start session
3. Say: "Stop blocking"
4. Expected: Stops the active session
5. Say: "Do it again"
6. Expected: Restarts "social apps for 1 hour" session

---

## Implementation Details

### Key Files
- `src/modules/ai/conversation-context.js` — Context store and utilities
- `src/modules/ai/nlu/intent-parser.js` — Context-aware parsing
- `src/components/ai/VoiceMicButton.js` — Context updates and clarification UI

### Context Storage
- **Location**: AsyncStorage with key `ai_conversation_context`
- **TTL**: 5 minutes (300,000 ms)
- **Data**: `{ lastAction, lastTarget, lastDurationMinutes, timestamp, lastIntent, lastPlan }`

### Pronoun Resolution
- **Trigger words**: "it", "that", "them", "those", "again"
- **Logic**: Replace pronouns with `context.lastTarget`
- **Special case**: "again" reconstructs full command from `lastIntent`

### Relative Durations
- **"for longer"**: Multiplies last duration by 1.5
- **"add X minutes"**: Adds X to last duration
- **"X more minutes"**: Same as "add X minutes"
- **Fallback**: Defaults to 30 minutes if no context

### Clarification Logic
- **Missing duration**: Prompts with context-aware suggestions
- **Missing target**: Suggests last target + presets
- **No clarification**: Intent is complete and ready to execute

---

## Console Logs to Watch

### Context Updates
```
[ConversationContext] Updated: { action: 'block', target: 'social apps', duration: 30 }
```

### Pronoun Resolution
```
[ConversationContext] Resolved pronoun: Block social apps for longer
```

### Relative Duration
```
[ConversationContext] Resolved "longer": 45 minutes
[ConversationContext] Resolved "add": 40 minutes
```

### Clarification
```
[VoiceMicButton] Needs clarification: For how long?
```

---

## Known Limitations

1. **Single context slot**: Only remembers the last command, not a full history
2. **No multi-target**: "Block social and work apps" not yet supported
3. **Simple duration math**: Doesn't understand "double" or "half"
4. **No personalization**: Doesn't learn user preferences over time
5. **Memory-only**: Context is in-memory + AsyncStorage; not synced across devices

---

## Success Criteria

✅ Pronoun references work reliably  
✅ Relative duration commands apply correctly  
✅ Clarification prompts appear when needed  
✅ Suggestions are contextually relevant  
✅ Context expires after 5 minutes  
✅ No crashes or unexpected behavior  
✅ User feels natural conversation flow  

---

## Next Steps

After Phase 8 is validated:
- **Phase 9**: UI polish and onboarding (voice tutorial, tips, AliasChips)
- **Phase 10**: Testing and rollout (E2E tests, device testing, feature flags)

---

## Troubleshooting

### Context not resolving
- Check console for `[ConversationContext] Updated` after successful commands
- Verify AsyncStorage has `ai_conversation_context` key
- Ensure less than 5 minutes elapsed since last command

### Suggestions not appearing
- Check `needsClarification()` is being called in VoiceMicButton
- Verify `clarification.suggestions` array is not empty
- Look for Alert.alert calls in logs

### Relative duration incorrect
- Check regex patterns in `resolveRelativeDuration()`
- Verify `context.lastDurationMinutes` is saved correctly
- Test with explicit numbers: "add 10 minutes" vs. "add ten minutes"

### Context persisting too long
- Verify TTL is set to 5 minutes (300,000 ms)
- Check `Date.now() - context.timestamp` calculation
- Manually call `clearContext()` to reset if needed
