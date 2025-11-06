import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UIButton from '../components/Ui/Button';
import PremiumModal from '../components/PremiumModal';
import { performUpgrade } from '../lib/premiumUpgrade';
import GlassCard from '../components/Ui/GlassCard';
import GradientBackground from '../components/GradientBackground';
import VoiceTutorialModal from '../components/ai/VoiceTutorialModal';
import VoiceHint from '../components/ai/VoiceHint';
import { getSession, getReminders, getPremiumStatus, setPremiumStatus, getVoiceTutorialCompleted, setVoiceTutorialCompleted } from '../storage';
import { ClockIcon, BellIcon, BarChartIcon, SettingsIcon, CrownIcon } from '../components/Icons';
import { colors, spacing, radius, typography, shadows, controlSizes, effects } from '../theme';
import { SkeletonListItem } from '../components/SkeletonLoader';
import { withErrorHandling } from '../utils/errorHandling';

// Helper functions for reminder styling
function getReminderColor(item, index) {
  // Cycle through colors based on reminder type or index
  const colors = ['#3b82f6', '#f59e0b', '#8900f5', '#ec4899', '#06b6d4'];
  return colors[index % colors.length];
}

// Choose an Ionicons name based on reminder text content
function getReminderIcon(item, index) {
  try {
    const text = String(item?.text || item?.title || '').toLowerCase();
    if (!text) {
      // Fallback to rotating set when no text
      const fallback = ['water-outline', 'cafe-outline', 'book-outline'];
      return fallback[index % fallback.length] || 'notifications-outline';
    }

    const includesAny = (arr) => arr.some((k) => text.includes(k));

    // 1) Medication / health intake
    if (includesAny(['medication', 'medicine', 'pill', 'pills', 'tablet', 'vitamin', 'supplement', 'insulin', 'drops', 'ointment'])) {
      return 'medkit-outline';
    }
    // 2) Health measurement (bp, glucose)
    if (includesAny(['blood pressure', 'bp', 'glucose', 'sugar level', 'oxygen', 'spo2', 'heartbeat'])) {
      return 'pulse-outline';
    }
    // 3) Hydration
    if (includesAny(['drink water', 'hydration', 'hydrate', 'water', 'h2o'])) {
      return 'water-outline';
    }
    // 4) Coffee/Tea/Caffeine
    if (includesAny(['coffee', 'espresso', 'latte', 'cappuccino', 'tea', 'caffeine'])) {
      return 'cafe-outline';
    }
    // 5) Meals / Eating
    if (includesAny(['breakfast', 'lunch', 'dinner', 'meal', 'snack', 'eat', 'protein'])) {
      return 'restaurant-outline';
    }
    // 6) Cooking / Groceries specific
    if (includesAny(['cook', 'recipe', 'prep', 'meal prep', 'grocery', 'groceries', 'supermarket', 'buy milk', 'shopping list'])) {
      return includesAny(['grocery', 'groceries', 'supermarket', 'shopping']) ? 'cart-outline' : 'pizza-outline';
    }
    // 7) Sleep / Rest
    if (includesAny(['sleep', 'bed', 'nap', 'bedtime', 'go to bed', 'wake up'])) {
      return 'bed-outline';
    }
    // 8) Workout / Exercise
    if (includesAny(['workout', 'exercise', 'gym', 'run', 'jog', 'yoga', 'swim', 'cycling', 'ride', 'pushup', 'push-ups', 'squats'])) {
      return 'barbell-outline';
    }
    // 9) Stretch / Posture / Stand up
    if (includesAny(['stretch', 'posture', 'stand up', 'mobility'])) {
      return 'body-outline';
    }
    // 10) Study / Exam / Homework
    if (includesAny(['study', 'exam', 'homework', 'learn', 'course', 'class', 'lecture', 'revision', 'revise', 'flashcards'])) {
      return 'school-outline';
    }
    // 11) Reading
    if (includesAny(['read', 'reading', 'book', 'novel', 'article', 'papers'])) {
      return 'book-outline';
    }
    // 12) Focused work / Pomodoro
    if (includesAny(['focus', 'deep work', 'pomodoro', 'concentrate', 'coding', 'code'])) {
      return 'timer-outline';
    }
    // 13) Meeting (general)
    if (includesAny(['meeting', 'meet', 'standup', 'stand-up', 'stand up meeting'])) {
      return 'people-outline';
    }
    // 14) Call / Phone
    if (includesAny(['call', 'phone', 'dial', 'ring'])) {
      return 'call-outline';
    }
    // 15) Email / Inbox
    if (includesAny(['email', 'inbox', 'reply', 'send mail', 'compose'])) {
      return 'mail-outline';
    }
    // 16) Appointments (doctor, dentist, therapist)
    if (includesAny(['appointment', 'doctor', 'dentist', 'therapist', 'physio', 'clinic', 'hospital'])) {
      return text.includes('dentist') ? 'ear-outline' : 'calendar-outline';
    }
    // 17) Finance / Bills / Budget
    if (includesAny(['bill', 'bills', 'rent', 'mortgage', 'loan', 'credit card', 'payment', 'pay bill', 'invoice', 'budget'])) {
      return 'card-outline';
    }
    // 18) Chores / Cleaning
    if (includesAny(['clean', 'tidy', 'vacuum', 'sweep', 'mop', 'dishes', 'dishwasher', 'trash', 'garbage', 'recycle'])) {
      if (includesAny(['trash', 'garbage', 'recycle'])) return 'trash-outline';
      return 'brush-outline';
    }
    // 19) Laundry / Clothes
    if (includesAny(['laundry', 'wash clothes', 'wash clothing', 'dryer', 'fold clothes'])) {
      return 'shirt-outline';
    }
    // 20) Transportation / Commute
    if (includesAny(['commute', 'drive', 'driving', 'car', 'bus', 'train', 'subway', 'uber', 'lyft'])) {
      return 'car-outline';
    }
    // 21) Social / Birthday / Anniversary
    if (includesAny(['birthday', 'anniversary', 'party', 'celebration', 'gift'])) {
      return 'gift-outline';
    }
    // 22) Mindfulness / Meditation / Breathing
    if (includesAny(['meditate', 'meditation', 'breath', 'breathing', 'mindfulness'])) {
      return 'leaf-outline';
    }
    // 23) Writing / Journal
    if (includesAny(['journal', 'write', 'writing', 'notes'])) {
      return 'create-outline';
    }
    // 24) Tech / Computer maintenance
    if (includesAny(['backup', 'update', 'deploy', 'commit', 'push', 'git'])) {
      return 'cloud-upload-outline';
    }

    // Fallback rotating set (keeps backward compatibility)
    const fallback = ['notifications-outline', 'time-outline', 'alarm-outline'];
    return fallback[index % fallback.length] || 'notifications-outline';
  } catch {
    return 'notifications-outline';
  }
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
  const insets = useSafeAreaInsets();
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const tabBarHeight = useBottomTabBarHeight();
  const [session, setSession] = useState({ active: false, endAt: null, totalSeconds: null });
  const [remaining, setRemaining] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(true);
  const tickRef = useRef(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showVoiceTutorial, setShowVoiceTutorial] = useState(false);
  const [showVoiceHint, setShowVoiceHint] = useState(true);
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const coronaAnim = useRef(new Animated.Value(0)).current;
  const orbit1 = useRef(new Animated.Value(0)).current;
  const orbit2 = useRef(new Animated.Value(0)).current;
  const orbit3 = useRef(new Animated.Value(0)).current;
  const orbit4 = useRef(new Animated.Value(0)).current;
  const star1 = useRef(new Animated.Value(0)).current;
  const star2 = useRef(new Animated.Value(0)).current;
  const star3 = useRef(new Animated.Value(0)).current;

  // Bouncing animation for play button idle pulse
  useEffect(() => {
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    bounce.start();
    const spin = Animated.loop(
      Animated.timing(coronaAnim, { toValue: 1, duration: 4000, useNativeDriver: true })
    );
    spin.start();

    // Orbits rotation loops
    const loop = (val, duration) =>
      Animated.loop(Animated.timing(val, { toValue: 1, duration, useNativeDriver: true }));
    const o1 = loop(orbit1, 4000); o1.start();
    const o2 = loop(orbit2, 6000); o2.start();
    const o3 = loop(orbit3, 8000); o3.start();
    const o4 = loop(orbit4, 10000); o4.start();

    // Stars twinkle
    const twinkle = (v, duration, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration, delay, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration, useNativeDriver: true }),
        ])
      );
    const s1 = twinkle(star1, 1500);
    const s2 = twinkle(star2, 1800, 400);
    const s3 = twinkle(star3, 1700, 700);
    s1.start(); s2.start(); s3.start();

    return () => { bounce.stop(); spin.stop(); o1.stop(); o2.stop(); o3.stop(); o4.stop(); s1.stop(); s2.stop(); s3.stop(); };
  }, [bounceAnim]);

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
      
      // Check if voice tutorial should be shown
      const tutorialCompleted = await getVoiceTutorialCompleted();
      if (!tutorialCompleted) {
        // Show tutorial after a brief delay to let the home screen load
        setTimeout(() => {
          setShowVoiceTutorial(true);
        }, 500);
      }
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
          contentContainerStyle={[
            styles.container, 
            compact && { paddingBottom: tabBarHeight + spacing.md }
          ]}
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
        >
        <View 
          style={{ width: '100%', maxWidth: 520 }}
          onLayout={(e) => {
            const contentHeight = e.nativeEvent.layout.height;
            // Calculate available space: window height - top inset - tab bar height
            const available = windowHeight - insets.top - tabBarHeight;
            setScrollEnabled(contentHeight > available);
          }}
        >
          <View style={[styles.header, compact && { marginBottom: spacing.md }]}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.title, compact && { fontSize: 28 }]}>FocusFlow</Text>
          </View>
          <View style={{ position: 'absolute', right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
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

        {/* Voice Hint - Show contextual voice command examples */}
        {showVoiceHint && (
          <VoiceHint 
            context="home" 
            onDismiss={() => setShowVoiceHint(false)}
          />
        )}

        {/* Hero Card - Ready to Focus */}
        <View style={[styles.heroCard, compact && { marginBottom: spacing.sm, paddingVertical: spacing.sm }]}>
          <View style={[styles.heroTextSection, compact && { marginBottom: spacing.sm }]}>
            <Text style={styles.heroTitle}>Ready to Focus?</Text>
            <Text style={styles.heroSubtitle}>Start a session to boost your productivity</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.playButtonWrapper, compact && { marginVertical: spacing.xs }]}
            onPress={() => navigation.navigate('FocusSession')}
            onPressIn={() => Animated.timing(bounceAnim, { toValue: 0.9, duration: 120, useNativeDriver: true }).start()}
            onPressOut={() => Animated.timing(bounceAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start()}
            accessibilityLabel="Start Focus Session"
            accessibilityRole="button"
            activeOpacity={0.8}
          >
            <Animated.View
              style={[styles.playSystem, { transform: [{ scale: bounceAnim }] }]}
            >
              {/* soft outer halo */}
              <View style={styles.playHalo} />
              <View style={styles.playHaloBlue} />
              {/* orbit rings (outer blue, inner purple) */}
              <View style={styles.playRingBlue} />
              <View style={styles.playRingPurple} />
              {/* faint extra rings handled by animated orbits below */}
              {/* inner gradient button */}
              <LinearGradient
                colors={[colors.secondary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.playInner}
              >
                {/* subtle top highlight + inner dark disc to match reference */}
                <View style={styles.playHighlight} />
                <View style={styles.playTriangle} />
              </LinearGradient>
              {/* rotating corona */}
              <Animated.View
                style={[
                  styles.playCorona,
                  {
                    transform: [{
                      rotate: coronaAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
                    }]
                  }
                ]}
              />

              {/* Animated orbits with planets */}
              {(() => {
                const base = controlSizes.play.outer; // 120 default
                const defs = [
                  { key: 'mercury', mul: 0.95, dur: 4000, dot: 6, colors: ['#d1d5db', '#9ca3af'] },
                  { key: 'venus',   mul: 1.17, dur: 6000, dot: 7, colors: ['#fef3c7', '#fcd34d'] },
                  { key: 'earth',   mul: 1.42, dur: 8000, dot: 8, colors: ['#60a5fa', '#34d399'] },
                  { key: 'mars',    mul: 1.75, dur: 10000, dot: 7, colors: ['#f87171', '#dc2626'] },
                ];
                const vals = [orbit1, orbit2, orbit3, orbit4];
                return defs.map((o, idx) => {
                  const size = Math.round(base * o.mul);
                  const rotate = vals[idx].interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
                  return (
                    <Animated.View 
                      key={o.key} 
                      style={[
                        styles.orbit, 
                        { 
                          width: size, 
                          height: size, 
                          transform: [{ rotate }],
                          borderColor: `rgba(255,255,255, ${0.12 - idx * 0.02})`
                        }
                      ]}
                    >
                      <LinearGradient colors={o.colors} start={{x:0,y:0}} end={{x:1,y:1}} style={{ width: o.dot, height: o.dot, borderRadius: o.dot/2, transform: [{ translateX: size/2 }], shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6 }} />
                    </Animated.View>
                  );
                });
              })()}

              {/* Stars */}
              <Animated.View style={[styles.star, { left: '25%', top: '25%', transform: [{ scale: star1.interpolate({ inputRange: [0,1], outputRange: [1, 2] }) }], opacity: star1.interpolate({ inputRange: [0,1], outputRange: [1, 0] }) }]} />
              <Animated.View style={[styles.star, { left: '33%', bottom: '22%', transform: [{ scale: star2.interpolate({ inputRange: [0,1], outputRange: [1, 2] }) }], opacity: star2.interpolate({ inputRange: [0,1], outputRange: [1, 0] }) }]} />
              <Animated.View style={[styles.star, { right: '25%', top: '33%', transform: [{ scale: star3.interpolate({ inputRange: [0,1], outputRange: [1, 2] }) }], opacity: star3.interpolate({ inputRange: [0,1], outputRange: [1, 0] }) }]} />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Quick Start Section */}
        <View style={[styles.quickStartSection, compact && { marginBottom: spacing['3xl'] }]}>
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
        <View style={[styles.remindersSection, compact && { marginBottom: spacing.xs }]}>
          <Text style={styles.sectionTitle}>Upcoming Reminders</Text>
          <View style={styles.remindersList}>
            {isLoadingReminders ? (
              <>
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </>
            ) : reminders.length > 0 ? (
              reminders.slice(0, 2).map((item, idx) => (
                <GlassCard 
                  key={item.id} 
                  tint="dark" 
                  intensity={40} 
                  style={[styles.reminderCard, idx < reminders.length - 1 && idx < 1 && { marginBottom: spacing.sm }]}
                  contentStyle={[styles.reminderCardContent, compact && { padding: spacing.sm, gap: spacing.sm }]}
                >
                  <View style={[styles.reminderIconWrapper, compact && { width: 36, height: 36 }]}>
                    <View style={[styles.reminderIcon, compact && { width: 36, height: 36, borderRadius: 18 }, { backgroundColor: getReminderColor(item, idx) }]}>
                      <Ionicons name={getReminderIcon(item, idx)} size={18} color="#fff" />
                    </View>
                  </View>
                  <View style={styles.reminderInfo}>
                    <Text style={[styles.reminderTitle, compact && { fontSize: typography.sm, marginBottom: 2 }]}>{item.text || item.title || 'Reminder'}</Text>
                    <Text style={[styles.reminderTime, compact && { fontSize: typography.xs }]}>{formatUpcomingTime(item)}</Text>
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
        <View style={[styles.quoteSection, compact && { paddingVertical: spacing.sm, marginTop: 0 }]}>
          <Text style={[styles.quoteText, compact && { fontSize: typography.xs }]}>"The secret of getting ahead is getting started."</Text>
          <Text style={[styles.quoteAuthor, compact && { fontSize: typography.xs }]}>— Mark Twain</Text>
        </View>
      </View>
      <PremiumModal
        visible={showPremium}
        onClose={() => setShowPremium(false)}
        onUpgrade={async (plan) => {
          const ok = await performUpgrade(plan, { onRequireSignIn: () => navigation.navigate('SignIn') });
          if (ok) {
            setIsPremium(true);
            setShowPremium(false);
          }
        }}
      />
      
      {/* Voice Tutorial Modal */}
      <VoiceTutorialModal
        visible={showVoiceTutorial}
        onClose={() => setShowVoiceTutorial(false)}
        onComplete={async () => {
          await setVoiceTutorialCompleted(true);
          setShowVoiceTutorial(false);
        }}
      />
      
      {/* Mic button now rendered globally from TabNavigator */}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: spacing.xl, 
    alignItems: 'center',
    paddingBottom: 24, // small cushion; tab bar height handled dynamically
  },
  header: { 
    width: '100%',
    flexDirection: 'row', 
    justifyContent: 'center',
    alignItems: 'center', 
    marginBottom: spacing.lg,
    position: 'relative',
  },
  title: { 
    fontSize: 32, // 2/3 of original 48px (3xl)
    fontWeight: typography.extrabold, 
    letterSpacing: -0.5, 
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
    marginBottom: spacing['3xl'],
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
  // Larger wrapper so orbits can render around the play sun
  playSystem: {
    width: Math.round(controlSizes.play.outer * 2.2),
    height: Math.round(controlSizes.play.outer * 2.2),
    borderRadius: Math.round(controlSizes.play.outer * 1.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHalo: {
    position: 'absolute',
    width: controlSizes.play.outer,
    height: controlSizes.play.outer,
    borderRadius: controlSizes.play.outer / 2,
    backgroundColor: 'rgba(137,0,245,0.14)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
  },
  playHaloBlue: {
    position: 'absolute',
    width: controlSizes.play.outer,
    height: controlSizes.play.outer,
    borderRadius: controlSizes.play.outer / 2,
    backgroundColor: 'rgba(0,114,255,0.09)',
  },
  playRingBlue: {
    position: 'absolute',
    width: controlSizes.play.ring2,
    height: controlSizes.play.ring2,
    borderRadius: controlSizes.play.ring2 / 2,
    borderWidth: 1.5,
    borderColor: effects.ringBlue,
  },
  playRingPurple: {
    position: 'absolute',
    width: controlSizes.play.ring1,
    height: controlSizes.play.ring1,
    borderRadius: controlSizes.play.ring1 / 2,
    borderWidth: 1.5,
    borderColor: effects.ringPurple,
  },
  playInner: {
    width: controlSizes.play.inner,
    height: controlSizes.play.inner,
    borderRadius: controlSizes.play.inner / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
  },
  playCorona: {
    position: 'absolute',
    width: controlSizes.play.inner,
    height: controlSizes.play.inner,
    borderRadius: controlSizes.play.inner / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    opacity: 0.5,
  },
  orbit: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    position: 'absolute',
    width: 3,
    height: 3,
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  playInnerDisc: {
    position: 'absolute',
    width: controlSizes.play.inner - 18,
    height: controlSizes.play.inner - 18,
    borderRadius: (controlSizes.play.inner - 18) / 2,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  playHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    borderTopLeftRadius: controlSizes.play.inner / 2,
    borderTopRightRadius: controlSizes.play.inner / 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    opacity: 0.25,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: controlSizes.play.icon,
    borderRightWidth: 0,
    borderTopWidth: controlSizes.play.icon * 0.6,
    borderBottomWidth: controlSizes.play.icon * 0.6,
    borderLeftColor: '#60a5fa',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 6,
  },
  // Quick Start Section
  quickStartSection: {
    width: '100%',
    marginBottom: spacing['3xl'],
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
