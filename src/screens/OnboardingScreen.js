import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import UIButton from '../components/Ui/Button';
import GradientBackground from '../components/GradientBackground';
// Use the same glass component app-wide for consistency
import GlassCard from '../components/Ui/GlassCard';
import { BellIcon, ShieldIcon, CheckCircleIcon } from '../components/Icons';
import { colors, spacing, radius, typography } from '../theme';
import { safeDeviceActivityCall } from '../utils/deviceCompat';

// Import DeviceActivity for iOS
let DeviceActivity = null;
if (Platform.OS === 'ios') {
  try {
    DeviceActivity = require('react-native-device-activity');
  } catch (error) {
    console.log('[Onboarding] react-native-device-activity not available');
  }
}

export default function OnboardingScreen({ navigation, onComplete }) {
  const insets = useSafeAreaInsets();
  const [notificationStatus, setNotificationStatus] = useState(null); // null, 'granted', 'denied'
  const [screenTimeStatus, setScreenTimeStatus] = useState(null); // null, 'approved', 'denied'
  const [isLoading, setIsLoading] = useState(false);

  const requestNotificationPermission = async () => {
    try {
      setIsLoading(true);
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationStatus(status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Notifications Disabled',
          'Without notifications, you won\'t receive reminders or session completion alerts. You can enable them later in Settings.',
          [{ text: 'OK' }]
        );
      }
      setIsLoading(false);
      return status === 'granted';
    } catch (error) {
      console.log('[Onboarding] Notification permission error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const requestScreenTimePermission = async () => {
    if (!DeviceActivity || Platform.OS !== 'ios') {
      // On Android or if DeviceActivity not available, skip this
      setScreenTimeStatus('not-available');
      return true;
    }

    try {
      setIsLoading(true);
      const currentStatus = await safeDeviceActivityCall(() => DeviceActivity.getAuthorizationStatus(), 'denied');
      console.log('[Onboarding] Current Screen Time status:', currentStatus);
      
      if (currentStatus === 2 || currentStatus === 'approved') {
        setScreenTimeStatus('approved');
        setIsLoading(false);
        return true;
      }

      // Request authorization
      await safeDeviceActivityCall(() => DeviceActivity.requestAuthorization(), null);
      const newStatus = await safeDeviceActivityCall(() => DeviceActivity.getAuthorizationStatus(), 'denied');
      const isApproved = newStatus === 2 || newStatus === 'approved';
      
      setScreenTimeStatus(isApproved ? 'approved' : 'denied');
      
      if (!isApproved) {
        Alert.alert(
          'Screen Time Not Authorized',
          'Without Screen Time permission, FocusFlow cannot block distracting apps during focus sessions. Your sessions will run but apps won\'t be blocked.\n\nYou can enable this later in iPhone Settings > Screen Time.',
          [{ text: 'OK' }]
        );
      }
      
      setIsLoading(false);
      return isApproved;
    } catch (error) {
      console.log('[Onboarding] Screen Time permission error:', error);
      setScreenTimeStatus('denied');
      setIsLoading(false);
      return false;
    }
  };

  const handleRequestBoth = async () => {
    setIsLoading(true);
    await requestNotificationPermission();
    await requestScreenTimePermission();
    setIsLoading(false);
  };

  const handleContinue = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigation.replace('MainTabs');
    }
  };

  const bothGranted = notificationStatus === 'granted' && 
    (screenTimeStatus === 'approved' || screenTimeStatus === 'not-available');

  // Debug helpers
  const onLayoutCard = (label) => (e) => {
    const { width, height } = e.nativeEvent.layout || {};
  };
  const onLayoutContent = (label) => (e) => {
    const { width, height } = e.nativeEvent.layout || {};
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          {/* Top row: Progress indicators (left) + Skip (right) */}
          <View style={styles.topRow}>
            <View style={styles.progressPlaceholder} />
            <Text onPress={handleContinue} style={styles.skipText} accessibilityRole="button">Skip</Text>
          </View>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Welcome to <Text style={styles.titleHighlight}>FocusFlow</Text>
            </Text>
            <Text style={styles.subtitle}>
              To give you the best experience, <Text style={styles.subtitleHighlight}>FocusFlow</Text> needs a couple of permissions
            </Text>
          </View>

          {/* Permission Cards */}
          <View style={styles.permissionsContainer}>
            {/* Notifications Permission */}
            <View onLayout={onLayoutCard('Notifications card')}>
            <GlassCard tint="dark" intensity={40} cornerRadius={20} contentStyle={styles.permissionCard} style={styles.permissionCardSpacing}>
              <View style={styles.iconWrapper}>
                <BellIcon size={32} color={colors.primary} />
              </View>
              <View style={styles.permissionContent} onLayout={onLayoutContent('Notifications content')}>
                <Text style={styles.permissionTitle}>Notifications</Text>
                <Text style={styles.permissionDescription}>
                  Get reminders and alerts when your focus sessions complete
                </Text>
              </View>
              {notificationStatus === 'granted' && (
                <CheckCircleIcon size={24} color="#10b981" />
              )}
            </GlassCard>
            </View>

            {/* Screen Time Permission */}
            {Platform.OS === 'ios' && DeviceActivity && (
              <View onLayout={onLayoutCard('Screen Time card')}>
              <GlassCard tint="dark" intensity={40} cornerRadius={20} contentStyle={styles.permissionCard}>
                <View style={styles.iconWrapper}>
                  <ShieldIcon size={32} color={colors.primary} />
                </View>
                <View style={styles.permissionContent} onLayout={onLayoutContent('Screen Time content')}>
                  <Text style={styles.permissionTitle}>Screen Time</Text>
                  <Text style={styles.permissionDescription}>
                    Block distracting apps during your focus sessions
                  </Text>
                </View>
                {screenTimeStatus === 'approved' && (
                  <CheckCircleIcon size={24} color="#10b981" />
                )}
              </GlassCard>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={[styles.actions, { paddingBottom: insets.bottom + spacing['2xl'] }]}>
            {!bothGranted ? (
              <>
                <UIButton
                  title="Allow Permissions"
                  onPress={handleRequestBoth}
                  disabled={isLoading}
                  style={styles.primaryButton}
                />
              </>
            ) : (
              <UIButton
                title="Continue"
                onPress={handleContinue}
                style={styles.primaryButton}
              />
            )}
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              You can change these permissions anytime in Settings
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressPlaceholder: {
    height: 20,
    minWidth: 60,
  },
  skipText: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  header: {
    marginBottom: spacing['2xl'],
  },
  title: {
    fontSize: 32,
    fontWeight: typography.extrabold,
    color: colors.foreground,
    letterSpacing: -1,
    marginBottom: spacing.md,
  },
  titleHighlight: {
    color: colors.secondary, // Blue color for "FocusFlow"
  },
  subtitle: {
    fontSize: typography.lg,
    color: colors.mutedForeground,
    lineHeight: 28,
  },
  subtitleHighlight: {
    color: colors.secondary, // Blue color for "FocusFlow"
  },
  permissionsContainer: {
    flex: 1,
    marginTop: spacing['2xl'],
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    minHeight: 100,
  },
  permissionCardSpacing: {
    marginBottom: spacing.lg,
  },
  cardContent: {
    padding: 0, // Override default padding since we set it on permissionCard
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(137, 0, 245, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  permissionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: '#ffffff',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: typography.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  actions: {
    // Dynamic bottom padding applied inline using safe area inset
  },
  primaryButton: {
    height: 56,
  },
  secondaryButton: {
    height: 56,
    marginTop: spacing.md,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  footerText: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
