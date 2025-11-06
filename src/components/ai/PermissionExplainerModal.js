import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../theme';
import GlassCard from '../GlassCard';
import GradientBackground from '../GradientBackground';
import UIButton from '../Ui/Button';

/**
 * Permission Explainer Modal
 * Shows before requesting system permissions to explain why we need them
 * and what they're used for. Improves permission grant rates and user trust.
 */
export default function PermissionExplainerModal({ 
  visible, 
  onClose, 
  onGrant,
  permissionType = 'microphone' // 'microphone' or 'notifications'
}) {
  const config = PERMISSION_CONFIG[permissionType];
  
  if (!config) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GradientBackground>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <GlassCard tint="dark" intensity={80} cornerRadius={24}>
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {/* Icon */}
                <View style={[styles.iconContainer, { backgroundColor: config.iconColor + '20' }]}>
                  <Ionicons name={config.icon} size={48} color={config.iconColor} />
                </View>

                {/* Title */}
                <Text style={styles.title}>{config.title}</Text>
                
                {/* Description */}
                <Text style={styles.description}>{config.description}</Text>

                {/* Features List */}
                <View style={styles.featuresContainer}>
                  <Text style={styles.featuresTitle}>What you can do:</Text>
                  {config.features.map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <View style={styles.featureIconContainer}>
                        <Ionicons 
                          name={feature.icon} 
                          size={20} 
                          color={colors.primary} 
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureTitle}>{feature.title}</Text>
                        <Text style={styles.featureDescription}>{feature.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Privacy Note */}
                <View style={styles.privacyNote}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.mutedForeground} />
                  <Text style={styles.privacyText}>{config.privacyNote}</Text>
                </View>

                {/* Buttons */}
                <View style={styles.buttons}>
                  <UIButton
                    title={config.grantButtonLabel}
                    onPress={onGrant}
                    variant="primary"
                    style={styles.grantButton}
                  />
                  <TouchableOpacity 
                    style={styles.laterButton}
                    onPress={onClose}
                  >
                    <Text style={styles.laterText}>Later</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </GlassCard>
            {/* Close button */}
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </GradientBackground>
    </Modal>
  );
}

const PERMISSION_CONFIG = {
  microphone: {
    icon: 'mic',
    iconColor: colors.primary,
    title: 'Microphone Access',
    description: 'FocusFlow uses your microphone to understand voice commands with Mada, your AI assistant.',
  grantButtonLabel: 'Grant now',
    features: [
      {
        icon: 'ban',
        title: 'Block Apps with Voice',
        description: 'Say "Block Instagram for 30 minutes" to start a focus session'
      },
      {
        icon: 'notifications',
        title: 'Create Voice Reminders',
        description: 'Say "Remind me to drink water in 30 minutes" hands-free'
      },
      {
        icon: 'chatbubbles',
        title: 'Natural Conversations',
        description: 'Talk naturally - "Block it for longer" or "Do it again"'
      }
    ],
    privacyNote: 'Audio is processed locally on your device and never stored or shared.'
  },
  notifications: {
    icon: 'notifications',
    iconColor: '#FF6B6B',
    title: 'Notification Access',
    description: 'FocusFlow needs notifications to remind you when apps are unblocked and for your custom reminders.',
  grantButtonLabel: 'Grant now',
    features: [
      {
        icon: 'time',
        title: 'Session Reminders',
        description: 'Get notified when your focus session ends and apps are unblocked'
      },
      {
        icon: 'alarm',
        title: 'Voice Reminders',
        description: 'Receive timely alerts for reminders you create with voice or manually'
      },
      {
        icon: 'flame',
        title: 'Streak Tracking',
        description: 'Stay motivated with daily focus streak notifications'
      }
    ],
    privacyNote: 'We only send notifications you explicitly request. No spam, ever.'
  }
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    position: 'relative',
  },
  scrollContent: {
    padding: spacing.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: typography.extrabold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  featuresContainer: {
    marginBottom: spacing.xl,
  },
  featuresTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.foreground,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.xl,
  },
  privacyText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  buttons: {
    gap: spacing.md,
  },
  grantButton: {
    marginBottom: 0,
  },
  laterButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  laterText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.mutedForeground,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    padding: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)'
  },
});
