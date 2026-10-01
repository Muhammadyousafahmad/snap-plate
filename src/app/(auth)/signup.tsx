import { useRouter } from 'expo-router';
import { Camera, UserPlus } from 'phosphor-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getAuthErrorMessage,
  getWebEmailRedirectTo,
  isValidEmail,
} from '@/services/auth-errors';
import { hapticLight } from '@/services/haptics';
import { getSupabase } from '@/services/supabase';
import { palette } from '@/theme/tokens';

/**
 * Sign Up — Warm Editorial registration screen.
 */
export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignup(): Promise<void> {
    if (isSubmitting) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setErrorMessage('Enter your email and a password.');
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Your password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const emailRedirectTo = getWebEmailRedirectTo();
      const { data, error } = await getSupabase().auth.signUp({
        email: normalizedEmail,
        password,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Unable to create your account.'));
        return;
      }

      if (data.session) {
        await router.replace('/');
        return;
      }

      if (data.user?.identities?.length === 0) {
        setErrorMessage('An account with this email already exists. Try signing in instead.');
        return;
      }

      setPassword('');
      setSuccessMessage(
        'Account created. Check your email to confirm your account, then return to sign in.',
      );
    } catch (error: unknown) {
      setErrorMessage(
        getAuthErrorMessage(error, 'Unable to create your account. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 24),
          paddingTop: Math.max(insets.top, 24),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Brand Lockup */}
        <View className="mb-8 items-center">
          <View className="h-16 w-16 items-center justify-center rounded-2xl border border-subtle bg-surface-raised">
            <Camera size={32} color={palette.accent} weight="duotone" />
          </View>
          <Text className="mt-4 font-display text-3xl tracking-tight text-warm-primary">
            Create an Account
          </Text>
          <Text className="mt-1 text-center font-sans text-xs text-warm-secondary">
            Save your meal scans securely and track your weekly nutrition
          </Text>
        </View>

        {/* Input Fields */}
        <View className="gap-3.5">
          <View>
            <Text className="mb-1.5 font-sans-medium text-xs uppercase tracking-wider text-warm-tertiary">
              Email Address
            </Text>
            <TextInput
              className="h-15 rounded-inner border border-subtle bg-surface px-4 font-sans text-lg text-warm-primary"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@domain.com"
              placeholderTextColor={palette.textTertiary}
              returnKeyType="next"
              value={email}
            />
          </View>

          <View>
            <Text className="mb-1.5 font-sans-medium text-xs uppercase tracking-wider text-warm-tertiary">
              Password
            </Text>
            <TextInput
              className="h-15 rounded-inner border border-subtle bg-surface px-4 font-sans text-lg text-warm-primary"
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!isSubmitting}
              onChangeText={setPassword}
              onSubmitEditing={() => void handleSignup()}
              placeholder="At least 8 characters"
              placeholderTextColor={palette.textTertiary}
              returnKeyType="done"
              secureTextEntry
              value={password}
            />
          </View>

          {errorMessage ? (
            <View className="rounded-inner border border-danger/30 bg-danger/10 p-3">
              <Text className="font-sans text-xs text-danger leading-5">{errorMessage}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View className="rounded-inner border border-positive/30 bg-positive/10 p-3">
              <Text className="font-sans text-xs text-positive leading-5">{successMessage}</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Go to the SnapPlate sign in page"
                className="mt-2 py-1.5 active:opacity-60"
                hitSlop={10}
                onPress={() => router.replace('/login')}>
                <Text className="font-sans-bold text-xs text-accent">Return to sign in →</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            className="mt-2 h-15 flex-row items-center justify-center gap-2 rounded-inner bg-accent active:bg-accent-light disabled:opacity-50"
            disabled={isSubmitting}
            onPress={() => void handleSignup()}>
            {isSubmitting ? (
              <ActivityIndicator color={palette.accentInk} />
            ) : (
              <>
                <UserPlus size={18} color={palette.accentInk} weight="bold" />
                <Text className="font-sans-bold text-base text-accent-ink">Create Account</Text>
              </>
            )}
          </Pressable>
        </View>

        <View className="mt-8 flex-row items-center justify-center">
          <Text className="font-sans text-xs text-warm-tertiary">Already have an account? </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Sign in to your SnapPlate account"
            className="rounded-lg px-2 py-1.5 active:opacity-60"
            hitSlop={12}
            onPress={() => {
              hapticLight();
              router.replace('/login');
            }}>
            <Text className="font-sans-bold text-xs text-accent">Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
