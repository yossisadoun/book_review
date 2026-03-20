'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, BookOpen, CheckCircle2, BookMarked } from 'lucide-react';
import Lottie from 'lottie-react';
import refreshAnimation from '@/public/refresh.json';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic } from '@/lib/capacitor';
import { getGradient } from '../services/book-utils';
import RatingStars from './RatingStars';
import { DISCOVERY_BOOKS, type DiscoveryBook } from '../data/discovery-books';
import type { ReadingStatus, Book } from '../types';

export type BookMeta = Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>;

export interface BookDiscoverySwipeProps {
  isOpen: boolean;
  onClose: () => void;
  existingBookKeys: Set<string>;
  onAddBook: (meta: BookMeta, readingStatus: ReadingStatus, rating?: number | null) => Promise<void>;
}

// --- Module-level constants ---

const overlayBgStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.6)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  borderRadius: 0,
};

const coverShadowStyle: React.CSSProperties = {
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), 0 0 30px 5px rgba(255, 255, 255, 0.3)',
};

const glassBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.6)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
};
const dimmedBtnStyle: React.CSSProperties = {
  ...glassBtnStyle,
  opacity: 0.3,
};

const KEYFRAMES_CSS = `
@keyframes discoveryFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ratingFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes emptyStateIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes bookBounceIn {
  0% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  80% { transform: translateY(0); }
  100% { transform: translateY(0); }
}
@keyframes shelfBookBounce {
  0% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  80% { transform: translateY(0); }
  100% { transform: translateY(0); }
}
@keyframes shelfTilt {
  0% { transform: translateY(0) rotate(0deg); }
  20% { transform: translateY(-4px) rotate(10deg); }
  40% { transform: translateY(-4px) rotate(0deg); }
  60% { transform: translateY(-4px) rotate(-10deg); }
  80% { transform: translateY(0) rotate(0deg); }
  100% { transform: translateY(0) rotate(0deg); }
}
.shelf-book-newest { animation-name: bookBounceIn; animation-duration: 0.4s; animation-timing-function: ease; }
.shelf-tapped .shelf-book { animation-name: shelfBookBounce; animation-duration: 0.4s; animation-timing-function: ease; }
.shelf-tapped .shelf-board { animation-name: shelfTilt; animation-duration: 0.4s; animation-timing-function: ease; transform-origin: 50% 50%; }
`;

// Number of images to render in the DOM stack (pre-decoded and ready)
const STACK_SIZE = 5;

type PileTarget = 'skip' | 'read' | 'want';

interface PileBook {
  color: string;
  highlightColor: string;
  width: number;
  height: number;
}

const MAX_VISIBLE_BOOKS = 12;

// Rich book colors with lighter highlight for spine detail
const BOOK_PALETTES: [string, string][] = [
  ['#5199fc', '#afd7fb'], ['#ff9868', '#ffc4a3'], ['#ff5068', '#ff8fa0'],
  ['#8B4513', '#c4844a'], ['#2F4F4F', '#5a8a8a'], ['#191970', '#4a4ab0'],
  ['#800020', '#b84060'], ['#4A0E4E', '#8a3e8e'], ['#1B3F2F', '#3a7a5f'],
  ['#5C4033', '#9a7a6a'], ['#36454F', '#6a8090'], ['#483C32', '#8a7a6a'],
  ['#2C3E50', '#5a7a90'], ['#4A235A', '#8a5a9a'], ['#1A5276', '#4a8ab0'],
  ['#6B3A2A', '#a06a5a'], ['#784212', '#b08050'], ['#3B3B6D', '#6a6aaa'],
];

function getBookPalette(title: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  return BOOK_PALETTES[Math.abs(hash) % BOOK_PALETTES.length];
}

function generateCanonicalBookId(title: string, author: string): string {
  const normalizedTitle = (title || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const normalizedAuthor = (author || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return `${normalizedTitle}|${normalizedAuthor}`;
}

function toBookMeta(book: DiscoveryBook): BookMeta {
  return {
    title: book.title,
    author: book.author,
    cover_url: book.cover_url,
    summary: book.summary,
    genre: book.genre || null,
    publish_year: book.publish_year || null,
    first_issue_year: null,
    wikipedia_url: null,
    google_books_url: null,
    notes: null,
    reading_status: null,
  };
}

function getMediumCoverUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/-L\.jpg$/, '-M.jpg');
}

