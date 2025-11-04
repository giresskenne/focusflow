import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getPremiumStatus, setPremiumStatus, getSettings, updateSettings, getAuthUser, clearAuthUser, hasLocalData, getMigrationFlag, setMigrationFlag, exportUserData, clearUserData } from '../storage';
import MigrationPrompt from '../components/MigrationPrompt';
import DataSyncPrompt from '../components/DataSyncPrompt';
import { performMigrationUpload, pullCloudToLocal, hasCloudData } from '../lib/sync';
import { getSupabase } from '../lib/supabase';
import PremiumModal from '../components/PremiumModal';
import IAP from '../lib/iap';
import StoreKitTest from '../lib/storekeittest';
import { performUpgrade } from '../lib/premiumUpgrade';
import {
  CrownIcon,
  BellIcon,
  PaletteIcon,
  ShieldIcon,
  HelpCircleIcon,
  InfoIcon,
  LogOutIcon,
  ChevronRightIcon,
} from '../components/Icons';
import Switch from '../components/Ui/Switch';
import { colors, spacing, radius, typography } from '../theme';
import AppBlocker from '../components/AppBlocker';
import GradientBackground from '../components/GradientBackground';
import GlassCard from '../components/Ui/GlassCard';
import { seedDevAliases, clearDevAliases } from '../utils/devAliasSeeder';

