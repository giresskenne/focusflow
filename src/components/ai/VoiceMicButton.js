import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, Modal, TextInput, Text, StyleSheet, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme';
import { FLAGS, STTService, handleUtterance } from '../../modules/ai';
import { speak as ttsSpeak, stop as ttsStop, isAvailable as ttsAvailable } from '../../modules/ai/voice/tts-service';
import { isFamilyPickerAvailable } from '../../modules/ai/aliases/alias-native';
import { parseIntent } from '../../modules/ai/nlu/intent-parser';

export default function VoiceMicButton({ style }) {
  const navigation = useNavigation();
  const enabled = FLAGS.AI_VOICE_ENABLED;
  const [manualOpen, setManualOpen] = useState(false);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const busyRef = useRef(false);
  const lastUtteranceRef = useRef('');

  const sttAvailable = useMemo(() => STTService.isAvailable?.() || false, []);
  const ttsEnabled = FLAGS.AI_TTS_ENABLED;

  if (!enabled) return null;

  const runText = async (utterance) => {
    if (!utterance?.trim()) return;
    lastUtteranceRef.current = utterance;
    console.log('[VoiceMicButton] Running utterance:', utterance);
    const res = await handleUtterance(utterance, { confirm: true });
    console.log('[VoiceMicButton] handleUtterance result:', res);
    
    if (!res.ok) {
      Alert.alert('Try again', "I didn't catch that. Try: Block Social for 30 minutes");
      return;
    }
    
    // Check if plan is noop (alias not found) → navigate to FocusSessionScreen with voice params
    if (res.isNoop || res.plan?.action === 'noop') {
      const target = res.intent?.target || res.plan?.target;
      
      if (isFamilyPickerAvailable()) {
        // Native picker available - navigate to FocusSessionScreen
        if (ttsEnabled) ttsSpeak(`I couldn't find a nickname for ${target}. Pick the apps once, and I'll remember it.`);
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
        if (ttsEnabled) ttsSpeak(`I couldn't find a nickname for ${target}. Native app picker is not available in this build.`);
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
        { text: 'OK', onPress: async () => { await handleUtterance(utterance, { confirm: false }); } }
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
    } else {
      pulse.setValue(1);
    }
    return () => { anim && anim.stop && anim.stop(); };
  }, [listening, pulse]);

  const onPress = async () => {
    if (busyRef.current || listening) return; // prevent double starts
    busyRef.current = true;
    
    // Ensure the module is actually loaded before attempting to start
    const ready = await (STTService.ensureLoaded?.() ?? Promise.resolve(sttAvailable));
    if (ready) {
      try {
  console.log('[VoiceMicButton] Starting STT...');
  // Make sure TTS is not speaking to avoid echo into STT
  try { if (ttsEnabled && ttsAvailable()) ttsStop(); } catch {}
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
            if (ttsEnabled) ttsSpeak('I did not catch that. Try speaking the full phrase, like: Block test for two minutes.');
            Alert.alert('Didn\'t catch that', 'Try speaking the full phrase like "Block test for 2 minutes".', [
              { text: 'Try again', onPress: () => onPress() },
              { text: 'Type instead', onPress: () => setManualOpen(true) },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }
        }, 10000); // 10s window to speak a full phrase

        let lastUtterance = '';
        let finalResultTimer = null;
        
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
              
              // Parse the last captured utterance
              const intent = await parseIntent(lastUtterance, { allowDefaultDuration: false });
              const readyToApply = (intent && intent.action === 'stop') || 
                                   (intent && intent.action === 'block' && intent.durationMinutes >= 1);
              
              if (!readyToApply && intent && intent.action === 'block') {
                // Has intent but no duration - prompt
                accepted = true;
                await cleanup();
                if (ttsEnabled) ttsSpeak('For how long? You can choose two minutes, thirty minutes, or type a duration.');
                Alert.alert('For how long?', 'Choose a duration:', [
                  { text: '2 min', onPress: () => runText(`${lastUtterance} for 2 minutes`) },
                  { text: '30 min', onPress: () => runText(`${lastUtterance} for 30 minutes`) },
                  { text: 'Type', onPress: () => setManualOpen(true) },
                  { text: 'Cancel', style: 'cancel' },
                ]);
                return;
              }
              
              if (readyToApply) {
                // Valid complete command - execute it
                accepted = true;
                await cleanup();
                runText(lastUtterance);
              }
              // Otherwise keep listening (timeout will handle if nothing comes)
            }, 800); // 800ms after last final result before acting
          }
        }, async (e) => {
          if (!sessionActive) return;
          await cleanup();
          console.warn('[STT] error', e?.message);
          // Known iOS code 1110 = no speech detected; fall back gracefully
          if (String(e?.message || '').includes('No speech detected')) {
            Alert.alert('Didn\'t catch that', 'Try again or type your command.', [
              { text: 'Try again', onPress: () => onPress() },
              { text: 'Type instead', onPress: () => setManualOpen(true) },
              { text: 'Cancel', style: 'cancel' },
            ]);
            return;
          }
          Alert.alert('Voice Error', 'Could not start voice recognition. Using text input instead.');
          setManualOpen(true);
        });
      } catch (err) {
        console.warn('[VoiceMicButton] STT start failed:', err);
        Alert.alert('Voice Not Available', 'Microphone permission may be required. Using text input instead.');
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

  return (
    <>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity style={[styles.fab, listening && styles.fabActive, style]} onPress={onPress} activeOpacity={0.85}>
          <Ionicons name={listening ? 'mic' : 'mic-outline'} size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
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
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing['3xl'],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  fabActive: {
    backgroundColor: colors.secondary,
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
    backgroundColor: '#11151a', 
    padding: spacing['2xl'], 
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
    marginTop: spacing.sm 
  },
});
