'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import { useAuth } from '@/contexts/AuthContext';
import { isNativePlatform } from '@/lib/capacitor';
import { Capacitor } from '@capacitor/core';
import heartAnimation from '@/public/heart_anim.json';
import vectorAnimation from '@/public/vector-anim-export.json';
import heartInsideAnimation from '@/public/heart_inside.json';

// Heart animation with speed control via ref
function FastHeartAnimation({ className }: { className?: string }) {
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(1.3);
    }
  }, []);

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={heartAnimation}
      loop={false}
      className={className}
    />
  );
}

// Helper function to get the correct path for static assets (handles basePath)
function getAssetPath(path: string): string {
  if (typeof window === 'undefined') return path;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
  if (isLocalhost || isCapacitor) return path;
  // Check if pathname starts with /book_review (GitHub Pages basePath)
  const pathname = window.location.pathname;
  if (pathname.startsWith('/book_review')) {
    return `/book_review${path}`;
  }
  return path;
}

export function LoginScreen() {
  const { signInWithGoogle, signInWithApple, signInAsReviewer, signInAnonymously, loading } = useAuth();
  const [showHearts, setShowHearts] = useState(false);
  const [showHeartInside, setShowHeartInside] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [reviewerLoading, setReviewerLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const appleInFlight = useRef(false);
  const isIOS = isNativePlatform && Capacitor.getPlatform() === 'ios';

  // Start heart animation after HelloAnimation finishes (3s)
  useEffect(() => {
    const timer = setTimeout(() => setShowHearts(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Start heart inside animation after heart animation finishes (4s total)
  useEffect(() => {
    const timer = setTimeout(() => setShowHeartInside(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center p-4 overflow-y-auto"
      style={{
        backgroundImage: `url(${getAssetPath('/bg.png')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Logo text header */}
      <div className="absolute top-[70px] left-0 right-0 flex justify-center pointer-events-none">
        <img
          src={getAssetPath('/logo_text.png')}
          alt="Logo"
          className="h-[20px] object-contain dark:invert"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center text-center max-w-sm w-full"
      >
        {/* Animation */}
        <div className="w-full max-w-md mb-8" style={{ transform: 'scale(0.91) translateY(30px)' }}>
          <Lottie
            animationData={vectorAnimation}
            loop={false}
            className="w-full h-auto"
          />
        </div>

        {/* Logo with Heart Animation */}
        <div className="relative mb-4" style={{ marginTop: '-15px' }}>
          <img src={getAssetPath("/logo_tight.png")} alt="Book.luv" className="h-32 object-contain mx-auto" />
          {showHearts && (
            <>
              <div className="absolute top-[18px] left-1/2 pointer-events-none" style={{ transform: 'translateX(calc(-50% - 6px)) scale(0.8)', opacity: 1, mixBlendMode: 'overlay' }}>
                <FastHeartAnimation className="w-24 h-24" />
              </div>
              <div className="absolute top-[18px] left-1/2 pointer-events-none" style={{ transform: 'translateX(calc(-50% - 6px)) scale(0.8)', opacity: 1, mixBlendMode: 'overlay' }}>
                <FastHeartAnimation className="w-24 h-24" />
              </div>
              <div className="absolute top-[18px] left-1/2 pointer-events-none" style={{ transform: 'translateX(calc(-50% - 6px)) scale(0.8)', opacity: 1, mixBlendMode: 'overlay' }}>
                <FastHeartAnimation className="w-24 h-24" />
              </div>
            </>
          )}
          {/* Heart inside animations - play once after heart animation */}
          {showHeartInside && (
            <>
              <div
                className="absolute top-[44px] left-1/2 pointer-events-none w-12 h-12"
                style={{ transform: 'translateX(calc(-50% - 3px)) scale(1.26)', mixBlendMode: 'overlay', opacity: 1 }}
              >
                <Lottie
                  animationData={heartInsideAnimation}
                  loop={false}
                  className="w-full h-full"
                />
              </div>
              <div
                className="absolute top-[44px] left-1/2 pointer-events-none w-12 h-12"
                style={{ transform: 'translateX(calc(-50% - 3px)) scale(1.26)', mixBlendMode: 'overlay', opacity: 1 }}
              >
                <Lottie
                  animationData={heartInsideAnimation}
                  loop={false}
                  className="w-full h-full"
                />
              </div>
            </>
          )}
        </div>

        {/* Apple Sign-In Button - iOS only (Apple HIG compliant) */}
        {isIOS && (
          <div
            role="button"
            tabIndex={0}
            onClick={async () => {
              if (appleInFlight.current) return;
              appleInFlight.current = true;
              try { await signInWithApple(); } finally { appleInFlight.current = false; }
            }}
            style={{ WebkitTapHighlightColor: 'transparent', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as any}
            className="w-[200px] md:w-[240px] h-[44px] mb-3 bg-black rounded-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="white">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            <span className="text-white font-medium text-[16px] tracking-tight">Sign in with Apple</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        <motion.button
          onClick={signInWithGoogle}
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          className="w-[200px] md:w-[240px] h-[44px] bg-white dark:bg-slate-800 bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 dark:bg-opacity-80 backdrop-saturate-150 backdrop-contrast-75 border border-white/30 dark:border-white/10 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {/* Google Logo SVG */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-gray-700 dark:text-gray-200 font-medium text-[16px] tracking-tight">Sign in with Google</span>
            </>
          )}
        </motion.button>

        {/* Review Account Button - iOS only, for App Store reviewers */}
        {isIOS && (
          <div
            role="button"
            tabIndex={0}
            onClick={async () => {
              if (reviewerLoading) return;
              setReviewerLoading(true);
              try { await signInAsReviewer(); } finally { setReviewerLoading(false); }
            }}
            style={{ WebkitTapHighlightColor: 'transparent', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', backgroundColor: '#ED23E3' } as any}
            className="mt-3 w-[200px] md:w-[240px] h-[44px] rounded-lg flex items-center justify-center cursor-pointer active:scale-95 transition-transform z-50 relative"
          >
            {reviewerLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-white font-medium text-[16px] tracking-tight">Review account</span>
            )}
          </div>
        )}

        {/* Start as guest - text link under all buttons, mobile only */}
        {isNativePlatform && (
          <button
            onClick={async () => {
              if (guestLoading) return;
              setGuestLoading(true);
              try { await signInAnonymously(); } finally { setGuestLoading(false); }
            }}
            disabled={guestLoading}
            style={{ WebkitTapHighlightColor: 'transparent' } as any}
            className="mt-5 flex items-center justify-center"
          >
            {guestLoading ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-gray-300 text-[14px] underline underline-offset-2">Start as guest</span>
            )}
          </button>
        )}
      </motion.div>
    </div>
  );
}
