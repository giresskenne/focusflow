import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function GradientBackground({ children }) {
  return (
    <View style={styles.container}>
      {/* Main dark background with layered colored overlays */}
      <View style={[StyleSheet.absoluteFillObject, styles.mainBackground]} />
      
      {/* Purple-Blue gradient effect using multiple layers */}
      <View style={[StyleSheet.absoluteFillObject, styles.purpleOverlay]} />
      <View style={[StyleSheet.absoluteFillObject, styles.blueOverlay]} />
      <View style={[StyleSheet.absoluteFillObject, styles.radialOverlay]} />
      
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  mainBackground: {
    backgroundColor: '#0a0514', // Base dark background
  },
  purpleOverlay: {
    backgroundColor: 'rgba(137, 0, 245, 0.2)', // Purple overlay
    opacity: 0.8,
  },
  blueOverlay: {
    backgroundColor: 'rgba(0, 114, 255, 0.15)', // Blue overlay  
    opacity: 0.6,
  },
  radialOverlay: {
    backgroundColor: 'rgba(137, 0, 245, 0.1)', // Subtle radial effect
    opacity: 0.4,
  },
});