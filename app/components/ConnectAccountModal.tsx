'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Capacitor } from '@capacitor/core';
import { isNativePlatform } from '@/lib/capacitor';

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'book_limit' | 'follow' | 'feed';
  bookCount?: number;
}

const MESSAGES: Record<ConnectAccountModalProps['reason'], { title: string; description: string }> = {
  book_limit: {
    title: 'Book limit reached',
    description: 'Guest accounts can save up to 20 books. Connect an account to unlock unlimited books and keep your library safe.',
  },
  follow: {
    title: 'Connect to follow',
    description: 'Following other readers requires a connected account. Your books and ratings will be preserved.',
  },
  feed: {
    title: 'Unlock your feed',
    description: 'Connect an account to get a personalized feed with insights, podcasts, and more for your books.',
  },
};

export default function ConnectAccountModal({ isOpen, onClose, reason, bookCount }: ConnectAccountModalProps) {
  const { savePendingMigration, linkWithGoogle, signInWithGoogle, signInWithApple, onLinkError } = useAuth();
  const [isLinking, setIsLinking] = useState(false);
  const isIOS = isNativePlatform && Capacitor.getPlatform() === 'ios';

  const message = MESSAGES[reason];

  // When Google linkIdentity fails with identity_already_exists,
  // fall back to regular sign-in (migration handled by AuthContext)
  useEffect(() => {
    const unsubscribe = onLinkError((errorCode) => {
      if (errorCode === 'identity_already_exists') {
        // Pending migration already saved — just sign in to existing account
        signInWithGoogle();
      }
    });
    return unsubscribe;
  }, [onLinkError, signInWithGoogle]);

  async function handleConnect(provider: 'google' | 'apple') {
    setIsLinking(true);
    try {
      // Save anonymous user ID so AuthContext can migrate books after sign-in
      savePendingMigration();

      if (provider === 'apple') {
        // Apple: native sign-in works for both new and existing accounts
        await signInWithApple();
        // Migration + reload handled by onAuthStateChange in AuthContext
      } else {
        // Google: try linkIdentity first (preserves user_id for new accounts)
        // If identity_already_exists, onLinkError will trigger signInWithGoogle
        await linkWithGoogle();
      }
      onClose();
    } catch (error: any) {
      const msg = error?.message?.toLowerCase() || '';
      if (msg.includes('cancel') || error?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      console.error('Error connecting identity:', error);
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-sm rounded-2xl p-6 text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.75)',
              boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/50 active:scale-95 transition-transform"
            >
              <X size={16} className="text-slate-500" />
            </button>

            {/* Icon */}
            <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
              }}
            >
              <UserPlus size={24} className="text-blue-600" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2">{message.title}</h3>
            <p className="text-sm text-slate-600 mb-6">{message.description}</p>

            {/* Sign-in buttons */}
            <div className="flex flex-col items-center gap-3">
              {/* Apple button - iOS only */}
              {isIOS && (
                <button
                  onClick={() => handleConnect('apple')}
                  disabled={isLinking}
                  className="w-[220px] h-[44px] bg-black rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  {isLinking ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="white">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      <span className="text-white font-medium text-[16px]">Continue with Apple</span>
                    </>
                  )}
                </button>
              )}

              {/* Google button */}
              <button
                onClick={() => handleConnect('google')}
                disabled={isLinking}
                className="w-[220px] h-[44px] bg-white rounded-lg shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-transform border border-gray-200"
              >
                {isLinking ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="text-gray-700 font-medium text-[16px]">Continue with Google</span>
                  </>
                )}
              </button>
            </div>

            {/* Dismiss link */}
            <button
              onClick={onClose}
              className="mt-5 text-sm text-slate-400 active:text-slate-600 transition-colors"
            >
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
