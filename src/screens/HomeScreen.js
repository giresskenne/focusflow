import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <View style={{ width: '100%', maxWidth: 520 }}>
          <View style={styles.header}>
          <View>
            <Text style={styles.title}>FocusFlow</Text>
            <Text style={styles.subtitle}>Stay focused, stay productive</Text>
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

        <View style={[styles.mainButton, { 
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
          shadowOpacity: 0.3,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }]}>
          <TouchableOpacity 
            style={styles.btnInner} 
            onPress={() => navigation.navigate('FocusSession')}
            accessibilityLabel="Start Focus Session"
            accessibilityHint="Navigate to focus session setup"
            accessibilityRole="button"
          >
            <ClockIcon size={20} color="#fff" />
            <Text style={styles.mainBtnText}>Start Focus Session</Text>
          </TouchableOpacity>
        </View>

        <GlassCard tint="dark" intensity={70} style={styles.mainButton}>
          <TouchableOpacity
            style={styles.btnInner}
            onPress={() => navigation.navigate('Reminders')}
            accessibilityLabel="Manage Reminders"
            accessibilityHint="Navigate to reminders setup"
            accessibilityRole="button"
          >
            <BellIcon size={20} color={colors.foreground} />
            <Text style={[styles.mainBtnText, { color: colors.foreground }]}>Manage Reminders</Text>
          </TouchableOpacity>
        </GlassCard>

        {(reminders.length > 0 || isLoadingReminders) && (
          <View style={{ marginTop: spacing['2xl'] }}>
            <Text style={styles.sectionHeader}>UPCOMING</Text>
            <GlassCard tint="dark" intensity={60} style={[styles.card, { maxHeight: 240 }]} contentStyle={{ padding: spacing.lg }}>
              <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                {isLoadingReminders ? (
                  // Show skeleton loaders while loading
                  <>
                    <SkeletonListItem />
                    <SkeletonListItem />
                    <SkeletonListItem />
                  </>
                ) : (
                  reminders.map((item, idx) => (
                    <View key={item.id}>
                      <View style={styles.reminderRow}>
                        <Text style={styles.reminderTitle}>{item.text || item.title || 'Reminder'}</Text>
                        <Text style={styles.reminderTime}>{formatUpcomingTime(item)}</Text>
                      </View>
                      {idx < reminders.length - 1 && <View style={styles.divider} />}
                    </View>
                  ))
                )}
              </ScrollView>
            </GlassCard>
          </View>
        )}

        <View style={styles.tilesRow}>
          <GlassCard tint="dark" intensity={60} style={styles.tile} contentStyle={styles.tileContent}>
            <TouchableOpacity
              style={styles.tilePressable}
              onPress={() => { isPremium ? navigation.navigate('Analytics') : setShowPremium(true); }}
              accessibilityLabel="Analytics"
              accessibilityHint={isPremium ? "View your focus analytics" : "Upgrade to premium for analytics"}
              accessibilityRole="button"
            >
              <BarChartIcon size={24} color={colors.primary} />
              <Text style={styles.tileLabel}>Analytics</Text>
            </TouchableOpacity>
          </GlassCard>
          <GlassCard tint="dark" intensity={60} style={styles.tile} contentStyle={styles.tileContent}>
            <TouchableOpacity
              style={styles.tilePressable}
              onPress={() => navigation.navigate('Settings')}
              accessibilityLabel="Settings"
              accessibilityHint="Navigate to app settings"
              accessibilityRole="button"
            >
              <SettingsIcon size={24} color={colors.foreground} />
              <Text style={styles.tileLabel}>Settings</Text>
            </TouchableOpacity>
          </GlassCard>
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
    fontWeight: typography.bold, 
    letterSpacing: -0.5, 
    color: colors.foreground 
  },
  subtitle: { 
    fontSize: typography.sm, 
    marginTop: 2, 
    color: colors.mutedForeground 
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
  mainButton: { 
    width: '100%', 
    height: 56, 
    borderRadius: radius.lg, 
    marginBottom: spacing.md 
  },
  btnInner: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: spacing.sm 
  },
  mainBtnText: { 
    fontSize: typography.base, 
    fontWeight: typography.semibold, 
    color: '#FFFFFF' 
  },
  sectionHeader: { 
    fontSize: typography.xs, 
    fontWeight: typography.semibold, 
    color: colors.mutedForeground, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5, 
    marginBottom: spacing.sm 
  },
  card: { 
    borderRadius: radius.xl
  },
  reminderRow: { 
    paddingVertical: 10 
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
  divider: { 
    height: 1, 
    backgroundColor: colors.glassBorder, 
    marginVertical: 4 
  },
  tilesRow: { 
    flexDirection: 'row', 
    gap: spacing.md, 
    marginTop: spacing.xl 
  },
  tile: { 
    flex: 1, 
    height: 100, 
    borderRadius: radius.xl
  },
  tileLabel: { 
    fontSize: typography.sm, 
    fontWeight: typography.semibold, 
    marginTop: 6, 
    color: colors.foreground 
  },
  tileContent: { 
    flex: 1, 
    padding: 0 
  },
  tilePressable: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
});
