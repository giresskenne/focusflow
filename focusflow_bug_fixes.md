# FocusFlow: Critical Bug Fixes

## Bug Summary
1. ✅ Notification appearing at session START instead of END
2. ✅ EXC_BAD_ACCESS crash in DeviceActivity observer
3. ✅ Memory management issues with CFNotificationCenter

---

## Bug #1: Notification Timing Issue

### Problem
"Focus Session Complete!" notification appears immediately when session starts (at 29:58) instead of after 30 minutes.

### Root Cause
Notification trigger set to `null` or `0`, causing immediate delivery per Expo docs:
> "If the date is in the past, the notification will be delivered immediately."

**Source:** https://docs.expo.dev/versions/latest/sdk/notifications/#timeintervaltriggerinput

### Fix
```typescript
// ❌ WRONG - Current implementation
trigger: null  // Immediate delivery

// ✅ CORRECT - Fixed implementation
trigger: {
  seconds: durationMinutes * 60,  // Future delivery
  repeats: false
}
```

**Complete Implementation:**
```typescript
import * as Notifications from 'expo-notifications';

export const scheduleSessionEndNotification = async (
  durationMinutes: number
): Promise<string> => {
  const durationSeconds = durationMinutes * 60;
  
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Focus Session Complete! 🎯",
      body: `Your ${durationMinutes} minute focus session is finished.`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      seconds: durationSeconds,  // Key fix
      repeats: false
    }
  });
  
  return notificationId;
};
```

**Apple Reference:**
> "The time interval must be greater than 0. For non-repeating triggers, it represents the number of seconds after the current time."

**Source:** https://developer.apple.com/documentation/usernotifications/untimeintervalnotificationtrigger

---

## Bug #2: Memory Management Crash

### Problem
```
Thread 1: EXC_BAD_ACCESS (code=2, address=0x27c489b10)
Location: NativeEventObserver.registerListener(name:) line 217
```

### Root Cause
Using `Unmanaged.fromOpaque().takeUnretainedValue()` without safety checks creates dangling pointer when observer is deallocated while DeviceActivity callbacks are active.

**Apple Quote:**
> "Extensions run in a separate process from the containing app. They don't have access to the app's memory space."

**Source:** https://developer.apple.com/documentation/app_extensions/creating_an_app_extension

### Fix: Thread-Safe Observer Pattern

```swift
import Foundation
import DeviceActivity
import React

@available(iOS 16.0, *)
class NativeEventObserver {
    private weak var eventEmitter: RCTEventEmitter?
    private let queue = DispatchQueue(label: "com.focusflow.observer")
    
    init(eventEmitter: RCTEventEmitter) {
        self.eventEmitter = eventEmitter
    }
    
    func registerListener(name: CFNotificationName) {
        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            Unmanaged.passUnretained(self).toOpaque(),
            { (center, observer, name, object, userInfo) in
                guard let observer = observer,
                      let name = name else { return }
                
                let instance = Unmanaged<NativeEventObserver>
                    .fromOpaque(observer)
                    .takeUnretainedValue()
                
                // Safety: Execute on main thread
                DispatchQueue.main.async { [weak instance] in
                    guard let instance = instance,
                          let emitter = instance.eventEmitter else { return }
                    
                    emitter.sendEvent(
                        withName: "onDeviceActivityMonitorEvent",
                        body: ["callbackName": name as String]
                    )
                }
            },
            name.rawValue as CFString,
            nil,
            .deliverImmediately
        )
    }
    
    deinit {
        CFNotificationCenterRemoveEveryObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            Unmanaged.passUnretained(self).toOpaque()
        )
    }
}
```

**Key Changes:**
1. `weak var eventEmitter` - prevents retain cycles
2. `DispatchQueue.main.async` - React Native requires main thread
3. `[weak instance]` - safe capture in closure
4. `guard let` checks - prevents nil pointer access
5. `deinit` cleanup - removes observers on deallocation

---

## Bug #3: Extension Communication

### Problem
DeviceActivityMonitor extension cannot safely communicate with main app using CFNotificationCenter (separate process).

### Root Cause
Per Apple documentation:
> "App extensions and their containing apps don't have direct access to each other's containers. Use App Groups to share data."

**Source:** https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionScenarios.html

### Fix: Use App Groups

