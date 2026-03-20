'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { Share as CapacitorShare } from '@capacitor/share';
import {
  ChevronLeft,
  BookOpen,
  Trash2,
  CheckCircle2,
  ExternalLink,
  BookMarked,
  ChevronDown,
  MessagesSquare,
  Lightbulb,
  Share,
  MoreVertical,
  Heart,
  EyeOff,
  Play,
  Info,
  Bookmark,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import bookPageOnboardingAnimation from '@/public/onboarding_anim_book_page_new.json';
import nextReadsAnimation from '@/public/next_reads.json';
import { supabase } from '@/lib/supabase';
import { featureFlags } from '@/lib/feature-flags';
import { triggerHeavyHaptic } from '@/lib/capacitor';
import { getAssetPath, glassmorphicStyle } from './utils';
import InsightsCards from './InsightsCards';
import PodcastEpisodes from './PodcastEpisodes';
import YouTubeVideos from './YouTubeVideos';
import AnalysisArticles from './AnalysisArticles';
import RelatedBooks from './RelatedBooks';
import RelatedMovies from './RelatedMovies';
import RatingStars, { RATING_FEEDBACK } from './RatingStars';
import BookSummaryComponent from './BookSummary';
import { getCharacterContext } from '../services/character-avatars-service';
import { getOrCreateTelegramTopic, getTelegramTopic } from '../services/telegram-service';
import { getDiscussionQuestions } from '../services/discussion-service';
import { calculateAvg, getGradient } from '../services/book-utils';
import { analytics } from '../services/analytics-service';
import {
  RATING_DIMENSIONS,
  type PodcastEpisode as PodcastEpisodeType,
  type AnalysisArticle as AnalysisArticleType,
  type YouTubeVideo as YouTubeVideoType,
  type RelatedBook as RelatedBookType,
  type RelatedMovie as RelatedMovieType,
  type DidYouKnowItem,
  type BookWithRatings,
  type BookSummary,
  type CharacterAvatar,
  type ReadingStatus,
  type Book,
  type DiscussionQuestion,
} from '../types';

import type { CharacterChatContext } from '../services/chat-service';

// Lazy-loaded components
function lazyWithChunkRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  chunkKey: string,
) {
  return React.lazy(async () => {
    try {
      const mod = await importer();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`chunk-retry:${chunkKey}`);
      }
      return mod;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isChunkLoadError =
        /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message);
      if (isChunkLoadError && typeof window !== 'undefined') {
        const retryKey = `chunk-retry:${chunkKey}`;
        if (!sessionStorage.getItem(retryKey)) {
          sessionStorage.setItem(retryKey, '1');
          window.location.reload();
        }
      }
      throw error;
    }
  });
}

const NotesEditorOverlay = lazyWithChunkRetry(() => import('./NotesEditorOverlay'), 'NotesEditorOverlay');

// Re-export SpotlightSection type for the spotlight prop
interface SpotlightRecommendation {
  item: { type: string; icon: any; label: string; title: string; subtitle: string; url?: string; imageUrl?: string; itemIndex: number };
  next: { type: string; icon: any; label: string; title: string; subtitle: string; url?: string; imageUrl?: string; itemIndex: number } | null;
  total: number;
  bookId: string;
}

interface BookDetailInsightsState {
  hasEnabledInsights: boolean;
  shouldBlurInsights: boolean;
  categories: Array<{ id: string; label: string }>;
  currentCategory: { id: string; label: string } | undefined;
  currentInsights: Array<{ text: string; sourceUrl?: string; label: string }>;
  isLoading: boolean;
}

interface TelegramTopic {
  topicId: number;
  inviteLink: string;
}

interface BookReader {
  id: string;
  name: string;
  avatar: string | null;
  isFollowing: boolean;
}

// --- Props Interface ---

export interface BookDetailViewProps {
  // Core book data
  activeBook: BookWithRatings;
  books: BookWithRatings[];
  booksForBookshelf: BookWithRatings[];
  selectedIndex: number;
  user: { id: string; user_metadata?: any } | null;
  isReviewer: boolean;

  // Data from useBookDetailData hook
  bookDetailData: {
    bookInfluences: Map<string, string[]>;
    bookDomain: Map<string, any>;
    bookContext: Map<string, string[]>;
    didYouKnow: Map<string, DidYouKnowItem[]>;
    podcastEpisodes: Map<string, { curated: PodcastEpisodeType[]; apple: PodcastEpisodeType[] }>;
    analysisArticles: Map<string, AnalysisArticleType[]>;
    youtubeVideos: Map<string, YouTubeVideoType[]>;
    relatedBooks: Map<string, RelatedBookType[]>;
    relatedMovies: Map<string, RelatedMovieType[]>;
    bookSummaries: Map<string, BookSummary>;
    characterAvatars: Map<string, CharacterAvatar[]>;
    loadingFactsForBookId: string | null;
    loadingInfluencesForBookId: string | null;
    loadingDomainForBookId: string | null;
    loadingContextForBookId: string | null;
    loadingDidYouKnowForBookId: string | null;
    loadingPodcastsForBookId: string | null;
    loadingAnalysisForBookId: string | null;
    loadingVideosForBookId: string | null;
    loadingRelatedForBookId: string | null;
    loadingRelatedMoviesForBookId: string | null;
    loadingSummaryForBookId: string | null;
    loadingAvatarsForBookId: string | null;
    selectedInsightCategory: string;
    setSelectedInsightCategory: (cat: string) => void;
    isInsightCategoryDropdownOpen: boolean;
    setIsInsightCategoryDropdownOpen: (open: boolean) => void;
    spotlightIndex: number;
    setSpotlightIndex: (idx: number | ((prev: number) => number)) => void;
    spoilerRevealed: Map<string, Set<string>>;
    setSpoilerRevealed: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>;
    combinedPodcastEpisodes: PodcastEpisodeType[];
    bookDetailInsightsState: BookDetailInsightsState;
    activeVideos: YouTubeVideoType[];
    activeArticles: AnalysisArticleType[];
    activeRelatedMovies: RelatedMovieType[];
    activeRelatedBooks: RelatedBookType[];
    spotlightRecommendation: SpotlightRecommendation | null;
    retryCharacterAvatars: () => void;
  };

  // Card callbacks from useBookDetailCardCallbacks
  cardCallbacks: {
    renderInsightsHeartAction: (index: number) => React.ReactNode;
    pinInsightItem: (index: number) => void;
    isInsightItemPinned: (index: number) => boolean;
    renderPodcastHeartAction: (index: number) => React.ReactNode;
    pinPodcastItem: (index: number) => void;
    isPodcastItemPinned: (index: number) => boolean;
    renderYouTubeHeartAction: (index: number) => React.ReactNode;
    pinYouTubeItem: (index: number) => void;
    isYouTubeItemPinned: (index: number) => boolean;
    renderArticleHeartAction: (index: number) => React.ReactNode;
    pinArticleItem: (index: number) => void;
    isArticleItemPinned: (index: number) => boolean;
    renderRelatedMovieHeartAction: (index: number) => React.ReactNode;
    pinRelatedMovieItem: (index: number) => void;
    isRelatedMovieItemPinned: (index: number) => boolean;
    renderRelatedBookHeartAction: (index: number) => React.ReactNode;
    pinRelatedBookItem: (index: number) => void;
    isRelatedBookItemPinned: (index: number) => boolean;
  };

  // Heart system (for spotlight)
  heartCounts: Map<string, number>;
  userHearted: Set<string>;
  handleToggleHeart: (contentHash: string) => void;
  isContentPinned: (content: string) => boolean;
  handlePinForLater: (content: string, type?: string, url?: string, imageUrl?: string) => void;

  // Scroll system
  scrollContainerRef: React.MutableRefObject<HTMLElement | null>;
  updateScrollY: (value: number) => void;
  attachBookDetailHeaderRef: (el: HTMLDivElement | null) => void;

  // Navigation callbacks
  onNavigateToBookshelf: () => void;
  openAddBookSheet: () => void;
  capturePreviousView: () => void;

  // App-level page state setters needed by book detail
  setShowAccountPage: (val: boolean | ((prev: boolean) => boolean)) => void;
  showAccountPage: boolean;
  setShowBookshelfCovers: (val: boolean) => void;
  setShowNotesView: (val: boolean) => void;
  setShowSortingResults: (val: boolean) => void;

  // Rating
  handleRate: (id: string, dimension: string, value: number | null) => Promise<void>;
  handleUpdateReadingStatus: (id: string, status: ReadingStatus) => Promise<void>;

  // Reading status for existing books (stays in page.tsx)
  selectingReadingStatusForExisting: boolean;
  setSelectingReadingStatusForExisting: (val: boolean) => void;

  // Shared UI state (stays in page.tsx because back button, add-book flow, and handleRate need them)
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  showShareDialog: boolean;
  setShowShareDialog: (val: boolean) => void;
  showBookMenu: boolean;
  setShowBookMenu: (val: boolean) => void;
  selectingReadingStatusInRating: boolean;
  setSelectingReadingStatusInRating: (val: boolean) => void;
  isConfirmingDelete: boolean;
  setIsConfirmingDelete: (val: boolean) => void;
  isShowingNotes: boolean;
  setIsShowingNotes: (val: boolean) => void;
  editingDimension: typeof RATING_DIMENSIONS[number] | null;
  setEditingDimension: (val: typeof RATING_DIMENSIONS[number] | null) => void;

