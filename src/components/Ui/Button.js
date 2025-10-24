import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';

// Cupertino-like button with filled styles
export default function Button({ title, onPress, variant = 'primary', disabled = false, style }) {
  const { colors } = useTheme();
  const isOutline = variant === 'outline';
  const bg = variant === 'danger' ? '#FF3B30' : variant === 'success' ? '#34C759' : isOutline ? 'transparent' : colors.primary;
  const borderColor = isOutline ? colors.border : 'transparent';
  const textColor = isOutline ? colors.text : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor, borderWidth: isOutline ? 1 : 0, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
        style,
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    fontSize: 17,
  },
});
