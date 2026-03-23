/**
 * @file login.tsx
 * @author Artwra
 * @description Login screen — SSO via Apple and Google (Supabase OAuth).
 * Falls back to email/password for users without SSO providers.
 *
 * CHR-88: Inline error state with clear message text.
 * CHR-89: Accessibility labels, roles, and hints on all interactive elements.
 *         Minimum 44×44pt touch targets on all buttons. Error region
 *         announced live via accessibilityLiveRegion.
 */

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
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

/** Ensure the in-app browser session closes cleanly after OAuth redirect. */
WebBrowser.maybeCompleteAuthSession();

/** Redirect URI registered with Supabase OAuth providers. */
const REDIRECT_URI = makeRedirectUri({ scheme: 'artwra', path: 'auth/callback' });

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSSOLoading, setIsSSOLoading] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setSession } = useAuthStore();

  /** Sign in with Apple using the native credential sheet, then set the Supabase session. */
  const handleAppleSignIn = async () => {
    setError(null);
    setIsSSOLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        setError('Apple sign-in failed. Please try again.');
        return;
      }

      const { data, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.session) {
        // Sync user to backend DB — extracts profile from Apple metadata.
        const user = data.session.user;
        const email = user.email ?? '';
        const fullName =
          credential.fullName?.givenName
            ? `${credential.fullName.givenName} ${credential.fullName.familyName ?? ''}`.trim()
            : user.user_metadata?.full_name ?? email.split('@')[0];
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
          // User may already be synced — safe to ignore.
        }

        setSession(data.session, null);
        router.replace('/(tabs)/gallery');
      }
    } catch (err: unknown) {
      // User cancelled the Apple sign-in sheet — not an error.
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      setError('Apple sign-in failed. Please try again.');
    } finally {
      setIsSSOLoading(null);
    }
  };

  /**
   * Sign in with Google via Supabase OAuth.
   * Opens the Google consent page in an in-app browser, then exchanges the
   * returned auth code for a Supabase session via deep-link redirect.
   */
  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSSOLoading('google');
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URI,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError || !data.url) {
        setError(oauthError?.message ?? 'Google sign-in failed. Please try again.');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

      if (result.type === 'success' && result.url) {
        // Extract the auth code from the callback URL using a regex — avoids
        // custom-scheme parsing issues with `new URL('artwra://...')`.
        const codeMatch = result.url.match(/[?&]code=([^&]+)/);
        const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;

        if (!code) {
          setError('Google sign-in failed: no auth code received. Please try again.');
          return;
        }

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          // Sync user to backend DB — extracts profile from Google metadata.
          const user = sessionData.session.user;
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
            // User may already be synced from a previous login — safe to ignore.
          }

          setSession(sessionData.session, null);
          router.replace('/(tabs)/gallery');
        }
      }
    } catch {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setIsSSOLoading(null);
    }
  };

  /** Validate inputs, then sign in via Supabase email/password. */
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

  /**
   * Send a password reset email.
   * Requires the email field to be populated first.
   */
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
        Alert.alert('Check your inbox', `We sent a password reset link to ${email.trim()}.`);
      }
    } catch {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const anyLoading = isLoading || isSSOLoading !== null;

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
              style={{ fontSize: 36, fontWeight: '700', color: '#d4922a', letterSpacing: 1 }}
              accessibilityRole="header"
            >
              Artwra
            </Text>
            <Text style={{ fontSize: 15, color: 'rgba(245,237,216,0.6)', marginTop: 4 }}>
              Your creative work lives here
            </Text>
          </View>

          {/* Error message — announced live to screen readers */}
          {error && (
            <View
              style={{
                backgroundColor: 'rgba(192,97,74,0.15)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: 'rgba(192,97,74,0.4)',
              }}
              accessibilityLiveRegion="assertive"
              accessibilityLabel={`Error: ${error}`}
            >
              <Text style={{ color: '#c0614a', fontSize: 14 }}>{error}</Text>
            </View>
          )}

          {/* Apple Sign In — native button provided by expo-apple-authentication */}
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={14}
            style={{ height: 52, marginBottom: 12 }}
            onPress={handleAppleSignIn}
          />

          {/* Google Sign In */}
          <TouchableOpacity
            onPress={handleGoogleSignIn}
            disabled={anyLoading}
            accessibilityLabel={
              isSSOLoading === 'google' ? 'Signing in with Google, please wait' : 'Sign in with Google'
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: anyLoading, busy: isSSOLoading === 'google' }}
            style={{
              height: 52,
              borderRadius: 14,
              backgroundColor: '#ffffff',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 32,
              gap: 10,
              opacity: anyLoading ? 0.6 : 1,
            }}
            activeOpacity={0.85}
          >
            {isSSOLoading === 'google' ? (
              <ActivityIndicator color="#333" />
            ) : (
              <>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#4285F4' }}>G</Text>
                <Text style={{ color: '#333333', fontSize: 16, fontWeight: '600' }}>
                  Sign in with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}
            accessibilityElementsHidden
          >
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <Text style={{ color: 'rgba(245,237,216,0.35)', fontSize: 13, marginHorizontal: 12 }}>
              or sign in with email
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          </View>

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
              accessibilityElementsHidden
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
              accessibilityLabel="Email address"
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
              accessibilityElementsHidden
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
              accessibilityLabel="Password"
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
          <TouchableOpacity
            onPress={handleForgotPassword}
            accessibilityLabel="Forgot password"
            accessibilityRole="button"
            accessibilityHint="Sends a password reset link to your email address"
            style={{
              alignSelf: 'flex-end',
              marginBottom: 20,
              paddingVertical: 8,
              paddingHorizontal: 4,
              minHeight: 44,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#d4922a', fontSize: 14 }}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Log in button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={anyLoading}
            accessibilityLabel={isLoading ? 'Logging in, please wait' : 'Log in'}
            accessibilityRole="button"
            accessibilityState={{ disabled: anyLoading, busy: isLoading }}
            style={{
              backgroundColor: anyLoading ? 'rgba(212,146,42,0.5)' : '#d4922a',
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              marginBottom: 24,
              minHeight: 52,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#1a1207', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 }}>
              {isLoading ? 'Logging in…' : 'Log in'}
            </Text>
          </TouchableOpacity>

          {/* Sign up link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(245,237,216,0.5)', fontSize: 15 }}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/signup')}
              accessibilityLabel="Create account"
              accessibilityRole="button"
              style={{ paddingVertical: 4, minHeight: 44, justifyContent: 'center' }}
            >
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
