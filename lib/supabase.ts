import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Provide dummy values during build if credentials are missing (for static export)
// These will be replaced at runtime with actual values from environment
const buildSafeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const buildSafeKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window === 'undefined') {
    // Only log during build/server-side
    console.warn('⚠️ Supabase credentials not found during build. Using placeholder values.');
  }
}

export const supabase = createClient(buildSafeUrl, buildSafeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
