'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookMarked, BookOpen, Plus, MessageCircle, Send, ChevronsRight, Check, StickyNote } from 'lucide-react';
import { decodeHtmlEntities, useImageBrightness } from './utils';
import { openSystemBrowser } from '@/lib/capacitor';
import { analytics } from '../services/analytics-service';

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
  onPin?: (index: number) => void;
  isPinned?: (index: number) => boolean;
  showComment?: boolean;
  showSend?: boolean;
  sourceBookCoverUrl?: string | null;
  sourceBookTitle?: string;
}

const RelatedBooks = React.memo(function RelatedBooks({ books, bookId, isLoading = false, onAddBook, renderAction, onPin, isPinned, showComment = true, showSend = true, sourceBookCoverUrl, sourceBookTitle }: RelatedBooksProps) {
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
    analytics.trackEvent('related_books', 'next_card');
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
  const pinned = !!isPinned?.(currentIndex);

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
    analytics.trackEvent('related_books', 'add', { related_title: currentBook.title, related_author: currentBook.author });

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

              {/* Two covers with chevron */}
              <div className="flex items-center justify-center gap-3 px-4 mt-2 mb-3">
                <motion.div
                  className="relative flex-shrink-0"
                  initial={{ opacity: 0, x: -20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
                >
                  {sourceBookCoverUrl ? (
                    <img src={sourceBookCoverUrl} alt={sourceBookTitle || 'Source book'} className="w-[70px] h-[106px] object-cover rounded-lg shadow-sm" />
                  ) : (
                    <div className="w-[70px] h-[106px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                      <BookOpen size={18} className="text-slate-400" />
                    </div>
                  )}
                  <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                    <Check size={12} className="text-white" strokeWidth={3} />
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.25, ease: "easeOut" }}
                >
                  <ChevronsRight size={18} className="text-slate-600 dark:text-slate-500 flex-shrink-0" />
                </motion.div>
                <motion.div
                  className="flex-shrink-0 relative"
                  initial={{ opacity: 0, x: 20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                >
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt={decodeHtmlEntities(currentBook.title)}
                      className="w-[154px] h-[230px] object-cover rounded-lg shadow-sm"
                      crossOrigin="anonymous"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth && img.naturalHeight) {
                          setCoverAspect(img.naturalWidth / img.naturalHeight);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-[154px] h-[230px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                      <BookOpen size={24} className="text-slate-400" />
                    </div>
                  )}
                  {/* + Add button on recommended cover */}
                  {onAddBook && (
                    <button
                      onClick={handleAddBook}
                      className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-all active:scale-95"
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
                  )}
                </motion.div>
              </div>

              {/* Info below covers */}
              <div className="px-4 pb-3">
                <p className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
                  {decodeHtmlEntities(currentBook.title)}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {decodeHtmlEntities(currentBook.author)}
                  {currentBook.publish_year && ` · ${currentBook.publish_year}`}
                </p>

                {currentBook.reason && (
                  <>
                    <p className={`text-sm text-slate-600 dark:text-slate-300 leading-snug mt-1.5 ${descExpanded ? '' : 'line-clamp-3'}`}>
                      {decodeHtmlEntities(currentBook.reason)}
                    </p>
                    {currentBook.reason.length > 150 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDescExpanded(prev => !prev); }}
                        className="text-blue-600 dark:text-blue-400 text-sm font-semibold mt-1"
                      >
                        {descExpanded ? 'Show less' : 'more'}
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

export default RelatedBooks;
