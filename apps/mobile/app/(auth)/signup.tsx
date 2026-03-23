/**
 * @file signup.tsx
 * @author Artwra
 * @description Sign Up screen — SSO-first (Apple and Google via Supabase OAuth).
 * An "or sign up with email" fallback collects name, username, email, password,
 * and artistic disciplines for users who prefer not to use SSO.
 *
 * CHR-88: General error banner + per-field inline validation errors.
 * CHR-89: Accessibility labels, roles, states, and minimum 44×44pt touch targets.
 *         Error regions announced live via accessibilityLiveRegion.
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
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { z } from 'zod';
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

/** Artistic disciplines the artist can identify with. */
const DISCIPLINES = [
  'Painter',
  'Sculptor',
  'Photographer',
  'Ceramics',
  'Printmaker',
  'Illustrator',
  'Other',
];

/** Zod schema for email/password signup validation. */
const SignupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  disciplines: z.array(z.string()).min(1, 'Select at least one discipline'),
});

export default function SignupScreen() {
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Email form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSSOLoading, setIsSSOLoading] = useState<'apple' | 'google' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { setSession } = useAuthStore();

  /**
   * Toggle selection of a discipline pill.
   * @param d - The discipline string to toggle
   */
  const toggleDiscipline = (d: string) => {
    setSelectedDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  /** Sign up with Apple using the native credential sheet, then set the Supabase session. */
  const handleAppleSignUp = async () => {
    setErrors({});
    setIsSSOLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        setErrors({ general: 'Apple sign-up failed. Please try again.' });
        return;
      }

      const { data, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (authError) {
        setErrors({ general: authError.message });
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
      // User cancelled — not an error.
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      setErrors({ general: 'Apple sign-up failed. Please try again.' });
    } finally {
      setIsSSOLoading(null);
    }
  };

  /**
   * Sign up with Google via Supabase OAuth.
   * Opens Google's consent page in an in-app browser, then exchanges the
   * returned code for a Supabase session via deep-link redirect.
   */
  const handleGoogleSignUp = async () => {
    setErrors({});
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
        setErrors({ general: oauthError?.message ?? 'Google sign-up failed. Please try again.' });
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

      if (result.type === 'success' && result.url) {
        // Extract the auth code from the callback URL using a regex — avoids
        // custom-scheme parsing issues with `new URL('artwra://...')`.
        const codeMatch = result.url.match(/[?&]code=([^&]+)/);
        const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;

        if (!code) {
          setErrors({ general: 'Google sign-up failed: no auth code received. Please try again.' });
          return;
        }

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setErrors({ general: exchangeError.message });
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
            // User may already be synced — safe to ignore.
          }

          setSession(sessionData.session, null);
          router.replace('/(tabs)/gallery');
        }
      }
    } catch {
      setErrors({ general: 'Google sign-up failed. Please try again.' });
    } finally {
      setIsSSOLoading(null);
    }
  };

  /**
   * Validate the email form, create the Supabase account, sync to the backend,
   * and navigate to the gallery.
   */
  const handleEmailSignup = async () => {
    setErrors({});

    const validation = SignupSchema.safeParse({
      name,
      username,
      email: email.trim().toLowerCase(),
      password,
      disciplines: selectedDisciplines,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((e) => {
        const field = e.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signupError) {
        setErrors({ general: signupError.message });
        return;
      }

      if (!authData.session) {
        setErrors({ general: 'Account created — please check your email to verify.' });
        return;
      }

      // Sync user profile to the backend DB
      const syncResponse = await api.post('/auth/sync', {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        disciplines: selectedDisciplines.map((d) => d.toLowerCase()),
      });

      setSession(authData.session, syncResponse.data.data);
      router.replace('/(tabs)/gallery');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setErrors({ general: message });
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
        <View style={{ flex: 1, padding: 24 }}>
          <View style={{ marginTop: 60, marginBottom: 36 }}>
            <Text
              style={{ fontSize: 28, fontWeight: '700', color: '#d4922a' }}
              accessibilityRole="header"
            >
              Create your account
            </Text>
            <Text style={{ fontSize: 15, color: 'rgba(245,237,216,0.5)', marginTop: 6 }}>
              Start documenting your creative journey
            </Text>
          </View>

          {/* General error banner — announced live */}
          {errors.general && (
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
              accessibilityLabel={`Error: ${errors.general}`}
            >
              <Text style={{ color: '#c0614a', fontSize: 14 }}>{errors.general}</Text>
            </View>
          )}

          {/* Apple Sign Up — native button */}
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={14}
            style={{ height: 52, marginBottom: 12 }}
            onPress={handleAppleSignUp}
          />

          {/* Google Sign Up */}
          <TouchableOpacity
            onPress={handleGoogleSignUp}
            disabled={anyLoading}
            accessibilityLabel={
              isSSOLoading === 'google'
                ? 'Signing up with Google, please wait'
                : 'Sign up with Google'
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
              marginBottom: 28,
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
                  Sign up with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider + email toggle */}
          <TouchableOpacity
            onPress={() => setShowEmailForm((v) => !v)}
            accessibilityLabel={showEmailForm ? 'Hide email sign up form' : 'Sign up with email instead'}
            accessibilityRole="button"
            style={{ marginBottom: 20 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <Text
                style={{ color: '#d4922a', fontSize: 13, marginHorizontal: 12, fontWeight: '500' }}
              >
                {showEmailForm ? 'hide email form ↑' : 'or sign up with email ↓'}
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            </View>
          </TouchableOpacity>

          {/* Collapsible email form */}
          {showEmailForm && (
            <View>
              {/* Full name */}
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}
                  accessibilityElementsHidden
                >
                  Full name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor="rgba(245,237,216,0.3)"
                  autoCapitalize="words"
                  accessibilityLabel="Full name"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: '#f5edd8',
                    borderWidth: 1,
                    borderColor: errors.name ? '#c0614a' : 'rgba(255,255,255,0.1)',
                  }}
                />
                {errors.name && (
                  <Text style={{ color: '#c0614a', fontSize: 12, marginTop: 4 }} accessibilityLiveRegion="polite">
                    {errors.name}
                  </Text>
                )}
              </View>

              {/* Username */}
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}
                  accessibilityElementsHidden
                >
                  Username
                </Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="your_username"
                  placeholderTextColor="rgba(245,237,216,0.3)"
                  autoCapitalize="none"
                  accessibilityLabel="Username"
                  accessibilityHint="Letters, numbers, and underscores only"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: '#f5edd8',
                    borderWidth: 1,
                    borderColor: errors.username ? '#c0614a' : 'rgba(255,255,255,0.1)',
                  }}
                />
                {errors.username && (
                  <Text style={{ color: '#c0614a', fontSize: 12, marginTop: 4 }} accessibilityLiveRegion="polite">
                    {errors.username}
                  </Text>
                )}
              </View>

              {/* Email */}
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}
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
                    borderColor: errors.email ? '#c0614a' : 'rgba(255,255,255,0.1)',
                  }}
                />
                {errors.email && (
                  <Text style={{ color: '#c0614a', fontSize: 12, marginTop: 4 }} accessibilityLiveRegion="polite">
                    {errors.email}
                  </Text>
                )}
              </View>

              {/* Password */}
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}
                  accessibilityElementsHidden
                >
                  Password
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor="rgba(245,237,216,0.3)"
                  secureTextEntry
                  accessibilityLabel="Password"
                  accessibilityHint="Must be at least 8 characters"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: '#f5edd8',
                    borderWidth: 1,
                    borderColor: errors.password ? '#c0614a' : 'rgba(255,255,255,0.1)',
                  }}
                />
                {errors.password && (
                  <Text style={{ color: '#c0614a', fontSize: 12, marginTop: 4 }} accessibilityLiveRegion="polite">
                    {errors.password}
                  </Text>
                )}
              </View>

              {/* Discipline picker */}
              <View style={{ marginBottom: 28 }}>
                <Text
                  style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}
                  accessibilityElementsHidden
                >
                  I work as a…
                </Text>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                  accessibilityLabel="Artistic disciplines — select all that apply"
                >
                  {DISCIPLINES.map((d) => {
                    const selected = selectedDisciplines.includes(d);
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => toggleDiscipline(d)}
                        accessibilityLabel={d}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 20,
                          backgroundColor: selected ? '#d4922a' : 'rgba(255,255,255,0.08)',
                          borderWidth: 1,
                          borderColor: selected ? '#d4922a' : 'rgba(255,255,255,0.15)',
                          minHeight: 44,
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            color: selected ? '#1a1207' : 'rgba(245,237,216,0.7)',
                            fontWeight: selected ? '600' : '400',
                          }}
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.disciplines && (
                  <Text style={{ color: '#c0614a', fontSize: 12, marginTop: 8 }} accessibilityLiveRegion="polite">
                    {errors.disciplines}
                  </Text>
                )}
              </View>

              {/* Create account button */}
              <TouchableOpacity
                onPress={handleEmailSignup}
                disabled={anyLoading}
                accessibilityLabel={isLoading ? 'Creating account, please wait' : 'Create account'}
                accessibilityRole="button"
                accessibilityState={{ disabled: anyLoading, busy: isLoading }}
                style={{
                  backgroundColor: anyLoading ? 'rgba(212,146,42,0.5)' : '#d4922a',
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                  marginBottom: 20,
                  minHeight: 52,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#1a1207', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 }}>
                  {isLoading ? 'Creating account…' : 'Create account'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Login link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', paddingBottom: 32 }}>
            <Text style={{ color: 'rgba(245,237,216,0.5)', fontSize: 15 }}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              accessibilityLabel="Log in"
              accessibilityRole="button"
              style={{ paddingVertical: 4, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: '#d4922a', fontSize: 15, fontWeight: '600' }}>
                Log in
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
