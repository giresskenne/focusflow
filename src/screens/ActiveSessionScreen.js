import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Platform, AppState } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';

import UIButton from '../components/Ui/Button';
import { getSelectedApps, setSession, appendSessionRecord, getSession } from '../storage';
import { formatSeconds } from '../utils/time';
import { getContextualQuote } from '../utils/quotes';
import { createCustomShield } from '../utils/shieldConfig';
import { createAdvancedShield } from '../utils/advancedShield';
import { XIcon, AlertCircleIcon, TargetIcon, CameraIcon, MessageIcon, UserIcon, MusicIcon, PlayIcon } from '../components/Icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import GradientBackground from '../components/GradientBackground';
import GlassCard from '../components/Ui/GlassCard';
import useSessionCountdown from '../hooks/useSessionCountdown';
import * as Notifications from 'expo-notifications';

// Import react-native-device-activity for real blocking
let DeviceActivity = null;
if (Platform.OS === 'ios') {
  try {
    DeviceActivity = require('react-native-device-activity');
  } catch (error) {
    console.log('[ActiveSession] react-native-device-activity not available:', error.message);
  }
}

// Small helper for retry backoffs
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_APPS = [
  { id: 'com.social.app', name: 'Instagram', Icon: CameraIcon },
  { id: 'com.twitter', name: 'Twitter', Icon: MessageIcon },
  { id: 'com.facebook', name: 'Facebook', Icon: UserIcon },
  { id: 'com.tiktok', name: 'TikTok', Icon: MusicIcon },
  { id: 'com.whatsapp', name: 'WhatsApp', Icon: MessageIcon },
];

