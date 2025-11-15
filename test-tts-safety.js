// Quick test to verify TTS is disabled in production
// This should be completely safe to run

import { safeSpeech } from '../src/utils/safeSpeech';

console.log('=== TTS Production Safety Test ===');

// Test 1: Check if TTS claims to be available
const isAvailable = safeSpeech.isAvailable();
console.log('TTS Available:', isAvailable);

// Test 2: Try to initialize (should be safe)
const initialized = safeSpeech.initialize();
console.log('TTS Initialized:', initialized);

// Test 3: Try to speak (should be safe no-op)
safeSpeech.speak('Test message').then(result => {
  console.log('TTS Speak Result:', result);
});

console.log('=== Test Complete - No Crashes ===');

export default function TestTTS() {
  return null; // This is just a test script
}