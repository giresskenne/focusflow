import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing, Image, AccessibilityInfo } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

export default function AnimatedSplashParticles({
  variant = 'bubbles',
  duration = 9000,
  count = 36,
  primary = '#8900f5',
  accent = '#0A84FF',
  total = 1100,
  showLogo = true,
  logoSize = 96,
  logoSource = require('../../assets/splash-icon.png'),
  onDone,
}) {
  const particles = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const size = rand(6, 18);
      const startX = rand(0, SCREEN_W - size);
      const startY = variant === 'snow' ? rand(-SCREEN_H, -size) : rand(SCREEN_H, SCREEN_H + 200);
      const baseDur = rand(duration * 0.7, duration * 1.4);

      return {
        key: `p-${i}`,
        size,
        startX,
        startY,
        baseDur,
        color: i % 3 === 0 ? primary : i % 3 === 1 ? accent : 'rgba(255,255,255,0.85)',
        translateY: new Animated.Value(startY),
        translateX: new Animated.Value(startX),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0.8),
      };
    });
  }, [variant, duration, count, primary, accent]);

  // Overlay + logo animation controls
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const gradShift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = particles.map((p) => {
      const driftX = rand(-20, 20);
      const driftYEnd = variant === 'snow' ? SCREEN_H + p.size * 2 : -p.size * 2;
      const yAnim = Animated.timing(p.translateY, {
        toValue: driftYEnd,
        duration: p.baseDur,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      const xAnim = Animated.sequence([
        Animated.timing(p.translateX, { toValue: p.startX + driftX, duration: p.baseDur * 0.5, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(p.translateX, { toValue: p.startX - driftX, duration: p.baseDur * 0.5, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]);
      const fade = Animated.sequence([
        Animated.timing(p.opacity, { toValue: 0.8, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0.35, duration: p.baseDur - 1200, easing: Easing.linear, useNativeDriver: true }),
      ]);
      const pulse = Animated.sequence([
        Animated.timing(p.scale, { toValue: 1.1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(p.scale, { toValue: 0.9, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]);

      const all = Animated.parallel([yAnim, xAnim, fade, Animated.loop(pulse, { iterations: 2 })]);

      return Animated.loop(all, { resetBeforeIteration: true });
    });

    if (count > 0) loops.forEach((l) => l.start());
    return () => { loops.forEach((l) => l.stop()); };
  }, [particles, variant]);

  // Modern splash timeline: logo pop + gradient shift + fade out
  useEffect(() => {
    let reduceMotion = false;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reduceMotion = !!v; });

    const logoAnim = reduceMotion
      ? Animated.timing(logoOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      : Animated.parallel([
          Animated.timing(logoOpacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(logoScale, { toValue: 1, damping: 12, stiffness: 140, mass: 0.7, useNativeDriver: true }),
        ]);

    const halo = Animated.sequence([
      Animated.timing(haloOpacity, { toValue: 0.22, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(haloOpacity, { toValue: 0.0, duration: 350, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);

    const gradientShift = Animated.timing(gradShift, { toValue: 1, duration: Math.max(450, total - 500), easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const fadeOut = Animated.timing(overlayOpacity, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true });

    const seq = Animated.sequence([
      Animated.parallel([logoAnim, halo, gradientShift]),
      fadeOut,
    ]);

    seq.start(({ finished }) => { if (finished && typeof onDone === 'function') onDone(); });
    return () => seq.stop();
  }, [total, onDone]);

  return (
    <Animated.View pointerEvents="none" style={[styles.root, { opacity: overlayOpacity }] }>
      <View style={styles.bgBase} />
      <Animated.View style={[styles.tint, { backgroundColor: primary + '22', transform: [{ translateX: gradShift.interpolate({ inputRange: [0,1], outputRange: [0, 18] }) }] }]} />
      <Animated.View style={[styles.tintBottom, { backgroundColor: accent + '22', transform: [{ translateX: gradShift.interpolate({ inputRange: [0,1], outputRange: [0, -18] }) }] }]} />

      {showLogo && (
        <View style={styles.centerWrap}>
          <Animated.View style={[styles.halo, { opacity: haloOpacity, width: logoSize * 2.2, height: logoSize * 2.2, borderRadius: (logoSize * 2.2) / 2 }]} />
          <Animated.Image source={logoSource} resizeMode="contain" style={{ width: logoSize, height: logoSize, opacity: logoOpacity, transform: [{ scale: logoScale }] }} />
        </View>
      )}

      {count > 0 && particles.map((p) => (
        <Animated.View
          key={p.key}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: variant === 'snow' ? 'rgba(255,255,255,0.9)' : p.color,
            opacity: p.opacity,
            transform: [
              { translateX: p.translateX },
              { translateY: p.translateY },
              { scale: p.scale },
            ],
          }}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1200,
    overflow: 'hidden',
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b1020',
  },
  centerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  tint: {
    position: 'absolute',
    top: -SCREEN_H * 0.2,
    left: -SCREEN_W * 0.1,
    right: -SCREEN_W * 0.1,
    height: SCREEN_H * 0.6,
    borderBottomLeftRadius: SCREEN_W,
    borderBottomRightRadius: SCREEN_W,
  },
  tintBottom: {
    position: 'absolute',
    bottom: -SCREEN_H * 0.25,
    left: -SCREEN_W * 0.15,
    right: -SCREEN_W * 0.15,
    height: SCREEN_H * 0.6,
    borderTopLeftRadius: SCREEN_W,
    borderTopRightRadius: SCREEN_W,
  },
});