export default function ActiveSessionScreen({ navigation, route }) {
  const duration = route?.params?.durationSeconds || 25 * 60;
  const [sessionEndAt, setSessionEndAt] = useState(() => {
    const endTime = Date.now() + duration * 1000;
    console.log('[ActiveSession] Initial sessionEndAt:', new Date(endTime).toISOString());
    return endTime;
  });
  const { seconds, progress } = useSessionCountdown(sessionEndAt, duration, 1000);
  
  // Validate countdown values to prevent crashes
  const safeSeconds = typeof seconds === 'number' && !isNaN(seconds) && seconds >= 0 ? seconds : duration;
  const safeProgress = typeof progress === 'number' && !isNaN(progress) ? progress : 100;
  const unblockTimeoutRef = useRef(null);
  const notifyTimeoutRef = useRef(null); // JS timer that fires the end notification exactly at end while foreground
  const endNotifIdRef = useRef(null);
  const endOsNotifIdRef = useRef(null); // OS-scheduled end notification id for background/killed fallback
  // Guard useTheme for test environments that don't mount NavigationContainer
  let navColors = {};
  try { navColors = useTheme()?.colors || {}; } catch (_) { navColors = {}; }
  const [startAt, setStartAt] = useState(Date.now());
  const [apps, setApps] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [selectionCounts, setSelectionCounts] = useState(null);
  const FAMILY_SELECTION_ID = 'focusflow_selection';
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Debug: log notifications received/responses to diagnose early or duplicate notifications
  useEffect(() => {
    const subRecv = Notifications.addNotificationReceivedListener((n) => {
      try {
        console.log('[Notifications] received:', n?.request?.identifier, n?.request?.content?.title, n?.request?.content?.data);
      } catch (e) {
        console.log('[Notifications] received (log error):', e);
      }
    });
    const subResp = Notifications.addNotificationResponseReceivedListener((r) => {
      try {
        console.log('[Notifications] response:', r?.notification?.request?.identifier, r?.notification?.request?.content?.data);
      } catch (e) {
        console.log('[Notifications] response (log error):', e);
      }
    });
    return () => {
      try { subRecv?.remove?.(); } catch {}
      try { subResp?.remove?.(); } catch {}
    };
  }, []);

  // Proactively dismiss any stray "focus-end" banners that may have been presented by a previous debug session
  useEffect(() => {
    (async () => {
      try {
        const presented = await (Notifications.getPresentedNotificationsAsync?.() || Promise.resolve([]));
        for (const n of presented || []) {
          try {
            const id = n?.request?.identifier;
            const data = n?.request?.content?.data;
            if (data?.type === 'focus-end' && id) {
              await Notifications.dismissNotificationAsync(id);
              console.log('[ActiveSession] Dismissed stray presented focus-end notification:', id);
            }
          } catch {}
        }
      } catch (e) {
        console.log('[ActiveSession] get/dismiss presented notifications failed (non-fatal):', e?.message || e);
      }
    })();
  }, []);

  // Helper: schedule end notification after clearing stale ones tagged as 'focus-end'
  const scheduleEndNotification = async (seconds, meta = {}) => {
    try {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of pending || []) {
        try {
          if (n?.content?.data?.type === 'focus-end') {
            await Notifications.cancelScheduledNotificationAsync(n.identifier);
            console.log('[ActiveSession] Cancelled pending focus-end notification:', n.identifier);
          }
        } catch (e) {
          console.log('[ActiveSession] Failed cancelling pending notif:', e?.message || e);
        }
      }

      // Use an absolute date trigger instead of a time-interval to avoid an iOS dev quirk
      // where interval triggers can occasionally fire immediately in debug sessions.
      const fireDate = new Date(Date.now() + Math.max(3, Math.floor(seconds)) * 1000);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Focus Session Complete! 🎯',
          body: `Your ${Math.max(1, Math.round(seconds / 60))} minute focus session is finished. Great work!`,
          data: { type: 'focus-end', intendedAt: fireDate.getTime(), ...meta },
        },
        trigger: { date: fireDate },
      });
      console.log('[ActiveSession] Scheduled focus-end notification id:', id, 'in', seconds, 'seconds');
      endNotifIdRef.current = id;
      return id;
    } catch (e) {
      console.log('[ActiveSession] Error scheduling focus-end notification:', e?.message || e);
    }
  };

  // Helper: when app is foreground, prefer a JS timer that fires the end notification exactly at end
  const scheduleEndNotificationAtExactEnd = (seconds, meta = {}) => {
    try {
      if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
      const delay = Math.max(1000, Math.floor(seconds) * 1000);
      notifyTimeoutRef.current = setTimeout(async () => {
        try {
          // Before firing, cancel the OS-scheduled fallback to avoid duplicate
          try {
            if (endOsNotifIdRef.current) {
              await Notifications.cancelScheduledNotificationAsync(endOsNotifIdRef.current);
              console.log('[ActiveSession] Cancelled OS fallback notification before JS-triggered end');
              endOsNotifIdRef.current = null;
            }
          } catch {}
          
          // Fire now (immediate trigger) with intendedAt = now
          const nowTs = Date.now();
          // Dismiss any stray banners first
          try {
            const presented = await (Notifications.getPresentedNotificationsAsync?.() || Promise.resolve([]));
            for (const n of presented || []) {
              try { if (n?.request?.content?.data?.type === 'focus-end') await Notifications.dismissNotificationAsync(n.request.identifier); } catch {}
            }
          } catch {}

          const id = await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Focus Session Complete! 🎯',
              body: `Nice work! Completed ${Math.max(1, Math.round(seconds / 60))} minutes.`,
              data: { type: 'focus-end', intendedAt: nowTs, ...meta },
            },
            trigger: null, // fire immediately at exact end while app is foreground
          });
          endNotifIdRef.current = id;
          console.log('[ActiveSession] Fired end notification via JS timer at exact end');
        } catch (e) {
          console.log('[ActiveSession] Failed to fire end notification at exact end:', e?.message || e);
        }
      }, delay);
      console.log('[ActiveSession] JS end-notification timer set for', seconds, 'seconds');
    } catch (e) {
      console.log('[ActiveSession] Failed to set JS end-notification timer:', e?.message || e);
    }
  };

  // Get contextual quote based on session duration
  const sessionMinutes = Math.ceil(duration / 60);
  const quote = getContextualQuote(sessionMinutes);
  
  // Check if DeviceActivity library is available
  const blockingAvailable = DeviceActivity !== null;

  // Handle app state changes to check session completion
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[ActiveSession] App became active, checking session status...');
        try {
          const currentSession = await getSession();
          if (currentSession?.active && currentSession?.endAt) {
            const now = Date.now();
            if (now >= currentSession.endAt) {
              console.log('[ActiveSession] Session should have ended, completing now...');
              // Complete the session
              await setSession({ active: false, endAt: null, totalSeconds: null });
              
              // Unblock apps
              if (blockingAvailable && DeviceActivity) {
                try {
                  const stored = await getSelectedApps();
                  const selectionId = stored?.familyActivitySelectionId || FAMILY_SELECTION_ID;
                  if (selectionId) {
                    DeviceActivity.unblockSelection({ familyActivitySelectionId: selectionId });
                  }
                  if (stored?.nativeFamilyActivitySelection) {
                    try { DeviceActivity.unblockSelection({ familyActivitySelection: stored.nativeFamilyActivitySelection }); } catch (_) {}
                  }
                  DeviceActivity.stopMonitoring(['focusSession']);
                } catch (e) {
                  console.log('[ActiveSession] Error unblocking on state change:', e);
                }
              }
              
              // Record the session
              await appendSessionRecord({
                id: String(now),
                startAt: currentSession.startAt || startAt,
                endAt: now,
                durationSeconds: duration,
                endedEarly: false,
                apps,
              });
              
              // Navigate back if still mounted
              if (mountedRef.current) {
                try { navigation.goBack(); } catch (_) {}
              }
            }
          }
        } catch (e) {
          console.log('[ActiveSession] Error checking session on app state change:', e);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    const now = Date.now();
    setStartAt(now);
    let endAt = now + duration * 1000;
    setSessionEndAt(endAt);
    (async () => {
      try {
        // Don't schedule notification here to avoid immediate firing
        const map = await getSelectedApps();
        let appIds = [];
        let selectionId = null;
        let localSelectionFromApps = null; // fallback selection built from legacy boolean map

        if (map?.familyActivitySelectionId) {
          selectionId = map.familyActivitySelectionId;
        } else if (map?.nativeFamilyActivitySelection) {
          // Backwards compatibility: a raw token was stored earlier
          if (DeviceActivity) {
            try {
              DeviceActivity.setFamilyActivitySelectionId({
                id: FAMILY_SELECTION_ID,
                familyActivitySelection: map.nativeFamilyActivitySelection,
              });
              selectionId = FAMILY_SELECTION_ID;
            } catch (e) {
              console.log('[ActiveSession] Failed to migrate selection token to id:', e);
            }
          }
        }

        if (selectionId) {
          appIds = [selectionId];
          // Derive counts for UI and attempt recovery if empty by re-migrating token
          try {
            const readMetaWithRetry = async (id) => {
              const delays = [0, 200, 500, 1000];
              let lastMeta = null;
              for (let i = 0; i < delays.length; i++) {
                if (delays[i] > 0) await sleep(delays[i]);
                try {
                  lastMeta = DeviceActivity?.activitySelectionMetadata({ familyActivitySelectionId: id });
                } catch (e) {
                  lastMeta = null;
                }
                const count = (lastMeta?.applicationCount || 0) + (lastMeta?.categoryCount || 0) + ((lastMeta?.webDomainCount ?? lastMeta?.webdomainCount) || 0);
                console.log('[ActiveSession] Metadata attempt', i + 1, '->', lastMeta);
                if (count > 0) return lastMeta;
              }
              return lastMeta;
            };

            let meta = await readMetaWithRetry(selectionId);
            const metaCount = (meta?.applicationCount || 0) + (meta?.categoryCount || 0) + ((meta?.webDomainCount ?? meta?.webdomainCount) || 0);
            if (!meta || metaCount === 0) {
              // Try to re-migrate from stored raw token and retry once more
              if (map?.nativeFamilyActivitySelection && DeviceActivity) {
                try {
                  console.log('[ActiveSession] Re-migrating selection token to id');
                  DeviceActivity.setFamilyActivitySelectionId({
                    id: FAMILY_SELECTION_ID,
                    familyActivitySelection: map.nativeFamilyActivitySelection,
                  });
                  meta = await readMetaWithRetry(FAMILY_SELECTION_ID);
                } catch (e) {
                  console.log('[ActiveSession] Re-migration failed:', e);
                }
              }
            }
            if (meta) setSelectionCounts(meta);
          } catch {}
        } else {
          // legacy boolean map -> chips fallback
          appIds = Object.entries(map || {})
            .filter(([, on]) => !!on)
            .map(([id]) => id);

          // Attempt to build a transient FamilyActivitySelection from legacy map for this session
          if (blockingAvailable && DeviceActivity && appIds.length > 0) {
            try {
              localSelectionFromApps = {
                includeEntireCategory: false,
                applicationTokens: appIds,
                webDomainTokens: [],
                categoryTokens: [],
              };
              console.log('[ActiveSession] Building transient selection from legacy app map with', appIds.length, 'apps');
              DeviceActivity.setFamilyActivitySelectionId({ id: FAMILY_SELECTION_ID, familyActivitySelection: localSelectionFromApps });
              selectionId = FAMILY_SELECTION_ID;
              // Best-effort metadata set
              try {
                const meta = DeviceActivity?.activitySelectionMetadata({ familyActivitySelectionId: selectionId });
                if (meta) setSelectionCounts(meta);
              } catch {}
            } catch (e) {
              console.log('[ActiveSession] Failed to construct transient selection from legacy map (continuing):', e?.message || e);
            }
          }
        }
        setApps(appIds);
        
        // Start blocking with native library if available
        if (blockingAvailable && DeviceActivity) {
          try {
            // Get current authorization status
            const currentStatus = DeviceActivity.getAuthorizationStatus();
            console.log('[ActiveSession] Current authorization status:', currentStatus);
            setAuthStatus(currentStatus);
            
            // Status values: 0 = notDetermined, 1 = denied, 2 = approved
            const isApproved = currentStatus === 2 || currentStatus === 'approved';
            
            // Request authorization if not already approved
            if (!isApproved) {
              console.log('[ActiveSession] Requesting authorization...');
              await DeviceActivity.requestAuthorization();
              // Check status again after request
              const newStatus = DeviceActivity.getAuthorizationStatus();
              console.log('[ActiveSession] Authorization status after request:', newStatus);
              setAuthStatus(newStatus);
            }
            
            // Get final status
            const finalStatus = DeviceActivity.getAuthorizationStatus();
            const finalApproved = finalStatus === 2 || finalStatus === 'approved';
            
            // If authorized, start monitoring with the selected apps
            if (finalApproved) {
              // Configure shield UI and actions if we have a selection id
              const selectionIdToUse = (appIds[0] === FAMILY_SELECTION_ID || appIds[0] === map?.familyActivitySelectionId) ? (map?.familyActivitySelectionId || FAMILY_SELECTION_ID) : null;

              if (selectionIdToUse) {
                try {
                  console.log('[ActiveSession] Using selectionId:', selectionIdToUse);
                  try {
                    const metaDebug = DeviceActivity?.activitySelectionMetadata({ familyActivitySelectionId: selectionIdToUse });
                    console.log('[ActiveSession] Selection metadata:', metaDebug);
                  } catch (e) {
                    console.log('[ActiveSession] Could not read selection metadata:', e);
                  }
                  // Create enhanced shield configuration with metadata counts
                  const appCount = selectionCounts?.applicationCount || 0;
                  const categoryCount = selectionCounts?.categoryCount || 0;
                  const websiteCount = selectionCounts?.webDomainCount || selectionCounts?.webdomainCount || 0;
                  const totalBlocked = appCount + categoryCount + websiteCount;
                  
                  // Create FocusFlow branded shield configuration
                  const contextualQuote = getContextualQuote(sessionMinutes);
                  
                  // Build subtitle with stats and quote
                  const statsText = totalBlocked > 0 ? 
                    `${appCount} apps, ${categoryCount} categories, ${websiteCount} websites blocked` : 
                    'Focus mode is active';
                  
                  const shieldConfig = {
                    // Main configuration
                    title: 'Stay Focused',
                    subtitle: contextualQuote,
                    primaryButtonLabel: 'Work It!',
                    
                    // FocusFlow brand colors
                    // NOTE: Native getColor expects values in 0-255 range
                    backgroundColor: { red: 137, green: 0, blue: 245, alpha: 0.95 }, // #8900f5 brand purple with slight transparency for depth
                    backgroundBlurStyle: 4, // systemUltraThinMaterialDark adds layering
                    titleColor: { red: 255, green: 255, blue: 255, alpha: 1.0 },
                    subtitleColor: { red: 200, green: 200, blue: 255, alpha: 1.0 }, // Light blue-tinted text
                    iconSystemName: 'hourglass',
                    iconTint: { red: 0, green: 114, blue: 255, alpha: 1.0 }, // #0072ff brand blue icon
                    
                    // White rounded button with blue text
                    primaryButtonBackgroundColor: { red: 255, green: 255, blue: 255, alpha: 1.0 },
                    primaryButtonLabelColor: { red: 0, green: 114, blue: 255, alpha: 1.0 }, // #0072ff blue text
                  };
                  
                  console.log('[ActiveSession] Applying custom shield configuration');
                  DeviceActivity.updateShield(shieldConfig, {
                    primary: { type: 'dismiss', behavior: 'close' },
                  });

                  // Block on interval start, unblock on end
                  DeviceActivity.configureActions({
                    activityName: 'focusSession',
                    callbackName: 'intervalDidStart',
                    actions: [
                      { type: 'blockSelection', familyActivitySelectionId: selectionIdToUse },
                    ],
                  });
                  DeviceActivity.configureActions({
                    activityName: 'focusSession',
                    callbackName: 'intervalDidEnd',
                    actions: [
                      { type: 'unblockSelection', familyActivitySelectionId: selectionIdToUse },
                    ],
                  });

                  // Immediately block as a runtime safety net (useful for short sessions)
                  try {
                    let totalBlocked = (selectionCounts?.applicationCount || 0) + (selectionCounts?.categoryCount || 0) + ((selectionCounts?.webDomainCount ?? selectionCounts?.webdomainCount) || 0);
                    if (totalBlocked === 0) {
                      // One more metadata refresh before deciding
                      try {
                        const refreshed = DeviceActivity?.activitySelectionMetadata({ familyActivitySelectionId: selectionIdToUse });
                        const refreshedCount = (refreshed?.applicationCount || 0) + (refreshed?.categoryCount || 0) + ((refreshed?.webDomainCount ?? refreshed?.webdomainCount) || 0);
                        if (refreshed) setSelectionCounts(refreshed);
                        totalBlocked = refreshedCount;
                      } catch {}
                    }

                    if (totalBlocked === 0) {
                      console.log('[ActiveSession] Metadata is zero. Attempting best-effort immediate block anyway.');
                      // Best-effort 1: block by selection id (may succeed even if metadata read fails)
                      try { DeviceActivity.blockSelection({ familyActivitySelectionId: selectionIdToUse }); console.log('[ActiveSession] blockSelection by id issued'); } catch {}
                      // Best-effort 2: block with native selection token if present
                      if (map?.nativeFamilyActivitySelection) {
                        try { DeviceActivity.blockSelection({ familyActivitySelection: map.nativeFamilyActivitySelection }); console.log('[ActiveSession] blockSelection by native selection issued'); } catch {}
                      }
                      // Best-effort 3: block with transient local selection built from legacy map
                      if (localSelectionFromApps) {
                        try { DeviceActivity.blockSelection({ familyActivitySelection: localSelectionFromApps }); console.log('[ActiveSession] blockSelection by transient app selection issued'); } catch {}
                      }
                    } else {
                      console.log('[ActiveSession] Immediately blocking selection...');
                      DeviceActivity.blockSelection({ familyActivitySelectionId: selectionIdToUse });
                      console.log('[ActiveSession] Successfully blocked with selectionId');
                      if (map?.nativeFamilyActivitySelection) {
                        try { 
                          DeviceActivity.blockSelection({ familyActivitySelection: map.nativeFamilyActivitySelection }); 
                          console.log('[ActiveSession] Successfully blocked with native selection');
                        } catch (nativeError) {
                          console.log('[ActiveSession] Native block failed (continuing):', nativeError);
                        }
                      }
                    }
                  } catch (e) {
                    console.log('[ActiveSession] Immediate blockSelection error (non-fatal in dev):', e?.message || e);
                  }
                } catch (e) {
                  console.log('[ActiveSession] configureActions error:', e);
                }
              }

              console.log('[ActiveSession] Starting monitoring for apps:', appIds);

              // Build a non-repeating schedule; for short sessions iOS often rejects short windows.
              // Strategy: use a minimum monitor window (30 min) for reliability, then JS-unblock at exact end.
              const nowDate = new Date();
              const startDate = new Date(nowDate.getTime() + 5 * 1000); // small delay
              const totalMinutes = Math.ceil(duration / 60);
              const minMonitorMinutes = Math.max(30, totalMinutes); // ensure >= system minimum
              const monitorEnd = new Date(startDate.getTime() + minMonitorMinutes * 60 * 1000);

              const schedule = {
                intervalStart: {
                  year: startDate.getFullYear(),
                  month: startDate.getMonth() + 1,
                  day: startDate.getDate(),
                  hour: startDate.getHours(),
                  minute: startDate.getMinutes(),
                  second: startDate.getSeconds(),
                },
                intervalEnd: {
                  year: monitorEnd.getFullYear(),
                  month: monitorEnd.getMonth() + 1,
                  day: monitorEnd.getDate(),
                  hour: monitorEnd.getHours(),
                  minute: monitorEnd.getMinutes(),
                  second: monitorEnd.getSeconds(),
                },
                repeats: false,
              };

              console.log('[ActiveSession] Computed monitor schedule:', {
                start: schedule.intervalStart,
                end: schedule.intervalEnd,
                requestedSeconds: duration,
                monitorMinutes: minMonitorMinutes,
              });

              try {
                console.log('[ActiveSession] Attempting to start monitoring...');
                await DeviceActivity.startMonitoring('focusSession', schedule, []);
                console.log('[ActiveSession] Monitoring started (window minutes):', minMonitorMinutes);
              } catch (e) {
                console.log('[ActiveSession] startMonitoring failed even with long window:', e?.message || e);
              }

              // End notification strategy:
              // - Foreground: use JS timer to fire at exact end (no early delivery quirk)
              // - Background/Killed: also schedule an OS absolute-date notification as fallback
              scheduleEndNotificationAtExactEnd(duration, { startAt: now, selectionId: selectionIdToUse });
              
              // Also schedule OS fallback notification for background/killed scenarios
              const osId = await scheduleEndNotification(duration, { startAt: now, selectionId: selectionIdToUse });
              endOsNotifIdRef.current = osId;

              // JS safety net: unblock at the exact requested duration
              if (selectionIdToUse) {
                try {
                  if (unblockTimeoutRef.current) clearTimeout(unblockTimeoutRef.current);
                  unblockTimeoutRef.current = setTimeout(async () => {
                    try {
                      console.log('[ActiveSession] JS timer reached, attempting cleanup and unblock');

                      const currentSession = await getSession();
                      if (!currentSession?.active) {
                        console.log('[ActiveSession] Session already inactive at JS timer, skipping');
                        return;
                      }

                      try {
                        DeviceActivity.unblockSelection({ familyActivitySelectionId: selectionIdToUse });
                        if (map?.nativeFamilyActivitySelection) {
                          try { DeviceActivity.unblockSelection({ familyActivitySelection: map.nativeFamilyActivitySelection }); } catch (_) {}
                        }
                        try { DeviceActivity.stopMonitoring(['focusSession']); } catch (_) {}
                        console.log('[ActiveSession] Unblock + stopMonitoring invoked');
                      } catch (e) {
                        console.log('[ActiveSession] Error unblocking on JS timer:', e?.message || e);
                      }

                      try {
                        await setSession({ active: false, endAt: null, totalSeconds: null });
                        const endAtReal = Date.now();
                        await appendSessionRecord({
                          id: String(endAtReal),
                          startAt: startAt,
                          endAt: endAtReal,
                          durationSeconds: duration,
                          endedEarly: false,
                          apps,
                        });
                        console.log('[ActiveSession] Session record appended at JS timer');
                      } catch (e) {
                        console.log('[ActiveSession] Error persisting session record at JS timer:', e?.message || e);
                      }

                      if (mountedRef.current) {
                        try { navigation.goBack(); } catch (_) {}
                      }
                    } catch (e) {
                      console.log('[ActiveSession] JS unblockSelection outer error:', e?.message || e);
                    }
                  }, Math.max(1000, duration * 1000));
                  console.log('[ActiveSession] JS unblock timer set for', duration, 'seconds');
                } catch (e) {
                  console.log('[ActiveSession] Failed to set JS unblock timer:', e?.message || e);
                }
              }
            } else {
              console.log('[ActiveSession] Authorization not approved, status:', finalStatus);
            }
          } catch (error) {
            console.log('[ActiveSession] Error starting monitoring:', error);
          }
        }
        
        console.log('[ActiveSession] About to set session state...');
        await setSession({ active: true, endAt, totalSeconds: duration, startAt: now });
        console.log('[ActiveSession] Session state set successfully');
      } catch (error) {
        console.log('[ActiveSession] Setup error:', error);
        Alert.alert('Session Setup Failed', `Unable to start focus session: ${error?.message || error}`);
        try { navigation.goBack(); } catch (_) {}
      }
    })();
    return () => {
      // Keep monitoring and JS timer running when leaving the screen;
      // only stop on explicit end or when the timer fires.
    };
  }, [duration]);

  // Auto-complete when timer hits zero
  useEffect(() => {
    if (safeSeconds === 0 && mountedRef.current) {
      (async () => {
        try {
          // Guard against duplicate completion when JS timer already ran
          const current = await getSession();
          if (!current?.active) return;
          // Clear the session state immediately to prevent restart loops
          await setSession({ active: false, endAt: null, totalSeconds: null });
          
          const endAt = Date.now();
          await appendSessionRecord({
            id: String(endAt),
            startAt,
            endAt,
            durationSeconds: duration,
            endedEarly: false,
            apps,
          });
          // Rely on scheduled end notification; don't send another here to avoid duplicates
          
          // Clear any pending unblock timer
          if (unblockTimeoutRef.current) {
            clearTimeout(unblockTimeoutRef.current);
            unblockTimeoutRef.current = null;
          }
          // Cancel notifications and timers
          try { if (endOsNotifIdRef.current) { await Notifications.cancelScheduledNotificationAsync(endOsNotifIdRef.current); endOsNotifIdRef.current = null; } } catch {}
          try { if (notifyTimeoutRef.current) { clearTimeout(notifyTimeoutRef.current); notifyTimeoutRef.current = null; } } catch {}
        } catch {}
        if (mountedRef.current) {
          // Navigate to Home tab after session completes
          navigation.navigate('MainTabs', { screen: 'Home' });
        }
      })();
    }
  }, [safeSeconds]);

  const { minutes, seconds: secs } = formatSeconds(safeSeconds);
  
  // Circular progress calculations
  const size = 220;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;
  
  const endEarly = async () => {
    // Close modal first
    setShowConfirm(false);
    
    try {
      // Unblock immediately if we used a selection id
      if (blockingAvailable && DeviceActivity) {
        try {
          const stored = await getSelectedApps();
          const selectionId = stored?.familyActivitySelectionId || FAMILY_SELECTION_ID;
          if (selectionId) {
            DeviceActivity.unblockSelection({ familyActivitySelectionId: selectionId });
            console.log('[ActiveSession] Unblocked via selectionId on early end');
          }
          if (stored?.nativeFamilyActivitySelection) {
            try { 
              DeviceActivity.unblockSelection({ familyActivitySelection: stored.nativeFamilyActivitySelection }); 
              console.log('[ActiveSession] Unblocked via native selection on early end');
            } catch (_) {}
          }
          DeviceActivity.stopMonitoring(['focusSession']);
          console.log('[ActiveSession] Stopped monitoring on early end');
        } catch (e) {
          console.log('[ActiveSession] Error during unblock on early end:', e);
        }
      }
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
      await setSession({ active: false, endAt: null, totalSeconds: null });
  // Cancel any scheduled/pending end notifications since we ended early
  try { if (endNotifIdRef.current) { await Notifications.cancelScheduledNotificationAsync(endNotifIdRef.current); endNotifIdRef.current = null; } } catch {}
  try { if (endOsNotifIdRef.current) { await Notifications.cancelScheduledNotificationAsync(endOsNotifIdRef.current); endOsNotifIdRef.current = null; } } catch {}
  try { if (notifyTimeoutRef.current) { clearTimeout(notifyTimeoutRef.current); notifyTimeoutRef.current = null; } } catch {}
      // Send an immediate early-end notification
      try { await maybeNotifySessionEnd(true, runSeconds); } catch {}
      if (unblockTimeoutRef.current) { clearTimeout(unblockTimeoutRef.current); unblockTimeoutRef.current = null; }
    } catch (e) {
      console.log('[ActiveSession] Error in endEarly cleanup:', e);
    }
    
    // Wait a bit longer to ensure unblock commands are processed by the OS
    await sleep(300);
    
    if (mountedRef.current) {
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  // Notify helper: silent if user hasn't granted notifications
  const maybeNotifySessionEnd = async (endedEarly, secondsRan) => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: endedEarly ? 'Focus session ended early' : 'Focus session complete',
          body: endedEarly
            ? `You focused for ${Math.max(1, Math.round(secondsRan / 60))} minutes.`
            : `Nice work! Completed ${Math.max(1, Math.round(duration / 60))} minutes.`,
        },
        trigger: null,
      });
    } catch {}
  };

  console.log('[ActiveSession] Rendering with seconds:', safeSeconds, 'progress:', safeProgress, 'endAt:', sessionEndAt);
  
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
              <Svg width={size} height={size} style={styles.circularProgress} key={`svg-${safeSeconds}`}>
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

          {/* Build capability notice */}
          {!blockingAvailable && (
            <View style={[styles.noticeBanner, shadows.sm]}>
              <AlertCircleIcon size={18} color={colors.warning} />
              <Text style={styles.noticeText}>
                App blocking isn't active in this build. Use an iOS dev build with DeviceActivity to enforce blocking.
              </Text>
            </View>
          )}
          
          {/* Authorization status notice */}
          {blockingAvailable && authStatus !== null && authStatus !== 2 && authStatus !== 'approved' && (
            <View style={[styles.noticeBanner, shadows.sm]}>
              <AlertCircleIcon size={18} color={colors.warning} />
              <Text style={styles.noticeText}>
                Screen Time permission is required for app blocking. Please authorize in Settings.
              </Text>
            </View>
          )}

          {/* Blocked Apps */}
          <View style={{ marginTop: spacing['2xl'] }}>
            <Text style={styles.sectionHeader}>BLOCKED APPS</Text>
            <View style={styles.appChipsRow}>
              {selectionCounts ? (
                <>
                  {(selectionCounts.applicationCount || 0) > 0 && (
                    <View style={[styles.appChip, shadows.sm]}>
                      <CameraIcon size={16} color={colors.foreground} />
                      <Text style={styles.appChipText}>
                        {selectionCounts.applicationCount} {selectionCounts.applicationCount === 1 ? 'App' : 'Apps'}
                      </Text>
                    </View>
                  )}
                  {(selectionCounts.categoryCount || 0) > 0 && (
                    <View style={[styles.appChip, shadows.sm]}>
                      <CameraIcon size={16} color={colors.foreground} />
                      <Text style={styles.appChipText}>
                        {selectionCounts.categoryCount} {selectionCounts.categoryCount === 1 ? 'Category' : 'Categories'}
                      </Text>
                    </View>
                  )}
                  {((selectionCounts.webDomainCount ?? selectionCounts.webdomainCount ?? 0) > 0) && (
                    <View style={[styles.appChip, shadows.sm]}>
                      <CameraIcon size={16} color={colors.foreground} />
                      <Text style={styles.appChipText}>
                        {(selectionCounts.webDomainCount ?? selectionCounts.webdomainCount ?? 0)} {((selectionCounts.webDomainCount ?? selectionCounts.webdomainCount ?? 0) === 1) ? 'Website' : 'Websites'}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                apps.slice(0, 5).map((appId) => {
                  const app = MOCK_APPS.find((a) => a.id === appId);
                  const AppIcon = app?.Icon || CameraIcon;
                  return (
                    <View key={appId} style={[styles.appChip, shadows.sm]}>
                      <AppIcon size={16} color={colors.foreground} />
                      <Text style={styles.appChipText}>{app?.name || 'App'}</Text>
                    </View>
                  );
                })
              )}
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
