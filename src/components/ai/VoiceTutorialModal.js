import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../Ui/GlassCard';
import GradientBackground from '../GradientBackground';
import UIButton from '../Ui/Button';
import { colors, spacing, radius, typography } from '../../theme';

// Palette for example icons (cycled)
const EXAMPLE_COLORS = [
  colors.primary,
  '#10b981', // green
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ef4444', // red
  '#8b5cf6', // violet
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tutorial steps with examples
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Meet Mada 👋',
    description: 'Your AI voice assistant for focus and productivity',
    content: 'Mada helps you block distracting apps and set reminders—all with your voice. Just tap the mic button and speak naturally.',
    icon: 'mic-circle',
    iconColor: colors.primary,
  },
  {
    id: 'blocking',
    title: 'Block Distractions',
    description: 'Focus on what matters',
    content: 'Tell Mada which apps to block and for how long. She\'ll take care of the rest.',
    examples: [
      { text: '"Block social media for 30 minutes"', icon: 'time-outline' },
      { text: '"Block Instagram for 1 hour"', icon: 'logo-instagram' },
      { text: '"Start focus session for 2 hours"', icon: 'shield-checkmark-outline' },
    ],
    icon: 'shield-outline',
    iconColor: '#0072ff',
  },
  {
    id: 'reminders',
    title: 'Set Reminders',
    description: 'Never forget important tasks',
    content: 'Ask Mada to remind you about anything—one-time, daily, or weekly.',
    examples: [
      { text: '"Remind me to drink water in 30 minutes"', icon: 'water-outline' },
      { text: '"Remind me to exercise every day at 6 PM"', icon: 'barbell-outline' },
      { text: '"Remind me to call mom every Monday"', icon: 'call-outline' },
    ],
    icon: 'notifications-outline',
    iconColor: '#f59e0b',
  },
  {
    id: 'natural',
    title: 'Speak Naturally',
    description: 'No need for exact commands',
    content: 'Mada understands natural language. If she\'s unsure, she\'ll ask clarifying questions.',
    examples: [
      { text: '"Block it for longer"', subtitle: 'Extends your last session' },
      { text: '"Do it again"', subtitle: 'Repeats your last command' },
      { text: '"Stop blocking"', subtitle: 'Ends your current session' },
    ],
    icon: 'chatbubbles-outline',
    iconColor: '#8900f5',
  },
  {
    id: 'permissions',
    title: 'Permissions',
    description: 'What Mada needs to work',
    content: 'For the best experience, Mada needs access to your microphone and notifications.',
    permissions: [
      { icon: 'mic-outline', title: 'Microphone', description: 'To hear your voice commands' },
      { icon: 'notifications-outline', title: 'Notifications', description: 'To send reminders and alerts' },
    ],
    icon: 'lock-closed-outline',
    iconColor: '#10b981',
  },
];

export default function VoiceTutorialModal({ visible, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
    if (onClose) {
      onClose();
    }
  };

  const handleSkip = () => {
    if (onClose) {
      onClose();
    }
  };

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleSkip}
    >
      <GradientBackground>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            {/* Progress indicators */}
            <View style={styles.progressContainer}>
              {TUTORIAL_STEPS.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index === currentStep && styles.progressDotActive,
                    index < currentStep && styles.progressDotCompleted,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={[`${step.iconColor}30`, `${step.iconColor}10`]}
                style={styles.iconGradient}
              >
                <Ionicons name={step.icon} size={64} color={step.iconColor} />
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.description}>{step.description}</Text>

            {/* Main content */}
            <Text style={styles.mainContent}>{step.content}</Text>

            {/* Examples */}
            {step.examples && (
              <View style={styles.examplesContainer}>
                {step.examples.map((example, index) => (
                  <GlassCard
                    key={index}
                    tint="dark"
                    intensity={40}
                    style={styles.exampleCard}
                    contentStyle={styles.exampleCardContent}
                  >
                    {example.icon && (
                      <View style={styles.exampleIconWrapper}>
                        <Ionicons
                          name={example.icon}
                          size={20}
                          color={EXAMPLE_COLORS[index % EXAMPLE_COLORS.length]}
                        />
                      </View>
                    )}
                    <View style={styles.exampleTextContainer}>
                      <Text style={styles.exampleText}>{example.text}</Text>
                      {example.subtitle && (
                        <Text style={styles.exampleSubtitle}>{example.subtitle}</Text>
                      )}
                    </View>
                  </GlassCard>
                ))}
              </View>
            )}

            {/* Permissions */}
            {step.permissions && (
              <View style={styles.permissionsContainer}>
                {step.permissions.map((permission, index) => (
                  <GlassCard
                    key={index}
                    tint="dark"
                    intensity={40}
                    style={styles.permissionCard}
                    contentStyle={styles.permissionCardContent}
                  >
                    <View style={styles.permissionIconWrapper}>
                      <Ionicons name={permission.icon} size={24} color={colors.primary} />
                    </View>
                    <View style={styles.permissionTextContainer}>
                      <Text style={styles.permissionTitle}>{permission.title}</Text>
                      <Text style={styles.permissionDescription}>{permission.description}</Text>
                    </View>
                  </GlassCard>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.buttonRow}>
              {currentStep > 0 && (
                <UIButton
                  title="Back"
                  variant="outline"
                  onPress={handlePrevious}
                  style={styles.backButton}
                />
              )}
              <UIButton
                title={isLastStep ? 'Get Started' : 'Next'}
                onPress={handleNext}
                style={styles.nextButton}
              />
            </View>
          </View>
        </SafeAreaView>
      </GradientBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    fontWeight: typography.medium,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  progressDotCompleted: {
    backgroundColor: 'rgba(137, 0, 245, 0.5)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
    marginBottom: spacing.xl,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: typography.extrabold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: typography.lg,
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontWeight: typography.medium,
  },
  mainContent: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  examplesContainer: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  exampleCard: {
    marginBottom: 0,
  },
  exampleCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  exampleIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(137, 0, 245, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  exampleTextContainer: {
    flex: 1,
  },
  exampleText: {
    fontSize: typography.base,
    color: colors.foreground,
    fontWeight: typography.medium,
    marginBottom: 2,
  },
  exampleSubtitle: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
  },
  permissionsContainer: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  permissionCard: {
    marginBottom: 0,
  },
  permissionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  permissionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(137, 0, 245, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: typography.base,
    color: colors.foreground,
    fontWeight: typography.semibold,
    marginBottom: 2,
  },
  permissionDescription: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    height: 56,
  },
  nextButton: {
    flex: 2,
    height: 56,
  },
});
