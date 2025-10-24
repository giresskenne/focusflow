import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';

export default function MigrationPrompt({ visible, onKeepLocal, onSaveToAccount, onClose, loading = false }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Save your data?</Text>
          <Text style={styles.subtitle}>
            We found reminders, app selections, or analytics on this device. Do you want to save them to your account so they're available across devices?
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={onKeepLocal} disabled={loading}>
              <Text style={[styles.btnText, styles.btnOutlineText]}>{loading ? 'Please wait…' : 'Keep Local'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]} onPress={onSaveToAccount} disabled={loading}>
              <Text style={[styles.btnText, styles.btnPrimaryText]}>{loading ? 'Saving…' : 'Save to Account'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['2xl'],
  },
  title: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.foreground, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.base, color: colors.mutedForeground, lineHeight: 22, marginBottom: spacing['2xl'] },
  actions: { flexDirection: 'row', gap: spacing.md },
  btn: { flex: 1, height: 48, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  btnOutlineText: { color: colors.foreground },
  btnPrimary: { backgroundColor: colors.primary },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff' },
  btnText: { fontSize: typography.base, fontWeight: typography.semibold },
});