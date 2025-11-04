// Native alias/token helpers per spec §5 with graceful fallbacks
import { NativeModules, Platform } from 'react-native';
import { upsertAlias } from './alias-store';

const Picker = NativeModules?.PickerModule; // expected native bridge

export function isFamilyPickerAvailable() {
  return Platform.OS === 'ios' && !!Picker && typeof Picker.showPicker === 'function';
}

// Opens the FamilyActivityPicker (native) and returns a TokenBundle
// TokenBundle shape: { apps?: string[], categories?: string[], domains?: string[] }
export async function showFamilyPicker() {
  if (!isFamilyPickerAvailable()) return null;
  try {
    const res = await Picker.showPicker();
    if (!res || typeof res !== 'object') return null;
    const { apps = [], categories = [], domains = [] } = res || {};
    return { apps, categories, domains };
  } catch (e) {
    console.warn('[AliasNative] showFamilyPicker failed:', e?.message);
    return null;
  }
}

// Create alias via picker, save, and return the saved alias
export async function createAliasViaPicker(nickname) {
  const tokens = await showFamilyPicker();
  if (!tokens) return null;
  const alias = await upsertAlias(String(nickname || '').trim(), tokens, []);
  return alias;
}
