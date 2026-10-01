import '@/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { DarkTheme, Redirect, Stack, ThemeProvider, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BrandSplash } from '@/components/brand/BrandSplash';
import { captureWebAuthCallbackError } from '@/services/auth-errors';
import { holdNativeSplash } from '@/services/splash';
import { getSupabase } from '@/services/supabase';
import { useNutritionStore } from '@/store/nutrition-store';
import { useAppFonts } from '@/theme/fonts';
import { palette } from '@/theme/tokens';

// Hold the OS splash until the animated splash has painted its first frame, so
// the two boot screens read as one continuous sequence. Must run in module
// scope: calling it from inside a component can be too late on Android.
holdNativeSplash();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

/**
 * On web the app is presented in a phone-width (430pt) column centred in the
 * viewport so the layout matches iOS instead of stretching across a desktop
 * window. Native keeps the usual full-screen flex layout.
 */
const shellStyle: StyleProp<ViewStyle> =
  Platform.OS === 'web'
    ? {
        flex: 1,
        width: '100%',
        maxWidth: 430,
        alignSelf: 'center',
        marginLeft: 'auto',
        marginRight: 'auto',
        backgroundColor: palette.canvas,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: palette.border,
      }
    : { flex: 1 };

/**
 * Platform-native page transitions: a slide from the right on iOS and a fade-up
 * on Android. Both are what the platform's own apps do, so the app inherits the
 * system feel instead of imposing a custom one.
 */
const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: palette.canvas },
  animation: (Platform.OS === 'android' ? 'fade_from_bottom' : 'default') as 'fade_from_bottom' | 'default',
};

export default function RootLayout() {
  const fontsLoaded = useAppFonts();
  const hydrateResult = useNutritionStore((state) => state.hydrateResult);
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const inAuthGroup = segments[0] === '(auth)';

  const handleSplashRevealed = useCallback(() => setIsSplashVisible(false), []);

  useEffect(() => {
    void hydrateResult();
  }, [hydrateResult, session?.user.id]);


  useEffect(() => {
    let isMounted = true;
    captureWebAuthCallbackError();
    const supabase = getSupabase();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setIsAuthLoading(false);
    });

    void supabase.auth
      .getSession()
      .then(({ data: currentSession, error }) => {
        if (!isMounted) return;
        if (error) console.warn('Could not restore the Supabase session.', error.message);
        setSession(currentSession.session);
        setIsAuthLoading(false);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        console.warn('Could not restore the Supabase session.', error);
        setIsAuthLoading(false);
      });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const isReady = !isAuthLoading && fontsLoaded;
  const needsRedirect = (!session && !inAuthGroup) || (session && inAuthGroup);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={DarkTheme}>
        {/* Gesture handler needs a root view above every swipeable in the app. */}
        <GestureHandlerRootView style={styles.root}>
          <StatusBar style="light" />
          <View style={shellStyle}>
            {/*
             * The navigator mounts while the splash is still covering the screen:
             * the dashboard fetches behind the animation, so the first frame the
             * user actually sees already has their numbers in it.
             */}
            {!isReady ? null : needsRedirect ? (
              <Redirect href={session ? '/' : '/login'} />
            ) : (
              <Stack screenOptions={stackScreenOptions} />
            )}

            {isSplashVisible ? (
              <BrandSplash canReveal={isReady} onRevealed={handleSplashRevealed} />
            ) : null}
          </View>
        </GestureHandlerRootView>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});