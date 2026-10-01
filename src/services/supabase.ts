import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

let client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client, creating it on first browser/runtime use.
 * Keeping initialization lazy prevents Expo Router's server-side web render from
 * loading Supabase Auth in Node, where browser globals such as `window` do not exist.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.',
    );
  }

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
      persistSession: true,
    },
  });

  return client;
}

