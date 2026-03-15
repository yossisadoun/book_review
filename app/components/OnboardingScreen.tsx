'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import { X, ChevronRight, Plus, Headphones, Play, Microscope, MessagesSquare } from 'lucide-react';
import heartAnimation from '@/public/heart_anim.json';
import heartInsideAnimation from '@/public/heart_inside.json';
import vectorAnimation from '@/public/vector-anim-export.json';
import InfoPageTooltips from './InfoPageTooltips';
import OnboardingPrefsToggles from './OnboardingPrefsToggles';
import { getAssetPath } from './utils';

// Glassmorphic styles (same as page.tsx)
const standardGlassmorphicStyle: React.CSSProperties = {
  background: 'var(--glass-bg-subtle)',
  borderRadius: '16px',
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: 'var(--glass-border)',
};

const blueGlassmorphicStyle: React.CSSProperties = {
  background: 'var(--glass-bg-blue)',
  borderRadius: '999px',
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: 'var(--glass-border-blue)',
};

const glassmorphicStyle: React.CSSProperties = {
  background: 'var(--glass-bg)',
  borderRadius: '16px',
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: 'var(--glass-border)',
};

interface OnboardingScreenProps {
  variant: 'a' | 'b' | 'c';
  userId: string | undefined;
  contentPreferences: Record<string, any>;
  onClose: () => void;
  onOpenAddBook: () => void;
  onSavePreferences: (prefs: Record<string, any>) => void;
  triggerLightHaptic: () => void;
}

