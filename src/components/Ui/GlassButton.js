import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import LiquidGlass from './LiquidGlass';

export default function GlassButton({ title, onPress, disabled = false, style, textStyle, tint = 'light', intensity = 40 }) {
  return (
    <LiquidGlass tint={tint} intensity={intensity} cornerRadius={14} style={[styles.container, style]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.pressable, { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 }]}
      >
        <Text style={[styles.label, tint === 'dark' ? styles.labelLight : styles.labelDark, textStyle]}>{title}</Text>
      </Pressable>
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: {
    fontWeight: '600',
    fontSize: 16,
  },
  labelDark: {
    color: '#0B0B0F',
  },
  labelLight: {
    color: '#FFFFFF',
  },
});

