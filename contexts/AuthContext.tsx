'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { closeSystemBrowser, isNativePlatform, listenForAppUrlOpen, openSystemBrowser, registerForPushNotifications } from '@/lib/capacitor';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return;
        if (error) {
          console.error('Error getting session:', error);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error('Error getting session:', error);
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = listenForAppUrlOpen(async (url) => {
      if (!url || !url.includes('auth/callback')) return;
      try {
        const parsedUrl = new URL(url);
        const code = parsedUrl.searchParams.get('code');

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          await closeSystemBrowser();
          return;
        }

        const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          await closeSystemBrowser();
        }
      } catch (error) {
        console.error('Error handling auth callback:', error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isNativePlatform || !user) return;
    registerForPushNotifications().catch((error) => {
      console.warn('Push notification registration failed:', error);
    });
  }, [user]);

  async function signInWithGoogle() {
    // Calculate base path: empty for localhost, /book_review for GitHub Pages
    // Check if we're on localhost
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
    const basePath = isLocalhost || isCapacitor ? '' : (window.location.pathname.split('/').slice(0, 2).join('/') || '');

    const redirectTo = isNativePlatform
      ? 'bookreview://auth/callback'
      : `${window.location.origin}${basePath}/auth/callback`;
    
    console.log('🔐 OAuth Sign-In Details:');
    console.log('  Current origin:', window.location.origin);
    console.log('  Is localhost:', isLocalhost);
    console.log('  Base path:', basePath);
    console.log('  Redirect URL:', redirectTo);
    console.log('  ⚠️  Make sure this URL is added to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs');
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: isNativePlatform,
      },
    });

    if (error) {
      console.error('Error starting OAuth:', error);
      return;
    }

    if (isNativePlatform && data?.url) {
      await openSystemBrowser(data.url);
    }
  }

  async function signOut() {
    try {
      // Try local signout first (signs out from this device only)
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('Error signing out:', error);
        // If local signout fails, try without scope (defaults to local)
        await supabase.auth.signOut();
      }
      // Clear local state
      setUser(null);
      setSession(null);
    } catch (err) {
      console.error('Sign out error:', err);
      // Clear local state even if API call fails
      setUser(null);
      setSession(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
