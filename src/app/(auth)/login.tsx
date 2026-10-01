import { useRouter } from 'expo-router';
import { Camera, SignIn } from 'phosphor-react-native';
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
  captureWebAuthCallbackError,
  consumeWebAuthCallbackError,
  getAuthErrorMessage,
  getWebEmailRedirectTo,
  isValidEmail,
} from '@/services/auth-errors';
import { hapticLight } from '@/services/haptics';
import { getSupabase } from '@/services/supabase';
import { palette } from '@/theme/tokens';

/**
 * Sign In — Warm Editorial auth interface.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    captureWebAuthCallbackError();
    return consumeWebAuthCallbackError();
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canResendConfirmation =
    errorMessage?.toLowerCase().includes('confirm') ?? false;

  async function handleLogin(): Promise<void> {
    if (isSubmitting) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await getSupabase().auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Unable to sign in. Please try again.'));
        return;
      }

      await router.replace('/');
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error, 'Unable to sign in. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendConfirmation(): Promise<void> {
    if (isResending) return;

    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('Enter the email address used to create your account.');
      return;
    }

    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const emailRedirectTo = getWebEmailRedirectTo();
      const { error } = await getSupabase().auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });

      if (error) {
        setErrorMessage(
          getAuthErrorMessage(error, 'Could not resend the confirmation email.'),
        );
        return;
      }

      setSuccessMessage('A new confirmation email has been sent. Check your inbox.');
    } catch (error: unknown) {
      setErrorMessage(
        getAuthErrorMessage(error, 'Could not resend the confirmation email. Please try again.'),
      );
    } finally {
      setIsResending(false);
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
            Welcome back
          </Text>
          <Text className="mt-1 text-center font-sans text-xs text-warm-secondary">
            Sign in to sync your meal journal across devices
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
              autoComplete="password"
              editable={!isSubmitting}
              onChangeText={setPassword}
              onSubmitEditing={() => void handleLogin()}
              placeholder="Your password"
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
            </View>
          ) : null}

          {canResendConfirmation ? (
            <Pressable
              accessibilityRole="button"
              className="h-13 items-center justify-center rounded-inner border border-accent/40 bg-accent/10 active:bg-accent/20 disabled:opacity-50"
              disabled={isResending}
              onPress={() => void handleResendConfirmation()}>
              {isResending ? (
                <ActivityIndicator color={palette.accent} />
              ) : (
                <Text className="font-sans-bold text-xs text-accent">
                  Resend confirmation email
                </Text>
              )}
            </Pressable>
          ) : null}

          <Pressable
            className="mt-2 h-15 flex-row items-center justify-center gap-2 rounded-inner bg-accent active:bg-accent-light disabled:opacity-50"
            disabled={isSubmitting}
            onPress={() => void handleLogin()}>
            {isSubmitting ? (
              <ActivityIndicator color={palette.accentInk} />
            ) : (
              <>
                <SignIn size={18} color={palette.accentInk} weight="bold" />
                <Text className="font-sans-bold text-base text-accent-ink">Sign In</Text>
              </>
            )}
          </Pressable>
        </View>

        <View className="mt-8 flex-row items-center justify-center">
          <Text className="font-sans text-xs text-warm-tertiary">New to SnapPlate? </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Create a new SnapPlate account"
            className="rounded-lg px-2 py-1.5 active:opacity-60"
            hitSlop={12}
            onPress={() => {
              hapticLight();
              router.push('/signup');
            }}>
            <Text className="font-sans-bold text-xs text-accent">Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
