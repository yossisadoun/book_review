'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookMarked, BookOpen, Plus, MessageCircle, Send } from 'lucide-react';
import { decodeHtmlEntities, useImageBrightness } from './utils';
import { openSystemBrowser } from '@/lib/capacitor';

const frostedGlassStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.25)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '16px',
};

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
  renderAction?: (index: number) => React.ReactNode;
  showComment?: boolean;
}

function RelatedBooks({ books, bookId, isLoading = false, onAddBook, renderAction, showComment = true }: RelatedBooksProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isSingleItem = books.length === 1;
  const [isVisible, setIsVisible] = useState(isSingleItem);
  const [descExpanded, setDescExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [coverAspect, setCoverAspect] = useState<number>(2 / 3);
  const minSwipeDistance = 50;

  const coverImage = books[currentIndex]?.cover_url || books[currentIndex]?.thumbnail;
  const imageBrightness = useImageBrightness(coverImage);

  useEffect(() => {
    setCurrentIndex(0);
    setDescExpanded(false);
    setCoverAspect(2 / 3);

    if (books.length === 0) {
      setIsVisible(false);
      return;
    }

    if (books.length === 1) {
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
        <div className="rounded-xl p-4" style={frostedGlassStyle}>
          <p className="text-xs text-slate-600 dark:text-slate-400 text-center">No related books found</p>
        </div>
      </div>
    );
  }

  const currentBook = books[currentIndex];

  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...frostedGlassStyle,
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
              style={frostedGlassStyle}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                  <BookMarked size={20} className="text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Books</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Similar books you might enjoy</p>
                </div>
                {books.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {currentIndex + 1}/{books.length}
                  </span>
                )}
              </div>

              {/* Image area */}
              <div className="relative flex items-start justify-center pt-3 pb-3">
                <div className="relative w-[60%] rounded-lg overflow-hidden border-2 border-white/50" style={{ aspectRatio: `${coverAspect}`, boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)' }}>
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

                  {/* + Add button on the cover */}
                  {onAddBook && (
                    <div className="absolute bottom-3 right-3">
                      <button
                        onClick={handleAddBook}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all active:scale-95"
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                          color: imageBrightness === 'light' ? 'rgba(0,0,0,0.8)' : 'white',
                        }}
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Info below image */}
              <div className="px-4 py-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                  {decodeHtmlEntities(currentBook.title)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {decodeHtmlEntities(currentBook.author)}
                  {currentBook.publish_year && ` · ${currentBook.publish_year}`}
                </p>

                {currentBook.reason && (
                  <>
                    <p className={`text-xs text-slate-600 dark:text-slate-400 mt-1.5 ${descExpanded ? '' : 'line-clamp-2'}`}>
                      {decodeHtmlEntities(currentBook.reason)}
                    </p>
                    {currentBook.reason.length > 100 && (
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
                  <Send size={17} className="text-slate-600 dark:text-slate-400" />
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
