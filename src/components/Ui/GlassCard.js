import React from 'react';
import { View, StyleSheet } from 'react-native';
import LiquidGlass from './LiquidGlass';

export default function GlassCard({ children, style, contentStyle, tint = 'light', intensity = 40, cornerRadius = 20 }) {
  return (
    <LiquidGlass tint={tint} intensity={intensity} cornerRadius={cornerRadius} style={style}>
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
});

