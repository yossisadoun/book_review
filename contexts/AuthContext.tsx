'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { closeSystemBrowser, isNativePlatform, listenForAppUrlOpen, openSystemBrowser, registerForPushNotifications } from '@/lib/capacitor';
// @capacitor-community/apple-sign-in is dynamically imported in signInWithApple()
// Static imports break CI where the native module can't resolve.

const PENDING_MIGRATION_KEY = 'pending_guest_migration';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isReviewer: boolean;
  isAnonymous: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInAsReviewer: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  savePendingMigration: () => void;
  linkWithGoogle: () => Promise<void>;
  onLinkError: (callback: (errorCode: string) => void) => () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isReviewer = user?.email === 'reviewer@bookreview.app';
  const isAnonymous = user?.is_anonymous === true;
  const linkErrorCallbacksRef = useRef<Set<(errorCode: string) => void>>(new Set());
  const migrationRunRef = useRef(false);

  const onLinkError = useCallback((callback: (errorCode: string) => void) => {
    linkErrorCallbacksRef.current.add(callback);
    return () => { linkErrorCallbacksRef.current.delete(callback); };
  }, []);

  // Save the current anonymous user ID so we can migrate their books after connecting
  function savePendingMigration() {
    if (user?.is_anonymous && user.id) {
      localStorage.setItem(PENDING_MIGRATION_KEY, JSON.stringify({
        anonymousUserId: user.id,
        timestamp: Date.now(),
      }));
      console.log('🔗 Saved pending migration for anonymous user:', user.id);
    }
  }

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
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Reset migration guard when user signs out or becomes anonymous
      const newUser = session?.user;
      if (!newUser || newUser.is_anonymous) {
        migrationRunRef.current = false;
      }

      // Check for pending guest migration after signing into a real account
      if (newUser && !newUser.is_anonymous && !migrationRunRef.current) {
        const raw = localStorage.getItem(PENDING_MIGRATION_KEY);
        if (raw) {
          migrationRunRef.current = true;
          localStorage.removeItem(PENDING_MIGRATION_KEY);
          try {
            const { anonymousUserId, timestamp } = JSON.parse(raw);
            console.log('🔗 Migration check:', { anonymousUserId, newUserId: newUser.id, ageMs: Date.now() - timestamp });
            // Only migrate if saved within the last 5 minutes and user IDs differ
            if (Date.now() - timestamp < 5 * 60 * 1000 && anonymousUserId !== newUser.id) {
              console.log('🔗 Running pending migration from', anonymousUserId, 'to', newUser.id);
              const { data: migratedCount, error: migrateError } = await supabase.rpc('migrate_anonymous_books', {
                old_user_id: anonymousUserId,
                new_user_id: newUser.id,
              });
              if (migrateError) {
                console.error('🔗 Migration failed:', migrateError);
              } else {
                console.log('🔗 Migrated', migratedCount, 'books');
                if (typeof migratedCount === 'number' && migratedCount > 0) {
                  localStorage.setItem('migrated_books_count', String(migratedCount));
                  window.location.reload();
                }
              }
            }
          } catch (e) {
            console.error('🔗 Migration parse error:', e);
          }
        } else {
          console.log('🔗 No pending migration key found');
        }
      }
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

        // Check for error in query params or hash (e.g. identity_already_exists from linkIdentity)
        const errorCode = parsedUrl.searchParams.get('error_code');
        const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
        const hashErrorCode = hashParams.get('error_code');
        const detectedError = errorCode || hashErrorCode;

        if (detectedError) {
          await closeSystemBrowser();
          linkErrorCallbacksRef.current.forEach(cb => cb(detectedError));
          return;
        }

        const code = parsedUrl.searchParams.get('code');

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          await closeSystemBrowser();
          return;
        }

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
      const { registerPlugin } = await import('@capacitor/core');
      const SignInWithApple = registerPlugin<any>('SignInWithApple');

      const result = await SignInWithApple.authorize({
        clientId: 'com.bookreview.app',
        redirectURI: 'https://bookreview.app',
        scopes: 'email name',
      });

      const identityToken = result.response.identityToken;
      if (!identityToken) {
        throw new Error('No identity token returned from Apple');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });

      if (error) {
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
      console.error('🍎 Apple Sign-In FAILED:', error?.message || error?.code || error?.error || JSON.stringify(error, Object.getOwnPropertyNames(error || {})));
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

  async function signInAnonymously() {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('Error signing in anonymously:', error);
      throw error;
    }
  }

  async function linkWithGoogle() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
    const basePath = isLocalhost || isCapacitor ? '' : (window.location.pathname.split('/').slice(0, 2).join('/') || '');

    const redirectTo = isNativePlatform
      ? 'bookreview://auth/callback'
      : `${window.location.origin}${basePath}/auth/callback`;

    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: isNativePlatform,
      },
    });

    if (error) {
      console.error('Error linking Google identity:', error);
      throw error;
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
    <AuthContext.Provider value={{ user, session, loading, isReviewer, isAnonymous, signInWithGoogle, signInWithApple, signInAsReviewer, signInAnonymously, savePendingMigration, linkWithGoogle, onLinkError, signOut }}>
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
