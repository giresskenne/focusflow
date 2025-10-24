import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '../theme';

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>Your privacy matters. This is our MVP placeholder policy.</Text>

        <View style={styles.card}>
          <Text style={styles.h2}>Data We Store</Text>
          <Text style={styles.p}>- Reminders, sessions, and preferences are stored locally on your device using AsyncStorage.</Text>
          <Text style={styles.p}>- No data is sent to our servers in the MVP. Analytics are anonymous and optional.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Notifications</Text>
          <Text style={styles.p}>We use the system notifications API to deliver reminders you configure. You can disable notifications in Settings at any time.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Future Changes</Text>
          <Text style={styles.p}>When we add sign-in and sync, this policy will be updated to describe how your data is handled in the cloud.</Text>
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
