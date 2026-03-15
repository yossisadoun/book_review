'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, FileText, Play, User, Bot, Music } from 'lucide-react';

// Helper to resolve asset paths (handles /book_review prefix on GitHub Pages)
function getAssetPath(path: string): string {
  if (typeof window === 'undefined') return path;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
  if (isLocalhost || isCapacitor) return path;
  if (window.location.pathname.startsWith('/book_review')) return `/book_review${path}`;
  return path;
}

// Info Page Variant B - Rotating tooltips component
const InfoPageTooltips = React.memo(function InfoPageTooltips() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const tooltips = [
    {
      type: 'chat',
      label: 'Talk About Your Book',
      explainer: 'Join discussions and book clubs',
      content: '',
    },
    {
      type: 'youtube',
      thumbnail: getAssetPath('/onboarding_visuals/video.webp'),
      label: 'YouTube',
      explainer: 'Essays, breakdowns, and visual analysis',
      title: 'The Messed Up Origins of Alice in Wonderland',
      subtitle: 'YouTube · Essay',
      content: 'How a boat trip with a real girl named Alice became one of the most iconic stories ever written',
    },
    {
      type: 'podcast',
      thumbnail: getAssetPath('/onboarding_visuals/podcast.webp'),
      label: 'Podcast',
      explainer: 'Interviews and deep dives',
      title: 'About Lewis Carroll',
      subtitle: 'The life and mind behind Alice in Wonderland',
      content: 'A deep dive into the Oxford mathematician who created a nonsensical world that changed literature forever',
    },
    {
      type: 'album',
      thumbnail: getAssetPath('/onboarding_visuals/album.webp'),
      label: 'Music',
      explainer: 'Albums and music inspired by the book',
      title: 'Alice in Wonderland Soundtrack',
      subtitle: 'Danny Elfman · Album',
      content: 'A whimsical score that captures the madness and wonder of Carroll\'s world',
    },
    {
      type: 'icon',
      icon: <Lightbulb size={24} className="text-white" />,
      color: 'rgba(234, 179, 8, 0.9)',
      borderColor: 'rgba(234, 179, 8, 0.3)',
      label: 'Did You Know?',
      explainer: 'Surprising trivia and behind-the-scenes',
      content: 'Lewis Carroll invented the story during a boat trip with Alice Liddell on July 4, 1862 — he called it "Alice\'s Adventures Under Ground" before it became a book.',
    },
    {
      type: 'icon',
      icon: <FileText size={24} className="text-white" />,
      color: 'rgba(59, 130, 246, 0.9)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      label: 'Essay',
      explainer: 'Long-form analysis and academic writing',
      content: 'Carroll, a mathematics lecturer at Oxford, embedded mathematical puzzles and logical paradoxes throughout the text',
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tooltips.length);
    }, 2500); // Rotate every 2.5 seconds
    return () => clearInterval(interval);
  }, [tooltips.length]);

  const currentTooltip = tooltips[currentIndex];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full flex justify-center"
      >
        {currentTooltip.type === 'chat' ? (
          <div className="flex flex-col gap-[min(12px,1.5vh)] w-[min(340px,90vw)]" style={{ transform: 'scale(1.02)', transformOrigin: 'center center' }}>
            <p className="text-[min(16px,2vh)] font-medium text-slate-500 text-center mb-4 text-balance">{currentTooltip.explainer}</p>
            {/* Message 1 - from left */}
            <motion.div
              initial={{ opacity: 0, x: -30, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3, type: "spring", stiffness: 150 }}
              className="flex items-end gap-2 self-start"
            >
              <div className="w-[min(32px,4vh)] h-[min(32px,4vh)] rounded-full flex-shrink-0 flex items-center justify-center" style={{
                background: 'rgba(147, 51, 234, 0.75)',
                border: '1px solid rgba(147, 51, 234, 0.3)',
              }}>
                <User size={14} className="text-white" />
              </div>
              <div className="px-3 py-[min(8px,1vh)] rounded-2xl rounded-bl-md" style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
              }}>
                <p className="text-[min(14px,1.8vh)] text-slate-700">What did you think of the ending?</p>
              </div>
            </motion.div>

            {/* Message 2 - from right */}
            <motion.div
              initial={{ opacity: 0, x: 30, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.6, type: "spring", stiffness: 150 }}
              className="flex items-end gap-2 self-end flex-row-reverse"
            >
              <div className="w-[min(32px,4vh)] h-[min(32px,4vh)] rounded-full flex-shrink-0 flex items-center justify-center" style={{
                background: 'rgba(59, 130, 246, 0.75)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}>
                <User size={14} className="text-white" />
              </div>
              <div className="px-3 py-[min(8px,1vh)] rounded-2xl rounded-br-md" style={{
                background: 'rgba(59, 130, 246, 0.15)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}>
                <p className="text-[min(14px,1.8vh)] text-slate-700">I was shocked! Didn&apos;t see it coming</p>
              </div>
            </motion.div>

            {/* Message 3 - AI bot from left */}
            <motion.div
              initial={{ opacity: 0, x: -30, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.9, type: "spring", stiffness: 150 }}
              className="flex items-end gap-2 self-start"
            >
              <div className="w-[min(32px,4vh)] h-[min(32px,4vh)] rounded-full flex-shrink-0 flex items-center justify-center" style={{
                background: 'rgba(16, 185, 129, 0.75)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}>
                <Bot size={14} className="text-white" />
              </div>
              <div className="px-3 py-[min(8px,1vh)] rounded-2xl rounded-bl-md" style={{
                background: 'rgba(16, 185, 129, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}>
                <p className="text-[min(14px,1.8vh)] text-slate-700">The foreshadowing in chapter 3 hinted at it!</p>
              </div>
            </motion.div>
          </div>
        ) : (
        <div className="w-[min(340px,90vw)] flex flex-col">
          <p className="text-[min(16px,2vh)] font-medium text-slate-500 text-center mb-4 text-balance">{currentTooltip.explainer}</p>
        <div
          className="px-[min(20px,2.5vh)] py-[min(20px,2.5vh)] rounded-2xl"
          style={{
            background: 'rgba(255, 255, 255, 0.35)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
          }}
        >
          {(currentTooltip.type === 'youtube' || currentTooltip.type === 'podcast' || currentTooltip.type === 'album') ? (
            <div>
              <div className="w-[min(112px,14vh)] h-[min(112px,14vh)] rounded-xl overflow-hidden relative float-left mr-[min(16px,2vh)] mb-2">
                <img
                  src={currentTooltip.thumbnail}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-[min(48px,6vh)] h-[min(48px,6vh)] rounded-full bg-white/90 flex items-center justify-center">
                    {currentTooltip.type === 'album'
                      ? <Music size={22} className="text-green-600" />
                      : <Play size={22} className={currentTooltip.type === 'youtube' ? 'text-red-600 ml-0.5' : 'text-purple-600 ml-0.5'} fill="currentColor" />
                    }
                  </div>
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {currentTooltip.label}
              </p>
              {currentTooltip.title && (
                <p className="text-base font-bold text-slate-900 leading-tight mb-1">
                  {currentTooltip.title}
                </p>
              )}
              {currentTooltip.subtitle && (
                <p className="text-sm text-slate-500 mb-1">
                  {currentTooltip.subtitle}
                </p>
              )}
              <p className="text-sm text-slate-700 leading-snug">
                {currentTooltip.content}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-[min(16px,2vh)]">
              <div
                className="w-[min(56px,7vh)] h-[min(56px,7vh)] rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: currentTooltip.color,
                  border: `1px solid ${currentTooltip.borderColor}`,
                }}
              >
                {React.cloneElement(currentTooltip.icon as React.ReactElement, { size: 24 })}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {currentTooltip.label}
                </p>
                <p className="text-sm text-slate-700 leading-snug">
                  {currentTooltip.content}
                </p>
              </div>
            </div>
          )}
        </div>
        </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

export default InfoPageTooltips;
