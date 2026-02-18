'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ExternalLink } from 'lucide-react';
import { decodeHtmlEntities } from './utils';

// Analysis article interface
interface AnalysisArticle {
  title: string;
  snippet: string;
  url: string;
  authors?: string;
  year?: string;
}

interface AnalysisArticlesProps {
  articles: AnalysisArticle[];
  bookId: string;
  isLoading?: boolean;
}

function AnalysisArticles({ articles, bookId, isLoading = false }: AnalysisArticlesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  // Consistent glassmorphism style (less transparent for book page info cards)
  const glassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

  useEffect(() => {
    // Reset when book changes
    setCurrentIndex(0);
    setIsVisible(false);

    if (articles.length === 0) return;

    // Show first article after a short delay
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [articles, bookId]);

  function handleNext() {
    setIsVisible(false);
    // Wait for fade out, then show next (or loop back to first)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % articles.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : articles.length - 1));
      setIsVisible(true);
    }, 300);
  }

  const handleSwipe = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        handleNext(); // Swipe left = next
      } else {
        handlePrev(); // Swipe right = prev
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
          className="rounded-xl p-4"
          style={glassmorphicStyle}
        >
          <div className="space-y-2">
            <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse mt-3" />
            <div className="w-5/6 h-3 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (articles.length === 0 || currentIndex >= articles.length) return null;

  const currentArticle = articles[currentIndex];

  // Stacked cards style (cards behind the main card)
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
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={handleSwipe}
      className="w-full cursor-pointer"
    >
      <div className="relative pb-3">
        {/* Stacked cards effect - only show if multiple items */}
        {articles.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentArticle.url}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={glassmorphicStyle}
            >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <FileText size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">Articles</p>
                <p className="text-xs text-slate-500">Academic article about this book</p>
              </div>
            </div>
            {/* Content */}
            <div className="px-4 pb-4">
              <div className="flex-1 min-w-0 mb-2">
                <a
                  href={currentArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-bold text-blue-700 hover:text-blue-800 hover:underline block mb-1 line-clamp-2"
                >
                  {decodeHtmlEntities(currentArticle.title)}
                </a>
                {(currentArticle.authors || currentArticle.year) && (
                  <div className="text-xs text-slate-500">
                    {currentArticle.authors && <span>{decodeHtmlEntities(currentArticle.authors)}</span>}
                    {currentArticle.year && <span> • {currentArticle.year}</span>}
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-2">
                {decodeHtmlEntities(currentArticle.snippet)}
              </p>
              {currentArticle.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(currentArticle.url, '_blank');
                  }}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium active:scale-95 transition-transform"
                >
                  <ExternalLink size={12} />
                  Read full article
                </button>
              )}
              {/* Pagination */}
              {articles.length > 1 && (
                <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                  Tap for next ({currentIndex + 1}/{articles.length})
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

export default AnalysisArticles;
