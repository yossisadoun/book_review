'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ExternalLink } from 'lucide-react';
import { decodeHtmlEntities } from './utils';
import { openSystemBrowser } from '@/lib/capacitor';

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

  const glassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

  const overlayGlassStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.25)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  };

  useEffect(() => {
    setCurrentIndex(0);
    setIsVisible(false);

    if (articles.length === 0) return;

    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [articles, bookId]);

  function handleNext() {
    setIsVisible(false);
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
        <div className="aspect-[10/9] rounded-2xl bg-slate-300/50 animate-pulse" />
      </div>
    );
  }

  if (articles.length === 0 || currentIndex >= articles.length) return null;

  const currentArticle = articles[currentIndex];

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
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">Articles</p>
                  <p className="text-xs text-slate-500">Academic article about this book</p>
                </div>
                {articles.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-400 flex-shrink-0">
                    {currentIndex + 1}/{articles.length}
                  </span>
                )}
              </div>
              {/* Image area — gradient background since articles have no photo */}
              <div className="relative aspect-[10/9]">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-800 to-slate-900 flex items-center justify-center">
                  <FileText size={48} className="text-white/15" />
                </div>

                <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent" />

                {/* Floating glassmorphic overlay — always maximized, fills image area */}
                <div
                  className="absolute inset-3 rounded-xl px-3 py-2.5 overflow-hidden flex flex-col"
                  style={overlayGlassStyle}
                >
                  {/* Title */}
                  <h3 className="text-sm font-bold text-white line-clamp-3" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                    {decodeHtmlEntities(currentArticle.title)}
                  </h3>

                  {/* Authors + year */}
                  {(currentArticle.authors || currentArticle.year) && (
                    <p className="text-xs text-white/80 mt-0.5" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                      {currentArticle.authors && decodeHtmlEntities(currentArticle.authors)}
                      {currentArticle.year && ` • ${currentArticle.year}`}
                    </p>
                  )}

                  {/* Snippet — fills remaining space */}
                  {currentArticle.snippet && (
                    <p className="text-xs text-white/70 mt-1 flex-1 overflow-hidden" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)', display: '-webkit-box', WebkitLineClamp: 20, WebkitBoxOrient: 'vertical' }}>
                      {decodeHtmlEntities(currentArticle.snippet)}
                    </p>
                  )}

                  {/* Button row */}
                  {currentArticle.url && (
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openSystemBrowser(currentArticle.url);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95"
                        style={{
                          background: 'rgba(59, 130, 246, 0.85)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: 'white',
                        }}
                      >
                        <ExternalLink size={14} />
                        Read Article
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AnalysisArticles;