export default function SettingsScreen({ navigation }) {
  const [isPremium, setIsPremium] = useState(false);
  const [reminderNotifs, setReminderNotifs] = useState(true);
  const [sessionNotifs, setSessionNotifs] = useState(true);
  const [motivationMsgs, setMotivationMsgs] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [authUser, setAuthUserState] = useState(null);
  const [showMigration, setShowMigration] = useState(false);
  const [hasCheckedMigration, setHasCheckedMigration] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const [notifPerm, setNotifPerm] = useState({ status: 'unknown', canAskAgain: true });
  const [screenTimePerm, setScreenTimePerm] = useState('unknown'); // 'approved' | 'denied' | 'unknown' | 'not-available'

  // Feature flag: enable actual cloud upload when explicitly turned on
  const ENABLE_MIGRATION_UPLOAD = process.env.EXPO_PUBLIC_ENABLE_MIGRATION_UPLOAD === 'true';
  const ENABLE_IOS_BLOCKING_DEV = process.env.EXPO_PUBLIC_ENABLE_IOS_BLOCKING_DEV === 'true';
  const AI_VOICE_ENABLED = process.env.EXPO_PUBLIC_AI_VOICE_ENABLED === 'true';
  const IS_DEV = process.env.EXPO_PUBLIC_ENV === 'development';

  useEffect(() => {
    (async () => {
      const storedUser = await getAuthUser();
      
      // If no user is signed in, ensure premium is false
      if (!storedUser) {
        await setPremiumStatus(false);
        setIsPremium(false);
      } else {
        // User is signed in, load their actual premium status
        const premium = await getPremiumStatus();
        setIsPremium(premium);
      }
      
      const settings = await getSettings();
      setReminderNotifs(settings.reminderNotifications);
      setSessionNotifs(settings.sessionNotifications);
      setMotivationMsgs(settings.motivationMessages);
      setAnalytics(settings.analytics);

      setAuthUserState(storedUser);

      // Load permissions
      try {
        const np = await Notifications.getPermissionsAsync();
        setNotifPerm({ status: np.status, canAskAgain: np.canAskAgain ?? true });
      } catch {}

      try {
        let status = 'not-available';
        if (Platform.OS === 'ios') {
          let DeviceActivity = null;
          try { DeviceActivity = require('react-native-device-activity'); } catch {}
          if (DeviceActivity) {
            const s = DeviceActivity.getAuthorizationStatus();
            status = (s === 2 || s === 'approved') ? 'approved' : (s === 1 || s === 'denied') ? 'denied' : 'unknown';
          }
        }
        setScreenTimePerm(status);
      } catch {}
    })();
  }, []);

  // Refresh account state whenever Settings screen regains focus (e.g., after Sign In)
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        const storedUser = await getAuthUser();
        if (isActive) setAuthUserState(storedUser);

        // If no user, ensure premium is false (subscriptions require account)
        if (!storedUser && isActive) {
          await setPremiumStatus(false);
          setIsPremium(false);
        }

        // If signed in, check migration prompt conditions
        if (storedUser && isActive) {
          const [alreadyMigrated, local, cloud] = await Promise.all([
            getMigrationFlag(storedUser.id),
            hasLocalData(),
            hasCloudData(storedUser.id).catch(() => false),
          ]);
          if (!alreadyMigrated && local) {
            setShowMigration(true);
          }
          // If no local data, try pulling from cloud automatically (read-only)
          if (!local) {
            try {
              const pulled = await pullCloudToLocal(storedUser.id);
              if (pulled) {
                Alert.alert('Synced', 'We loaded your data from your account.');
              }
            } catch (e) {
              console.warn('[Sync] pull failed:', e?.message || e);
            }
          } else if (!alreadyMigrated && local && cloud) {
            // Both exist: prompt the user to choose
            setShowSyncPrompt(true);
          }
          setHasCheckedMigration(true);
        } else if (isActive) {
          setHasCheckedMigration(true);
        }
      })();
      return () => { isActive = false; };
    }, [])
  );

  const updateSetting = async (key, value) => {
    await updateSettings({ [key]: value });
  };

  const handlePremiumPress = () => {
    console.log('[Settings] Upgrade pressed. IAP ready?', IAP.isReady());
    setShowPremium(true);
  };

  const [showPremium, setShowPremium] = useState(false);

  const handleRateApp = () => {
    Alert.alert('Rate FocusFlow', 'Rate us on the App Store!');
  };

  const handleExportData = async () => {
    try {
      const data = await exportUserData();
      const json = JSON.stringify(data, null, 2);
      // For now, just preview in an alert summary for MVP. Later, share via Files/Share sheet.
      Alert.alert('Export Ready', `Data size: ${json.length} bytes. Copy available in console.`);
      console.log('[Export]', json);
    } catch (e) {
      Alert.alert('Export Failed', e?.message || 'Could not export your data.');
    }
  };

  const handleWipeData = async () => {
    Alert.alert(
      'Erase Local Data?',
      'This will remove reminders, app selections, analytics, and settings from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            await clearUserData();
            Alert.alert('Erased', 'Local data cleared.');
          },
        },
      ]
    );
  };

  const handleSignIn = () => {
    navigation.navigate('SignIn');
  };

  const handleSignOut = async () => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {}
    
    // Clear auth user and premium status (subscriptions are account-based)
    await clearAuthUser();
    await setPremiumStatus(false);
    
    // Log out from IAP to clear RevenueCat session
    if (IAP.isReady()) {
      try {
        await IAP.logOut();
      } catch (e) {
        console.warn('[SignOut] Failed to log out from RevenueCat:', e?.message);
      }
    }
    
    setAuthUserState(null);
    setIsPremium(false);
    Alert.alert('Signed Out', 'You have been signed out. Premium features require sign-in.');
  };

  // Permission handlers
  const refreshNotifPerm = async () => {
    try {
      const np = await Notifications.getPermissionsAsync();
      setNotifPerm({ status: np.status, canAskAgain: np.canAskAgain ?? true });
    } catch {}
  };

  const requestNotifications = async () => {
    try {
      const result = await Notifications.requestPermissionsAsync();
      setNotifPerm({ status: result.status, canAskAgain: result.canAskAgain ?? true });
      if (result.status !== 'granted') {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in iOS Settings to use reminders and session alerts.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings?.() },
          ]
        );
      }
    } catch {}
  };

  const refreshScreenTime = () => {
    try {
      if (Platform.OS !== 'ios') { setScreenTimePerm('not-available'); return; }
      let DeviceActivity = null;
      try { DeviceActivity = require('react-native-device-activity'); } catch {}
      if (!DeviceActivity) { setScreenTimePerm('not-available'); return; }
      const s = DeviceActivity.getAuthorizationStatus();
      setScreenTimePerm((s === 2 || s === 'approved') ? 'approved' : (s === 1 || s === 'denied') ? 'denied' : 'unknown');
    } catch {}
  };

  const requestScreenTime = async () => {
    try {
      if (Platform.OS !== 'ios') return;
      let DeviceActivity = null;
      try { DeviceActivity = require('react-native-device-activity'); } catch {}
      if (!DeviceActivity) return;
      await DeviceActivity.requestAuthorization();
      refreshScreenTime();
      const s = DeviceActivity.getAuthorizationStatus();
      const ok = (s === 2 || s === 'approved');
      if (!ok) {
        Alert.alert(
          'Screen Time Not Authorized',
          'FocusFlow cannot block distracting apps without Screen Time authorization. You can enable this in Settings > Screen Time.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings?.() },
          ]
        );
      }
    } catch {}
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your preferences</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ACCOUNT</Text>

          {/* User Profile Card */}
          <GlassCard tint="dark" intensity={40} cornerRadius={20} contentStyle={{ padding: 0 }} style={styles.groupCardOuter}>
            <TouchableOpacity 
              style={styles.profileCard}
              onPress={() => {
                if (authUser) {
                  // Could navigate to account details
                } else {
                  handleSignIn();
                }
              }}
            >
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {authUser ? authUser.email?.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>
                  {authUser ? authUser.email?.split('@')[0] : 'Guest User'}
                </Text>
                <Text style={styles.profileEmail}>
                  {authUser ? authUser.email : 'Tap to sign in'}
                </Text>
              </View>
              {!authUser && <ChevronRightIcon color={colors.mutedForeground} size={20} />}
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Premium Status Row */}
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <CrownIcon color={isPremium ? colors.primary : colors.mutedForeground} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>
                    {isPremium ? 'Premium Member' : 'Free Plan'}
                  </Text>
                </View>
              </View>
              {!isPremium && (
                <TouchableOpacity 
                  onPress={handlePremiumPress}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#8900f5', '#0072ff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.upgradeButton}
                  >
                    <Text style={styles.upgradeButtonText}>Upgrade</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </GlassCard>
        </View>

        {/* Permissions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PERMISSIONS</Text>
          <GlassCard tint="dark" intensity={40} cornerRadius={20} contentStyle={{ padding: 0 }} style={styles.groupCardOuter}>
            {/* Notifications Permission */}
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(137, 0, 245, 0.2)' }]}>
                  <BellIcon color="#8900f5" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Notifications</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    {notifPerm.status === 'granted' ? 'Allowed' : notifPerm.status === 'denied' ? 'Denied' : 'Not determined'}
                  </Text>
                </View>
              </View>
              {notifPerm.status === 'granted' ? (
                <Text style={styles.settingsItemSubtitle}>On</Text>
              ) : notifPerm.canAskAgain ? (
                <TouchableOpacity onPress={requestNotifications}>
                  <Text style={[styles.upgradeButtonText, { color: colors.primary }]}>Allow</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => Linking.openSettings?.()}>
                  <Text style={[styles.upgradeButtonText, { color: colors.primary }]}>Open Settings</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            {/* Screen Time (iOS) */}
            {Platform.OS === 'ios' && (
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemContent}>
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(137, 0, 245, 0.2)' }]}>
                    <ShieldIcon color="#8900f5" size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsItemTitle}>Screen Time</Text>
                    <Text style={styles.settingsItemSubtitle}>
                      {screenTimePerm === 'approved' ? 'Authorized' : screenTimePerm === 'denied' ? 'Denied' : screenTimePerm === 'not-available' ? 'Not available' : 'Not determined'}
                    </Text>
                  </View>
                </View>
                {screenTimePerm === 'approved' ? (
                  <Text style={styles.settingsItemSubtitle}>On</Text>
                ) : (
                  <TouchableOpacity onPress={screenTimePerm === 'denied' ? () => Linking.openSettings?.() : requestScreenTime}>
                    <Text style={[styles.upgradeButtonText, { color: colors.primary }]}>
                      {screenTimePerm === 'denied' ? 'Open Settings' : 'Authorize'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </GlassCard>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PREFERENCES</Text>

          <GlassCard tint="dark" intensity={40} cornerRadius={20} contentStyle={{ padding: 0 }} style={styles.groupCardOuter}>
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(137, 0, 245, 0.2)' }]}>
                  <BellIcon color="#0072ff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Reminder Notifications</Text>
                  <Text style={styles.settingsItemSubtitle}>Get notified for reminders</Text>
                </View>
              </View>
              <Switch 
                value={reminderNotifs} 
                onValueChange={(value) => {
                  setReminderNotifs(value);
                  updateSetting('reminderNotifications', value);
                }} 
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(137, 0, 245, 0.2)' }]}>
                  <BellIcon color="#0072ff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Session Notifications</Text>
                  <Text style={styles.settingsItemSubtitle}>Alerts when sessions end</Text>
                </View>
              </View>
              <Switch 
                value={sessionNotifs} 
                onValueChange={(value) => {
                  setSessionNotifs(value);
                  updateSetting('sessionNotifications', value);
                }} 
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(137, 0, 245, 0.2)' }]}>
                  <BellIcon color="#0072ff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Motivation Messages</Text>
                  <Text style={styles.settingsItemSubtitle}>Encouraging tips & insights</Text>
                </View>
              </View>
              <Switch 
                value={motivationMsgs} 
                onValueChange={(value) => {
                  setMotivationMsgs(value);
                  updateSetting('motivationMessages', value);
                }} 
              />
            </View>
          </GlassCard>
        </View>

        {/* Privacy & Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PRIVACY & DATA</Text>

          <GlassCard tint="dark" intensity={40} cornerRadius={20} contentStyle={{ padding: 0 }} style={styles.groupCardOuter}>
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(137, 0, 245, 0.2)' }]}>
                  <ShieldIcon color="#0072ff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Anonymous Analytics</Text>
                  <Text style={styles.settingsItemSubtitle}>Help us improve the app</Text>
                </View>
              </View>
              <Switch 
                value={analytics} 
                onValueChange={(value) => {
                  setAnalytics(value);
                  updateSetting('analytics', value);
                }} 
              />
            </View>

            <View style={styles.divider} />

            {/* Manual cloud upload removed for MVP to reduce settings and prompts */}

            <TouchableOpacity style={styles.settingsItem} onPress={handleExportData}>
              <View style={styles.settingsItemContent}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(137, 0, 245, 0.2)' }]}>
                  <ShieldIcon color="#0072ff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Export Data</Text>
                  <Text style={styles.settingsItemSubtitle}>Get a JSON export of your data</Text>
                </View>
              </View>
              <ChevronRightIcon color={colors.mutedForeground} size={20} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.settingsItem} onPress={handleWipeData}>
              <View style={styles.settingsItemContent}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(137, 0, 245, 0.2)' }]}>
                  <ShieldIcon color="#0072ff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Wipe Local Data</Text>
                  <Text style={styles.settingsItemSubtitle}>Remove local reminders, apps, analytics, settings</Text>
                </View>
              </View>
              <ChevronRightIcon color={colors.mutedForeground} size={20} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={[styles.settingsItem, styles.disabledItem]} 
              onPress={() => Alert.alert('Coming Soon', 'Help Center with FAQs and guides is coming soon!')}
            >
              <View style={styles.settingsItemContent}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(137, 0, 245, 0.2)' }]}>
                  <HelpCircleIcon color="#0072ff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Help Center</Text>
                  <Text style={styles.settingsItemSubtitle}>Coming Soon</Text>
                </View>
              </View>
              <ChevronRightIcon color={colors.mutedForeground} size={20} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={styles.settingsItem} 
              onPress={() => Linking.openURL('https://www.focusflow.cc/contact')}
            >
              <View style={styles.settingsItemContent}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(137, 0, 245, 0.2)' }]}>
                  <HelpCircleIcon color="#0072ff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Contact Support</Text>
                  <Text style={styles.settingsItemSubtitle}>
                    {isPremium ? 'Priority support' : 'Get help'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {isPremium && (
                  <View style={styles.priorityBadge}>
                    <CrownIcon color="#fff" size={12} />
                    <Text style={styles.priorityBadgeText}>Priority</Text>
                  </View>
                )}
                <ChevronRightIcon color={colors.mutedForeground} size={20} />
              </View>
            </TouchableOpacity>
          </GlassCard>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ABOUT</Text>

          <GlassCard tint="dark" intensity={40} cornerRadius={20} contentStyle={{ padding: 0 }} style={styles.groupCardOuter}>
            <View style={styles.settingsItem}>
              <View style={styles.settingsItemContent}>
                <InfoIcon color={colors.mutedForeground} size={20} />
                <Text style={styles.settingsItemTitle}>App Version</Text>
              </View>
              <Text style={styles.settingsItemSubtitle}>1.0.0</Text>
            </View>

            <View style={styles.divider} />

            {/* Manual import from cloud */}
            <TouchableOpacity style={styles.settingsItem} onPress={async () => {
              if (!authUser?.id) {
                Alert.alert('Sign In Required', 'Please sign in to import your data from your account.');
                return;
              }
              Alert.alert('Import from Account', 'Replace local data with your cloud data?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Import', style: 'destructive', onPress: async () => {
                  try {
                    setIsMigrating(true);
                    await pullCloudToLocal(authUser.id);
                    await setMigrationFlag(authUser.id, true);
                    Alert.alert('Imported', 'Local data replaced with your cloud data.');
                  } catch (e) {
                    Alert.alert('Import Failed', e?.message || 'Could not load data from cloud.');
                  } finally {
                    setIsMigrating(false);
                  }
                }}
              ]);
            }}>
              <View style={styles.settingsItemContent}>
                <ShieldIcon color={colors.mutedForeground} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Import from Account</Text>
                  <Text style={styles.settingsItemSubtitle}>Replace local data with cloud data</Text>
                </View>
              </View>
              <ChevronRightIcon color={colors.mutedForeground} size={20} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* AI Dev: Seed test aliases - only in development */}
            {IS_DEV && AI_VOICE_ENABLED && (
              <>
                <TouchableOpacity style={styles.settingsItem} onPress={async () => {
                  const success = await seedDevAliases();
                  Alert.alert(
                    success ? 'Seeded' : 'Failed',
                    success
                      ? 'Created 5 test aliases: social, entertainment, news, shopping, safari. Try: "Block social for 30 minutes"'
                      : 'Could not seed aliases. Check console for errors.'
                  );
                }}>
                  <View style={styles.settingsItemContent}>
                    <InfoIcon color="#8900f5" size={20} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingsItemTitle}>Seed AI Test Aliases</Text>
                      <Text style={styles.settingsItemSubtitle}>Dev only: Add sample aliases for voice testing</Text>
                    </View>
                  </View>
                  <ChevronRightIcon color={colors.mutedForeground} size={20} />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.settingsItem} onPress={async () => {
                  const success = await clearDevAliases();
                  Alert.alert(success ? 'Cleared' : 'Failed', success ? 'Test aliases removed' : 'Could not clear aliases');
                }}>
                  <View style={styles.settingsItemContent}>
                    <InfoIcon color={colors.mutedForeground} size={20} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingsItemTitle}>Clear AI Test Aliases</Text>
                      <Text style={styles.settingsItemSubtitle}>Remove sample aliases</Text>
                    </View>
                  </View>
                  <ChevronRightIcon color={colors.mutedForeground} size={20} />
                </TouchableOpacity>

                <View style={styles.divider} />
              </>
            )}

            <TouchableOpacity style={styles.settingsItem} onPress={handleRateApp}>
              <View style={styles.settingsItemContent}>
                <InfoIcon color={colors.mutedForeground} size={20} />
                <Text style={styles.settingsItemTitle}>Rate FocusFlow</Text>
              </View>
              <ChevronRightIcon color={colors.mutedForeground} size={20} />
            </TouchableOpacity>
          </GlassCard>
        </View>

        {/* Legal & Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>LEGAL & PRIVACY</Text>
          <GlassCard tint="dark" intensity={40} cornerRadius={20} contentStyle={{ padding: 0 }} style={styles.groupCardOuter}>
            <TouchableOpacity 
              style={styles.settingsItem} 
              onPress={() => Linking.openURL('https://www.focusflow.cc/privacy')}
            >
              <View style={styles.settingsItemContent}>
                <ShieldIcon color={colors.mutedForeground} size={20} />
                <Text style={styles.settingsItemTitle}>Privacy Policy</Text>
              </View>
              <ChevronRightIcon color={colors.mutedForeground} size={20} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={styles.settingsItem} 
              onPress={() => Linking.openURL('https://www.focusflow.cc/terms')}
            >
              <View style={styles.settingsItemContent}>
                <InfoIcon color={colors.mutedForeground} size={20} />
                <Text style={styles.settingsItemTitle}>Terms of Service</Text>
              </View>
              <ChevronRightIcon color={colors.mutedForeground} size={20} />
            </TouchableOpacity>
          </GlassCard>
        </View>

        {/* Purchases Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PURCHASES</Text>
          <GlassCard tint="dark" intensity={40} cornerRadius={20} contentStyle={{ padding: 0 }} style={styles.groupCardOuter}>
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={async () => {
                // Require sign-in for restore purchases
                if (!authUser) {
                  Alert.alert(
                    'Sign In Required',
                    'Please sign in to restore your purchases. Subscriptions are linked to your account.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Sign In', onPress: handleSignIn }
                    ]
                  );
                  return;
                }

                // Check if IAP is available before attempting restore
                console.log('[Settings] Restore pressed. IAP ready?', IAP.isReady(), 'StoreKitTest ready?', StoreKitTest.isReady?.());
                if (!IAP.isReady() && !StoreKitTest.isReady()) {
                  Alert.alert(
                    'Not Available',
                    'In-app purchases are not enabled in this build. Please rebuild the app with:\n\nnpx expo prebuild --clean\nnpx expo run:ios --device',
                    [{ text: 'OK' }]
                  );
                  return;
                }

                try {
                  if (IAP.isReady()) {
                    const info = await IAP.restorePurchases();
                    const active = IAP.hasPremiumEntitlement(info);
                    await setPremiumStatus(!!active);
                    setIsPremium(!!active);
                    console.log('[Settings] Restore via IAP complete. Active?', !!active);
                    Alert.alert('Restore Complete', active ? 'Premium activated!' : 'No active subscription found.');
                  } else if (StoreKitTest.isReady()) {
                    const purchases = await StoreKitTest.restorePurchases();
                    const active = StoreKitTest.hasActivePurchase(purchases);
                    await setPremiumStatus(!!active);
                    setIsPremium(!!active);
                    console.log('[Settings] Restore via StoreKitTest complete. Active?', !!active);
                    Alert.alert('Restore Complete', active ? 'Premium activated!' : 'No active subscription found.');
                  }
                } catch (e) {
                  console.warn('[Settings] Restore error:', e?.message || e);
                  Alert.alert('Restore Failed', e?.message || 'Could not restore purchases. Please try again.');
                }
              }}
            >
              <View style={styles.settingsItemContent}>
                <CrownIcon color={colors.mutedForeground} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsItemTitle}>Restore Purchases</Text>
                  <Text style={styles.settingsItemSubtitle}>Re-activate Premium on this device</Text>
                </View>
              </View>
              <ChevronRightIcon color={colors.mutedForeground} size={20} />
            </TouchableOpacity>
          </GlassCard>
        </View>

        {/* Account / Sign In */}
        {authUser ? (
          <TouchableOpacity style={styles.signInCard} onPress={() => navigation.navigate('Account')}>
            <LogOutIcon size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.signInTitle}>Account</Text>
              <Text style={styles.signInSubtitle}>{authUser.email}</Text>
            </View>
            <Text style={styles.signInTitle}>Manage →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.signInCard} onPress={handleSignIn}>
            <LogOutIcon size={20} color={colors.primary} />
            <View>
              <Text style={styles.signInTitle}>Sign In</Text>
              <Text style={styles.signInSubtitle}>Sync data and unlock Premium</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Premium Modal */}
      <PremiumModal
        visible={showPremium}
        onClose={() => setShowPremium(false)}
        onUpgrade={async (plan) => {
          const ok = await performUpgrade(plan, { onRequireSignIn: () => { setShowPremium(false); handleSignIn(); } });
          if (ok) {
            setIsPremium(true);
            setShowPremium(false);
          }
        }}
      />

      {/* Migration Prompt */}
      <MigrationPrompt
        visible={!!authUser && showMigration}
        loading={isMigrating}
        onKeepLocal={async () => {
          await setMigrationFlag(authUser.id, true);
          setShowMigration(false);
          Alert.alert('Keeping Local', 'Your data will remain on this device. You can sync it later.');
        }}
        onSaveToAccount={async () => {
          if (!authUser?.id) return;
          if (!ENABLE_MIGRATION_UPLOAD) {
            await setMigrationFlag(authUser.id, true);
            setShowMigration(false);
            Alert.alert('Deferred', 'Cloud sync is disabled in development. We will migrate this data later.');
            return;
          }
          try {
            setIsMigrating(true);
            await performMigrationUpload(authUser.id);
            await setMigrationFlag(authUser.id, true);
            setShowMigration(false);
            Alert.alert('Saved', 'Your data was saved to your account.');
          } catch (e) {
            console.warn('[Migration] upload failed:', e?.message || e);
            Alert.alert(
              'Could not save',
              'We couldn’t save your data to the cloud. Please check your internet connection and that your Supabase URL/key are set, then try again.'
            );
          } finally {
            setIsMigrating(false);
          }
        }}
        onClose={() => setShowMigration(false)}
      />

      {/* Sync Prompt (both local and cloud exist) */}
      <DataSyncPrompt
        visible={!!authUser && showSyncPrompt}
        loading={isMigrating}
        onKeepLocal={async () => {
          if (!authUser?.id) return;
          await setMigrationFlag(authUser.id, true); // don't prompt again
          setShowSyncPrompt(false);
          Alert.alert('Keeping Local', 'We will keep using the data on this device.');
        }}
        onReplaceWithCloud={async () => {
          if (!authUser?.id) return;
          try {
            setIsMigrating(true);
            await pullCloudToLocal(authUser.id);
            await setMigrationFlag(authUser.id, true);
            setShowSyncPrompt(false);
            Alert.alert('Replaced', 'We replaced local data with your cloud data.');
          } catch (e) {
            console.warn('[Sync] replace failed:', e?.message || e);
            Alert.alert('Sync Failed', 'Could not load data from cloud. Please try again later.');
          } finally {
            setIsMigrating(false);
          }
        }}
        onLater={() => setShowSyncPrompt(false)}
        onClose={() => setShowSyncPrompt(false)}
      />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: typography.extrabold,
    color: colors.foreground,
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: typography.semibold,
    color: colors.mutedForeground,
  },
  // Profile Card Styles
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: 'transparent',
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: '#fff',
  },
  profileName: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.foreground,
  },
  profileEmail: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  // Upgrade Button Styles
  upgradeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  upgradeButtonText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: '#fff',
  },
  testFreeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  testFreeButtonText: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    color: colors.mutedForeground,
  },
  premiumCardOuter: {},
  premiumCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  premiumIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)'
  },
  premiumIconWrapperLight: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumMemberTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.foreground,
  },
  premiumMemberSubtitle: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
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
  disabledCard: {
    opacity: 0.6,
  },
  groupCardOuter: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: 'transparent',
  },
  disabledItem: {
    opacity: 0.5,
  },
  settingsItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsItemTitle: {
    fontSize: typography.base,
    color: colors.foreground,
    fontWeight: typography.medium,
  },
  settingsItemSubtitle: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: '#f59e0b',
    borderRadius: radius.sm,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: typography.semibold,
    color: '#fff',
  },
  signInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  signInTitle: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.primary,
  },
  signInSubtitle: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  downgradeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 60,
    alignItems: 'center',
  },
  downgradeText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
