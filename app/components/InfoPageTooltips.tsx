'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, FileText, Play } from 'lucide-react';

// Info Page Variant B - Rotating tooltips component
const InfoPageTooltips = React.memo(function InfoPageTooltips() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const tooltips = [
    {
      type: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      label: 'YouTube',
      title: 'Brandon Sanderson on World Building',
      subtitle: 'The Author\'s Corner \u2022 1.2M views',
      content: 'Exclusive interview where the author discusses the intricate magic system and its real-world inspirations',
    },
    {
      type: 'podcast',
      thumbnail: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop',
      label: 'Podcast',
      title: 'The Literary Deep Dive',
      subtitle: 'Episode 142 \u2022 58 min',
      content: 'Historical accuracy explored: How the author researched medieval warfare for authentic battle scenes',
    },
    {
      type: 'icon',
      icon: <Lightbulb size={24} className="text-white" />,
      color: 'rgba(234, 179, 8, 0.9)',
      borderColor: 'rgba(234, 179, 8, 0.3)',
      label: 'Fun Fact',
      content: 'The manuscript was rejected by 12 major publishers over 3 years before becoming a #1 bestseller that stayed on the charts for 47 weeks',
    },
    {
      type: 'icon',
      icon: <FileText size={24} className="text-white" />,
      color: 'rgba(59, 130, 246, 0.9)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      label: 'Article',
      content: 'The Guardian explores how this novel redefined the fantasy genre and influenced a generation of writers',
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
        <div
          className="px-[min(20px,2.5vh)] py-[min(20px,2.5vh)] rounded-2xl w-[min(340px,90vw)]"
          style={{
            background: 'rgba(255, 255, 255, 0.35)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
          }}
        >
          {(currentTooltip.type === 'youtube' || currentTooltip.type === 'podcast') ? (
            <div>
              <div className="w-[min(112px,14vh)] h-[min(112px,14vh)] rounded-xl overflow-hidden relative float-left mr-[min(16px,2vh)] mb-2">
                <img
                  src={currentTooltip.thumbnail}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-[min(48px,6vh)] h-[min(48px,6vh)] rounded-full bg-white/90 flex items-center justify-center">
                    <Play size={22} className={currentTooltip.type === 'youtube' ? 'text-red-600 ml-0.5' : 'text-purple-600 ml-0.5'} fill="currentColor" />
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
      </motion.div>
    </AnimatePresence>
  );
});

export default InfoPageTooltips;
