import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

// Lightweight “liquid glass” container for RN.
// UI-only: wraps children with a blurred, tinted, rounded surface and soft shadow.
// No business logic is changed by using this component.
export default function LiquidGlass({
  children,
  style,
  intensity = 70, // 0-100 (expo-blur)
  tint = 'light', // 'light' | 'dark'
  cornerRadius = 20,
  backgroundOpacity = 0.18,
  borderOpacity = 0.22,
}) {
  const borderColor = tint === 'dark' ? 'rgba(255,255,255,' + borderOpacity + ')' : 'rgba(255,255,255,' + borderOpacity + ')';
  const bgColor = tint === 'dark' ? `rgba(0,0,0,${backgroundOpacity})` : `rgba(255,255,255,${backgroundOpacity})`;

  // On web/Android where blur may be less consistent, keep a subtle translucent fill.
  const Container = Platform.select({
    default: BlurView,
    web: View,
  });

  const containerProps = Platform.OS === 'web'
    ? { style: [styles.fallback, { backgroundColor: bgColor, borderRadius: cornerRadius, borderColor }, style] }
    : { intensity, tint, style: [styles.blur, { borderRadius: cornerRadius }, style] };

  return (
    <View style={[styles.wrapper, { borderRadius: cornerRadius }]}> 
      <Container {...containerProps}>
        <View style={[styles.surface, { backgroundColor: bgColor, borderColor, borderRadius: cornerRadius }]}>          
          <View pointerEvents="none" style={[styles.sheen, { borderRadius: cornerRadius, backgroundColor: tint === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)' }]} />
          {children}
        </View>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    // Soft outer drop shadow for glass lift
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  blur: {
    overflow: 'hidden',
  },
  surface: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '40%',
  },
  fallback: {
    overflow: 'hidden',
  },
});
