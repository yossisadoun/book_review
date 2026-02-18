'use client';

import React from 'react';
import Lottie from 'lottie-react';
import arrowAnimation from '@/public/arrow_anim.json';

const ArrowAnimation = React.memo(function ArrowAnimation({ isBookshelfEmpty = false }: { isBookshelfEmpty?: boolean }) {
  return (
    <div className={`absolute top-0 left-0 right-0 pointer-events-none z-10 flex justify-start pt-32 pl-4 ${isBookshelfEmpty ? 'ml-[170px] mt-[150px]' : 'ml-[70px] mt-[70px]'}`}>
      <Lottie
        animationData={arrowAnimation}
        loop={false}
        className="w-44 h-44 -scale-x-100 rotate-[140deg]"
      />
    </div>
  );
});

export default ArrowAnimation;
