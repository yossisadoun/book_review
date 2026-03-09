'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookMarked, BookOpen, CheckCircle2, Minimize2, Maximize2, ExternalLink } from 'lucide-react';
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

type ReadingStatus = 'read_it' | 'reading' | 'want_to_read' | null;

interface Book {
  id: string;
  user_id: string;
  canonical_book_id?: string;
  title: string;
  author: string;
  publish_year?: number | null;
  first_issue_year?: number | null;
  genre?: string | null;
  isbn?: string | null;
  cover_url?: string | null;
  wikipedia_url?: string | null;
  google_books_url?: string | null;
  summary?: string | null;
  rating_writing?: number | null;
  rating_insights?: number | null;
  rating_flow?: number | null;
  rating_world?: number | null;
  rating_characters?: number | null;
  reading_status?: ReadingStatus;
  author_facts?: string[] | null;
  podcast_episodes?: PodcastEpisode[] | null;
  podcast_episodes_grok?: PodcastEpisode[] | null;
  podcast_episodes_apple?: PodcastEpisode[] | null;
  podcast_episodes_curated?: PodcastEpisode[] | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface RelatedBook {
  title: string;
  author: string;
  reason: string;
  thumbnail?: string;
  cover_url?: string;
  publish_year?: number;
  wikipedia_url?: string;
  google_books_url?: string;
  genre?: string;
}

interface RelatedBooksProps {
  books: RelatedBook[];
  bookId: string;
  isLoading?: boolean;
  onAddBook?: (book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) => void;
}

function RelatedBooks({ books, bookId, isLoading = false, onAddBook }: RelatedBooksProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [coverAspect, setCoverAspect] = useState<number>(2 / 3); // width/height ratio
  const minSwipeDistance = 50;

  const coverImage = books[currentIndex]?.cover_url || books[currentIndex]?.thumbnail;
  const imageBrightness = useImageBrightness(coverImage);

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
    setCoverAspect(2 / 3);

    if (books.length === 0) return;

    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [books, bookId]);

  function handleNext() {
    setIsVisible(false);
    setCoverAspect(2 / 3);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % books.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setCoverAspect(2 / 3);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : books.length - 1));
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

  if (books.length === 0 || currentIndex >= books.length) {
    return (
      <div className="w-full">
        <div className="rounded-xl p-4" style={glassmorphicStyle}>
          <p className="text-xs text-slate-600 dark:text-slate-400 text-center">No related books found</p>
        </div>
      </div>
    );
  }

  const currentBook = books[currentIndex];

  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...glassmorphicStyle,
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

  async function handleAddBook(e: React.MouseEvent) {
    e.stopPropagation();

    if (!onAddBook) return;

    const bookMeta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> = {
      title: currentBook.title,
      author: currentBook.author,
      cover_url: currentBook.cover_url || currentBook.thumbnail || null,
      publish_year: currentBook.publish_year || null,
      wikipedia_url: currentBook.wikipedia_url || null,
      google_books_url: currentBook.google_books_url || null,
      genre: currentBook.genre || undefined,
    };

    onAddBook(bookMeta);
  }

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
        {books.length > 1 && (
          <>
            <div style={stackedCardStyle(10, 0.96, 0.4)} />
            <div style={stackedCardStyle(-1, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentBook.title}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={glassmorphicStyle}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <BookMarked size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Books</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Similar books you might enjoy</p>
                </div>
                {books.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-400 flex-shrink-0">
                    {currentIndex + 1}/{books.length}
                  </span>
                )}
              </div>
              {/* Image area */}
              <div className="relative flex items-start justify-center pt-3" style={{ aspectRatio: `${coverAspect} / 1` }}>
              <div className="relative w-[70%] rounded-lg overflow-hidden border-2 border-white/50" style={{ aspectRatio: `${coverAspect} / 1`, boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)' }}>
              {coverImage ? (
                <>
                <img
                  src={coverImage}
                  alt={decodeHtmlEntities(currentBook.title)}
                  className="w-full h-full object-contain"
                  style={{ filter: 'contrast(1.15) saturate(1.25)' }}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                      setCoverAspect(img.naturalWidth / img.naturalHeight);
                    }
                  }}
                />
                {/* Skeuomorphic book spine effect */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-lg"
                  style={{
                    background: `linear-gradient(to right,
                      rgba(0,0,0,0.02) 0%,
                      rgba(0,0,0,0.05) 0.75%,
                      rgba(255,255,255,0.5) 1.0%,
                      rgba(255,255,255,0.6) 1.3%,
                      rgba(255,255,255,0.5) 1.4%,
                      rgba(255,255,255,0.3) 1.5%,
                      rgba(255,255,255,0.3) 2.4%,
                      rgba(0,0,0,0.05) 2.7%,
                      rgba(0,0,0,0.05) 3.5%,
                      rgba(255,255,255,0.3) 4%,
                      rgba(255,255,255,0.3) 4.5%,
                      transparent 5.4%,
                      transparent 99%,
                      rgba(144,144,144,0.08) 100%)`
                  }}
                />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-amber-800 to-amber-950 flex items-center justify-center">
                  <BookOpen size={48} className="text-white/30" />
                </div>
              )}
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

              {/* Floating glassmorphic overlay */}
              <div
                className="absolute inset-x-3 bottom-3 rounded-xl px-3 py-2.5 overflow-hidden"
                style={overlayGlassStyle}
              >
                {/* Title + toggle */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`text-sm font-bold text-white flex-1 min-w-0 ${isMinimized ? 'line-clamp-1' : 'line-clamp-2'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                    {decodeHtmlEntities(currentBook.title)}
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
                        {decodeHtmlEntities(currentBook.author)}
                      </p>

                      {currentBook.reason && (
                        <p className="text-xs text-white/70 line-clamp-6 mt-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                          {decodeHtmlEntities(currentBook.reason)}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Button row — always visible */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    {onAddBook && (
                      <button
                        onClick={handleAddBook}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap flex-shrink-0 transition-all active:scale-95"
                        style={{
                          background: 'rgba(59, 130, 246, 0.85)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: 'white',
                        }}
                      >
                        <CheckCircle2 size={14} />
                        Add Book
                      </button>
                    )}
                    {currentBook.google_books_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openSystemBrowser(currentBook.google_books_url!);
                        }}
                        className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-full flex-shrink-0 transition-all active:scale-95"
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                        }}
                      >
                        <ExternalLink size={14} className="text-white" />
                      </button>
                    )}
                  </div>
                  {isMinimized && (
                    <span className="text-xs text-white/70 font-medium truncate ml-2 min-w-0" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                      {decodeHtmlEntities(currentBook.author)}
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

export default RelatedBooks;
