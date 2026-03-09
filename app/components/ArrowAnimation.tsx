'use client';

import React, { useRef, useState } from 'react';
import Lottie from 'lottie-react';
import arrowAnimation from '@/public/arrow_anim.json';

const ArrowAnimation = React.memo(function ArrowAnimation({ isBookshelfEmpty = false }: { isBookshelfEmpty?: boolean }) {
  const lottieRef = useRef<any>(null);
  const [playCount, setPlayCount] = useState(0);

  const handleComplete = () => {
    if (playCount < 1) {
      setPlayCount(prev => prev + 1);
      lottieRef.current?.goToAndPlay(0);
    }
  };

  return (
    <div className={`absolute top-0 left-0 right-0 pointer-events-none z-10 flex justify-start pt-32 pl-4 ${isBookshelfEmpty ? 'ml-[200px] mt-[230px]' : 'ml-[100px] mt-[150px]'}`}>
      <Lottie
        lottieRef={lottieRef}
        animationData={arrowAnimation}
        loop={false}
        onComplete={handleComplete}
        className="w-44 h-44 opacity-50"
      />
    </div>
  );
});

export default ArrowAnimation;
