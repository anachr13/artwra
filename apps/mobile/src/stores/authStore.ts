import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface SecureStoreAdapter {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
}

const secureStoreAdapter: SecureStoreAdapter = {
  getItem: async (name: string) => {
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string) => {
    // SecureStore has a 2048 byte limit per key. For larger data, chunk or use AsyncStorage.
    // For session data, this should be fine.
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  setSession: (session: Session | null, user: UserProfile | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isLoading: false,

      setSession: (session, user) => {
        set({ session, user, isLoading: false });
      },

      signOut: async () => {
        set({ isLoading: true });
        await supabase.auth.signOut();
        set({ user: null, session: null, isLoading: false });
      },
    }),
    {
      name: 'artwra-auth',
      storage: createJSONStorage(() => secureStoreAdapter),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
      }),
    }
  )
);
