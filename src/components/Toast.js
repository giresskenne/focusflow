import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Toast/Snackbar Component
 * Non-blocking notification that slides up from bottom
 * Auto-dismisses after duration, supports action buttons (like Undo)
 */
export default function Toast({ 
  visible, 
  message, 
  type = 'success', // 'success' | 'error' | 'info'
  duration = 4000, 
  action,
  onDismiss 
}) {
  const translateY = useRef(new Animated.Value(200)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.spring(translateY, {
        toValue: 0,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        dismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // Reset position when not visible
      translateY.setValue(200);
    }
  }, [visible, duration]);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: 200,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onDismiss?.();
    });
  };

  if (!visible && translateY._value === 200) return null;

  const config = TOAST_CONFIG[type];

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          transform: [{ translateY }],
          bottom: Math.max(insets.bottom + 16, 80), // Above tab bar
        }
      ]}
    >
      <View style={[styles.toast, { backgroundColor: config.backgroundColor }]}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
          <Ionicons name={config.icon} size={20} color={config.iconColor} />
        </View>

        {/* Message */}
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>

        {/* Action Button */}
        {action && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              action.onPress?.();
              dismiss();
            }}
          >
            <Text style={[styles.actionText, { color: config.actionColor }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        )}

        {/* Dismiss Button */}
        {!action && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={dismiss}
          >
            <Ionicons name="close" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const TOAST_CONFIG = {
  success: {
    icon: 'checkmark-circle',
    iconColor: '#4ADE80',
    iconBg: 'rgba(74, 222, 128, 0.15)',
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    actionColor: '#4ADE80',
  },
  error: {
    icon: 'close-circle',
    iconColor: '#F87171',
    iconBg: 'rgba(248, 113, 113, 0.15)',
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    actionColor: '#F87171',
  },
  info: {
    icon: 'information-circle',
    iconColor: colors.primary,
    iconBg: 'rgba(99, 102, 241, 0.15)',
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    actionColor: colors.primary,
  },
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.foreground,
    lineHeight: 20,
    fontWeight: typography.medium,
  },
  actionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dismissButton: {
    padding: spacing.xs,
  },
});
