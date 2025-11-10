import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Platform, AppState, Image, NativeModules, Alert } from 'react-native';
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
  const fallbackVerifyRef = useRef(null); // Secondary post-end verification timer
  const dateBackupIdRef = useRef(null);   // Backup absolute-date notification id (for background reliability)
  const intendedAtRef = useRef(null);     // Track intended fire time for scheduling backups
  const endNotifIdRef = useRef(null);
  const endOsNotifIdRef = useRef(null); // OS-scheduled end notification id for background/killed fallback
  const completingRef = useRef(false); // guard to prevent double completion/navigation
  const selectionIdRef = useRef(null); // track selection id used for blocking to adjust monitoring windows
  const monitorRefinedRef = useRef(false); // ensure we don't spam refine attempts per session
  const MIN_REFINEMENT_SECONDS = 300; // Avoid refining monitoring if less than 5 minutes remain
  // Guard useTheme for test environments that don't mount NavigationContainer
  let navColors = {};
  try { navColors = useTheme()?.colors || {}; } catch (_) { navColors = {}; }
  const [startAt, setStartAt] = useState(Date.now());
  const [apps, setApps] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSarcasm, setShowSarcasm] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [selectionCounts, setSelectionCounts] = useState(null);
  const FAMILY_SELECTION_ID = 'focusflow_selection';
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Helper: robust unblocking and cleanup at session end
  const safelyUnblockAll = async (selectionIdParam) => {
    try {
      const stored = await getSelectedApps();
      const selectionId = selectionIdParam || stored?.familyActivitySelectionId || FAMILY_SELECTION_ID;
      // 1) Unblock by selection id
      try { if (DeviceActivity && selectionId) DeviceActivity.unblockSelection({ familyActivitySelectionId: selectionId }); } catch {}
      // 2) Unblock by native selection token (if any)
      try { if (DeviceActivity && stored?.nativeFamilyActivitySelection) DeviceActivity.unblockSelection({ familyActivitySelection: stored.nativeFamilyActivitySelection }); } catch {}
      // 3) Stop monitoring
      try { if (DeviceActivity) DeviceActivity.stopMonitoring(['focusSession']); } catch {}
      // 4) Clear any residual ManagedSettings shields as a final safety net
      try { await NativeModules?.ManagedSettingsModule?.removeShield?.(); } catch {}
      console.log('[ActiveSession] Completed unblock cleanup');
    } catch (e) {
      console.log('[ActiveSession] safelyUnblockAll error:', e?.message || e);
    }
  };

  // Debug: log notifications received/responses to diagnose early or duplicate notifications
  useEffect(() => {
    const subRecv = Notifications.addNotificationReceivedListener((n) => {
      try {
        const when = new Date().toLocaleTimeString();
        const data = n?.request?.content?.data || {};
        const intendedAt = typeof data?.intendedAt === 'number' ? data.intendedAt : null;
        const now = Date.now();
        
        // Log ALL notification receive events (including early scheduling callbacks)
        console.log('[Notifications] Received at', when, ':', n?.request?.identifier, n?.request?.content?.title, {
          type: data?.type,
          intendedAt: intendedAt ? new Date(intendedAt).toLocaleTimeString() : 'none',
          nowVsIntended: intendedAt ? `${Math.round((now - intendedAt) / 1000)}s` : 'n/a',
        });
        
        // Note: expo-notifications fires this listener immediately upon scheduling with date triggers
        // The actual notification presentation is controlled by the global handler in App.js
        // which checks timing and decides whether to show the banner
      } catch (e) {
        console.log('[Notifications] received (log error):', e);
      }
    });
    const subResp = Notifications.addNotificationResponseReceivedListener((r) => {
      try {
        const when = new Date().toLocaleTimeString();
        console.log('[Notifications] USER TAPPED at', when, ':', r?.notification?.request?.identifier, r?.notification?.request?.content?.data);
      } catch (e) {
        console.log('[Notifications] response (log error):', e);
      }
    });
    return () => {
      try { subRecv?.remove?.(); } catch {}
      try { subResp?.remove?.(); } catch {}
    };
  }, []);

  // Scan presented notifications; ONLY dismiss truly stale focus-end (older than 15s past intendedAt)
  useEffect(() => {
    (async () => {
      try {
        const presented = await (Notifications.getPresentedNotificationsAsync?.() || Promise.resolve([]));
        const now = Date.now();
        for (const n of presented || []) {
          try {
            const id = n?.request?.identifier;
            const data = n?.request?.content?.data;
            const intendedAt = typeof data?.intendedAt === 'number' ? data.intendedAt : null;
            if (data?.type === 'focus-end' && id) {
              const isStale = intendedAt && now > (intendedAt + 15000); // 15s after intended fire
              if (isStale) {
                await Notifications.dismissNotificationAsync(id);
                console.log('[ActiveSession] Dismissed STALE focus-end notification:', id);
              } else {
                console.log('[ActiveSession] Keeping presented focus-end notification (not stale):', id);
              }
            }
          } catch {}
        }
      } catch (e) {
        console.log('[ActiveSession] presented scan failed (non-fatal):', e?.message || e);
      }
    })();
  }, []);

  // Helper: schedule end notification after clearing stale ones tagged as 'focus-end'
  // Uses absolute date trigger (like reminders) for reliable background delivery
  const scheduleEndNotification = async (sessionStartTime, durationSeconds) => {
    try {
      console.log('[ActiveSession] scheduleEndNotification called:', {
        sessionStartTime,
        durationSeconds,
        startTimeReadable: new Date(sessionStartTime).toLocaleTimeString(),
      });
      
      // Clear any existing focus-end notifications
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of pending || []) {
        try {
          if (n?.content?.data?.type === 'focus-end') {
            await Notifications.cancelScheduledNotificationAsync(n.identifier);
            console.log('[ActiveSession] Cancelled stale focus-end notification:', n.identifier);
          }
        } catch (e) {
          console.log('[ActiveSession] Failed cancelling pending notif:', e?.message || e);
        }
      }

  // Calculate notification time EXACTLY like reminders:
      // sessionStartTime + sessionDuration (no extra buffer)
      const notificationTime = sessionStartTime + (durationSeconds * 1000);
  intendedAtRef.current = notificationTime;
      const fireAtStr = new Date(notificationTime).toLocaleTimeString();
      const now = Date.now();
      const secondsUntilFire = Math.max(1, Math.floor((notificationTime - now) / 1000));
      
      console.log('[ActiveSession] Will fire at:', fireAtStr, '(in', secondsUntilFire, 'seconds)');
      
      // Primary: Use time interval trigger for foreground reliability
      const intervalTrigger = { seconds: secondsUntilFire, repeats: false };

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Focus Session Complete! 🎯${__DEV__ ? ` · ${fireAtStr}` : ''}`,
          body: `Your ${Math.max(1, Math.round(durationSeconds / 60))} minute focus session is finished. Great work!`,
          data: { 
            type: 'focus-end', 
            intendedAt: notificationTime,
            sessionStartTime,
            durationSeconds,
            primary: true,
            mechanism: 'interval',
          },
          sound: true,
          badge: 0,
          interruptionLevel: 'timeSensitive',
        },
        trigger: intervalTrigger,
      });
      
      console.log('[ActiveSession] ✓ Scheduled end notification:', {
        id,
        scheduledAt: new Date().toLocaleTimeString(),
        willFireAt: fireAtStr,
        secondsUntilFire,
      });
      
      endNotifIdRef.current = id;

      // Immediate post-schedule presented scan for debug visibility
      try {
        const presented = await Notifications.getPresentedNotificationsAsync();
        const hasFocusBanner = (presented || []).some(p => p?.request?.content?.data?.type === 'focus-end');
        console.log('[ActiveSession] Post-schedule presented scan:', { hasFocusBanner, presentedCount: presented?.length || 0 });
      } catch (scanErr) {
        console.log('[ActiveSession] Post-schedule presented scan failed:', scanErr?.message || scanErr);
      }

      // Foreground fallback (only if app stays foreground). Fires at intended end if banner not presented.
      try {
        if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
        notifyTimeoutRef.current = setTimeout(async () => {
          try {
            const state = AppState.currentState;
            const now = Date.now();
            const drift = now - notificationTime;
            if (state !== 'active') {
              console.log('[ActiveSession][Fallback] App not active at end; relying on OS delivery.');
              return;
            }
            if (drift > 8000) {
              console.log('[ActiveSession][Fallback] Drift too large (', drift, 'ms ); skipping foreground fallback');
              return;
            }
            const presented = await Notifications.getPresentedNotificationsAsync();
            const alreadyPresented = (presented || []).some(p => p?.request?.content?.data?.type === 'focus-end');
            if (alreadyPresented) {
              console.log('[ActiveSession][Fallback] Banner already presented, no fallback needed');
              return;
            }
            console.log('[ActiveSession][Fallback] Scheduling immediate fallback notification');
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Focus Session Complete! 🎯',
                body: `You finished your ${Math.max(1, Math.round(durationSeconds / 60))} minute focus session. Great work!`,
                data: {
                  type: 'focus-end',
                  intendedAt: notificationTime,
                  sessionStartTime,
                  durationSeconds,
                  isFallback: true,
                },
                sound: true,
                badge: 0,
                interruptionLevel: 'timeSensitive',
              },
              trigger: null,
            });
          } catch (fallbackErr) {
            console.log('[ActiveSession][Fallback] Error scheduling foreground fallback:', fallbackErr?.message || fallbackErr);
          }
        }, secondsUntilFire * 1000);
        console.log('[ActiveSession] Foreground fallback timer set for', secondsUntilFire, 'seconds');
      } catch (fallbackTimerErr) {
        console.log('[ActiveSession] Failed to set foreground fallback timer:', fallbackTimerErr?.message || fallbackTimerErr);
      }

      return id;
    } catch (e) {
      console.log('[ActiveSession] Error scheduling focus-end notification:', e?.message || e);
    }
  };

  // Schedule an absolute-date backup notification (reminder-style) for background reliability
  const scheduleDateBackupNotification = async () => {
    try {
      const notificationTime = intendedAtRef.current || sessionEndAt;
      if (!notificationTime) return;
      const fireAtStr = new Date(notificationTime).toLocaleTimeString();
      // Avoid double-scheduling
      if (dateBackupIdRef.current) {
        console.log('[ActiveSession] Date backup already scheduled:', dateBackupIdRef.current);
        return;
      }
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Focus Session Complete! 🎯${__DEV__ ? ` · ${fireAtStr}` : ''}`,
          body: `Your focus session is finished. Great work!`,
          data: {
            type: 'focus-end',
            intendedAt: notificationTime,
            mechanism: 'date',
            backup: 'date',
          },
          sound: true,
          badge: 0,
          interruptionLevel: 'timeSensitive',
        },
        // Reminder-style absolute date trigger (new API shape)
        trigger: { type: 'date', date: notificationTime },
      });
      dateBackupIdRef.current = id;
      console.log('[ActiveSession] ✓ Scheduled date-backup focus-end notification:', { id, fireAt: fireAtStr });
    } catch (e) {
      console.log('[ActiveSession] Error scheduling date-backup notification:', e?.message || e);
    }
  };

  // Adjust DeviceActivity monitoring window to end exactly at intended session end, so iOS unblocks even if app stays suspended
  const updateMonitoringForSessionEnd = async () => {
    if (!DeviceActivity) return;
    try {
      const selectionId = selectionIdRef.current;
      const endAt = intendedAtRef.current || sessionEndAt;
      if (!endAt) return;
      const nowDate = new Date();
      const remainingMs = endAt - nowDate.getTime();
      const remainingSeconds = Math.floor(remainingMs / 1000);
      if (remainingSeconds <= 0) return;
      if (remainingSeconds < MIN_REFINEMENT_SECONDS) {
        console.log('[ActiveSession] Skipping monitoring refine (remaining <', MIN_REFINEMENT_SECONDS, 's). Keeping long window for reliability.');
        return;
      }
      if (monitorRefinedRef.current) {
        // Already refined successfully once; no need to repeat
        return;
      }
      const startDate = new Date(nowDate.getTime() + 2000); // small delay to satisfy scheduling API
      const endDate = new Date(Math.max(endAt, nowDate.getTime() + 5000)); // ensure end > start

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
          year: endDate.getFullYear(),
          month: endDate.getMonth() + 1,
          day: endDate.getDate(),
          hour: endDate.getHours(),
          minute: endDate.getMinutes(),
          second: endDate.getSeconds(),
        },
        repeats: false,
      };

      console.log('[ActiveSession] Updating monitoring window to session end:', {
        start: schedule.intervalStart,
        end: schedule.intervalEnd,
      });
      // Try to start refined schedule without stopping first; if API requires stop, we'll retry after stopping
      try {
        await DeviceActivity.startMonitoring('focusSession', schedule, []);
        monitorRefinedRef.current = true;
        console.log('[ActiveSession] Monitoring updated to end at intended time');
        return;
      } catch (startErr) {
        console.log('[ActiveSession] startMonitoring refine attempt failed (will try stop+start):', startErr?.message || startErr);
      }

      // Retry with stop+start, but if it fails, restore a safe long window to keep blocking
      try {
        DeviceActivity.stopMonitoring(['focusSession']);
      } catch {}
      try {
        await DeviceActivity.startMonitoring('focusSession', schedule, []);
        monitorRefinedRef.current = true;
        console.log('[ActiveSession] Monitoring updated to end at intended time (after stop)');
        return;
      } catch (stopStartErr) {
        console.log('[ActiveSession] Refine after stop failed:', stopStartErr?.message || stopStartErr);
        // Restore a reliable long window so blocking continues
        try {
          const fallbackStart = new Date(Date.now() + 5000);
          const totalMinutes = Math.ceil(duration / 60);
          const minMonitorMinutes = Math.max(30, totalMinutes);
          const fallbackEnd = new Date(fallbackStart.getTime() + minMonitorMinutes * 60 * 1000);
          const fallbackSchedule = {
            intervalStart: {
              year: fallbackStart.getFullYear(),
              month: fallbackStart.getMonth() + 1,
              day: fallbackStart.getDate(),
              hour: fallbackStart.getHours(),
              minute: fallbackStart.getMinutes(),
              second: fallbackStart.getSeconds(),
            },
            intervalEnd: {
              year: fallbackEnd.getFullYear(),
              month: fallbackEnd.getMonth() + 1,
              day: fallbackEnd.getDate(),
              hour: fallbackEnd.getHours(),
              minute: fallbackEnd.getMinutes(),
              second: fallbackEnd.getSeconds(),
            },
            repeats: false,
          };
          console.log('[ActiveSession] Restoring long monitoring window after refine failure');
          await DeviceActivity.startMonitoring('focusSession', fallbackSchedule, []);
          console.log('[ActiveSession] Long monitoring restored');
        } catch (restoreErr) {
          console.log('[ActiveSession] Failed to restore long monitoring window:', restoreErr?.message || restoreErr);
        }
      }
    } catch (e) {
      console.log('[ActiveSession] Failed to update monitoring window (will rely on fallback):', e?.message || e);
    }
  };

  // Note: We rely solely on the OS absolute-date notification (like reminders do) for reliable background delivery.
  // No JS timer that could cancel the OS notification—let iOS handle delivery in all states.

  // Get contextual quote based on session duration
  const sessionMinutes = Math.ceil(duration / 60);
  const quote = getContextualQuote(sessionMinutes);
  
  // Check if DeviceActivity library is available
  const blockingAvailable = DeviceActivity !== null;
  const scheduledOnceRef = useRef(false);

  // Handle app state changes to check session completion
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('[ActiveSession] App going to background, scheduling date backup');
        // Cancel foreground fallback timer to avoid duplicate
        if (notifyTimeoutRef.current) {
          clearTimeout(notifyTimeoutRef.current);
          notifyTimeoutRef.current = null;
          console.log('[ActiveSession] Cleared foreground fallback timer (background)');
        }
        // Schedule absolute-date backup (reminder style)
        await scheduleDateBackupNotification();
        // Try to align native monitoring end with the session end so iOS unblocks automatically
        await updateMonitoringForSessionEnd();
      } else if (nextAppState === 'active') {
        console.log('[ActiveSession] App became active, checking session status...');
        try {
          const currentSession = await getSession();
          if (currentSession?.active && currentSession?.endAt) {
            const now = Date.now();
            if (now >= currentSession.endAt) {
              if (completingRef.current) {
                return;
              }
              completingRef.current = true;
              console.log('[ActiveSession] Session should have ended, completing now...');
              // Complete the session
              await setSession({ active: false, endAt: null, totalSeconds: null });
              
              // Do not cancel the scheduled end notification here; allow iOS to present it.
              // We will rely on lazy cleanup later. Allow new sessions to schedule again.
              scheduledOnceRef.current = false;

              // Unblock apps (robust)
              await safelyUnblockAll();
              
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
    // Obtain existing session BEFORE setting new endAt to avoid overwriting an in-progress or stale session.
    const now = Date.now();
    (async () => {
      let existingSession = null;
      try { existingSession = await getSession(); } catch {}
      if (existingSession?.active && existingSession?.endAt && now < existingSession.endAt) {
        // Continue active session
        console.log('[ActiveSession] Continuing existing active session until', existingSession.endAt);
        setStartAt(existingSession.startAt || now);
        setSessionEndAt(existingSession.endAt);
      } else {
        // Start fresh session; clean stale if needed
        if (existingSession?.active && existingSession?.endAt && now >= existingSession.endAt) {
          console.log('[ActiveSession] Cleaning stale active session (past endAt) before starting new');
          try { await setSession({ active: false, endAt: null, totalSeconds: null }); } catch {}
        }
        setStartAt(now);
        const endAtCalc = now + duration * 1000;
        setSessionEndAt(endAtCalc);
      }
    })();
    (async () => {
      try {
        // CRITICAL: Check if session is already active to prevent re-initialization on remount
        const existingSession = await getSession();
        if (existingSession?.active && now < existingSession.endAt) {
          // Already handled earlier, just restore apps metadata
          const map = await getSelectedApps();
          if (map?.familyActivitySelectionId) {
            setApps([map.familyActivitySelectionId]);
            try {
              const meta = DeviceActivity?.activitySelectionMetadata({ familyActivitySelectionId: map.familyActivitySelectionId });
              if (meta) setSelectionCounts(meta);
            } catch {}
          }
          return;
        }
        
        // Determine session start time: use existing if resuming, else now
        const sessionStart = existingSession?.startAt || now;
        
        // Store session state FIRST (so notification scheduling can reference it if needed)
        const effectiveEndAt = sessionEndAt || (now + duration * 1000);
        await setSession({ active: true, endAt: effectiveEndAt, totalSeconds: duration, startAt: sessionStart });
        console.log('[ActiveSession] Session state persisted:', {
          startAt: new Date(sessionStart).toLocaleTimeString(),
          endAt: new Date(effectiveEndAt).toLocaleTimeString(),
        });
        
        // ✅ Schedule end notification using stored session start time
        // Use reminder-style absolute date scheduling for reliable background delivery
        if (duration > 0) {
          const notifId = await scheduleEndNotification(sessionStart, duration);
          if (notifId) {
            endOsNotifIdRef.current = notifId;
            scheduledOnceRef.current = true;
            console.log('[ActiveSession] ✓ Scheduled reminder-style end notification, id:', notifId);
          }
        }
        
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
              // Small initial delay helps native metadata become available and reduces noisy zero-count logs
              const delays = [200, 500, 1000];
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
                  selectionIdRef.current = selectionIdToUse;
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
                // Immediately refine monitoring window to the exact session end so auto-unblock can occur without app foreground
                try {
                  await updateMonitoringForSessionEnd();
                } catch (refineErr) {
                  console.log('[ActiveSession] refine monitoring window failed (non-fatal):', refineErr?.message || refineErr);
                }
              } catch (e) {
                console.log('[ActiveSession] startMonitoring failed even with long window:', e?.message || e);
              }

              // End notification: Will be scheduled automatically when app goes to background
              // via the AppState listener. This avoids iOS quirks with immediate foreground delivery.

              // JS safety net: unblock at the exact requested duration (Android only; iOS suspends timers and we already schedule OS notif)
              if (selectionIdToUse && Platform.OS !== 'ios') {
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

                      await safelyUnblockAll(selectionIdToUse);

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
        
        console.log('[ActiveSession] Initialization complete');
      } catch (error) {
        console.log('[ActiveSession] Setup error:', error);
        Alert.alert('Session Setup Failed', `Unable to start focus session: ${error?.message || error}`);
        try { navigation.goBack(); } catch (_) {}
      }
    })();
    return () => {
      // Cleanup timers when component unmounts
      if (notifyTimeoutRef.current) {
        clearTimeout(notifyTimeoutRef.current);
        notifyTimeoutRef.current = null;
      }
      if (fallbackVerifyRef.current) {
        clearTimeout(fallbackVerifyRef.current);
        fallbackVerifyRef.current = null;
      }
      // Note: No need to cancel OS-scheduled backups here; they will be cleaned when a new session starts.
    };
  }, [duration]);

  // Auto-complete when timer hits zero
  useEffect(() => {
    const now = Date.now();
    const hasExpired = sessionEndAt && now >= sessionEndAt;
    
    if (__DEV__) {
      console.log('[ActiveSession] Timer check:', { 
        safeSeconds, 
        hasExpired, 
        now, 
        sessionEndAt,
        diff: sessionEndAt - now 
      });
    }
    
    if ((safeSeconds <= 0 || hasExpired) && mountedRef.current) {
      (async () => {
        try {
          // Guard against duplicate completion
          if (completingRef.current) {
            console.log('[ActiveSession] Already completing, skipping duplicate');
            return;
          }
          completingRef.current = true;
          
          // Guard against duplicate completion when JS timer already ran
          const current = await getSession();
          if (!current?.active) {
            console.log('[ActiveSession] Session already inactive, forcing UI completion/navigation');
            // Best-effort unblock and navigate away so UI doesn't stick at 00:00
            try { await safelyUnblockAll(); } catch {}
            if (mountedRef.current) {
              try { navigation.navigate('MainTabs', { screen: 'Home' }); } catch (_) {
                try { navigation.goBack(); } catch {}
              }
            }
            return;
          }
          
          console.log('[ActiveSession] Timer reached zero, completing session...');
          
          // Clear the session state immediately to prevent restart loops
          await setSession({ active: false, endAt: null, totalSeconds: null });

          // Ensure apps are unblocked even if JS timer didn't fire
          await safelyUnblockAll();
          
          const endAt = Date.now();
          await appendSessionRecord({
            id: String(endAt),
            startAt,
            endAt,
            durationSeconds: duration,
            endedEarly: false,
            apps,
          });
          
          console.log('[ActiveSession] Session record saved, cleaning up...');
          console.log('[ActiveSession] End reached; verifying focus-end notification presence');
          try {
            const presented = await Notifications.getPresentedNotificationsAsync();
            const hasBanner = (presented || []).some(p => p?.request?.content?.data?.type === 'focus-end');
            console.log('[ActiveSession] Immediate end banner presence:', hasBanner);
            if (!hasBanner) {
              console.log('[ActiveSession] No banner at end; scheduling immediate fallback notification');
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Focus Session Complete! 🎯',
                  body: `You completed your ${Math.max(1, Math.round(duration / 60))} minute focus session. Great work!`,
                  data: {
                    type: 'focus-end',
                    intendedAt: Date.now(),
                    isFallback: true,
                    immediateEndFallback: true,
                  },
                  sound: true,
                  badge: 0,
                  interruptionLevel: 'timeSensitive',
                },
                trigger: null,
              });
            }
          } catch (endCheckErr) {
            console.log('[ActiveSession] End banner immediate check error:', endCheckErr?.message || endCheckErr);
          }

          // Clear any pending unblock timer
          if (unblockTimeoutRef.current) {
            clearTimeout(unblockTimeoutRef.current);
            unblockTimeoutRef.current = null;
          }
        } catch (e) {
          console.log('[ActiveSession] Error during session completion:', e);
        }
        
        if (mountedRef.current) {
          console.log('[ActiveSession] Navigating to Home...');
          // Post-end verification fallback (5s later) if still missing
          try {
            if (fallbackVerifyRef.current) clearTimeout(fallbackVerifyRef.current);
            fallbackVerifyRef.current = setTimeout(async () => {
              try {
                const presented = await Notifications.getPresentedNotificationsAsync();
                const hasBanner = (presented || []).some(p => p?.request?.content?.data?.type === 'focus-end');
                if (!hasBanner) {
                  console.log('[ActiveSession][Verify] Still no banner after 5s; scheduling secondary fallback');
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: 'Focus Session Complete! 🎯',
                      body: 'Staying focused pays off—session finished!',
                      data: {
                        type: 'focus-end',
                        intendedAt: Date.now(),
                        isFallback: true,
                        verifyFallback: true,
                      },
                      sound: true,
                      badge: 0,
                      interruptionLevel: 'timeSensitive',
                    },
                    trigger: null,
                  });
                } else {
                  console.log('[ActiveSession][Verify] Banner present after 5s; no secondary fallback needed');
                }
              } catch (verifyErr) {
                console.log('[ActiveSession][Verify] Error during 5s verification:', verifyErr?.message || verifyErr);
              }
            }, 5000);
          } catch (verifySetupErr) {
            console.log('[ActiveSession][Verify] Failed to set 5s verification timer:', verifySetupErr?.message || verifySetupErr);
          }

          // Navigate to Home tab after session completes
          try {
            navigation.navigate('MainTabs', { screen: 'Home' });
          } catch (navError) {
            console.log('[ActiveSession] Navigation error:', navError);
            // Fallback: try goBack
            try {
              navigation.goBack();
            } catch {
              console.log('[ActiveSession] goBack also failed');
            }
          }
        }
      })();
    }
  }, [safeSeconds, sessionEndAt]);

  const { minutes, seconds: secs } = formatSeconds(safeSeconds);
  
  // Circular progress calculations
  const size = 220;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;
  
  const endEarly = async () => {
    // Close the confirmation modal
    setShowConfirm(false);
    
    // Show sarcastic rejection message
    setShowSarcasm(true);
    
    // Auto-dismiss sarcasm modal after 3 seconds and return to session screen
    setTimeout(() => {
      setShowSarcasm(false);
    }, 5000);
    
    // NO unblocking logic here - apps stay locked!
    // User must wait for timer to finish or uninstall the app
    console.log('[ActiveSession] Nice try! User attempted to end session early but was rejected 😂');
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

  if (__DEV__) {
  console.log('[ActiveSession] Rendering with seconds:', safeSeconds, 'progress:', safeProgress, 'endAt:', sessionEndAt);
  }
  
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

      {/* Sarcastic Rejection Modal */}
      <Modal visible={showSarcasm} transparent animationType="fade" onRequestClose={() => setShowSarcasm(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard tint="dark" intensity={60} cornerRadius={24} contentStyle={{ padding: spacing['2xl'], alignItems: 'center' }} style={{ width: '100%', maxWidth: 400 }}>
            <Image 
              source={require('../../assets/grinning_face_with_sweat_animated.png')} 
              style={{ width: 120, height: 120, marginBottom: spacing.md }}
              resizeMode="contain"
            />
            <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: spacing.lg }]}>
              Nice try!!! 😂
            </Text>
            <Text style={[styles.modalDescription, { textAlign: 'center', marginTop: spacing.md }]}>
              Nice try!!! Go back to work! 
            </Text>
            <Text style={[styles.motivationText, { textAlign: 'center'}]}>
              Your apps will stay blocked until the timer ends.     
            </Text>
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
