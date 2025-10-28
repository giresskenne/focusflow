import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UIButton from '../components/Ui/Button';
import PremiumModal from '../components/PremiumModal';
import GlassCard from '../components/Ui/GlassCard';
import GradientBackground from '../components/GradientBackground';
import { getSession, getReminders, getPremiumStatus, setPremiumStatus } from '../storage';
import { ClockIcon, BellIcon, BarChartIcon, SettingsIcon, CrownIcon } from '../components/Icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import { SkeletonListItem } from '../components/SkeletonLoader';
import { withErrorHandling } from '../utils/errorHandling';

// Helper functions for reminder styling
function getReminderColor(item, index) {
  // Cycle through colors based on reminder type or index
  const colors = ['#3b82f6', '#f59e0b', '#8900f5', '#ec4899', '#06b6d4'];
  return colors[index % colors.length];
}

function getReminderIcon(item, index) {
  const iconMap = {
    0: '💧', // Water drop
    1: '☕', // Coffee
    2: '📖', // Book
  };
  return <Text style={{ fontSize: 20 }}>{iconMap[index] || '🔔'}</Text>;
}

// Normalize reminder records to a consistent shape, supporting legacy data
function normalizeReminder(r) {
  const type = (r.type || (r.recurrence ? String(r.recurrence).toLowerCase() : '')).toLowerCase();

  // Try to parse time info from the human string when fields are missing
  const parseTimeFromString = (str) => {
    if (!str || typeof str !== 'string') return null;
    const m = str.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      const h = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (Number.isFinite(h) && Number.isFinite(mm)) return { hour: h, minute: mm };
    }
    return null;
  };

  const parseIntervalFromString = (str) => {
    if (!str || typeof str !== 'string') return null;
    const m = str.match(/Every\s+(\d+)\s+minute/i);
    if (m) {
      const mins = parseInt(m[1], 10);
      if (Number.isFinite(mins) && mins > 0) return mins;
    }
    return null;
  };

  const parseWeekdayFromString = (str) => {
    if (!str || typeof str !== 'string') return null;
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const lower = str.toLowerCase();
    for (let i = 0; i < days.length; i++) {
      if (lower.includes(days[i])) return i; // 0=Sun ... 6=Sat
    }
    return null;
  };

  if (type === 'once' || type === 'one-time') {
    const scheduledDate = r.scheduledDate || Date.now();
    return { ...r, type: 'once', scheduledDate };
  }

  if (type === 'daily') {
    let hour = r.hour;
    let minute = r.minute;
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      const parsed = parseTimeFromString(r.time);
      if (parsed) { hour = parsed.hour; minute = parsed.minute; }
    }
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) { hour = 9; minute = 0; }
    return { ...r, type: 'daily', hour, minute };
  }

  if (type === 'weekly') {
    let weekDay = r.weekDay;
    if (!Number.isFinite(weekDay)) {
      const parsedDay = parseWeekdayFromString(r.time);
      if (parsedDay !== null) weekDay = parsedDay;
    }
    if (!Number.isFinite(weekDay)) weekDay = 1; // default Monday
    let hour = r.hour;
    let minute = r.minute;
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      const parsed = parseTimeFromString(r.time);
      if (parsed) { hour = parsed.hour; minute = parsed.minute; }
    }
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) { hour = 9; minute = 0; }
    return { ...r, type: 'weekly', weekDay, hour, minute };
  }

  // Treat anything else as interval/custom
  let intervalMinutes = r.intervalMinutes;
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    const parsed = parseIntervalFromString(r.time);
    if (parsed) intervalMinutes = parsed;
  }
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) intervalMinutes = 60;
  return { ...r, type: 'interval', intervalMinutes };
}