  // Book onboarding
  showBookPageOnboarding: boolean;
  setShowBookPageOnboarding: (val: boolean) => void;

  // Pending book meta (for reading status during add flow)
  setPendingBookMeta: (val: any) => void;

  // Book mutations
  setBooks: React.Dispatch<React.SetStateAction<BookWithRatings[]>>;
  setSelectedIndex: (idx: number) => void;

  // Chat system
  chatSystem: {
    chatOpenedFromBookPage: React.MutableRefObject<boolean>;
    setChatBookSelected: (val: boolean) => void;
    setShowChatPage: (val: boolean) => void;
    setCharacterChatContext: (ctx: CharacterChatContext | null) => void;
    loadingCharacterChat: string | false;
    setLoadingCharacterChat: (val: string | false) => void;
    avatarButtonRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
    setAvatarExpandTransition: (val: { imageUrl: string; rect: DOMRect; characterName: string } | null) => void;
  };

  // Telegram system
  telegramSystem: {
    telegramTopics: Map<string, TelegramTopic>;
    setTelegramTopics: React.Dispatch<React.SetStateAction<Map<string, TelegramTopic>>>;
    isLoadingTelegramTopic: boolean;
    setIsLoadingTelegramTopic: (val: boolean) => void;
    showTelegramJoinModal: boolean;
    setShowTelegramJoinModal: (val: boolean) => void;
  };

  // Discussion
  discussionSystem: {
    showBookDiscussion: boolean;
    setShowBookDiscussion: (val: boolean) => void;
    discussionQuestions: DiscussionQuestion[];
    setDiscussionQuestions: (val: DiscussionQuestion[]) => void;
    isLoadingDiscussionQuestions: boolean;
    setIsLoadingDiscussionQuestions: (val: boolean) => void;
  };

  // Book readers
  bookReadersSystem: {
    bookReaders: BookReader[];
    setBookReaders: (val: BookReader[]) => void;
    isLoadingBookReaders: boolean;
    setIsLoadingBookReaders: (val: boolean) => void;
  };

  // User info
  userAvatar: string | null;
  userName: string;

  // Viewing another user's profile
  viewingUserId: string | null;
  viewingUserIsPrivate: boolean;

  // Remote flags
  remoteFlags: { related_work_play_buttons: boolean; send_enabled: boolean };

  // Content preferences
  contentPreferences: Record<string, any>;

  // SpotlightSection component
  SpotlightSection: React.ComponentType<any>;

  // Add book handler
  handleAddBook: (meta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) => Promise<void>;

  // More below animation ref
  moreBelowAnimRef: React.RefObject<HTMLDivElement | null>;
}

// Helper: avatar gradient
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

// Glassmorphic styles
const coverButtonGlassmorphicStyle: React.CSSProperties = {
  background: 'var(--glass-bg-cover-btn)',
  borderRadius: '16px',
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: 'var(--glass-border)',
};

const standardGlassmorphicStyle: React.CSSProperties = {
  background: 'var(--glass-bg-subtle)',
  borderRadius: '16px',
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: 'var(--glass-border)',
};

const bookPageGlassmorphicStyle: React.CSSProperties = {
  background: 'var(--glass-bg)',
  borderRadius: '16px',
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: 'var(--glass-border)',
};

// Helper function to parse notes into sections with timestamps
const parseNotes = (notes: string | null): Array<{ timestamp: string; content: string }> => {
  if (!notes || notes.trim() === '') return [];
  const sections: Array<{ timestamp: string; content: string }> = [];
  const timestampRegex = /\{(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\}\n?/g;
  let match;
  const matches: Array<{ timestamp: string; index: number; fullMatch: string }> = [];
  while ((match = timestampRegex.exec(notes)) !== null) {
    matches.push({ timestamp: match[1], index: match.index, fullMatch: match[0] });
  }
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const contentStart = current.index + current.fullMatch.length;
    const contentEnd = next ? next.index : notes.length;
    const content = notes.substring(contentStart, contentEnd).trim();
    sections.push({ timestamp: current.timestamp, content });
  }
  return sections;
};

// Helper function to format notes for display
const formatNotesForDisplay = (notes: string | null): string => {
  if (!notes || notes.trim() === '') return '';
  const sections = parseNotes(notes);
  if (sections.length === 0) return notes;
  return sections.map(section => `{${section.timestamp}}\n${section.content}`).join('\n\n');
};


