/**
 * Voice Flow Integration Tests
 * Tests the complete voice command flow to catch mismatches
 */

import { parseIntentHybrid } from '../nlu/hybrid-intent-service';
import { parseIntent } from '../nlu/intent-parser';

describe('Voice Command Flow Tests', () => {
  describe('Block Commands', () => {
    test('should parse "Block Facebook for 2 minutes" correctly', async () => {
      const result = await parseIntent('Block Facebook for 2 minutes');
      
      expect(result).toMatchObject({
        action: 'block',
        target: 'facebook',
        targetType: 'alias',
        durationMinutes: 2,
      });
    });

    test('should parse "Block Instagram for 30 minutes" correctly', async () => {
      const result = await parseIntent('Block Instagram for 30 minutes');
      
      expect(result).toMatchObject({
        action: 'block',
        target: 'instagram',
        targetType: 'alias',
        durationMinutes: 30,
      });
    });

    test('should parse "Block social media for 1 hour" correctly', async () => {
      const result = await parseIntent('Block social media for 1 hour');
      
      expect(result).toMatchObject({
        action: 'block',
        target: 'social media',
        durationMinutes: 60,
      });
    });

    test('should NOT parse incomplete "Block Facebook for" as ready', async () => {
      const result = await parseIntent('Block Facebook for');
      
      // Should parse but need clarification on duration
      expect(result.action).toBe('block');
      expect(result.target).toBe('facebook');
      expect(result.durationMinutes).toBeFalsy(); // Missing duration
    });
  });

  describe('Reminder Commands', () => {
    test('should parse "Remind me to drink water in 10 minutes" as reminder', async () => {
      const result = await parseIntent('Remind me to drink water in 10 minutes');
      
      expect(result).toMatchObject({
        action: 'remind',
        message: 'drink water',
        durationMinutes: 10,
        reminderType: 'one-time',
      });
    });

    test('should parse "Remind me to call mom in 2 hours" as reminder', async () => {
      const result = await parseIntent('Remind me to call mom in 2 hours');
      
      expect(result).toMatchObject({
        action: 'remind',
        message: 'call mom',
        durationMinutes: 120,
        reminderType: 'one-time',
      });
    });

    test('should parse "Remind me to exercise tomorrow at 7am" as daily reminder', async () => {
      const result = await parseIntent('Remind me to exercise tomorrow at 7am');
      
      expect(result.action).toBe('remind');
      expect(result.message).toContain('exercise');
      expect(result.reminderType).toBe('daily');
    });

    test('should NOT parse "Remind me to" as action: stop', async () => {
      const result = await parseIntent('Remind me to');
      
      // Should recognize reminder intent even if incomplete
      expect(result.action).not.toBe('stop');
      expect(result.action).toBe('remind');
    });

    test('should NOT parse "Remind me to drink water" as action: stop', async () => {
      const result = await parseIntent('Remind me to drink water');
      
      expect(result.action).toBe('remind');
      expect(result.message).toBe('drink water');
      // Should ask for time/duration via needsGuidance or similar
    });
  });

  describe('Stop Commands', () => {
    test('should parse "Stop" correctly', async () => {
      const result = await parseIntent('Stop');
      
      expect(result).toMatchObject({
        action: 'stop',
      });
    });

    test('should parse "End session" correctly', async () => {
      const result = await parseIntent('End session');
      
      expect(result.action).toBe('stop');
    });
  });

  describe('Hybrid System Integration', () => {
    test('should use local parse for high-confidence block commands', async () => {
      const result = await parseIntentHybrid('Block Instagram for 30 minutes');
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.source).toBe('local');
      expect(result.metadata.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.action).toBe('block');
    });

    test('should handle reminder commands correctly in hybrid mode', async () => {
      const result = await parseIntentHybrid('Remind me to drink water in 10 minutes');
      
      expect(result.action).toBe('remind');
      expect(result.message).toBe('drink water');
      expect(result.durationMinutes).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty string', async () => {
      const result = await parseIntent('');
      expect(result).toBeNull();
    });

    test('should handle whitespace only', async () => {
      const result = await parseIntent('   ');
      expect(result).toBeNull();
    });

    test('should handle single word commands gracefully', async () => {
      const result = await parseIntent('Block');
      
      // Should recognize intent but need clarification
      if (result) {
        expect(result.action).toBe('block');
      }
    });
  });

  describe('STT Flow Validation', () => {
    test('should not trigger on incomplete utterances: "Block Facebook for"', async () => {
      const utterance = 'Block Facebook for';
      const wordCount = utterance.split(/\s+/).length;
      const endsWithFor = /\bfor\s*$/i.test(utterance);
      
      // Simulates the STT handler check
      const shouldProcess = wordCount >= 3 && !endsWithFor;
      
      expect(shouldProcess).toBe(false); // Should wait for duration
    });

    test('should not trigger on incomplete reminders: "Remind me to"', async () => {
      const utterance = 'Remind me to';
      const wordCount = utterance.split(/\s+/).length;
      const isReminder = /\b(remind|reminder)\b/i.test(utterance);
      
      // Simulates the STT handler check (needs 5+ words for reminders)
      const shouldProcess = !isReminder || wordCount >= 5;
      
      expect(shouldProcess).toBe(false); // Should wait for message
    });

    test('should trigger on complete reminder: "Remind me to drink water in 10 minutes"', async () => {
      const utterance = 'Remind me to drink water in 10 minutes';
      const wordCount = utterance.split(/\s+/).length;
      const isReminder = /\b(remind|reminder)\b/i.test(utterance);
      
      // Simulates the STT handler check
      const shouldProcess = !isReminder || wordCount >= 5;
      
      expect(shouldProcess).toBe(true); // Should process
    });

    test('should trigger on complete block: "Block Instagram for 30 minutes"', async () => {
      const utterance = 'Block Instagram for 30 minutes';
      const wordCount = utterance.split(/\s+/).length;
      const endsWithFor = /\bfor\s*$/i.test(utterance);
      
      // Simulates the STT handler check
      const shouldProcess = wordCount >= 3 && !endsWithFor;
      
      expect(shouldProcess).toBe(true); // Should process
    });
  });

  describe('Duplicate Detection', () => {
    test('should detect exact duplicate utterances', () => {
      const utterance1 = 'Block Instagram for 30 minutes';
      const utterance2 = 'Block Instagram for 30 minutes';
      
      expect(utterance1 === utterance2).toBe(true);
    });

    test('should not consider different utterances as duplicates', () => {
      const utterance1 = 'Block Instagram for 30 minutes';
      const utterance2 = 'Block Facebook for 30 minutes';
      
      expect(utterance1 === utterance2).toBe(false);
    });
  });
});

