'use client';

import React, { useRef, useState } from 'react';
import Lottie from 'lottie-react';
import arrowAnimation from '@/public/ArrowAnimation_new.json';

const ArrowAnimation = React.memo(function ArrowAnimation({ isBookshelfEmpty = false, white = false, playOnce = false, opaque = false }: { isBookshelfEmpty?: boolean; white?: boolean; playOnce?: boolean; opaque?: boolean }) {
  const lottieRef = useRef<any>(null);
  const [playCount, setPlayCount] = useState(0);

  const handleComplete = () => {
    const maxPlays = playOnce ? 0 : 1;
    if (playCount < maxPlays) {
      setPlayCount(prev => prev + 1);
      lottieRef.current?.goToAndPlay(0);
    }
  };

  return (
    <div className={`absolute top-0 left-0 right-0 pointer-events-none z-10 flex justify-start pt-32 pl-4 ${isBookshelfEmpty ? 'ml-[60px] mt-[230px]' : 'ml-[100px] mt-[150px]'}`}>
      <Lottie
        lottieRef={lottieRef}
        animationData={arrowAnimation}
        loop={false}
        onComplete={handleComplete}
        className={`w-44 h-44 ${opaque ? 'opacity-100' : 'opacity-50'}`}
        style={white ? { filter: 'brightness(0) invert(1)' } : undefined}
      />
    </div>
  );
});

export default ArrowAnimation;
