'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Play, Disc3, ExternalLink, Minimize2, Maximize2 } from 'lucide-react';
import { decodeHtmlEntities, useImageBrightness, glassmorphicStyle } from './utils';
import { isNativePlatform } from '@/lib/capacitor';
import { openSystemBrowser } from '@/lib/capacitor';
import MusicModal from './MusicModal';
import type { MusicLinks } from '../types';

interface RelatedMovie {
  title: string;
  director: string;
  reason: string;
  type: 'movie' | 'show' | 'album';
  poster_url?: string;
  release_year?: number;
  genre?: string;
  wikipedia_url?: string;
  itunes_url?: string;
  itunes_artwork?: string;
  music_links?: MusicLinks;
}

interface RelatedMoviesProps {
  movies: RelatedMovie[];
  bookId: string;
  isLoading?: boolean;
}

function RelatedMovies({ movies, bookId, isLoading = false }: RelatedMoviesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [albumCoverLoaded, setAlbumCoverLoaded] = useState(false);
  const [musicModalData, setMusicModalData] = useState<{ musicLinks: MusicLinks; title: string; artist: string } | null>(null);
  const minSwipeDistance = 50;

  const shuffledMovies = useMemo(() => {
    const arr = movies.filter(m => m.type !== 'album' || m.itunes_url);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [movies]);

  const currentPosterUrl = (shuffledMovies[currentIndex]?.type === 'album' && shuffledMovies[currentIndex]?.itunes_artwork) || shuffledMovies[currentIndex]?.poster_url;
  const imageBrightness = useImageBrightness(currentPosterUrl);

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

  useEffect(() => {
    setCurrentIndex(0);
    setIsVisible(false);
    setIsMinimized(true);
    setAlbumCoverLoaded(false);

    if (shuffledMovies.length === 0) return;

    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [shuffledMovies, bookId]);


  function handleNext() {
    setIsVisible(false);
    setAlbumCoverLoaded(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % shuffledMovies.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setAlbumCoverLoaded(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : shuffledMovies.length - 1));
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
        <div className="aspect-[5/6] rounded-2xl bg-slate-300/50 dark:bg-slate-600/50 animate-pulse" />
      </div>
    );
  }

  if (shuffledMovies.length === 0 || currentIndex >= shuffledMovies.length) {
    return (
      <div className="w-full">
        <div className="rounded-xl p-4" style={glassmorphicStyle}>
          <p className="text-xs text-slate-600 dark:text-slate-400 text-center">No related movies or shows found</p>
        </div>
      </div>
    );
  }

  const currentMovie = shuffledMovies[currentIndex];

  const TypeIcon = currentMovie.type === 'album' ? Disc3 : currentMovie.type === 'movie' ? Film : Play;

  const badgeColor = currentMovie.type === 'album'
    ? 'rgba(236, 72, 153, 0.6)'
    : currentMovie.type === 'movie'
      ? 'rgba(99, 102, 241, 0.6)'
      : 'rgba(168, 85, 247, 0.6)';

  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...glassmorphicStyle,
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

  const pillButtonStyle: React.CSSProperties = {
    background: 'rgba(59, 130, 246, 0.85)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    color: 'white',
  };

  return (
    <div
      onClick={() => { if (!musicModalData) handleNext(); }}
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
        {shuffledMovies.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentMovie.title}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={glassmorphicStyle}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  <Film size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Related Work</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Movies, shows & music related to this book</p>
                </div>
                {shuffledMovies.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-400 flex-shrink-0">
                    {currentIndex + 1}/{shuffledMovies.length}
                  </span>
                )}
              </div>
              {/* Image area */}
              <div className="relative aspect-[5/6]">
              {currentMovie.type === 'album' ? (
                /* Vinyl record layout for albums */
                <div className="absolute inset-0 flex items-start justify-center pt-3">
                  <div className="relative w-[57%] aspect-square transition-opacity duration-500" style={{ transform: 'translateX(calc(-13.5% - 15px)) translateY(27px)', opacity: albumCoverLoaded || !(currentMovie.itunes_artwork || currentMovie.poster_url) ? 1 : 0, zIndex: 25 }}>
                    {/* Vinyl Record (behind sleeve) */}
                    <div
                      className="absolute z-10 w-[90%] aspect-square top-[5%]"
                      style={{ transform: 'translateX(calc(40% + 30px))' }}
                    >
                    <div
                      className="w-full aspect-square rounded-full animate-[vinyl-spin_3s_linear_infinite]"
                      style={{
                        background: 'radial-gradient(circle, #222 0%, #111 40%, #000 100%)',
                        boxShadow: '0 0 40px rgba(0,0,0,0.8)',
                      }}
                    >
                      {/* Grooves */}
                      <div
                        className="absolute inset-0 rounded-full opacity-40 pointer-events-none"
                        style={{ background: 'repeating-radial-gradient(circle, transparent 0, transparent 2px, rgba(255,255,255,0.03) 3px, transparent 4px)' }}
                      />
                      {/* Center label */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 aspect-square rounded-full bg-zinc-800 border-4 border-black/20 overflow-hidden shadow-inner flex items-center justify-center">
                        {(currentMovie.itunes_artwork || currentMovie.poster_url) && (
                          <div
                            className="absolute inset-0 bg-center bg-cover opacity-80"
                            style={{ backgroundImage: `url('${currentMovie.itunes_artwork || currentMovie.poster_url}')` }}
                          />
                        )}
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="z-20 w-3 h-3 bg-zinc-950 rounded-full border border-white/10 shadow-inner" />
                      </div>
                    </div>
                    </div>

                    {/* Album Sleeve (on top) */}
                    <div
                      className="absolute z-20 w-full h-full rounded-sm overflow-hidden"
                      style={{ boxShadow: '15px 15px 50px rgba(0,0,0,0.7)' }}
                    >
                      {(currentMovie.itunes_artwork || currentMovie.poster_url) ? (
                        <img
                          src={currentMovie.itunes_artwork || currentMovie.poster_url!}
                          alt={decodeHtmlEntities(currentMovie.title)}
                          className="absolute inset-0 w-full h-full object-cover"
                          onLoad={() => setAlbumCoverLoaded(true)}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-b from-pink-800 to-pink-950 flex items-center justify-center">
                          <Disc3 size={48} className="text-white/30" />
                        </div>
                      )}
                      {/* Edge shadow on right side */}
                      <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-black/30 to-transparent z-30" />
                    </div>
                    {/* Play overlay — centered on sleeve + vinyl */}
                    {currentMovie.itunes_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isNativePlatform && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
                            openSystemBrowser(currentMovie.itunes_url!);
                          } else if (currentMovie.music_links) {
                            setMusicModalData({ musicLinks: currentMovie.music_links, title: currentMovie.title, artist: currentMovie.director });
                          } else {
                            window.open(`https://song.link/${currentMovie.itunes_url}`, '_blank');
                          }
                        }}
                        className="absolute z-30 w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                        style={{
                          top: '50%',
                          left: 'calc(50% + 18%)',
                          transform: 'translate(-50%, -50%)',
                          background: 'rgba(255, 255, 255, 0.25)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                        }}
                      >
                        <Play size={20} className="text-white ml-0.5" fill="white" />
                      </button>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                </div>
              ) : currentMovie.type === 'movie' ? (
                /* Worn poster layout for movies */
                <div className="absolute inset-0 flex items-start justify-center pt-3">
                  <div className="relative transition-opacity duration-500" style={{ width: '65%', opacity: albumCoverLoaded || !currentMovie.poster_url ? 1 : 0 }}>
                    <div
                      className="relative overflow-visible"
                      style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5)', filter: 'drop-shadow(2px 3px 6px rgba(0,0,0,0.4))' }}
                    >
                      <div className="relative overflow-hidden bg-black aspect-[2/3]">
                        {currentMovie.poster_url ? (
                          <img
                            src={currentMovie.poster_url}
                            alt={decodeHtmlEntities(currentMovie.title)}
                            className="w-full h-full object-contain"
                            onLoad={() => setAlbumCoverLoaded(true)}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
                            <Film size={48} className="text-white/30" />
                          </div>
                        )}
                        {/* Paper crease texture — desaturated, inverted, Screen blend */}
                        <div
                          className="absolute inset-0 pointer-events-none opacity-[0.75] mix-blend-screen"
                          style={{
                            backgroundImage: `url('/paper-texture.jpg')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'grayscale(1) invert(1)',
                          }}
                        />
                        {/* Vignette */}
                        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 50px rgba(0,0,0,0.35)' }} />
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                </div>
              ) : (
                /* Worn poster layout for shows/plays */
                <div className="absolute inset-0 flex items-start justify-center pt-3">
                  <div className="relative transition-opacity duration-500" style={{ width: '65%', opacity: albumCoverLoaded || !currentMovie.poster_url ? 1 : 0 }}>
                    <div
                      className="relative overflow-visible"
                      style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5)', filter: 'drop-shadow(2px 3px 6px rgba(0,0,0,0.4))' }}
                    >
                      <div className="relative overflow-hidden bg-black aspect-[2/3]">
                        {currentMovie.poster_url ? (
                          <img
                            src={currentMovie.poster_url}
                            alt={decodeHtmlEntities(currentMovie.title)}
                            className="w-full h-full object-contain"
                            onLoad={() => setAlbumCoverLoaded(true)}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
                            <TypeIcon size={48} className="text-white/30" />
                          </div>
                        )}
                        {/* Paper crease texture — desaturated, inverted, Screen blend */}
                        <div
                          className="absolute inset-0 pointer-events-none opacity-[0.75] mix-blend-screen"
                          style={{
                            backgroundImage: `url('/paper-texture.jpg')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'grayscale(1) invert(1)',
                          }}
                        />
                        {/* Vignette */}
                        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 50px rgba(0,0,0,0.35)' }} />
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                </div>
              )}

              {/* Floating glassmorphic overlay */}
              <div
                className="absolute inset-x-3 bottom-3 rounded-xl px-3 py-2.5 overflow-hidden z-30"
                style={overlayGlassStyle}
              >
                {/* Type badge */}
                <span
                  className="inline-flex items-center gap-1 self-start py-0.5 px-1.5 text-[10px] font-bold rounded-full uppercase tracking-wider text-white mb-1"
                  style={{ background: badgeColor }}
                >
                  <TypeIcon size={10} />
                  {currentMovie.type === 'album' ? 'Album' : currentMovie.type === 'movie' ? 'Movie' : 'TV Show'}
                </span>

                {/* Title + toggle */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`text-sm font-bold text-white flex-1 min-w-0 ${isMinimized ? 'line-clamp-1' : 'line-clamp-2'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                    {decodeHtmlEntities(currentMovie.title)}
                  </h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsMinimized(prev => !prev); }}
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                    style={{ background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)' }}
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
                        {decodeHtmlEntities(currentMovie.director)}
                        {currentMovie.release_year && ` (${currentMovie.release_year})`}
                      </p>

                      {currentMovie.reason && (
                        <p className="text-xs text-white/70 line-clamp-6 mt-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                          {decodeHtmlEntities(currentMovie.reason)}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Button row — always visible */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    {currentMovie.type === 'album' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = currentMovie.itunes_url;
                          if (url) {
                            if (isNativePlatform && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
                              openSystemBrowser(url);
                            } else if (currentMovie.music_links) {
                              setMusicModalData({ musicLinks: currentMovie.music_links, title: currentMovie.title, artist: currentMovie.director });
                            } else {
                              window.open(`https://song.link/${url}`, '_blank');
                            }
                          } else {
                            window.open(`https://music.apple.com/us/search?term=${encodeURIComponent(currentMovie.title + ' ' + currentMovie.director)}`, '_blank');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95"
                        style={pillButtonStyle}
                      >
                        <Play size={14} fill="white" />
                        Play
                      </button>
                    ) : currentMovie.wikipedia_url ? (
                      <a
                        href={currentMovie.wikipedia_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95"
                        style={pillButtonStyle}
                      >
                        <ExternalLink size={14} />
                        Source
                      </a>
                    ) : null}
                  </div>
                  {isMinimized && currentMovie.director && (
                    <span className="text-xs text-white/70 font-medium truncate ml-2 min-w-0" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                      {decodeHtmlEntities(currentMovie.director)}{currentMovie.release_year ? ` (${currentMovie.release_year})` : ''}
                    </span>
                  )}
                </div>
              </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes vinyl-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
      <MusicModal
        musicLinks={musicModalData?.musicLinks ?? null}
        albumTitle={musicModalData?.title}
        albumArtist={musicModalData?.artist}
        onClose={() => setMusicModalData(null)}
      />
    </div>
  );
}

export default RelatedMovies;
