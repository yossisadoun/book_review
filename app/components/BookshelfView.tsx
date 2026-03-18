'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  BookMarked,
  CheckCircle2,
  ChevronDown,
  User,
  LogOut,
  Trash2,
  Info,
  X,
  Plus,
  Check,
  Minus,
  Heart,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { CachedImage } from '@/components/CachedImage';
import { triggerLightHaptic, triggerMediumHaptic, triggerSuccessHaptic, storageSet } from '@/lib/capacitor';
import { getAssetPath, glassmorphicStyle } from './utils';
import ArrowAnimation from './ArrowAnimation';
import { calculateAvg, calculateScore, getGradient } from '../services/book-utils';
import { analytics } from '../services/analytics-service';
import type { BookWithRatings } from '../types';

// --- Avatar gradient (duplicated from page.tsx to avoid import coupling) ---
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fccb90, #d57eeb)',
  'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
];

function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// Default list that always exists and cannot be deleted
const DEFAULT_LIST = 'Top 5';

// Helper function to get alphabetical range for a letter
function getAlphabeticalRange(letter: string): string {
  const upper = letter.toUpperCase();
  if (upper >= 'A' && upper <= 'D') return 'A-D';
  if (upper >= 'E' && upper <= 'H') return 'E-H';
  if (upper >= 'I' && upper <= 'M') return 'I-M';
  if (upper >= 'N' && upper <= 'S') return 'N-S';
  return 'T-Z';
}

// --- Props Interface ---

export interface BookshelfViewProps {
  // Core data
  books: BookWithRatings[];
  booksForBookshelf: BookWithRatings[];
  user: { id: string; user_metadata?: any } | null;
  isReviewer: boolean;
  isAnonymous: boolean;

  // Profile info
  userName: string;
  userAvatar: string | null;
  myFollowingCount: number;

  // Viewing other user state
  viewingUserId: string | null;
  viewingUserBooks: BookWithRatings[];
  viewingUserName: string;
  viewingUserFullName: string | null;
  viewingUserAvatar: string | null;
  viewingUserIsPrivate: boolean;
  viewingUserFollowingCount: number;
  isLoadingViewingUserBooks: boolean;
  isFadingOutViewingUser: boolean;
  isFollowingViewingUser: boolean;
  isFollowLoading: boolean;
  handleToggleFollow: () => void;

  // Anonymous nudge
  nudgeBannerDismissed: boolean;
  setNudgeBannerDismissed: (val: boolean) => void;

  // Scroll system
  scrollContainerRef: React.MutableRefObject<HTMLElement | null>;
  updateScrollY: (value: number) => void;

  // Navigation callbacks
  onBookSelect: (index: number) => void;
  onViewOtherUserBook: (book: BookWithRatings) => void;
  openAddBookSheet: () => void;
  onShowAboutScreen: () => void;
  onShowNotesView: () => void;
  onShowFollowingPage: () => void;
  onShowAccountPage: () => void;

  // List management
  onUpdateBookLists: (bookId: string | string[], lists: string[]) => void;

  // Select mode callback so parent can hide/show bottom nav
  onSelectModeChange: (isActive: boolean) => void;

  // Auth
  signOut: () => Promise<void>;

  // Connect account
  setConnectAccountReason: (reason: 'book_limit' | 'follow' | 'feed' | 'account') => void;
  setShowConnectAccountModal: (show: boolean) => void;

  // Reading book picker
  setBooks: React.Dispatch<React.SetStateAction<BookWithRatings[]>>;

  // Capture previous view for sub-page back navigation
  capturePreviousView: () => void;

  // Chat state setters needed by profile menu
  setShowChatPage: (val: boolean) => void;
  setChatBookSelected: (val: boolean) => void;

  // Show bookshelf covers setter (needed for reading picker to exit)
  setShowBookshelfCovers: (val: boolean) => void;
}

