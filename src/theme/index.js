import { DefaultTheme } from '@react-navigation/native';

// Design system colors from deepfocus-design CSS
export const colors = {
  // Base
  background: '#F2F2F7',    // iOS systemGroupedBackground
  foreground: '#000000',
  card: '#FFFFFF',
  cardForeground: '#000000',
  
  // Primary & Accent
  primary: '#007AFF',       // iOS systemBlue
  primaryForeground: '#FFFFFF',
  destructive: '#FF3B30',   // iOS systemRed
  destructiveForeground: '#FFFFFF',
  
  // Text
  muted: '#F2F2F7',
  mutedForeground: '#8E8E93',
  
  // Borders & Inputs
  border: 'rgba(0, 0, 0, 0.08)',
  inputBackground: '#FFFFFF',
  
  // Charts
  chart1: '#007AFF',
  chart2: '#34C759',
  chart3: '#FF9500',
  chart4: '#AF52DE',
  chart5: '#FF2D55',
  
  // Semantic
  success: '#34C759',       // iOS systemGreen
  warning: '#FF9500',       // iOS systemOrange
  
  // Premium badge
  premium: '#F59E0B',       // Amber-500
  premiumLight: '#FEF3C7',
  
  // Active badge
  activeGreen: '#059669',   // Emerald-600
  activeGreenBg: '#D1FAE5', // Emerald-100
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  '2xl': 20,
  full: 9999,
};

export const typography = {
  // Sizes (based on 17px base from design)
  xs: 13,
  sm: 15,
  base: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 48,
  
  // Weights
  normal: '400',
  medium: '600',
  semibold: '600',
  bold: '700',
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
};

// React Navigation theme
export const theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.card,
    border: colors.border,
    text: colors.foreground,
    primary: colors.primary,
    notification: colors.primary,
  },
};

export default theme;
