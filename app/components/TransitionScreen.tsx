'use client';

import React, { useState, useRef, useEffect } from 'react';
import Lottie from 'lottie-react';
import refreshAnimation from '@/public/refresh.json';

interface TransitionScreenProps {
  /** When true, the overlay appears. When false, it exits (slide-up). */
  visible: boolean;
  /** Minimum time (ms) the overlay stays visible before it can exit. Default: 500 */
  minDuration?: number;
  /** z-index for the overlay. Default: 80 */
  zIndex?: number;
}

const FADE_IN_CSS = `
@keyframes transitionFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

/**
 * Full-screen glassmorphic overlay with centered Lottie loader.
 * Use as a transition screen between views or during async operations.
 * Stays visible for at least `minDuration` ms, then slides up to exit.
 */
export default function TransitionScreen({ visible, minDuration = 500, zIndex = 80 }: TransitionScreenProps) {
  const [show, setShow] = useState(false);
  const showAtRef = useRef(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setExiting(false);
      showAtRef.current = Date.now();
    } else if (show && !exiting) {
      const elapsed = Date.now() - showAtRef.current;
      const remaining = Math.max(0, minDuration - elapsed);
      const t = setTimeout(() => {
        setExiting(true);
        // Remove after slide-up animation completes
        setTimeout(() => { setShow(false); setExiting(false); }, 400);
      }, remaining);
      return () => clearTimeout(t);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;
  return (
    <>
      <style>{FADE_IN_CSS}</style>
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{
          zIndex,
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(9.4px)',
          WebkitBackdropFilter: 'blur(9.4px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          transform: exiting ? 'translateY(-100%)' : 'translateY(0)',
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ animation: 'transitionFadeIn 0.3s ease-out' }}>
          <Lottie animationData={refreshAnimation} loop autoplay style={{ width: 80, height: 80 }} />
        </div>
      </div>
    </>
  );
}
