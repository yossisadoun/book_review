'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BookLoading } from '@/components/BookLoading';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      // Check for error from linkIdentity (e.g. identity_already_exists)
      const errorCode = params.get('error_code') || hashParams.get('error_code');
      if (errorCode === 'identity_already_exists') {
        // linkIdentity failed because Google account belongs to another user.
        // Fall back to regular sign-in — migration key is already in localStorage.
        console.log('🔗 identity_already_exists on web — falling back to regular Google sign-in');
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const basePath = isLocalhost ? '' : (window.location.pathname.split('/auth/callback')[0] || '');
        const redirectTo = `${window.location.origin}${basePath}/auth/callback`;
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (error) {
          console.error('Fallback sign-in error:', error);
          redirectHome();
        }
        // signInWithOAuth will redirect the page to Google again
        return;
      } else if (errorCode) {
        console.warn('Auth callback error_code:', errorCode);
        redirectHome();
        return;
      }

      // Exchange authorization code for session (required for OAuth + PKCE)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('Code exchange error:', error);
        }
      }

      // Also check for tokens in hash fragment (implicit flow)
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }

      // Wait briefly for session to settle, then redirect
      await new Promise(resolve => setTimeout(resolve, 300));
      redirectHome();
    }

    function redirectHome() {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
      const basePath = isLocalhost || isCapacitor ? '' : (window.location.pathname.split('/auth/callback')[0] || '');
      const redirectUrl = `${window.location.origin}${basePath}/`;
      console.log('Redirecting to:', redirectUrl);
      window.location.href = redirectUrl;
    }

    handleAuthCallback();
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <BookLoading />
      </div>
    </div>
  );
}
