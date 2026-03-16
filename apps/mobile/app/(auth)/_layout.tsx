import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout() {
  const { session } = useAuthStore();

  useEffect(() => {
    if (session) {
      router.replace('/(tabs)/gallery');
    }
  }, [session]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#1a1207' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
