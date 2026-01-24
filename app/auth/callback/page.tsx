'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BookLoading } from '@/components/BookLoading';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuthCallback() {
      // Wait a moment for Supabase to process the OAuth callback
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth callback error:', error);
        return;
      }

      if (session) {
        // Detect if we're on localhost
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
        const basePath = isLocalhost || isCapacitor ? '' : (window.location.pathname.split('/auth/callback')[0] || '');
        
        // Redirect to the root of the current origin (stay on same domain)
        const redirectUrl = `${window.location.origin}${basePath}/`;
        console.log('Redirecting to:', redirectUrl);
        window.location.href = redirectUrl;
      } else {
        // If no session yet, try again after a short delay
        setTimeout(() => {
          handleAuthCallback();
        }, 500);
      }
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
