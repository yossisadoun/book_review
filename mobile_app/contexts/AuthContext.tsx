// Auth context for mobile app

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

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
    supabase.auth
      .getSession()
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

  async function signInWithGoogle() {
    try {
      // Use the app's deep link scheme for mobile OAuth callback
      // Force the custom scheme instead of exp:// for Expo Go
      // This will be: bookreview://auth/callback
      const scheme = 'bookreview';
      const redirectTo = `${scheme}://auth/callback`;
      
      console.log('🔐 Mobile OAuth Sign-In:');
      console.log('  Redirect URL:', redirectTo);
      console.log('  ⚠️  Make sure this URL is added to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // IMPORTANT: Skip browser redirect so we can handle it with WebBrowser
          // This prevents Supabase from redirecting to web URLs
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('Error signing in:', error);
        throw error;
      }

      if (data.url) {
        console.log('🔐 Opening OAuth URL:', data.url);
        console.log('🔐 Expected redirect to:', redirectTo);
        
        // Open OAuth flow in a browser that can redirect back to our app
        // The redirectTo parameter tells the browser where to redirect after auth
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        
        console.log('🔐 OAuth result type:', result.type);
        if (result.type === 'success') {
          console.log('🔐 OAuth callback URL:', result.url);
        }
        
        if (result.type === 'success') {
          // Parse the callback URL
          const url = result.url;
          
          // Supabase OAuth callback includes tokens in the URL
          // Format can be: bookreview://auth/callback#access_token=...&refresh_token=...
          // or: bookreview://auth/callback?access_token=...&refresh_token=...
          
          let accessToken: string | null = null;
          let refreshToken: string | null = null;
          
          // Parse URL manually to extract hash or query params
          const hashIndex = url.indexOf('#');
          const queryIndex = url.indexOf('?');
          
          // Try hash first (OAuth typically uses hash)
          if (hashIndex !== -1) {
            const hashString = url.substring(hashIndex + 1);
            const hashParams = new URLSearchParams(hashString);
            accessToken = hashParams.get('access_token');
            refreshToken = hashParams.get('refresh_token');
          }
          
          // Fallback to query params
          if ((!accessToken || !refreshToken) && queryIndex !== -1) {
            const queryString = url.substring(queryIndex + 1);
            const queryParams = new URLSearchParams(queryString);
            accessToken = queryParams.get('access_token') || accessToken;
            refreshToken = queryParams.get('refresh_token') || refreshToken;
          }
          
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (sessionError) {
              console.error('Error setting session:', sessionError);
              throw sessionError;
            }
            // Session is set, auth state change listener will update the UI
            return;
          }
          
          // If tokens aren't in URL, Supabase might have handled it automatically
          // Wait a moment and check for session
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('Error getting session:', sessionError);
            throw sessionError;
          }
          
          if (!session) {
            console.error('No session found after OAuth callback');
            throw new Error('OAuth callback did not result in a valid session');
          }
          
          // Session found, auth state change listener will update the UI
        } else if (result.type === 'cancel') {
          console.log('User cancelled OAuth flow');
        } else {
          console.error('OAuth flow failed:', result.type);
        }
      }
    } catch (error) {
      console.error('Error in signInWithGoogle:', error);
      throw error;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
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
