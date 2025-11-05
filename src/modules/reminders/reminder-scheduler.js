// Reminder Scheduler
// Handles scheduling notifications for one-time, daily, weekly, and custom reminders
// Uses expo-notifications for cross-platform notification scheduling

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions
 * @returns {Promise<boolean>} true if granted
 */
export async function requestPermissions() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('[ReminderScheduler] Notification permissions not granted');
      return false;
    }
    
    // Android-specific: notification channels
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    
    return true;
  } catch (e) {
    console.error('[ReminderScheduler] Permission request error:', e?.message);
    return false;
  }
}

/**
 * Parse time string to hour and minute
 * @param {string} timeStr - "9 AM", "2:30 PM", "14:00"
 * @returns {{ hour: number, minute: number }|null}
 */
function parseTime(timeStr) {
  if (!timeStr) return null;
  
  const lower = timeStr.toLowerCase().trim();
  
  // Match "9 AM", "9:30 PM", "09:00 AM"
  const ampmMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const period = ampmMatch[3];
    
    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    
    return { hour, minute };
  }
  
  // Match "14:00", "9:30" (24-hour format)
  const time24Match = lower.match(/(\d{1,2}):(\d{2})/);
  if (time24Match) {
    const hour = parseInt(time24Match[1], 10);
    const minute = parseInt(time24Match[2], 10);
    return { hour, minute };
  }
  
  return null;
}

/**
 * Get day of week number (1 = Sunday, 7 = Saturday)
 * @param {string} dayName - "monday", "tuesday", etc.
 * @returns {number|null}
 */
function getDayOfWeek(dayName) {
  const days = {
    sunday: 1,
    monday: 2,
    tuesday: 3,
    wednesday: 4,
    thursday: 5,
    friday: 6,
    saturday: 7,
  };
  return days[dayName?.toLowerCase()] || null;
}

/**
 * Schedule a one-time reminder
 * @param {Object} reminder - { message, durationMinutes }
 * @returns {Promise<string|null>} notification ID or null
 */
export async function scheduleOneTime(reminder) {
  try {
    const { message, durationMinutes } = reminder;
    
    if (!message || !durationMinutes) {
      console.warn('[ReminderScheduler] Invalid one-time reminder:', reminder);
      return null;
    }
    
    const seconds = durationMinutes * 60;
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Reminder',
        body: `Time to ${message}`,
        data: { type: 'one-time', message },
        sound: true,
      },
      trigger: {
        seconds,
      },
    });
    
    const triggerTime = new Date(Date.now() + seconds * 1000);
    console.log('[ReminderScheduler] One-time reminder scheduled:', {
      id: notificationId,
      message,
      triggerTime: triggerTime.toLocaleTimeString(),
    });
    
    return notificationId;
  } catch (e) {
    console.error('[ReminderScheduler] scheduleOneTime error:', e?.message);
    return null;
  }
}

/**
 * Schedule a daily reminder
 * @param {Object} reminder - { message, time }
 * @returns {Promise<string|null>} notification ID or null
 */
export async function scheduleDaily(reminder) {
  try {
    const { message, time } = reminder;
    
    if (!message || !time) {
      console.warn('[ReminderScheduler] Invalid daily reminder:', reminder);
      return null;
    }
    
    const parsedTime = parseTime(time);
    if (!parsedTime) {
      console.warn('[ReminderScheduler] Could not parse time:', time);
      return null;
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Reminder',
        body: `Time to ${message}`,
        data: { type: 'daily', message },
        sound: true,
      },
      trigger: {
        hour: parsedTime.hour,
        minute: parsedTime.minute,
        repeats: true,
      },
    });
    
    console.log('[ReminderScheduler] Daily reminder scheduled:', {
      id: notificationId,
      message,
      time: `${parsedTime.hour}:${String(parsedTime.minute).padStart(2, '0')}`,
    });
    
    return notificationId;
  } catch (e) {
    console.error('[ReminderScheduler] scheduleDaily error:', e?.message);
    return null;
  }
}

/**
 * Schedule a weekly reminder
 * @param {Object} reminder - { message, days: ['monday'], time }
 * @returns {Promise<string[]>} notification IDs
 */
export async function scheduleWeekly(reminder) {
  try {
    const { message, days, time } = reminder;
    
    if (!message || !days?.length || !time) {
      console.warn('[ReminderScheduler] Invalid weekly reminder:', reminder);
      return [];
    }
    
    const parsedTime = parseTime(time);
    if (!parsedTime) {
      console.warn('[ReminderScheduler] Could not parse time:', time);
      return [];
    }
    
    const notificationIds = [];
    
    for (const day of days) {
      const dayNum = getDayOfWeek(day);
      if (!dayNum) continue;
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Weekly Reminder',
          body: `Time to ${message}`,
          data: { type: 'weekly', message, day },
          sound: true,
        },
        trigger: {
          weekday: dayNum,
          hour: parsedTime.hour,
          minute: parsedTime.minute,
          repeats: true,
        },
      });
      
      notificationIds.push(notificationId);
      console.log('[ReminderScheduler] Weekly reminder scheduled:', {
        id: notificationId,
        message,
        day,
        time: `${parsedTime.hour}:${String(parsedTime.minute).padStart(2, '0')}`,
      });
    }
    
    return notificationIds;
  } catch (e) {
    console.error('[ReminderScheduler] scheduleWeekly error:', e?.message);
    return [];
  }
}

/**
 * Schedule a custom reminder (multiple days)
 * @param {Object} reminder - { message, days: ['monday', 'wednesday'], time }
 * @returns {Promise<string[]>} notification IDs
 */
export async function scheduleCustom(reminder) {
  // Custom reminders are the same as weekly reminders (multiple days)
  return scheduleWeekly(reminder);
}

/**
 * Cancel a scheduled notification
 * @param {string|string[]} notificationIds - Notification ID(s) to cancel
 */
export async function cancelReminder(notificationIds) {
  try {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
    
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id);
      console.log('[ReminderScheduler] Cancelled reminder:', id);
    }
  } catch (e) {
    console.error('[ReminderScheduler] cancelReminder error:', e?.message);
  }
}

/**
 * Get all scheduled notifications
 * @returns {Promise<Array>}
 */
export async function getAllScheduledReminders() {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return notifications;
  } catch (e) {
    console.error('[ReminderScheduler] getAllScheduledReminders error:', e?.message);
    return [];
  }
}

/**
 * Format reminder confirmation message
 * @param {Object} reminder - Reminder intent
 * @param {string|string[]} notificationIds - Scheduled notification IDs
 * @returns {string}
 */
export function formatConfirmation(reminder, notificationIds) {
  const { message, reminderType, time, durationMinutes, days } = reminder;
  
  if (reminderType === 'one-time') {
    const triggerTime = new Date(Date.now() + durationMinutes * 60 * 1000);
    return `I'll remind you to ${message} in ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}. Notification set for ${triggerTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
  }
  
  if (reminderType === 'daily') {
    return `I'll remind you to ${message} every day at ${time}.`;
  }
  
  if (reminderType === 'weekly' && days?.length === 1) {
    const dayName = days[0].charAt(0).toUpperCase() + days[0].slice(1);
    return `I'll remind you to ${message} every ${dayName} at ${time}.`;
  }
  
  if (reminderType === 'custom' && days?.length > 0) {
    const dayNames = days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
    return `I'll remind you to ${message} on ${dayNames} at ${time}.`;
  }
  
  return `Reminder set to ${message}.`;
}
