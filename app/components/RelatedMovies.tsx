'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Play, Disc3, ExternalLink } from 'lucide-react';
import { decodeHtmlEntities } from './utils';

interface RelatedMovie {
  title: string;
  director: string;
  reason: string;
  type: 'movie' | 'show' | 'album';
  poster_url?: string;
  release_year?: number;
  genre?: string;
  itunes_url?: string;
}

interface RelatedMoviesProps {
  movies: RelatedMovie[];
  bookId: string;
  isLoading?: boolean;
}

function RelatedMovies({ movies, bookId, isLoading = false }: RelatedMoviesProps) {
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

  useEffect(() => {
    setCurrentIndex(0);
    setIsVisible(false);

    if (movies.length === 0) return;

    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [movies, bookId]);

  function handleNext() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % movies.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : movies.length - 1));
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
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-xl p-4"
          style={glassmorphicStyle}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-16 h-20 bg-slate-300/50 rounded-lg animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
              <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
              <div className="w-20 h-6 bg-slate-300/50 rounded-lg animate-pulse mt-2" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-4/5 h-3 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (movies.length === 0 || currentIndex >= movies.length) {
    return (
      <div className="w-full">
        <div className="rounded-xl p-4" style={glassmorphicStyle}>
          <p className="text-xs text-slate-600 text-center">No related movies or shows found</p>
        </div>
      </div>
    );
  }

  const currentMovie = movies[currentIndex];

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
        {movies.length > 1 && (
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
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">Related Movies, Shows & Music</p>
                <p className="text-xs text-slate-500">Adaptations, thematic connections & soundtracks</p>
              </div>
            </div>
            {/* Content */}
            <div className="px-4 pb-4">
              <div className="flex items-start gap-3 mb-2">
                {/* Poster or icon */}
                {currentMovie.poster_url ? (
                  <img
                    src={currentMovie.poster_url}
                    alt={currentMovie.title}
                    className="w-16 h-20 object-cover rounded-lg flex-shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-20 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {currentMovie.type === 'album' ? (
                      <Disc3 size={24} className="text-slate-600" />
                    ) : (
                      <Play size={24} className="text-slate-600" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 mb-1 line-clamp-2">
                    {decodeHtmlEntities(currentMovie.title)}
                  </h3>
                  <div className="text-xs text-slate-500 mb-1">
                    <span>{decodeHtmlEntities(currentMovie.director)}</span>
                    {currentMovie.release_year && (
                      <span> ({currentMovie.release_year})</span>
                    )}
                  </div>
                  {/* Type badge */}
                  <span
                    className="inline-block py-0.5 px-2 text-[10px] font-bold rounded-full uppercase tracking-wider"
                    style={{
                      background: currentMovie.type === 'album'
                        ? 'rgba(236, 72, 153, 0.15)'
                        : currentMovie.type === 'movie'
                          ? 'rgba(99, 102, 241, 0.15)'
                          : 'rgba(168, 85, 247, 0.15)',
                      color: currentMovie.type === 'album'
                        ? 'rgb(219, 39, 119)'
                        : currentMovie.type === 'movie'
                          ? 'rgb(79, 70, 229)'
                          : 'rgb(147, 51, 234)',
                    }}
                  >
                    {currentMovie.type === 'album' ? 'Album' : currentMovie.type === 'movie' ? 'Movie' : 'TV Show'}
                  </span>
                  {/* iTunes link */}
                  {currentMovie.itunes_url && (
                    <a
                      href={currentMovie.itunes_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 ml-2 py-0.5 px-2 text-[10px] font-bold text-indigo-600 rounded-full uppercase tracking-wider"
                      style={{ background: 'rgba(99, 102, 241, 0.1)' }}
                    >
                      <ExternalLink size={9} />
                      iTunes
                    </a>
                  )}
                </div>
              </div>
              {currentMovie.reason && (
                <div className="mb-2">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {decodeHtmlEntities(currentMovie.reason)}
                  </p>
                </div>
              )}
              {/* Pagination */}
              {movies.length > 1 && (
                <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                  Tap for next ({currentIndex + 1}/{movies.length})
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

export default RelatedMovies;
