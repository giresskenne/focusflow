import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { CrownIcon, XIcon, CheckIcon, ZapIcon, ShieldIcon, CloudIcon } from './Icons';
import { colors, spacing, radius, typography, shadows } from '../theme';
import GlassCard from './Ui/GlassCard';
import GradientBackground from './GradientBackground';
import GradientButton from './Ui/GradientButton';
import { LinearGradient } from 'expo-linear-gradient';

export default function PremiumModal({ visible, onClose, onUpgrade }) {
  const { colors: navColors } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState('annual');

  // Pricing constants (can be centralized later)
  const annualPrice = 49.99;
  const monthlyPrice = 5.99;
  const savePercent = 30; // display badge only

  const features = [
    { title: 'Unlimited Focus Sessions', description: 'Block unlimited apps with custom durations' },
    { title: 'Advanced Reminders', description: 'Location-based, custom intervals, unlimited reminders' },
    { title: 'Premium Analytics', description: 'Detailed insights and productivity trends' },
    { title: 'Cloud Sync', description: 'Access your data across all devices' },
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
                <Text style={styles.heroSubtitle}>Advanced features. Unlimited access.</Text>
              </View>

            {/* Features List (green checks) */}
              <GlassCard tint="dark" intensity={50} cornerRadius={20} style={{ marginBottom: spacing.md }} contentStyle={{ padding: spacing.md }}>
                <View style={styles.features}>
                  {features.map((feature, index) => (
                    <View key={index} style={[styles.checkRow, index !== features.length - 1 && styles.checkDivider]}>
                      <View style={styles.checkCircle}>
                        <CheckIcon size={14} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureTitle}>{feature.title}</Text>
                        <Text style={styles.featureDescription}>{feature.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </GlassCard>

            {/* Pricing Cards */}
            <View style={styles.pricing}>
              <Text style={styles.pricingHeader}>Choose Your Plan</Text>
              
              {/* Annual Plan (Recommended) */}
              <TouchableOpacity onPress={() => setSelectedPlan('annual')} activeOpacity={0.9}>
                <LinearGradient
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  colors={selectedPlan === 'annual' ? ['#1f2a6b66', '#0072ff44'] : ['#ffffff08', '#ffffff05']}
                  style={[styles.pricingCard, styles.linearCard, selectedPlan === 'annual' && styles.selectedOutline]}
                >
                  <View style={styles.badgeRow}>
                    <View style={styles.planTitleWrap}><Text style={styles.planName}>Annual</Text></View>
                    <View style={styles.savingsPill}><Text style={styles.savingsText}>Save {savePercent}%</Text></View>
                  </View>
                  <View style={styles.pricingRow}>
                    <Text style={styles.planSubText}>${annualPrice.toFixed(2)}/year</Text>
                    <View style={styles.pricingRightBig}>
                      <Text style={styles.planPriceBig}>${annualPrice.toFixed(2)}</Text>
                      <Text style={styles.planPeriod}>per year</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Monthly Plan */}
              <TouchableOpacity onPress={() => setSelectedPlan('monthly')} activeOpacity={0.9}>
                <View style={[styles.pricingCard, styles.monthlyCard, selectedPlan === 'monthly' && styles.selectedOutline]}>
                  <View style={styles.pricingContent}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>Monthly</Text>
                      <Text style={styles.planDescription}>Flexible monthly billing</Text>
                    </View>
                    <View style={styles.pricingRight}>
                      <Text style={styles.planPrice}>${monthlyPrice.toFixed(2)}</Text>
                      <Text style={styles.planPeriod}>per month</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* CTA */}
            <View style={styles.ctaWrap}>
              <GradientButton title={selectedPlan === 'annual' ? 'Start Annual' : 'Start Monthly'} onPress={() => onUpgrade?.(selectedPlan)} />
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    padding: spacing.lg,
    paddingTop: 0,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  crownWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  crownContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  heroTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  features: { gap: spacing.xs },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  checkDivider: {
    borderBottomColor: 'rgba(255,255,255,0.12)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
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
  pricing: { marginBottom: spacing.lg },
  pricingHeader: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  pricingCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  linearCard: {
    overflow: 'hidden',
  },
  selectedOutline: {
    borderColor: colors.primary,
    borderWidth: 2,
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
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  savingsPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: '#10b981',
    borderRadius: radius.full,
  },
  savingsText: { color: '#fff', fontSize: 12, fontWeight: typography.bold },
  pricingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.xs },
  planSubText: { color: colors.mutedForeground, fontSize: typography.sm },
  pricingRightBig: { alignItems: 'flex-end' },
  planPriceBig: { fontSize: 28, fontWeight: typography.bold, color: colors.foreground, lineHeight: 32 },
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
  ctaWrap: { gap: spacing.sm },
  footerText: {
    fontSize: typography.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
