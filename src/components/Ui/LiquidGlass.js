import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

// Lightweight “liquid glass” container for RN.
// UI-only: wraps children with a blurred, tinted, rounded surface and soft shadow.
// No business logic is changed by using this component.
export default function LiquidGlass({
  children,
  style,
  intensity = 40, // Lower intensity for more transparency
  tint = 'dark',
  cornerRadius = 20,
  backgroundOpacity = 0.08, // Much more transparent
  borderOpacity = 0.15, // Subtle border
}) {
  const borderColor = 'rgba(255,255,255,' + borderOpacity + ')';
  const bgColor = `rgba(30, 20, 50, ${backgroundOpacity})`; // Dark purple tint

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
          <View pointerEvents="none" style={[styles.sheen, { borderRadius: cornerRadius, backgroundColor: 'rgba(255,255,255,0.03)' }]} />
          {children}
        </View>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    // No shadows
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
    height: '50%',
  },
  fallback: {
    overflow: 'hidden',
  },
});
