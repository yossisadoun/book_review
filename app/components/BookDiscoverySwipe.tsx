'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, BookOpen, Check, BookmarkPlus, SkipForward } from 'lucide-react';
import Lottie from 'lottie-react';
import refreshAnimation from '@/public/refresh.json';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic } from '@/lib/capacitor';
import { getGradient } from '../services/book-utils';
import RatingStars from './RatingStars';
import { DISCOVERY_BOOKS, type DiscoveryBook } from '../data/discovery-books';
import type { ReadingStatus, Book } from '../types';

export type BookMeta = Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>;

/** Full-screen glassmorphic overlay with centered Lottie loader. Reusable transition screen. Stays visible for at least 0.5s. */
export function LoadingOverlay({ visible, fadingOut }: { visible: boolean; fadingOut?: boolean }) {
  const [show, setShow] = useState(false);
  const showAtRef = useRef(0);

  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setExiting(false);
      showAtRef.current = Date.now();
    } else if (show && !exiting) {
      const elapsed = Date.now() - showAtRef.current;
      const remaining = Math.max(0, 500 - elapsed);
      const t = setTimeout(() => {
        setExiting(true);
        // Remove after slide-up animation completes
        setTimeout(() => { setShow(false); setExiting(false); }, 400);
      }, remaining);
      return () => clearTimeout(t);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center transition-transform duration-400"
      style={{
        background: 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(9.4px)',
        WebkitBackdropFilter: 'blur(9.4px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        transform: exiting ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{ animation: 'discoveryFadeIn 0.3s ease-out' }}>
        <Lottie animationData={refreshAnimation} loop autoplay style={{ width: 80, height: 80 }} />
      </div>
    </div>
  );
}

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
@keyframes shelfBounceLoop {
  0% { transform: translateY(0); }
  15% { transform: translateY(-10px); }
  30% { transform: translateY(0); }
  100% { transform: translateY(0); }
}
@keyframes shelfTiltLoop {
  0% { transform: translateY(0) rotate(0deg); }
  8% { transform: translateY(-4px) rotate(10deg); }
  16% { transform: translateY(-4px) rotate(0deg); }
  24% { transform: translateY(-4px) rotate(-10deg); }
  32% { transform: translateY(0) rotate(0deg); }
  100% { transform: translateY(0) rotate(0deg); }
}
.shelf-celebrate .shelf-book { animation: shelfBounceLoop 1.3s ease infinite; }
.shelf-celebrate .shelf-board { animation: shelfTiltLoop 1.3s ease infinite; transform-origin: 50% 50%; }
@keyframes shelfTilt {
  0% { transform: translateY(0) rotate(0deg); }
  20% { transform: translateY(-4px) rotate(10deg); }
  40% { transform: translateY(-4px) rotate(0deg); }
  60% { transform: translateY(-4px) rotate(-10deg); }
  80% { transform: translateY(0) rotate(0deg); }
  100% { transform: translateY(0) rotate(0deg); }
}
@keyframes poof {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.5; }
  100% { transform: scale(0); opacity: 0; }
}
@keyframes fanCardIn {
  from { opacity: 0; transform: translateY(20px) rotate(0deg) scale(0.8); }
  to { opacity: 1; }
}
@keyframes summaryIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
.shelf-book-newest { animation-name: bookBounceIn; animation-duration: 0.4s; animation-timing-function: ease; }
.shelf-tapped .shelf-book { animation-name: shelfBookBounce; animation-duration: 0.4s; animation-timing-function: ease; }
.shelf-tapped .shelf-board { animation-name: shelfTilt; animation-duration: 0.4s; animation-timing-function: ease; transform-origin: 50% 50%; }
`;

// Number of images to render in the DOM stack (pre-decoded and ready)
const STACK_SIZE = 5;

type PileTarget = 'skip' | 'read' | 'want';
// "no" pause mode: user said No, we ask "Add to bookshelf?"
// "rating" pause mode: user said Yes, we ask for a rating
type PauseMode = 'rating' | 'save_for_later' | null;

interface PileBook {
  color: string;
  highlightColor: string;
  width: number;
  height: number;
}

const MAX_VISIBLE_BOOKS = 20;
const MAX_ROUND_BOOKS = 20;

// Book colors for shelves
const BOOK_PALETTES: [string, string][] = [
  ['#5DEEC7', '#a0f5df'], ['#7FD5FF', '#b8e8ff'], ['#EB92D1', '#f3bbe3'],
  ['#F06788', '#f6a0b5'], ['#FF8F88', '#ffbbb7'], ['#FFD391', '#ffe4ba'],
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

const BookPile = React.memo(function BookPile({ count, books, celebrate }: { pile: PileTarget; count: number; books: PileBook[]; celebrate?: boolean }) {
  const visible = books.slice(-MAX_VISIBLE_BOOKS);
  const [tapped, setTapped] = useState(false);
  const [animatedCount, setAnimatedCount] = useState(0);

  // Clear newest flag after bounce-in finishes
  useEffect(() => {
    if (books.length > animatedCount) {
      const t = setTimeout(() => setAnimatedCount(books.length), 450);
      return () => clearTimeout(t);
    }
  }, [books.length, animatedCount]);

  // Calculate total width of all books — shelf starts at 3-book size minimum
  let totalBooksWidth = 0;
  for (const b of visible) totalBooksWidth += b.width;
  const MIN_SHELF_INNER = 15; // start smaller, grows as books are added
  const shelfWidth = Math.max(totalBooksWidth, MIN_SHELF_INNER) + SHELF_PAD * 2;
  const svgWidth = shelfWidth + 8;

  // Position books left to right on the shelf
  const shelfX = (svgWidth - shelfWidth) / 2;
  let bookX = shelfX + SHELF_PAD;

  const handleTap = () => {
    setTapped(true);
    setTimeout(() => setTapped(false), 450);
  };

  const hasNewest = books.length > animatedCount;

  return (
    <div className="flex flex-col items-center justify-end" style={{ height: (SVG_HEIGHT + 20) * 2 }}>
      <svg
        className={celebrate ? 'shelf-celebrate' : tapped ? 'shelf-tapped' : ''}
        width={svgWidth * 2}
        height={SVG_HEIGHT * 2}
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
              className={`shelf-book${isNewest && hasNewest ? ' shelf-book-newest' : ''}`}
              style={{ animationDelay: `${i * (celebrate ? 0.06 : 0.04)}s` }}
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
    </div>
  );
});

// Count-up animation component
function CountUp({ target, duration = 1000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const steps = Math.min(target, 20);
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current++;
      setCount(current);
      if (current >= target) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{count}</>;
}

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
  const [pauseMode, setPauseMode] = useState<PauseMode>(null);
  const [pileCounts, setPileCounts] = useState({ skip: 0, read: 0, want: 0 });
  const [pileBooks, setPileBooks] = useState<{ skip: PileBook[]; read: PileBook[]; want: PileBook[] }>({ skip: [], read: [], want: [] });
  const [flyingBook, setFlyingBook] = useState<DiscoveryBook | null>(null);
  const [coversReady, setCoversReady] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [introExiting, setIntroExiting] = useState(false);
  const [firstCardEntrance, setFirstCardEntrance] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [showDoneMessage, setShowDoneMessage] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showClosingLoader, setShowClosingLoader] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const noBtnRef = useRef<HTMLButtonElement>(null);
  const yesBtnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const wantShelfRef = useRef<HTMLDivElement>(null);
  const readShelfRef = useRef<HTMLDivElement>(null);
  const rotationSeedRef = useRef(0);
  const prevIsOpenRef = useRef(false);

  // Snapshot filtered books when opening
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const filtered = DISCOVERY_BOOKS.filter(book => {
        const key = generateCanonicalBookId(book.title, book.author);
        return !existingBookKeys.has(key);
      });
      setSessionBooks(filtered.slice(0, MAX_ROUND_BOOKS));
      setProcessedCount(0);
      setPileCounts({ skip: 0, read: 0, want: 0 });
      setPileBooks({ skip: [], read: [], want: [] });
      setFlyingBook(null);
      setPendingBook(null);
      setAnimatingTo(null);
      setPauseMode(null);
      setCoversReady(false);
      setShowIntro(true);
      setIntroExiting(false);
      setFirstCardEntrance(true);
      setShowSummary(false);
      setShowDoneMessage(false);
      setClosing(false);
      setShowClosingLoader(false);
      setFadingOut(false);

      // Preload first 5 covers (3 for explainer fan + first stack cards), then mark ready
      const urlsToPreload = filtered.slice(0, 5)
        .map(b => getMediumCoverUrl(b.cover_url))
        .filter((u): u is string => !!u);
      if (urlsToPreload.length > 0) {
        let loaded = 0;
        const onDone = () => { loaded++; if (loaded >= urlsToPreload.length) setCoversReady(true); };
        for (const url of urlsToPreload) {
          const img = new Image();
          img.onload = onDone;
          img.onerror = onDone;
          img.src = url;
        }
      } else {
        setCoversReady(true);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, existingBookKeys]);

  const currentBook = sessionBooks[processedCount] || null;
  const remainingCount = sessionBooks.length - processedCount;

  // Show "done" message then transition to summary when all books are processed
  useEffect(() => {
    if (sessionBooks.length > 0 && processedCount >= sessionBooks.length && !showIntro && !pendingBook && !showSummary && !showDoneMessage) {
      // Phase 1: show "ALL DONE SORTING!" message
      const t1 = setTimeout(() => setShowDoneMessage(true), 400);
      return () => clearTimeout(t1);
    }
  }, [sessionBooks.length, processedCount, showIntro, pendingBook, showSummary, showDoneMessage]);

  // Transition from done message to summary
  useEffect(() => {
    if (showDoneMessage && !showSummary) {
      const t = setTimeout(() => {
        setShowDoneMessage(false);
        setShowSummary(true);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [showDoneMessage, showSummary]);

  // Build the pre-rendered image stack
  const stackBooks: (DiscoveryBook | null)[] = [];
  for (let i = 0; i < STACK_SIZE; i++) {
    stackBooks.push(sessionBooks[processedCount + i] || null);
  }

  // Preload next batch beyond the rendered stack
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
    const width = 5 + (seed % 5);
    const height = 24 + ((seed * 3 + book.title.length) % 11);
    const pileBook: PileBook = { color, highlightColor, width, height };
    setPileBooks(prev => ({
      ...prev,
      [pile]: [...prev[pile], pileBook],
    }));
  }, []);

  const advanceToNext = useCallback((target: PileTarget, book: DiscoveryBook) => {
    if (target !== 'skip') {
      setPileCounts(prev => ({ ...prev, [target]: prev[target] + 1 }));
      addBookToPile(target, book);
    }
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

  // "Yes" — user read it, show rating
  const handleYes = useCallback((book: DiscoveryBook) => {
    triggerSuccessHaptic();
    setPendingBook(book);
    setPauseMode('rating');
  }, []);

  // "No" — user didn't read it, ask "Add to bookshelf?"
  const handleNo = useCallback((book: DiscoveryBook) => {
    triggerLightHaptic();
    setPendingBook(book);
    setPauseMode('save_for_later');
  }, []);

  // Rating complete → add as read_it and fly to "yes" pile
  const handleRatingComplete = useCallback(async (_dimension: string, value: number | null) => {
    if (!pendingBook) return;
    const book = pendingBook;
    setPauseMode(null);
    setFlyingBook(book);
    setAnimatingTo('read');
    onAddBook(toBookMeta(book), 'read_it', value);
    setTimeout(() => {
      setAnimatingTo(null);
      advanceToNext('read', book);
      setPendingBook(null);
    }, 350);
  }, [pendingBook, onAddBook, advanceToNext]);

  // "Add to bookshelf" from save_for_later → add as want_to_read
  const handleSaveForLater = useCallback(async () => {
    if (!pendingBook) return;
    const book = pendingBook;
    setPauseMode(null);
    triggerMediumHaptic();
    setFlyingBook(book);
    setAnimatingTo('want');
    onAddBook(toBookMeta(book), 'want_to_read');
    setTimeout(() => {
      setAnimatingTo(null);
      advanceToNext('want', book);
      setPendingBook(null);
    }, 350);
  }, [pendingBook, onAddBook, advanceToNext]);

  // "Skip" from save_for_later → just skip
  const handleSkipFromSave = useCallback(() => {
    if (!pendingBook) return;
    const book = pendingBook;
    setPauseMode(null);
    setFlyingBook(book);
    setAnimatingTo('skip');
    setTimeout(() => {
      setAnimatingTo(null);
      advanceToNext('skip', book);
      setPendingBook(null);
    }, 350);
  }, [pendingBook, advanceToNext]);

  const handleClose = useCallback(() => {
    // Phase 1: fade out summary content
    setClosing(true);
    setTimeout(() => {
      // Phase 2: show loader on blank overlay
      setShowSummary(false);
      setClosing(false);
      setShowClosingLoader(true);
      setTimeout(() => {
        // Phase 3: fade out entire overlay
        setFadingOut(true);
        setTimeout(onClose, 500);
      }, 1200);
    }, 500);
  }, [onClose]);

  const handleCloseNoBooks = useCallback(() => {
    setFadingOut(true);
    setTimeout(onClose, 500);
  }, [onClose]);

  const getAnimationTarget = useCallback((target: PileTarget) => {
    const shelfRef = target === 'want' ? wantShelfRef : target === 'read' ? readShelfRef : null;
    const shelf = shelfRef?.current;
    const card = cardRef.current;
    if (!shelf || !card) return { x: 0, y: 300 };
    const shelfRect = shelf.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      x: (shelfRect.left + shelfRect.width / 2) - (cardRect.left + cardRect.width / 2),
      y: (shelfRect.top + shelfRect.height / 2) - (cardRect.top + cardRect.height / 2),
    };
  }, []);

  if (!isOpen) return null;

  const isPaused = pauseMode !== null;
  const displayBook = flyingBook || (isPaused ? (pendingBook || currentBook) : currentBook);
  const isInteractive = !animatingTo && !isPaused;

  // Card transform for the top card only
  let topCardTransform = 'translate3d(0, 0, 0) scale(1)';
  let topCardOpacity = 1;

  if (animatingTo === 'skip') {
    // Poof — scale up and vanish
    topCardTransform = 'translate3d(0, 0, 0) scale(1.3)';
    topCardOpacity = 0;
  } else if (animatingTo) {
    const target = getAnimationTarget(animatingTo);
    topCardTransform = `translate3d(${target.x}px, ${target.y}px, 0) scale(0.2)`;
    topCardOpacity = 0;
  } else if (isPaused) {
    const pauseTarget = pauseMode === 'save_for_later' ? 'want' : 'read';
    const target = getAnimationTarget(pauseTarget);
    topCardTransform = `translate3d(${target.x * 0.15}px, ${target.y * 0.12}px, 0) scale(0.55)`;
    topCardOpacity = 1;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col transition-opacity duration-500"
      style={{
        animation: !fadingOut ? 'discoveryFadeIn 0.3s ease-out' : undefined,
        opacity: fadingOut ? 0 : 1,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES_CSS }} />

      {/* Preload next batch of images beyond the rendered stack */}
      {preloadUrls.map(url => (
        <link key={url} rel="preload" as="image" href={url} />
      ))}

      <div className="fixed inset-0" style={overlayBgStyle} />

      {/* Header — centered with close button absolutely positioned */}
      {!showSummary && !showIntro && !showDoneMessage && (
        <div className="relative z-10 flex items-center justify-center px-4" style={{ paddingBottom: 0, paddingTop: 80 }}>
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-950 uppercase">Have You Read It?</h2>
            {!showIntro && remainingCount > 0 && (
              <p className="text-xs text-slate-500">{remainingCount} books left</p>
            )}
          </div>
          <button
            onClick={() => {
              if (pileCounts.want > 0 || pileCounts.read > 0) {
                setShowSummary(true);
              } else {
                handleCloseNoBooks();
              }
            }}
            className="absolute right-4 top-14 w-8 h-8 rounded-full bg-white/80 backdrop-blur-md border border-white/30 active:scale-95 transition-all flex items-center justify-center shadow-sm"
          >
            <X size={16} className="text-slate-700" />
          </button>
        </div>
      )}

      {/* Center content */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-4" style={{ marginTop: '-30px' }}>
        {/* Intro screen */}
        {showIntro && coversReady && (
          <div
            className="flex flex-col items-center max-w-[300px] text-center transition-all duration-300"
            style={{
              animation: !introExiting ? 'emptyStateIn 0.4s ease-out' : undefined,
              opacity: introExiting ? 0 : 1,
              transform: introExiting ? 'scale(0.95) translateY(-10px)' : undefined,
            }}
          >
            {/* Fanned book covers from session */}
            <div className="relative mb-6" style={{ width: 320, height: 220 }}>
              {sessionBooks.slice(0, 3).map((book, i) => {
                const rotations = [-10, 0, 10];
                const offsets = [20, 90, 160];
                const coverUrl = getMediumCoverUrl(book.cover_url);
                return (
                  <div
                    key={i}
                    className="absolute rounded-lg shadow-md overflow-hidden"
                    style={{
                      width: 140,
                      height: 200,
                      bottom: 0,
                      left: offsets[i],
                      transform: `rotate(${rotations[i]}deg)`,
                      zIndex: i,
                      animation: `fanCardIn 0.4s ease-out ${0.15 + i * 0.15}s both`,
                    }}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${getGradient(book.title)}`} />
                    {coverUrl && (
                      <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    )}
                  </div>
                );
              })}
            </div>

            <h3 className="text-xl font-bold text-slate-950 mb-2">
              We'll show you some books.
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed px-4">
              Tell us if you've read them, and we'll get your bookshelf going!
            </p>

            <button
              onClick={() => { setIntroExiting(true); setTimeout(() => setShowIntro(false), 300); }}
              className="mt-8 px-10 py-3 rounded-full font-bold text-sm text-white active:scale-95 transition-all"
              style={{
                background: 'rgba(59, 130, 246, 0.85)',
                backdropFilter: 'blur(9.4px)',
                WebkitBackdropFilter: 'blur(9.4px)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              Let's go
            </button>
          </div>
        )}



        {/* "All done" transition message */}
        {showDoneMessage && (
          <div
            className="flex flex-col items-center text-center"
            style={{ animation: 'ratingFadeUp 0.4s ease-out' }}
          >
            <h3 className="text-xl font-bold text-slate-950 uppercase tracking-wide">
              All done sorting!
            </h3>
          </div>
        )}

        {/* Summary screen */}
        {showSummary && (
          <div
            className="flex flex-col items-center text-center transition-all duration-500"
            style={{
              animation: !closing ? 'summaryIn 0.5s ease-out' : undefined,
              opacity: closing ? 0 : 1,
              transform: closing ? 'scale(0.95)' : undefined,
            }}
          >
            <h3 className="text-xl font-bold text-slate-950 mb-1">Your bookshelf is ready!</h3>
            <p className="text-sm text-slate-500 mb-8">Here's what we added</p>

            <div className="flex items-end justify-center gap-8">
              {pileCounts.want > 0 && (
                <div className="flex flex-col items-center" style={{ animation: 'ratingFadeUp 0.4s ease-out 0.2s both' }}>
                  <p className="text-6xl font-bold text-slate-950 leading-none">
                    <CountUp target={pileCounts.want} />
                  </p>
                  <p className="text-[10px] text-slate-400 -mb-8">{pileCounts.want === 1 ? 'book' : 'books'}</p>
                  <BookPile pile="want" count={pileCounts.want} books={pileBooks.want} celebrate />
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-1 whitespace-nowrap">Want to read</p>
                </div>
              )}
              {pileCounts.read > 0 && (
                <div className="flex flex-col items-center" style={{ animation: 'ratingFadeUp 0.4s ease-out 0.4s both' }}>
                  <p className="text-6xl font-bold text-slate-950 leading-none">
                    <CountUp target={pileCounts.read} duration={1200} />
                  </p>
                  <p className="text-[10px] text-slate-400 -mb-8">{pileCounts.read === 1 ? 'book' : 'books'}</p>
                  <BookPile pile="read" count={pileCounts.read} books={pileBooks.read} celebrate />
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-1 whitespace-nowrap">Read already</p>
                </div>
              )}
            </div>

            {pileCounts.want === 0 && pileCounts.read === 0 && (
              <p className="text-sm text-slate-500">No books added this round.</p>
            )}

            <button
              onClick={handleClose}
              className="mt-8 px-10 py-3 rounded-full font-bold text-sm text-white uppercase tracking-wide active:scale-95 transition-all"
              style={{
                background: 'rgba(59, 130, 246, 0.85)',
                backdropFilter: 'blur(9.4px)',
                WebkitBackdropFilter: 'blur(9.4px)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              Open Bookshelf
            </button>
          </div>
        )}

        {/* Card stack — ALL images pre-rendered in DOM, stacked via z-index */}
        {!showIntro && !showSummary && !showClosingLoader && coversReady && displayBook && (
          <div
            className="relative z-20 flex flex-col items-center"
            style={firstCardEntrance ? { animation: 'ratingFadeUp 0.5s ease-out' } : undefined}
            onAnimationEnd={firstCardEntrance ? () => setFirstCardEntrance(false) : undefined}
          >
            <div className="relative w-[200px] h-[300px]" ref={cardRef}>
              {stackBooks.map((book, i) => {
                if (!book) return null;
                const isTop = i === 0;
                const coverUrl = getMediumCoverUrl(book.cover_url);

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
                } else if (i === 1 && !isPaused) {
                  style = {
                    ...coverShadowStyle,
                    zIndex: STACK_SIZE - i,
                    transform: 'scale(0.96) translateY(5px)',
                    opacity: 0.5,
                  };
                } else if (i === 2 && !isPaused) {
                  style = {
                    ...coverShadowStyle,
                    zIndex: STACK_SIZE - i,
                    transform: 'scale(0.92) translateY(10px)',
                    opacity: 0.3,
                  };
                } else {
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
            {!isPaused && (
              <div className="mt-4 text-center max-w-[272px]">
                <h2 className="text-lg font-bold text-slate-950 line-clamp-2">{displayBook.title}</h2>
                <p className="text-sm text-slate-800 mt-1">{displayBook.author}</p>
                {displayBook.publish_year && (
                  <p className="text-xs text-slate-500 mt-0.5">{displayBook.publish_year}</p>
                )}
              </div>
            )}

            {/* Yes / No buttons */}
            {!isPaused && (
              <div className="flex gap-3 mt-4 relative z-20">
                <button
                  ref={noBtnRef}
                  onClick={() => isInteractive && currentBook && handleNo(currentBook)}
                  className="flex items-center justify-center gap-1.5 px-8 py-2.5 rounded-full active:scale-95 transition-all text-slate-700 font-bold text-sm"
                  style={glassBtnStyle}
                >
                  <X size={16} />
                  <span>No</span>
                </button>
                <button
                  ref={yesBtnRef}
                  onClick={() => isInteractive && currentBook && handleYes(currentBook)}
                  className="flex items-center justify-center gap-1.5 px-8 py-2.5 rounded-full active:scale-95 transition-all text-slate-700 font-bold text-sm"
                  style={glassBtnStyle}
                >
                  <Check size={16} />
                  <span>Yes</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Floating rating (Yes flow) */}
        {!showSummary && !showClosingLoader && pauseMode === 'rating' && pendingBook && (
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

        {/* Save for later prompt (No flow) */}
        {!showSummary && !showClosingLoader && pauseMode === 'save_for_later' && pendingBook && (
          <div
            className="mt-4 flex flex-col items-center"
            style={{ animation: 'ratingFadeUp 0.25s ease-out 0.2s both' }}
          >
            <p className="text-sm font-semibold text-slate-800 mb-1">Add to bookshelf?</p>
            <p className="text-xs text-slate-500 mb-4">{pendingBook.title}</p>
            <div className="flex gap-3">
              <button
                onClick={handleSaveForLater}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full active:scale-95 transition-all text-slate-700 font-bold text-sm"
                style={glassBtnStyle}
              >
                <BookmarkPlus size={16} />
                <span>Add</span>
              </button>
              <button
                onClick={handleSkipFromSave}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full active:scale-95 transition-all text-slate-700 font-bold text-sm"
                style={glassBtnStyle}
              >
                <SkipForward size={16} />
                <span>Skip</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom section: shelves with labels */}
      {!showIntro && !showSummary && !showClosingLoader && coversReady && (displayBook || isPaused || showDoneMessage) && (
        <div className="relative z-0 pb-10 pt-4 px-6 -mt-[100px]">
          <div className="flex items-end justify-center gap-4">
            <div ref={wantShelfRef} className="flex flex-col items-center">
              <BookPile pile="want" count={pileCounts.want} books={pileBooks.want} />
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-1 whitespace-nowrap">Want to read</p>
            </div>
            <div ref={readShelfRef} className="flex flex-col items-center">
              <BookPile pile="read" count={pileCounts.read} books={pileBooks.read} />
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-1 whitespace-nowrap">Read already</p>
            </div>
          </div>
        </div>
      )}

      {/* Reusable loading overlay — sits above everything */}
      <LoadingOverlay visible={showClosingLoader || (!coversReady && sessionBooks.length > 0)} fadingOut={fadingOut} />
    </div>
  );
});

export default BookDiscoverySwipe;