export default function BookshelfView({
  books,
  booksForBookshelf,
  user,
  isReviewer,
  isAnonymous,
  userName,
  userAvatar,
  myFollowingCount,
  viewingUserId,
  viewingUserBooks,
  viewingUserName,
  viewingUserFullName,
  viewingUserAvatar,
  viewingUserIsPrivate,
  viewingUserFollowingCount,
  isLoadingViewingUserBooks,
  isFadingOutViewingUser,
  isFollowingViewingUser,
  isFollowLoading,
  handleToggleFollow,
  nudgeBannerDismissed,
  setNudgeBannerDismissed,
  scrollContainerRef,
  updateScrollY,
  onBookSelect,
  onViewOtherUserBook,
  openAddBookSheet,
  onShowAboutScreen,
  onShowNotesView,
  onShowFollowingPage,
  onShowAccountPage,
  onUpdateBookLists,
  onSelectModeChange,
  signOut,
  setConnectAccountReason,
  setShowConnectAccountModal,
  setBooks,
  capturePreviousView,
  setShowChatPage,
  setChatBookSelected,
  setShowBookshelfCovers,
}: BookshelfViewProps) {
  // --- State moved from page.tsx ---
  const [bookshelfGrouping, setBookshelfGrouping] = useState<'reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bookshelfGrouping');
      const validOptions: ('reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year' | 'list')[] = ['reading_status', 'added', 'rating', 'title', 'author', 'genre', 'publication_year', 'list'];
      return (validOptions.includes(saved as any) ? saved : 'reading_status') as 'reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year' | 'list';
    }
    return 'reading_status';
  });
  const [isBookshelfGroupingDropdownOpen, setIsBookshelfGroupingDropdownOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [showListSheet, setShowListSheet] = useState(false);
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showReadingBookPicker, setShowReadingBookPicker] = useState(false);

  // --- Refs ---
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressFiredRef = useRef(false);
  const bookshelfGroupingDropdownRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Save bookshelf grouping preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bookshelfGrouping', bookshelfGrouping);
    }
  }, [bookshelfGrouping]);

  // Close bookshelf grouping dropdown when clicking outside
  useEffect(() => {
    if (!isBookshelfGroupingDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (bookshelfGroupingDropdownRef.current && !bookshelfGroupingDropdownRef.current.contains(e.target as Node)) {
        setIsBookshelfGroupingDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isBookshelfGroupingDropdownOpen]);

  // Notify parent when select mode changes
  useEffect(() => {
    onSelectModeChange(isSelectMode && selectedBookIds.size > 0);
  }, [isSelectMode, selectedBookIds.size, onSelectModeChange]);

  // --- Computed values ---

  // All unique list names across all books (for the list sheet)
  const allListNames = useMemo(() => {
    const names = new Set<string>();
    names.add(DEFAULT_LIST);
    books.forEach(book => {
      if (book.lists && Array.isArray(book.lists)) {
        book.lists.forEach(name => names.add(name));
      }
    });
    // "Top 5" always first, rest alphabetical
    return [DEFAULT_LIST, ...Array.from(names).filter(n => n !== DEFAULT_LIST).sort((a, b) => a.localeCompare(b))];
  }, [books]);

  const groupedBooksForBookshelf = useMemo(() => {
    if (bookshelfGrouping === 'reading_status') {
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: 'Reading', books: [] },
        { label: 'Want to read', books: [] },
        { label: 'Read it', books: [] },
        { label: 'TBD', books: [] },
      ];

      booksForBookshelf.forEach(book => {
        const status = book.reading_status;
        if (status === 'reading') {
          groups[0].books.push(book);
        } else if (status === 'want_to_read') {
          groups[1].books.push(book);
        } else if (status === 'read_it') {
          groups[2].books.push(book);
        } else {
          groups[3].books.push(book);
        }
      });

      groups.forEach(group => {
        group.books.sort((a, b) => {
          const scoreA = calculateScore(a.ratings);
          const scoreB = calculateScore(b.ratings);
          return scoreB - scoreA;
        });
      });

      return groups.filter(group => group.books.length > 0 || (group.label === 'Reading' && !viewingUserId && booksForBookshelf.length > 0));
    } else if (bookshelfGrouping === 'rating') {
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: '5 hearts', books: [] },
        { label: '4 hearts', books: [] },
        { label: '3 hearts', books: [] },
        { label: '2 hearts', books: [] },
        { label: '1 heart', books: [] },
        { label: 'Unrated', books: [] },
      ];

      booksForBookshelf.forEach(book => {
        const score = calculateScore(book.ratings);

        if (score === 0) {
          groups[5].books.push(book);
        } else if (score >= 4.5) {
          groups[0].books.push(book);
        } else if (score >= 3.5) {
          groups[1].books.push(book);
        } else if (score >= 2.5) {
          groups[2].books.push(book);
        } else if (score >= 1.5) {
          groups[3].books.push(book);
        } else {
          groups[4].books.push(book);
        }
      });

      groups.forEach(group => {
        group.books.sort((a, b) => {
          const scoreA = calculateScore(a.ratings);
          const scoreB = calculateScore(b.ratings);
          return scoreB - scoreA;
        });
      });

      return groups.filter(group => group.books.length > 0);
    } else if (bookshelfGrouping === 'added') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: 'Today', books: [] },
        { label: 'This week', books: [] },
        { label: 'This month', books: [] },
        { label: 'This year', books: [] },
        { label: 'Later', books: [] },
      ];

      booksForBookshelf.forEach(book => {
        const createdDate = new Date(book.created_at);

        if (createdDate >= todayStart) {
          groups[0].books.push(book);
        } else if (createdDate >= oneWeekAgo) {
          groups[1].books.push(book);
        } else if (createdDate >= oneMonthAgo) {
          groups[2].books.push(book);
        } else if (createdDate >= oneYearAgo) {
          groups[3].books.push(book);
        } else {
          groups[4].books.push(book);
        }
      });

      groups.forEach(group => {
        group.books.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA;
        });
      });

      return groups.filter(group => group.books.length > 0);
    } else if (bookshelfGrouping === 'title') {
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: 'A-D', books: [] },
        { label: 'E-H', books: [] },
        { label: 'I-M', books: [] },
        { label: 'N-S', books: [] },
        { label: 'T-Z', books: [] },
      ];

      booksForBookshelf.forEach(book => {
        const firstLetter = book.title?.[0]?.toUpperCase() || 'Z';
        const range = getAlphabeticalRange(firstLetter);
        const groupIndex = groups.findIndex(g => g.label === range);
        if (groupIndex !== -1) {
          groups[groupIndex].books.push(book);
        }
      });

      groups.forEach(group => {
        group.books.sort((a, b) => {
          const titleA = (a.title || '').toUpperCase();
          const titleB = (b.title || '').toUpperCase();
          return titleA.localeCompare(titleB);
        });
      });

      return groups.filter(group => group.books.length > 0);
    } else if (bookshelfGrouping === 'author') {
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: 'A-D', books: [] },
        { label: 'E-H', books: [] },
        { label: 'I-M', books: [] },
        { label: 'N-S', books: [] },
        { label: 'T-Z', books: [] },
      ];

      booksForBookshelf.forEach(book => {
        const firstLetter = book.author?.[0]?.toUpperCase() || 'Z';
        const range = getAlphabeticalRange(firstLetter);
        const groupIndex = groups.findIndex(g => g.label === range);
        if (groupIndex !== -1) {
          groups[groupIndex].books.push(book);
        }
      });

      groups.forEach(group => {
        group.books.sort((a, b) => {
          const authorA = (a.author || '').toUpperCase();
          const authorB = (b.author || '').toUpperCase();
          return authorA.localeCompare(authorB);
        });
      });

      return groups.filter(group => group.books.length > 0);
    } else if (bookshelfGrouping === 'genre') {
      const genreMap = new Map<string, BookWithRatings[]>();
      const genreDisplayNames = new Map<string, string>();

      booksForBookshelf.forEach(book => {
        const genre = book.genre || 'No Genre';
        const genreLower = genre.toLowerCase();

        if (!genreMap.has(genreLower)) {
          genreMap.set(genreLower, []);
          genreDisplayNames.set(genreLower, genre);
        }
        genreMap.get(genreLower)!.push(book);
      });

      const groups: { label: string; books: BookWithRatings[] }[] = Array.from(genreMap.entries())
        .map(([genreLower, books]) => ({
          label: genreDisplayNames.get(genreLower) || genreLower,
          books: books.sort((a, b) => {
            const titleA = (a.title || '').toUpperCase();
            const titleB = (b.title || '').toUpperCase();
            return titleA.localeCompare(titleB);
          })
        }))
        .sort((a, b) => {
          const labelA = a.label.toLowerCase();
          const labelB = b.label.toLowerCase();
          if (labelA === 'no genre') return 1;
          if (labelB === 'no genre') return -1;
          return labelA.localeCompare(labelB);
        });

      return groups;
    } else if (bookshelfGrouping === 'publication_year') {
      const decadeMap = new Map<string, BookWithRatings[]>();

      booksForBookshelf.forEach(book => {
        const year = book.first_issue_year || book.publish_year;
        let decadeLabel: string;

        if (year && typeof year === 'number' && year > 0) {
          const decade = Math.floor(year / 10) * 10;
          decadeLabel = `${decade}s`;
        } else {
          decadeLabel = 'Unknown';
        }

        if (!decadeMap.has(decadeLabel)) {
          decadeMap.set(decadeLabel, []);
        }
        decadeMap.get(decadeLabel)!.push(book);
      });

      const groups: { label: string; books: BookWithRatings[] }[] = Array.from(decadeMap.entries())
        .map(([decadeLabel, books]) => ({
          label: decadeLabel,
          books: books.sort((a, b) => {
            const yearA = a.first_issue_year || a.publish_year || 0;
            const yearB = b.first_issue_year || b.publish_year || 0;
            return yearB - yearA;
          })
        }))
        .sort((a, b) => {
          if (a.label === 'Unknown') return 1;
          if (b.label === 'Unknown') return -1;

          const decadeA = parseInt(a.label.replace('s', '')) || 0;
          const decadeB = parseInt(b.label.replace('s', '')) || 0;
          return decadeB - decadeA;
        });

      return groups;
    } else if (bookshelfGrouping === 'list') {
      const listMap = new Map<string, BookWithRatings[]>();

      booksForBookshelf.forEach(book => {
        const bookLists = book.lists && Array.isArray(book.lists) && book.lists.length > 0 ? book.lists : null;
        if (bookLists) {
          bookLists.forEach(listName => {
            if (!listMap.has(listName)) {
              listMap.set(listName, []);
            }
            listMap.get(listName)!.push(book);
          });
        } else {
          if (!listMap.has('No List')) {
            listMap.set('No List', []);
          }
          listMap.get('No List')!.push(book);
        }
      });

      const groups: { label: string; books: BookWithRatings[] }[] = Array.from(listMap.entries())
        .map(([listName, books]) => ({
          label: listName,
          books: books.sort((a, b) => {
            const titleA = (a.title || '').toUpperCase();
            const titleB = (b.title || '').toUpperCase();
            return titleA.localeCompare(titleB);
          })
        }))
        .sort((a, b) => {
          if (a.label === DEFAULT_LIST) return -1;
          if (b.label === DEFAULT_LIST) return 1;
          if (a.label === 'No List') return 1;
          if (b.label === 'No List') return -1;
          return a.label.localeCompare(b.label);
        });

      return groups;
    }
    // Default fallback (should never happen)
    return [];
  }, [booksForBookshelf, bookshelfGrouping, viewingUserId]);

  // --- Render ---
  return (
    <>
      <motion.main
        key="bookshelf-covers"
        ref={(el) => { scrollContainerRef.current = el; }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isFadingOutViewingUser ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
        style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem + var(--safe-area-bottom, 0px))' }}
        onScroll={(e) => {
          const target = e.currentTarget;
          updateScrollY(target.scrollTop);
        }}
      >
        {/* Arrow Animation Overlay - only show on own bookshelf when grouped by status and no books in Reading */}
        {!viewingUserId && bookshelfGrouping === 'reading_status' && books.filter(b => b.reading_status === 'reading').length === 0 && <ArrowAnimation isBookshelfEmpty={booksForBookshelf.length === 0} playOnce opaque />}

        {/* Bookshelf Covers View */}
        <div
          className="w-full flex flex-col items-center px-4"
        >
          {isLoadingViewingUserBooks ? (
            <div className="w-full max-w-[1600px] flex flex-col gap-2.5 py-8">
              {/* Profile Skeleton */}
              <motion.div
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-2xl p-4 mb-4"
                style={glassmorphicStyle}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar skeleton */}
                  <div className="w-16 h-16 rounded-full bg-slate-300/50 dark:bg-slate-600/50 animate-pulse" />
                  {/* Stats skeleton */}
                  <div className="flex-1 flex gap-6">
                    <div className="text-center">
                      <div className="w-8 h-7 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mx-auto mb-1" />
                      <div className="w-10 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mx-auto" />
                    </div>
                    <div className="text-center">
                      <div className="w-8 h-7 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mx-auto mb-1" />
                      <div className="w-14 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mx-auto" />
                    </div>
                  </div>
                  {/* Follow button skeleton */}
                  <div className="w-24 h-10 bg-slate-300/50 dark:bg-slate-600/50 rounded-xl animate-pulse" />
                </div>
              </motion.div>
              {/* Grouping selector skeleton */}
              <div className="flex items-center justify-between px-4 mb-1.5">
                <motion.div
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
                  className="w-20 h-10 bg-slate-300/30 rounded-lg animate-pulse"
                />
              </div>
              {/* Bookshelf group skeleton */}
              <motion.div
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                className="rounded-2xl p-4"
                style={glassmorphicStyle}
              >
                <div className="w-24 h-5 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mb-4" />
                <div className="flex gap-3 overflow-hidden">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex-shrink-0 w-[100px]">
                      <div className="w-full aspect-[2/3] bg-slate-300/50 dark:bg-slate-600/50 rounded-lg animate-pulse mb-2" />
                      <div className="w-full h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mb-1" />
                      <div className="w-2/3 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </motion.div>
              {/* Second group skeleton */}
              <motion.div
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                className="rounded-2xl p-4"
                style={glassmorphicStyle}
              >
                <div className="w-32 h-5 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mb-4" />
                <div className="flex gap-3 overflow-hidden">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex-shrink-0 w-[100px]">
                      <div className="w-full aspect-[2/3] bg-slate-300/50 dark:bg-slate-600/50 rounded-lg animate-pulse mb-2" />
                      <div className="w-full h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mb-1" />
                      <div className="w-2/3 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
          <div className="w-full max-w-[1600px] flex flex-col gap-2.5 py-8">
            {/* Profile Panel */}
            {!viewingUserId ? (
              <div
                className="rounded-2xl p-4 mb-4 overflow-hidden"
                style={glassmorphicStyle}
              >
                <div className="flex items-center gap-4">
                  {/* Profile Picture - 2x size */}
                  <div className="relative">
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="active:scale-95 transition-transform"
                    >
                      {userAvatar ? (
                        <img
                          src={userAvatar}
                          alt={userName}
                          className="w-16 h-16 shrink-0 rounded-full object-cover border-2 border-white/50"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-16 h-16 shrink-0 rounded-full flex items-center justify-center border-2 border-white/50" style={{ background: avatarGradient(user?.id || userName) }}>
                          <span className="text-2xl font-bold text-white">
                            {userName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </button>
                  </div>
                  {/* Stats */}
                  <div className="flex-1 flex gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-950 dark:text-slate-50">{books.length}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Books</p>
                    </div>
                    <button
                      onClick={() => { analytics.trackEvent('nav', 'tap', { destination: 'notes' }); onShowNotesView(); }}
                      className="text-center hover:opacity-70 active:scale-95 transition-all"
                    >
                      <p className="text-2xl font-bold text-slate-950 dark:text-slate-50">{books.filter(b => b.notes && b.notes.trim()).length}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Notes</p>
                    </button>
                    <button
                      onClick={() => { analytics.trackEvent('nav', 'tap', { destination: 'following' }); onShowFollowingPage(); }}
                      className="text-center hover:opacity-70 active:scale-95 transition-all"
                    >
                      <p className="text-2xl font-bold text-slate-950 dark:text-slate-50">{myFollowingCount}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Following</p>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl p-4 mb-4"
                style={glassmorphicStyle}
              >
                <div className="flex items-center gap-4">
                  {/* Profile Picture - 2x size */}
                  {viewingUserAvatar ? (
                    <img
                      src={viewingUserAvatar}
                      alt={viewingUserFullName || viewingUserName}
                      className="w-16 h-16 rounded-full object-cover border-2 border-white/50"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-white/50" style={{ background: avatarGradient(viewingUserId || viewingUserName) }}>
                      <span className="text-2xl font-bold text-white">
                        {(viewingUserFullName || viewingUserName).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Stats */}
                  <div className="flex-1 flex gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-950 dark:text-slate-50">{viewingUserBooks.length}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Books</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-950 dark:text-slate-50">{viewingUserFollowingCount}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Following</p>
                    </div>
                  </div>
                  {/* Follow Button */}
                  <motion.button
                    onClick={handleToggleFollow}
                    disabled={isFollowLoading}
                    animate={isFollowLoading ? {
                      opacity: [1, 0.5, 1],
                      scale: [1, 0.97, 1],
                    } : {
                      opacity: 1,
                      scale: 1,
                    }}
                    transition={isFollowLoading ? {
                      duration: 0.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    } : {
                      duration: 0.2,
                    }}
                    className={`w-24 py-2 rounded-xl font-bold text-sm transition-colors active:scale-95 ${
                      isFollowingViewingUser
                        ? 'text-blue-700'
                        : 'text-white'
                    }`}
                    style={isFollowingViewingUser ? {
                      background: 'rgba(219, 234, 254, 0.6)',
                      backdropFilter: 'blur(9.4px)',
                      WebkitBackdropFilter: 'blur(9.4px)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    } : {
                      background: 'rgba(59, 130, 246, 0.85)',
                      backdropFilter: 'blur(9.4px)',
                      WebkitBackdropFilter: 'blur(9.4px)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    {isFollowingViewingUser ? 'Following' : 'Follow'}
                  </motion.button>
                </div>
              </div>
            )}
            {/* Grouping Selector - Dropdown and Play Button (hidden when bookshelf is empty) */}
            {booksForBookshelf.length > 0 && (
            <div className="flex items-center justify-between px-4 mb-1.5">
              <div className="relative" ref={bookshelfGroupingDropdownRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBookshelfGroupingDropdownOpen(!isBookshelfGroupingDropdownOpen);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all text-slate-700 dark:text-slate-300 hover:opacity-80"
                  style={glassmorphicStyle}
                >
                  <span className="text-slate-400 font-normal">Group by</span>
                  <span>
                    {bookshelfGrouping === 'reading_status' ? 'Status' :
                     bookshelfGrouping === 'added' ? 'Added' :
                     bookshelfGrouping === 'rating' ? 'Rating' :
                     bookshelfGrouping === 'title' ? 'Title' :
                     bookshelfGrouping === 'author' ? 'Author' :
                     bookshelfGrouping === 'genre' ? 'Genre' :
                     bookshelfGrouping === 'publication_year' ? 'Year' :
                     bookshelfGrouping === 'list' ? 'List' : 'Status'}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${isBookshelfGroupingDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isBookshelfGroupingDropdownOpen && (
                  <>
                    {/* Backdrop to close menu */}
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsBookshelfGroupingDropdownOpen(false)}
                    />
                    {/* Menu */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-0 mt-1 z-40 rounded-lg min-w-[140px] overflow-hidden"
                      style={glassmorphicStyle}
                    >
                      {[
                        { value: 'reading_status', label: 'Status' },
                        { value: 'list', label: 'List' },
                        { value: 'added', label: 'Added' },
                        { value: 'rating', label: 'Rating' },
                        { value: 'title', label: 'Title' },
                        { value: 'author', label: 'Author' },
                        { value: 'publication_year', label: 'Year' },
                      ].map((option, idx) => (
                        <button
                          key={option.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            setBookshelfGrouping(option.value as 'reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year' | 'list');
                            setIsBookshelfGroupingDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                            idx > 0 ? 'border-t border-white/20 dark:border-white/10' : ''
                          } ${
                            bookshelfGrouping === option.value
                              ? 'text-slate-950 dark:text-slate-50 bg-white/20 dark:bg-white/8'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:bg-white/8 active:bg-white/30 dark:bg-white/12'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </div>
              {/* Select / Done button */}
              {!viewingUserId && (
                <button
                  onClick={() => {
                    if (isSelectMode) {
                      setIsSelectMode(false);
                      setSelectedBookIds(new Set());
                    } else {
                      setIsSelectMode(true);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    isSelectMode
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {isSelectMode ? 'Done' : 'Select'}
                </button>
              )}
            </div>
            )}

            {/* Empty state - show when no books */}
            {booksForBookshelf.length === 0 && !viewingUserId ? (
              <div
                className="relative flex flex-col gap-4 rounded-2xl overflow-hidden"
                style={{ ...glassmorphicStyle, padding: '0.8rem 0' }}
              >
                <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50 px-[4vw] flex items-center gap-2">
                  ADD YOUR FIRST BOOK
                </h2>
                <div className="px-[4vw] flex items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center cursor-pointer group w-[100px] flex-shrink-0"
                    onClick={() => openAddBookSheet()}
                  >
                    <div
                      className="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg mb-2 group-hover:scale-105 transition-all flex items-center justify-center"
                      style={glassmorphicStyle}
                    >
                      <Plus size={32} className="text-slate-400 group-hover:text-blue-600 dark:text-blue-400 transition-colors" />
                    </div>
                  </motion.div>
                  <div className="flex flex-col gap-1 self-start">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">We&apos;ll pull videos, podcasts and fun facts around and generally try and make reading it richer!</p>
                  </div>
                </div>
                <button
                  onClick={() => { onShowAboutScreen(); }}
                  className="absolute bottom-2 right-3 w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 active:scale-95 transition-all"
                >
                  <Info size={18} className="text-slate-400" />
                </button>
              </div>
            ) : booksForBookshelf.length === 0 && viewingUserId ? (
              <div
                className="flex flex-col items-center justify-center text-center space-y-6 py-[30px] rounded-2xl"
                style={glassmorphicStyle}
              >
                <img src={getAssetPath("/logo.png")} alt="Book.luv" className="object-contain mx-auto" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {viewingUserIsPrivate ? "This user's bookshelf is private." : "This user hasn't added any books yet."}
                </p>
              </div>
            ) : null}

            {/* Anonymous nudge banner */}
            {isAnonymous && books.length >= 10 && !nudgeBannerDismissed && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-2xl p-4 flex items-start gap-3"
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  backdropFilter: 'blur(9.4px)',
                  WebkitBackdropFilter: 'blur(9.4px)',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Enjoying the app?</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Connect an account to unlock all features and keep your books safe.</p>
                  <button
                    onClick={() => {
                      setConnectAccountReason('book_limit');
                      setShowConnectAccountModal(true);
                    }}
                    className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold text-white active:scale-95 transition-all"
                    style={{
                      background: 'rgba(59, 130, 246, 0.85)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    Connect
                  </button>
                </div>
                <button
                  onClick={async () => {
                    setNudgeBannerDismissed(true);
                    await storageSet('nudge_banner_dismissed', 'true');
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-full active:scale-90 transition-transform flex-shrink-0"
                >
                  <X size={14} className="text-slate-400" />
                </button>
              </motion.div>
            )}

            {groupedBooksForBookshelf.map((group, groupIdx) => (
              <motion.div
                key={group.label || `group-${groupIdx}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIdx * 0.1, duration: 0.4 }}
                className="flex flex-col gap-4 rounded-2xl overflow-hidden"
                style={{
                  ...glassmorphicStyle,
                  padding: '0.8rem 0',
                }}
              >
                {/* Shelf Label */}
                <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50 px-[4vw] flex items-center gap-2">
                  {group.label}
                  <span className="text-xs font-medium text-slate-400">{group.books.length}</span>
                  {bookshelfGrouping === 'reading_status' && (
                    <>
                      {group.label === 'Read it' && <CheckCircle2 size={20} className="text-slate-950 dark:text-slate-50" />}
                      {group.label === 'Reading' && <BookOpen size={20} className="text-slate-950 dark:text-slate-50" />}
                      {group.label === 'Want to read' && <BookMarked size={20} className="text-slate-950 dark:text-slate-50" />}
                      {group.label === 'TBD' && <span className="w-5 h-5" />}
                    </>
                  )}
                </h2>

                {/* Covers Grid */}
                <div className="px-[4vw] grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                  {/* Empty Reading group placeholder */}
                  {group.label === 'Reading' && group.books.length === 0 && !viewingUserId && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex flex-col items-center cursor-pointer group"
                      onClick={() => {
                        const wantToReadBooks = books.filter(b => b.reading_status === 'want_to_read');
                        if (wantToReadBooks.length > 0) {
                          setShowReadingBookPicker(true);
                        } else {
                          openAddBookSheet();
                        }
                      }}
                    >
                      {/* Placeholder Cover */}
                      <div
                        className="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg mb-2 group-hover:scale-105 transition-all flex items-center justify-center"
                        style={glassmorphicStyle}
                      >
                        <Plus size={32} className="text-slate-400 group-hover:text-blue-600 dark:text-blue-400 transition-colors" />
                      </div>
                    </motion.div>
                  )}
                  {group.books.map((book, idx) => {
                              const bookIndex = booksForBookshelf.findIndex(b => b.id === book.id);
                    const avgScore = calculateAvg(book.ratings);

                    return (
                      <motion.div
                        key={book.id || `book-${groupIdx}-${idx}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          delay: (groupIdx * 0.05) + (idx * 0.02),
                          duration: 0.3,
                        }}
                        className="flex flex-col items-center cursor-pointer group"
                        onClick={() => {
                          if (longPressFiredRef.current) {
                            longPressFiredRef.current = false;
                            return;
                          }
                          if (isSelectMode && !viewingUserId) {
                            triggerLightHaptic();
                            setSelectedBookIds(prev => {
                              const next = new Set(prev);
                              if (next.has(book.id)) {
                                next.delete(book.id);
                              } else {
                                next.add(book.id);
                              }
                              if (next.size === 0) {
                                setIsSelectMode(false);
                              }
                              return next;
                            });
                            return;
                          }
                          if (viewingUserId) {
                            onViewOtherUserBook(book);
                          } else if (bookIndex !== -1) {
                            onBookSelect(bookIndex);
                          }
                        }}
                        onTouchStart={(e) => {
                          if (viewingUserId) return;
                          if (isSelectMode) return;
                          const touch = e.touches[0];
                          const startX = touch.clientX;
                          const startY = touch.clientY;
                          longPressFiredRef.current = false;
                          longPressTimerRef.current = setTimeout(() => {
                            longPressFiredRef.current = true;
                            triggerMediumHaptic();
                            setIsSelectMode(true);
                            setSelectedBookIds(new Set([book.id]));
                          }, 500);
                          (longPressTimerRef as any)._startX = startX;
                          (longPressTimerRef as any)._startY = startY;
                        }}
                        onTouchMove={(e) => {
                          if (longPressTimerRef.current) {
                            const touch = e.touches[0];
                            const dx = touch.clientX - ((longPressTimerRef as any)._startX || 0);
                            const dy = touch.clientY - ((longPressTimerRef as any)._startY || 0);
                            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                              clearTimeout(longPressTimerRef.current);
                              longPressTimerRef.current = null;
                            }
                          }
                        }}
                        onTouchEnd={() => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        }}
                        onContextMenu={(e) => {
                          if (viewingUserId) return;
                          e.preventDefault();
                          longPressFiredRef.current = true;
                          if (!isSelectMode) {
                            setIsSelectMode(true);
                            setSelectedBookIds(new Set([book.id]));
                          } else {
                            setSelectedBookIds(prev => {
                              const next = new Set(prev);
                              if (next.has(book.id)) {
                                next.delete(book.id);
                              } else {
                                next.add(book.id);
                              }
                              if (next.size === 0) {
                                setIsSelectMode(false);
                              }
                              return next;
                            });
                          }
                        }}
                      >
                        {/* Book Cover */}
                        <div
                          className={`relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg mb-2 transition-all duration-200 ${
                            isSelectMode && selectedBookIds.has(book.id)
                              ? 'ring-2 ring-blue-500 scale-[0.92]'
                              : 'group-hover:scale-105'
                          }`}
                        >
                          {/* Selection checkmark overlay */}
                          {isSelectMode && selectedBookIds.has(book.id) && (
                            <div className="absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-md">
                              <Check size={12} className="text-white" strokeWidth={3} />
                            </div>
                          )}
                          {isSelectMode && !selectedBookIds.has(book.id) && (
                            <div className="absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full bg-black/30 border-2 border-white/70 flex items-center justify-center" />
                          )}
                          {book.cover_url ? (
                            <CachedImage
                              src={book.cover_url}
                              alt={book.title}
                              className="w-full h-full object-cover"
                              fallback={
                                <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                                  <BookOpen size={32} className="text-white opacity-30" />
                                </div>
                              }
                            />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                              <BookOpen size={32} className="text-white opacity-30" />
                            </div>
                          )}
                          {/* Rating Badge */}
                          {avgScore && (
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                              <Heart size={12} className="fill-pink-500 text-pink-500" />
                              <span className="text-xs font-bold text-white">{avgScore}</span>
                      </div>
                    )}
                  </div>
                        {/* Book Title or Author */}
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 text-center line-clamp-2 px-1">
                          {bookshelfGrouping === 'author' ? (book.author || 'Unknown Author') : book.title}
                        </p>
              </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
          )}
        </div>
      </motion.main>

      {/* Select-mode action bar (fixed overlay) */}
      {isSelectMode && selectedBookIds.size > 0 && (
        <div className="fixed left-0 right-0 z-[50] flex justify-center px-4 pointer-events-none" style={{ bottom: 'calc(16px + var(--safe-area-bottom, 0px))' }}>
          <motion.div
            key="select-bar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="flex items-center gap-3 rounded-2xl px-5 py-2.5 pointer-events-auto shadow-lg"
            style={glassmorphicStyle}
          >
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {selectedBookIds.size} selected
            </span>
            <button
              onClick={() => setShowListSheet(true)}
              className="px-4 py-1.5 rounded-full text-sm font-bold text-white transition-all active:scale-95"
              style={{
                background: 'rgba(59, 130, 246, 0.9)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              Add to List
            </button>
          </motion.div>
        </div>
      )}

      {/* Profile panel menu - rendered at root level for topmost z-index */}
      <AnimatePresence>
        {showProfileMenu && (
          <>
            {/* Backdrop to close menu */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setShowProfileMenu(false)}
            />
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed top-[200px] left-[26px] z-[9999] rounded-lg min-w-[140px] overflow-hidden"
              style={glassmorphicStyle}
            >
              {!isReviewer && (
              <button
                onClick={() => {
                  analytics.trackEvent('nav', 'tap', { destination: 'account' });
                  capturePreviousView();
                  updateScrollY(0);
                  onShowAccountPage();
                  setShowChatPage(false);
                  setChatBookSelected(false);
                  setShowProfileMenu(false);
                }}
                className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:bg-white/8 active:bg-white/30 dark:bg-white/12 transition-colors border-b border-white/20 dark:border-white/10"
              >
                <User size={16} className="text-slate-600 dark:text-slate-400" />
                <span>Account</span>
              </button>
              )}
              <button
                onClick={async () => {
                  await signOut();
                  setShowProfileMenu(false);
                }}
                className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:bg-white/8 active:bg-white/30 dark:bg-white/12 transition-colors border-b border-white/20 dark:border-white/10"
              >
                <LogOut size={16} className="text-slate-600 dark:text-slate-400" />
                <span>Logout</span>
              </button>
              {isReviewer && (
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    capturePreviousView();
                    updateScrollY(0);
                    onShowAccountPage();
                    setShowChatPage(false);
                    setChatBookSelected(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium text-red-500 hover:bg-white/20 dark:bg-white/8 active:bg-white/30 dark:bg-white/12 transition-colors"
                >
                  <Trash2 size={16} />
                  <span>Delete Account</span>
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Batch Add to List Bottom Sheet */}
      <AnimatePresence>
        {showListSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-end bg-black/40 backdrop-blur-sm px-4"
            onClick={() => {
              setShowListSheet(false);
              setShowNewListInput(false);
              setNewListName('');
            }}
          >
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-md overflow-hidden"
              style={{ ...glassmorphicStyle, background: 'rgba(255, 255, 255, 0.85)', maxHeight: '70vh', borderRadius: '24px 24px 0 0' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-300" />
              </div>

              {/* Header */}
              <div className="px-5 pt-2 pb-3 border-b border-white/20 dark:border-white/10">
                <p className="text-base font-bold text-slate-950 dark:text-slate-50">Add to List</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedBookIds.size} book{selectedBookIds.size !== 1 ? 's' : ''} selected</p>
              </div>

              {/* List rows */}
              <div className="max-h-[40vh] overflow-y-auto">
                {allListNames.map(listName => {
                  const selectedBooks = books.filter(b => selectedBookIds.has(b.id));
                  const inListCount = selectedBooks.filter(b => b.lists?.includes(listName)).length;
                  const allIn = inListCount === selectedBooks.length;
                  const someIn = inListCount > 0 && !allIn;
                  const noneIn = inListCount === 0;
                  const isTop5 = listName === DEFAULT_LIST;
                  const currentTop5InList = books.filter(b => b.lists?.includes(DEFAULT_LIST)).length;
                  const wouldAdd = selectedBooks.filter(b => !b.lists?.includes(DEFAULT_LIST)).length;
                  const isTop5Full = isTop5 && noneIn && (currentTop5InList + wouldAdd) > 5;
                  const isTop5PartialFull = isTop5 && someIn && (currentTop5InList + (selectedBooks.length - inListCount)) > 5;
                  const listBooks = books.filter(b => b.lists?.includes(listName));
                  const lastBookCover = listBooks.length > 0 ? listBooks[listBooks.length - 1]?.cover_url : null;

                  return (
                    <button
                      key={listName}
                      disabled={isTop5Full}
                      onClick={() => {
                        if (isTop5Full) return;
                        const bookIds = Array.from(selectedBookIds);
                        if (allIn || someIn) {
                          bookIds.forEach(id => {
                            const book = books.find(b => b.id === id);
                            if (book) {
                              const newLists = (book.lists || []).filter((l: string) => l !== listName);
                              onUpdateBookLists(id, newLists);
                            }
                          });
                        } else {
                          if (isTop5 && isTop5PartialFull) return;
                          bookIds.forEach(id => {
                            const book = books.find(b => b.id === id);
                            if (book && !book.lists?.includes(listName)) {
                              const newLists = [...(book.lists || []), listName];
                              onUpdateBookLists(id, newLists);
                            }
                          });
                        }
                      }}
                      className={`w-full px-5 py-3 flex items-center gap-3 text-sm transition-colors ${
                        isTop5Full ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:bg-white/8 active:bg-white/30 dark:bg-white/12'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        allIn ? 'bg-blue-500 border-blue-500' : someIn ? 'bg-blue-500/50 border-blue-500' : isTop5Full ? 'border-slate-300' : 'border-slate-400'
                      }`}>
                        {allIn && <Check size={12} className="text-white" strokeWidth={3} />}
                        {someIn && <Minus size={12} className="text-white" strokeWidth={3} />}
                      </div>
                      {lastBookCover ? (
                        <img src={lastBookCover} alt="" className="w-7 h-10 rounded-sm object-cover flex-shrink-0 shadow-sm" />
                      ) : (
                        <div className="w-7 h-10 rounded-sm bg-slate-200/60 flex-shrink-0" />
                      )}
                      <span className="truncate font-medium">{listName}</span>
                      {isTop5 && (
                        <span className="ml-auto text-[10px] text-slate-400 flex-shrink-0">
                          {currentTop5InList}/5
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* New list section */}
              <div className="border-t border-white/20 dark:border-white/10">
                {showNewListInput ? (
                  <div className="px-4 py-3 flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newListName.trim()) {
                          const trimmed = newListName.trim();
                          Array.from(selectedBookIds).forEach(id => {
                            const book = books.find(b => b.id === id);
                            if (book && !book.lists?.includes(trimmed)) {
                              const newLists = [...(book.lists || []), trimmed];
                              onUpdateBookLists(id, newLists);
                            }
                          });
                          setNewListName('');
                          setShowNewListInput(false);
                        } else if (e.key === 'Escape') {
                          setNewListName('');
                          setShowNewListInput(false);
                        }
                      }}
                      placeholder="List name..."
                      className="flex-1 text-sm bg-white/30 dark:bg-white/12 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-400/50"
                    />
                    <button
                      onClick={() => {
                        if (newListName.trim()) {
                          const trimmed = newListName.trim();
                          Array.from(selectedBookIds).forEach(id => {
                            const book = books.find(b => b.id === id);
                            if (book && !book.lists?.includes(trimmed)) {
                              const newLists = [...(book.lists || []), trimmed];
                              onUpdateBookLists(id, newLists);
                            }
                          });
                          setNewListName('');
                          setShowNewListInput(false);
                        }
                      }}
                      className="text-blue-600 dark:text-blue-400 text-sm font-bold px-2"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewListInput(true)}
                    className="w-full px-5 py-3 flex items-center gap-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-white/20 dark:bg-white/8 active:bg-white/30 dark:bg-white/12 transition-colors"
                  >
                    <Plus size={14} />
                    <span>New list</span>
                  </button>
                )}
              </div>

              {/* Done button */}
              <div className="border-t border-white/20 dark:border-white/10 px-5 py-3">
                <button
                  onClick={() => {
                    setShowListSheet(false);
                    setShowNewListInput(false);
                    setNewListName('');
                    setIsSelectMode(false);
                    setSelectedBookIds(new Set());
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]"
                  style={{
                    background: 'rgba(59, 130, 246, 0.9)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  Done
                </button>
              </div>

              {/* Safe area padding */}
              <div className="h-8" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reading Book Picker Modal */}
      <AnimatePresence>
        {showReadingBookPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-end bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setShowReadingBookPicker(false)}
          >
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 300, duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white/80 dark:bg-white/15 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30 dark:border-white/10 flex flex-col"
              style={{ maxHeight: '70vh' }}
            >
              {/* Handle bar */}
              <div className="w-full flex justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-12 h-1 bg-slate-400 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-4 pb-3 flex-shrink-0">
                <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Start Reading</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">Pick from your &quot;Want to read&quot; list</p>
              </div>

              {/* Book List */}
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 ios-scroll">
                {(() => {
                  const wantToReadBooks = books.filter(b => b.reading_status === 'want_to_read');

                  if (wantToReadBooks.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <BookMarked size={32} className="mx-auto mb-3 text-slate-400" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">No books in your &quot;Want to read&quot; list</p>
                        <button
                          onClick={() => {
                            setShowReadingBookPicker(false);
                            openAddBookSheet();
                          }}
                          className="mt-4 px-4 py-2 rounded-lg font-bold text-sm text-white active:scale-95 transition-all"
                          style={{
                            background: 'rgba(59, 130, 246, 0.85)',
                            backdropFilter: 'blur(9.4px)',
                            WebkitBackdropFilter: 'blur(9.4px)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                          }}
                        >
                          Add a book
                        </button>
                      </div>
                    );
                  }

                  return wantToReadBooks.map((book, i) => (
                    <motion.button
                      key={book.id}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="w-full flex items-center gap-3 p-3 bg-blue-50/80 backdrop-blur-md hover:bg-blue-100/85 rounded-xl border border-blue-200/30 shadow-sm transition-all text-left"
                      onClick={async () => {
                        try {
                          const { error } = await supabase
                            .from('books')
                            .update({ reading_status: 'reading' })
                            .eq('id', book.id);

                          if (!error) {
                            setBooks(prev => prev.map(b =>
                              b.id === book.id ? { ...b, reading_status: 'reading' } : b
                            ));
                            triggerSuccessHaptic();
                          }
                        } catch (err) {
                          console.error('Error updating book status:', err);
                        }
                        setShowReadingBookPicker(false);
                      }}
                    >
                      {/* Book Cover */}
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className={`w-12 h-16 rounded flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                          <BookOpen size={20} className="text-white opacity-50" />
                        </div>
                      )}

                      {/* Book Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 dark:text-slate-50 truncate">{book.title}</h3>
                        <p className="text-xs text-slate-800 dark:text-slate-200 truncate">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {book.publish_year && (
                            <p className="text-[10px] text-slate-600 dark:text-slate-400">{book.publish_year}</p>
                          )}
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-blue-700 bg-blue-100">
                            Your Book
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ));
                })()}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
