'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, ExternalLink } from 'lucide-react';

export interface InsightItem {
  text: string;
  sourceUrl?: string;
  label: string;
  noteIndex?: number;
  totalNotes?: number;
}

export interface InsightsCardsProps {
  insights: InsightItem[];
  bookId: string;
  isLoading?: boolean;
}

function InsightsCards({ insights, bookId, isLoading = false }: InsightsCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;
  const prevInsightsRef = useRef<string>('');

  const glassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

  const actualBookId = bookId.split('-')[0];

  const insightsKey = insights.length > 0
    ? `${insights.length}-${insights[0]?.text?.substring(0, 30)}-${insights[insights.length - 1]?.text?.substring(0, 30)}`
    : 'empty';

  useEffect(() => {
    if (insightsKey !== prevInsightsRef.current) {
      prevInsightsRef.current = insightsKey;
    setCurrentIndex(0);
      if (insights.length > 0) {
        setIsVisible(true);
      }
    }
  }, [insightsKey, insights.length]);

  useEffect(() => {
    setCurrentIndex(0);
      setIsVisible(true);
    prevInsightsRef.current = '';
  }, [actualBookId]);

  function handleNext() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % insights.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : insights.length - 1));
      setIsVisible(true);
    }, 300);
  }

  const handleSwipe = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-2xl overflow-hidden"
          style={glassmorphicStyle}
        >
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <div className="w-14 h-4 bg-slate-300/50 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-10 h-10 rounded-full bg-slate-300/50 animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="w-20 h-4 bg-slate-300/50 rounded animate-pulse" />
              <div className="w-40 h-3 bg-slate-300/50 rounded animate-pulse" />
            </div>
          </div>
          <div className="px-4 pb-4 space-y-2">
            <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-4/5 h-3 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-3/5 h-3 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (insights.length === 0 || currentIndex >= insights.length) return null;

  const currentInsight = insights[currentIndex];

  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...glassmorphicStyle,
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

  return (
    <div
      onClick={handleNext}
      onTouchStart={(e) => {
        e.stopPropagation();
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        e.stopPropagation();
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        handleSwipe();
      }}
      className="w-full cursor-pointer"
    >
      <div className="relative pb-3">
        {insights.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentInsight.text}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={glassmorphicStyle}
            >
            {currentInsight.noteIndex && currentInsight.totalNotes && (
              <div className="absolute top-2 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500 bg-white/60 backdrop-blur-sm">
                {currentInsight.noteIndex}/{currentInsight.totalNotes}
              </div>
            )}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(6, 182, 212, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                <Lightbulb size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">Insights</p>
                <p className="text-xs text-slate-500">Interesting facts about this book</p>
              </div>
            </div>
            <div className="px-4 pb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                {currentInsight.text}
              </p>
              {currentInsight.sourceUrl && (
                <a
                  href={currentInsight.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-cyan-600 font-medium hover:text-cyan-700"
                >
                  <ExternalLink size={12} />
                  Source
                </a>
              )}
              {insights.length > 1 && (
                <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                  Tap for next ({currentIndex + 1}/{insights.length})
                </p>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default InsightsCards;
