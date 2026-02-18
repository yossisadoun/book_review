'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Play, VolumeX, ExternalLink } from 'lucide-react';
import { decodeHtmlEntities } from './utils';

interface PodcastEpisode {
  title: string;
  length?: string;
  air_date?: string;
  url: string;
  audioUrl?: string; // Direct audio URL for playback (from Apple Podcasts episodeUrl)
  platform: string;
  podcast_name?: string; // Name of the podcast show
  episode_summary: string;
  podcast_summary: string;
  thumbnail?: string; // Episode or show thumbnail image URL
}

interface PodcastEpisodesProps {
  episodes: PodcastEpisode[];
  bookId: string;
  isLoading?: boolean;
}

function PodcastEpisodes({ episodes, bookId, isLoading = false }: PodcastEpisodesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
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

    // Pause any playing audio when book changes
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioUrl(null);
    }

    if (episodes.length === 0) return;

    // Show first episode after a short delay
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [episodes, bookId]);

  // Pause audio when switching to a different episode card
  useEffect(() => {
    if (audioRef.current && playingAudioUrl) {
      audioRef.current.pause();
      setPlayingAudioUrl(null);
    }
  }, [currentIndex]);

  function handleNext() {
    setIsVisible(false);
    setIsTextExpanded(false);
    // Wait for fade out, then show next (or loop back to first)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % episodes.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setIsTextExpanded(false);
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
        handleNext(); // Swipe left = next
      } else {
        handlePrev(); // Swipe right = prev
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  function handlePlay(e: React.MouseEvent, episode: PodcastEpisode) {
    e.stopPropagation(); // Prevent card tap navigation

    // Use audioUrl if available, otherwise try to use the URL directly if it's an audio file
    const audioUrl = episode.audioUrl || (episode.url && episode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? episode.url : null);
    const playableUrl = audioUrl || episode.url;

    if (audioUrl) {
      // If we have a direct audio URL, use HTML5 audio player
      if (playingAudioUrl === audioUrl) {
        // If already playing, pause it
        if (audioRef.current) {
          audioRef.current.pause();
          setPlayingAudioUrl(null);
        }
      } else {
        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
        }

        // Play new audio
        setPlayingAudioUrl(audioUrl);
        // Create new audio element for each episode
        audioRef.current = new Audio(audioUrl);
        audioRef.current.addEventListener('ended', () => {
          setPlayingAudioUrl(null);
        });
        audioRef.current.addEventListener('error', () => {
          // If audio fails, fall back to opening URL
          console.error('[PodcastEpisodes] Audio playback failed, opening URL:', episode.url);
          window.open(episode.url, '_blank');
          setPlayingAudioUrl(null);
        });
        audioRef.current.play();
      }
    } else {
      // No direct audio URL (e.g., Grok podcasts with web page URLs)
      // Toggle: if already "playing" (opened), close it; otherwise open in new tab
      if (playingAudioUrl === episode.url) {
        // Already opened, just clear the state
        setPlayingAudioUrl(null);
      } else {
        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          setPlayingAudioUrl(null);
        }
        // Open URL in new tab and mark as "playing" so button shows pause state
        setPlayingAudioUrl(episode.url);
        window.open(episode.url, '_blank');
        // Clear after a short delay since we can't actually pause an opened tab
        setTimeout(() => {
          setPlayingAudioUrl(null);
        }, 1000);
      }
    }
  }

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-xl p-4"
          style={glassmorphicStyle}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 bg-slate-300/50 rounded-lg animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
              <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-2/3 h-3 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (episodes.length === 0 || currentIndex >= episodes.length) return null;

  const currentEpisode = episodes[currentIndex];
  const audioUrl = currentEpisode.audioUrl || (currentEpisode.url && currentEpisode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? currentEpisode.url : null);
  const isPlaying = playingAudioUrl === (audioUrl || currentEpisode.url);

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
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">Podcasts</p>
                <p className="text-xs text-slate-500">Podcast about this book</p>
              </div>
            </div>
            {/* Content */}
            <div className="px-4 pb-4">
              <div className="flex gap-3 mb-3">
                {/* Podcast thumbnail */}
                <div className="relative w-20 h-20 flex-shrink-0">
                  {currentEpisode.thumbnail ? (
                    <img src={currentEpisode.thumbnail} alt={currentEpisode.title} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center">
                      <Headphones size={28} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm line-clamp-2">{decodeHtmlEntities(currentEpisode.title)}</p>
                  <p className="text-xs text-slate-500 mt-1">{decodeHtmlEntities(currentEpisode.podcast_name || 'Podcast')}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={(e) => handlePlay(e, currentEpisode)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium active:scale-95 transition-transform"
                    >
                      {isPlaying ? (
                        <>
                          <VolumeX size={12} />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play size={12} />
                          Preview
                        </>
                      )}
                    </button>
                    {currentEpisode.url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(currentEpisode.url, '_blank');
                        }}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium active:scale-95 transition-transform"
                      >
                        <ExternalLink size={12} />
                        Link
                      </button>
                    )}
                    {currentEpisode.length && (
                      <span className="text-xs text-slate-400">{currentEpisode.length}</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Episode description with read-more */}
              {currentEpisode.episode_summary && (
                <div className="mt-2">
                  <p
                    className={`text-sm text-slate-700 leading-relaxed ${!isTextExpanded ? 'line-clamp-2' : ''}`}
                    onClick={(e) => {
                      if (currentEpisode.episode_summary && currentEpisode.episode_summary.length > 100) {
                        e.stopPropagation();
                        setIsTextExpanded(!isTextExpanded);
                      }
                    }}
                  >
                    {decodeHtmlEntities(currentEpisode.episode_summary)}
                  </p>
                  {currentEpisode.episode_summary.length > 100 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTextExpanded(!isTextExpanded);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                    >
                      {isTextExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}
              {/* Pagination */}
              {episodes.length > 1 && (
                <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                  Tap for next ({currentIndex + 1}/{episodes.length})
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

export default PodcastEpisodes;
