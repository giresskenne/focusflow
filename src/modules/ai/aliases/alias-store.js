// JS facade for alias storage. For MVP we use AsyncStorage. Later, swap to native App Group store.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findClosest } from './fuzzy-match';

const KEY = 'ff:aliases';

export async function getAliases() {
  const raw = await AsyncStorage.getItem(KEY);
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function saveAliases(map) {
  await AsyncStorage.setItem(KEY, JSON.stringify(map || {}));
}

export async function upsertAlias(nickname, tokens, synonyms = []) {
  const now = Date.now();
  const map = await getAliases();
  const existing = map[nickname];
  const alias = existing || {
    id: genId(),
    nickname,
    tokens: { apps: [], categories: [], domains: [], ...(tokens || {}) },
    synonyms: [],
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };
  alias.tokens = { apps: [], categories: [], domains: [], ...alias.tokens, ...tokens };
  alias.synonyms = Array.from(new Set([...(alias.synonyms || []), ...synonyms]));
  alias.updatedAt = now;
  map[nickname] = alias;
  await saveAliases(map);
  return alias;
}

export async function removeAlias(nickname) {
  const map = await getAliases();
  delete map[nickname];
  await saveAliases(map);
}

export async function resolveAlias(name) {
  const map = await getAliases();
  const key = Object.keys(map).find((k) => k.toLowerCase() === String(name).toLowerCase());
  if (key) return map[key];
  // Try synonyms
  for (const k of Object.keys(map)) {
    const a = map[k];
    if ((a.synonyms || []).some((s) => s.toLowerCase() === String(name).toLowerCase())) return a;
  }
  // Fuzzy
  const candidates = Object.keys(map);
  const best = findClosest(String(name), candidates, 0.5);
  return best ? map[best] : null;
}

export async function listAliases() {
  const map = await getAliases();
  return Object.values(map).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function genId() {
  // Lightweight ID generator suitable for client-side lists (not cryptographic)
  return (
    'a' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  );
}
