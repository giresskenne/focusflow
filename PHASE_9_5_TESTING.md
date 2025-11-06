# Phase 9.5: Toast & Undo Testing Guide

## 🎯 What We're Testing

Phase 9.5 implemented:
1. Toast notification system (non-blocking UI)
2. Reminder undo (cancel notification + storage)
3. Session undo with grace period (4-second window)

---

## 📱 Setup

### Prerequisites
- ✅ Development server running (`npm start`)
- ✅ Physical iOS device OR simulator (iOS 16+)
- ✅ Microphone permissions granted
- ✅ Notification permissions granted
- ✅ OpenAI API key configured in `.env`

### Launch App
1. Scan QR code with Expo Go OR
2. Press `i` to open iOS simulator OR
3. Open development build on physical device

---

## 🧪 Test Cases

### Test 1: Toast Appears (Basic Functionality)
**Goal:** Verify toast notifications appear and auto-dismiss

**Steps:**
1. Open app → Navigate to Home screen
2. Tap voice microphone button (FAB)
3. Say: "Remind me to test in 5 minutes"
4. Tap "Set Reminder" in confirmation dialog

**Expected:**
- ✅ Toast slides in from bottom with message: "I'll remind you to test in 5 minutes. Notification set for [time]."
- ✅ Toast has green success icon (✓)
- ✅ Toast shows "Undo" button
- ✅ Toast auto-dismisses after ~4 seconds
- ❌ NO blocking Alert dialog after confirmation

**Pass/Fail:** ___________

---

### Test 2: Reminder Undo (Within Grace Period)
**Goal:** Verify reminder can be cancelled within 4 seconds

**Steps:**
1. Tap voice button
2. Say: "Remind me to exercise in 10 minutes"
3. Tap "Set Reminder"
4. **Immediately** tap "Undo" button on toast (within 4 seconds)

**Expected:**
- ✅ First toast appears: "I'll remind you to exercise..."
- ✅ Second toast appears: "Reminder cancelled"
- ✅ Go to Reminders screen → reminder is NOT in list
- ✅ In 10 minutes → NO notification appears
- ✅ Check notification center → no scheduled notification

**Pass/Fail:** ___________

---

### Test 3: Reminder Persists (After Grace Period)
**Goal:** Verify reminder stays if undo not tapped

