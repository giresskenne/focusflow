import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import UIButton from '../components/Ui/Button';
import AppBlocker from '../../components/AppBlocker';
import { getSelectedApps, setSession, appendSessionRecord } from '../storage';
import { formatSeconds } from '../utils/time';
import { XIcon, AlertCircleIcon, TargetIcon, CameraIcon, MessageIcon, UserIcon, MusicIcon, PlayIcon } from '../components/Icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import GradientBackground from '../components/GradientBackground';
import GlassCard from '../components/Ui/GlassCard';

const MOCK_APPS = [
  { id: 'com.social.app', name: 'Instagram', Icon: CameraIcon },
  { id: 'com.twitter', name: 'Twitter', Icon: MessageIcon },
  { id: 'com.facebook', name: 'Facebook', Icon: UserIcon },
  { id: 'com.tiktok', name: 'TikTok', Icon: MusicIcon },
  { id: 'com.whatsapp', name: 'WhatsApp', Icon: MessageIcon },
];

export default function ActiveSessionScreen({ navigation, route }) {
  const duration = route?.params?.durationSeconds || 25 * 60;
  const [seconds, setSeconds] = useState(duration);
  const intervalRef = useRef(null);
  const { colors: navColors } = useTheme();
  const [startAt, setStartAt] = useState(Date.now());
  const [apps, setApps] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const blockingAvailable = AppBlocker?.isAvailable === true;

  useEffect(() => {
    const now = Date.now();
    setStartAt(now);
    let endAt = now + duration * 1000;
    (async () => {
      try {
        const map = await getSelectedApps();
        const appIds = Object.entries(map)
          .filter(([, on]) => !!on)
          .map(([id]) => id);
        setApps(appIds);
        // Only attempt native flows if the bridge is available
        if (blockingAvailable) {
          // Prepare FamilyControls authorization in dev builds
          await AppBlocker.requestAuthorization?.();
          await AppBlocker.startBlocking(appIds);
        }
        await setSession({ active: true, endAt, totalSeconds: duration });
      } catch {}
    })();
    intervalRef.current = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => {
      clearInterval(intervalRef.current);
      if (blockingAvailable) {
        AppBlocker.stopBlocking().catch(() => {});
      }
      setSession({ active: false, endAt: null, totalSeconds: null }).catch(() => {});
    };
  }, [duration]);

  // Auto-complete when timer hits zero
  useEffect(() => {
    if (seconds === 0) {
      (async () => {
        try {
          const endAt = Date.now();
          await appendSessionRecord({
            id: String(endAt),
            startAt,
            endAt,
            durationSeconds: duration,
            endedEarly: false,
            apps,
          });
        } catch {}
        navigation.goBack();
      })();
    }
  }, [seconds]);

  const { minutes, seconds: secs } = formatSeconds(seconds);
  const progress = (seconds / duration) * 100;
  
  // Circular progress calculations
  const size = 220;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  const endEarly = async () => {
    try {
      const runSeconds = duration - seconds;
      const endAt = Date.now();
      await appendSessionRecord({
        id: String(endAt),
        startAt,
        endAt,
        durationSeconds: Math.max(1, runSeconds),
        endedEarly: true,
        apps,
      });
    } catch {}
    navigation.goBack();
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.container}>
        <View style={{ width: '100%', maxWidth: 520 }}>
          {/* Large Timer Card with Circular Progress */}
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>TIME REMAINING</Text>
            
            {/* Circular Progress */}
            <View style={styles.circularProgressContainer}>
              <Svg width={size} height={size} style={styles.circularProgress}>
                {/* Background circle */}
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                {/* Progress circle */}
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="#0072ff"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              </Svg>
              {/* Timer text in center */}
              <View style={styles.timerTextContainer}>
                <Text style={styles.timerDisplay}>{minutes}:{secs}</Text>
              </View>
            </View>
          </View>

          {/* Build capability notice (shows in Expo Go or non-native builds) */}
          {!blockingAvailable && (
            <View style={[styles.noticeBanner, shadows.sm]}>
              <AlertCircleIcon size={18} color={colors.warning} />
              <Text style={styles.noticeText}>
                App blocking isn’t active in this build (Expo Go). Use an iOS dev build with DeviceActivity to enforce blocking.
              </Text>
            </View>
          )}

          {/* Blocked Apps */}
          <View style={{ marginTop: spacing['2xl'] }}>
            <Text style={styles.sectionHeader}>BLOCKED APPS</Text>
            <View style={styles.appChipsRow}>
              {apps.slice(0, 5).map((appId) => {
                const app = MOCK_APPS.find((a) => a.id === appId);
                const AppIcon = app?.Icon || CameraIcon;
                return (
                  <View key={appId} style={[styles.appChip, shadows.sm]}>
                    <AppIcon size={16} color={colors.foreground} />
                    <Text style={styles.appChipText}>{app?.name || 'App'}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Stay Focused Card */}
          <GlassCard tint="dark" intensity={40} cornerRadius={20} contentStyle={styles.motivationContent} style={styles.motivationCardOuter}>
            <View style={styles.targetIconWrapper}>
              <TargetIcon size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.motivationTitle}>Stay focused!</Text>
              <Text style={styles.motivationText}>
                You're doing great. Keep your momentum going.
              </Text>
            </View>
          </GlassCard>
        </View>
        </ScrollView>
      </SafeAreaView>

      {/* End Session Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.endButton, shadows.sm]}
          onPress={() => setShowConfirm(true)}
        >
          <XIcon size={20} color={colors.destructive} />
          <Text style={styles.endButtonText}>End Session Early</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard tint="dark" intensity={60} cornerRadius={24} contentStyle={{ padding: spacing['2xl'] }} style={{ width: '100%', maxWidth: 400 }}>
            <View style={styles.modalHeader}>
              <View style={styles.alertIconWrapper}>
                <AlertCircleIcon size={24} color={colors.destructive} />
              </View>
              <Text style={styles.modalTitle}>End Session Early?</Text>
            </View>
            <Text style={styles.modalDescription}>
              Are you sure you want to end this focus session? You still have {minutes}:{secs} remaining. Ending early will break your focus streak.
            </Text>
            <View style={styles.modalActions}>
              <UIButton
                title="Keep Focusing"
                variant="outline"
                onPress={() => setShowConfirm(false)}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <UIButton
                title="End Session"
                variant="danger"
                onPress={endEarly}
                style={{ flex: 1, marginLeft: spacing.sm }}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, alignItems: 'center' },
  timerCard: {
    width: '100%',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.lg,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: typography.bold,
    color: '#fff',
    letterSpacing: -1,
    textAlign: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#fff',
    borderRadius: radius.full,
  },
  sectionHeader: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  appChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  appChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appChipText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.foreground,
  },
  motivationCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.muted,
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginTop: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motivationTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.foreground,
    marginBottom: 4,
  },
  motivationText: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
  },
  endButtonText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.destructive,
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  alertIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,59,48,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.foreground,
    flex: 1,
  },
  modalDescription: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
  },
  noticeBanner: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: 'rgba(255,223,128,0.12)',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,223,128,0.3)',
    marginTop: spacing.lg,
  },
  noticeText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.foreground,
    lineHeight: 20,
  },
  circularProgressContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  circularProgress: {
    transform: [{ rotate: '0deg' }],
  },
  timerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  motivationCardOuter: { marginTop: spacing['2xl'] },
  motivationContent: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
});
