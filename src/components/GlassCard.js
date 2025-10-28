import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius, shadows, spacing } from '../theme';

// A simple glassmorphism container with blur + subtle border
export default function GlassCard({ children, style, intensity = 20 }) {
  return (
    <View style={[styles.wrapper, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassBackground,
    ...shadows.md,
  },
  inner: {
    padding: spacing['2xl'],
  },
});
