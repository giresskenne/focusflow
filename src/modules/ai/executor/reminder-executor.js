// Reminder Executor
// Executes reminder intents with plan/apply pattern similar to focus-executor

import {
  requestPermissions,
  scheduleOneTime,
  scheduleDaily,
  scheduleWeekly,
  scheduleCustom,
  formatConfirmation,
} from '../../reminders/reminder-scheduler';
import { saveReminder } from '../../reminders/reminder-store';
import { getReminders as getLegacyReminders, setReminders as setLegacyReminders } from '../../../storage';

// Helper: mirror saved reminders to the legacy Reminders storage that the UI reads
async function mirrorToLegacyStorage(plan, notificationIds) {
  try {
    const legacy = await getLegacyReminders();
    const now = Date.now();
    let record = null;

    if (plan.reminderType === 'one-time') {
      const triggerDate = new Date(Date.now() + (plan.durationMinutes || 0) * 60 * 1000);
      const id = Array.isArray(notificationIds) ? notificationIds[0] : notificationIds;
      record = {
        id: String(now),
        type: 'once',
        text: plan.message,
        recurrence: 'One-time',
        time: `${triggerDate.toLocaleDateString()} at ${triggerDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        notificationId: id,
        enabled: true,
        scheduledDate: triggerDate.getTime(),
        updatedAt: now,
      };
    } else if (plan.reminderType === 'daily' && plan.time) {
      // Parse HH:MM (optionally with am/pm)
      const m = String(plan.time).toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
      let hours = 9, minutes = 0;
      if (m) {
        hours = parseInt(m[1], 10);
        minutes = m[2] ? parseInt(m[2], 10) : 0;
        const period = m[3];
        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
      }
      const id = Array.isArray(notificationIds) ? notificationIds[0] : notificationIds;
      record = {
        id: String(now),
        type: 'daily',
        text: plan.message,
        recurrence: 'Daily',
        time: `Every day at ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        notificationId: id,
        enabled: true,
        hour: hours,
        minute: minutes,
        updatedAt: now,
      };
    } else if ((plan.reminderType === 'weekly' || plan.reminderType === 'custom') && plan.time && Array.isArray(plan.days) && plan.days.length > 0) {
      // For multiple days, create multiple legacy records
      const makeRecordForDay = (dayName) => {
        const m = String(plan.time).toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
        let hours = 9, minutes = 0;
        if (m) {
          hours = parseInt(m[1], 10);
          minutes = m[2] ? parseInt(m[2], 10) : 0;
          const period = m[3];
          if (period === 'pm' && hours !== 12) hours += 12;
          if (period === 'am' && hours === 12) hours = 0;
        }
        const weekDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const idx = weekDays.findIndex((d) => d.toLowerCase() === String(dayName).toLowerCase());
        const id = Array.isArray(notificationIds) ? notificationIds[0] : notificationIds; // best-effort
        return {
          id: `${now}_${idx}`,
          type: 'weekly',
          text: plan.message,
          recurrence: 'Weekly',
          time: `Every ${weekDays[idx >= 0 ? idx : 1]} at ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
          notificationId: id,
          enabled: true,
          weekDay: idx >= 0 ? idx : 1,
          hour: hours,
          minute: minutes,
          updatedAt: now,
        };
      };
      const records = plan.days.map(makeRecordForDay);
      const next = [...legacy, ...records];
      await setLegacyReminders(next);
      return;
    }

    if (record) {
      const next = [...legacy, record];
      await setLegacyReminders(next);
    }
  } catch (e) {
    console.warn('[ReminderExecutor] Legacy mirror failed:', e?.message);
  }
}

/**
 * Plan a reminder execution
 * @param {Object} intent - Parsed reminder intent
 * @returns {Promise<Object>} Plan result
 */
export async function planReminder(intent) {
  try {
    console.log('[ReminderExecutor] Planning reminder:', intent);
    
    if (!intent || intent.action !== 'remind') {
      return {
        ok: false,
        reason: 'invalid-intent',
        error: 'Intent is not a reminder action',
      };
    }
    
    const { message, reminderType, time, durationMinutes, days } = intent;
    
    // Validate required fields based on reminder type
    if (!message) {
      return {
        ok: false,
        reason: 'missing-message',
        error: 'Reminder message is required',
      };
    }
    
    if (reminderType === 'one-time') {
      if (!durationMinutes || durationMinutes < 1) {
        return {
          ok: false,
          reason: 'missing-duration',
          error: 'Duration is required for one-time reminders',
        };
      }
    }
    
    if (reminderType === 'daily' || reminderType === 'weekly' || reminderType === 'custom') {
      if (!time) {
        return {
          ok: false,
          reason: 'missing-time',
          error: 'Time is required for scheduled reminders',
        };
      }
    }
    
    if ((reminderType === 'weekly' || reminderType === 'custom') && (!days || days.length === 0)) {
      return {
        ok: false,
        reason: 'missing-days',
        error: 'Days are required for weekly/custom reminders',
      };
    }
    
    // Check notification permissions
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) {
      return {
        ok: false,
        reason: 'permissions-denied',
        error: 'Notification permissions are required to set reminders',
        needsPermission: true,
      };
    }
    
    // Build plan
    const plan = {
      action: 'remind',
      message,
      reminderType,
      time,
      durationMinutes,
      days,
      confirmMessage: generateConfirmMessage(intent),
    };
    
    return {
      ok: true,
      plan,
    };
  } catch (e) {
    console.error('[ReminderExecutor] planReminder error:', e?.message);
    return {
      ok: false,
      reason: 'plan-error',
      error: e?.message || 'Failed to plan reminder',
    };
  }
}

/**
 * Apply (execute) a reminder plan
 * @param {Object} plan - Reminder plan from planReminder
 * @returns {Promise<Object>} Execution result
 */
export async function applyReminder(plan) {
  try {
    console.log('[ReminderExecutor] Applying reminder:', plan);
    
    if (!plan || plan.action !== 'remind') {
      return {
        ok: false,
        reason: 'invalid-plan',
        error: 'Plan is not a reminder action',
      };
    }
    
    let notificationIds = null;
    
    // Schedule based on reminder type
    switch (plan.reminderType) {
      case 'one-time':
        notificationIds = await scheduleOneTime(plan);
        break;
        
      case 'daily':
        notificationIds = await scheduleDaily(plan);
        break;
        
      case 'weekly':
        notificationIds = await scheduleWeekly(plan);
        break;
        
      case 'custom':
        notificationIds = await scheduleCustom(plan);
        break;
        
      default:
        return {
          ok: false,
          reason: 'unknown-type',
          error: `Unknown reminder type: ${plan.reminderType}`,
        };
    }
    
    if (!notificationIds || (Array.isArray(notificationIds) && notificationIds.length === 0)) {
      return {
        ok: false,
        reason: 'scheduling-failed',
        error: 'Failed to schedule notification',
      };
    }
    
    // Save reminder to store
    const savedReminder = await saveReminder(plan, notificationIds);
    if (!savedReminder) {
      console.warn('[ReminderExecutor] Failed to save reminder to store');
    }
    // Mirror to legacy storage used by RemindersScreen
    try { await mirrorToLegacyStorage(plan, notificationIds); } catch {}
    
    // Format confirmation message
    const confirmation = formatConfirmation(plan, notificationIds);
    
    return {
      ok: true,
      notificationIds,
      reminderId: savedReminder?.id,
      confirmation,
    };
  } catch (e) {
    console.error('[ReminderExecutor] applyReminder error:', e?.message);
    return {
      ok: false,
      reason: 'apply-error',
      error: e?.message || 'Failed to apply reminder',
    };
  }
}

/**
 * Execute reminder in one step (plan + apply)
 * @param {Object} intent - Parsed reminder intent
 * @param {Object} options - { confirm: boolean }
 * @returns {Promise<Object>}
 */
export async function executeReminder(intent, { confirm = true } = {}) {
  try {
    // Step 1: Plan
    const planResult = await planReminder(intent);
    
    if (!planResult.ok) {
      return planResult;
    }
    
    // Step 2: Confirm (if requested)
    if (confirm) {
      return {
        ok: true,
        pendingConfirmation: true,
        plan: planResult.plan,
      };
    }
    
    // Step 3: Apply
    return await applyReminder(planResult.plan);
  } catch (e) {
    console.error('[ReminderExecutor] executeReminder error:', e?.message);
    return {
      ok: false,
      reason: 'execute-error',
      error: e?.message || 'Failed to execute reminder',
    };
  }
}

/**
 * Generate confirmation message for plan
 * @param {Object} intent - Reminder intent
 * @returns {string}
 */
function generateConfirmMessage(intent) {
  const { message, reminderType, time, durationMinutes, days } = intent;
  
  if (reminderType === 'one-time') {
    return `Set a reminder to ${message} in ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}?`;
  }
  
  if (reminderType === 'daily') {
    return `Set a daily reminder to ${message} at ${time}?`;
  }
  
  if (reminderType === 'weekly' && days?.length === 1) {
    const dayName = days[0].charAt(0).toUpperCase() + days[0].slice(1);
    return `Set a reminder to ${message} every ${dayName} at ${time}?`;
  }
  
  if (reminderType === 'custom' && days?.length > 0) {
    const dayNames = days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
    return `Set a reminder to ${message} on ${dayNames} at ${time}?`;
  }
  
  return `Set a reminder to ${message}?`;
}
