import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../theme';

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.subtitle}>Please read these MVP placeholder terms carefully.</Text>

        <View style={styles.card}>
          <Text style={styles.h2}>Use of the App</Text>
          <Text style={styles.p}>FocusFlow helps you plan focus sessions and reminders. Do not rely on it for critical tasks where failure could cause harm.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Subscriptions</Text>
          <Text style={styles.p}>Premium features may require a paid subscription in the future. In this MVP, premium is simulated for testing.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Limitations</Text>
          <Text style={styles.p}>Native app blocking is not active in the MVP. Enforcement features will be implemented in a development build with required permissions.</Text>
        </View>

        <Text style={styles.footer}>Last updated: Oct 23, 2025</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  title: { fontSize: 28, fontWeight: typography.bold, color: colors.foreground, marginBottom: spacing.sm, letterSpacing: -0.5 },
  subtitle: { fontSize: typography.base, color: colors.mutedForeground, marginBottom: spacing.lg, lineHeight: 22 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  h2: { fontSize: typography.lg, fontWeight: typography.semibold, color: colors.foreground, marginBottom: spacing.sm },
  p: { fontSize: typography.base, color: colors.foreground, lineHeight: 22, marginBottom: spacing.xs },
  footer: { marginTop: spacing.xl, fontSize: typography.sm, color: colors.mutedForeground },
});
