'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { closeSystemBrowser, isNativePlatform, listenForAppUrlOpen, openSystemBrowser, registerForPushNotifications } from '@/lib/capacitor';
// @capacitor-community/apple-sign-in is dynamically imported in signInWithApple()
// Static imports break CI where the native module can't resolve.

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isReviewer: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInAsReviewer: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isReviewer = user?.email === 'reviewer@bookreview.app';

  useEffect(() => {
    let mounted = true;

    // Add timeout to prevent infinite hang on iOS
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('Auth getSession timed out after 10s, proceeding without session');
        setLoading(false);
      }
    }, 10000);

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeoutId);
        if (!mounted) return;
        if (error) {
          console.error('Error getting session:', error);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
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
      clearTimeout(timeoutId);
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

  // Push notifications disabled — registration code exists but backend is not wired up yet.
  // Re-enable when token storage + FCM/APNS delivery is implemented.
  // useEffect(() => {
  //   if (!isNativePlatform || !user) return;
  //   registerForPushNotifications().catch((error) => {
  //     console.warn('Push notification registration failed:', error);
  //   });
  // }, [user]);

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

  async function signInWithApple() {
    try {
      // @ts-ignore - native-only module, not available in CI web builds
      const { SignInWithApple } = await import(/* webpackIgnore: true */ '@capacitor-community/apple-sign-in');

      const options = {
        clientId: 'com.bookreview.app',
        redirectURI: 'https://bookreview.app',
        scopes: 'email name',
      };

      const result = await SignInWithApple.authorize(options);

      const identityToken = result.response.identityToken;
      if (!identityToken) {
        throw new Error('No identity token returned from Apple');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });

      if (error) {
        console.error('Error signing in with Apple:', error);
        throw error;
      }

      // Apple only sends name on first sign-in — capture it and update the user profile
      const givenName = result.response.givenName;
      const familyName = result.response.familyName;
      if (data?.user && (givenName || familyName)) {
        const fullName = [givenName, familyName].filter(Boolean).join(' ');
        await supabase.auth.updateUser({
          data: { full_name: fullName },
        });
      }
    } catch (error: any) {
      // User cancelled the Apple sign-in sheet
      if (error?.message?.includes('cancel') || error?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      console.error('Error in signInWithApple:', error);
      throw error;
    }
  }

  async function signInAsReviewer() {
    const { error } = await supabase.auth.signInWithPassword({
      email: 'reviewer@bookreview.app',
      password: 'BookLuv!Review2025',
    });
    if (error) {
      console.error('Error signing in as reviewer:', error);
      throw error;
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
    <AuthContext.Provider value={{ user, session, loading, isReviewer, signInWithGoogle, signInWithApple, signInAsReviewer, signOut }}>
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
