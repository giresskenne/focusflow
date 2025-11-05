import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { listAliases, removeAlias } from '../../modules/ai/aliases/alias-store';

export default function AliasChips() {
  const [items, setItems] = useState([]);
  useEffect(() => { (async () => setItems(await listAliases()))(); }, []);

  if (!items.length) {
    return <Text style={{ color: colors.mutedForeground }}>No voice nicknames yet.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {items.map((a) => (
        <View key={a.id} style={styles.chip}>
          <Text style={styles.label}>{a.nickname}</Text>
          <TouchableOpacity onPress={async () => { await removeAlias(a.nickname); setItems(await listAliases()); }}>
            <Text style={styles.x}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  label: { color: '#fff', fontWeight: typography.medium },
  x: { color: colors.mutedForeground, marginLeft: 2 },
});