function formatUpcomingTime(raw) {
  const item = normalizeReminder(raw);
  if (item.type === 'once') {
    const now = new Date();
    const target = new Date(item.scheduledDate);
    const diffMs = target - now;
    if (diffMs <= 0) return 'Expired';
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays >= 1) return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (diffHrs >= 1) return `In ${diffHrs} hour${diffHrs > 1 ? 's' : ''}`;
    return `In ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  }
  if (item.type === 'daily') {
    const now = new Date();
    const target = new Date();
    target.setHours(item.hour, item.minute, 0, 0);
    if (target < now) target.setDate(target.getDate() + 1);
    const diffMs = target - now;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs >= 1) return `In ${diffHrs} hour${diffHrs > 1 ? 's' : ''}`;
    return `In ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  }
  if (item.type === 'weekly') {
    const now = new Date();
    const target = new Date();
    const currentDay = now.getDay();
    const targetDay = item.weekDay || 1;
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0) {
      target.setHours(item.hour, item.minute, 0, 0);
      if (target < now) daysUntil = 7;
    }
    target.setDate(now.getDate() + daysUntil);
    target.setHours(item.hour, item.minute, 0, 0);
    const diffMs = target - now;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays >= 1) return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (diffHrs >= 1) return `In ${diffHrs} hour${diffHrs > 1 ? 's' : ''}`;
    return `In ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  }
  const mins = item.intervalMinutes || 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `In ${hrs} hour${hrs > 1 ? 's' : ''}`;
  }
  return `In ${mins} minute${mins !== 1 ? 's' : ''}`;
}

function getNextOccurrenceTime(raw) {
  const item = normalizeReminder(raw);
  if (item.type === 'once') {
    return item.scheduledDate;
  }
  if (item.type === 'daily') {
    const now = new Date();
    const target = new Date();
    target.setHours(item.hour, item.minute, 0, 0);
    if (target < now) target.setDate(target.getDate() + 1);
    return target.getTime();
  }
  if (item.type === 'weekly') {
    const now = new Date();
    const target = new Date();
    const currentDay = now.getDay();
    const targetDay = item.weekDay || 1;
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0) {
      target.setHours(item.hour, item.minute, 0, 0);
      if (target < now) daysUntil = 7;
    }
    target.setDate(now.getDate() + daysUntil);
    target.setHours(item.hour, item.minute, 0, 0);
    return target.getTime();
  }
  const mins = item.intervalMinutes || 60;
  return Date.now() + (mins * 60000);
}

export default function HomeScreen({ navigation }) {
  const { colors: navColors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  // Enable compact mode on smaller heights to avoid scrolling
  const compact = windowHeight < 800;
  const [session, setSession] = useState({ active: false, endAt: null, totalSeconds: null });
  const [remaining, setRemaining] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(true);
  const tickRef = useRef(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  // Periodic refresh so time labels update and one-time reminders disappear without navigation
  useEffect(() => {
    const interval = setInterval(() => {
      loadReminders();
    }, 30000); // every 30s
    return () => clearInterval(interval);
  }, [loadReminders]);

  const loadReminders = useCallback(
    withErrorHandling(async () => {
      setIsLoadingReminders(true);
      const list = await getReminders();
      const enabledReminders = (list || []).filter(r => r.enabled);
      // Normalize first to avoid in-place mutations when sorting
      const normalized = enabledReminders.map(normalizeReminder);
      
      // For Home display: Hide one-time reminders that have already passed
      const now = Date.now();
      const activeForDisplay = normalized.filter(reminder => {
        if (reminder.type === 'once' && reminder.scheduledDate) {
          return reminder.scheduledDate > now;
        }
        return true; // Show all repeating reminders
      });
      
      // Sort by next occurrence time
      const sortedReminders = activeForDisplay.sort((a, b) => getNextOccurrenceTime(a) - getNextOccurrenceTime(b));
      setReminders(sortedReminders);
      setIsLoadingReminders(false);
    }),
    []
  );

  useEffect(() => {
    (async () => {
      const s = await getSession();
      setSession(s);
      await loadReminders();
  const premium = await getPremiumStatus();
  setIsPremium(!!premium);
    })();
  }, [loadReminders]);

  // Reload reminders and premium when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadReminders();
      (async () => {
        const premium = await getPremiumStatus();
        setIsPremium(!!premium);
      })();
    }, [loadReminders])
  );

  useEffect(() => {
    if (!session?.active || !session?.endAt) { setRemaining(null); return; }
    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((session.endAt - now) / 1000));
      setRemaining(diff);
    };
    update();
    tickRef.current = setInterval(update, 1000);
    return () => { clearInterval(tickRef.current); };
  }, [session?.active, session?.endAt]);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={[styles.container, compact && { paddingBottom: 72 }]}
        >
        <View style={{ width: '100%', maxWidth: 520 }}>
          <View style={[styles.header, compact && { marginBottom: spacing.lg }]}>
          <View>
            <Text style={[styles.title, compact && { fontSize: typography['2xl'] } ]}>FocusFlow</Text>
            <Text style={[styles.subtitle, compact && { fontSize: typography.sm } ]}>Stay focused, stay productive</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {session.active && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            )}
            {isPremium && (
              <View style={styles.premiumBadge}>
                <CrownIcon size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.premiumText}>Premium</Text>
              </View>
            )}
          </View>
        </View>

        {/* Hero Card - Ready to Focus */}
        <View style={[styles.heroCard, compact && { marginBottom: spacing.lg, paddingVertical: spacing.lg }]}>
          <View style={[styles.heroTextSection, compact && { marginBottom: spacing.md }]}>
            <Text style={styles.heroTitle}>Ready to Focus?</Text>
            <Text style={styles.heroSubtitle}>Start a session to boost your productivity</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.playButtonWrapper, compact && { marginVertical: spacing.md }]}
            onPress={() => navigation.navigate('FocusSession')}
            accessibilityLabel="Start Focus Session"
            accessibilityRole="button"
          >
            <View style={[styles.playButtonOuter, compact && { width: 96, height: 96, borderRadius: 48 }]}>
              <View style={[styles.playButton, compact && { width: 64, height: 64, borderRadius: 32 }]}>
                <View style={styles.playIcon} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Start Section */}
        <View style={[styles.quickStartSection, compact && { marginBottom: spacing.lg }]}>
          <Text style={styles.sectionTitle}>Quick Start</Text>
          <View style={styles.quickStartGrid}>
            {[15, 25, 30, 45].map((minutes) => (
              <TouchableOpacity 
                key={minutes}
                style={[styles.quickStartButton, compact && { paddingVertical: spacing.sm }]}
                onPress={() => navigation.navigate('FocusSession', { presetDuration: minutes })}
              >
                <Text style={styles.quickStartText}>{minutes} min</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Upcoming Reminders Section */}
        <View style={[styles.remindersSection, compact && { marginBottom: spacing.lg }]}>
          <Text style={styles.sectionTitle}>Upcoming Reminders</Text>
          <View style={styles.remindersList}>
            {isLoadingReminders ? (
              <>
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </>
            ) : reminders.length > 0 ? (
              reminders.slice(0, 3).map((item, idx) => (
                <GlassCard 
                  key={item.id} 
                  tint="dark" 
                  intensity={40} 
                  style={[styles.reminderCard, idx < reminders.length - 1 && idx < 2 && { marginBottom: spacing.md }]}
                  contentStyle={[styles.reminderCardContent, compact && { padding: spacing.md, gap: spacing.sm }]}
                >
                  <View style={[styles.reminderIconWrapper, compact && { width: 40, height: 40 }]}>
                    <View style={[styles.reminderIcon, compact && { width: 40, height: 40, borderRadius: 20 }, { backgroundColor: getReminderColor(item, idx) }]}>
                      {getReminderIcon(item, idx)}
                    </View>
                  </View>
                  <View style={styles.reminderInfo}>
                    <Text style={styles.reminderTitle}>{item.text || item.title || 'Reminder'}</Text>
                    <Text style={styles.reminderTime}>{formatUpcomingTime(item)}</Text>
                  </View>
                </GlassCard>
              ))
            ) : (
              <GlassCard tint="dark" intensity={40} style={styles.reminderCard} contentStyle={[styles.reminderCardContent, compact && { padding: spacing.md }]}>
                <Text style={styles.noRemindersText}>No upcoming reminders</Text>
              </GlassCard>
            )}
          </View>
        </View>

        {/* Motivational Quote */}
        <View style={[styles.quoteSection, compact && { paddingVertical: spacing.md, marginTop: spacing.md }]}>
          <Text style={styles.quoteText}>"The secret of getting ahead is getting started."</Text>
          <Text style={styles.quoteAuthor}>— Mark Twain</Text>
        </View>
      </View>
      <PremiumModal
        visible={showPremium}
        onClose={() => setShowPremium(false)}
        onUpgrade={async () => { await setPremiumStatus(true); setIsPremium(true); setShowPremium(false); }}
      />
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: spacing.xl, 
    alignItems: 'center',
    paddingBottom: 100, // Extra space for tab bar
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: spacing.xl 
  },
  title: { 
    fontSize: typography['3xl'], 
    fontWeight: typography.extrabold, 
    letterSpacing: -1, 
    color: colors.foreground 
  },
  subtitle: { 
    fontSize: typography.base, 
    marginTop: 4, 
    color: colors.mutedForeground,
    fontWeight: typography.normal,
  },
  activeBadge: { 
    backgroundColor: colors.activeGreenBg, 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.activeGreen,
  },
  activeBadgeText: { 
    color: colors.activeGreen, 
    fontSize: typography.xs, 
    fontWeight: typography.semibold 
  },
  premiumBadge: { 
    backgroundColor: colors.premium, 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: radius.md, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  premiumText: { 
    color: '#fff', 
    fontSize: typography.xs, 
    fontWeight: typography.semibold 
  },
  // Hero Card Styles
  heroCard: {
    width: '100%',
    marginBottom: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  heroTextSection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  playButtonWrapper: {
    marginVertical: spacing.lg,
  },
  playButtonOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#0072ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 114, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 20,
    borderRightWidth: 0,
    borderTopWidth: 12,
    borderBottomWidth: 12,
    borderLeftColor: '#0072ff',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 4,
  },
  // Quick Start Section
  quickStartSection: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  quickStartGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  quickStartButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.foreground,
  },
  // Reminders Section
  remindersSection: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  remindersList: {
    width: '100%',
  },
  reminderCard: {
    width: '100%',
    borderRadius: radius.xl,
  },
  reminderCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  reminderIconWrapper: {
    width: 48,
    height: 48,
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: { 
    fontSize: typography.base, 
    fontWeight: typography.semibold, 
    marginBottom: 4, 
    color: colors.foreground 
  },
  reminderTime: { 
    fontSize: typography.sm, 
    color: colors.mutedForeground 
  },
  noRemindersText: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  // Quote Section
  quoteSection: {
    width: '100%',
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  quoteText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.foreground,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  quoteAuthor: {
    fontSize: typography.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
