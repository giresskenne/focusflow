import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

export default function VoiceHintSheet({ visible, onClose }) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Try saying…</Text>
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.example}>• Block Social for 45 minutes</Text>
            <Text style={styles.example}>• Block TikTok for 30 minutes</Text>
            <Text style={styles.example}>• Stop blocking</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { width: '100%', backgroundColor: '#0c1117', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing['2xl'], borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  title: { color: '#fff', fontSize: typography.lg, fontWeight: typography.bold, marginBottom: spacing.md },
  example: { color: colors.mutedForeground, fontSize: typography.base },
  btn: { marginTop: spacing.lg, height: 44, borderRadius: radius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: typography.semibold },
});
