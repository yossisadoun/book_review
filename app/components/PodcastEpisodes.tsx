'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Play, Pause, ExternalLink, Minimize2, Maximize2 } from 'lucide-react';
import { decodeHtmlEntities, useImageBrightness, glassmorphicStyle } from './utils';
import { openSystemBrowser } from '@/lib/capacitor';

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
}

function PodcastEpisodes({ episodes, bookId, isLoading = false }: PodcastEpisodesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  const imageBrightness = useImageBrightness(episodes[currentIndex]?.thumbnail);

  const overlayGlassStyle: React.CSSProperties = imageBrightness === 'light'
    ? {
        background: 'rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      }
    : {
        background: 'rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      };

  const pillButtonStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    color: '#334155',
  };

  useEffect(() => {
    setCurrentIndex(0);
    setIsVisible(false);
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioUrl(null);
    }

    if (episodes.length === 0) return;

    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [episodes, bookId]);

  useEffect(() => {
    if (audioRef.current && playingAudioUrl) {
      audioRef.current.pause();
      setPlayingAudioUrl(null);
    }
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  function handleNext() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % episodes.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : episodes.length - 1));
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

  function handlePlay(e: React.MouseEvent, episode: PodcastEpisode) {
    e.stopPropagation();

    const audioUrl = episode.audioUrl || (episode.url && episode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? episode.url : null);

    if (audioUrl) {
      if (playingAudioUrl === audioUrl) {
        if (audioRef.current) {
          audioRef.current.pause();
          setPlayingAudioUrl(null);
        }
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setPlayingAudioUrl(audioUrl);
        audioRef.current = new Audio(audioUrl);
        audioRef.current.addEventListener('ended', () => {
          setPlayingAudioUrl(null);
        });
        audioRef.current.addEventListener('error', () => {
          console.error('[PodcastEpisodes] Audio playback failed, opening URL:', episode.url);
          openSystemBrowser(episode.url);
          setPlayingAudioUrl(null);
        });
        audioRef.current.play();
      }
    } else {
      if (playingAudioUrl === episode.url) {
        setPlayingAudioUrl(null);
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
          setPlayingAudioUrl(null);
        }
        setPlayingAudioUrl(episode.url);
        openSystemBrowser(episode.url);
        setTimeout(() => {
          setPlayingAudioUrl(null);
        }, 1000);
      }
    }
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="aspect-[10/9] rounded-2xl bg-slate-300/50 dark:bg-slate-600/50 animate-pulse" />
      </div>
    );
  }

  if (episodes.length === 0 || currentIndex >= episodes.length) return null;

  const currentEpisode = episodes[currentIndex];
  const audioUrl = currentEpisode.audioUrl || (currentEpisode.url && currentEpisode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? currentEpisode.url : null);
  const isPlaying = playingAudioUrl === (audioUrl || currentEpisode.url);

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
        {episodes.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentEpisode.url}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={glassmorphicStyle}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <Headphones size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Podcasts</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Podcast about this book</p>
                </div>
                {episodes.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-400 flex-shrink-0">
                    {currentIndex + 1}/{episodes.length}
                  </span>
                )}
              </div>
              {/* Image area */}
              <div className="relative aspect-[10/9]">
                {currentEpisode.thumbnail ? (
                  <img
                    src={currentEpisode.thumbnail}
                    alt={decodeHtmlEntities(currentEpisode.title)}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-violet-700 to-violet-950 flex items-center justify-center">
                    <Headphones size={48} className="text-white/30" />
                  </div>
                )}

                {/* Play button — opens podcast */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openSystemBrowser(currentEpisode.url);
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

                <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

                {/* Floating glassmorphic overlay */}
                <div
                  className="absolute inset-x-3 bottom-3 rounded-xl px-3 py-2.5 overflow-hidden"
                  style={overlayGlassStyle}
                >
                  {/* Title + toggle */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-sm font-bold text-white flex-1 min-w-0 ${isMinimized ? 'line-clamp-1' : 'line-clamp-2'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                      {decodeHtmlEntities(currentEpisode.title)}
                    </h3>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsMinimized(prev => !prev); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                      style={{ background: 'rgba(255, 255, 255, 0.25)' }}
                    >
                      {isMinimized ? <Maximize2 size={12} className="text-white/80" /> : <Minimize2 size={12} className="text-white/80" />}
                    </button>
                  </div>

                  {/* Expandable content */}
                  <AnimatePresence initial={false}>
                    {!isMinimized && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden mt-0.5"
                      >
                        <p className="text-xs text-white/80" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                          {decodeHtmlEntities(currentEpisode.podcast_name || 'Podcast')}
                          {currentEpisode.length && ` • ${currentEpisode.length}`}
                        </p>

                        {currentEpisode.episode_summary && (
                          <p className="text-xs text-white/70 line-clamp-6 mt-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                            {decodeHtmlEntities(currentEpisode.episode_summary)}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Button row — always visible */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handlePlay(e, currentEpisode)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95"
                        style={{
                          background: 'rgba(59, 130, 246, 0.85)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: 'white',
                        }}
                      >
                        {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} className="ml-0.5" fill="white" />}
                        {isPlaying ? 'Pause' : 'Preview'}
                      </button>
                      {currentEpisode.url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openSystemBrowser(currentEpisode.url);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95"
                          style={pillButtonStyle}
                        >
                          <ExternalLink size={14} />
                          Podcast
                        </button>
                      )}
                    </div>
                    {currentEpisode.length && (
                      <span className="text-xs text-white/70 font-medium" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                        {currentEpisode.length}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default PodcastEpisodes;
