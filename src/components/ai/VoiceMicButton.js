import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, Modal, TextInput, Text, StyleSheet, Alert, Animated, Platform, NativeModules, KeyboardAvoidingView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, controlSizes, effects } from '../../theme';
import { FLAGS, STTService, handleUtterance } from '../../modules/ai';
import { speak as ttsSpeak, stop as ttsStop, isAvailable as ttsAvailable } from '../../modules/ai/voice/tts-service';
import { isFamilyPickerAvailable } from '../../modules/ai/aliases/alias-native';
import { parseIntentHybrid, trackResponseTime } from '../../modules/ai/nlu/hybrid-intent-service';
import { updateContext, needsClarification } from '../../modules/ai/conversation-context';
import { getGuidancePrompt, isConfirmation } from '../../modules/ai/nlu/intent-classifier';
import { executeReminder } from '../../modules/ai/executor/reminder-executor';
import { deleteReminder } from '../../modules/reminders/reminder-store';
import { setSession, getReminders as getLegacyReminders, setReminders as setLegacyReminders } from '../../storage';
import PermissionExplainerModal from './PermissionExplainerModal';
import { checkMicrophonePermission, requestPermissionWithFlow } from '../../utils/permission-helper';
import { getVoiceSettings } from '../../storage';
import { useToast } from '../../contexts/ToastContext';
import { getRemainingCloudCalls, incrementCloudUsage } from '../../modules/ai/usage-tracker';
import { canUseVoiceReminders, getTTSVoiceType } from '../../lib/permissions/premium-gates';
import PremiumModal from '../PremiumModal';
import { performUpgrade } from '../../lib/premiumUpgrade';

// Import DeviceActivity for iOS blocking
let DeviceActivity = null;
if (Platform.OS === 'ios') {
  try {
    DeviceActivity = require('react-native-device-activity');
  } catch (error) {
    console.log('[VoiceMicButton] react-native-device-activity not available');
  }
}

