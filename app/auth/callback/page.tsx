'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuthCallback() {
      const { data, error } = await supabase.auth.getSession();
      if (data.session) {
        router.push('/');
        router.refresh();
      }
    }
    handleAuthCallback();
  }, [router]);

  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Completing sign in...</p>
      </div>
    </div>
  );
}
