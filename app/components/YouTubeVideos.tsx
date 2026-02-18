'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play } from 'lucide-react';
import { openSystemBrowser } from '@/lib/capacitor';

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  videoId: string;
}

interface YouTubeVideosProps {
  videos: YouTubeVideo[];
  bookId: string;
  isLoading?: boolean;
}

function YouTubeVideos({ videos, bookId, isLoading = false }: YouTubeVideosProps) {
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

    if (videos.length === 0) return;

    // Show first video after a short delay
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [videos, bookId]);

  function handleNext() {
    setIsVisible(false);
    // Wait for fade out, then show next (or loop back to first)
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
          className="rounded-xl overflow-hidden"
          style={glassmorphicStyle}
        >
          <div className="relative w-full bg-slate-300/50 animate-pulse" style={{ paddingBottom: '56.25%' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Play size={32} className="text-slate-400/50" />
            </div>
          </div>
          <div className="p-4 space-y-2">
            <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (videos.length === 0 || currentIndex >= videos.length) {
    return (
      <div className="w-full">
        <div className="rounded-xl p-4" style={glassmorphicStyle}>
          <p className="text-xs text-slate-600 text-center">No videos found</p>
        </div>
      </div>
    );
  }

  const currentVideo = videos[currentIndex];
  const videoUrl = `https://www.youtube.com/watch?v=${currentVideo.videoId}`;

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
              style={glassmorphicStyle}
            >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <Play size={20} className="text-white ml-0.5" fill="white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">Videos</p>
                <p className="text-xs text-slate-500">Videos about the book and its author</p>
              </div>
            </div>
            {/* Content */}
            <div className="px-4 pb-4">
              {/* Thumbnail with play button - works on iOS */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openSystemBrowser(videoUrl);
                }}
                className="relative w-full block rounded-xl overflow-hidden"
                style={{ paddingBottom: '56.25%' }}
              >
                {currentVideo.thumbnail ? (
                  <img
                    src={currentVideo.thumbnail}
                    alt={currentVideo.title}
                    className="absolute top-0 left-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute top-0 left-0 w-full h-full bg-slate-300 flex items-center justify-center">
                    <Play size={48} className="text-slate-500" />
                  </div>
                )}
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 active:bg-black/40 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                    <Play size={32} className="text-white ml-1" fill="white" />
                  </div>
                </div>
              </button>
              <div className="mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openSystemBrowser(videoUrl);
                  }}
                  className="text-sm font-bold text-slate-900 block mb-1 line-clamp-2 text-left"
                >
                  {currentVideo.title}
                </button>
                <div className="text-xs text-slate-500 mb-2">
                  <span>{currentVideo.channelTitle}</span>
                  {currentVideo.publishedAt && (
                    <span> • {new Date(currentVideo.publishedAt).getFullYear()}</span>
                  )}
                </div>
                {currentVideo.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {currentVideo.description}
                  </p>
                )}
              </div>
              {/* Pagination */}
              {videos.length > 1 && (
                <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                  Tap for next ({currentIndex + 1}/{videos.length})
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

export default YouTubeVideos;
