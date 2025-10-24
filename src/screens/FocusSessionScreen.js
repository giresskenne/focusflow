import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useTheme } from '@react-navigation/native';
import UIButton from '../components/Ui/Button';
import { getSelectedApps, setSelectedApps } from '../storage';
import { CheckIcon, CameraIcon, MessageIcon, UserIcon, MusicIcon, PlayIcon, ShoppingIcon, LinkedinIcon, AlertCircleIcon, SearchIcon, AppsIcon } from '../components/Icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import { getInstalledApps } from '../native/installedApps';

// Enhanced app list with bundle IDs for blocking and fallback icons
const ENHANCED_MOCK_APPS = [
  { id: 'com.burbn.instagram', name: 'Instagram', bundleId: 'com.burbn.instagram', Icon: CameraIcon },
  { id: 'com.atebits.Tweetie2', name: 'Twitter', bundleId: 'com.atebits.Tweetie2', Icon: MessageIcon },
  { id: 'com.facebook.Facebook', name: 'Facebook', bundleId: 'com.facebook.Facebook', Icon: UserIcon },
  { id: 'com.zhiliaoapp.musically', name: 'TikTok', bundleId: 'com.zhiliaoapp.musically', Icon: MusicIcon },
  { id: 'net.whatsapp.WhatsApp', name: 'WhatsApp', bundleId: 'net.whatsapp.WhatsApp', Icon: MessageIcon },
  { id: 'com.reddit.Reddit', name: 'Reddit', bundleId: 'com.reddit.Reddit', Icon: MessageIcon },
  { id: 'com.toyopagroup.picaboo', name: 'Snapchat', bundleId: 'com.toyopagroup.picaboo', Icon: CameraIcon },
  { id: 'com.linkedin.LinkedIn', name: 'LinkedIn', bundleId: 'com.linkedin.LinkedIn', Icon: LinkedinIcon },
];

const DURATIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

