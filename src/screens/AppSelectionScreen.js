import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '@react-navigation/native';
import * as IntentLauncher from 'expo-intent-launcher';
import AppBlocker from '../../components/AppBlocker';
import { getInstalledApps } from '../native/installedApps';
import { getSelectedApps, setSelectedApps } from '../storage';

const MOCK_APPS = [
  { id: 'com.social.app', name: 'Social App' },
  { id: 'com.video.stream', name: 'Video Stream' },
  { id: 'com.games.arcade', name: 'Arcade Games' },
  { id: 'com.shop.mall', name: 'Shopping' },
];

export default function AppSelectionScreen() {
  const [selected, setSelected] = useState({});
  const [list, setList] = useState(MOCK_APPS);
  const [upsell, setUpsell] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    (async () => {
      const saved = await getSelectedApps();
      setSelected(saved);
      if (Platform.OS === 'android') {
        const apps = await getInstalledApps();
        setList(apps.map(a => ({ id: a.packageName, name: a.label })));
      } else {
        setList(MOCK_APPS);
      }
    })();
  }, []);

  const toggle = async (id) => {
    setSelected((prev) => {
      const count = Object.values(prev).filter(Boolean).length;
      if (!prev[id] && count >= 5) {
        setUpsell(true);
        return prev;
      }
      const next = { ...prev, [id]: !prev[id] };
      // fire-and-forget persist
      setSelectedApps(next).catch(() => {});
      return next;
    });
  };

  const openUsageAccess = () => {
    if (Platform.OS !== 'android') return;
    IntentLauncher.startActivityAsync('android.settings.USAGE_ACCESS_SETTINGS').catch(() => {});
  };

  const openAccessibility = () => {
    if (Platform.OS !== 'android') return;
    IntentLauncher.startActivityAsync('android.settings.ACCESSIBILITY_SETTINGS').catch(() => {});
  };

  const checkUsageAccess = async () => {
    if (Platform.OS !== 'android' || !AppBlocker.hasUsageAccess) return false;
    try { return await AppBlocker.hasUsageAccess(); } catch { return false; }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <Text style={[styles.title, { color: colors.text }]}>Select Apps to Block</Text>
      {Platform.OS === 'android' && (
        <View style={[styles.banner, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>Enable permissions</Text>
          <Text style={[styles.bannerText, { color: '#b5b9d6' }]}>Grant Usage Access and (optional) Accessibility for stronger blocking.</Text>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TouchableOpacity style={[styles.bannerBtn, { borderColor: colors.border }]} onPress={openUsageAccess}>
              <Text style={{ color: colors.text }}>Usage Access</Text>
            </TouchableOpacity>
            <View style={{ width: 8 }} />
            <TouchableOpacity style={[styles.bannerBtn, { borderColor: colors.border }]} onPress={openAccessibility}>
              <Text style={{ color: colors.text }}>Accessibility</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.row, { borderColor: colors.border }]} onPress={() => toggle(item.id)}>
            <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.badge, { color: selected[item.id] ? '#2ecc71' : '#b5b9d6' }]}>
              {selected[item.id] ? 'Selected' : 'Tap to select'}
            </Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
      />
      <Text style={[styles.footer, { color: '#b5b9d6' }]}>
        Selected: {Object.values(selected).filter(Boolean).length}
      </Text>
      {upsell && (
        <View style={[styles.modal, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Upgrade to Premium</Text>
          <Text style={[styles.modalText, { color: '#b5b9d6' }]}>Free plan allows up to 5 apps. Upgrade to select more.</Text>
          <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border }]} onPress={() => setUpsell(false)}>
            <Text style={{ color: colors.text }}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  name: { fontSize: 17 },
  badge: { fontSize: 13, fontWeight: '600' },
  separator: { height: 10 },
  footer: { textAlign: 'center', marginTop: 12 },
  banner: { padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  bannerTitle: { fontWeight: '800' },
  bannerText: { marginTop: 4 },
  bannerBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  modal: { position: 'absolute', left: 16, right: 16, bottom: 16, padding: 16, borderWidth: 1, borderRadius: 14 },
  modalTitle: { fontWeight: '800', marginBottom: 6, fontSize: 16 },
  modalText: { marginBottom: 10 },
  modalBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 }
});
