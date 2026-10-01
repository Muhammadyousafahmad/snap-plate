import type { User } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import {
  CalendarBlank,
  CaretRight,
  ClockCounterClockwise,
  EnvelopeSimple,
  Fingerprint,
  ShieldCheck,
  SignOut,
} from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showAlert } from '@/services/alert';
import { getAuthErrorMessage } from '@/services/auth-errors';
import { hapticLight } from '@/services/haptics';
import { getHistory } from '@/services/history';
import { topInset } from '@/services/layout';
import { getSupabase } from '@/services/supabase';
import { palette } from '@/theme/tokens';

function formatDate(value: string | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
}

function getDisplayName(user: User): string {
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim();
  if (typeof name === 'string' && name.trim()) return name.trim();
  return user.email?.split('@')[0] ?? 'SnapPlate User';
}

/**
 * Profile & Account Settings — Warm Editorial aesthetic.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [{ data, error }, history] = await Promise.all([
        getSupabase().auth.getUser(),
        getHistory(),
      ]);

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Could not load your profile.'));
        return;
      }

      setUser(data.user);
      setScanCount(history.length);
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error, 'Could not load your profile.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function confirmSignOut(): void {
    hapticLight();
    showAlert('Sign out', 'Sign out of SnapPlate on this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => void handleSignOut(),
      },
    ]);
  }

  async function handleSignOut(): Promise<void> {
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Could not sign out. Please try again.'));
        return;
      }
      await router.replace('/login');
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error, 'Could not sign out. Please try again.'));
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingBottom: 32,
          paddingTop: topInset(insets) + 12,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Editorial Header */}
        <View className="pb-4">
          <Text className="font-display text-3xl tracking-tight text-warm-primary">Profile</Text>
          <Text className="mt-0.5 font-sans text-xs text-warm-tertiary">
            Your account and nutrition records
          </Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={palette.accent} size="large" />
          </View>
        ) : (
          <>
            {/* User Hero Surface */}
            <View className="mt-2 items-center rounded-card border border-subtle bg-surface p-6">
              <View className="h-20 w-20 items-center justify-center rounded-full border-2 border-accent bg-surface-raised">
                <Text className="font-display text-3xl text-accent">
                  {user ? getDisplayName(user).charAt(0).toUpperCase() : 'S'}
                </Text>
              </View>

              <Text className="mt-4 font-display text-2xl text-warm-primary">
                {user ? getDisplayName(user) : 'SnapPlate User'}
              </Text>

              <Text className="mt-1 font-sans text-xs text-warm-secondary">
                {user?.email ?? 'No email linked'}
              </Text>

              <View
                className={`mt-3 rounded-pill px-3 py-1 ${
                  user?.email_confirmed_at
                    ? 'bg-positive/15 border border-positive/30'
                    : 'bg-warning/15 border border-warning/30'
                }`}>
                <Text
                  className={`font-sans-bold text-xs ${
                    user?.email_confirmed_at ? 'text-positive' : 'text-warning'
                  }`}>
                  {user?.email_confirmed_at ? 'Email Verified' : 'Confirmation Pending'}
                </Text>
              </View>
            </View>

            {errorMessage ? (
              <View className="mt-4 rounded-inner border border-danger/30 bg-danger/10 p-3.5">
                <Text className="font-sans text-xs text-danger leading-5">{errorMessage}</Text>
                <Pressable className="mt-2" onPress={() => void loadProfile()}>
                  <Text className="font-sans-bold text-xs text-warm-primary">Retry</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Account Details Group */}
            <View className="mt-4 overflow-hidden rounded-card border border-subtle bg-surface">
              <AccountRow
                icon={<EnvelopeSimple size={18} color={palette.textSecondary} weight="duotone" />}
                label="Email"
                value={user?.email ?? 'Not available'}
              />
              <AccountRow
                icon={<CalendarBlank size={18} color={palette.textSecondary} weight="duotone" />}
                label="Member Since"
                value={formatDate(user?.created_at)}
              />
              <AccountRow
                icon={<ShieldCheck size={18} color={palette.textSecondary} weight="duotone" />}
                label="Account Status"
                value={user?.email_confirmed_at ? 'Active & Verified' : 'Verification Email Sent'}
              />
              <AccountRow
                icon={<Fingerprint size={18} color={palette.textSecondary} weight="duotone" />}
                label="Account ID"
                value={user?.id ?? 'Not available'}
                last
              />
            </View>

            {/* History Shortcut */}
            <Pressable
              className="mt-4 flex-row items-center rounded-card border border-subtle bg-surface p-4 active:bg-surface-raised"
              onPress={() => {
                hapticLight();
                router.navigate('/history');
              }}>
              <View className="h-10 w-10 items-center justify-center rounded-inner bg-surface-raised">
                <ClockCounterClockwise size={20} color={palette.accent} weight="duotone" />
              </View>
              <View className="ml-3.5 flex-1">
                <Text className="font-sans-bold text-sm text-warm-primary">Scan History</Text>
                <Text className="mt-0.5 font-sans text-xs text-warm-tertiary">
                  {scanCount} meal{scanCount === 1 ? '' : 's'} recorded
                </Text>
              </View>
              <CaretRight size={16} color={palette.textTertiary} weight="bold" />
            </Pressable>

            {/* Sign Out CTA */}
            <Pressable
              accessibilityRole="button"
              className="mt-8 h-15 flex-row items-center justify-center gap-2 rounded-inner border border-danger/30 bg-danger/10 active:bg-danger/20 disabled:opacity-50"
              disabled={isSigningOut}
              onPress={confirmSignOut}>
              {isSigningOut ? (
                <ActivityIndicator color={palette.danger} />
              ) : (
                <>
                  <SignOut size={18} color={palette.danger} weight="bold" />
                  <Text className="font-sans-bold text-sm text-danger">Sign Out</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function AccountRow(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center p-4 ${
        props.last ? '' : 'border-b border-subtle'
      }`}>
      <View className="h-9 w-9 items-center justify-center rounded-inner bg-surface-sunken">
        {props.icon}
      </View>
      <View className="ml-3.5 flex-1">
        <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-warm-tertiary">
          {props.label}
        </Text>
        <Text
          className="mt-0.5 font-sans text-xs text-warm-primary"
          numberOfLines={props.label === 'Account ID' ? 1 : undefined}>
          {props.value}
        </Text>
      </View>
    </View>
  );
}
