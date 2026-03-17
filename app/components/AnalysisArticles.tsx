'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, MessageCircle, Send, StickyNote } from 'lucide-react';
import { decodeHtmlEntities } from './utils';
import { openSystemBrowser } from '@/lib/capacitor';
import { analytics } from '../services/analytics-service';

const frostedGlassStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.25)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '16px',
};

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
  renderAction?: (index: number) => React.ReactNode;
  onPin?: (index: number) => void;
  isPinned?: (index: number) => boolean;
  showComment?: boolean;
  showSend?: boolean;
}

const AnalysisArticles = React.memo(function AnalysisArticles({ articles, bookId, isLoading = false, renderAction, onPin, isPinned, showComment = true, showSend = true }: AnalysisArticlesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isSingleItem = articles.length === 1;
  const [isVisible, setIsVisible] = useState(isSingleItem);
  const [descExpanded, setDescExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  // Use a stable key based on content, not array reference, to avoid flickering
  const articlesKey = articles.map(a => a.url).join('|');
  useEffect(() => {
    setCurrentIndex(0);
    setDescExpanded(false);

    if (articles.length === 0) {
      setIsVisible(false);
      return;
    }

    // Single item (e.g. spotlight) — show immediately, no entrance delay
    if (articles.length === 1) {
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articlesKey, bookId]);

  function handleNext() {
    analytics.trackEvent('articles', 'next_card');
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
        <div className="aspect-[10/9] rounded-2xl bg-slate-300/50 dark:bg-slate-600/50 animate-pulse" />
      </div>
    );
  }

  if (articles.length === 0 || currentIndex >= articles.length) return null;

  const currentArticle = articles[currentIndex];
  const articleDomain = (() => {
    try { return new URL(currentArticle.url || '').hostname.replace('www.', ''); } catch { return ''; }
  })();

  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...frostedGlassStyle,
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
              style={frostedGlassStyle}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                  <FileText size={20} className="text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Articles</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Academic article about this book</p>
                </div>
                {articles.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {currentIndex + 1}/{articles.length}
                  </span>
                )}
              </div>

              {/* Article link preview card (feed-style) */}
              <div className="px-4 pb-3">
                {currentArticle.url && (
                  <p className="text-[13px] mb-2">
                    <a
                      href={currentArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 block truncate"
                      onClick={(e) => { e.stopPropagation(); openSystemBrowser(currentArticle.url); e.preventDefault(); }}
                    >
                      {currentArticle.url}
                    </a>
                  </p>
                )}
                <div
                  className="w-full rounded-xl overflow-hidden"
                  style={{ background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}
                  onClick={(e) => { e.stopPropagation(); analytics.trackEvent('articles', 'tap', { article_title: currentArticle.title }); openSystemBrowser(currentArticle.url); }}
                >
                  <div className="px-3.5 py-3">
                    {articleDomain && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <img src={`https://www.google.com/s2/favicons?domain=${articleDomain}&sz=32`} alt="" className="w-4 h-4 rounded-sm" />
                        <span className="text-[13px] text-slate-500 dark:text-slate-400">{articleDomain}</span>
                      </div>
                    )}
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-[15px] leading-snug line-clamp-2">
                      {decodeHtmlEntities(currentArticle.title)}
                    </p>
                    {(currentArticle.authors || currentArticle.year) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {currentArticle.authors && decodeHtmlEntities(currentArticle.authors)}
                        {currentArticle.year && ` · ${currentArticle.year}`}
                      </p>
                    )}
                    {currentArticle.snippet && (
                      <p className={`text-[13px] text-slate-500 dark:text-slate-400 mt-1 ${descExpanded ? '' : 'line-clamp-2'}`}>
                        {decodeHtmlEntities(currentArticle.snippet)}
                      </p>
                    )}
                    {currentArticle.snippet && currentArticle.snippet.length > 100 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDescExpanded(prev => !prev); }}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1"
                      >
                        {descExpanded ? 'Read less' : 'Read more'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Action bar */}
                <div className="flex items-center gap-5 mt-2.5 pb-1" onClick={(e) => e.stopPropagation()}>
                  {renderAction && renderAction(currentIndex)}
                  {onPin && <button onClick={() => onPin(currentIndex)} className="active:scale-90 transition-transform"><StickyNote size={17} fill={isPinned?.(currentIndex) ? '#fbbf24' : 'none'} className="text-slate-600 dark:text-slate-400" /></button>}
                  {showComment && <span className="flex items-center gap-1"><MessageCircle size={17} className="text-slate-600 dark:text-slate-400" /><span className="text-xs font-medium min-w-[12px] invisible">0</span></span>}
                  {showSend && <Send size={17} className="text-slate-600 dark:text-slate-400" />}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default AnalysisArticles;
