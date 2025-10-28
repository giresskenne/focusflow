import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';

// Cupertino-like button with filled styles
export default function Button({ title, onPress, variant = 'primary', disabled = false, style }) {
  const { colors } = useTheme();
  const isOutline = variant === 'outline';
  const bg = variant === 'danger' 
    ? '#ef4444' 
    : variant === 'success' 
      ? '#10b981' 
      : isOutline 
        ? 'rgba(255,255,255,0.08)'
        : '#8900f5'; // Unified purple
  const borderColor = isOutline ? 'rgba(255,255,255,0.15)' : 'transparent';
  const textColor = isOutline ? '#ffffff' : '#ffffff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: isOutline ? 1 : 0,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          // Minimal shadows to match screenshots
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    fontSize: 17,
    letterSpacing: 0,
  },
});
