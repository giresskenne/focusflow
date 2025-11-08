# Background Notification & Auto-Unblock Reliability Fix

## Problem (Original)
Focus session end notifications were not appearing in foreground OR background, despite being scheduled correctly. Logs showed notifications scheduled but never delivered.

## Problem (Follow-up)
After fixing notification presentation, short sessions (<5m) still required foregrounding the app for Screen Time unblocking because DeviceActivity monitoring refinement was rejected by iOS ("The activity’s schedule is too short"). Multiple refinement attempts risked interrupting the long monitoring window.

## Root Cause
**expo-notifications bug with absolute date triggers in foreground:**
- When scheduling with `{ date: new Date(...) }` trigger in foreground
- Expo fires the `NotificationReceivedListener` **immediately upon scheduling**
- The listener is never fired again at the actual trigger time
- Result: No notification shown to user

This bug doesn't affect reminders because:
1. Reminders are typically scheduled from background/inactive states
2. The immediate callback happens but app isn't listening yet

## Solution Part 1: Use Time Interval Triggers

Switched from absolute date to time interval trigger:

```javascript
// ❌ Before (absolute date - buggy in foreground)
const trigger = Platform.OS === 'ios'
  ? { date: new Date(notificationTime) }
  : { seconds: secondsUntilFire, repeats: false };

// ✅ After (time interval - works everywhere)
const trigger = { seconds: secondsUntilFire, repeats: false };
```

### Key Changes

1. **Time Interval Trigger**:
   - Works reliably in foreground, background, and killed states
   - Expo handles countdown even when JS suspended
   - No early firing bug

2. **Exact Timing** (no buffer):
   ```javascript
   const notificationTime = sessionStartTime + (durationSeconds * 1000);
   // No +1s buffer - fire exactly at session end
   ```

3. **Removed EARLY Suppression** from listener:
   - Let all receive events log for debugging
   - App.js handler controls actual presentation
   - Handler checks timing and suppresses if >2s early

## Solution Part 2: Dual Scheduling + Safe Monitoring Window

1. Primary notification: interval trigger for reliable foreground timing.
2. Backup notification (background only): absolute date trigger `{ type: 'date', date: intendedAt }` scheduled when app backgrounds (mirrors reminder reliability).
3. Foreground fallbacks: immediate notification at end if banner missing (`trigger: null`, `isFallback: true`).
4. Post-end verification: 5s later, schedule secondary fallback only if still missing.
5. Stale cleanup: dismiss focus-end notifications only when >15s past intended fire to avoid killing fresh banners.
6. Monitoring refinement (auto-unblock attempt): single refine only if ≥300s remain; never stop monitoring before confirming success. If refine fails, restore long (≥30m) window.

## Solution Part 3: Auto-Unblock Reliability Changes

| Concern | Previous Behavior | Updated Behavior |
|---------|-------------------|------------------|
| Too-short refine | Repeated stop/start attempts | Skip refine if remaining <300s |
| Multiple retries | Many attempts on state changes | Single successful refine (guard flag) |
| Failure recovery | Possible loss of long window | Restore long window if refine fails |
| Short sessions | Forced refine even at 1–2 min | Keep long window; unblock via JS completion |

## Testing Checklist

- [ ] **Foreground**: Notification appears when timer hits zero
- [ ] **Background**: Notification appears while app suspended
- [ ] **Killed**: Notification still fires after force-quit
- [ ] **Resume**: No duplicates when returning to app

## Technical Details

### Why Time Intervals Work Better

| Trigger Type | Foreground | Background | Killed |
|--------------|-----------|------------|--------|
| Absolute Date (legacy primary) | ❌ Early receive bug | ✅ Historically reliable | ✅ |
| Interval (current primary) | ✅ Stable | ✅ (date backup added) | ⚠️ May miss if app force-killed* |
| Date Backup (secondary) | N/A (foreground skipped) | ✅ Supports suspended delivery | ✅ |

\* Time intervals may not fire if app is killed, but focus sessions auto-complete on reopen anyway.

### Notification Metadata (Extended)
```javascript
data: { 
  type: 'focus-end', 
  intendedAt: notificationTime,
  sessionStartTime,
  durationSeconds,
}
```

### App.js Handler (Early Suppression + Fallback Awareness)
```javascript
// Suppresses if >2s early (handles race conditions)
const premature = shouldCheckPremature && now < (intendedAt - 2000);
return {
  shouldShowBanner: !premature,
  shouldPlaySound: !premature,
};
```

## Why This Failed Before (Recap)

1. **Scheduled**: Notification with absolute date trigger
2. **Immediate Callback**: Expo fires listener at schedule time
3. **Suppression**: We logged it as "EARLY" and ignored it
4. **Never Fires Again**: Bug means it won't fire at actual trigger time
5. **Result**: No notification ever shown

## Why This Works Now (Expanded)
Layered redundancy: interval trigger + date backup + foreground fallback + post-end verification ensure presentation. Monitoring refinement is conditional and safe, preserving blocking. Long sessions auto-unblock via refined monitoring; short sessions unblock via JS completion when user foregrounds or at timer end.

1. **Scheduled**: Notification with time interval trigger
2. **No Immediate Callback**: Expo waits for countdown
3. **Timer Completes**: Fires listener at correct time
4. **Handler Allows**: Not premature, shows banner
5. **Result**: Notification appears ✅

## No Rebuild Needed (Notifications & Fallback Logic)

Notification + fallback changes are JS-only. For Screen Time blocking refinements you still need a dev build (not Expo Go) because `react-native-device-activity` is native. To apply JS updates:
```bash
npx expo start -c  # Clear cache if needed
# Press 'r' in terminal to reload
```

## Rollback / Forward Plans

Rollback (notification reliability):
1. Revert to absolute date trigger as primary
2. Add guard to ignore immediate scheduling callback (track scheduling timestamp)

Forward Enhancements (optional):
1. Server push fallback at session end
2. Adaptive stale-dismiss threshold (increase to 30s after duplicate monitoring)
3. Telemetry: capture intendedAt vs delivered delta and fallback path used
4. Background service extension (native) for ultra-short session auto-unblock

## Files Modified (Recent Notification & Blocking Reliability Work)

### Core
- `src/screens/ActiveSessionScreen.js`: interval + date backup; fallback + verification; monitoring refinement guards; stale cleanup
- `App.js`: early suppression logic (skip for `isFallback`)

### Documentation
- `BACKGROUND_NOTIFICATION_FIX.md`: expanded with dual scheduling + auto-unblock notes

### Remaining Considerations
- Consider raising stale dismissal window to 30s if duplicates rare
- Optional APNs/server fallback only if release build reveals gaps
- Short-session (<5m) auto-unblock limited by iOS schedule constraints (expected)

---
Last Updated: Nov 7, 2025
---
