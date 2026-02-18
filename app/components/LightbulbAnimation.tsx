'use client';

import React, { useState, useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import lightbulbAnimation from '@/public/lightbulb_anim.json';

const LightbulbAnimation = React.memo(function LightbulbAnimation({ bookId }: { bookId: string }) {
  const lottieRef = useRef<any>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [playingReverse, setPlayingReverse] = useState(false);

  // Set speed on mount
  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(1.25);
    }
  }, []);

  // Reset state when bookId changes
  useEffect(() => {
    setIsVisible(true);
    setPlayingReverse(false);
    if (lottieRef.current) {
      lottieRef.current.setDirection(1);
      lottieRef.current.setSpeed(1.25);
      lottieRef.current.goToAndPlay(0);
    }
  }, [bookId]);

  const handleComplete = () => {
    if (!playingReverse) {
      // First completion: play in reverse
      setPlayingReverse(true);
      if (lottieRef.current) {
        lottieRef.current.setDirection(-1);
        lottieRef.current.play();
      }
    } else {
      // Second completion (reverse done): hide
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={lightbulbAnimation}
      loop={false}
      onComplete={handleComplete}
      className="w-36 h-36"
    />
  );
});

export default LightbulbAnimation;
