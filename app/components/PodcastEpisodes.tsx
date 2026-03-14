'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Play, Pause, MessageCircle, Send } from 'lucide-react';
import { decodeHtmlEntities, useImageBrightness } from './utils';
import { openSystemBrowser, openDeepLink, isNativePlatform } from '@/lib/capacitor';
import { createPortal } from 'react-dom';

const ApplePodcastsIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0zm6.525 2.568c4.988 0 8.93 3.637 9.32 8.378a.19.19 0 01-.19.208h-1.758a.19.19 0 01-.187-.163 7.26 7.26 0 00-7.186-6.298 7.26 7.26 0 00-7.186 6.298.19.19 0 01-.186.163H2.733a.19.19 0 01-.19-.208c.39-4.741 4.333-8.378 9.321-8.378zm.058 3.39a5.608 5.608 0 015.265 3.87.19.19 0 01-.18.252h-1.762a.19.19 0 01-.176-.12 3.578 3.578 0 00-6.294 0 .19.19 0 01-.176.12H6.833a.19.19 0 01-.18-.253 5.608 5.608 0 015.27-3.868zm-.033 3.39a2.25 2.25 0 110 4.5 2.25 2.25 0 010-4.5zm-.024 5.719c1.024 0 1.854.83 1.854 1.854v2.688c0 1.024-.83 1.854-1.854 1.854a1.854 1.854 0 01-1.854-1.854V16.92c0-1.024.83-1.854 1.854-1.854z"/>
  </svg>
);

interface PodcastEpisode {
  title: string;
  length?: string;
  air_date?: string;
  url: string;
  audioUrl?: string;
  platform: string;
  podcast_name?: string;
  episode_summary: string;
  podcast_summary: string;
  thumbnail?: string;
}

interface PodcastEpisodesProps {
  episodes: PodcastEpisode[];
  bookId: string;
  isLoading?: boolean;
  renderAction?: (index: number) => React.ReactNode;
  showComment?: boolean;
  showSend?: boolean;
}

