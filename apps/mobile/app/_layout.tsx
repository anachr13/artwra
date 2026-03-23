import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { setSession } = useAuthStore();

  useEffect(() => {
    // Check initial session and ensure user is synced to backend DB.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Ensure user exists in the backend database (handles SSO users
        // who may not have been synced yet, e.g. after app update).
        const user = session.user;
        const email = user.email ?? '';
        const fullName =
          user.user_metadata?.full_name ?? user.user_metadata?.name ?? email.split('@')[0];
        const username = email
          .split('@')[0]
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .slice(0, 30)
          .padEnd(2, '_');

        try {
          await api.post('/auth/sync', {
            name: fullName,
            username,
            disciplines: ['artist'],
          });
        } catch {
          // Already synced or backend unreachable — continue anyway.
        }

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

    // Deep link fallback: catch OAuth callbacks that arrive as system deep
    // links instead of being captured by WebBrowser.openAuthSessionAsync
    // (e.g. app backgrounded during OAuth, system dialog interruption).
    const handleDeepLink = async (event: { url: string }) => {
      if (!event.url.includes('auth/callback')) return;
      const codeMatch = event.url.match(/[?&]code=([^&]+)/);
      if (!codeMatch) return;
      const code = decodeURIComponent(codeMatch[1]);
      try {
        await supabase.auth.exchangeCodeForSession(code);
        // onAuthStateChange above handles navigation automatically.
      } catch (err) {
        console.warn('[OAuth deep link] exchangeCodeForSession failed:', err);
      }
    };
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); });
    const linkSubscription = Linking.addEventListener('url', handleDeepLink);

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
      linkSubscription.remove();
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
