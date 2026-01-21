// Supabase client for mobile app

import { createSupabaseClient } from '@book-review/core';
import Constants from 'expo-constants';

// Get Supabase credentials from environment variables
// For Expo, environment variables with EXPO_PUBLIC_ prefix are automatically available
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Supabase credentials not found!');
  console.error('');
  console.error('Please create a .env file in mobile_app/ directory with:');
  console.error('  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.error('  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
  console.error('');
  console.error('See env.example for reference.');
  console.error('');
  console.error('After creating .env, restart Expo with: npx expo start --clear');
}

// Validate that we have both values before creating client
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Please create a .env file with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
