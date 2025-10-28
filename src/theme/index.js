import { DefaultTheme } from '@react-navigation/native';

// Liquid Glass Dark Theme - matching design2-liquidglass reference
export const colors = {
  // Dark base colors matching reference
  background: 'transparent', // Let background image show through
  foreground: '#ffffff', 
  card: 'rgba(255, 255, 255, 0.05)',
  cardForeground: '#ffffff',

  // Purple-Blue gradient primary colors (matching reference)
  primary: '#8900f5', // Unified purple
  primaryForeground: '#ffffff',
  secondary: '#0072ff', // Blue from gradient
  secondaryForeground: '#ffffff',
  
  // Destructive
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',

  // Text colors for dark theme
  muted: 'rgba(255, 255, 255, 0.08)',
  // Revert purple-tinted secondary text to original
  mutedForeground: '#c4b5fd',
  text: '#ffffff',

  // Glass morphism borders and surfaces
  border: 'rgba(255, 255, 255, 0.1)', 
  glassBorder: 'rgba(255, 255, 255, 0.15)',
  glassBackground: 'rgba(255, 255, 255, 0.05)',
  
  // Input styling
  inputBackground: 'rgba(255, 255, 255, 0.08)',

  // Chart colors (purple-blue theme)
  chart1: '#8900f5', // Purple
  chart2: '#0072ff', // Blue  
  chart3: '#8900f5', // Violet unified
  chart4: '#06b6d4', // Cyan
  chart5: '#8900f5', // Purple variant unified

  // Semantic colors for dark theme
  success: '#10b981', // Emerald-500
  warning: '#f59e0b', // Amber-500

  // Premium badge (purple)
  premium: '#8900f5',
  premiumLight: 'rgba(137, 0, 245, 0.15)',

  // Active badge (green)
  activeGreen: '#10b981',
  activeGreenBg: 'rgba(16, 185, 129, 0.1)',
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
  xs: 11,
  sm: 14,
  base: 17,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  
  // Weights
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
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

// React Navigation theme (dark liquid glass)
export const theme = {
  ...DefaultTheme,
  dark: true, // Enable dark theme
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
