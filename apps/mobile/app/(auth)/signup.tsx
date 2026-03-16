import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const DISCIPLINES = [
  'Painter',
  'Sculptor',
  'Photographer',
  'Ceramics',
  'Printmaker',
  'Illustrator',
  'Other',
];

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
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { setSession } = useAuthStore();

  const toggleDiscipline = (d: string) => {
    setSelectedDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleSignup = async () => {
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

      // Sync user to DB
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
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#d4922a' }}>
              Create your account
            </Text>
            <Text style={{ fontSize: 15, color: 'rgba(245,237,216,0.5)', marginTop: 6 }}>
              Start documenting your creative journey
            </Text>
          </View>

          {/* General error */}
          {errors.general && (
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
              <Text style={{ color: '#c0614a', fontSize: 14 }}>{errors.general}</Text>
            </View>
          )}

          {/* Name */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Full name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="rgba(245,237,216,0.3)"
              autoCapitalize="words"
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
              <Text style={{ color: '#c0614a', fontSize: 12, marginTop: 4 }}>{errors.name}</Text>
            )}
          </View>

          {/* Username */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Username
            </Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="your_username"
              placeholderTextColor="rgba(245,237,216,0.3)"
              autoCapitalize="none"
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
              <Text style={{ color: '#c0614a', fontSize: 12, marginTop: 4 }}>{errors.username}</Text>
            )}
          </View>

          {/* Email */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
                borderColor: errors.email ? '#c0614a' : 'rgba(255,255,255,0.1)',
              }}
            />
            {errors.email && (
              <Text style={{ color: '#c0614a', fontSize: 12, marginTop: 4 }}>{errors.email}</Text>
            )}
          </View>

          {/* Password */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor="rgba(245,237,216,0.3)"
              secureTextEntry
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
              <Text style={{ color: '#c0614a', fontSize: 12, marginTop: 4 }}>{errors.password}</Text>
            )}
          </View>

          {/* Disciplines */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              I work as a…
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DISCIPLINES.map((d) => {
                const selected = selectedDisciplines.includes(d);
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => toggleDiscipline(d)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: selected ? '#d4922a' : 'rgba(255,255,255,0.08)',
                      borderWidth: 1,
                      borderColor: selected ? '#d4922a' : 'rgba(255,255,255,0.15)',
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
              <Text style={{ color: '#c0614a', fontSize: 12, marginTop: 8 }}>{errors.disciplines}</Text>
            )}
          </View>

          {/* Create account button */}
          <TouchableOpacity
            onPress={handleSignup}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? 'rgba(212,146,42,0.5)' : '#d4922a',
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <Text style={{ color: '#1a1207', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 }}>
              {isLoading ? 'Creating account…' : 'Create account'}
            </Text>
          </TouchableOpacity>

          {/* Login link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', paddingBottom: 32 }}>
            <Text style={{ color: 'rgba(245,237,216,0.5)', fontSize: 15 }}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
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