export default function BookDetailView({
  activeBook,
  books,
  booksForBookshelf,
  selectedIndex,
  user,
  isReviewer,
  bookDetailData,
  cardCallbacks,
  heartCounts,
  userHearted,
  handleToggleHeart,
  isContentPinned,
  handlePinForLater,
  scrollContainerRef,
  updateScrollY,
  attachBookDetailHeaderRef,
  onNavigateToBookshelf,
  openAddBookSheet,
  capturePreviousView,
  setShowAccountPage,
  showAccountPage,
  setShowBookshelfCovers,
  setShowNotesView,
  setShowSortingResults,
  handleRate,
  handleUpdateReadingStatus,
  selectingReadingStatusForExisting,
  setSelectingReadingStatusForExisting,
  showBookPageOnboarding,
  setShowBookPageOnboarding,
  setPendingBookMeta,
  setBooks,
  setSelectedIndex,
  chatSystem,
  telegramSystem,
  discussionSystem,
  bookReadersSystem,
  userAvatar,
  userName,
  viewingUserId,
  viewingUserIsPrivate,
  remoteFlags,
  contentPreferences,
  SpotlightSection,
  handleAddBook,
  moreBelowAnimRef,
  isEditing,
  setIsEditing,
  showShareDialog,
  setShowShareDialog,
  showBookMenu,
  setShowBookMenu,
  selectingReadingStatusInRating,
  setSelectingReadingStatusInRating,
  isConfirmingDelete,
  setIsConfirmingDelete,
  isShowingNotes,
  setIsShowingNotes,
  editingDimension,
  setEditingDimension,
}: BookDetailViewProps) {
  // --- Destructure bookDetailData ---
  const {
    didYouKnow,
    podcastEpisodes,
    analysisArticles,
    youtubeVideos,
    relatedBooks,
    relatedMovies,
    bookSummaries,
    characterAvatars,
    loadingPodcastsForBookId,
    loadingAnalysisForBookId,
    loadingVideosForBookId,
    loadingRelatedForBookId,
    loadingRelatedMoviesForBookId,
    loadingSummaryForBookId,
    loadingAvatarsForBookId,
    selectedInsightCategory,
    setSelectedInsightCategory,
    isInsightCategoryDropdownOpen,
    setIsInsightCategoryDropdownOpen,
    spotlightIndex,
    setSpotlightIndex,
    spoilerRevealed,
    setSpoilerRevealed,
    combinedPodcastEpisodes,
    bookDetailInsightsState,
    activeVideos,
    activeArticles,
    activeRelatedMovies,
    activeRelatedBooks,
    spotlightRecommendation,
    retryCharacterAvatars,
  } = bookDetailData;

  const {
    renderInsightsHeartAction,
    pinInsightItem,
    isInsightItemPinned,
    renderPodcastHeartAction,
    pinPodcastItem,
    isPodcastItemPinned,
    renderYouTubeHeartAction,
    pinYouTubeItem,
    isYouTubeItemPinned,
    renderArticleHeartAction,
    pinArticleItem,
    isArticleItemPinned,
    renderRelatedMovieHeartAction,
    pinRelatedMovieItem,
    isRelatedMovieItemPinned,
    renderRelatedBookHeartAction,
    pinRelatedBookItem,
    isRelatedBookItemPinned,
  } = cardCallbacks;

  const {
    bookReaders,
    setBookReaders,
    isLoadingBookReaders,
    setIsLoadingBookReaders,
  } = bookReadersSystem;

  const {
    telegramTopics,
    setTelegramTopics,
    isLoadingTelegramTopic,
    setIsLoadingTelegramTopic,
    setShowTelegramJoinModal,
  } = telegramSystem;

  const {
    showBookDiscussion,
    discussionQuestions,
    setDiscussionQuestions,
    setIsLoadingDiscussionQuestions,
  } = discussionSystem;

  const {
    chatOpenedFromBookPage,
    setChatBookSelected,
    setShowChatPage,
    setCharacterChatContext,
    loadingCharacterChat,
    setLoadingCharacterChat,
    avatarButtonRefs,
    setAvatarExpandTransition,
  } = chatSystem;

  // Note: isEditing, setIsEditing, showShareDialog, setShowShareDialog, showBookMenu, setShowBookMenu,
  // selectingReadingStatusInRating, setSelectingReadingStatusInRating, isConfirmingDelete, setIsConfirmingDelete,
  // isShowingNotes, setIsShowingNotes, editingDimension, setEditingDimension
  // are all destructured from props in the function signature above.

  // --- Local UI State (only used inside BookDetailView) ---
  const [newlyAddedNoteTimestamp, setNewlyAddedNoteTimestamp] = useState<string | null>(null);
  const [noteSavedToast, setNoteSavedToast] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isMetaExpanded, setIsMetaExpanded] = useState(true);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [showInfographicModal, setShowInfographicModal] = useState(false);
  const [infographicSection, setInfographicSection] = useState<'characters' | 'timeline'>('characters');
  const [isInfographicDropdownOpen, setIsInfographicDropdownOpen] = useState(false);

  // --- Refs (moved from page.tsx) ---
  const openNotesAfterNavRef = useRef(false);
  const lastSavedNoteTextRef = useRef<string>('');
  const noteTextOnFocusRef = useRef<string>('');
  const noteSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prevIsShowingNotesRef = useRef(false);

  // --- Computed values ---
  const currentEditingDimension = useMemo((): typeof RATING_DIMENSIONS[number] | null => {
    if (!activeBook || !isEditing || selectingReadingStatusInRating) return null;
    if (editingDimension) return editingDimension;
    return RATING_DIMENSIONS.find(d => activeBook.ratings[d] === null) || RATING_DIMENSIONS[0];
  }, [activeBook, isEditing, editingDimension, selectingReadingStatusInRating]);

  const showRatingOverlay = activeBook && isEditing;
  const showReadingStatusSelection = selectingReadingStatusInRating || selectingReadingStatusForExisting;

  // --- useEffects ---

  // Reset states on selectedIndex change
  useEffect(() => {
    setIsEditing(false);
    setIsConfirmingDelete(false);
    if (openNotesAfterNavRef.current) {
      openNotesAfterNavRef.current = false;
      setIsShowingNotes(true);
    } else {
      setIsShowingNotes(false);
    }
    setNewlyAddedNoteTimestamp(null);
    setEditingDimension(null);
    setSelectedInsightCategory('trivia');
    setIsInsightCategoryDropdownOpen(false);
    setIsMetaExpanded(true);
    setIsSummaryExpanded(false);
    const timer = setTimeout(() => {
      setIsMetaExpanded(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  // Close insight category dropdown on outside click
  useEffect(() => {
    if (!isInsightCategoryDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.insight-category-dropdown')) {
        setIsInsightCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isInsightCategoryDropdownOpen]);

  // Load note text when book changes
  useEffect(() => {
    if (activeBook) {
      const formattedNotes = formatNotesForDisplay(activeBook.notes ?? null);
      setNoteText(formattedNotes);
      lastSavedNoteTextRef.current = formattedNotes;
      noteTextOnFocusRef.current = formattedNotes;
    }
    return () => {
      if (noteSaveTimeoutRef.current) {
        clearTimeout(noteSaveTimeoutRef.current);
        noteSaveTimeoutRef.current = null;
      }
    };
  }, [activeBook?.id, activeBook?.notes]);

  // Fetch book readers
  useEffect(() => {
    if (!user) return;
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.canonical_book_id) {
      setBookReaders([]);
      return;
    }
    let cancelled = false;
    setIsLoadingBookReaders(true);
    const fetchBookReaders = async () => {
      try {
        const { data: otherUsersBooks, error: booksError } = await supabase
          .from('books')
          .select('user_id')
          .eq('canonical_book_id', currentBook.canonical_book_id)
          .neq('user_id', user.id)
          .limit(20);
        if (booksError || !otherUsersBooks || otherUsersBooks.length === 0) {
          if (!cancelled) { setBookReaders([]); setIsLoadingBookReaders(false); }
          return;
        }
        const userIds = [...new Set(otherUsersBooks.map(b => b.user_id))];
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, is_public')
          .in('id', userIds)
          .eq('is_public', true);
        if (usersError || !usersData || usersData.length === 0) {
          if (!cancelled) { setBookReaders([]); setIsLoadingBookReaders(false); }
          return;
        }
        const { data: followsData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        const followingIds = new Set(followsData?.map(f => f.following_id) || []);
        const readers: BookReader[] = (usersData || []).map(u => ({
          id: u.id,
          name: u.full_name || 'User',
          avatar: u.avatar_url,
          isFollowing: followingIds.has(u.id),
        })).sort((a, b) => (b.isFollowing ? 1 : 0) - (a.isFollowing ? 1 : 0));
        if (!cancelled) { setBookReaders(readers); setIsLoadingBookReaders(false); }
      } catch (err) {
        console.error('[BookReaders] Error fetching:', err);
        if (!cancelled) { setBookReaders([]); setIsLoadingBookReaders(false); }
      }
    };
    const timer = setTimeout(fetchBookReaders, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeBook?.canonical_book_id, user]);

  // Pre-fetch Telegram topic
  useEffect(() => {
    if (!user || !activeBook?.canonical_book_id) return;
    if (telegramTopics.has(activeBook.canonical_book_id)) return;
    let cancelled = false;
    const prefetchTelegramTopic = async () => {
      try {
        const existing = await getTelegramTopic(activeBook.canonical_book_id!);
        if (existing) {
          if (!cancelled) setTelegramTopics(prev => new Map(prev).set(activeBook.canonical_book_id!, existing));
          return;
        }
        const topic = await getOrCreateTelegramTopic(
          activeBook.title, activeBook.author, activeBook.canonical_book_id!,
          activeBook.cover_url || undefined, activeBook.genre || undefined
        );
        if (topic && !cancelled) setTelegramTopics(prev => new Map(prev).set(activeBook.canonical_book_id!, topic));
      } catch (err) { console.error('[TelegramTopic] Error prefetching:', err); }
    };
    const timer = setTimeout(prefetchTelegramTopic, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeBook?.canonical_book_id, user]);

  // Fetch discussion questions
  useEffect(() => {
    if (!showBookDiscussion || !activeBook || !featureFlags.insights.discussion_questions) return;
    analytics.trackEvent('discussion', 'view', { book_title: activeBook.title });
    if (discussionQuestions.length > 0) return;
    let cancelled = false;
    setIsLoadingDiscussionQuestions(true);
    const fetchQuestions = async () => {
      try {
        const questions = await getDiscussionQuestions(activeBook.title, activeBook.author);
        if (!cancelled) { setDiscussionQuestions(questions); setIsLoadingDiscussionQuestions(false); }
      } catch (err) {
        console.error('[DiscussionQuestions] Error fetching:', err);
        if (!cancelled) setIsLoadingDiscussionQuestions(false);
      }
    };
    fetchQuestions();
    return () => { cancelled = true; };
  }, [showBookDiscussion, activeBook?.id]);

  // Reset discussion questions when book changes
  useEffect(() => { setDiscussionQuestions([]); }, [activeBook?.id]);

  // --- Handlers ---

  async function handleDelete() {
    if (!activeBook || !user) return;
    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', activeBook.id)
        .eq('user_id', user.id);
      if (error) throw error;
      triggerHeavyHaptic();
      const newBooks = books.filter(b => b.id !== activeBook.id);
      const nextIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
      setIsConfirmingDelete(false);
      setSelectedIndex(newBooks.length > 0 ? nextIndex : 0);
      setBooks(newBooks);
    } catch (err) {
      console.error('Error deleting book:', err);
    }
  }

  // Wrap handleRate to manage dimension advancement locally
  const onRate = useCallback(async (id: string, dimension: string, value: number | null) => {
    await handleRate(id, dimension, value);
    // Dimension advancement is already handled in page.tsx's handleRate
    // The state updates (setEditingDimension, setIsEditing, setShowShareDialog) are now local
  }, [handleRate]);

  // --- Render ---
  return (
    <>
      <motion.main
        key="main"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        ref={(el) => {
          scrollContainerRef.current = el;
          if (el) {
            el.style.overscrollBehaviorY = 'auto';
            (el.style as any).webkitOverflowScrolling = 'touch';
            el.scrollTop = 0;
            updateScrollY(0);
          }
        }}
        className={`flex-1 flex flex-col items-center justify-start p-4 relative pt-28 pb-20 ios-scroll min-h-0 ${showBookPageOnboarding ? 'overflow-hidden' : 'overflow-y-auto'}`}
        onScroll={(e) => {
          const target = e.currentTarget;
          updateScrollY(target.scrollTop);
        }}
      >
        {/* Back button and book info header */}
        <motion.div
          ref={attachBookDetailHeaderRef}
          className="fixed top-[62px] left-4 right-4 z-50 flex items-center gap-3"
        >
          <button
            onClick={() => {
              updateScrollY(0);
              setShowBookshelfCovers(true);
              setShowNotesView(false);
              setShowSortingResults(false);
            }}
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center hover:opacity-80 active:scale-95 transition-all"
            style={{ ...glassmorphicStyle, borderRadius: '50%' }}
          >
            <ChevronLeft size={18} className="text-slate-950 dark:text-slate-50" />
          </button>
          {activeBook && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate uppercase">{activeBook.title}</p>
              <p className="text-xs text-slate-900 dark:text-slate-100 truncate">{activeBook.author}</p>
            </div>
          )}
        </motion.div>

        {booksForBookshelf.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <img src={getAssetPath("/logo.png")} alt="Book.luv" className="object-contain mx-auto mb-4" />
            {viewingUserId ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {viewingUserIsPrivate ? "This user's bookshelf is private." : "This user hasn't added any books yet."}
              </p>
            ) : (
              <button
                onClick={() => openAddBookSheet()}
                className="px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-xl shadow-lg font-bold hover:bg-blue-700 active:scale-95 transition-all"
              >
                Add first book
              </button>
            )}
          </div>
        ) : (
          <div className="w-full max-w-[340px] md:max-w-[420px] flex flex-col items-center gap-6 pb-8">
            <div
              className="relative w-[340px] md:w-[420px] aspect-[2/3] overflow-hidden group rounded-lg"
              style={{
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), 0 0 30px 5px rgba(255, 255, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              {/* Front side - Book cover */}
              <div className="absolute inset-0 w-full h-full">
                <AnimatePresence mode='wait'>
                  <motion.div key={activeBook.id || 'active-book'} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="relative w-full h-full rounded-lg overflow-hidden border-2 border-white/50 shadow-lg">
                    {activeBook.cover_url ? (
                      <>
                        <img src={activeBook.cover_url} alt={activeBook.title} className="w-full h-full object-cover" style={{ filter: 'contrast(1.15) saturate(1.25)' }} />
                        {/* Skeuomorphic book effect overlay */}
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
                      <div className={`w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br ${getGradient(activeBook.id)} text-white rounded-lg`}>
                        <BookOpen size={48} className="mb-4 opacity-30" />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Delete confirmation */}
              <AnimatePresence>
                {isConfirmingDelete && !isShowingNotes && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-[59]"
                      onClick={() => setIsConfirmingDelete(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-4 z-[60] rounded-xl overflow-hidden"
                      style={{ ...standardGlassmorphicStyle, bottom: 'calc(64px + var(--safe-area-bottom, 0px))' }}
                    >
                      <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-3 w-full text-left text-red-600 font-semibold text-sm hover:bg-white/30 dark:bg-white/12 active:scale-95 transition-all"
                      >
                        <Trash2 size={16} />
                        Delete Book
                      </button>
                      <div className="h-px bg-slate-200/50" />
                      <button
                        onClick={() => setIsConfirmingDelete(false)}
                        className="flex items-center gap-2 px-4 py-3 w-full text-left text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-white/30 dark:bg-white/12 active:scale-95 transition-all"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Rating overlay / Reading status selection */}
              <AnimatePresence>
                {(showRatingOverlay || showReadingStatusSelection) && !isConfirmingDelete && !isShowingNotes && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute left-4 right-4 flex flex-col items-center justify-center p-4 rounded-2xl overflow-hidden z-40"
                    style={{ ...standardGlassmorphicStyle, bottom: 'calc(64px + var(--safe-area-bottom, 0px))' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {showReadingStatusSelection ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="w-full flex flex-col items-center justify-center"
                        style={{ minHeight: '120px' }}
                      >
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-950 dark:text-slate-50 mb-4">Reading Status</h3>
                        <div className="flex flex-row gap-3 w-full justify-center">
                          <button
                            onClick={async () => {
                              if (activeBook) {
                                await handleUpdateReadingStatus(activeBook.id, 'read_it');
                                setSelectingReadingStatusInRating(false);
                                setSelectingReadingStatusForExisting(false);
                                setPendingBookMeta(null);
                                setEditingDimension(null);
                              }
                            }}
                            className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl active:scale-95 transition-all flex-1 max-w-[100px] ${activeBook?.reading_status === 'read_it' ? 'bg-white/50 dark:bg-white/20 ring-2 ring-white/60' : 'bg-white/20 dark:bg-white/8 hover:bg-white/30 dark:bg-white/12'}`}
                          >
                            <CheckCircle2 size={28} className="text-slate-950 dark:text-slate-50" />
                            <span className="text-xs font-bold text-slate-950 dark:text-slate-50">Read it</span>
                          </button>
                          <button
                            onClick={async () => {
                              if (activeBook) {
                                await handleUpdateReadingStatus(activeBook.id, 'reading');
                                setSelectingReadingStatusInRating(false);
                                setSelectingReadingStatusForExisting(false);
                                setPendingBookMeta(null);
                                setIsEditing(false);
                              }
                            }}
                            className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl active:scale-95 transition-all flex-1 max-w-[100px] ${activeBook?.reading_status === 'reading' ? 'bg-white/50 dark:bg-white/20 ring-2 ring-white/60' : 'bg-white/20 dark:bg-white/8 hover:bg-white/30 dark:bg-white/12'}`}
                          >
                            <BookOpen size={28} className="text-slate-950 dark:text-slate-50" />
                            <span className="text-xs font-bold text-slate-950 dark:text-slate-50">Reading</span>
                          </button>
                          <button
                            onClick={async () => {
                              if (activeBook) {
                                await handleUpdateReadingStatus(activeBook.id, 'want_to_read');
                                setSelectingReadingStatusInRating(false);
                                setSelectingReadingStatusForExisting(false);
                                setPendingBookMeta(null);
                                setIsEditing(false);
                              }
                            }}
                            className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl active:scale-95 transition-all flex-1 max-w-[100px] ${activeBook?.reading_status === 'want_to_read' ? 'bg-white/50 dark:bg-white/20 ring-2 ring-white/60' : 'bg-white/20 dark:bg-white/8 hover:bg-white/30 dark:bg-white/12'}`}
                          >
                            <BookMarked size={28} className="text-slate-950 dark:text-slate-50" />
                            <span className="text-xs font-bold text-slate-950 dark:text-slate-50">Want to</span>
                          </button>
                        </div>
                      </motion.div>
                    ) : currentEditingDimension ? (
                      <motion.div
                        key={currentEditingDimension}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="w-full"
                      >
                        <RatingStars
                          dimension={currentEditingDimension}
                          value={activeBook.ratings[currentEditingDimension]}
                          onRate={(dim, val) => handleRate(activeBook.id, dim, val)}
                        />
                      </motion.div>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Click outside to close rating overlay or reading status selection */}
              {(showRatingOverlay || showReadingStatusSelection) && (
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingDimension(null);
                    setSelectingReadingStatusForExisting(false);
                    setSelectingReadingStatusInRating(false);
                  }}
                />
              )}

              {/* Share Dialog */}
              <AnimatePresence>
                {showShareDialog && activeBook && (
                  <>
                    <div
                      className="fixed inset-0 z-[100]"
                      onClick={() => setShowShareDialog(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="absolute left-4 right-4 z-[101] flex flex-col items-center justify-center p-4 rounded-2xl overflow-hidden backdrop-blur-xl"
                      style={{ background: 'rgba(255, 0, 123, 0.45)', border: '1px solid rgba(255, 255, 255, 0.25)', boxShadow: '0 4px 30px rgba(255, 0, 123, 0.2)', bottom: 'calc(64px + var(--safe-area-bottom, 0px))' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                          A {activeBook.ratings.writing === 5 ? 'GREAAAAAT' : activeBook.ratings.writing === 4.5 ? 'GREAT' : 'GOOD'} BOOK LIKE THIS...
                        </h3>
                        <p className="text-xs text-white/80">someone you know needs to read it</p>
                        <div className="flex gap-3 mt-2">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const bookUrl = activeBook.google_books_url || '';
                              const shareText = `I just rated "${activeBook.title}" by ${activeBook.author} - ${RATING_FEEDBACK[activeBook.ratings.writing || 4]}${bookUrl ? `\n${bookUrl}` : ''}\n\nDownload Book.luv: https://yossisadoun.github.io/book_review/`;
                              try {
                                await CapacitorShare.share({
                                  title: activeBook.title,
                                  text: shareText,
                                  dialogTitle: 'Share this book',
                                });
                              } catch (err: any) {
                                if (err?.message?.includes('cancel') || err?.message?.includes('dismiss')) {
                                  console.log('Share cancelled by user');
                                } else {
                                  try {
                                    await navigator.clipboard.writeText(shareText);
                                    alert('Copied to clipboard!');
                                  } catch {
                                    console.log('Share failed');
                                  }
                                }
                              }
                              setShowShareDialog(false);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/25 text-white text-sm font-medium active:scale-95 transition-all border border-white/30"
                          >
                            <Share size={16} />
                            Share
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowShareDialog(false);
                            }}
                            className="px-4 py-2 rounded-xl text-white/80 text-sm font-medium hover:bg-white/20 active:scale-95 transition-all"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Menu button - bottom right */}
              <AnimatePresence>
                {!isShowingNotes && activeBook && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="absolute right-4 bottom-3 z-30"
                  >
                    <button
                      onClick={() => {
                        if (!showBookMenu) {
                          setSelectingReadingStatusForExisting(false);
                          setIsEditing(false);
                          setEditingDimension(null);
                        }
                        setShowBookMenu(!showBookMenu);
                      }}
                      className="p-2.5 rounded-full shadow-lg text-black active:scale-90 transition-all"
                      style={{ ...coverButtonGlassmorphicStyle, borderRadius: '50%' }}
                    >
                      <MoreVertical size={20} />
                    </button>

                    {/* Drop-up menu */}
                    <AnimatePresence>
                      {showBookMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowBookMenu(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-12 right-0 z-50 min-w-[140px] rounded-xl overflow-hidden shadow-lg"
                            style={{ ...standardGlassmorphicStyle, background: 'rgba(255, 255, 255, 0.55)' }}
                          >
                            <button
                              onClick={() => {
                                setShowBookMenu(false);
                                const bookUrl = activeBook.google_books_url || '';
                                const shareText = `Check out "${activeBook.title}" by ${activeBook.author}${bookUrl ? `\n${bookUrl}` : ''}\n\nDownload Book.luv: https://yossisadoun.github.io/book_review/`;
                                CapacitorShare.share({
                                  title: activeBook.title,
                                  text: shareText,
                                  dialogTitle: 'Share this book',
                                }).catch(() => {
                                  if (navigator.share) {
                                    navigator.share({ title: activeBook.title, text: shareText });
                                  }
                                });
                              }}
                              className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-900 dark:text-slate-100 font-medium text-sm hover:bg-white/30 dark:bg-white/12 active:scale-95 transition-all"
                            >
                              <Share size={18} />
                              Share
                            </button>
                            <div className="h-px bg-slate-200/50" />
                            <button
                              onClick={() => {
                                setShowBookMenu(false);
                                setIsShowingNotes(true);
                              }}
                              className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-900 dark:text-slate-100 font-medium text-sm hover:bg-white/30 dark:bg-white/12 active:scale-95 transition-all"
                            >
                              <Bookmark size={18} />
                              Notes
                            </button>
                            <div className="h-px bg-slate-200/50" />
                            <button
                              onClick={() => {
                                setShowBookMenu(false);
                                setShowBookPageOnboarding(true);
                              }}
                              className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-900 dark:text-slate-100 font-medium text-sm hover:bg-white/30 dark:bg-white/12 active:scale-95 transition-all"
                            >
                              <Info size={18} />
                              Page tour
                            </button>
                            <div className="h-px bg-slate-200/50" />
                            <button
                              onClick={() => {
                                setShowBookMenu(false);
                                setIsConfirmingDelete(true);
                              }}
                              className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 font-medium text-sm hover:bg-white/30 dark:bg-white/12 active:scale-95 transition-all"
                            >
                              <Trash2 size={18} />
                              Delete
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom left button row: Rate | Read Status */}
              <AnimatePresence>
                {!isShowingNotes && activeBook && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="absolute left-4 bottom-3 z-30 flex items-center gap-2"
                  >
                    {/* Rating button */}
                    <button
                      onClick={() => {
                        setShowBookMenu(false);
                        setSelectingReadingStatusForExisting(false);
                        if (isEditing && !selectingReadingStatusForExisting) {
                          // Toggle off if rating is already open
                          setIsEditing(false);
                          setEditingDimension(null);
                        } else {
                          setIsEditing(true);
                          setEditingDimension(null);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1 active:scale-90 transition-transform"
                      style={coverButtonGlassmorphicStyle}
                    >
                      <Heart size={14} className="fill-pink-500 text-pink-500" />
                      <span className="font-black text-sm text-slate-950 dark:text-slate-50">
                        {calculateAvg(activeBook.ratings) || 'Rate'}
                      </span>
                    </button>

                    {/* Reading Status button */}
                    <button
                      onClick={() => {
                        setShowBookMenu(false);
                        if (selectingReadingStatusForExisting) {
                          // Toggle off if already open
                          setSelectingReadingStatusForExisting(false);
                          setIsEditing(false);
                        } else {
                          // Close rating if open
                          setEditingDimension(null);
                          setSelectingReadingStatusForExisting(true);
                          setIsEditing(true);
                        }
                      }}
                      className="w-10 h-10 rounded-full shadow-lg text-black hover:text-blue-600 dark:text-blue-400 active:scale-95 transition-all flex items-center justify-center"
                      style={{ ...coverButtonGlassmorphicStyle, borderRadius: '50%' }}
                    >
                      {activeBook.reading_status === 'read_it' ? (
                        <CheckCircle2 size={18} className="text-slate-950 dark:text-slate-50" />
                      ) : activeBook.reading_status === 'reading' ? (
                        <BookOpen size={18} className="text-slate-950 dark:text-slate-50" />
                      ) : activeBook.reading_status === 'want_to_read' ? (
                        <BookMarked size={18} className="text-slate-950 dark:text-slate-50" />
                      ) : (
                        <BookOpen size={18} className="text-slate-950 dark:text-slate-50 opacity-50" />
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* Chat Panel -- row of 5 avatars below cover */}
            {!showRatingOverlay && activeBook && (() => {
              const avatars = characterAvatars.get(activeBook.id) || [];
              const isLoadingAvatars = loadingAvatarsForBookId === activeBook.id;
              const hasTelegramTopic = !!(activeBook.canonical_book_id && telegramTopics.has(activeBook.canonical_book_id));
              // Layout: ≤3 chars → single row. 4+ chars → two rows, balanced.
              // Row 1 = bookluver + row1Chars. Row 2 = row2Chars + readers (when 2 rows).
              // row1 count = ceil(total/2) where total = 1(bookluver) + chars + 1(readers)
              const needsTwoRows = avatars.length > 3;
              const total = 1 + Math.min(avatars.length, 8) + 1; // bookluver + chars + readers
              const row1Count = needsTwoRows ? Math.ceil(total / 2) - 1 : avatars.length; // -1 for bookluver
              const row1Avatars = avatars.slice(0, row1Count);
              const row2Avatars = avatars.slice(row1Count, 8);

              const renderCharacterAvatar = (avatar: typeof avatars[0], i: number) => {
                const isThisLoading = loadingCharacterChat === avatar.character;
                return (
                  <motion.button
                    key={avatar.character}
                    ref={(el) => { if (el) avatarButtonRefs.current.set(avatar.character, el); }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                    onClick={async () => {
                      if (loadingCharacterChat || !activeBook) return;
                      setLoadingCharacterChat(avatar.character);
                      try {
                        const context = await getCharacterContext(avatar.character, activeBook.title, activeBook.author);
                        if (context) {
                          setCharacterChatContext({
                            characterName: avatar.character,
                            bookTitle: activeBook.title,
                            bookAuthor: activeBook.author,
                            context,
                            avatarUrl: avatar.image_url,
                          });
                          chatOpenedFromBookPage.current = true;
                          const btn = avatarButtonRefs.current.get(avatar.character);
                          const imgEl = btn?.querySelector('img');
                          if (imgEl) {
                            const rect = imgEl.getBoundingClientRect();
                            setAvatarExpandTransition({ imageUrl: avatar.image_url, rect, characterName: avatar.character });
                          } else {
                            setChatBookSelected(true);
                            setShowChatPage(true);
                          }
                        }
                      } catch (err) {
                        console.error('[CharacterChat] Error loading context:', err);
                      } finally {
                        setLoadingCharacterChat(false);
                      }
                    }}
                    className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <div className="relative">
                      {isThisLoading && (
                        <motion.div
                          className="absolute -inset-[3px] rounded-full"
                          style={{ border: '2.5px solid transparent', borderTopColor: 'rgba(59, 130, 246, 0.8)', borderRightColor: 'rgba(59, 130, 246, 0.3)' }}
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                      )}
                      <div
                        className="w-14 h-14 rounded-full overflow-hidden"
                        style={{
                          border: isThisLoading ? '2px solid rgba(59, 130, 246, 0.4)' : '2px solid rgba(255, 255, 255, 0.5)',
                          boxShadow: isThisLoading ? '0 0 12px rgba(59, 130, 246, 0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
                        }}
                      >
                        <img src={avatar.image_url} alt={avatar.character} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).parentElement!.parentElement!.parentElement!.style.display = 'none'; }} />
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 max-w-[64px] truncate">{avatar.character.split(' ')[0]}</span>
                  </motion.button>
                );
              };

              const readersButton = (
                <button
                  onClick={async () => {
                    if (!activeBook?.canonical_book_id) return;
                    if (!localStorage.getItem('hasJoinedTelegramGroup')) {
                      setShowTelegramJoinModal(true);
                      return;
                    }
                    const cachedTopic = telegramTopics.get(activeBook.canonical_book_id);
                    if (cachedTopic) {
                      window.open(cachedTopic.inviteLink, '_blank');
                      return;
                    }
                    const newWindow = window.open('', '_blank');
                    setIsLoadingTelegramTopic(true);
                    try {
                      const topic = await getOrCreateTelegramTopic(activeBook.title, activeBook.author, activeBook.canonical_book_id, activeBook.cover_url || undefined, activeBook.genre || undefined);
                      if (topic) {
                        setTelegramTopics(prev => new Map(prev).set(activeBook.canonical_book_id!, topic));
                        if (newWindow) newWindow.location.href = topic.inviteLink;
                        else window.open(topic.inviteLink, '_blank');
                      } else { newWindow?.close(); }
                    } catch (err) { console.error('Error opening Telegram topic:', err); newWindow?.close(); }
                    finally { setIsLoadingTelegramTopic(false); }
                  }}
                  disabled={isLoadingTelegramTopic || !activeBook?.canonical_book_id}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
                >
                  <div className="h-14 flex items-center">
                    <div className="flex items-center">
                      {bookReaders.slice(0, 3).map((reader, index) => (
                        reader.avatar ? (
                          <img
                            key={reader.id}
                            src={reader.avatar}
                            alt={reader.name}
                            className="w-14 h-14 shrink-0 rounded-full border-2 border-white object-cover"
                            style={{ zIndex: 4 - index, marginLeft: index > 0 ? -46 : 0 }}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div
                            key={reader.id}
                            className="w-14 h-14 shrink-0 rounded-full border-2 border-white flex items-center justify-center text-sm font-bold text-white"
                            style={{ zIndex: 4 - index, marginLeft: index > 0 ? -46 : 0, background: avatarGradient(reader.id) }}
                          >
                            {reader.name.charAt(0).toUpperCase()}
                          </div>
                        )
                      ))}
                      {bookReaders.length === 0 && (
                        <div
                          className="w-14 h-14 shrink-0 rounded-full flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg, #dbeafe, #c7d2fe)', border: '2px solid rgba(255, 255, 255, 0.5)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                        >
                          <MessagesSquare size={22} className="text-indigo-500" />
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 max-w-[64px] truncate">
                    {bookReaders.length + 1} {bookReaders.length === 0 ? 'reader' : 'readers'}
                  </span>
                </button>
              );

              return (
                <div className="w-full mt-3 px-2">
                  <p className="text-[12px] uppercase tracking-[0.15em] font-bold text-slate-500 mb-2.5 text-center">Chat about it with</p>
                  <div className="flex items-center justify-center gap-2.5">
                    {/* 1. General book chatbot */}
                    <button
                      ref={(el) => { if (el) avatarButtonRefs.current.set('__bookluver__', el); }}
                      onClick={() => {
                        chatOpenedFromBookPage.current = true;
                        setCharacterChatContext(null);
                        // Use avatar expand transition like character avatars
                        const btn = avatarButtonRefs.current.get('__bookluver__');
                        const imgEl = btn?.querySelector('img');
                        if (imgEl) {
                          const rect = imgEl.getBoundingClientRect();
                          setAvatarExpandTransition({ imageUrl: getAssetPath('/avatars/bookluver.webp'), rect, characterName: 'Book.luver' });
                        } else {
                          setChatBookSelected(true);
                          setShowChatPage(true);
                        }
                      }}
                      className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden" style={{ border: '2px solid rgba(255, 255, 255, 0.5)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                        <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 max-w-[64px] truncate">Book.luver</span>
                    </button>

                    {/* 2-4. Character avatars row 1 (or loading skeletons) */}
                    {isLoadingAvatars ? (
                      [0, 1, 2].map(i => (
                        <div key={`skel-${i}`} className="flex flex-col items-center gap-1.5">
                          <motion.div
                            animate={{ opacity: [0.4, 0.7, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
                            className="w-14 h-14 rounded-full bg-slate-200/50"
                            style={{ border: '2px solid rgba(148, 163, 184, 0.3)' }}
                          />
                          <div className="w-10 h-2.5 rounded bg-slate-200/40 animate-pulse" />
                        </div>
                      ))
                    ) : avatars.length > 0 ? (
                      row1Avatars.map((avatar, i) => renderCharacterAvatar(avatar, i))
                    ) : (
                      /* No avatars found — show retry button */
                      <button
                        onClick={() => retryCharacterAvatars()}
                        className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform opacity-50 hover:opacity-80"
                      >
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: '2px dashed rgba(148, 163, 184, 0.5)' }}>
                          <RefreshCw size={18} className="text-slate-400" />
                        </div>
                        <span className="text-[10px] text-slate-400">Retry</span>
                      </button>
                    )}

                    {/* Readers button — on row 1 when single row */}
                    {!needsTwoRows && readersButton}
                  </div>
                  {/* Row 2: overflow character avatars + readers */}
                  {needsTwoRows && row2Avatars.length > 0 && !isLoadingAvatars && (
                    <div className="flex items-center justify-center gap-2.5 mt-2">
                      {row2Avatars.map((avatar, i) => renderCharacterAvatar(avatar, row1Avatars.length + i))}
                      {readersButton}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Info + Book Summary */}
            {!showRatingOverlay && (() => {
              const summary = bookSummaries.get(activeBook.id);
              const isLoadingSummary = loadingSummaryForBookId === activeBook.id && !summary;

              const infoCardContent = (
                <>
                  <h2 className="text-sm font-black text-slate-950 dark:text-slate-50 leading-tight line-clamp-2 mb-2">{activeBook.title}</h2>
                  {activeBook.summary && (
                    <div className="mb-2">
                      <p
                        className={`text-xs text-black leading-relaxed ${!isSummaryExpanded ? 'line-clamp-5' : ''} cursor-pointer`}
                        onClick={(e) => { e.stopPropagation(); setIsSummaryExpanded(!isSummaryExpanded); }}
                      >
                        {activeBook.summary}
                      </p>
                      {activeBook.summary.length > 300 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setIsSummaryExpanded(!isSummaryExpanded); }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium mt-1"
                        >
                          {isSummaryExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">{activeBook.author}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeBook.first_issue_year && (
                      <span className="bg-blue-100/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-blue-800">
                        First Issue: {activeBook.first_issue_year}
                      </span>
                    )}
                    {activeBook.publish_year && !activeBook.first_issue_year && (
                      <span className="bg-slate-100/90 dark:bg-slate-700/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-800 dark:text-slate-200">
                        {activeBook.publish_year}
                      </span>
                    )}
                    {activeBook.genre && (
                      <span className="bg-slate-100/90 dark:bg-slate-700/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-800 dark:text-slate-200">
                        {activeBook.genre}
                      </span>
                    )}
                    {activeBook.isbn && (
                      <span className="bg-slate-100/90 dark:bg-slate-700/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-800 dark:text-slate-200">
                        ISBN: {activeBook.isbn}
                      </span>
                    )}
                    {(activeBook.wikipedia_url || activeBook.google_books_url) && (
                      <a
                        href={activeBook.google_books_url || activeBook.wikipedia_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-blue-700 flex items-center gap-0.5 uppercase font-bold tracking-widest hover:underline"
                      >
                        Source <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  {!isReviewer && <div className="border-t border-white/20 dark:border-white/10 my-2" />}
                  {!isReviewer && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isLoadingBookReaders ? (
                          <motion.div
                            animate={{ opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            className="flex items-center gap-2"
                          >
                            <div className="flex -space-x-2">
                              {[1, 2, 3].map((i) => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-300/50 dark:bg-slate-600/50" style={{ zIndex: 5 - i }} />
                              ))}
                            </div>
                            <div className="w-16 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded ml-1" />
                          </motion.div>
                        ) : (
                          <>
                            {(() => {
                              const hasBot = !!(activeBook?.canonical_book_id && telegramTopics.has(activeBook.canonical_book_id));
                              const sortedReaders = [...bookReaders].sort((a, b) => (b.isFollowing ? 1 : 0) - (a.isFollowing ? 1 : 0));
                              const maxReaders = Math.min(sortedReaders.length, 3);
                              const slotsLeft = 3 - maxReaders;
                              const showBot = hasBot && slotsLeft > 0;
                              const showMe = slotsLeft > (showBot ? 1 : 0);
                              return (
                                <div className="flex -space-x-2">
                                  {showMe && (userAvatar ? (
                                    <img
                                      src={userAvatar}
                                      alt={userName}
                                      className="w-8 h-8 shrink-0 rounded-full border-2 border-emerald-400 object-cover"
                                      style={{ zIndex: 7 }}
                                      title={`${userName} (you)`}
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div
                                      className="w-8 h-8 shrink-0 rounded-full border-2 border-emerald-400 flex items-center justify-center text-xs font-bold text-white"
                                      style={{ zIndex: 7, background: avatarGradient(user?.id || userName) }}
                                      title={`${userName} (you)`}
                                    >
                                      {userName.charAt(0).toUpperCase()}
                                    </div>
                                  ))}
                                  {showBot && (
                                    <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-8 h-8 shrink-0 rounded-full border-2 border-sky-400 object-cover" style={{ zIndex: 6 }} title="Book.luver" />
                                  )}
                                  {sortedReaders.slice(0, maxReaders).map((reader, index) => (
                                    reader.avatar ? (
                                      <img
                                        key={reader.id}
                                        src={reader.avatar}
                                        alt={reader.name}
                                        className="w-8 h-8 shrink-0 rounded-full border-2 border-white object-cover"
                                        style={{ zIndex: 4 - index }}
                                        title={reader.name}
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div
                                        key={reader.id}
                                        className="w-8 h-8 shrink-0 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                                        style={{ zIndex: 4 - index, background: avatarGradient(reader.id) }}
                                        title={reader.name}
                                      >
                                        {reader.name.charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  ))}
                                </div>
                              );
                            })()}
                            <span className="text-xs text-slate-600 dark:text-slate-400 ml-1">
                              {bookReaders.length + 1 + (activeBook?.canonical_book_id && telegramTopics.has(activeBook.canonical_book_id) ? 1 : 0)} {bookReaders.length === 0 && !(activeBook?.canonical_book_id && telegramTopics.has(activeBook.canonical_book_id)) ? 'reader' : 'readers'}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Telegram chat button */}
                      {!isLoadingBookReaders && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!activeBook?.canonical_book_id) return;
                            if (!localStorage.getItem('hasJoinedTelegramGroup')) {
                              setShowTelegramJoinModal(true);
                              return;
                            }
                            const cachedTopic = telegramTopics.get(activeBook.canonical_book_id);
                            if (cachedTopic) {
                              window.open(cachedTopic.inviteLink, '_blank');
                              return;
                            }
                            const newWindow = window.open('', '_blank');
                            setIsLoadingTelegramTopic(true);
                            try {
                              const topic = await getOrCreateTelegramTopic(
                                activeBook.title, activeBook.author, activeBook.canonical_book_id,
                                activeBook.cover_url || undefined, activeBook.genre || undefined
                              );
                              if (topic) {
                                setTelegramTopics(prev => new Map(prev).set(activeBook.canonical_book_id!, topic));
                                if (newWindow) newWindow.location.href = topic.inviteLink;
                                else window.open(topic.inviteLink, '_blank');
                              } else { newWindow?.close(); }
                            } catch (err) { console.error('Error opening Telegram topic:', err); newWindow?.close(); }
                            finally { setIsLoadingTelegramTopic(false); }
                          }}
                          disabled={isLoadingTelegramTopic || !activeBook?.canonical_book_id}
                          className="flex items-center justify-center w-8 h-8 rounded-full active:scale-95 transition-all disabled:opacity-50"
                          style={{
                            background: 'rgba(255, 255, 255, 0.6)',
                            backdropFilter: 'blur(9.4px)',
                            WebkitBackdropFilter: 'blur(9.4px)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                          }}
                        >
                          {isLoadingTelegramTopic ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full"
                            />
                          ) : (
                            <MessagesSquare size={16} className="text-slate-700 dark:text-slate-300" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </>
              );

              // If summary is loading or available, show unified stack
              if (isLoadingSummary || summary) {
                return (
                  <div className="w-full mt-3">
                    <BookSummaryComponent
                      summary={summary!}
                      bookId={activeBook.id}
                      isLoading={isLoadingSummary}
                      firstIssueYear={activeBook.first_issue_year}
                      readersSection={undefined}
                    />
                  </div>
                );
              }

              // No summary — show info card as standalone glassmorphic box
              return (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`info-${activeBook?.id || 'default'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="w-full mt-3"
                  >
                    <div className="rounded-2xl px-4 py-3 mx-auto" style={bookPageGlassmorphicStyle}>
                      {infoCardContent}
                    </div>
                  </motion.div>
                </AnimatePresence>
              );
            })()}

            {/* Spotlight recommendation */}
            {!showRatingOverlay && spotlightRecommendation && (
              <SpotlightSection
                spotlightRecommendation={spotlightRecommendation}
                didYouKnow={didYouKnow}
                podcastEpisodes={podcastEpisodes}
                youtubeVideos={youtubeVideos}
                relatedBooks={relatedBooks}
                analysisArticles={analysisArticles}
                relatedMovies={relatedMovies}
                spotlightIndex={spotlightIndex}
                setSpotlightIndex={setSpotlightIndex}
                setShowAccountPage={(val: React.SetStateAction<boolean>) => { const next = typeof val === 'function' ? val(showAccountPage) : val; if (next) capturePreviousView(); setShowAccountPage(next); }}
                handleAddBook={handleAddBook}
                moreBelowAnimRef={moreBelowAnimRef}
                readingStatus={activeBook.reading_status}
                spoilerRevealed={spoilerRevealed}
                setSpoilerRevealed={setSpoilerRevealed}
                bookId={activeBook.id}
                heartCounts={heartCounts}
                userHearted={userHearted}
                handleToggleHeart={handleToggleHeart}
                showMoviePlayButtons={remoteFlags.related_work_play_buttons}
                showComment={false}
                showSend={remoteFlags.send_enabled}
                onPin={(content: string, type: string, url: string, imageUrl: string) => handlePinForLater(content, type, url, imageUrl)}
                isContentPinned={isContentPinned}
              />
            )}

            {/* Second "more below" animation */}
            {!showRatingOverlay && spotlightRecommendation && (
              <div className="flex justify-center -mt-4 -mb-4">
                <Lottie
                  animationData={bookPageOnboardingAnimation}
                  loop={false}
                  style={{ width: 200, height: 88 }}
                />
              </div>
            )}

            {/* Insights Section */}
            {!showRatingOverlay && (
              <>
                <div className="w-full space-y-6">

                  {/* Insights */}
                  {(() => {
                    if (!bookDetailInsightsState.hasEnabledInsights) return null;
                    const {
                      shouldBlurInsights,
                      categories,
                      currentCategory,
                      currentInsights,
                      isLoading,
                    } = bookDetailInsightsState;

                    return (
                      <div className="w-full space-y-2">
                        {!featureFlags.bookPageSectionHeaders.insights && (
                          <div className="flex items-center justify-center mb-2 relative z-[40]">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm relative" style={bookPageGlassmorphicStyle}>
                              <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">INSIGHTS:</span>
                              {categories.length > 1 && (
                                <>
                                  <span className="text-[10px] font-bold text-slate-400">/</span>
                                  <div className="relative insight-category-dropdown z-[40]">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsInsightCategoryDropdownOpen(!isInsightCategoryDropdownOpen);
                                      }}
                                      className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded transition-colors text-blue-700 hover:bg-blue-50"
                                    >
                                      {currentCategory?.label || 'Trivia'}
                                      <ChevronDown
                                        size={12}
                                        className={`transition-transform ${isInsightCategoryDropdownOpen ? 'rotate-180' : ''}`}
                                      />
                                    </button>
                                    {isInsightCategoryDropdownOpen && (
                                      <div className="absolute top-full left-0 mt-1 bg-white/95 backdrop-blur-md border border-white/30 dark:border-white/10 rounded-lg shadow-xl z-[40] min-w-[120px] overflow-hidden">
                                        {categories.map((cat) => (
                                          <button
                                            key={cat.id || `cat-${cat.label}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedInsightCategory(cat.id);
                                              analytics.trackEvent('insights', 'view', { category: cat.id, book_title: activeBook?.title });
                                              setIsInsightCategoryDropdownOpen(false);
                                            }}
                                            className={`w-full text-left text-[10px] font-bold px-3 py-2 transition-colors ${
                                              selectedInsightCategory === cat.id
                                                ? 'text-blue-700 bg-blue-100'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                          >
                                            {cat.label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                              {categories.length === 1 && (
                                <>
                                  <span className="text-[10px] font-bold text-slate-400">/</span>
                                  <span className="text-[10px] font-bold text-blue-700">{currentCategory?.label || 'Trivia'}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        <div
                          className={`relative ${shouldBlurInsights ? 'cursor-pointer' : ''}`}
                          onClick={(e) => {
                            if (shouldBlurInsights) {
                              e.stopPropagation();
                              setSpoilerRevealed(prev => {
                                const newMap = new Map(prev);
                                const revealed = newMap.get(activeBook.id) || new Set<string>();
                                revealed.add('insights');
                                newMap.set(activeBook.id, revealed);
                                return newMap;
                              });
                            }
                          }}
                        >
                          {shouldBlurInsights && !isLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-sm shadow-sm">
                                <Lightbulb size={14} className="text-slate-600 dark:text-slate-400" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Spoiler alert, tap to reveal</span>
                              </div>
                            </div>
                          )}
                          <div className={`[&_p]:transition-[filter] [&_p]:duration-300 [&_span]:transition-[filter] [&_span]:duration-300 [&_button]:transition-[filter] [&_button]:duration-300 ${shouldBlurInsights && !isLoading ? '[&_p]:blur-[5px] [&_span]:blur-[5px] [&_button]:blur-[5px] select-none pointer-events-none' : ''}`}>
                            {isLoading ? (
                              <motion.div
                                animate={{ opacity: [0.5, 0.8, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="rounded-xl p-4"
                                style={glassmorphicStyle}
                              >
                                <div className="flex flex-col items-center gap-2">
                                  <div className="w-16 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                  <div className="w-full h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                  <div className="w-3/4 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                  <div className="w-20 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mt-1" />
                                </div>
                              </motion.div>
                            ) : currentInsights.length > 0 ? (
                              <InsightsCards
                                insights={currentInsights}
                                bookId={`${activeBook.id}-${selectedInsightCategory}`}
                                isLoading={false}
                                showComment={false}
                                showSend={remoteFlags.send_enabled}
                                renderAction={renderInsightsHeartAction}
                                onPin={pinInsightItem}
                                isPinned={isInsightItemPinned}
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Podcast Episodes */}
                  {(() => {
                    if (contentPreferences.podcasts === false) return null;
                    const episodes = combinedPodcastEpisodes;
                    const hasEpisodes = episodes.length > 0;
                    const isLoading = activeBook && loadingPodcastsForBookId === activeBook.id && !hasEpisodes;
                    if (!isLoading && !hasEpisodes) return null;
                    return (
                      <div className="w-full space-y-2">
                        {!featureFlags.bookPageSectionHeaders.podcasts && (
                          <div className="flex items-center justify-center mb-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                              <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">PODCASTS:</span>
                              <span className="text-[10px] font-bold text-slate-400">/</span>
                              <span className="text-[10px] font-bold text-blue-700">Curated + Apple</span>
                            </div>
                          </div>
                        )}
                        <div>
                          {isLoading ? (
                            <motion.div
                              animate={{ opacity: [0.5, 0.8, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="rounded-xl p-4"
                              style={glassmorphicStyle}
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-12 h-12 bg-slate-300/50 dark:bg-slate-600/50 rounded-lg animate-pulse flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                  <div className="w-3/4 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                  <div className="w-1/2 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="w-full h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                <div className="w-2/3 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                              </div>
                            </motion.div>
                          ) : (
                            <PodcastEpisodes
                              episodes={episodes}
                              bookId={activeBook?.id || ''}
                              isLoading={false}
                              showComment={false}
                              showSend={remoteFlags.send_enabled}
                              renderAction={renderPodcastHeartAction}
                              onPin={pinPodcastItem}
                              isPinned={isPodcastItemPinned}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* YouTube Videos */}
                  {(() => {
                    if (contentPreferences.youtube === false) return null;
                    const videos = activeVideos;
                    const hasVideos = videos.length > 0;
                    const isLoading = loadingVideosForBookId === activeBook.id && !hasVideos;
                    if (!isLoading && !hasVideos) return null;
                    return (
                      <div className="w-full space-y-2">
                        {!featureFlags.bookPageSectionHeaders.youtube && (
                          <div className="flex items-center justify-center mb-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                              <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">VIDEOS:</span>
                              <span className="text-[10px] font-bold text-slate-400">/</span>
                              <span className="text-[10px] font-bold text-blue-700">YouTube</span>
                            </div>
                          </div>
                        )}
                        <div>
                          {isLoading ? (
                            <motion.div
                              animate={{ opacity: [0.5, 0.8, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="rounded-xl overflow-hidden"
                              style={glassmorphicStyle}
                            >
                              <div className="relative w-full bg-slate-300/50 dark:bg-slate-600/50 animate-pulse" style={{ paddingBottom: '56.25%' }}>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Play size={32} className="text-slate-400/50" />
                                </div>
                              </div>
                              <div className="p-4 space-y-2">
                                <div className="w-3/4 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                <div className="w-1/2 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                              </div>
                            </motion.div>
                          ) : (
                            <YouTubeVideos
                              videos={videos}
                              bookId={activeBook.id}
                              isLoading={false}
                              showComment={false}
                              showSend={remoteFlags.send_enabled}
                              renderAction={renderYouTubeHeartAction}
                              onPin={pinYouTubeItem}
                              isPinned={isYouTubeItemPinned}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Analysis Articles */}
                  {(() => {
                    if (contentPreferences.articles === false) return null;
                    const articles = activeArticles;
                    const hasRealArticles = articles.length > 0 && articles.some(article => {
                      const isFallback = article.title?.includes('Search Google Scholar') ||
                                         (article.url && article.url.includes('scholar.google.com/scholar?q='));
                      return !isFallback;
                    });
                    const hasOnlyFallback = articles.length > 0 && !hasRealArticles;
                    const hasArticles = hasRealArticles;
                    const isLoading = loadingAnalysisForBookId === activeBook.id && !hasArticles && !hasOnlyFallback;
                    if (!isLoading && !hasArticles) return null;
                    return (
                      <div className="w-full space-y-2">
                        {!featureFlags.bookPageSectionHeaders.articles && (
                          <div className="flex items-center justify-center mb-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                              <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">ANALYSIS:</span>
                              <span className="text-[10px] font-bold text-slate-400">/</span>
                              <span className="text-[10px] font-bold text-blue-700">Google Scholar</span>
                            </div>
                          </div>
                        )}
                        <div>
                          {isLoading ? (
                            <motion.div
                              animate={{ opacity: [0.5, 0.8, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="rounded-xl p-4"
                              style={glassmorphicStyle}
                            >
                              <div className="space-y-2">
                                <div className="w-3/4 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                <div className="w-1/2 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                <div className="w-full h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse mt-3" />
                                <div className="w-5/6 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                              </div>
                            </motion.div>
                          ) : (
                            <AnalysisArticles
                              articles={articles}
                              bookId={activeBook.id}
                              isLoading={false}
                              showComment={false}
                              showSend={remoteFlags.send_enabled}
                              renderAction={renderArticleHeartAction}
                              onPin={pinArticleItem}
                              isPinned={isArticleItemPinned}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Related Movies & Shows */}
                  {(() => {
                    if (contentPreferences.related_work === false) return null;
                    const movies = activeRelatedMovies;
                    const hasData = relatedMovies.get(activeBook.id) !== undefined;
                    const hasMovies = movies.length > 0;
                    const isLoading = loadingRelatedMoviesForBookId === activeBook.id && !hasData;
                    if (!isLoading && !hasMovies) return null;
                    return (
                      <div className="w-full space-y-2">
                        {!(featureFlags.bookPageSectionHeaders as any).relatedMovies && (
                          <div className="flex items-center justify-center mb-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                              <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">MOVIES:</span>
                              <span className="text-[10px] font-bold text-slate-400">/</span>
                              <span className="text-[10px] font-bold text-indigo-700">Grok + iTunes</span>
                            </div>
                          </div>
                        )}
                        {isLoading ? (
                          <motion.div
                            animate={{ opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            className="rounded-xl p-4"
                            style={glassmorphicStyle}
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-16 h-20 bg-slate-300/50 dark:bg-slate-600/50 rounded-lg animate-pulse flex-shrink-0" />
                              <div className="flex-1 space-y-2">
                                <div className="w-3/4 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                <div className="w-1/2 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                <div className="w-20 h-6 bg-slate-300/50 dark:bg-slate-600/50 rounded-lg animate-pulse mt-2" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="w-full h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                              <div className="w-4/5 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                            </div>
                          </motion.div>
                        ) : (
                          <RelatedMovies
                            movies={movies}
                            bookId={activeBook.id}
                            isLoading={false}
                            showPlayButtons={remoteFlags.related_work_play_buttons}
                            showComment={false}
                            showSend={remoteFlags.send_enabled}
                            renderAction={renderRelatedMovieHeartAction}
                            onPin={pinRelatedMovieItem}
                            isPinned={isRelatedMovieItemPinned}
                          />
                        )}
                      </div>
                    );
                  })()}

                  {/* Hidden content - single row */}
                  {(() => {
                    const hiddenSections: { key: string; label: string }[] = [];
                    if (contentPreferences.fun_facts === false) hiddenSections.push({ key: 'fun_facts', label: 'Fun Facts' });
                    if (contentPreferences.podcasts === false) hiddenSections.push({ key: 'podcasts', label: 'Podcasts' });
                    if (contentPreferences.youtube === false) hiddenSections.push({ key: 'youtube', label: 'YouTube' });
                    if (contentPreferences.articles === false) hiddenSections.push({ key: 'articles', label: 'Articles' });
                    if (contentPreferences.related_work === false) hiddenSections.push({ key: 'related_work', label: 'Related Work' });
                    if (contentPreferences.related_books === false) hiddenSections.push({ key: 'related_books', label: 'Related Books' });
                    if (hiddenSections.length === 0) return null;
                    return (
                      <div className="w-full">
                        <div className="flex items-center justify-between px-4 py-3 rounded-2xl" style={glassmorphicStyle}>
                          <div className="flex items-center gap-2 min-w-0">
                            <EyeOff size={14} className="text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-400 truncate">{hiddenSections.map(s => s.label).join(', ')} hidden</span>
                          </div>
                          <button onClick={() => { capturePreviousView(); updateScrollY(0); setShowAccountPage(true); }} className="text-xs font-medium text-blue-500 active:opacity-70 flex-shrink-0 ml-2">Settings</button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Related Books */}
                  {(() => {
                    if (contentPreferences.related_books === false) return null;
                    const related = activeRelatedBooks;
                    const hasData = relatedBooks.get(activeBook.id) !== undefined;
                    const hasRelated = related.length > 0;
                    const isLoading = loadingRelatedForBookId === activeBook.id && !hasData;
                    if (!isLoading && !hasRelated) return null;
                    return (
                      <>
                        <div className="flex justify-center -mt-4 -mb-4">
                          <Lottie
                            animationData={nextReadsAnimation}
                            loop={true}
                            style={{ width: 200, height: 88 }}
                          />
                        </div>
                        <div className="w-full space-y-2 !mt-0">
                          {!featureFlags.bookPageSectionHeaders.relatedBooks && (
                            <div className="flex items-center justify-center mb-2">
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                                <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">RELATED:</span>
                                <span className="text-[10px] font-bold text-slate-400">/</span>
                                <span className="text-[10px] font-bold text-blue-700">Grok</span>
                              </div>
                            </div>
                          )}
                          {isLoading ? (
                            <motion.div
                              animate={{ opacity: [0.5, 0.8, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="rounded-xl p-4"
                              style={glassmorphicStyle}
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-16 h-20 bg-slate-300/50 dark:bg-slate-600/50 rounded-lg animate-pulse flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                  <div className="w-3/4 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                  <div className="w-1/2 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                  <div className="w-20 h-6 bg-slate-300/50 dark:bg-slate-600/50 rounded-lg animate-pulse mt-2" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="w-full h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                                <div className="w-4/5 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                              </div>
                            </motion.div>
                          ) : (
                            <RelatedBooks
                              books={related}
                              bookId={activeBook.id}
                              isLoading={false}
                              onAddBook={handleAddBook}
                              showComment={false}
                              showSend={remoteFlags.send_enabled}
                              sourceBookCoverUrl={activeBook.cover_url}
                              sourceBookTitle={activeBook.title}
                              renderAction={renderRelatedBookHeartAction}
                              onPin={pinRelatedBookItem}
                              isPinned={isRelatedBookItemPinned}
                            />
                          )}
                        </div>
                      </>
                    );
                  })()}

                </div>
              </>
            )}
          </div>
        )}

      </motion.main>

      {/* Notes Editor Overlay */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {isShowingNotes && activeBook && (
            <NotesEditorOverlay
              bookId={activeBook.id}
              bookTitle={activeBook.title}
              initialNotes={activeBook.notes || null}
              onClose={(finalNotes) => {
                const hadChanges = (finalNotes || null) !== (activeBook.notes || null);
                setIsShowingNotes(false);
                setBooks(prev => prev.map(book =>
                  book.id === activeBook.id ? { ...book, notes: finalNotes } : book
                ));
                if (user) {
                  supabase
                    .from('books')
                    .update({ notes: finalNotes, updated_at: new Date().toISOString() })
                    .eq('id', activeBook.id)
                    .eq('user_id', user.id)
                    .then(({ error }) => {
                      if (error) console.error('Error saving notes:', error);
                    });
                }
                if (hadChanges && finalNotes) {
                  setNoteSavedToast(true);
                  setTimeout(() => setNoteSavedToast(false), 2000);
                }
              }}
            />
          )}
        </AnimatePresence>

        {/* Note Saved Toast */}
        <AnimatePresence>
          {noteSavedToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[101] px-4 py-2 rounded-full text-sm font-semibold text-white"
              style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            >
              Note saved
            </motion.div>
          )}
        </AnimatePresence>
      </Suspense>
    </>
  );
}
