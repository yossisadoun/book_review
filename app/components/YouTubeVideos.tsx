'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, MessageCircle, Send, StickyNote } from 'lucide-react';
import { openSystemBrowser, openDeepLink, isNativePlatform } from '@/lib/capacitor';
import { useImageBrightness } from './utils';
import { analytics } from '../services/analytics-service';

const frostedGlassStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.25)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '16px',
};

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  videoId: string;
  duration?: string;
}

interface YouTubeVideosProps {
  videos: YouTubeVideo[];
  bookId: string;
  isLoading?: boolean;
  renderAction?: (index: number) => React.ReactNode;
  onPin?: (index: number) => void;
  isPinned?: (index: number) => boolean;
  showComment?: boolean;
  showSend?: boolean;
}

const YouTubeVideos = React.memo(function YouTubeVideos({ videos, bookId, isLoading = false, renderAction, onPin, isPinned, showComment = true, showSend = true }: YouTubeVideosProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isSingleItem = videos.length === 1;
  const [isVisible, setIsVisible] = useState(isSingleItem);
  const [descExpanded, setDescExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  const imageBrightness = useImageBrightness(videos[currentIndex]?.thumbnail);

  useEffect(() => {
    setCurrentIndex(0);
    setDescExpanded(false);

    if (videos.length === 0) {
      setIsVisible(false);
      return;
    }

    if (videos.length === 1) {
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [bookId]);

  function handleNext() {
    analytics.trackEvent('youtube', 'next_card');
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % videos.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : videos.length - 1));
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

  if (videos.length === 0 || currentIndex >= videos.length) {
    return (
      <div className="w-full">
        <div className="rounded-xl p-4" style={frostedGlassStyle}>
          <p className="text-xs text-slate-600 dark:text-slate-400 text-center">No videos found</p>
        </div>
      </div>
    );
  }

  const currentVideo = videos[currentIndex];
  const videoUrl = `https://www.youtube.com/watch?v=${currentVideo.videoId}`;
  const pinned = !!isPinned?.(currentIndex);

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
        {videos.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentVideo.videoId}-${currentIndex}`}
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
                  <Play size={20} className="text-slate-600 dark:text-slate-300 ml-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Videos</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Videos about the book and its author</p>
                </div>
                {videos.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {currentIndex + 1}/{videos.length}
                  </span>
                )}
              </div>
              {/* Image area */}
              <div className="relative aspect-video bg-black">
                {currentVideo.thumbnail ? (
                  <img
                    src={currentVideo.thumbnail}
                    alt={currentVideo.title}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
                    <Play size={48} className="text-white/30" />
                  </div>
                )}

                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      analytics.trackEvent('youtube', 'play', { video_title: currentVideo.title, channel: currentVideo.channelTitle });
                      if (isNativePlatform) {
                        openDeepLink(videoUrl);
                      } else {
                        openSystemBrowser(videoUrl);
                      }
                    }}
                    className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
                    style={{
                      background: 'rgba(255, 255, 255, 0.25)',
                      backdropFilter: 'blur(9.4px)',
                      WebkitBackdropFilter: 'blur(9.4px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <Play size={24} className="text-white ml-0.5" fill="white" />
                  </button>
                </div>

                {/* Bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                {/* Duration overlay */}
                {currentVideo.duration && (
                  <div className="absolute inset-x-3 bottom-3">
                    <p className={`text-xs font-medium ${imageBrightness === 'light' ? 'text-black/80' : 'text-white/80'}`}>{currentVideo.duration}</p>
                  </div>
                )}
              </div>

              {/* Info below thumbnail */}
              <div className="px-4 py-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                  {currentVideo.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {currentVideo.channelTitle}
                  {currentVideo.publishedAt && ` · ${new Date(currentVideo.publishedAt).getFullYear()}`}
                </p>

                {currentVideo.description && (
                  <>
                    <p className={`text-xs text-slate-600 dark:text-slate-400 mt-1.5 ${descExpanded ? '' : 'line-clamp-2'}`}>
                      {currentVideo.description}
                    </p>
                    {currentVideo.description.length > 100 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDescExpanded(prev => !prev); }}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1"
                      >
                        {descExpanded ? 'Read less' : 'Read more'}
                      </button>
                    )}
                  </>
                )}

                {/* Action bar */}
                <div className="flex items-center gap-5 mt-2.5 pb-1" onClick={(e) => e.stopPropagation()}>
                  {renderAction && renderAction(currentIndex)}
                  {onPin && <button onClick={() => onPin(currentIndex)} className="active:scale-90 transition-transform"><StickyNote size={17} fill={pinned ? 'currentColor' : 'none'} className={pinned ? 'text-amber-400 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'} /></button>}
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

export default YouTubeVideos;
