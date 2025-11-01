import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, Modal } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import UIButton from '../components/Ui/Button';
import { getSelectedApps, setSelectedApps, getTemplate, saveTemplate, clearTemplate } from '../storage';
import { CheckIcon, AlertCircleIcon, SearchIcon, AppsIcon } from '../components/Icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import { getInstalledApps } from '../native/installedApps';
import GradientBackground from '../components/GradientBackground';
import GlassCard from '../components/Ui/GlassCard';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import react-native-device-activity for DeviceActivitySelectionView
let DeviceActivity = null;
let DeviceActivitySelectionView = null;
if (Platform.OS === 'ios') {
  try {
    const lib = require('react-native-device-activity');
    DeviceActivity = lib;
    DeviceActivitySelectionView = lib.DeviceActivitySelectionView;
  } catch (error) {
    console.log('[FocusSession] react-native-device-activity not available:', error.message);
  }
}

// Enhanced app list with bundle IDs for blocking and fallback Ionicons
const ENHANCED_MOCK_APPS = [
  { id: 'com.burbn.instagram', name: 'Instagram', bundleId: 'com.burbn.instagram', iconName: 'logo-instagram', categoryToken: 'socialNetworking' },
  { id: 'com.atebits.Tweetie2', name: 'Twitter', bundleId: 'com.atebits.Tweetie2', iconName: 'logo-twitter', categoryToken: 'socialNetworking' },
  { id: 'com.facebook.Facebook', name: 'Facebook', bundleId: 'com.facebook.Facebook', iconName: 'logo-facebook', categoryToken: 'socialNetworking' },
  { id: 'com.zhiliaoapp.musically', name: 'TikTok', bundleId: 'com.zhiliaoapp.musically', iconName: 'musical-notes', categoryToken: 'socialNetworking' },
  { id: 'net.whatsapp.WhatsApp', name: 'WhatsApp', bundleId: 'net.whatsapp.WhatsApp', iconName: 'logo-whatsapp', categoryToken: 'socialNetworking' },
  { id: 'com.reddit.Reddit', name: 'Reddit', bundleId: 'com.reddit.Reddit', iconName: 'logo-reddit', categoryToken: 'socialNetworking' },
  { id: 'com.toyopagroup.picaboo', name: 'Snapchat', bundleId: 'com.toyopagroup.picaboo', iconName: 'logo-snapchat', categoryToken: 'socialNetworking' },
  { id: 'com.linkedin.LinkedIn', name: 'LinkedIn', bundleId: 'com.linkedin.LinkedIn', iconName: 'logo-linkedin', categoryToken: 'socialNetworking' },
  // Added common test targets so searches like "Zoom" work during iOS dev
  { id: 'us.zoom.videomeetings', name: 'Zoom', bundleId: 'us.zoom.videomeetings', iconName: 'videocam', categoryToken: 'entertainment' },
  { id: 'com.google.ios.youtube', name: 'YouTube', bundleId: 'com.google.ios.youtube', iconName: 'logo-youtube', categoryToken: 'entertainment' },
  { id: 'com.netflix.Netflix', name: 'Netflix', bundleId: 'com.netflix.Netflix', iconName: 'film', categoryToken: 'entertainment' },
];

const DURATIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

