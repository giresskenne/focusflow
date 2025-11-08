# Fix: Focus Session End Notifications (iOS & Expo)

**Goal:** Ensure a local notification fires *reliably* at the end of a focus session even when the app is backgrounded or terminated.  
**Approach:** **Pre-schedule** a local notification at session start using `expo-notifications`, and **cancel/replace** it on pause/stop/extend. Do **not** rely on JS timers to “emit at zero”.

---

## Why this is needed (root cause)
- On iOS, after your app goes to background it quickly becomes **suspended** and **no JS runs**. Any `setTimeout` or “on-zero” callback will not execute in background → no notification is posted.
- Scheduled **local notifications** are delivered by the system **even if the app is suspended or not running**. Your “Reminders” feature works because it already schedules notifications; the session end must do the same.

---

## Implementation Plan (step-by-step)

### 1) Add a notifications helper
Create `src/lib/notifications.ts`:

```ts
// src/lib/notifications.ts
import * as Notifications from 'expo-notifications';

export async function ensureNotifPerms() {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

// Schedules a one-off notification to fire exactly at the given Date
export async function scheduleAt(endAt: Date, opts: { title: string; body?: string; sound?: boolean } ) {
  await ensureNotifPerms();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body ?? '',
      sound: opts.sound ?? true,
    },
    trigger: { date: endAt }, // ← critical: schedule at start; iOS will deliver even if app is suspended
  });
}

export async function cancelScheduled(id?: string | null) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}
```

> If your project uses JS instead of TS, rename to `.js` and remove types.

---

### 2) Enable foreground delivery (optional but recommended)
When the app is **open**, iOS suppresses banners by default. Add a handler **once** (e.g., in `App.(tsx|js)`):

```ts
// App.tsx (top-level)
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

---

### 3) Wire into session lifecycle
Where you start/pause/cancel/extend a session (e.g., `src/screens/ActiveSessionScreen.tsx` or your timer logic), **persist the scheduled notification id** so you can cancel/replace it.

```ts
// Example session component wiring
import React from 'react';
import { scheduleAt, cancelScheduled } from '@/lib/notifications';

export function useSessionNotifications() {
  const notifIdRef = React.useRef<string | null>(null);

  const scheduleEnd = async (endAt: Date) => {
    // Replace any previous schedule (e.g., user restarts)
    await cancelScheduled(notifIdRef.current);
    notifIdRef.current = await scheduleAt(endAt, {
      title: 'Focus complete',
      body: 'Nice work — your session just ended.',
      sound: true,
    });
  };

  const clearEnd = async () => {
    await cancelScheduled(notifIdRef.current);
    notifIdRef.current = null;
  };

  return { scheduleEnd, clearEnd };
}
```

**Start session:**
```ts
const { scheduleEnd, clearEnd } = useSessionNotifications();

async function onStartSession(minutes: number) {
  const endAt = new Date(Date.now() + minutes * 60_000);
  await scheduleEnd(endAt);
  // …start your visible countdown UI, analytics, etc.
}
```

**Pause/Resume session:**
```ts
async function onPauseSession() {
  await clearEnd(); // user paused → cancel pending notification
  // …pause UI timer
}

async function onResumeSession(remainingMs: number) {
  const endAt = new Date(Date.now() + remainingMs);
  await scheduleEnd(endAt);
}
```

**Cancel/Stop session early:**
```ts
async function onCancelSession() {
  await clearEnd(); // no notification should fire if user stops early
}
```

**Extend session:**
```ts
async function onExtendSession(extraMinutes: number, previousEndAt: Date) {
  const newEndAt = new Date(previousEndAt.getTime() + extraMinutes * 60_000);
  await scheduleEnd(newEndAt); // replace existing schedule
}
```

> **State persistence:** If the session screen can unmount while running, persist the `notifId` and `endAt` in your store (Redux/Zustand/AsyncStorage) so a new component instance can still cancel/replace the schedule.

---

### 4) Expo config (managed workflow)
Ensure `expo-notifications` is configured so iOS capabilities are included at build time.

`app.json` (or `app.config.ts`):
```jsonc
{
  "expo": {
    "plugins": [
      ["expo-notifications", {
        "icon": "./assets/notification-icon.png",
        "color": "#0072ff"
      }]
    ],
    "ios": {
      "bundleIdentifier": "com.giress.focusflow-app"
    },
    "android": {
      "package": "com.giress.focusflowapp"
    }
  }
}
```

> No background modes are required for **local** end-of-session notifications. Remote/background pushes are unrelated here.

---

### 5) iOS Screen Time (FamilyControls/DeviceActivity) note
If/when your session timing is backed by Screen Time APIs, you still **pre-schedule** a UNUserNotificationCenter notification for the known end time **or** post a notification from your Device Activity extension when end/threshold events fire. The React Native app should not depend on a JS callback at end-time while backgrounded.

---

## Edge Cases & Gotchas
- **App killed / device rebooted:** iOS persists scheduled local notifications and will still deliver them.
- **Time changes:** If the user changes system time, iOS uses the scheduled absolute date; use interval triggers only if appropriate.
- **Do not double-fire:** Always cancel/replace the prior schedule on pause/extend/stop.
- **Foreground behavior:** Without the `setNotificationHandler`, alerts won’t show while the app is open.
- **Android parity:** The above also works on Android with Expo; ensure the channel is created for sound/importance if you need custom behavior.

---

## QA / Acceptance Tests

1. **Background delivery**
   - Start a 1‑minute session.
   - Immediately background the app.
   - ✅ Expect a notification at ~1 minute with title “Focus complete”.

2. **Foreground delivery**
   - Start a 1‑minute session and keep the app open.
   - ✅ With `setNotificationHandler`, an in‑app alert is shown at end.

3. **Pause/Resume**
   - Start 5‑minute session; pause at 4:00.
   - Wait past the original end time; ✅ no notification.
   - Resume for remaining time; ✅ notification fires at the new end.

4. **Cancel/Stop**
   - Start session; then cancel it.
   - ✅ No notification should appear.

5. **Extend**
   - Start 2‑minute session; extend by 1 minute.
   - ✅ Notification fires at (start + 3 minutes).

6. **Cold-start**
   - Start 1‑minute session; kill the app.
   - ✅ Notification still delivers at end time.

---

## File/Code Touchpoints (suggested)
- `src/lib/notifications.ts` **(new)**
- `App.(tsx|js)` → add `Notifications.setNotificationHandler(...)`
- `src/screens/ActiveSessionScreen.(tsx|js)` or wherever session state lives:
  - Call `scheduleEnd(endAt)` on start/resume/extend
  - Call `clearEnd()` on pause/stop/cancel
  - Persist `notifId`/`endAt` if component can unmount

---

## References (official docs)
- Expo Notifications – Scheduling & handling  
  - https://docs.expo.dev/versions/latest/sdk/notifications/
  - https://docs.expo.dev/push-notifications/overview/
- Apple app lifecycle & suspension  
  - https://developer.apple.com/documentation/uikit/app_and_environment/managing_your_app_s_life_cycle
- Apple UserNotifications (local notifications)  
  - https://developer.apple.com/documentation/usernotifications
- React (effects/state)  
  - https://react.dev/learn

---

**Replace any “emit notification when timer ends” logic with a scheduled local notification created at session start, and cancel/replace that schedule on pause/stop/extend; add a global foreground notification handler; verify in QA above.**
