import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { CrownIcon, XIcon, CheckIcon, ZapIcon, ShieldIcon, CloudIcon } from './Icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import GlassCard from './Ui/GlassCard';

export default function PremiumModal({ visible, onClose, onUpgrade }) {
  const { colors: navColors } = useTheme();

  const features = [
    {
      icon: ZapIcon,
      title: 'Unlimited Focus Sessions',
      description: 'Block unlimited apps with custom durations',
    },
    {
      icon: CheckIcon,
      title: 'Advanced Reminders',
      description: 'Location-based, custom intervals, unlimited reminders',
    },
    {
      icon: ShieldIcon,
      title: 'Premium Analytics',
      description: 'Detailed insights and productivity trends',
    },
    {
      icon: CloudIcon,
      title: 'Cloud Sync',
      description: 'Access your data across all devices',
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: navColors.background }} edges={['top']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <XIcon size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Section */}
            <View style={styles.hero}>
              <View style={styles.crownIconWrapper}>
                <CrownIcon size={32} color="#fff" />
              </View>
              <Text style={styles.heroTitle}>Unlock Premium</Text>
              <Text style={styles.heroSubtitle}>
                Take your focus to the next level with advanced features and unlimited access
              </Text>
            </View>

            {/* Features List */}
            <View style={styles.features}>
              {features.map((feature, index) => {
                const FeatureIcon = feature.icon;
                return (
                  <View key={index} style={styles.featureItem}>
                    <View style={styles.featureIconWrapper}>
                      <FeatureIcon size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureDescription}>{feature.description}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Pricing Cards */}
            <View style={styles.pricing}>
              <Text style={styles.pricingHeader}>Choose Your Plan</Text>
              
              {/* Annual Plan (Recommended) */}
              <GlassCard tint="light" intensity={60} cornerRadius={20} style={[styles.pricingCard, styles.recommendedCard]}>
                <TouchableOpacity onPress={() => onUpgrade('annual')}>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>BEST VALUE</Text>
                  </View>
                  <View style={styles.pricingContent}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>Annual</Text>
                      <Text style={styles.planDescription}>Save 17% with yearly billing</Text>
                    </View>
                    <View style={styles.pricingRight}>
                      <Text style={styles.planPrice}>$49.99</Text>
                      <Text style={styles.planPeriod}>per year</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </GlassCard>

              {/* Monthly Plan */}
              <GlassCard tint="light" intensity={50} cornerRadius={20} style={styles.pricingCard}>
                <TouchableOpacity onPress={() => onUpgrade('monthly')}>
                  <View style={styles.pricingContent}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>Monthly</Text>
                      <Text style={styles.planDescription}>Flexible monthly billing</Text>
                    </View>
                    <View style={styles.pricingRight}>
                      <Text style={styles.planPrice}>$4.99</Text>
                      <Text style={styles.planPeriod}>per month</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </GlassCard>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Start your free trial today. Cancel anytime.
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.xl,
    paddingTop: 0,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  crownIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  heroTitle: {
    fontSize: typography['3xl'],
    fontWeight: typography.bold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: typography.base,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  features: {
    marginBottom: spacing['2xl'],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  featureIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}20`,
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
    lineHeight: 20,
  },
  pricing: {
    marginBottom: spacing['2xl'],
  },
  pricingHeader: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  pricingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
    ...shadows.sm,
  },
  recommendedCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    left: '50%',
    transform: [{ translateX: -35 }],
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: typography.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  pricingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planName: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.foreground,
    marginBottom: 2,
  },
  planDescription: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
  },
  pricingRight: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.foreground,
  },
  planPeriod: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  footerText: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