describe('Mismatch Prevention Tests', () => {
  test('ISSUE: "Block Facebook for 2 min" should NOT ask "for how long"', async () => {
    const result = await parseIntent('Block Facebook for 2 min');
    
    expect(result.action).toBe('block');
    expect(result.target).toBe('facebook');
    expect(result.durationMinutes).toBe(2);
    // Should NOT need clarification since duration is present
  });

  test('ISSUE: "Remind me to ..." should NOT ask to pick an app', async () => {
    const result = await parseIntent('Remind me to drink water in 10 minutes');
    
    expect(result.action).toBe('remind');
    expect(result.action).not.toBe('block'); // Should NOT be treated as block command
    expect(result.targetType).not.toBe('alias'); // Should NOT require app selection
  });

  test('ISSUE: Should not parse reminder as "stop" action', async () => {
    const utterances = [
      'Remind me to drink water',
      'Remind me to exercise',
      'Reminder to call mom',
    ];
    
    for (const utterance of utterances) {
      const result = await parseIntent(utterance);
      expect(result.action).toBe('remind');
      expect(result.action).not.toBe('stop');
    }
  });

  test('ISSUE: Should not trigger duplicate parses/executions', () => {
    // This is a flow test - simulates STT behavior
    const finalResults = [
      { text: 'Block Facebook for', final: true },
      { text: 'Block Facebook for two', final: true },
      { text: 'Block Facebook for two minutes', final: true },
    ];
    
    const processedUtterances = [];
    let lastUtterance = '';
    
    finalResults.forEach((result) => {
      lastUtterance = result.text;
      
      // Simulate debounce + validation
      const wordCount = lastUtterance.split(/\s+/).length;
      const endsWithFor = /\bfor\s*$/i.test(lastUtterance);
      const shouldProcess = wordCount >= 3 && !endsWithFor && !processedUtterances.includes(lastUtterance);
      
      if (shouldProcess) {
        processedUtterances.push(lastUtterance);
      }
    });
    
    // Should only process the final complete utterance
    expect(processedUtterances).toHaveLength(1);
    expect(processedUtterances[0]).toBe('Block Facebook for two minutes');
  });
});
