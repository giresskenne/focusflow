import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Alert, Modal, ScrollView, TouchableOpacity, Platform } from 'react-native';
import UIButton from '../components/Ui/Button';
import * as Notifications from 'expo-notifications';
import { getReminders, setReminders, getPremiumStatus } from '../storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PlusIcon, TrashIcon, ChevronRightIcon, CrownIcon } from '../components/Icons';
import { colors, spacing, radius, typography } from '../theme';
import { FREE_REMINDER_LIMIT, canAddReminder } from '../utils/premium';

export default function RemindersScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [title, setTitle] = useState('');
  const [recurrence, setRecurrence] = useState('daily');
  const [intervalMinutes, setIntervalMinutes] = useState('60');
  const [dailyTime, setDailyTime] = useState(new Date());
  const [weekDay, setWeekDay] = useState(1); // 1 = Monday
  const [isPremium, setIsPremium] = useState(false);
  const [showPremium, setShowPremium] = useState(false);

  const loadReminders = async () => {
    const existing = await getReminders();
    console.log('Loaded reminders:', existing);
    
    // Clean up expired one-time reminders
    const now = Date.now();
    const active = (existing || []).filter(reminder => {
      if (reminder.type === 'once' && reminder.scheduledDate) {
        // Remove if 24 hours have passed since scheduled time
        const expiry = reminder.scheduledDate + (24 * 60 * 60 * 1000);
        return now < expiry;
      }
      return true; // Keep all repeating reminders
    });
    
    // If any reminders were removed, save the cleaned list
    if (active.length !== (existing || []).length) {
      await setReminders(active);
    }
    
    setItems(active);
  };

  useEffect(() => {
    (async () => {
      await loadReminders();
      const premium = await getPremiumStatus();
      setIsPremium(premium);
    })();
  }, []);

  useEffect(() => {
    if (!showAdd) {
      loadReminders();
    }
  }, [showAdd]);

  const save = async (list) => {
    setItems(list);
    await setReminders(list);
  };

  const requestPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const res = await Notifications.requestPermissionsAsync();
      if (res.status !== 'granted') {
        Alert.alert('Permission needed', 'Enable notifications to use reminders.');
        throw new Error('permission-denied');
      }
      return true;
    }
    return true;
  };

  const handleAddReminder = () => {
    if (!canAddReminder(isPremium, items.length)) {
      setShowPremium(true);
      return;
    }
    // reset editor state for new reminder
    setEditingItem(null);
    setTitle('');
    setRecurrence('daily');
    setIntervalMinutes('60');
    setDailyTime(new Date());
    setWeekDay(1);
    setShowAdd(true);
  };

  const handleSaveReminder = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    try {
      await requestPermission();
      let identifier = null;
      let record = null;

      if (recurrence === 'once') {
        const triggerDate = new Date(dailyTime);
        // Ensure it's in the future
        if (triggerDate <= new Date()) {
          triggerDate.setTime(Date.now() + 60000); // 1 minute from now if in past
        }
        identifier = await Notifications.scheduleNotificationAsync({
          content: { title: 'Reminder', body: cleanTitle },
          trigger: { date: triggerDate },
        });
        record = {
          id: editingItem?.id || Date.now().toString(),
          type: 'once',
          text: cleanTitle,
          recurrence: 'One-time',
          time: `${triggerDate.toLocaleDateString()} at ${triggerDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          notificationId: identifier,
          enabled: true,
          scheduledDate: triggerDate.getTime(),
          updatedAt: Date.now(),
        };
      } else if (recurrence === 'daily') {
        const hours = dailyTime.getHours();
        const minutes = dailyTime.getMinutes();
        identifier = await Notifications.scheduleNotificationAsync({
          content: { title: 'Reminder', body: cleanTitle },
          trigger: { hour: hours, minute: minutes, repeats: true },
        });
        record = {
          id: editingItem?.id || Date.now().toString(),
          type: 'daily',
          text: cleanTitle,
          recurrence: 'Daily',
          time: `Every day at ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
          notificationId: identifier,
          enabled: true,
          hour: hours,
          minute: minutes,
          updatedAt: Date.now(),
        };
      } else if (recurrence === 'weekly') {
        const hours = dailyTime.getHours();
        const minutes = dailyTime.getMinutes();
        const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        identifier = await Notifications.scheduleNotificationAsync({
          content: { title: 'Reminder', body: cleanTitle },
          // Expo Notifications expects 1-7 (Sun=1). Our weekDay is 0-6.
          trigger: { weekday: weekDay + 1, hour: hours, minute: minutes, repeats: true },
        });
        record = {
          id: editingItem?.id || Date.now().toString(),
          type: 'weekly',
          text: cleanTitle,
          recurrence: 'Weekly',
          time: `Every ${weekDays[weekDay]} at ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
          notificationId: identifier,
          enabled: true,
          weekDay: weekDay,
          hour: hours,
          minute: minutes,
          updatedAt: Date.now(),
        };
      } else {
        // Interval for custom/location (simplified for free users)
        const minutes = parseInt(intervalMinutes, 10) || 60;
        identifier = await Notifications.scheduleNotificationAsync({
          content: { title: 'Reminder', body: cleanTitle },
          trigger: { seconds: minutes * 60, repeats: true },
        });
        record = {
          id: editingItem?.id || Date.now().toString(),
          type: 'interval',
          text: cleanTitle,
          recurrence: 'Custom',
          time: `Every ${minutes} minute${minutes !== 1 ? 's' : ''}`,
          notificationId: identifier,
          enabled: true,
          intervalMinutes: minutes,
          updatedAt: Date.now(),
        };
      }

      // If editing, cancel old notification and replace existing item
      if (editingItem) {
        try {
          if (editingItem.notificationId) {
            await Notifications.cancelScheduledNotificationAsync(editingItem.notificationId);
          }
        } catch {}
        const next = items.map((it) => (it.id === editingItem.id ? record : it));
        await save(next);
      } else {
        const next = [...items, record];
        await save(next);
      }
      setTitle('');
      setRecurrence('daily');
      setEditingItem(null);
      setShowAdd(false);
    } catch (e) {}
  };

  const handleDeleteReminder = async (id) => {
    const item = items.find((r) => r.id === id);
    if (item?.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(item.notificationId);
    }
    const next = items.filter((r) => r.id !== id);
    await save(next);
  };

  // Helper: open editor for existing item
  const openEdit = (item) => {
    setEditingItem(item);
    const type = item.type || (item.recurrence?.toLowerCase() || 'daily');
    setTitle(item.text || item.title || '');
    if (type === 'weekly') {
      setRecurrence('weekly');
      setWeekDay(Number.isFinite(item.weekDay) ? item.weekDay : 1);
      const d = new Date();
      d.setHours(item.hour ?? 9, item.minute ?? 0, 0, 0);
      setDailyTime(d);
    } else if (type === 'interval') {
      setRecurrence('custom');
      setIntervalMinutes(String(item.intervalMinutes || 60));
    } else {
      setRecurrence('daily');
      const d = new Date();
      d.setHours(item.hour ?? 9, item.minute ?? 0, 0, 0);
      setDailyTime(d);
    }
    setShowAdd(true);
  };

  // New/Edit Reminder Modal
  if (showAdd) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{editingItem ? 'Edit Reminder' : 'New Reminder'}</Text>
        </View>

        <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: spacing['3xl'] }}>
          <View style={{ gap: spacing.xl }}>
            {/* Reminder Text Input */}
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.fieldLabel}>REMINDER TEXT</Text>
              <TextInput
                placeholder="e.g., Take a break"
                placeholderTextColor={colors.mutedForeground}
                value={title}
                onChangeText={setTitle}
                style={styles.textInput}
              />
            </View>

            {/* Recurrence Picker */}
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.fieldLabel}>RECURRENCE</Text>
              <View style={styles.selectButton}>
                <TouchableOpacity
                  style={styles.selectTrigger}
                  onPress={() => {
                    Alert.alert(
                      'Select Recurrence',
                      '',
                      [
                        { text: 'One-time', onPress: () => setRecurrence('once') },
                        { text: 'Daily', onPress: () => setRecurrence('daily') },
                        { text: 'Weekly', onPress: () => setRecurrence('weekly') },
                        ...((isPremium || editingItem?.type === 'interval') ? [
                          { text: 'Custom', onPress: () => setRecurrence('custom') },
                          // Reserved for future: location-based
                          // { text: 'Location-based', onPress: () => setRecurrence('location') },
                        ] : []),
                        { text: 'Cancel', style: 'cancel' },
                      ],
                      { cancelable: true }
                    );
                  }}
                >
                  <Text style={styles.selectValue}>
                    {recurrence.charAt(0).toUpperCase() + recurrence.slice(1)}
                  </Text>
                  <ChevronRightIcon color={colors.mutedForeground} size={20} style={{ transform: [{ rotate: '90deg' }] }} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Time/Interval Picker based on recurrence */}
            {recurrence === 'daily' ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.fieldLabel}>TIME</Text>
                <View style={styles.timePickerWrapper}>
                  <DateTimePicker
                    mode="time"
                    value={dailyTime}
                    onChange={(e, date) => { if (date) setDailyTime(date); }}
                    themeVariant="light"
                    display="spinner"
                    style={{ height: 120 }}
                  />
                </View>
              </View>
            ) : recurrence === 'weekly' ? (
              <>
                <View style={{ gap: spacing.sm }}>
                  <Text style={styles.fieldLabel}>DAY OF WEEK</Text>
                  <View style={styles.dayPickerWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPickerScroll}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.dayButton, weekDay === idx && styles.dayButtonActive]}
                          onPress={() => setWeekDay(idx)}
                        >
                          <Text style={[styles.dayButtonText, weekDay === idx && styles.dayButtonTextActive]}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
                <View style={{ gap: spacing.sm }}>
                  <Text style={styles.fieldLabel}>TIME</Text>
                  <View style={styles.timePickerWrapper}>
                    <DateTimePicker
                      mode="time"
                      value={dailyTime}
                      onChange={(e, date) => { if (date) setDailyTime(date); }}
                      themeVariant="light"
                      display="spinner"
                      style={{ height: 120 }}
                    />
                  </View>
                </View>
              </>
            ) : recurrence === 'once' ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.fieldLabel}>DATE & TIME</Text>
                <View style={styles.timePickerWrapper}>
                  <DateTimePicker
                    mode="datetime"
                    value={dailyTime}
                    onChange={(e, date) => { if (date) setDailyTime(date); }}
                    themeVariant="light"
                    display="spinner"
                    style={{ height: 120 }}
                    minimumDate={new Date()}
                  />
                </View>
              </View>
            ) : recurrence === 'custom' ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.fieldLabel}>INTERVAL (MINUTES)</Text>
                <TextInput
                  placeholder="e.g., 60"
                  placeholderTextColor={colors.mutedForeground}
                  value={intervalMinutes}
                  onChangeText={setIntervalMinutes}
                  keyboardType="numeric"
                  style={styles.textInput}
                />
              </View>
            ) : null}

            {/* Premium Upsell Card */}
            {!isPremium && (
              <View style={styles.premiumCard}>
                <View style={styles.premiumIconWrapper}>
                  <CrownIcon color="#d97706" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.premiumTitle}>Unlock advanced options</Text>
                  <Text style={styles.premiumText}>
                    Get custom schedules, location-based reminders, and unlimited reminders.
                  </Text>
                  <TouchableOpacity
                    style={styles.premiumButton}
                    onPress={() => setShowPremium(true)}
                  >
                    <Text style={styles.premiumButtonText}>Upgrade Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <UIButton
            title="Cancel"
            variant="outline"
            onPress={() => {
              setShowAdd(false);
              setTitle('');
              setEditingItem(null);
            }}
            style={{ flex: 1, marginRight: spacing.sm }}
          />
          <UIButton
            title={editingItem ? 'Save Changes' : 'Save Reminder'}
            onPress={handleSaveReminder}
            disabled={!title.trim()}
            style={{ flex: 1, marginLeft: spacing.sm }}
          />
        </View>

        {/* Debug helpers (only shown in development builds) */}
        {__DEV__ && (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Text style={{ color: colors.mutedForeground, fontSize: typography.xs }}>Notifications Debug</Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity
                style={[styles.debugBtn, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  try {
                    const ok = await requestPermission();
                    if (!ok) return Alert.alert('Permission', 'Notifications permission is required.');
                    const id = await Notifications.scheduleNotificationAsync({
                      content: { title: 'FocusFlow Test', body: 'This is a 5s test notification.' },
                      trigger: { seconds: 5 },
                    });
                    Alert.alert('Scheduled', `Test notification in 5s. ID: ${id}`);
                  } catch (e) {
                    Alert.alert('Error', String(e?.message || e));
                  }
                }}
              >
                <Text style={styles.debugBtnText}>Schedule 5s Test</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.debugBtn, { backgroundColor: colors.muted }]}
                onPress={async () => {
                  const list = await Notifications.getAllScheduledNotificationsAsync();
                  Alert.alert('Scheduled', `${list.length} notifications scheduled`);
                  console.log('Scheduled notifications:', list);
                }}
              >
                <Text style={[styles.debugBtnText, { color: colors.foreground }]}>List Scheduled</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.debugBtn, { backgroundColor: '#ef4444' }]}
                onPress={async () => {
                  await Notifications.cancelAllScheduledNotificationsAsync();
                  Alert.alert('Cleared', 'All scheduled notifications cancelled.');
                  await loadReminders();
                }}
              >
                <Text style={styles.debugBtnText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  const renderItem = ({ item, index }) => (
    <View>
      <TouchableOpacity style={styles.reminderCard} onPress={() => openEdit(item)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.reminderText}>{item.text || item.title || 'Unnamed Reminder'}</Text>
          <View style={styles.reminderMeta}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.recurrence || 'Daily'}</Text>
            </View>
            <Text style={styles.reminderTime}>{item.time || 'Every day'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteReminder(item.id)}
        >
          <TrashIcon color={colors.destructive} size={16} />
        </TouchableOpacity>
      </TouchableOpacity>
      {index < items.length - 1 && <View style={styles.divider} />}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Reminders</Text>
          {!isPremium && (
            <Text style={styles.headerSubtitle}>
              {items.length}/{FREE_REMINDER_LIMIT} reminders
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddReminder}
        >
          <PlusIcon color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {/* Reminders List */}
      <View style={styles.scrollContent}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>
              No reminders yet. Add one to get started!
            </Text>
          </View>
        ) : (
          <View style={styles.remindersList}>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator
              scrollEnabled
              bounces
              alwaysBounceVertical
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: spacing['3xl'], flexGrow: 1 }}
              ListFooterComponent={<View style={{ height: spacing['3xl'] }} />}
            />
          </View>
        )}
      </View>

      {/* Premium Modal */}
      <Modal visible={showPremium} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Upgrade to Premium</Text>
            <Text style={styles.modalDescription}>
              Free plan allows up to {FREE_REMINDER_LIMIT} reminders. Upgrade to add unlimited reminders and unlock advanced features.
            </Text>
            <UIButton
              title="Got it"
              onPress={() => setShowPremium(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: typography.bold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  emptyState: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
  },
  remindersList: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
  },
  reminderText: {
    fontSize: typography.base,
    color: colors.foreground,
    fontWeight: typography.medium,
    marginBottom: spacing.sm,
  },
  reminderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: typography.xs,
    color: colors.foreground,
    fontWeight: typography.medium,
  },
  reminderTime: {
    fontSize: typography.base,
    color: colors.mutedForeground,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
    opacity: 0.3,
  },
  fieldLabel: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.sm,
  },
  textInput: {
    height: 48,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    fontSize: typography.base,
    color: colors.foreground,
  },
  selectButton: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectTrigger: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  selectValue: {
    fontSize: typography.base,
    color: colors.foreground,
  },
  timePickerWrapper: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dayPickerWrapper: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  dayPickerScroll: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  dayButton: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayButtonText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.foreground,
  },
  dayButtonTextActive: {
    color: '#fff',
  },
  premiumCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: '#fffbeb',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#fcd34d',
    padding: spacing.lg,
  },
  premiumIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: '#78350f',
    marginBottom: 4,
  },
  premiumText: {
    fontSize: typography.sm,
    color: '#92400e',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  premiumButton: {
    backgroundColor: '#d97706',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignSelf: 'flex-start',
  },
  premiumButtonText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  modalDescription: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  debugBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  debugBtnText: {
    color: '#fff',
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
});
