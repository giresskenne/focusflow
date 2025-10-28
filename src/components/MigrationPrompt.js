import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import GlassCard from './Ui/GlassCard';
import UIButton from './Ui/Button';

export default function MigrationPrompt({ visible, onKeepLocal, onSaveToAccount, onClose, loading = false }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <GlassCard tint="dark" intensity={50} cornerRadius={24} contentStyle={styles.cardContent} style={styles.cardOuter}>
          <Text style={styles.title}>Save your data?</Text>
          <Text style={styles.subtitle}>
            We found reminders, app selections, or analytics on this device. Do you want to save them to your account so they're available across devices?
          </Text>

          <View style={styles.actions}>
            <UIButton title={loading ? 'Please wait…' : 'Keep Local'} variant="outline" onPress={onKeepLocal} disabled={loading} style={{ flex: 1 }} />
            <UIButton title={loading ? 'Saving…' : 'Save to Account'} onPress={onSaveToAccount} disabled={loading} style={{ flex: 1 }} />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  cardOuter: { width: '100%', maxWidth: 420 },
  cardContent: { padding: spacing['2xl'] },
  title: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.foreground, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.base, color: colors.mutedForeground, lineHeight: 22, marginBottom: spacing['2xl'] },
  actions: { flexDirection: 'row', gap: spacing.md },
});