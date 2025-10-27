import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Use environment variables with fallback to expo config
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let _client = null;

// Use iOS Keychain via Expo SecureStore for auth tokens (best practice)
const secureStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export function getSupabase() {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR-PROJECT') || SUPABASE_ANON_KEY === 'YOUR-ANON-KEY') {
    console.warn('[Supabase] Missing configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env file');
  }
  _client = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

// Test helper: allow injecting a Supabase client (e.g., in Node/Jest where SecureStore isn't available)
export function setSupabaseClient(client) {
  _client = client;
}