export default function FocusSessionScreen({ navigation, route }) {
  const theme = useTheme();
  const { colors: navColors } = useTheme();
  const [selectedApps, setSelectedAppsState] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [installedApps, setInstalledApps] = useState([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState(route?.params?.presetDuration || 30);
  const [customDuration, setCustomDuration] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [blockAllApps, setBlockAllApps] = useState(false);
  const [showNativePicker, setShowNativePicker] = useState(false);
  const [familyActivitySelection, setFamilyActivitySelection] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [pendingTemplateId, setPendingTemplateId] = useState(null); // Track which template is being configured
  const [confirmClearTemplate, setConfirmClearTemplate] = useState(null); // Template ID pending clear confirmation
  const FAMILY_SELECTION_ID = 'focusflow_selection';
  
  // Check if native picker is available
  const nativePickerAvailable = DeviceActivitySelectionView !== null;

  // State for template metadata (counts and saved status)
  const [templateMetadata, setTemplateMetadata] = useState({
    social: null,
    gaming: null,
    entertainment: null,
    all: null, // Block All can also be saved
  });

  // Load both installed apps and selected apps on mount
  useEffect(() => {
    (async () => {
      try {
        // Load selected apps from storage
        const saved = await getSelectedApps();
        // Normalize to an array of selected app IDs
        const initialSelected = Array.isArray(saved)
          ? saved
          : Object.entries(saved || {})
              .filter(([, on]) => !!on)
              .map(([id]) => id);
        setSelectedAppsState(initialSelected);
        
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
            iconName: knownApp?.iconName || 'apps', // Use known icon or generic apps icon
            categoryToken: knownApp?.categoryToken || app.categoryToken || null,
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

  // Load saved template metadata on mount
  useEffect(() => {
    (async () => {
      const [social, gaming, entertainment, all] = await Promise.all([
        getTemplate('social'),
        getTemplate('gaming'),
        getTemplate('entertainment'),
        getTemplate('all'),
      ]);
      setTemplateMetadata({ social, gaming, entertainment, all });
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
    
    // Clear template selection when manually selecting apps
    setSelectedTemplate(null);
    setBlockAllApps(false);
    
    // Create mapping for storage (using app IDs)
    const map = newSelected.reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
    await setSelectedApps(map);
  };

  const handleContinue = () => {
    if (selectedApps.length === 0 && !blockAllApps) return;
    setShowConfirm(true);
  };

  const confirmStart = () => {
    const duration = customDuration ? parseInt(customDuration, 10) : selectedDuration;
    navigation.navigate('ActiveSession', { durationSeconds: duration * 60 });
  };

  if (showConfirm) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={[styles.warningBanner, shadows.sm]}>
            <AlertCircleIcon size={20} color={colors.warning} />
            <Text style={styles.warningText}>
              Once started, this session cannot be easily stopped. The selected apps will be blocked for the entire duration.
            </Text>
          </View>

          {/* Widen the confirmation card on phones */}
          <View style={{ width: '100%', maxWidth: 520 }}>
          <GlassCard tint="dark" intensity={50} cornerRadius={20} contentStyle={{ padding: spacing.xl }} style={{ width: '100%' }}>
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={styles.confirmLabel}>BLOCKED APPS</Text>
              <View style={styles.appChipsRow}>
                {blockAllApps ? (
                  <View style={styles.appChip}>
                    <AppsIcon size={16} color={colors.foreground} />
                    <Text style={styles.appChipText}>All Applications</Text>
                  </View>
                ) : familyActivitySelection && (familyActivitySelection.applicationCount > 0 || familyActivitySelection.categoryCount > 0 || familyActivitySelection.webDomainCount > 0) ? (
                  <>
                    {familyActivitySelection.applicationCount > 0 && (
                      <View style={styles.appChip}>
                        <AppsIcon size={16} color={colors.foreground} />
                        <Text style={styles.appChipText}>
                          {familyActivitySelection.applicationCount} {familyActivitySelection.applicationCount === 1 ? 'App' : 'Apps'}
                        </Text>
                      </View>
                    )}
                    {familyActivitySelection.categoryCount > 0 && (
                      <View style={styles.appChip}>
                        <AppsIcon size={16} color={colors.foreground} />
                        <Text style={styles.appChipText}>
                          {familyActivitySelection.categoryCount} {familyActivitySelection.categoryCount === 1 ? 'Category' : 'Categories'}
                        </Text>
                      </View>
                    )}
                    {familyActivitySelection.webDomainCount > 0 && (
                      <View style={styles.appChip}>
                        <AppsIcon size={16} color={colors.foreground} />
                        <Text style={styles.appChipText}>
                          {familyActivitySelection.webDomainCount} {familyActivitySelection.webDomainCount === 1 ? 'Website' : 'Websites'}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  selectedApps.map((appId) => {
                    const app = installedApps.find((a) => a.id === appId);
                    const iconName = app?.iconName || 'apps';
                    return (
                      <View key={appId} style={styles.appChip}>
                        <Ionicons name={iconName} size={16} color={colors.foreground} />
                        <Text style={styles.appChipText}>{app?.name || 'App'}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
            <View style={styles.dividerLine} />
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.confirmLabel}>DURATION</Text>
              <Text style={styles.durationText}>
                {customDuration ? `${customDuration} minutes` : `${selectedDuration} minutes`}
              </Text>
            </View>
          </GlassCard>
          </View>
        </SafeAreaView>

        <View style={styles.confirmFooter}>
          <UIButton
            title="Cancel"
            variant="outline"
            onPress={() => setShowConfirm(false)}
            style={{ flex: 1, marginRight: spacing.sm }}
          />
          <UIButton
            title="Start"
            onPress={confirmStart}
            style={{ flex: 1, marginLeft: spacing.sm }}
          />
        </View>
      </GradientBackground>
    );
  }

  // Quick Template Categories - now uses saved selections from native picker
  const handleTemplateSelect = async (templateId) => {
    console.log('[FocusSession] Template selected:', templateId);
    
    if (selectedTemplate === templateId) {
      // Deselect if already selected
      console.log('[FocusSession] Deselecting template:', templateId);
      setSelectedTemplate(null);
      setBlockAllApps(false);
      setSelectedAppsState([]);
      setFamilyActivitySelection(null);
      // Clear everything from storage
      await setSelectedApps({});
      return;
    }
    
    // Handle "Block All" template separately
    if (templateId === 'all') {
      console.log('[FocusSession] Block All requires native picker - opening to select all categories');
      
      // Check if we have a saved "Block All" selection
      const savedBlockAll = templateMetadata.all;
      
      if (savedBlockAll && savedBlockAll.selectionToken) {
        // Use saved selection
        console.log('[FocusSession] Using saved Block All selection');
        setSelectedTemplate('all');
        setBlockAllApps(true);
        
        await setSelectedApps({
          familyActivitySelectionId: FAMILY_SELECTION_ID,
          nativeFamilyActivitySelection: savedBlockAll.selectionToken,
        });
        
        setSelectedAppsState([FAMILY_SELECTION_ID]);
      } else {
        // Open native picker with instructions to select all categories
        console.log('[FocusSession] No saved Block All selection, opening native picker');
        setPendingTemplateId('all');
        setShowNativePicker(true);
      }
      return;
    }    // Check if template has a saved selection
    const savedTemplate = templateMetadata[templateId];
    
    if (savedTemplate && savedTemplate.selectionToken) {
      // Use saved selection
      console.log('[FocusSession] Using saved template selection for:', templateId);
      setSelectedTemplate(templateId);
      setBlockAllApps(false);
      
      await setSelectedApps({
        familyActivitySelectionId: FAMILY_SELECTION_ID,
        nativeFamilyActivitySelection: savedTemplate.selectionToken,
      });
      
      // Set local state to show selection is active
      setSelectedAppsState([FAMILY_SELECTION_ID]);
    } else {
      // No saved selection - open native picker
      console.log('[FocusSession] No saved selection, opening native picker for:', templateId);
      setPendingTemplateId(templateId);
      setShowNativePicker(true);
    }
  };
  
  // Handle editing a saved template
  const handleEditTemplate = async (templateId) => {
    console.log('[FocusSession] Editing template:', templateId);
    setPendingTemplateId(templateId);
    setShowNativePicker(true);
  };
  
  // Handle clearing a saved template
  const handleClearTemplate = async (templateId) => {
    console.log('[FocusSession] Clear requested for template:', templateId);
    setConfirmClearTemplate(templateId);
  };
  
  const executeTemplateClear = async () => {
    const templateId = confirmClearTemplate;
    if (!templateId) return;
    
    console.log('[FocusSession] Clearing template:', templateId);
    await clearTemplate(templateId);
    
    // Update local state
    setTemplateMetadata(prev => ({
      ...prev,
      [templateId]: null,
    }));
    
    // Deselect if currently selected
    if (selectedTemplate === templateId) {
      setSelectedTemplate(null);
      setBlockAllApps(false);
      setSelectedAppsState([]);
      await setSelectedApps({});
    }
    
    setConfirmClearTemplate(null);
  };

  const QUICK_TEMPLATES = [
    {
      id: 'social',
      name: 'Social Media',
      iconName: 'chatbubbles',
      description: templateMetadata.social 
        ? `${templateMetadata.social.appCount + templateMetadata.social.categoryCount} items` 
        : 'Tap to configure',
      color: '#FF6B9D',
      isSaved: !!templateMetadata.social,
    },
    {
      id: 'gaming',
      name: 'Gaming',
      iconName: 'game-controller',
      description: templateMetadata.gaming 
        ? `${templateMetadata.gaming.appCount + templateMetadata.gaming.categoryCount} items` 
        : 'Tap to configure',
      color: '#00D4FF',
      isSaved: !!templateMetadata.gaming,
    },
    {
      id: 'entertainment',
      name: 'Entertainment',
      iconName: 'film',
      description: templateMetadata.entertainment 
        ? `${templateMetadata.entertainment.appCount + templateMetadata.entertainment.categoryCount} items` 
        : 'Tap to configure',
      color: '#FF6B35',
      isSaved: !!templateMetadata.entertainment,
    },
    {
      id: 'all',
      name: 'Block All',
      iconName: 'globe',
      description: templateMetadata.all
        ? `${templateMetadata.all.appCount + templateMetadata.all.categoryCount} items`
        : 'Select all categories',
      color: colors.destructive,
      isSaved: !!templateMetadata.all,
    },
  ];

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.container}>
        <View style={{ width: '100%', maxWidth: 520 }}>
          <Text style={styles.sectionHeader}>SELECT APPS TO BLOCK</Text>
          
          {/* Quick Start Templates */}
          <View style={styles.subsectionHeaderContainer}>
            <Ionicons name="flash" size={16} color={colors.secondary} style={{ marginRight: spacing.sm, alignSelf: 'center' }} />
            <Text style={styles.subsectionHeader}>Quick Start Templates</Text>
          </View>
          <View style={styles.templatesGrid}>
            {QUICK_TEMPLATES.map((template) => {
              const isSelected = selectedTemplate === template.id;
              const hasSavedSelection = template.isSaved && template.id !== 'all';
              
              return (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateCard,
                    shadows.md,
                    isSelected && styles.templateCardSelected,
                  ]}
                  onPress={() => handleTemplateSelect(template.id)}
                  onLongPress={() => {
                    // Long press to edit any saved template
                    if (hasSavedSelection) {
                      handleEditTemplate(template.id);
                    }
                  }}
                >
                  <View style={styles.templateCardHeader}>
                    <Ionicons name={template.iconName} size={32} color={template.color} />
                    {hasSavedSelection && (
                      <TouchableOpacity 
                        onPress={(e) => {
                          e.stopPropagation();
                          handleClearTemplate(template.id);
                        }}
                        style={styles.templateClearButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateDescription}>{template.description}</Text>
                  {hasSavedSelection && (
                    <Text style={styles.templateEditHint}>Long press to edit</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border, opacity: 0.3, alignSelf: 'center' }} />
            <Text style={styles.dividerText}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border, opacity: 0.3, alignSelf: 'center' }} />
          </View>

          {/* Custom Selection */}
          <View style={styles.subsectionHeaderContainer}>
            <Ionicons name="create" size={16} color={colors.secondary} style={{ marginRight: spacing.sm, alignSelf: 'center' }} />
            <Text style={styles.subsectionHeader}>Custom Selection</Text>
          </View>
          
          {/* Show native picker button if available */}
          {nativePickerAvailable && (
            <TouchableOpacity
              style={[styles.nativePickerButton, shadows.sm]}
              onPress={() => setShowNativePicker(true)}
            >
              <AppsIcon size={20} color={colors.primary} />
              <Text style={styles.nativePickerButtonText}>
                Choose Apps from Device
              </Text>
              {familyActivitySelection && (
                <View style={styles.selectionBadge}>
                  <Text style={styles.selectionBadgeText}>
                    {(familyActivitySelection.applicationCount || 0) + 
                     (familyActivitySelection.categoryCount || 0) + 
                     (familyActivitySelection.webDomainCount || 0)} selected
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          
          {/* Fallback: Show search only when native picker not available */}
          {!nativePickerAvailable && (
            <>
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
                  const iconName = app.iconName || 'apps';
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
                      <Ionicons name={iconName} size={18} color={isSelected ? '#fff' : colors.foreground} />
                      <Text style={[styles.appPillText, isSelected && styles.appPillTextSelected]}>
                        {app.name}
                      </Text>
                      {isSelected && <CheckIcon size={16} color="#fff" />}
                    </TouchableOpacity>
                  );
                  })
                )}
              </View>
            </>
          )}

          {/* Only show duration selection if no preset duration was passed */}
          {!route?.params?.presetDuration && (
            <>
              <Text style={[styles.sectionHeader, { marginTop: spacing['2xl'] }]}>SESSION DURATION</Text>
              <View style={styles.durationRow}>
                {DURATIONS.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.durationBtn,
                      selectedDuration === item.value && !customDuration && styles.durationBtnSelected,
                    ]}
                    onPress={() => { 
                      if (selectedDuration === item.value && !customDuration) {
                        // Deselect if already selected
                        setSelectedDuration(null);
                      } else {
                        // Select new duration
                        setSelectedDuration(item.value);
                        setCustomDuration('');
                      }
                    }}
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
            </>
          )}
        </View>
        </ScrollView>
      </SafeAreaView>

      <View style={styles.footer}>
        <View style={styles.footerButtons}>
          <UIButton
            title="Cancel"
            variant="outline"
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
          />
          <UIButton
            title="Continue"
            onPress={handleContinue}
            disabled={selectedApps.length === 0 && !blockAllApps}
            style={styles.continueButton}
          />
        </View>
      </View>
      
      {/* Native DeviceActivitySelectionView - Full Screen Modal */}
      {nativePickerAvailable && DeviceActivitySelectionView && (
        <Modal
          visible={showNativePicker}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowNativePicker(false)}
        >
          <GradientBackground>
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
              <View style={{ flex: 1 }}>
                <DeviceActivitySelectionView
                  style={{ flex: 1 }}
                  headerText="Choose Activities"
                  footerText=""
                  onSelectionChange={async (event) => {
                    const nativeEvent = event?.nativeEvent;
                    console.log('[FocusSession] nativeEvent:', nativeEvent);
                    if (nativeEvent) {
                      const { applicationCount, categoryCount, webDomainCount, familyActivitySelection } = nativeEvent;
                      console.log('[FocusSession] Counts:', { applicationCount, categoryCount, webDomainCount });
                      const selectionData = {
                        applicationCount: applicationCount || 0,
                        categoryCount: categoryCount || 0,
                        webDomainCount: webDomainCount || 0,
                        familyActivitySelection,
                      };
                      setFamilyActivitySelection(selectionData);

                      // Persist selection via ID so the extensions can read it
                      if ((applicationCount + categoryCount + webDomainCount) > 0 && familyActivitySelection && DeviceActivity) {
                        try {
                          DeviceActivity.setFamilyActivitySelectionId({
                            id: FAMILY_SELECTION_ID,
                            familyActivitySelection,
                          });
                          
                          // If this was triggered by a template, save it to that template
                          if (pendingTemplateId) {
                            console.log('[FocusSession] Saving selection to template:', pendingTemplateId);
                            await saveTemplate(pendingTemplateId, {
                              selectionToken: familyActivitySelection,
                              appCount: applicationCount || 0,
                              categoryCount: categoryCount || 0,
                              webDomainCount: webDomainCount || 0,
                            });
                            
                            // Update local template metadata
                            setTemplateMetadata(prev => ({
                              ...prev,
                              [pendingTemplateId]: {
                                selectionToken: familyActivitySelection,
                                appCount: applicationCount || 0,
                                categoryCount: categoryCount || 0,
                                webDomainCount: webDomainCount || 0,
                                savedAt: Date.now(),
                              },
                            }));
                            
                            // Auto-select this template
                            setSelectedTemplate(pendingTemplateId);
                            
                            // Set blockAllApps flag if this is the "all" template
                            if (pendingTemplateId === 'all') {
                              setBlockAllApps(true);
                            } else {
                              setBlockAllApps(false);
                            }
                          }
                          
                          // Store the id in app storage so ActiveSession can pick it up
                          // Also persist the raw token for resilience (fallback/migration in ActiveSession)
                          await setSelectedApps({
                            familyActivitySelectionId: FAMILY_SELECTION_ID,
                            nativeFamilyActivitySelection: familyActivitySelection,
                          });
                          
                          // Keep a local hint for UI
                          setSelectedAppsState([FAMILY_SELECTION_ID]);
                          console.log('[FocusSession] Valid selection detected');
                        } catch (e) {
                          console.log('[FocusSession] Error saving selection:', e);
                        }
                      }
                    }
                  }}
                />

                <View style={{
                  padding: spacing.lg,
                  paddingBottom: spacing['3xl'],
                  backgroundColor: colors.background,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}>
                  <UIButton
                    title="Done"
                    onPress={() => {
                      console.log('[FocusSession] Closing picker');
                      setShowNativePicker(false);
                      setPendingTemplateId(null);
                    }}
                  />
                </View>
              </View>
            </SafeAreaView>
          </GradientBackground>
        </Modal>
      )}
      
      {/* Clear Template Confirmation Modal */}
      <Modal
        visible={!!confirmClearTemplate}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmClearTemplate(null)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard 
            tint="dark" 
            intensity={60} 
            cornerRadius={24} 
            contentStyle={{ padding: spacing['2xl'] }} 
            style={{ width: '100%', maxWidth: 400, margin: spacing.xl }}
          >
            <View style={styles.modalHeader}>
              <View style={styles.alertIconWrapper}>
                <AlertCircleIcon size={24} color={colors.warning} />
              </View>
              <Text style={styles.modalTitle}>Clear Template?</Text>
            </View>
            <Text style={styles.modalDescription}>
              This will delete your saved selection for this template. You'll need to configure it again next time.
            </Text>
            <View style={styles.modalActions}>
              <UIButton
                title="Cancel"
                variant="outline"
                onPress={() => setConfirmClearTemplate(null)}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <UIButton
                title="Clear"
                variant="danger"
                onPress={executeTemplateClear}
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
  sectionHeader: {
  fontSize: typography.sm,
  fontWeight: typography.semibold,
  color: colors.mutedForeground,
  marginBottom: spacing.md,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  appPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    minWidth: '48%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backdrop: 'blur(20px)',
  },
  appPillSelected: {
    backgroundColor: '#0072ff',
    borderColor: '#0072ff',
    shadowColor: '#0072ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  durationBtnSelected: {
    backgroundColor: 'rgba(0, 114, 255, 0.15)',
    borderColor: '#0072ff',
    borderWidth: 2,
  },
  durationBtnText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.foreground,
  },
  durationBtnTextSelected: {
    color: colors.foreground,
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
    backgroundColor: 'rgba(255,223,128,0.12)',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,223,128,0.3)',
  },
  warningText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.foreground,
    opacity: 0.9,
    lineHeight: 20,
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
  blockAllOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  blockAllOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: '#0072ff',
  },
  blockAllContent: {
    flex: 1,
  },
  blockAllTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.foreground,
    marginBottom: 4,
  },
  blockAllTitleSelected: {
    color: '#fff',
  },
  blockAllSubtitle: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  continueButton: {
    flex: 1,
  },
  nativePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nativePickerButtonText: {
    flex: 1,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.foreground,
  },
  selectionBadge: {
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  selectionBadgeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: '#fff',
  },
  subsectionHeader: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: typography.sm + 6, // ensure vertical alignment with icon
  },
  subsectionHeaderContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.sm,
  marginBottom: spacing.md,
  // Improved vertical alignment
  minHeight: 24,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  templateCard: {
    flex: 1,
    minWidth: '47%',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 140,
    maxHeight: 140, // Fixed height prevents expansion
    position: 'relative',
  },
  templateCardSelected: {
    backgroundColor: 'rgba(0, 114, 255, 0.15)',
    borderColor: '#0072ff',
    borderWidth: 2,
  },
  templateCardHeader: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    position: 'relative',
  },
  templateClearButton: {
    position: 'absolute',
    top: -spacing.xs,
    right: spacing.xs,
    padding: spacing.xs,
    zIndex: 10,
  },
  templateIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  templateName: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.foreground,
    marginBottom: 4,
    textAlign: 'center',
  },
  templateDescription: {
    fontSize: typography.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  templateEditHint: {
    fontSize: typography.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
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
    backgroundColor: 'rgba(255, 223, 128, 0.15)',
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  dividerText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.mutedForeground,
    textTransform: 'lowercase',
    textAlign: 'center',
    opacity: 0.8,
  },
});
