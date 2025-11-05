// Reminder Store
// Persists user reminders in AsyncStorage for tracking and management

import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDERS_KEY = 'user_reminders';

/**
 * @typedef {Object} StoredReminder
 * @property {string} id - Unique ID
 * @property {string} message - What to remind about
 * @property {string} reminderType - 'one-time'|'daily'|'weekly'|'custom'
 * @property {string|null} time - For scheduled reminders
 * @property {number|null} durationMinutes - For one-time reminders
 * @property {string[]|null} days - For weekly/custom reminders
 * @property {string|string[]} notificationIds - Scheduled notification IDs
 * @property {number} createdAt - Timestamp when reminder was created
 * @property {boolean} active - Whether reminder is still active
 */

/**
 * Get all reminders
 * @returns {Promise<StoredReminder[]>}
 */
export async function getReminders() {
  try {
    const stored = await AsyncStorage.getItem(REMINDERS_KEY);
    if (!stored) return [];
    
    const reminders = JSON.parse(stored);
    return Array.isArray(reminders) ? reminders : [];
  } catch (e) {
    console.warn('[ReminderStore] getReminders error:', e?.message);
    return [];
  }
}

/**
 * Save a new reminder
 * @param {Object} reminder - Reminder data
 * @param {string|string[]} notificationIds - Scheduled notification IDs
 * @returns {Promise<StoredReminder|null>}
 */
export async function saveReminder(reminder, notificationIds) {
  try {
    const reminders = await getReminders();
    
    const newReminder = {
      id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: reminder.message,
      reminderType: reminder.reminderType,
      time: reminder.time || null,
      durationMinutes: reminder.durationMinutes || null,
      days: reminder.days || null,
      notificationIds,
      createdAt: Date.now(),
      active: true,
    };
    
    reminders.push(newReminder);
    await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
    
    console.log('[ReminderStore] Saved reminder:', newReminder.id);
    return newReminder;
  } catch (e) {
    console.error('[ReminderStore] saveReminder error:', e?.message);
    return null;
  }
}

/**
 * Delete a reminder
 * @param {string} reminderId - Reminder ID to delete
 * @returns {Promise<boolean>}
 */
export async function deleteReminder(reminderId) {
  try {
    const reminders = await getReminders();
    const filtered = reminders.filter(r => r.id !== reminderId);
    
    await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(filtered));
    console.log('[ReminderStore] Deleted reminder:', reminderId);
    return true;
  } catch (e) {
    console.error('[ReminderStore] deleteReminder error:', e?.message);
    return false;
  }
}

/**
 * Mark reminder as inactive (for one-time reminders after they fire)
 * @param {string} reminderId
 * @returns {Promise<boolean>}
 */
export async function deactivateReminder(reminderId) {
  try {
    const reminders = await getReminders();
    const reminder = reminders.find(r => r.id === reminderId);
    
    if (reminder) {
      reminder.active = false;
      await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
      console.log('[ReminderStore] Deactivated reminder:', reminderId);
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('[ReminderStore] deactivateReminder error:', e?.message);
    return false;
  }
}

/**
 * Get active reminders
 * @returns {Promise<StoredReminder[]>}
 */
export async function getActiveReminders() {
  try {
    const reminders = await getReminders();
    return reminders.filter(r => r.active);
  } catch (e) {
    console.warn('[ReminderStore] getActiveReminders error:', e?.message);
    return [];
  }
}

/**
 * Clear all reminders (for testing/debugging)
 * @returns {Promise<boolean>}
 */
export async function clearAllReminders() {
  try {
    await AsyncStorage.removeItem(REMINDERS_KEY);
    console.log('[ReminderStore] Cleared all reminders');
    return true;
  } catch (e) {
    console.error('[ReminderStore] clearAllReminders error:', e?.message);
    return false;
  }
}
