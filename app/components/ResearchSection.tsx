'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { glassmorphicStyle } from './utils';

interface ResearchContentItem {
  source_url: string;
  trivia_fact: string;
  deep_insight: string;
}

interface ResearchPillar {
  pillar_name: string;
  content_items: ResearchContentItem[];
}

interface BookResearch {
  book_title: string;
  author: string;
  pillars: ResearchPillar[];
}

interface ResearchSectionProps {
  research: BookResearch | null;
  bookId: string;
  isLoading?: boolean;
}

function ResearchSection({ research, bookId, isLoading = false }: ResearchSectionProps) {
  // Generate colors for pillar labels
  const pillarColors = [
    'bg-blue-600', 'bg-purple-600', 'bg-pink-600', 'bg-indigo-600',
    'bg-teal-600', 'bg-orange-600', 'bg-red-600', 'bg-green-600',
    'bg-yellow-600', 'bg-cyan-600', 'bg-amber-600', 'bg-emerald-600',
    'bg-violet-600', 'bg-rose-600'
  ];

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-xl p-4"
          style={glassmorphicStyle}
        >
          <div className="h-12 flex items-center justify-center">
            <div className="w-full h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!research || !research.pillars || research.pillars.length === 0) {
    return (
      <div className="w-full">
        <div className="rounded-xl p-4" style={glassmorphicStyle}>
          <p className="text-xs text-slate-600 dark:text-slate-400 text-center">No research data available</p>
        </div>
      </div>
    );
  }

  // Flatten all content items from all pillars for card navigation
  const allContentItems: Array<{ pillar: ResearchPillar; item: ResearchContentItem; itemIndex: number }> = [];
  research.pillars.forEach(pillar => {
    pillar.content_items.forEach((item, itemIndex) => {
      allContentItems.push({ pillar, item, itemIndex });
    });
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    setCurrentIndex(0);
    setIsVisible(false);

    if (allContentItems.length === 0) return;

    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [research, bookId]);

  function handleNext() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % allContentItems.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : allContentItems.length - 1));
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

  if (allContentItems.length === 0 || currentIndex >= allContentItems.length) return null;

  const current = allContentItems[currentIndex];
  const pillarIndex = research.pillars.findIndex(p => p.pillar_name === current.pillar.pillar_name);
  const colorClass = pillarColors[pillarIndex % pillarColors.length];

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
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={`${current.pillar.pillar_name}-${current.itemIndex}-${currentIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="rounded-xl p-4"
          style={glassmorphicStyle}
          >
            {/* Pillar Label */}
            <div className="mb-3">
              <span className={`${colorClass} text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg inline-block`}>
                {current.pillar.pillar_name}
              </span>
            </div>

            {/* Deep Insight */}
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed mb-3">
              {current.item.deep_insight}
            </p>

            {/* Source URL Icon */}
            {current.item.source_url && (
              <div className="flex justify-end">
                <a
                  href={current.item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-95"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            )}

            {allContentItems.length > 1 && (
              <p className="text-xs text-slate-600 dark:text-slate-400 text-center mt-3 font-bold uppercase tracking-wider">
                Tap for next ({currentIndex + 1}/{allContentItems.length})
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ResearchSection;