// SVG mini-bookshelf — books stand upright on a shelf that grows
const SHELF_COLOR = '#ae8280';
const SHELF_SUPPORT_COLOR = '#855f6d';
const SHELF_H = 4;
const SHELF_Y = 62;
const BOOK_BASE_Y = SHELF_Y; // books sit on top of shelf
const SHELF_PAD = 4; // padding on each side of shelf
const SUPPORT_W = 3;
const SVG_HEIGHT = 72;

const BookPile = React.memo(function BookPile({ count, books }: { pile: PileTarget; count: number; books: PileBook[] }) {
  const visible = books.slice(-MAX_VISIBLE_BOOKS);
  const [tapped, setTapped] = useState(false);

  // Calculate total width of all books — shelf starts at 3-book size minimum
  let totalBooksWidth = 0;
  for (const b of visible) totalBooksWidth += b.width;
  const MIN_SHELF_INNER = 21; // ~3 average books (7px each)
  const shelfWidth = Math.max(totalBooksWidth, MIN_SHELF_INNER) + SHELF_PAD * 2;
  const svgWidth = shelfWidth + 8;

  // Position books left to right on the shelf
  const shelfX = (svgWidth - shelfWidth) / 2;
  let bookX = shelfX + SHELF_PAD;

  const handleTap = () => {
    setTapped(true);
    setTimeout(() => setTapped(false), 450);
  };

  return (
    <div className="flex flex-col items-center mb-2" style={{ minHeight: SVG_HEIGHT + 20 }}>
      <svg
        className={tapped ? 'shelf-tapped' : ''}
        width={svgWidth}
        height={SVG_HEIGHT}
        viewBox={`0 0 ${svgWidth} ${SVG_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible', transition: 'width 0.3s ease', cursor: 'pointer' }}
        onClick={handleTap}
      >
        {/* Books standing upright */}
        {visible.map((book, i) => {
          const x = bookX;
          bookX += book.width;
          const isNewest = i === visible.length - 1;
          const bookY = BOOK_BASE_Y - book.height;
          const detailY = bookY + 4;
          const detailW = book.width - 2;
          return (
            <g
              key={`book-${i}`}
              className={`shelf-book${isNewest ? ' shelf-book-newest' : ''}`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <rect x={x} y={bookY} width={book.width} height={book.height} rx={1} fill={book.color} />
              <rect x={x + 1} y={detailY} width={detailW} height={2} rx={0.5} fill={book.highlightColor} opacity={0.7} />
            </g>
          );
        })}
        {/* Shelf board + supports */}
        <g className="shelf-board" style={{ transformOrigin: '50% 50%' }}>
          <rect
            x={shelfX} y={SHELF_Y}
            width={shelfWidth} height={SHELF_H}
            rx={1.5}
            fill={SHELF_COLOR}
            style={{ transition: 'width 0.3s ease' }}
          />
          <rect
            x={shelfX + 4} y={SHELF_Y + SHELF_H}
            width={SUPPORT_W} height={4}
            rx={1}
            fill={SHELF_SUPPORT_COLOR}
          />
          <rect
            x={shelfX + shelfWidth - SUPPORT_W - 4} y={SHELF_Y + SHELF_H}
            width={SUPPORT_W} height={4}
            rx={1}
            fill={SHELF_SUPPORT_COLOR}
            style={{ transition: 'x 0.3s ease' }}
          />
        </g>
      </svg>
      <div className="mt-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] font-bold flex items-center justify-center" style={{ opacity: count > 0 ? 1 : 0 }}>
        {count}
      </div>
    </div>
  );
});

// --- Main Component ---

const BookDiscoverySwipe = React.memo(function BookDiscoverySwipe({
  isOpen,
  onClose,
  existingBookKeys,
  onAddBook,
}: BookDiscoverySwipeProps) {
  const [sessionBooks, setSessionBooks] = useState<DiscoveryBook[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [pendingBook, setPendingBook] = useState<DiscoveryBook | null>(null);
  const [animatingTo, setAnimatingTo] = useState<PileTarget | null>(null);
  const [ratingPaused, setRatingPaused] = useState(false);
  const [pileCounts, setPileCounts] = useState({ skip: 0, read: 0, want: 0 });
  const [pileBooks, setPileBooks] = useState<{ skip: PileBook[]; read: PileBook[]; want: PileBook[] }>({ skip: [], read: [], want: [] });
  const [flyingBook, setFlyingBook] = useState<DiscoveryBook | null>(null);
  const [coversReady, setCoversReady] = useState(false);

  const skipBtnRef = useRef<HTMLButtonElement>(null);
  const readBtnRef = useRef<HTMLButtonElement>(null);
  const wantBtnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rotationSeedRef = useRef(0);
  const prevIsOpenRef = useRef(false);

  // Snapshot filtered books when opening
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const filtered = DISCOVERY_BOOKS.filter(book => {
        const key = generateCanonicalBookId(book.title, book.author);
        return !existingBookKeys.has(key);
      });
      setSessionBooks(filtered);
      setProcessedCount(0);
      setPileCounts({ skip: 0, read: 0, want: 0 });
      setPileBooks({ skip: [], read: [], want: [] });
      setFlyingBook(null);
      setPendingBook(null);
      setAnimatingTo(null);
      setRatingPaused(false);
      setCoversReady(false);

      // Preload the first cover image, then mark ready
      const firstBook = filtered[0];
      if (firstBook) {
        const url = getMediumCoverUrl(firstBook.cover_url);
        if (url) {
          const img = new Image();
          img.onload = () => setCoversReady(true);
          img.onerror = () => setCoversReady(true); // show anyway on error
          img.src = url;
        } else {
          setCoversReady(true);
        }
      } else {
        setCoversReady(true); // no books = empty state, show immediately
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, existingBookKeys]);

  const currentBook = sessionBooks[processedCount] || null;
  const remainingCount = sessionBooks.length - processedCount;

  // Build the pre-rendered image stack: current + next STACK_SIZE books
  // All are in the DOM simultaneously so the browser decodes them
  const stackBooks: (DiscoveryBook | null)[] = [];
  for (let i = 0; i < STACK_SIZE; i++) {
    stackBooks.push(sessionBooks[processedCount + i] || null);
  }

  // Also preload the next batch beyond the rendered stack via <link rel="preload">
  const preloadUrls: string[] = [];
  for (let i = STACK_SIZE; i < STACK_SIZE + 10; i++) {
    const book = sessionBooks[processedCount + i];
    const url = getMediumCoverUrl(book?.cover_url);
    if (url) preloadUrls.push(url);
  }

  const addBookToPile = useCallback((pile: PileTarget, book: DiscoveryBook) => {
    rotationSeedRef.current += 1;
    const seed = rotationSeedRef.current;
    const [color, highlightColor] = getBookPalette(book.title);
    // Vary width (5-9) and height (24-34) based on seed for visual variety
    const width = 5 + (seed % 5);
    const height = 24 + ((seed * 3 + book.title.length) % 11);
    const pileBook: PileBook = { color, highlightColor, width, height };
    setPileBooks(prev => ({
      ...prev,
      [pile]: [...prev[pile], pileBook],
    }));
  }, []);

  const advanceToNext = useCallback((target: PileTarget, book: DiscoveryBook) => {
    setPileCounts(prev => ({ ...prev, [target]: prev[target] + 1 }));
    addBookToPile(target, book);
    setFlyingBook(null);
    setProcessedCount(prev => prev + 1);
  }, [addBookToPile]);

  const animateAndAdvance = useCallback((target: PileTarget, book: DiscoveryBook, onDone?: () => void) => {
    setFlyingBook(book);
    setAnimatingTo(target);
    setTimeout(() => {
      setAnimatingTo(null);
      advanceToNext(target, book);
      onDone?.();
    }, 350);
  }, [advanceToNext]);

  const handleSkip = useCallback((book: DiscoveryBook) => {
    triggerLightHaptic();
    animateAndAdvance('skip', book);
  }, [animateAndAdvance]);

  const handleWant = useCallback(async (book: DiscoveryBook) => {
    triggerMediumHaptic();
    animateAndAdvance('want', book, async () => {
      await onAddBook(toBookMeta(book), 'want_to_read');
    });
  }, [animateAndAdvance, onAddBook]);

  const handleReadIt = useCallback((book: DiscoveryBook) => {
    triggerSuccessHaptic();
    setPendingBook(book);
    setRatingPaused(true);
  }, []);

  const handleRatingComplete = useCallback(async (_dimension: string, value: number | null) => {
    if (!pendingBook) return;
    const book = pendingBook;
    setRatingPaused(false);
    setFlyingBook(book);
    setAnimatingTo('read');
    onAddBook(toBookMeta(book), 'read_it', value);
    setTimeout(() => {
      setAnimatingTo(null);
      advanceToNext('read', book);
      setPendingBook(null);
    }, 350);
  }, [pendingBook, onAddBook, advanceToNext]);

  const getAnimationTarget = useCallback((target: PileTarget) => {
    const btnRef = target === 'skip' ? skipBtnRef : target === 'read' ? readBtnRef : wantBtnRef;
    const btn = btnRef.current;
    const card = cardRef.current;
    if (!btn || !card) return { x: 0, y: 300 };
    const btnRect = btn.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      x: (btnRect.left + btnRect.width / 2) - (cardRect.left + cardRect.width / 2),
      y: (btnRect.top) - (cardRect.top + cardRect.height / 2),
    };
  }, []);

  if (!isOpen) return null;

  const displayBook = flyingBook || (ratingPaused ? (pendingBook || currentBook) : currentBook);
  const isInteractive = !animatingTo && !ratingPaused;

  // Card transform for the top card only
  let topCardTransform = 'translate3d(0, 0, 0) scale(1)';
  let topCardOpacity = 1;

  if (animatingTo) {
    const target = getAnimationTarget(animatingTo);
    topCardTransform = `translate3d(${target.x}px, ${target.y}px, 0) scale(0.2)`;
    topCardOpacity = 0;
  } else if (ratingPaused) {
    const target = getAnimationTarget('read');
    topCardTransform = `translate3d(${target.x * 0.15}px, ${target.y * 0.12}px, 0) scale(0.55)`;
    topCardOpacity = 1;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ animation: 'discoveryFadeIn 0.3s ease-out' }}
    >
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES_CSS }} />

      {/* Preload next batch of images beyond the rendered stack */}
      {preloadUrls.map(url => (
        <link key={url} rel="preload" as="image" href={url} />
      ))}

      <div className="fixed inset-0" style={overlayBgStyle} />

      {/* Header — centered with close button absolutely positioned */}
      <div className="relative z-10 flex items-center justify-center px-4 pt-14 pb-3">
        <div className="text-center">
          <h2 className="text-lg font-bold text-slate-950">Discover Books</h2>
          {remainingCount > 0 && !ratingPaused && (
            <p className="text-xs text-slate-500">{remainingCount} books left</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="absolute right-4 top-14 w-8 h-8 rounded-full bg-white/80 backdrop-blur-md border border-white/30 active:scale-95 transition-all flex items-center justify-center shadow-sm"
        >
          <X size={16} className="text-slate-700" />
        </button>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
        {/* Loading state — Lottie until first cover is decoded */}
        {!coversReady && sessionBooks.length > 0 && (
          <div className="flex flex-col items-center">
            <Lottie animationData={refreshAnimation} loop autoplay style={{ width: 80, height: 80 }} />
          </div>
        )}

        {/* Empty state */}
        {coversReady && !displayBook && !pendingBook && (
          <div
            className="flex flex-col items-center"
            style={{ animation: 'emptyStateIn 0.3s ease-out' }}
          >
            <BookOpen size={48} className="text-slate-300 mb-4" />
            <p className="text-slate-800 font-semibold text-center">You've seen all our picks!</p>
            <p className="text-slate-500 text-sm mt-2 text-center">More books coming soon.</p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 rounded-xl font-bold text-sm text-white active:scale-95 transition-transform bg-black/70"
            >
              Done
            </button>
          </div>
        )}

        {/* Card stack — ALL images pre-rendered in DOM, stacked via z-index */}
        {coversReady && displayBook && (
          <div className="flex flex-col items-center">
            <div className="relative w-[200px] h-[300px]" ref={cardRef}>
              {/* Render stack in reverse order (bottom to top) so z-index layers correctly */}
              {stackBooks.map((book, i) => {
                if (!book) return null;
                const isTop = i === 0;
                const coverUrl = getMediumCoverUrl(book.cover_url);

                // Top card: animated (fly-out / rating pause)
                // Cards 1-2: visible as stack background (scaled down)
                // Cards 3+: in DOM but invisible (opacity 0) — pre-decoded and ready
                let style: React.CSSProperties;

                if (isTop) {
                  style = {
                    ...coverShadowStyle,
                    zIndex: STACK_SIZE - i,
                    transform: topCardTransform,
                    opacity: topCardOpacity,
                    transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease-in',
                    willChange: 'transform, opacity',
                  };
                } else if (i === 1 && !ratingPaused) {
                  // Visible stack peek — stays visible during fly-out so it's ready when promoted
                  style = {
                    ...coverShadowStyle,
                    zIndex: STACK_SIZE - i,
                    transform: 'scale(0.96) translateY(5px)',
                    opacity: 0.5,
                  };
                } else if (i === 2 && !ratingPaused) {
                  style = {
                    ...coverShadowStyle,
                    zIndex: STACK_SIZE - i,
                    transform: 'scale(0.92) translateY(10px)',
                    opacity: 0.3,
                  };
                } else {
                  // Hidden but in DOM — browser decodes these, ready for instant display
                  style = {
                    zIndex: STACK_SIZE - i,
                    opacity: 0,
                    pointerEvents: 'none',
                  };
                }

                return (
                  <div
                    key={`slot-${processedCount + i}`}
                    className="absolute inset-0 rounded-lg overflow-hidden"
                    style={style}
                  >
                    <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${getGradient(book.title)}`}>
                      <BookOpen size={48} className="text-white/30" />
                    </div>
                    {coverUrl && (
                      <img
                        src={coverUrl}
                        alt={book.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        draggable={false}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Title + Author */}
            {!ratingPaused && (
              <div className="mt-4 text-center max-w-[272px]">
                <h2 className="text-lg font-bold text-slate-950 line-clamp-2">{displayBook.title}</h2>
                <p className="text-sm text-slate-800 mt-1">{displayBook.author}</p>
                {displayBook.publish_year && (
                  <p className="text-xs text-slate-500 mt-0.5">{displayBook.publish_year}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Floating rating */}
        {ratingPaused && pendingBook && (
          <div
            className="mt-4 flex flex-col items-center"
            style={{ animation: 'ratingFadeUp 0.25s ease-out 0.2s both' }}
          >
            <p className="text-xs text-slate-500 mb-2">{pendingBook.title}</p>
            <RatingStars
              value={null}
              onRate={handleRatingComplete}
              dimension="overall"
            />
          </div>
        )}
      </div>

      {/* Bottom section: piles + buttons */}
      {coversReady && (displayBook || ratingPaused) && (
        <div className="relative z-10 pb-10 pt-4 px-6 -mt-[50px]">
          <div className="flex items-end">
            {/* Skip */}
            <div className="flex flex-col items-center flex-1">
              <BookPile pile="skip" count={pileCounts.skip} books={pileBooks.skip} />
              <button
                ref={skipBtnRef}
                onClick={() => isInteractive && currentBook && handleSkip(currentBook)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full active:scale-95 transition-all text-slate-700 font-bold text-sm"
                style={ratingPaused ? dimmedBtnStyle : glassBtnStyle}
              >
                <X size={16} />
                <span>Skip</span>
              </button>
            </div>

            {/* Read it */}
            <div className="flex flex-col items-center flex-1 mx-2">
              <BookPile pile="read" count={pileCounts.read} books={pileBooks.read} />
              <button
                ref={readBtnRef}
                onClick={() => isInteractive && currentBook && handleReadIt(currentBook)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full active:scale-95 transition-all text-slate-700 font-bold text-sm"
                style={glassBtnStyle}
              >
                <CheckCircle2 size={16} />
                <span>Read it</span>
              </button>
            </div>

            {/* Want to */}
            <div className="flex flex-col items-center flex-1">
              <BookPile pile="want" count={pileCounts.want} books={pileBooks.want} />
              <button
                ref={wantBtnRef}
                onClick={() => isInteractive && currentBook && handleWant(currentBook)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full active:scale-95 transition-all text-slate-700 font-bold text-sm"
                style={ratingPaused ? dimmedBtnStyle : glassBtnStyle}
              >
                <BookMarked size={16} />
                <span>Want to</span>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest text-center mt-3">
            {ratingPaused ? 'Rate this book' : 'Reading Status'}
          </p>
        </div>
      )}
    </div>
  );
});

export default BookDiscoverySwipe;