**Step 1: Update DeviceActivityMonitorExtension.swift**
```swift
import DeviceActivity
import ManagedSettings

class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    
    let store = ManagedSettingsStore()
    let sharedDefaults = UserDefaults(suiteName: "group.com.giress.focusflow")
    
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        
        // Use App Group to communicate
        sharedDefaults?.set(Date(), forKey: "sessionStartTime")
        sharedDefaults?.set(true, forKey: "isSessionActive")
        sharedDefaults?.synchronize()
        
        // Apply blocks
        // ... your blocking logic ...
    }
    
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        
        // Update App Group
        sharedDefaults?.set(Date(), forKey: "sessionEndTime")
        sharedDefaults?.set(false, forKey: "isSessionActive")
        sharedDefaults?.synchronize()
        
        // Remove blocks
        store.shield.applications = nil
    }
}
```

**Step 2: Read from App Group in Main App**
```swift
// In your React Native module
func checkSessionStatus() -> Bool {
    let sharedDefaults = UserDefaults(suiteName: "group.com.giress.focusflow")
    return sharedDefaults?.bool(forKey: "isSessionActive") ?? false
}
```

**App Group Configuration:**
Must be registered in Apple Developer Portal and added to both:
1. Main app target entitlements
2. DeviceActivityMonitor extension entitlements

---

## Additional Fixes Required

### Fix #1: Notification Handler (App.tsx)
```typescript
import * as Notifications from 'expo-notifications';

// Set BEFORE any components render
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

**Source:** Expo requires notification handler set at module level per docs.

### Fix #2: Android Notification Channel
```typescript
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  await Notifications.setNotificationChannelAsync('focus-sessions', {
    name: 'Focus Sessions',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}
```

**Source:** Android O+ requires explicit notification channels per Android docs.

### Fix #3: React Native Event Emitter Safety
```swift
@objc(ReactNativeDeviceActivityModule)
class ReactNativeDeviceActivityModule: RCTEventEmitter {
    
    private var hasListeners = false
    
    override func startObserving() {
        hasListeners = true
    }
    
    override func stopObserving() {
        hasListeners = false
    }
    
    override func sendEvent(withName name: String, body: Any?) {
        guard hasListeners else { return }
        super.sendEvent(withName: name, body: body)
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true  // Critical for thread safety
    }
}
```

---

## Testing Checklist

### Notification Test
- [ ] Start 2-minute session (for quick testing)
- [ ] "Session Started" notification appears after 1 second
- [ ] "Session Complete" notification appears after exactly 2 minutes
- [ ] Background app - notifications still appear
- [ ] Kill app - notifications still appear

### Memory Test
- [ ] Start session
- [ ] Background app immediately
- [ ] Wait for session completion
- [ ] Foreground app
- [ ] No crash occurs ✅

### Extension Communication Test
```swift
// Add debug logging
let sharedDefaults = UserDefaults(suiteName: "group.com.giress.focusflow")
print("Is session active:", sharedDefaults?.bool(forKey: "isSessionActive") ?? false)
```

---

## Implementation Priority

**CRITICAL (Fix Now):**
1. Notification trigger timing (Bug #1)
2. Observer memory safety (Bug #2)
3. App Groups setup (Bug #3)

**HIGH (Fix Soon):**
4. Notification handler in App.tsx
5. Android notification channel
6. Event emitter safety checks

**MEDIUM (Fix Later):**
7. Add comprehensive error logging
8. Add crash reporting (Sentry/Crashlytics)

---



---

## Official Documentation References

**Expo Notifications:**
- https://docs.expo.dev/versions/latest/sdk/notifications/
- https://docs.expo.dev/push-notifications/overview/

**Apple UserNotifications:**
- https://developer.apple.com/documentation/usernotifications
- https://developer.apple.com/documentation/usernotifications/untimeintervalnotificationtrigger

**Apple App Extensions:**
- https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/
- https://developer.apple.com/documentation/app_extensions

**Apple App Groups:**
- https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_application-groups

**Apple DeviceActivity:**
- https://developer.apple.com/documentation/deviceactivity/deviceactivitymonitor

---

## Summary

**Expected Result:**
- ✅ Notifications appear at correct times
- ✅ No memory crashes
- ✅ Stable app blocking across all scenarios