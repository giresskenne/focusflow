import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../../theme';

/**
 * Voice Hint Component
 * Displays rotating contextual hints about voice commands
 * Subtle, non-intrusive guidance that fades in/out
 */
export default function VoiceHint({ context = 'home', style, onDismiss }) {
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [dismissed, setDismissed] = useState(false);

  const hints = VOICE_HINTS[context] || VOICE_HINTS.home;

  useEffect(() => {
    if (dismissed) return;

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Rotate hints every 5 seconds
    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // Change hint
        setCurrentHintIndex((prev) => (prev + 1) % hints.length);
        // Fade in new hint
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [dismissed, currentHintIndex, hints.length]);

  if (dismissed || hints.length === 0) return null;

  const currentHint = hints[currentHintIndex];

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setDismissed(true);
      onDismiss?.();
    });
  };

  return (
    <Animated.View style={[styles.container, style, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mic" size={16} color={colors.primary} />
        </View>
        <Text style={styles.hintText}>
          <Text style={styles.tryText}>Try: </Text>
          "{currentHint.text}"
        </Text>
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Ionicons name="close" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <View style={styles.dotsContainer}>
        {hints.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentHintIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// Context-specific voice hints
const VOICE_HINTS = {
  home: [
    { text: "Block Instagram for 30 minutes", category: "blocking" },
    { text: "Block social media for 1 hour", category: "blocking" },
    { text: "Start focus session for 2 hours", category: "blocking" },
    { text: "Remind me to drink water in 30 minutes", category: "reminders" },
    { text: "Block it for longer", category: "natural" },
  ],
  reminders: [
    { text: "Remind me to drink water in 30 minutes", category: "reminders" },
    { text: "Remind me to exercise every day at 6 PM", category: "reminders" },
    { text: "Remind me to call mom every Monday", category: "reminders" },
    { text: "Remind me to stretch every 2 hours", category: "reminders" },
  ],
  session: [
    { text: "Block it for longer", category: "natural" },
    { text: "Stop blocking", category: "control" },
    { text: "Add 15 more minutes", category: "natural" },
    { text: "End the session", category: "control" },
  ],
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
    marginBottom: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.foreground,
    lineHeight: 18,
  },
  tryText: {
    color: colors.mutedForeground,
    fontWeight: typography.medium,
  },
  dismissButton: {
    padding: spacing.xs,
    opacity: 0.6,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
    borderRadius: 2.5,
  },
});
