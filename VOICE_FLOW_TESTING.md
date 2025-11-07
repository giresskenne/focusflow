# Voice Flow Test Suite

## Purpose
Automated tests to catch voice command mismatches and prevent regressions.

## Issues Addressed

### 1. Double Parsing
**Problem:** Commands like "Block Facebook for 2 minutes" were being parsed twice, causing:
- Double voice responses
- Double API calls
- Inaccurate telemetry

**Test:** `should not trigger duplicate parses/executions`

### 2. Incomplete Utterance Parsing
**Problem:** iOS sends `final: true` for incomplete utterances like "Block Facebook for"
**Fix:** Added validation to wait for complete commands
**Tests:**
- `should not trigger on incomplete utterances: "Block Facebook for"`
- `should not trigger on incomplete reminders: "Remind me to"`

### 3. Reminder Misparsing
**Problem:** "Remind me to..." was being parsed as `action: "stop"` instead of `action: "remind"`
**Fix:** intent-parser.js checks for reminder keywords early
**Test:** `ISSUE: Should not parse reminder as "stop" action`

### 4. Reminder → App Picker Flow
**Problem:** Reminder commands were opening app picker (wrong flow)
**Root Cause:** Reminder parsed as `action: "block"` instead of `action: "remind"`
**Test:** `ISSUE: "Remind me to ..." should NOT ask to pick an app`

## Running Tests

### Prerequisites
```bash
npm install --save-dev jest @testing-library/react-native
```

### Run All Tests
```bash
npm test src/modules/ai/__tests__/voice-flow.test.js
```

### Run Specific Test Suite
```bash
npm test -- --testNamePattern="Block Commands"
npm test -- --testNamePattern="Reminder Commands"
npm test -- --testNamePattern="Mismatch Prevention"
```

### Watch Mode (Development)
```bash
npm test -- --watch src/modules/ai/__tests__/voice-flow.test.js
```

## Test Categories

### 1. Block Commands
- Complete commands with duration
- Incomplete commands (validation)
- Various duration formats

### 2. Reminder Commands
- One-time reminders
- Daily/weekly reminders
- Incomplete reminders
- Misparsing prevention

### 3. Stop Commands
- Simple stop commands
- Alternative phrasings

### 4. Hybrid System Integration
- Confidence scoring
- Local vs cloud routing
- Metadata validation

### 5. Edge Cases
- Empty input
- Single words
- Whitespace

### 6. STT Flow Validation
- Incomplete utterance detection
- Complete utterance triggers
- Word count thresholds

### 7. Duplicate Detection
- Exact duplicate prevention
- Similar utterance handling

### 8. Mismatch Prevention
- Regression tests for known issues
- Flow validation

## Test Structure

```javascript
describe('Test Category', () => {
  test('should do something specific', async () => {
    const result = await parseIntent('command text');
    
    expect(result).toMatchObject({
      action: 'expected_action',
      // ... other expectations
    });
  });
});
```

## Adding New Tests

When you encounter a new voice command mismatch:

1. **Document the issue:**
   ```javascript
   test('ISSUE: Description of problem', async () => {
     // Test implementation
   });
   ```

2. **Test the expected behavior:**
   ```javascript
   expect(result.action).toBe('correct_action');
   expect(result.action).not.toBe('wrong_action');
   ```

3. **Add to Mismatch Prevention suite:**
   - Helps prevent regressions
   - Documents known issues
   - Validates fixes

## Continuous Integration

Add to CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Voice Flow Tests
  run: npm test src/modules/ai/__tests__/voice-flow.test.js
```

## Coverage Goals

- ✅ Block commands: 90%+
- ✅ Reminder commands: 90%+
- ✅ Stop commands: 100%
- ✅ Edge cases: 80%+
- ✅ Known mismatches: 100%

## Manual Testing Checklist

After code changes, manually test:

1. **Block Commands:**
   - [ ] "Block Instagram for 30 minutes"
   - [ ] "Block social media for 1 hour"
   - [ ] "Block Facebook for 2 min"

2. **Reminder Commands:**
   - [ ] "Remind me to drink water in 10 minutes"
   - [ ] "Remind me to call mom tomorrow at 9am"
   - [ ] "Reminder to exercise daily at 7am"

3. **Stop Commands:**
   - [ ] "Stop"
   - [ ] "End session"

4. **Verify:**
   - [ ] Single voice response (no duplicates)
   - [ ] Correct action detected
   - [ ] No unwanted modals/prompts
   - [ ] Telemetry accurate

## Current Known Issues

### ✅ Fixed
- ~~Double voice responses~~
- ~~STT audio session errors~~
- ~~Incomplete utterance parsing~~

### ⚠️ Testing Required
- Duration clarification flow
- Reminder confirmation flow
- App picker for new aliases

### 📝 Future Tests
- Multi-language support
- Voice accent variations
- Background noise handling
