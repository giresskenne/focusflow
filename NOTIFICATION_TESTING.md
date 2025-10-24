# Notification Testing Guide

To validate that reminder notifications are working properly on a real device:

## Important: Use Updated Notification Handler

The app uses the updated expo-notifications API. Make sure your notification handler uses:

```javascript
import * as Notifications from 'expo-notifications';

// Set up notification handler (already configured in App.js)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,  // Show banner notification
    shouldShowList: true,    // Show in notification center
    shouldPlaySound: false,  // Customize as needed
    shouldSetBadge: false,   // Customize as needed
  }),
});
```

## 1. Test Notification Permissions

Run this in your app:

```javascript
import * as Notifications from 'expo-notifications';

// Check current permission status
const checkPermissions = async () => {
  const { status } = await Notifications.getPermissionsAsync();
  console.log('Current permission status:', status);
  
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    console.log('Requested permission status:', newStatus);
    return newStatus === 'granted';
  }
  
  return true;
};
```

## 2. Test Immediate Notification

```javascript
// Schedule a notification for 5 seconds from now
const testImmediateNotification = async () => {
  const hasPermission = await checkPermissions();
  if (!hasPermission) {
    console.log('No notification permission');
    return;
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'FocusFlow Test',
        body: 'This is a test notification to verify functionality.',
      },
      trigger: {
        seconds: 5,
      },
    });
    
    console.log('Test notification scheduled with ID:', id);
    return id;
  } catch (error) {
    console.error('Error scheduling test notification:', error);
  }
};
```

## 3. Test One-Time Reminder

```javascript
// Schedule a one-time reminder for 2 minutes from now
const testOneTimeReminder = async () => {
  const hasPermission = await checkPermissions();
  if (!hasPermission) return;

  const triggerDate = new Date(Date.now() + 120000); // 2 minutes from now
  
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'One-Time Reminder Test',
        body: 'This reminder will only fire once and then expire.',
      },
      trigger: {
        date: triggerDate,
      },
    });
    
    console.log('One-time reminder scheduled with ID:', id);
    console.log('Scheduled for:', triggerDate.toLocaleString());
    return id;
  } catch (error) {
    console.error('Error scheduling one-time reminder:', error);
  }
};
```

## 4. Test Daily Reminder

```javascript
// Schedule a daily reminder for the next minute
const testDailyReminder = async () => {
  const hasPermission = await checkPermissions();
  if (!hasPermission) return;

  const now = new Date();
  const testTime = new Date(now.getTime() + 60000); // 1 minute from now
  
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Reminder Test',
        body: 'Take a break and focus on what matters.',
      },
      trigger: {
        hour: testTime.getHours(),
        minute: testTime.getMinutes(),
        repeats: true,
      },
    });
    
    console.log('Daily reminder scheduled with ID:', id);
    return id;
  } catch (error) {
    console.error('Error scheduling daily reminder:', error);
  }
};
```

## 5. Verify Scheduled Notifications

```javascript
const checkScheduledNotifications = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log('Currently scheduled notifications:', scheduled.length);
    scheduled.forEach((notification, index) => {
      console.log(`${index + 1}:`, {
        id: notification.identifier,
        title: notification.content.title,
        trigger: notification.trigger,
      });
    });
  } catch (error) {
    console.error('Error checking scheduled notifications:', error);
  }
};
```

## 6. Device Testing Steps

1. **Build the app** for your device (not Expo Go for testing native features)
2. **Run the test functions** in your app's console or add them to a debug screen
3. **Grant notification permissions** when prompted
4. **Wait for test notifications** to appear
5. **Check device notification settings** to ensure FocusFlow has permission
6. **Test with device locked/unlocked** to verify both scenarios

Note: On a Personal Apple Developer account, remote push notifications are not available (no `aps-environment` entitlement). All of the above tests use local notifications and work without Push Notifications capability.

## Expected Results

- ✅ Permission request should appear and be grantable
- ✅ Test notification should appear after 5 seconds
- ✅ One-time reminder should fire once and then disappear from Home screen immediately
- ✅ One-time reminder should disappear from Reminders screen after 24 hours
- ✅ Scheduled notifications should show in getAllScheduledNotificationsAsync()
- ✅ Daily reminder should repeat at the specified time
- ✅ Notifications should appear even when app is backgrounded

## One-Time Reminder Behavior

**Home Screen**: One-time reminders disappear immediately after their scheduled time passes (even if you don't see the notification)
**Reminders Screen**: One-time reminders remain visible for 24 hours after firing, then auto-delete
**Notification**: Fires exactly once at the scheduled date/time

## Troubleshooting

- **No permission prompt**: Check if notifications are already denied in Settings
- **Notifications not appearing**: Verify device notification settings
- **iOS silent mode**: Test with both silent and non-silent mode
- **Android doze mode**: Test with battery optimization disabled for the app