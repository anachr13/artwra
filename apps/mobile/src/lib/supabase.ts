/**
 * @file supabase.ts
 * @author Artwra
 * @description Supabase client singleton for the mobile app.
 *
 * Uses a hybrid storage adapter that keeps values in a synchronous in-memory
 * Map AND persists them to AsyncStorage. This prevents a React Native race
 * condition where the PKCE code verifier written by `signInWithOAuth` may not
 * be flushed to AsyncStorage before `exchangeCodeForSession` tries to read it.
 * The memory layer guarantees the verifier is immediately readable within the
 * same JS context, while AsyncStorage ensures it survives app restarts.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Supabase PKCE challenge generation checks `window.crypto.subtle`.
// In React Native (Hermes), WebCrypto lives on `globalThis.crypto` — `window`
// is a polyfill from react-native-url-polyfill that doesn't include `crypto`.
// Bridge the two so Supabase can find it.
if (typeof window !== 'undefined' && typeof (window as Window & typeof globalThis).crypto === 'undefined') {
  (window as Window & typeof globalThis).crypto = globalThis.crypto;
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * In-memory cache layer that backs AsyncStorage.
 * Reads hit memory first; writes go to both layers simultaneously.
 * This is particularly important for the PKCE code verifier written by
 * `signInWithOAuth` and read back immediately by `exchangeCodeForSession`.
 */
const memoryCache = new Map<string, string>();

const hybridStorage = {
  /**
   * Retrieve an item — memory first, then AsyncStorage as fallback.
   * @param key - Storage key
   * @returns Stored value or null
   */
  getItem: async (key: string): Promise<string | null> => {
    if (memoryCache.has(key)) {
      return memoryCache.get(key) ?? null;
    }
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      // Warm the memory cache for future reads.
      memoryCache.set(key, value);
    }
    return value;
  },

  /**
   * Store an item in both layers simultaneously.
   * @param key - Storage key
   * @param value - Value to store
   */
  setItem: async (key: string, value: string): Promise<void> => {
    // Write to memory synchronously so it's readable in the same tick.
    memoryCache.set(key, value);
    await AsyncStorage.setItem(key, value);
  },

  /**
   * Remove an item from both layers.
   * @param key - Storage key
   */
  removeItem: async (key: string): Promise<void> => {
    memoryCache.delete(key);
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: hybridStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
