import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setSession } = useAuthStore();

  const handleLogin = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.session) {
        setSession(data.session, null);
        router.replace('/(tabs)/gallery');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        'Email required',
        'Please enter your email address first, then tap Forgot Password.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
      );
      if (resetError) {
        Alert.alert('Error', resetError.message);
      } else {
        Alert.alert(
          'Check your inbox',
          `We sent a password reset link to ${email.trim()}.`
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#1a1207' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          {/* Wordmark */}
          <View style={{ marginBottom: 48 }}>
            <Text
              style={{
                fontSize: 36,
                fontWeight: '700',
                color: '#d4922a',
                letterSpacing: 1,
              }}
            >
              Artwra
            </Text>
            <Text style={{ fontSize: 15, color: 'rgba(245,237,216,0.6)', marginTop: 4 }}>
              Your creative work lives here
            </Text>
          </View>

          {/* Error message */}
          {error && (
            <View
              style={{
                backgroundColor: 'rgba(192,97,74,0.15)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: 'rgba(192,97,74,0.4)',
              }}
            >
              <Text style={{ color: '#c0614a', fontSize: 14 }}>{error}</Text>
            </View>
          )}

          {/* Email input */}
          <View style={{ marginBottom: 12 }}>
            <Text
              style={{
                fontSize: 13,
                color: 'rgba(245,237,216,0.6)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="rgba(245,237,216,0.3)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={{
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: '#f5edd8',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            />
          </View>

          {/* Password input */}
          <View style={{ marginBottom: 8 }}>
            <Text
              style={{
                fontSize: 13,
                color: 'rgba(245,237,216,0.6)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="rgba(245,237,216,0.3)"
              secureTextEntry
              autoComplete="password"
              style={{
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: '#f5edd8',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            />
          </View>

          {/* Forgot password */}
          <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginBottom: 24 }}>
            <Text style={{ color: '#d4922a', fontSize: 14 }}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? 'rgba(212,146,42,0.5)' : '#d4922a',
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                color: '#1a1207',
                fontSize: 17,
                fontWeight: '700',
                letterSpacing: 0.3,
              }}
            >
              {isLoading ? 'Logging in…' : 'Log in'}
            </Text>
          </TouchableOpacity>

          {/* Sign up link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(245,237,216,0.5)', fontSize: 15 }}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/signup')}>
              <Text style={{ color: '#d4922a', fontSize: 15, fontWeight: '600' }}>
                Create one
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
