import React from 'react';
import { View, Image, Text, StyleSheet, Platform } from 'react-native';
import GradientBackground from './GradientBackground';

export default function BrandedSplash() {
  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel="Launching FocusFlow">
      <GradientBackground>
        <View style={styles.centerWrap}>
          <View style={styles.logoWrap}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>FocusFlow</Text>
          <Text style={styles.subtitle}>Calm focus. Confident progress.</Text>
        </View>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: '#0b1020',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    ...Platform.select({ android: { elevation: 8 } }),
  },
  logo: {
    width: 104,
    height: 104,
  },
  title: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#E7ECFF',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#C9D3FF',
  },
});