export default function OnboardingScreen({
  variant,
  userId,
  contentPreferences,
  onClose,
  onOpenAddBook,
  onSavePreferences,
  triggerLightHaptic,
}: OnboardingScreenProps) {
  // All state is local — no parent re-renders on interaction
  const [pageIndex, setPageIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'forward' | 'backward'>('forward');
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [showHearts, setShowHearts] = useState(false);
  const [showHeartInside, setShowHeartInside] = useState(false);

  // Delayed heart animations on page 2
  useEffect(() => {
    if (pageIndex === 2) {
      setShowHearts(false);
      setShowHeartInside(false);
      const t1 = setTimeout(() => setShowHearts(true), 500);
      const t2 = setTimeout(() => setShowHeartInside(true), 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      setShowHearts(false);
      setShowHeartInside(false);
    }
  }, [pageIndex]);

  function handleClose() {
    if (userId) localStorage.setItem(`hasSeenIntro_${userId}`, 'true');
    onClose();
  }

  function handleAddBook() {
    handleClose();
    onOpenAddBook();
  }

  function handleSwipe(distanceX: number, distanceY: number) {
    const minSwipeDistance = 50;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0 && pageIndex < 4) {
        setSwipeDirection('forward');
        setPageIndex(prev => prev + 1);
      } else if (distanceX < 0 && pageIndex > 0) {
        setSwipeDirection('backward');
        setPageIndex(prev => prev - 1);
      }
    }
  }

  function handleTouchEnd() {
    if (!touchStart || !touchEnd) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }
    handleSwipe(touchStart.x - touchEnd.x, touchStart.y - touchEnd.y);
    setTouchStart(null);
    setTouchEnd(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={handleClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        className="absolute top-[65px] right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
        style={standardGlassmorphicStyle}
      >
        <X size={18} className="text-slate-950 dark:text-slate-50" />
      </button>

      {/* Background image */}
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: 'white',
          backgroundImage: `url(${getAssetPath('/bg.webp')})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Full screen glassmorphic overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0"
        style={{ ...standardGlassmorphicStyle, borderRadius: 0 }}
      />

      {variant === 'c' ? (
        /* Variant C: 5-page stepper */
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 pointer-events-auto w-full h-full overflow-hidden"
          onTouchStart={(e) => {
            const touch = e.touches[0];
            setTouchStart({ x: touch.clientX, y: touch.clientY });
          }}
          onTouchMove={(e) => {
            if (touchStart) {
              const touch = e.touches[0];
              setTouchEnd({ x: touch.clientX, y: touch.clientY });
            }
          }}
          onTouchEnd={handleTouchEnd}
          onMouseDown={(e) => {
            setTouchStart({ x: e.clientX, y: e.clientY });
            setTouchEnd(null);
          }}
          onMouseMove={(e) => {
            if (touchStart && e.buttons === 1) {
              setTouchEnd({ x: e.clientX, y: e.clientY });
            }
          }}
          onMouseUp={handleTouchEnd}
          onMouseLeave={() => { setTouchStart(null); setTouchEnd(null); }}
        >
          {/* Fixed logo_text header - hidden on welcome page */}
          <div className={`absolute top-[8vh] left-0 right-0 flex justify-center z-0 pointer-events-none transition-opacity duration-300 ${pageIndex === 0 ? 'opacity-0' : 'opacity-100'}`}>
            <img
              src={getAssetPath('/logo_text.png')}
              alt="Logo"
              className="h-[min(20px,3vh)] object-contain"
            />
          </div>

          {/* Animated logo - transitions from center (page 0) to bottom (pages 1+) */}
          <motion.div
            className="absolute left-0 right-0 flex justify-center z-[15] pointer-events-none"
            initial={{ top: 'calc(50% - 84px)', opacity: 0, y: 0 }}
            animate={pageIndex === 0
              ? { top: 'calc(50% - 84px)', opacity: 1, y: 0 }
              : pageIndex <= 2
              ? { top: 'calc(100% - 250px)', opacity: 1, y: 0 }
              : { top: 'calc(100% - 250px)', opacity: 1, y: 300 }
            }
            transition={{ duration: 0.6, ease: 'easeIn' }}
          >
            <div className="relative">
              <motion.img
                src={getAssetPath('/logo_tight.png')}
                alt="Logo"
                initial={{ height: 128 }}
                animate={pageIndex === 0
                  ? { height: 128 }
                  : pageIndex <= 2
                  ? { height: 154 }
                  : { height: 185 }
                }
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className="object-contain"
                style={pageIndex > 0 ? { filter: 'drop-shadow(0 20px 40px rgba(255, 255, 255, 0.8))' } : undefined}
              />
              {pageIndex === 2 && showHearts && (
                <>
                  <div className="absolute top-[28px] left-1/2 pointer-events-none" style={{ transform: 'translateX(calc(-50% - 6px)) scale(0.96)', opacity: 1, mixBlendMode: 'overlay' }}>
                    <Lottie animationData={heartAnimation} loop={false} className="w-24 h-24" />
                  </div>
                  <div className="absolute top-[28px] left-1/2 pointer-events-none" style={{ transform: 'translateX(calc(-50% - 6px)) scale(0.96)', opacity: 1, mixBlendMode: 'overlay' }}>
                    <Lottie animationData={heartAnimation} loop={false} className="w-24 h-24" />
                  </div>
                  <div className="absolute top-[28px] left-1/2 pointer-events-none" style={{ transform: 'translateX(calc(-50% - 6px)) scale(0.96)', opacity: 1, mixBlendMode: 'overlay' }}>
                    <Lottie animationData={heartAnimation} loop={false} className="w-24 h-24" />
                  </div>
                </>
              )}
              {pageIndex === 2 && showHeartInside && (
                <>
                  <div className="absolute top-[54px] left-1/2 pointer-events-none w-12 h-12" style={{ transform: 'translateX(calc(-50% - 3px)) scale(1.51)', mixBlendMode: 'overlay', opacity: 1 }}>
                    <Lottie animationData={heartInsideAnimation} loop={false} className="w-full h-full" />
                  </div>
                  <div className="absolute top-[54px] left-1/2 pointer-events-none w-12 h-12" style={{ transform: 'translateX(calc(-50% - 3px)) scale(1.51)', mixBlendMode: 'overlay', opacity: 1 }}>
                    <Lottie animationData={heartInsideAnimation} loop={false} className="w-full h-full" />
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* Persistent header area - morphs between pages */}
          <div className="absolute top-[12vh] left-0 right-0 flex flex-col items-center gap-[1vh] px-8 z-10">
            <AnimatePresence mode="wait">
              {pageIndex === 0 && (
                <motion.div key="h0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center mt-[200px]">
                  <h1 className="text-2xl font-bold text-black tracking-wide">WELCOME TO</h1>
                </motion.div>
              )}
              {pageIndex === 1 && (
                <motion.div key="h1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-[1vh]">
                  <h1 className="text-[min(28px,3.5vh)] font-bold text-slate-900 dark:text-slate-100 text-center uppercase leading-tight">
                    BUILD YOUR<br />LIBRARY
                  </h1>
                </motion.div>
              )}
              {pageIndex === 2 && (
                <motion.div key="h2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-[1vh]">
                  <h1 className="text-[min(28px,3.5vh)] font-bold text-slate-900 dark:text-slate-100 text-center uppercase leading-tight">
                    GET MORE FROM READING
                  </h1>
                </motion.div>
              )}
              {pageIndex === 3 && (
                <motion.div key="h3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-[1vh]">
                  <h1 className="text-[min(28px,3.5vh)] font-bold text-slate-900 dark:text-slate-100 text-center uppercase leading-tight">
                    CHOOSE WHAT<br />TO SEE
                  </h1>
                  <p className="text-[min(17px,2.2vh)] text-slate-600 dark:text-slate-400 text-center">
                    We&apos;ll show this on every book you add to your library
                  </p>
                </motion.div>
              )}
              {pageIndex === 4 && (
                <motion.div key="h4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-[1vh]">
                  <h1 className="text-[min(28px,3.5vh)] font-bold text-slate-900 dark:text-slate-100 text-center uppercase leading-tight">
                    START BY ADDING<br />YOUR BOOK
                  </h1>
                  <p className="text-[min(17px,2.2vh)] text-slate-600 dark:text-slate-400 text-center">
                    We&apos;ll open up its page and show you the world around it
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Persistent content area - crossfades between pages */}
          <AnimatePresence mode="wait">
            {pageIndex === 0 && (
              <motion.div
                key="c0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col items-center justify-center px-8 z-[20] pointer-events-none"
              >
                <div className="w-full max-w-md mb-8" style={{ transform: 'scale(0.91) translateY(10px)' }}>
                  <Lottie animationData={vectorAnimation} loop={false} className="w-full h-auto" />
                </div>
                <motion.p
                  className="absolute bottom-[16vh] left-0 right-0 text-center text-sm font-medium text-slate-500 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3, duration: 0.5 }}
                >
                  Let&apos;s add your books!
                </motion.p>
                <motion.div
                  className="absolute bottom-[10vh] left-0 right-0 flex items-center justify-center gap-1 text-slate-400 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{ delay: 4.5, duration: 2, repeat: Infinity, repeatDelay: 1 }}
                >
                  <span className="text-xs font-medium">Swipe</span>
                  <ChevronRight size={14} />
                </motion.div>
              </motion.div>
            )}

            {pageIndex === 1 && (
              <motion.div key="c1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="absolute bottom-[34vh] left-0 right-0 flex justify-center px-8 z-10">
                <img src={getAssetPath('/onboarding_visuals/bookshelf.webp')} alt="Bookshelf" className="w-full max-w-[min(264px,70vw)] rounded-2xl shadow-lg" />
              </motion.div>
            )}

            {pageIndex === 2 && (
              <motion.div key="c2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="absolute top-[22vh] bottom-[42vh] left-0 right-0 flex items-center justify-center px-8 z-10 mt-[75px]">
                <InfoPageTooltips />
              </motion.div>
            )}

            {pageIndex === 3 && (
              <motion.div key="c3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0 flex items-end justify-center px-6 z-10 pb-[18vh]">
                <OnboardingPrefsToggles
                  initialPrefs={contentPreferences}
                  triggerLightHaptic={triggerLightHaptic}
                  onNext={(prefs) => {
                    onSavePreferences(prefs);
                    setSwipeDirection('forward');
                    setPageIndex(4);
                  }}
                />
              </motion.div>
            )}

            {pageIndex === 4 && (
              <motion.div key="c4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0 flex flex-col items-center px-8 z-10">
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.2, type: "spring", stiffness: 150 }}
                  className="absolute bottom-[39vh] left-0 right-0 flex justify-center px-8"
                >
                  <button
                    onClick={handleAddBook}
                    className="w-[min(134px,16.8vh)] aspect-[2/3] rounded-lg overflow-hidden shadow-lg flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                    style={glassmorphicStyle}
                  >
                    <Plus size={45} className="text-slate-400" />
                  </button>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4, type: "spring", stiffness: 150 }}
                  className="absolute bottom-[29vh] left-0 right-0 flex justify-center px-8"
                >
                  <button onClick={handleAddBook} className="px-8 py-3 text-white font-semibold text-base active:scale-95 transition-transform" style={blueGlassmorphicStyle}>
                    Add first book
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pagination dots */}
          <div className="absolute bottom-[60px] left-0 right-0 flex justify-center z-20">
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3, 4].map((index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSwipeDirection(index > pageIndex ? 'forward' : 'backward');
                    setPageIndex(index);
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-[width] duration-300 ${
                    pageIndex === index
                      ? 'bg-blue-500 w-6'
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        /* Variant A & B: Original single-page layout */
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 pointer-events-auto mx-auto max-w-md flex flex-col items-center px-8 pt-10 pb-8 gap-5"
        >
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-[30px] font-bold text-slate-900 dark:text-slate-100 text-center uppercase leading-tight"
          >
            DISCOVER THE WORLD AROUND THE BOOK
          </motion.h1>

          <div className="relative flex items-center justify-center h-[220px] mt-[84px]">
            {variant === 'b' && (
              <div className="absolute -top-[70px] left-1/2 -translate-x-1/2 z-10">
                <InfoPageTooltips />
              </div>
            )}

            <motion.img
              src={getAssetPath('/logo_tight.png')}
              alt="Logo"
              className="w-56 h-56 object-contain"
              style={{ filter: 'drop-shadow(0 20px 40px rgba(255, 255, 255, 0.8))' }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            />

            {/* Heart animations */}
            {[0, 1, 2].map(i => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.3 }}
                className="absolute top-[62px] left-1/2 pointer-events-none"
                style={{ transform: 'translateX(calc(-50% - 6px)) scale(0.7)', mixBlendMode: 'overlay' }}
              >
                <Lottie animationData={heartAnimation} loop={false} className="w-24 h-24" />
              </motion.div>
            ))}

            {variant === 'a' && (
              <>
                <motion.div initial={{ scale: 0, opacity: 0, x: 0, y: 0 }} animate={{ scale: 1, opacity: 1, x: -130, y: -140 }} transition={{ duration: 0.6, delay: 0.6, type: "spring", stiffness: 150 }} className="absolute">
                  <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center" style={{ background: 'rgba(147, 51, 234, 0.75)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
                    <Headphones size={30} className="text-white" />
                  </div>
                </motion.div>
                <motion.div initial={{ scale: 0, opacity: 0, x: 0, y: 0 }} animate={{ scale: 1, opacity: 1, x: -50, y: -160 }} transition={{ duration: 0.6, delay: 0.75, type: "spring", stiffness: 150 }} className="absolute">
                  <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.75)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <Play size={30} className="text-white" />
                  </div>
                </motion.div>
                <motion.div initial={{ scale: 0, opacity: 0, x: 0, y: 0 }} animate={{ scale: 1, opacity: 1, x: 50, y: -160 }} transition={{ duration: 0.6, delay: 0.9, type: "spring", stiffness: 150 }} className="absolute">
                  <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center" style={{ background: 'rgba(234, 179, 8, 0.75)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                    <Microscope size={30} className="text-white" />
                  </div>
                </motion.div>
                <motion.div initial={{ scale: 0, opacity: 0, x: 0, y: 0 }} animate={{ scale: 1, opacity: 1, x: 130, y: -140 }} transition={{ duration: 0.6, delay: 1.05, type: "spring", stiffness: 150 }} className="absolute">
                  <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center" style={{ background: 'rgba(255, 255, 255, 0.75)', boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                    <MessagesSquare size={30} className="text-slate-800 dark:text-slate-200" />
                  </div>
                </motion.div>
              </>
            )}
          </div>

          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="text-[18.4px] text-slate-600 dark:text-slate-400 text-center"
          >
            Book.Luv finds interesting <span className="font-semibold text-slate-800 dark:text-slate-200">facts</span>, <span className="font-semibold text-slate-800 dark:text-slate-200">videos</span>, <span className="font-semibold text-slate-800 dark:text-slate-200">podcasts</span> and <span className="font-semibold text-slate-800 dark:text-slate-200">discussions</span> around the book you&apos;re reading.
          </motion.p>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.3 }}
            onClick={handleAddBook}
            className="px-8 py-3 text-white font-semibold text-base active:scale-95 transition-transform mt-6"
            style={blueGlassmorphicStyle}
          >
            Add a book
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
