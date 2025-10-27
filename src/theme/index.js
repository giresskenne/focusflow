import { DefaultTheme } from '@react-navigation/native';

// Liquid Glass Dark Theme - matching design2-liquidglass reference
export const colors = {
  // Dark base colors matching reference (#0a0514)
  background: '#0a0514',
  foreground: '#ffffff', 
  card: 'rgba(255, 255, 255, 0.03)',
  cardForeground: '#ffffff',

  // Purple-Blue gradient primary colors (matching reference)
  primary: '#8900f5', // Main purple from reference
  primaryForeground: '#ffffff',
  secondary: '#0072ff', // Blue from gradient
  secondaryForeground: '#ffffff',
  
  // Destructive
  destructive: '#d4183d',
  destructiveForeground: '#ffffff',

  // Text colors for dark theme
  muted: 'rgba(255, 255, 255, 0.05)',
  mutedForeground: '#9ca3af', // Gray-400 equivalent
  text: '#ffffff',

  // Glass morphism borders and surfaces
  border: 'rgba(255, 255, 255, 0.08)', 
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassBackground: 'rgba(255, 255, 255, 0.03)',
  
  // Input styling
  inputBackground: 'rgba(255, 255, 255, 0.05)',

  // Chart colors (purple-blue theme)
  chart1: '#8900f5', // Purple
  chart2: '#0072ff', // Blue  
  chart3: '#7c3aed', // Violet
  chart4: '#06b6d4', // Cyan
  chart5: '#8b5cf6', // Purple variant

  // Semantic colors for dark theme
  success: '#10b981', // Emerald-500
  warning: '#f59e0b', // Amber-500

  // Premium badge (golden)
  premium: '#f59e0b',
  premiumLight: 'rgba(245, 158, 11, 0.1)',

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