**Steps:**
1. Tap voice button
2. Say: "Remind me to check emails in 2 minutes"
3. Tap "Set Reminder"
4. **Wait** for toast to auto-dismiss (don't tap undo)
5. Wait 2 minutes

**Expected:**
- ✅ Toast appears and auto-dismisses
- ✅ Go to Reminders screen → reminder IS in list
- ✅ After 2 minutes → notification appears
- ✅ Notification content: "Time to check emails!"

**Pass/Fail:** ___________

---

### Test 4: Session Undo (Grace Period)
**Goal:** Verify blocking session can be cancelled within 4 seconds

**Steps:**
1. Tap voice button
2. Say: "Block Instagram for 30 minutes"
3. Tap "OK" in confirmation dialog
4. **Immediately** tap "Undo" on toast (within 4 seconds)

**Expected:**
- ✅ ActiveSession screen appears briefly
- ✅ Toast shows: "Instagram blocked for 30 minutes" with "Undo" button
- ✅ Tap Undo → navigates back to Home screen
- ✅ Toast shows: "Session cancelled"
- ✅ Try opening Instagram → NOT blocked (apps work normally)
- ✅ No active session in app

**Pass/Fail:** ___________

---

### Test 5: Session Persists (After Grace Period)
**Goal:** Verify session commits after 4 seconds (unbreakable focus)

**Steps:**
1. Tap voice button
2. Say: "Block social media for 30 minutes"
3. Tap "OK"
4. **Wait** for toast to auto-dismiss (don't tap undo)
5. Try opening Instagram/Facebook/etc.

**Expected:**
- ✅ Toast appears and auto-dismisses after 4s
- ✅ Stays on ActiveSession screen
- ✅ Countdown timer running
- ✅ Try opening blocked apps → Shield blocks them
- ✅ "Undo" button no longer visible (grace period expired)
- ✅ Must use manual "End Session" button to stop

**Pass/Fail:** ___________

---

### Test 6: Error Toasts (Non-Blocking)
**Goal:** Verify error messages use toast instead of Alert

**Steps:**
1. Turn OFF microphone permission in iOS Settings
2. Tap voice button

**Expected:**
- ✅ Toast appears (NOT Alert): "Microphone permission may be required..."
- ✅ Toast has red error icon (✗)
- ✅ Toast is dismissible
- ✅ App remains usable (non-blocking)

**Restore:** Turn microphone permission back ON

**Pass/Fail:** ___________

---

### Test 7: Multiple Toasts (Replace, Don't Stack)
**Goal:** Verify new toast replaces old one

**Steps:**
1. Tap voice button
2. Say: "Remind me to test 1 in 5 minutes"
3. Tap "Set Reminder"
4. **Immediately** tap voice button again
5. Say: "Remind me to test 2 in 10 minutes"
6. Tap "Set Reminder"

**Expected:**
- ✅ First toast appears
- ✅ Second toast REPLACES first (doesn't stack)
- ✅ Only ONE toast visible at a time
- ✅ No toast overlap or UI glitches

**Pass/Fail:** ___________

---

### Test 8: Toast During Navigation
**Goal:** Verify toast persists across screens

**Steps:**
1. On Home screen
2. Tap voice button
3. Say: "Remind me to navigate test in 5 minutes"
4. Tap "Set Reminder"
5. **While toast is visible**, navigate to Settings screen

**Expected:**
- ✅ Toast appears on Home
- ✅ Toast remains visible during navigation
- ✅ Toast visible on Settings screen
- ✅ Toast auto-dismisses normally
- ✅ No visual glitches

**Pass/Fail:** ___________

---

### Test 9: TTS with Toast (No Interference)
**Goal:** Verify Text-to-Speech works with toast

**Steps:**
1. Enable TTS in Settings (if not already on)
2. Tap voice button
3. Say: "Remind me to TTS test in 5 minutes"
4. Tap "Set Reminder"

**Expected:**
- ✅ Mada speaks: "I'll remind you to TTS test in 5 minutes"
- ✅ Toast appears simultaneously
- ✅ TTS completes without interruption
- ✅ Toast dismisses independently

**Pass/Fail:** ___________

---

### Test 10: Rapid Undo Attempts
**Goal:** Verify undo is idempotent (safe to tap multiple times)

**Steps:**
1. Tap voice button
2. Say: "Remind me to rapid test in 5 minutes"
3. Tap "Set Reminder"
4. **Rapidly** tap "Undo" button 3-4 times

**Expected:**
- ✅ First undo works: "Reminder cancelled"
- ✅ Subsequent taps do nothing (no errors)
- ✅ No crash or console errors
- ✅ App remains stable

**Pass/Fail:** ___________

---

## 🐛 Known Issues / Edge Cases

### Issue 1: Toast Timing
- **Symptom:** Grace period feels too short/long
- **Fix:** Adjust `duration` parameter in toast options
- **Location:** `VoiceMicButton.js` line ~430

### Issue 2: Navigation Race Condition
- **Symptom:** Undo doesn't navigate back properly
- **Fix:** Ensure `navigation.reset()` completes
- **Location:** `undoBlockingSession()` function

### Issue 3: Notification Permission
- **Symptom:** Undo fails silently for reminders
- **Fix:** Check notification permission before undo
- **Location:** `undoReminder()` function

---

## 📊 Success Criteria

**Phase 9.5 is successful if:**
- [ ] All 10 test cases pass
- [ ] No crashes or console errors
- [ ] Toast animations smooth (60fps)
- [ ] Grace period timing feels natural (~4s)
- [ ] Undo works reliably for reminders
- [ ] Undo works within grace period for sessions
- [ ] No blocking Alert dialogs for success/error messages
- [ ] App remains responsive during toast display

---

## 🔍 Console Logs to Monitor

While testing, watch for these logs:

**Success:**
```
[VoiceMicButton] Undoing reminder: <reminderId>
[VoiceMicButton] Cancelled notification: <notificationId>
[VoiceMicButton] Deleted reminder: <reminderId>
```

**Session Undo:**
```
[VoiceMicButton] Undoing session - grace period cancellation
[VoiceMicButton] Stopped monitoring
[VoiceMicButton] Unblocked selection
[VoiceMicButton] Removed shield
[VoiceMicButton] Cleared session storage
```

**Errors (should NOT appear):**
```
❌ Failed to undo reminder
❌ Failed to undo session
❌ Could not cancel session
```

---

## 📝 Testing Notes

**Device:** _________________  
**iOS Version:** _________________  
**Date:** _________________  
**Tester:** _________________  

**Overall Pass/Fail:** ___________

**Additional Comments:**
_____________________________________
_____________________________________
_____________________________________

---

## 🚀 Next Steps After Testing

If all tests pass:
1. ✅ Mark Phase 9.5 as production-ready
2. Move to Phase 10 (Testing & Rollout)
3. Consider user beta testing

If tests fail:
1. Document failures in this file
2. Create GitHub issues for bugs
3. Fix critical issues before proceeding
4. Re-test after fixes

---

**Generated:** November 5, 2025  
**Phase:** 9.5 - Non-Blocking Toast & Undo  
**Status:** Ready for Testing
