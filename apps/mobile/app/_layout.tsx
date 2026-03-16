import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { setSession } = useAuthStore();

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session, useAuthStore.getState().user);
        router.replace('/(tabs)/gallery');
      } else {
        router.replace('/(auth)/login');
      }
      SplashScreen.hideAsync();
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setSession(session, useAuthStore.getState().user);
          router.replace('/(tabs)/gallery');
        } else {
          setSession(null, null);
          router.replace('/(auth)/login');
        }
      }
    );

    // Listen for app state changes (background detection)
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background') {
          const store = useSessionStore.getState();
          if (store.startedAt && store.isDraft && !store.isPaused) {
            store.pauseSession();
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, [setSession]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="session/start" />
      <Stack.Screen name="session/active" />
      <Stack.Screen name="session/checkout" />
      <Stack.Screen
        name="project/create"
        options={{ presentation: 'modal' }}
      />
    </Stack>
  );
}
