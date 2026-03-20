'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Play, Disc3, MessageCircle, Send, X, Bookmark } from 'lucide-react';
import { decodeHtmlEntities, getAssetPath } from './utils';
import { analytics } from '../services/analytics-service';
import { isNativePlatform } from '@/lib/capacitor';
import { openSystemBrowser } from '@/lib/capacitor';
import MusicModal from './MusicModal';
import WatchModal from './WatchModal';
import type { MusicLinks, WatchLinks } from '../types';

const frostedGlassStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.25)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '16px',
};

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
  watch_links?: WatchLinks;
}

interface RelatedMoviesProps {
  movies: RelatedMovie[];
  bookId: string;
  isLoading?: boolean;
  renderAction?: (index: number) => React.ReactNode;
  onPin?: (index: number) => void;
  isPinned?: (index: number) => boolean;
  showPlayButtons?: boolean;
  showComment?: boolean;
  showSend?: boolean;
}

const RelatedMovies = React.memo(function RelatedMovies({ movies, bookId, isLoading = false, renderAction, onPin, isPinned, showPlayButtons = true, showComment = true, showSend = true }: RelatedMoviesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isSingleItem = movies.length === 1;
  const [isVisible, setIsVisible] = useState(isSingleItem);
  const [descExpanded, setDescExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [albumCoverLoaded, setAlbumCoverLoaded] = useState(false);
  const [musicModalData, setMusicModalData] = useState<{ musicLinks: MusicLinks; title: string; artist: string } | null>(null);
  const [watchModalData, setWatchModalData] = useState<{ watchLinks: WatchLinks; title: string; year?: number } | null>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const watchButtonRef = useRef<HTMLButtonElement>(null);
  const minSwipeDistance = 50;

  const shuffledMovies = useMemo(() => {
    const arr = movies.filter(m => m.type !== 'album' || m.itunes_url);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [movies]);

  useEffect(() => {
    setCurrentIndex(0);
    setDescExpanded(false);
    setAlbumCoverLoaded(false);

    if (shuffledMovies.length === 0) {
      setIsVisible(false);
      return;
    }

    if (shuffledMovies.length === 1) {
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
    analytics.trackEvent('related_movies', 'next_card');
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
    return null;
  }

  const currentMovie = shuffledMovies[currentIndex];
  const pinned = !!isPinned?.(currentIndex);

  const TypeIcon = currentMovie.type === 'album' ? Disc3 : currentMovie.type === 'movie' ? Film : Play;

  const badgeColor = currentMovie.type === 'album'
    ? 'rgba(236, 72, 153, 0.6)'
    : currentMovie.type === 'movie'
      ? 'rgba(99, 102, 241, 0.6)'
      : 'rgba(168, 85, 247, 0.6)';

  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...frostedGlassStyle,
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

  const currentPosterUrl = (currentMovie.type === 'album' && currentMovie.itunes_artwork) || currentMovie.poster_url;

  // Determine if there's a play/watch action
  const hasPlayAction = currentMovie.type === 'album' && currentMovie.itunes_url;
  const hasWatchAction = showPlayButtons && currentMovie.type !== 'album' && currentMovie.watch_links && Object.keys(currentMovie.watch_links).some(k => k !== 'tmdb_url' && currentMovie.watch_links![k as keyof WatchLinks]);

  const handlePlayWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMovie.type === 'album') {
      const url = currentMovie.itunes_url;
      if (url) {
        if (isNativePlatform && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
          openSystemBrowser(url);
        } else if (currentMovie.music_links) {
          setMusicModalData({ musicLinks: currentMovie.music_links, title: currentMovie.title, artist: currentMovie.director });
        } else {
          window.open(`https://song.link/${url}`, '_blank');
        }
      }
    } else if (currentMovie.watch_links) {
      if (isNativePlatform && /iPhone|iPad|iPod/.test(navigator.userAgent) && currentMovie.watch_links.apple) {
        openSystemBrowser(currentMovie.watch_links.apple);
      } else {
        setWatchModalData({ watchLinks: currentMovie.watch_links, title: currentMovie.title, year: currentMovie.release_year });
      }
    }
  };

  return (
    <div
      onClick={() => { if (!musicModalData && !watchModalData) handleNext(); }}
      onTouchStart={(e) => {
        if (musicModalData || watchModalData) { setMusicModalData(null); setWatchModalData(null); return; }
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
              style={frostedGlassStyle}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                  <Film size={20} className="text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Related Work</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Movies, shows & music related to this book</p>
                </div>
                {shuffledMovies.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {currentIndex + 1}/{shuffledMovies.length}
                  </span>
                )}
              </div>

              {/* Image area */}
              <div className="relative flex items-start justify-center pt-3 pb-3">
                {currentMovie.type === 'album' ? (
                  /* Vinyl record layout for albums — centered */
                  <div className="relative transition-opacity duration-500" style={{ width: '75%', opacity: albumCoverLoaded || !(currentMovie.itunes_artwork || currentMovie.poster_url) ? 1 : 0 }}>
                    <div className="relative w-full" style={{ aspectRatio: '1.55 / 1' }}>
                      {/* Vinyl Record */}
                      <div
                        className="absolute z-10 aspect-square"
                        style={{ width: '62%', top: '50%', right: '2%', transform: 'translateY(-50%)' }}
                      >
                        <div
                          className="w-full aspect-square rounded-full animate-[vinyl-spin_3s_linear_infinite]"
                          style={{
                            background: 'radial-gradient(circle, #222 0%, #111 40%, #000 100%)',
                            boxShadow: '0 0 40px rgba(0,0,0,0.8)',
                          }}
                        >
                          <div
                            className="absolute inset-0 rounded-full opacity-40 pointer-events-none"
                            style={{ background: 'repeating-radial-gradient(circle, transparent 0, transparent 2px, rgba(255,255,255,0.03) 3px, transparent 4px)' }}
                          />
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
                        className="absolute z-20 aspect-square rounded-sm overflow-hidden"
                        style={{ width: '65%', top: '0', left: '2%', boxShadow: '15px 15px 50px rgba(0,0,0,0.7)' }}
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
                        <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-black/30 to-transparent z-30" />

                        {/* Play button centered on album cover */}
                        {hasPlayAction && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: musicModalData ? 10000 : 30 }}>
                            <button
                              ref={playButtonRef}
                              onTouchStart={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); if (musicModalData) { setMusicModalData(null); } else { handlePlayWatch(e); } }}
                              className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
                              style={{
                                background: musicModalData ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.25)',
                                backdropFilter: 'blur(9.4px)',
                                WebkitBackdropFilter: 'blur(9.4px)',
                                border: musicModalData ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.3)',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                              }}
                            >
                              {musicModalData ? <X size={22} className="text-white" /> : <Play size={24} className="text-white ml-0.5" fill="white" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Poster layout for movies/shows */
                  <div className="relative w-[60%] aspect-[2/3] rounded-xl overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)' }}>
                    {currentMovie.poster_url ? (
                      <>
                        <img
                          src={currentMovie.poster_url}
                          alt={decodeHtmlEntities(currentMovie.title)}
                          className="w-full h-full object-cover"
                          onLoad={() => setAlbumCoverLoaded(true)}
                        />
                        {/* Paper crease texture */}
                        <div
                          className="absolute inset-0 pointer-events-none opacity-[0.75] mix-blend-screen"
                          style={{
                            backgroundImage: `url('${getAssetPath('/paper-texture.jpg')}')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'grayscale(1) invert(1)',
                          }}
                        />
                        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 50px rgba(0,0,0,0.35)' }} />
                      </>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
                        <TypeIcon size={48} className="text-white/30" />
                      </div>
                    )}

                    {/* Play button on image for watchable content */}
                    {hasWatchAction && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: watchModalData ? 10000 : 1 }}>
                        <button
                          ref={watchButtonRef}
                          onTouchStart={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); if (watchModalData) { setWatchModalData(null); } else { handlePlayWatch(e); } }}
                          className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
                          style={{
                            background: watchModalData ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.25)',
                            backdropFilter: 'blur(9.4px)',
                            WebkitBackdropFilter: 'blur(9.4px)',
                            border: watchModalData ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.3)',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                          }}
                        >
                          {watchModalData ? <X size={22} className="text-white" /> : <Play size={24} className="text-white ml-0.5" fill="white" />}
                        </button>
                      </div>
                    )}

                    {/* Bottom gradient */}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Info below image */}
              <div className="px-4 py-3">
                {/* Type badge */}
                <span
                  className="inline-flex items-center gap-1 py-0.5 px-1.5 text-[10px] font-bold rounded-full uppercase tracking-wider text-white mb-1.5"
                  style={{ background: badgeColor }}
                >
                  <TypeIcon size={10} />
                  {currentMovie.type === 'album' ? 'Album' : currentMovie.type === 'movie' ? 'Movie' : 'TV Show'}
                </span>

                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                  {decodeHtmlEntities(currentMovie.title)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {decodeHtmlEntities(currentMovie.director)}
                  {currentMovie.release_year && ` · ${currentMovie.release_year}`}
                </p>

                {currentMovie.reason && (
                  <>
                    <p className={`text-xs text-slate-600 dark:text-slate-400 mt-1.5 ${descExpanded ? '' : 'line-clamp-2'}`}>
                      {decodeHtmlEntities(currentMovie.reason)}
                    </p>
                    {currentMovie.reason.length > 100 && (
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
                  {onPin && <button onClick={() => onPin(currentIndex)} className="active:scale-90 transition-transform"><Bookmark size={17} fill={pinned ? 'currentColor' : 'none'} className={pinned ? 'text-slate-900' : 'text-slate-600 dark:text-slate-400'} /></button>}
                  {showComment && <span className="flex items-center gap-1"><MessageCircle size={17} className="text-slate-600 dark:text-slate-400" /><span className="text-xs font-medium min-w-[12px] invisible">0</span></span>}
                  {showSend && <Send size={17} className="text-slate-600 dark:text-slate-400" />}
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
        anchorRef={playButtonRef}
      />
      <WatchModal
        watchLinks={watchModalData?.watchLinks ?? null}
        title={watchModalData?.title}
        year={watchModalData?.year}
        onClose={() => setWatchModalData(null)}
        anchorRef={watchButtonRef}
      />
    </div>
  );
});

export default RelatedMovies;
