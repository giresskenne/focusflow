import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Alert, Modal, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import UIButton from '../components/Ui/Button';
import * as Notifications from 'expo-notifications';
import { getReminders, setReminders, getPremiumStatus } from '../storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PlusIcon, TrashIcon, ChevronRightIcon } from '../components/Icons';
import { colors, spacing, radius, typography } from '../theme';
import { FREE_REMINDER_LIMIT, canAddReminder } from '../utils/premium';
import GradientBackground from '../components/GradientBackground';
import GlassCard from '../components/Ui/GlassCard';

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
      // Check notification permissions first
      const { status } = await Notifications.getPermissionsAsync();
  // Permission status available if needed: status
      
      if (status !== 'granted') {
        console.warn('Notification permissions not granted');
        alert('Please grant notification permissions in Settings');
        return;
      }
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
          // Use structured date trigger to avoid deprecation warnings
          trigger: { type: 'date', date: triggerDate },
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
        
        // For intervals, we'll schedule multiple notifications (more reliable than repeating intervals)
        const notificationIds = [];
        const now = new Date();
        const maxNotifications = 24; // Schedule notifications for the next 24 intervals
        
  // Scheduling notifications for next intervals
        
        for (let i = 1; i <= maxNotifications; i++) {
          const triggerTime = new Date(now.getTime() + (minutes * 60 * 1000 * i));
          // schedule each notification at computed triggerTime
          try {
            const id = await Notifications.scheduleNotificationAsync({
              content: { 
                title: 'FocusFlow Reminder', 
                body: cleanTitle,
                sound: true 
              },
              // Use structured date trigger to avoid deprecation warnings
              trigger: { type: 'date', date: triggerTime },
            });
            // scheduled id available if needed: id
            notificationIds.push(id);
          } catch (e) {
            console.error(`Failed to schedule notification ${i}:`, e);
          }
        }
        
  // total scheduled kept in notificationIds
        
        // Use the first notification ID as the main identifier
        identifier = notificationIds[0];
        
        record = {
          id: editingItem?.id || Date.now().toString(),
          type: 'interval',
          text: cleanTitle,
          recurrence: 'Custom',
          time: `Every ${minutes} minute${minutes !== 1 ? 's' : ''}`,
          notificationId: identifier,
          notificationIds: notificationIds, // Store all IDs for cleanup
          enabled: true,
          intervalMinutes: minutes,
          updatedAt: Date.now(),
        };
      }

      // If editing, cancel old notification and replace existing item
      if (editingItem) {
        try {
          // Cancel all old notifications
          if (editingItem.notificationIds && Array.isArray(editingItem.notificationIds)) {
            for (const notifId of editingItem.notificationIds) {
              try {
                await Notifications.cancelScheduledNotificationAsync(notifId);
              } catch (e) {
                console.warn('Failed to cancel old notification:', notifId);
              }
            }
          } else if (editingItem.notificationId) {
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
    if (item) {
      // For interval reminders, cancel all scheduled notifications
      if (item.notificationIds && Array.isArray(item.notificationIds)) {
        for (const notifId of item.notificationIds) {
          try {
            await Notifications.cancelScheduledNotificationAsync(notifId);
          } catch (e) {
            console.warn('Failed to cancel notification:', notifId, e);
          }
        }
      } else if (item.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(item.notificationId);
      }
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
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
                    themeVariant="dark"
                    textColor={colors.foreground}
                    accentColor={colors.primary}
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
                      themeVariant="dark"
                      textColor={colors.foreground}
                      accentColor={colors.primary}
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
                    themeVariant="dark"
                    textColor={colors.foreground}
                    accentColor={colors.primary}
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

            {/* Premium Upsell Card (match compact inline design) */}
            {!isPremium && (
              <GlassCard
                tint="dark"
                intensity={60}
                style={styles.premiumCardOuter}
                contentStyle={styles.premiumCardContent}
              >
                <View style={styles.premiumHeaderRow}>
                  <Text style={styles.premiumSparkles}>✨</Text>
                  <Text style={styles.premiumTitleGlass}>Upgrade for More</Text>
                </View>
                <Text style={styles.premiumTextGlass}>
                  Free plan allows up to {FREE_REMINDER_LIMIT} reminders. Upgrade to Premium for unlimited reminders and location-based alerts.
                </Text>
                <TouchableOpacity
                  onPress={() => setShowPremium(true)}
                  activeOpacity={0.9}
                  style={{ alignSelf: 'flex-start', borderRadius: radius.xl, overflow: 'hidden' }}
                >
                  <LinearGradient
                    colors={[ '#8900f5', '#0072ff' ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.gradientButtonText}>Upgrade to Premium</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </GlassCard>
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

  {/* Debug helpers (toggled; previously dev-only). Keep visible to help QA on device */}
  {(
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Text style={{ color: colors.mutedForeground, fontSize: typography.xs }}>Notifications Debug</Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {/* Removed debug buttons: 5s Test and 1min Repeat Test */}

              {/* Removed debug buttons: List Scheduled, Clear All */}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {/* Removed debug buttons: Permission Status and Open Settings */}
            </View>
          </View>
        )}
        </SafeAreaView>
      </GradientBackground>
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
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
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
          <GlassCard tint="dark" intensity={60} style={styles.modalCard}>
            <Text style={styles.modalTitle}>✨ Upgrade for More</Text>
            <Text style={styles.modalDescription}>
              Free plan allows up to {FREE_REMINDER_LIMIT} reminders. Upgrade to Premium for unlimited reminders and location-based alerts.
            </Text>
            <TouchableOpacity onPress={() => setShowPremium(false)} activeOpacity={0.9} style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
              <LinearGradient colors={[ '#8900f5', '#0072ff' ]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.gradientButton, { alignSelf: 'stretch' }]}>
                <Text style={styles.gradientButtonText}>Upgrade to Premium</Text>
              </LinearGradient>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  premiumCardOuter: {
    borderRadius: radius.xl,
  },
  premiumCardContent: {
    padding: spacing.lg,
  },
  premiumHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  premiumSparkles: {
    fontSize: 16,
  },
  premiumTitleGlass: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.foreground,
  },
  premiumTextGlass: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  gradientButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
  },
  gradientButtonText: {
    color: '#fff',
    fontWeight: typography.semibold,
    fontSize: typography.sm,
    textAlign: 'center',
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
