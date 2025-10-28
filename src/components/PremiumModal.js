import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { CrownIcon, XIcon, CheckIcon, ZapIcon, ShieldIcon, CloudIcon } from './Icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import GlassCard from './Ui/GlassCard';
import GradientBackground from './GradientBackground';

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
      <GradientBackground>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
          <View style={styles.container}>
          {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <XIcon size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
            {/* Hero Section */}
              <View style={styles.hero}>
                <GlassCard tint="dark" intensity={60} cornerRadius={40} contentStyle={styles.crownContent} style={styles.crownWrapper}>
                  <CrownIcon size={28} color="#fff" />
                </GlassCard>
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
                    <GlassCard key={index} tint="dark" intensity={40} cornerRadius={16} contentStyle={styles.featureRow} style={styles.featureItemCard}>
                      <View style={styles.featureIconWrapperGlass}>
                        <FeatureIcon size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureTitle}>{feature.title}</Text>
                        <Text style={styles.featureDescription}>{feature.description}</Text>
                      </View>
                    </GlassCard>
                  );
                })}
              </View>

            {/* Pricing Cards */}
            <View style={styles.pricing}>
              <Text style={styles.pricingHeader}>Choose Your Plan</Text>
              
              {/* Annual Plan (Recommended) */}
              <GlassCard tint="dark" intensity={60} cornerRadius={20} style={[styles.pricingCard, styles.recommendedCard]}>
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
              <GlassCard tint="dark" intensity={40} cornerRadius={20} style={styles.pricingCard}>
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
      </GradientBackground>
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
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
  crownWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  crownContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
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
    gap: spacing.sm,
  },
  featureItemCard: {
    padding: 0,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  featureIconWrapperGlass: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(137, 0, 245, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(137, 0, 245, 0.25)'
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
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
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