function PodcastEpisodes({ episodes, bookId, isLoading = false, renderAction, showComment = true, showSend = true }: PodcastEpisodesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [showTooltips, setShowTooltips] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const minSwipeDistance = 50;

  const episodesKey = useMemo(() => episodes.map(e => e.url).join('|'), [episodes]);
  const imageBrightness = useImageBrightness(episodes[currentIndex]?.thumbnail);

  useEffect(() => {
    setCurrentIndex(0);
    setDescExpanded(false);
    setShowTooltips(false);
    stopAudio();
  }, [episodesKey, bookId]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioPlaying(false);
  }, []);

  function handleNext() {
    stopAudio();
    setShowTooltips(false);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % episodes.length);
      setIsTransitioning(false);
    }, 300);
  }

  function handlePrev() {
    stopAudio();
    setShowTooltips(false);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : episodes.length - 1));
      setIsTransitioning(false);
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

  const handleTogglePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltips(false);
    const episode = episodes[currentIndex];
    if (!episode?.audioUrl) return;

    if (audioPlaying) {
      stopAudio();
    } else {
      const audio = new Audio(episode.audioUrl);
      audio.onended = () => setAudioPlaying(false);
      audio.onerror = () => {
        // Fallback: open podcast URL in system browser (e.g. iOS WebView audio restrictions)
        if (isNativePlatform) { openDeepLink(episode.url); } else { openSystemBrowser(episode.url); }
        setAudioPlaying(false);
      };
      audio.play().catch(() => {
        if (isNativePlatform) { openDeepLink(episode.url); } else { openSystemBrowser(episode.url); }
        setAudioPlaying(false);
      });
      audioRef.current = audio;
      setAudioPlaying(true);
    }
  };

  const handleOpenPodcast = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltips(false);
    if (isNativePlatform) {
      openDeepLink(episodes[currentIndex].url);
    } else {
      openSystemBrowser(episodes[currentIndex].url);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="aspect-[10/9] rounded-2xl bg-slate-300/50 dark:bg-slate-600/50 animate-pulse" />
      </div>
    );
  }

  if (episodes.length === 0 || currentIndex >= episodes.length) return null;

  const currentEpisode = episodes[currentIndex];
  const hasPreview = !!currentEpisode.audioUrl;

  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    background: 'rgba(255, 255, 255, 0.25)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

  // Tooltip positions: fan out above play button (cached in state for portal rendering)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const tooltipItems: { key: string; icon: React.ReactNode; color: string; onClick: (e: React.MouseEvent) => void }[] = [];

  if (hasPreview) {
    tooltipItems.push({
      key: 'preview',
      icon: audioPlaying ? <span className="text-white text-xs font-bold">■</span> : <Headphones size={18} className="text-white" />,
      color: '#8B5CF6',
      onClick: handleTogglePreview,
    });
  }
  tooltipItems.push({
    key: 'apple',
    icon: <ApplePodcastsIcon />,
    color: '#9933CC',
    onClick: handleOpenPodcast,
  });

  const tooltipCount = tooltipItems.length;
  const radius = 70;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const angleStep = tooltipCount > 1 ? (endAngle - startAngle) / (tooltipCount - 1) : 0;

  const getPosition = (index: number) => {
    const angle = tooltipCount > 1 ? startAngle + angleStep * index : 1.5 * Math.PI;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  return (
    <div
      onClick={handleNext}
      onTouchStart={(e) => {
        if (showTooltips) { setShowTooltips(false); return; }
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
        {episodes.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <div
          key={`${currentEpisode.url}-${currentIndex}`}
          className="relative rounded-2xl overflow-hidden transition-opacity duration-300"
          style={{
            background: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(9.4px)',
            WebkitBackdropFilter: 'blur(9.4px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '16px',
            opacity: isTransitioning ? 0 : 1,
          }}
        >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                  <Headphones size={20} className="text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Podcasts</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">Podcast about this book</p>
                </div>
                {episodes.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {currentIndex + 1}/{episodes.length}
                  </span>
                )}
              </div>
              {/* Image area */}
              <div className="relative flex items-start justify-center pt-3 pb-3">
                <div className="relative w-[60%] aspect-square rounded-xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)' }}>
                {currentEpisode.thumbnail ? (
                  <img
                    src={currentEpisode.thumbnail}
                    alt={decodeHtmlEntities(currentEpisode.title)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-violet-700 to-violet-950 flex items-center justify-center">
                    <Headphones size={48} className="text-white/30" />
                  </div>
                )}

                {/* Play button — opens tooltips or shows pause when previewing */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <button
                    ref={playButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (audioPlaying) {
                        stopAudio();
                      } else {
                        const rect = playButtonRef.current?.getBoundingClientRect();
                        if (rect) setAnchorRect(rect);
                        setShowTooltips(prev => !prev);
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
                    {audioPlaying ? (
                      <Pause size={24} className="text-white" fill="white" />
                    ) : (
                      <Play size={24} className="text-white ml-0.5" fill="white" />
                    )}
                  </button>
                  {audioPlaying && (
                    <span className="text-[10px] font-semibold text-white mt-1 drop-shadow-md">Preview</span>
                  )}
                </div>
                {/* Bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                {/* Overlay info */}
                <div className="absolute inset-x-3 bottom-3">
                  {currentEpisode.length && (
                    <p className={`text-xs font-medium ${imageBrightness === 'light' ? 'text-black/80' : 'text-white/80'}`}>{currentEpisode.length}</p>
                  )}
                </div>
                </div>

              </div>

              {/* Info below thumbnail */}
              <div className="px-4 py-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                  {decodeHtmlEntities(currentEpisode.title)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {decodeHtmlEntities(currentEpisode.podcast_name || 'Podcast')}
                </p>

                {currentEpisode.episode_summary && (
                  <>
                    <p className={`text-xs text-slate-600 dark:text-slate-400 mt-1.5 ${descExpanded ? '' : 'line-clamp-2'}`}>
                      {decodeHtmlEntities(currentEpisode.episode_summary)}
                    </p>
                    {currentEpisode.episode_summary.length > 100 && (
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
                <div className="flex items-center gap-6 mt-2.5 pb-1" onClick={(e) => e.stopPropagation()}>
                  {renderAction && renderAction(currentIndex)}
                  {showComment && <MessageCircle size={17} className="text-slate-600 dark:text-slate-400" />}
                  {showSend && <Send size={17} className="text-slate-600 dark:text-slate-400" />}
                </div>
              </div>
        </div>
      </div>

      {/* Tooltip fan-out from play button — portaled to body so it isn't clipped by scroll containers on iOS */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showTooltips && anchorRect && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9998]"
                onClick={(e) => { e.stopPropagation(); setShowTooltips(false); }}
              />
              {tooltipItems.map((item, i) => {
                const pos = getPosition(i);
                const centerX = anchorRect.left + anchorRect.width / 2;
                const centerY = anchorRect.top + anchorRect.height / 2;

                return (
                  <motion.button
                    key={item.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, delay: i * 0.02 }}
                    onClick={item.onClick}
                    className="fixed z-[9999] w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                    style={{
                      left: centerX + pos.x - 22,
                      top: centerY + pos.y - 22,
                      background: item.color,
                      boxShadow: '0 3px 12px rgba(0,0,0,0.3)',
                    }}
                  >
                    {item.icon}
                  </motion.button>
                );
              })}
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

export default PodcastEpisodes;
