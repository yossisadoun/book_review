'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import HelloAnimation from './HelloAnimation';

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
  const { signInWithGoogle, loading } = useAuth();

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: `url(${getAssetPath('/bg.webp')})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center text-center max-w-sm w-full"
      >
        {/* Animation - 30% smaller */}
        <div className="w-full max-w-md mb-8" style={{ transform: 'scale(0.7)' }}>
          <HelloAnimation 
            color="#ffffff" 
            strokeWidth={40} 
            duration={3} 
            className="w-full h-auto"
          />
        </div>

        {/* Logo */}
        <img src={getAssetPath("/logo.png")} alt="BOOK" className="object-contain mx-auto mb-4" />

        {/* Google Sign-In Button - Standard Design */}
        <motion.button
          onClick={signInWithGoogle}
          disabled={loading}
          whileTap={{ scale: 0.98 }}
          className="w-[200px] bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 border border-white/30 rounded-lg shadow-sm hover:shadow-md transition-shadow py-3 px-4 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <span className="text-gray-700 font-medium text-sm">Sign in with Google</span>
            </>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}