export default function VoiceMicButton({ style }) {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const enabled = FLAGS.AI_VOICE_ENABLED;
  const [manualOpen, setManualOpen] = useState(false);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [showPermissionExplainer, setShowPermissionExplainer] = useState(false);
  const [permissionGrantCallback, setPermissionGrantCallback] = useState(null);
  const [voiceSettingsEnabled, setVoiceSettingsEnabled] = useState(true);
  const [aiUsage, setAiUsage] = useState({ remaining: 5, used: 0, canUse: true }); // AI usage tracking
  const [showPremium, setShowPremium] = useState(false); // Premium modal state
  const pulse = useRef(new Animated.Value(1)).current;
  const busyRef = useRef(false);
  const lastUtteranceRef = useRef('');
  const pendingIntentRef = useRef(null); // For storing unclear-action intents
  const responseStartTimeRef = useRef(null); // Track when user stopped speaking for response time measurement
  
  // Undo state - store last action for undo capability
  const lastActionRef = useRef(null); // { type: 'reminder'|'session', data: {...} }

  const sttAvailable = useMemo(() => STTService.isAvailable?.() || false, []);
  const ttsEnabled = FLAGS.AI_TTS_ENABLED;
  // Guard to suppress TTS when a confirmation was cancelled
  const reminderConfirmTokenRef = useRef(null); // { id, cancelled }

  // Visual-only animations for listening state
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const bar1 = useRef(new Animated.Value(8)).current;
  const bar2 = useRef(new Animated.Value(18)).current;
  const bar3 = useRef(new Animated.Value(10)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current; // gradient overlay fade for listening state

  // Load voice settings and usage on mount
  useEffect(() => {
    getVoiceSettings().then((settings) => {
      setVoiceSettingsEnabled(settings.voiceEnabled);
    }).catch(() => {
      setVoiceSettingsEnabled(true); // Default to enabled if load fails
    });
    
    // Load AI usage stats
    getRemainingCloudCalls().then((usage) => {
      setAiUsage(usage);
    }).catch((err) => {
      console.error('[VoiceMicButton] Failed to load AI usage:', err);
    });
  }, []);
  
  // Helper to refresh usage counter
  const refreshUsage = async () => {
    try {
      const usage = await getRemainingCloudCalls();
      setAiUsage(usage);
      return usage;
    } catch (err) {
      console.error('[VoiceMicButton] Failed to refresh usage:', err);
      return aiUsage; // Return current state on error
    }
  };

  if (!enabled || !voiceSettingsEnabled) return null;

  // Undo helpers
  const storeLastAction = (type, data) => {
    lastActionRef.current = { type, data, timestamp: Date.now() };
  };

  const undoReminder = async () => {
    const lastAction = lastActionRef.current;
    if (!lastAction || lastAction.type !== 'reminder') {
      console.warn('[VoiceMicButton] No reminder to undo');
      return;
    }
    
    try {
      const reminderData = lastAction.data.result;
      const intent = lastAction.data.intent;
      
      // 1. Cancel the scheduled notification(s)
      if (reminderData.notificationIds) {
        const ids = Array.isArray(reminderData.notificationIds) 
          ? reminderData.notificationIds 
          : [reminderData.notificationIds];
        
        for (const id of ids) {
          try {
            await Notifications.cancelScheduledNotificationAsync(id);
            console.log('[VoiceMicButton] Cancelled notification:', id);
          } catch (e) {
            console.warn('[VoiceMicButton] Failed to cancel notification:', id, e?.message);
          }
        }

        // 1b. Remove mirrored legacy reminders used by Home/Reminders UI
        try {
          const legacy = await getLegacyReminders();
          const idSet = new Set(ids);
          const next = (legacy || []).filter((r) => {
            const byNotif = r?.notificationId && idSet.has(r.notificationId);
            const byText = intent?.message && (String(r?.text || '').toLowerCase() === String(intent.message).toLowerCase());
            return !(byNotif || byText);
          });
          await setLegacyReminders(next);
        } catch (e) {
          console.warn('[VoiceMicButton] Failed to update legacy reminders on undo:', e?.message);
        }
      }
      
      // 2. Remove reminder from storage
      if (reminderData.reminderId) {
        await deleteReminder(reminderData.reminderId);
        console.log('[VoiceMicButton] Deleted reminder:', reminderData.reminderId);
      }
      
      // 3. Show confirmation
      showToast('Reminder cancelled', { type: 'info' });
      lastActionRef.current = null;
      
    } catch (error) {
      console.error('[VoiceMicButton] Failed to undo reminder:', error);
      showToast('Failed to cancel reminder', { type: 'error' });
    }
  };

  const undoBlockingSession = async () => {
    const lastAction = lastActionRef.current;
    if (!lastAction || lastAction.type !== 'session') {
      console.warn('[VoiceMicButton] No session to undo');
      return;
    }
    
    try {
      console.log('[VoiceMicButton] Undoing session - grace period cancellation');
      // If we're still in the grace period (navigation hasn't happened), just cancel the timer
      if (lastAction.data?.graceTimeoutId && !lastAction.data?.hasStarted) {
        try { clearTimeout(lastAction.data.graceTimeoutId); } catch {}
        showToast('Session cancelled', { type: 'info' });
        lastActionRef.current = null;
        return;
      }
      
      // 1. Stop monitoring (if DeviceActivity is available)
      if (DeviceActivity) {
        try {
          DeviceActivity.stopMonitoring(['focusSession']);
          console.log('[VoiceMicButton] Stopped monitoring');
        } catch (e) {
          console.warn('[VoiceMicButton] Failed to stop monitoring:', e?.message);
        }
        
        // 2. Try to unblock selection (if we have selection data)
        try {
          // Attempt multiple unblock strategies for safety
          if (lastAction.data.familyActivitySelection) {
            DeviceActivity.unblockSelection({ 
              familyActivitySelection: lastAction.data.familyActivitySelection 
            });
          }
          DeviceActivity.unblockSelection({ 
            familyActivitySelectionId: 'focusflow_selection' 
          });
          console.log('[VoiceMicButton] Unblocked selection');
        } catch (e) {
          console.warn('[VoiceMicButton] Failed to unblock selection:', e?.message);
        }
      }
      
      // 3. Remove shield (if ManagedSettings is available)
      try {
        await NativeModules?.ManagedSettingsModule?.removeShield?.();
        console.log('[VoiceMicButton] Removed shield');
      } catch (e) {
        console.warn('[VoiceMicButton] Failed to remove shield:', e?.message);
      }
      
      // 4. Clear session storage
      await setSession({ active: false, endAt: null, totalSeconds: null });
      console.log('[VoiceMicButton] Cleared session storage');
      
      // 5. Navigate back to home
      if (navigation) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
      
      // 6. Show confirmation
      showToast('Session cancelled', { type: 'info' });
      lastActionRef.current = null;
      
    } catch (error) {
      console.error('[VoiceMicButton] Failed to undo session:', error);
            showToast('Could not cancel session', { type: 'error' });
    }
  };

  // Helper to track response time when TTS speaks
  const speakAndTrack = (text, opts) => {
    if (responseStartTimeRef.current) {
      const responseTime = Date.now() - responseStartTimeRef.current;
      trackResponseTime(responseTime);
      console.log(`[VoiceMicButton] Response time: ${responseTime}ms`);
      responseStartTimeRef.current = null; // Reset after tracking
    }
    return ttsSpeak(text, opts);
  };

  const runText = async (utterance, preParsedIntent = null) => {
    if (!utterance?.trim()) return;
    lastUtteranceRef.current = utterance;
    console.log('[VoiceMicButton] Running utterance:', utterance);
    
    // Check if this is a confirmation response to a pending intent
    if (pendingIntentRef.current) {
      const confirmation = isConfirmation(utterance);
      if (confirmation === true) {
        // User confirmed, execute the pending intent
        const pendingIntent = pendingIntentRef.current;
        pendingIntentRef.current = null;
        
        // Re-construct command from pending intent
        const reconstructed = `Block ${pendingIntent.classification.detectedTarget} for 30 minutes`;
        console.log('[VoiceMicButton] User confirmed, executing:', reconstructed);
        return runText(reconstructed);
      } else if (confirmation === false) {
        // User cancelled
        pendingIntentRef.current = null;
        if (ttsEnabled) speakAndTrack('Okay, cancelled.');
        return;
      }
      // If unclear, continue processing as new command
      pendingIntentRef.current = null;
    }
    
    // Use pre-parsed intent if provided (from STT), otherwise parse now
    const intent = preParsedIntent || await parseIntentHybrid(utterance, { allowDefaultDuration: false });
    
    // Refresh usage counter after parsing (cloud may have been used)
    await refreshUsage();
    
    // Log telemetry metadata if present (only if we just parsed)
    if (!preParsedIntent && intent?.metadata) {
      console.log(`[VoiceMicButton] Parse: ${intent.metadata.source} (confidence: ${intent.metadata.confidence}, ${intent.metadata.parseTime}ms)`);
      
      // Show limit warning if getting close
      if (intent.metadata.source === 'cloud') {
        if (aiUsage.remaining <= 1 && aiUsage.limit !== Infinity) {
          showToast(
            `Last AI command for today! Upgrade to Premium for unlimited.`,
            { type: 'warning', duration: 4000 }
          );
        }
      }
    }
    
    // Check if intent indicates limit reached
    if (intent?.error && intent.metadata?.note?.includes('limit-reached')) {
      if (ttsEnabled) speakAndTrack(intent.error);
      Alert.alert(
        'Daily Limit Reached',
        intent.error,
        [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'Upgrade to Premium',
            onPress: () => setShowPremium(true)
          }
        ]
      );
      
      if (__DEV__) {
        console.log('[Telemetry] Free user hit AI limit');
      }
      
      return;
    }
    
    // Handle classification-based guidance
    if (intent?.needsGuidance && intent.classification) {
      console.log('[VoiceMicButton] Needs guidance:', intent.classification.type);
      
      const guidance = getGuidancePrompt(intent.classification, intent);
      if (guidance) {
        if (guidance.shouldSpeak && ttsEnabled) {
          speakAndTrack(guidance.message);
        }
        
        // For unclear-action, store intent and wait for confirmation
        if (intent.classification.type === 'unclear-action') {
          pendingIntentRef.current = intent;
        }
        
        // Show alert with suggestions
        Alert.alert(
          intent.classification.type === 'off-topic' ? 'How I can help' : 'Did I understand correctly?',
          guidance.message,
          [
            ...guidance.suggestions.map((sugg) => ({
              text: sugg,
              onPress: () => {
                if (sugg === 'Cancel') {
                  pendingIntentRef.current = null;
                  return;
                }
                runText(sugg);
              }
            })),
            { text: 'Type instead', onPress: () => setManualOpen(true) },
            { text: 'Close', style: 'cancel', onPress: () => { pendingIntentRef.current = null; } },
          ]
        );
        return;
      }
    }
    
    // Check if we need clarification on a valid intent
    const clarification = needsClarification(intent, null);
    if (clarification) {
      console.log('[VoiceMicButton] Needs clarification:', clarification.question);
      
      if (clarification.missing === 'duration') {
        // Missing duration - prompt with suggestions
        if (ttsEnabled) speakAndTrack(clarification.question);
        Alert.alert(clarification.question, 'Choose a duration:', [
          ...clarification.suggestions.map((sugg, idx) => ({
            text: sugg,
            onPress: () => {
              // Extract number from suggestion
              const match = sugg.match(/(\d+)\s*(minutes?|mins?|hours?|hrs?)/i);
              if (match) {
                const num = parseInt(match[1], 10);
                const unit = match[2].toLowerCase();
                const mins = unit.startsWith('h') ? num * 60 : num;
                runText(`${utterance} for ${mins} minutes`);
              } else {
                runText(`${utterance} for ${sugg}`);
              }
            }
          })),
          { text: 'Type', onPress: () => setManualOpen(true) },
          { text: 'Close', style: 'cancel' },
        ]);
        return;
      }
      
      if (clarification.missing === 'target') {
        // Missing target - prompt with suggestions
        if (ttsEnabled) speakAndTrack(clarification.question);
        Alert.alert(clarification.question, 'Choose apps to block:', [
          ...clarification.suggestions.map((sugg) => ({
            text: sugg,
            onPress: () => runText(`Block ${sugg}`)
          })),
          { text: 'Type', onPress: () => setManualOpen(true) },
          { text: 'Close', style: 'cancel' },
        ]);
        return;
      }
      
      if (clarification.missing === 'message' || clarification.missing === 'time') {
        // Missing reminder details - prompt with suggestions
        if (ttsEnabled) speakAndTrack(clarification.question);
        Alert.alert(clarification.question, 'Choose or say:', [
          ...clarification.suggestions.map((sugg) => ({
            text: sugg,
            onPress: () => runText(`Remind me to ${sugg}`)
          })),
          { text: 'Type', onPress: () => setManualOpen(true) },
          { text: 'Close', style: 'cancel' },
        ]);
        return;
      }
    }
    
    // Handle reminder action
    if (intent?.action === 'remind') {
      console.log('[VoiceMicButton] Reminder intent:', intent);
      
      // Check if user can use voice reminders
      const reminderGate = await canUseVoiceReminders();
      if (!reminderGate.allowed) {
        // Show upgrade prompt
        if (ttsEnabled) speakAndTrack('Voice reminders are a premium feature.');
        Alert.alert(
          'Premium Feature',
          reminderGate.reason,
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Upgrade to Premium',
              onPress: () => setShowPremium(true)
            }
          ]
        );
        
        if (__DEV__) {
          console.log('[Telemetry] Voice reminder gate shown');
        }
        
        return;
      }
      
      const reminderResult = await executeReminder(intent, { confirm: true });
      console.log('[VoiceMicButton] executeReminder result:', reminderResult);
      
      if (!reminderResult.ok) {
        if (reminderResult.needsPermission) {
          // Permission denied
          if (ttsEnabled) speakAndTrack('I need notification permissions to set reminders. Please enable them in Settings.');
          showToast(
            'Notification permissions are needed to set reminders. Please enable them in Settings.',
            { type: 'error', duration: 6000 }
          );
        } else {
          // Other error
          if (ttsEnabled) speakAndTrack('Sorry, I couldn\'t set that reminder. Please try again.');
          showToast(reminderResult.error || 'Failed to set reminder', { type: 'error' });
        }
        return;
      }
      
      if (reminderResult.pendingConfirmation && reminderResult.plan) {
        // Confirm reminder before applying
        const confirmMsg = reminderResult.plan.confirmMessage || 'Set this reminder?';
        // Create a confirmation token to guard against late acks
        const token = { id: Date.now(), cancelled: false };
        reminderConfirmTokenRef.current = token;
        if (ttsEnabled) speakAndTrack(confirmMsg);
        
        Alert.alert('Confirm Reminder', confirmMsg, [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => {
              // Mark cancelled and stop any speaking immediately
              if (reminderConfirmTokenRef.current?.id === token.id) {
                reminderConfirmTokenRef.current.cancelled = true;
              }
              try { if (ttsEnabled && ttsAvailable()) ttsStop(); } catch {}
            }
          },
          { 
            text: 'Set Reminder', 
            onPress: async () => {
              // If user cancelled while alert was open, do nothing
              if (reminderConfirmTokenRef.current?.cancelled) return;
              const applyResult = await executeReminder(intent, { confirm: false });
              
              if (!reminderConfirmTokenRef.current?.cancelled && applyResult.ok && applyResult.confirmation) {
                // Success - speak confirmation and show toast with undo
                if (ttsEnabled) speakAndTrack(applyResult.confirmation);
                
                // Store action for undo
                storeLastAction('reminder', {
                  intent,
                  result: applyResult
                });
                
                showToast(applyResult.confirmation, {
                  type: 'success',
                  action: {
                    label: 'Undo',
                    onPress: undoReminder
                  }
                });
              } else {
                // Error applying
                if (!reminderConfirmTokenRef.current?.cancelled && ttsEnabled) speakAndTrack('Sorry, I couldn\'t set that reminder.');
                showToast(applyResult.error || 'Failed to set reminder', { type: 'error' });
              }
              // Clear token after handling
              if (reminderConfirmTokenRef.current?.id === token.id) {
                reminderConfirmTokenRef.current = null;
              }
            }
          },
        ]);
      }
      
      return;
    }
    
    // Check if this is a block action - if so, verify usage limit BEFORE processing
    // (Only check if intent was NOT pre-parsed - STT path already checked)
    if (intent?.action === 'block' && !intent?.metadata) {
      // Check AI usage limit for block commands
      const usage = await getRemainingCloudCalls();
      if (!usage.canUse) {
        // Out of free AI calls - show upgrade prompt
        if (ttsEnabled) speakAndTrack('You\'ve used all your free AI commands today. Upgrade to Premium for unlimited access.');
        Alert.alert(
          'Daily Limit Reached',
          `You've used all ${usage.limit} free AI commands today. Upgrade to Premium for unlimited AI voice commands, presets, and more.`,
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Upgrade to Premium',
              onPress: () => setShowPremium(true)
            }
          ]
        );
        
        if (__DEV__) {
          console.log('[Telemetry] AI usage gate shown for block command (manual path):', usage);
        }
        
        return;
      }
      
      // Usage OK - increment counter before processing
      await incrementCloudUsage();
      await refreshUsage();
    }
    
    const res = await handleUtterance(utterance, { confirm: true });
    console.log('[VoiceMicButton] handleUtterance result:', res);
    
    if (!res.ok) {
      showToast("I didn't catch that. Try: Block Social for 30 minutes", { type: 'info', duration: 5000 });
      return;
    }
    
    // Save conversation context for next command
    if (res.intent && res.plan) {
      updateContext({
        action: res.intent.action,
        target: res.intent.target,
        durationMinutes: res.plan.durationMinutes || res.intent.durationMinutes,
        intent: res.intent,
        plan: res.plan,
      });
    }
    
    // Check if plan is noop (alias not found) → navigate to FocusSessionScreen with voice params
    if (res.isNoop || res.plan?.action === 'noop') {
      const target = res.intent?.target || res.plan?.target;
      
      if (isFamilyPickerAvailable()) {
        // Native picker available - navigate to FocusSessionScreen
        if (ttsEnabled) speakAndTrack(`I couldn't find a nickname for ${target}. Pick the apps once, and I'll remember it.`);
        Alert.alert(
          'Teach Mada a name',
          `Pick the apps/categories for "${target}" once. Mada will remember this name.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Pick apps', 
              onPress: () => {
                navigation.navigate('FocusSession', {
                  voiceAlias: target,
                  onAliasCreated: () => runText(utterance)  // Re-run command after alias saved
                });
              }
            },
          ]
        );
      } else {
        // Native picker not available - inform user (dev environment)
        if (ttsEnabled) speakAndTrack(`I couldn't find a nickname for ${target}. Native app picker is not available in this build.`);
        Alert.alert(
          'Native Picker Required',
          `The FamilyActivityPicker is not available. This feature requires:\n\n• Physical iOS device (not simulator)\n• react-native-device-activity installed\n• Custom dev client rebuild`,
          [{ text: 'OK' }]
        );
      }
      return;
    }
    
    if (res.pendingConfirmation && res.plan?.action === 'block') {
      const msg = `Block ${res.intent.target} for ${res.plan.durationMinutes} minutes (ends ${res.plan.endLabel})?`;
      Alert.alert('Confirm', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: async () => { 
          const applyRes = await handleUtterance(utterance, { confirm: false });
          
          // Check if we need to navigate to ActiveSession
          if (applyRes.needsNavigation && applyRes.durationSeconds) {
            console.log('[VoiceMicButton] Scheduling navigation after grace period');

            // Store action for undo with grace period handling
            const actionData = {
              target: res.intent.target,
              durationMinutes: res.plan.durationMinutes,
              durationSeconds: applyRes.durationSeconds,
              graceTimeoutId: null,
              hasStarted: false,
            };
            storeLastAction('session', actionData);

            // Show toast immediately with Undo
            showToast(`Starting focus for ${res.plan.durationMinutes} minutes`, {
              type: 'success',
              action: {
                label: 'Undo',
                onPress: undoBlockingSession
              },
              duration: 5000,
            });

            // Delay navigation to allow an Undo grace window
            const timeoutId = setTimeout(() => {
              // If cancelled, lastActionRef will be null
              if (!lastActionRef.current || lastActionRef.current.type !== 'session') return;
              // Mark as started and navigate
              lastActionRef.current.data.hasStarted = true;
              navigation.navigate('ActiveSession', { durationSeconds: applyRes.durationSeconds });
            }, 3500);
            actionData.graceTimeoutId = timeoutId;
          }
        }}
      ]);
    }
  };

  useEffect(() => {
    let anim;
    if (listening) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 600, useNativeDriver: true })
        ])
      );
      anim.start();
      // Start ring pulses
      const makeRing = (v, delay = 0) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration: 2500, delay, useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );
      const r1 = makeRing(ring1, 0);
      const r2 = makeRing(ring2, 400);
      const r3 = makeRing(ring3, 800);
      r1.start();
      r2.start();
      r3.start();
      // Sound bars
      const barLoop = (v, min, max, d, delay = 0) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: max, duration: d, delay, useNativeDriver: false }),
            Animated.timing(v, { toValue: min, duration: d, useNativeDriver: false }),
          ])
        );
      const b1 = barLoop(bar1, 8, 18, 600);
      const b2 = barLoop(bar2, 10, 22, 700, 150);
      const b3 = barLoop(bar3, 6, 16, 650, 300);
      b1.start();
      b2.start();
      b3.start();
      // Overlay gradient fade to simulate color cycling
      const overlay = Animated.loop(
        Animated.sequence([
          Animated.timing(overlayOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(overlayOpacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      );
      overlay.start();
      return () => { r1.stop(); r2.stop(); r3.stop(); b1.stop(); b2.stop(); b3.stop(); overlay.stop(); };
    } else {
      pulse.setValue(1);
      overlayOpacity.setValue(0);
    }
    return () => { anim && anim.stop && anim.stop(); };
  }, [listening, pulse]);

  const onPress = async () => {
    if (busyRef.current || listening) return; // prevent double starts
    busyRef.current = true;
    
    // Check microphone permission first
    const micStatus = await checkMicrophonePermission();
    
    if (micStatus !== 'granted') {
      // Show permission explainer before requesting
      const granted = await requestPermissionWithFlow('microphone', (onGrant) => {
        setPermissionGrantCallback(() => onGrant);
        setShowPermissionExplainer(true);
      });
      
      busyRef.current = false;
      
      if (!granted) {
        console.log('[VoiceMicButton] Microphone permission not granted');
        return;
      }
    }
    
    // Ensure the module is actually loaded before attempting to start
    const ready = await (STTService.ensureLoaded?.() ?? Promise.resolve(sttAvailable));
    if (ready) {
      try {
  console.log('[VoiceMicButton] Starting STT...');
  // Make sure TTS is not speaking to avoid echo into STT
  try { if (ttsEnabled && ttsAvailable()) ttsStop(); } catch {}
  
  // Wait for audio session to be fully released (critical for iOS)
  await new Promise(resolve => setTimeout(resolve, 300));
  
        setListening(true);
        let accepted = false;
        let sessionActive = true;
        let timeoutId = null;
        
        const cleanup = async () => {
          sessionActive = false;
          if (timeoutId) clearTimeout(timeoutId);
          try { await STTService.stop(); } catch {}
          setListening(false);
          busyRef.current = false;
        };
        
        timeoutId = setTimeout(async () => {
          if (!accepted && sessionActive) {
            await cleanup();
            console.warn('[VoiceMicButton] STT timeout, falling back to manual input');
            // Offer choices per spec rather than immediate fallback
            if (ttsEnabled) speakAndTrack('I did not catch that. Try speaking the full phrase, like: Block test for two minutes.');
            showToast('Try speaking the full phrase like "Block test for 2 minutes"', {
              type: 'info',
              action: {
                label: 'Type',
                onPress: () => setManualOpen(true)
              },
              duration: 6000
            });
          }
        }, 10000); // 10s window to speak a full phrase

        let lastUtterance = '';
        let finalResultTimer = null;
        let processedUtterance = null; // Track what we've already processed
        
        await STTService.start(async (utter, meta) => {
          if (!sessionActive) return;
          console.log('[VoiceMicButton] STT result:', utter, 'final:', !!meta?.final);
          const text = (utter || '').trim();
          if (!text) return;
          
          // Track the latest utterance
          lastUtterance = text;
          
          // Only act on final results, and debounce them slightly
          // (iOS sends multiple "final" results as speech continues)
          if (meta?.final) {
            if (finalResultTimer) clearTimeout(finalResultTimer);
            finalResultTimer = setTimeout(async () => {
              if (!sessionActive) return;
              
              // Skip if we already processed this exact utterance
              if (processedUtterance === lastUtterance) {
                console.log('[VoiceMicButton] Skipping duplicate utterance:', lastUtterance);
                return;
              }
              
              // Skip if utterance is too short (likely incomplete)
              const wordCount = lastUtterance.split(/\s+/).length;
              
              // For reminders, need complete message (at least 4 words - more flexible)
              if (/\b(remind|reminder)\b/i.test(lastUtterance) && wordCount < 4) {
                console.log('[VoiceMicButton] Reminder incomplete, waiting for more:', lastUtterance);
                return;
              }
              
              // For block commands ending with "for", wait for duration
              if (/\bfor\s*$/i.test(lastUtterance)) {
                console.log('[VoiceMicButton] Incomplete duration, waiting:', lastUtterance);
                return;
              }
              
              // For any command, need at least 2 words (more permissive)
              if (wordCount < 2) {
                console.log('[VoiceMicButton] Utterance too short, waiting for more:', lastUtterance);
                return;
              }
              
              processedUtterance = lastUtterance;
              
              // Mark response start time for telemetry (AFTER debounce, before processing)
              responseStartTimeRef.current = Date.now();
              
              // Parse the last captured utterance
              const intent = await parseIntentHybrid(lastUtterance, { allowDefaultDuration: false });
              
              // Log telemetry metadata if present
              if (intent?.metadata) {
                console.log(`[VoiceMicButton] STT Parse: ${intent.metadata.source} (confidence: ${intent.metadata.confidence}, ${intent.metadata.parseTime}ms)`);
              }
              
              // If the utterance is off-topic or unclear, guide immediately instead of timing out
              if (intent?.needsGuidance && intent.classification) {
                accepted = true;
                await cleanup();
                const guidance = getGuidancePrompt(intent.classification, intent);
                if (guidance) {
                  if (guidance.shouldSpeak && ttsEnabled) speakAndTrack(guidance.message);
                  Alert.alert(
                    intent.classification.type === 'off-topic' ? 'How I can help' : 'Did I understand correctly?',
                    guidance.message,
                    [
                      ...guidance.suggestions.map((sugg) => ({
                        text: sugg,
                        onPress: () => runText(sugg),
                      })),
                      { text: 'Type instead', onPress: () => setManualOpen(true) },
                      { text: 'Close', style: 'cancel' },
                    ]
                  );
                }
                return;
              }
              
              // Check if we need clarification
              const clarification = needsClarification(intent, null);
              if (clarification && clarification.missing === 'duration') {
                // Has intent but no duration - prompt with smart suggestions
                accepted = true;
                await cleanup();
                if (ttsEnabled) speakAndTrack(clarification.question);
                Alert.alert(clarification.question, 'Choose a duration:', [
                  ...clarification.suggestions.map((sugg) => ({
                    text: sugg,
                    onPress: () => {
                      const match = sugg.match(/(\d+)\s*(minutes?|mins?|hours?|hrs?)/i);
                      if (match) {
                        const num = parseInt(match[1], 10);
                        const unit = match[2].toLowerCase();
                        const mins = unit.startsWith('h') ? num * 60 : num;
                        runText(`${lastUtterance} for ${mins} minutes`);
                      } else {
                        runText(`${lastUtterance} for ${sugg}`);
                      }
                    }
                  })),
                  { text: 'Type', onPress: () => setManualOpen(true) },
                  { text: 'Close', style: 'cancel' },
                ]);
                return;
              }
              
              if (clarification && clarification.missing === 'target') {
                // Has action but no target - prompt
                accepted = true;
                await cleanup();
                if (ttsEnabled) speakAndTrack(clarification.question);
                Alert.alert(clarification.question, 'Choose apps to block:', [
                  ...clarification.suggestions.map((sugg) => ({
                    text: sugg,
                    onPress: () => runText(`Block ${sugg}`)
                  })),
                  { text: 'Type', onPress: () => setManualOpen(true) },
                  { text: 'Close', style: 'cancel' },
                ]);
                return;
              }
              
              if (clarification && (clarification.missing === 'message' || clarification.missing === 'time')) {
                // Missing reminder details - prompt with suggestions
                accepted = true;
                await cleanup();
                if (ttsEnabled) speakAndTrack(clarification.question);
                Alert.alert(clarification.question, 'Choose or say:', [
                  ...clarification.suggestions.map((sugg) => ({
                    text: sugg,
                    onPress: () => runText(`Remind me to ${sugg}`)
                  })),
                  { text: 'Type', onPress: () => setManualOpen(true) },
                  { text: 'Close', style: 'cancel' },
                ]);
                return;
              }
              
              // Determine if the command is ready to execute (stop, block with duration, or a complete reminder)
              const remindReady = !!(intent && intent.action === 'remind' && (
                (intent.durationMinutes && intent.durationMinutes >= 1) ||
                (intent.time && (
                  intent.reminderType === 'daily' ||
                  (intent.reminderType === 'weekly' && Array.isArray(intent.days) && intent.days.length > 0) ||
                  (intent.reminderType === 'custom' && Array.isArray(intent.days) && intent.days.length > 0)
                ))
              ));

              const readyToApply = (intent && intent.action === 'stop') || 
                                   (intent && intent.action === 'block' && intent.durationMinutes >= 1) ||
                                   remindReady;
              
              console.log('[VoiceMicButton][STT] Parsed intent:', JSON.stringify(intent));
              console.log('[VoiceMicButton][STT] readyToApply:', readyToApply, 'remindReady:', remindReady);

              if (readyToApply || (intent && intent.action === 'remind')) {
                // Check if this is a block action - verify usage limit BEFORE processing
                if (intent && intent.action === 'block') {
                  const usage = await getRemainingCloudCalls();
                  if (!usage.canUse) {
                    // Out of free AI calls - show upgrade prompt
                    accepted = true;
                    await cleanup();
                    if (ttsEnabled) speakAndTrack('You\'ve used all your free AI commands today. Upgrade to Premium for unlimited access.');
                    Alert.alert(
                      'Daily Limit Reached',
                      `You've used all ${usage.limit} free AI commands today. Upgrade to Premium for unlimited AI voice commands, presets, and more.`,
                      [
                        { text: 'Not Now', style: 'cancel' },
                        {
                          text: 'Upgrade to Premium',
                          onPress: () => setShowPremium(true)
                        }
                      ]
                    );
                    
                    if (__DEV__) {
                      console.log('[Telemetry] AI usage gate shown for block command (STT path):', usage);
                    }
                    
                    return;
                  }
                  
                  // Usage OK - increment counter before processing
                  await incrementCloudUsage();
                  await refreshUsage();
                }
                
                // Valid complete command - execute it with pre-parsed intent to avoid double parse
                accepted = true;
                await cleanup();
                runText(lastUtterance, intent); // Pass intent to avoid re-parsing
              }
              // Otherwise keep listening (timeout will handle if nothing comes)
            }, 900); // 900ms after last final result before acting (optimized for UX speed)
          }
        }, async (e) => {
          if (!sessionActive) return;
          await cleanup();
          console.warn('[STT] error', e?.message);
          // Known iOS code 1110 = no speech detected; fall back gracefully
          if (String(e?.message || '').includes('No speech detected')) {
            showToast('Didn\'t catch that. Try again or type your command.', {
              type: 'info',
              action: {
                label: 'Type',
                onPress: () => setManualOpen(true)
              },
              duration: 5000
            });
            return;
          }
          showToast('Could not start voice recognition. Using text input instead.', { type: 'error' });
          setManualOpen(true);
        });
      } catch (err) {
        console.warn('[VoiceMicButton] STT start failed:', err);
        showToast('Microphone permission may be required. Using text input instead.', { type: 'error' });
        setListening(false);
        setManualOpen(true);
        busyRef.current = false;
      }
    } else {
      console.log('[VoiceMicButton] STT not available, opening manual input');
      setManualOpen(true);
      busyRef.current = false;
    }
  };

  // Position to overlap the tab bar like the reference
  const TAB_BOTTOM_MARGIN = 16; // from TabNavigator
  const TAB_HEIGHT = 64;        // from TabNavigator
  // Lower the mic slightly so it sits deeper into the tab bar
  const computedBottom = insets.bottom + TAB_BOTTOM_MARGIN + (TAB_HEIGHT - controlSizes.mic.size) / 2 - 6;

  return (
    <>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          style={[
            styles.fab,
            { bottom: computedBottom },
            listening && styles.fabActive,
            style,
          ]}
          onPress={onPress}
          activeOpacity={0.85}
        >
          {/* Pulsing rings when listening */}
          {listening && (
            <>
              <Animated.View
                style={[
                  styles.ring,
                  {
                    borderColor: 'rgba(137, 0, 245, 0.7)',
                    transform: [{ scale: ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
                    opacity: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.ring,
                  {
                    borderColor: 'rgba(0, 114, 255, 0.7)',
                    transform: [{ scale: ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
                    opacity: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.ring,
                  {
                    borderColor: 'rgba(137, 0, 245, 0.6)',
                    transform: [{ scale: ring3.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }) }],
                    opacity: ring3.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                  },
                ]}
              />
            </>
          )}
          <LinearGradient
            colors={effects.brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabInner}
          >
            <View style={styles.fabHighlight} />
            <Ionicons name={listening ? 'mic' : 'mic-outline'} size={22} color="#fff" />
            {listening && (
              <View style={styles.barsRow}>
                <Animated.View style={[styles.bar, { height: bar1 }]} />
                <Animated.View style={[styles.bar, { height: bar2 }]} />
                <Animated.View style={[styles.bar, { height: bar3 }]} />
              </View>
            )}
          </LinearGradient>
          {/* Usage counter badge (free tier only) */}
          {!listening && aiUsage.limit !== Infinity && aiUsage.remaining <= 5 && (
            <View style={styles.usageBadge}>
              <Text style={styles.usageBadgeText}>{aiUsage.remaining}/{aiUsage.limit}</Text>
            </View>
          )}
          {/* Overlay gradient to simulate color shift while listening */}
          {listening && (
            <Animated.View style={[styles.overlayGradientWrapper, { opacity: overlayOpacity }] }>
              <LinearGradient
                colors={[effects.brandGradient[1], effects.brandGradient[0]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabInner}
              />
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>
      
      {/* Manual Text Input Modal */}
      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={insets.bottom + 24}
        >
          <View style={styles.card}>
            <TouchableOpacity
              onPress={() => setManualOpen(false)}
              style={styles.modalClose}
              accessibilityLabel="Close"
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons name="close" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={styles.title}>Type a command</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g., Block TikTok for 30 minutes"
              placeholderTextColor={colors.mutedForeground}
              style={styles.input}
              autoFocus
              onSubmitEditing={async () => { setManualOpen(false); await runText(text); setText(''); }}
            />
            <View style={{ height: spacing.sm }} />
            <TouchableOpacity style={styles.btn} onPress={async () => { setManualOpen(false); await runText(text); setText(''); }}>
              <Text style={styles.btnText}>Run</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setManualOpen(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Permission Explainer Modal */}
      <PermissionExplainerModal
        visible={showPermissionExplainer}
        permissionType="microphone"
        onClose={() => {
          setShowPermissionExplainer(false);
          setPermissionGrantCallback(null);
        }}
        onGrant={async () => {
          setShowPermissionExplainer(false);
          if (permissionGrantCallback) {
            await permissionGrantCallback();
            setPermissionGrantCallback(null);
          }
        }}
      />
      
      {/* Premium Modal */}
      <PremiumModal
        visible={showPremium}
        onClose={() => setShowPremium(false)}
        onUpgrade={async (plan) => {
          const ok = await performUpgrade(plan);
          if (ok) {
            setShowPremium(false);
            // Refresh usage after upgrade
            await refreshUsage();
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: '50%',
    bottom: spacing['3xl'],
    width: controlSizes.mic.size,
    height: controlSizes.mic.size,
    marginLeft: -controlSizes.mic.size / 2,
    borderRadius: controlSizes.mic.size / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabInner: {
    width: '100%',
    height: '100%',
    borderRadius: controlSizes.mic.size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: effects.glowPurple,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 22,
    overflow: 'hidden',
  },
  fabHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(255,255,255,0.35)',
    opacity: 0.3,
  },
  fabActive: {},
  ring: {
    position: 'absolute',
    width: controlSizes.mic.size,
    height: controlSizes.mic.size,
    borderRadius: controlSizes.mic.size / 2,
    borderWidth: 2,
  },
  ring1: { borderColor: effects.ringPurple, transform: [{ scale: 1.0 }] },
  ring2: { borderColor: effects.ringBlue, transform: [{ scale: 1.8 }], opacity: 0.6 },
  ring3: { borderColor: effects.ringPurple, transform: [{ scale: 2.6 }], opacity: 0.4 },
  barsRow: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    gap: 2,
  },
  bar: {
    width: 2,
    backgroundColor: '#fff',
    borderRadius: 1,
    opacity: 0.9,
  },
  overlayGradientWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: controlSizes.mic.size / 2,
    overflow: 'hidden',
  },
  usageBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colors.background,
  },
  usageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
  },
  overlay: {
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  card: {
    width: '86%', 
    maxWidth: 420, 
    borderRadius: radius['2xl'],
    // Use a more opaque dark surface so content is readable over background
    backgroundColor: '#0c1117', 
    padding: spacing['2xl'],
    // Add extra bottom padding so Cancel isn’t cramped near keyboard
    paddingBottom: spacing['3xl'], 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)'
  },
  title: { 
    color: '#fff', 
    fontSize: typography.lg, 
    fontWeight: typography.bold, 
    marginBottom: spacing.md 
  },
  input: {
    height: 48, 
    borderRadius: radius.xl, 
    backgroundColor: '#0b0f14', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.lg, 
    color: '#fff'
  },
  btn: {
    height: 44, 
    borderRadius: radius.xl, 
    backgroundColor: colors.primary, 
    alignItems: 'center', 
    justifyContent: 'center'
  },
  btnText: { 
    color: '#fff', 
    fontWeight: typography.semibold 
  },
  cancel: { 
    color: colors.mutedForeground, 
    textAlign: 'center', 
    // More space between Run and Cancel
    marginTop: spacing.lg 
  },
  modalClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    padding: spacing.sm,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    // Ensure the close button sits above other content for reliable taps
    zIndex: 2
  },
});