export default function FocusSessionScreen({ navigation, route }) {
  const theme = useTheme();
  const [selectedApps, setSelectedAppsState] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [installedApps, setInstalledApps] = useState([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Load both installed apps and selected apps on mount
  useEffect(() => {
    (async () => {
      try {
        // Load selected apps from storage
        const saved = await getSelectedApps();
        setSelectedAppsState(saved || []);
        
        // Load installed apps from device
        setIsLoadingApps(true);
        const installed = await getInstalledApps();
        
        // Enhance installed apps with fallback data for known apps
        const enhancedApps = installed.map(app => {
          const knownApp = ENHANCED_MOCK_APPS.find(known => 
            known.bundleId === app.packageName || 
            known.name.toLowerCase() === app.label.toLowerCase()
          );
          
          return {
            id: app.packageName,
            name: app.label,
            bundleId: app.packageName,
            packageName: app.packageName,
            Icon: knownApp?.Icon || AppsIcon, // Use known icon or generic app icon
          };
        });
        
        // If no installed apps detected (iOS/unsupported), use enhanced mock data
        setInstalledApps(enhancedApps.length > 3 ? enhancedApps : ENHANCED_MOCK_APPS);
      } catch (error) {
        console.log('Error loading apps:', error);
        // Fallback to enhanced mock apps
        setInstalledApps(ENHANCED_MOCK_APPS);
      } finally {
        setIsLoadingApps(false);
      }
    })();
  }, []);

  // Create lookup for selected apps and filter based on search
  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return installedApps;
    const query = searchQuery.toLowerCase();
    return installedApps.filter(app => 
      app.name.toLowerCase().includes(query) ||
      app.bundleId.toLowerCase().includes(query)
    );
  }, [installedApps, searchQuery]);

  const toggleApp = async (appId) => {
    const newSelected = selectedApps.includes(appId)
      ? selectedApps.filter(id => id !== appId)
      : [...selectedApps, appId];
    setSelectedAppsState(newSelected);
    
    // Create mapping for storage (using app IDs)
    const map = newSelected.reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
    await setSelectedApps(map);
  };

  const handleContinue = () => {
    if (selectedApps.length === 0) return;
    setShowConfirm(true);
  };

  const confirmStart = () => {
    const duration = customDuration ? parseInt(customDuration, 10) : selectedDuration;
    navigation.navigate('ActiveSession', { durationSeconds: duration * 60 });
  };

  if (showConfirm) {
    return (
      <View style={{ flex: 1, backgroundColor: navColors.background }}>
        <ScrollView contentContainerStyle={styles.confirmContainer}>
          <View style={[styles.warningBanner, shadows.sm]}>
            <AlertCircleIcon size={20} color={colors.warning} />
            <Text style={styles.warningText}>
              Once started, this session cannot be easily stopped. The selected apps will be blocked for the entire duration.
            </Text>
          </View>

          <View style={[styles.confirmCard, shadows.sm]}>
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={styles.confirmLabel}>BLOCKED APPS</Text>
              <View style={styles.appChipsRow}>
                {selectedApps.map((appId) => {
                  const app = installedApps.find((a) => a.id === appId);
                  const AppIcon = app?.Icon || AppsIcon;
                  return (
                    <View key={appId} style={styles.appChip}>
                      <AppIcon size={16} color={colors.foreground} />
                      <Text style={styles.appChipText}>{app?.name || 'Unknown App'}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={styles.dividerLine} />
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.confirmLabel}>DURATION</Text>
              <Text style={styles.durationText}>
                {customDuration ? `${customDuration} minutes` : `${selectedDuration} minutes`}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.confirmFooter}>
          <UIButton
            title="Cancel"
            variant="outline"
            onPress={() => setShowConfirm(false)}
            style={{ flex: 1, marginRight: spacing.sm }}
          />
          <UIButton
            title="Start Focus Session"
            onPress={confirmStart}
            style={{ flex: 1, marginLeft: spacing.sm }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: navColors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ width: '100%', maxWidth: 520 }}>
          <Text style={styles.sectionHeader}>SELECT APPS TO BLOCK</Text>
          <TextInput
            placeholder="Search apps"
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          <View style={styles.appGrid}>
            {isLoadingApps ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading apps...</Text>
              </View>
            ) : filteredApps.length === 0 ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>
                  {searchQuery ? 'No apps found' : 'No apps available'}
                </Text>
              </View>
            ) : (
              filteredApps.map((app) => {
              const isSelected = selectedApps.includes(app.id);
              const AppIcon = app.Icon;
              return (
                <TouchableOpacity
                  key={app.id}
                  style={[
                    styles.appPill,
                    isSelected && styles.appPillSelected,
                    shadows.sm,
                  ]}
                  onPress={() => toggleApp(app.id)}
                >
                  <AppIcon size={18} color={isSelected ? '#fff' : colors.foreground} />
                  <Text style={[styles.appPillText, isSelected && styles.appPillTextSelected]}>
                    {app.name}
                  </Text>
                  {isSelected && <CheckIcon size={16} color="#fff" />}
                </TouchableOpacity>
              );
              })
            )}
          </View>

          <Text style={[styles.sectionHeader, { marginTop: spacing['2xl'] }]}>SESSION DURATION</Text>
          <View style={styles.durationRow}>
            {DURATIONS.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.durationBtn,
                  selectedDuration === item.value && !customDuration && styles.durationBtnSelected,
                ]}
                onPress={() => { setSelectedDuration(item.value); setCustomDuration(''); }}
              >
                <Text style={[
                  styles.durationBtnText,
                  selectedDuration === item.value && !customDuration && styles.durationBtnTextSelected,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            placeholder="Custom (minutes)"
            placeholderTextColor={colors.mutedForeground}
            value={customDuration}
            onChangeText={setCustomDuration}
            keyboardType="number-pad"
            style={styles.customInput}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <UIButton
          title="Continue"
          onPress={handleContinue}
          disabled={selectedApps.length === 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, alignItems: 'center' },
  sectionHeader: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  appPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    minWidth: '48%',
  },
  appPillSelected: {
    backgroundColor: colors.primary,
  },
  appPillText: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.foreground,
    flex: 1,
  },
  appPillTextSelected: {
    color: '#fff',
  },
  durationRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  durationBtn: {
    height: 48,
    flex: 1,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  durationBtnSelected: {
    backgroundColor: colors.primary,
  },
  durationBtnText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.foreground,
  },
  durationBtnTextSelected: {
    color: '#fff',
  },
  customInput: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    fontSize: typography.base,
    color: colors.foreground,
    ...shadows.sm,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  searchInput: {
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    fontSize: typography.base,
    color: colors.foreground,
    ...shadows.sm,
  },
  confirmContainer: { padding: spacing.xl, gap: spacing.xl },
  warningBanner: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: '#FEF3C7',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    flex: 1,
    fontSize: typography.sm,
    color: '#78350F',
    lineHeight: 20,
  },
  confirmCard: {
    backgroundColor: colors.card,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmLabel: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  appChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  appChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.muted,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  appChipText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.foreground,
  },
  dividerLine: {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.3,
  },
  durationText: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.foreground,
  },
  confirmFooter: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  loadingText: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
