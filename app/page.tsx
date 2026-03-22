'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Share as CapacitorShare } from '@capacitor/share';
import {
  Search,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  BookOpen,
  Trash2,
  CheckCircle2,
  Circle,
  ExternalLink,
  AlertCircle,
  Library,
  Info,
  Sparkles,
  // LogOut moved to BookshelfView
  Headphones,
  Play,
  FileText,
  Pencil,
  Grid3x3,
  BookMarked,
  ChevronDown,
  User,
  Users,
  MessageSquareQuote,
  GripVertical,
  Trophy,
  Volume2,
  VolumeX,
  Rss,
  Birdhouse,
  X,
  MessageCircle,
  MessageSquareHeart,
  MessagesSquare,
  Lightbulb,
  Cloud,
  Share,
  MoreVertical,
  PlusCircle,
  Plus,
  Bot,
  Map as MapIcon,
  UserCircle,
  Clock,
  Network,
  Target,
  Sunrise,
  Sunset,
  UserPlus,
  MapPin,
  Pin,
  Compass,
  Swords,
  Shield,
  Heart,
  Eye,
  EyeOff,
  AlertTriangle,
  Home,
  Building,
  Skull,
  Gift,
  Lock,
  Unlock,
  Flag,
  Crown,
  Flame,
  Footprints,
  Handshake,
  Hammer,
  Key,
  Mountain,
  Ship,
  Tent,
  TreePine,
  Wind,
  Workflow,
  Megaphone,
  ScrollText,
  Feather,
  Scale,
  Bomb,
  Ghost,
  Wand2,
  Anchor,
  BellRing,
  Bird,
  Briefcase,
  Car,
  Coffee,
  Drama,
  Check,
  Send,
  // Minus moved to BookshelfView
  Film,
  Tv,
  Music,
  Disc3,
  Settings2,
  Image as ImageIcon,
  Quote,
  type LucideIcon,
  Bookmark,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import spinnerAnimation from '@/public/spinner.json';
import refreshAnimation from '@/public/refresh.json';
import OnboardingScreen from './components/OnboardingScreen';
import bookPageOnboardingAnimation from '@/public/onboarding_anim_book_page_new.json';
import dailySpotAnimation from '@/public/daily_spot.json';
import TriviaGame from './components/TriviaGame';
import type { TriviaGameHandle } from './components/TriviaGame';
import nextReadsAnimation from '@/public/next_reads.json';
import { useAuth } from '@/contexts/AuthContext';
import { LoginScreen } from '@/components/LoginScreen';
import { BookLoading } from '@/components/BookLoading';
import { CachedImage } from '@/components/CachedImage';
import { supabase } from '@/lib/supabase';
import { triggerLightHaptic, triggerMediumHaptic, triggerHeavyHaptic, triggerSuccessHaptic, triggerErrorHaptic, isNativePlatform, openSystemBrowser, openDeepLink, listenForAppStateChange, listenForBackButton, exitApp, storageGet, storageSet } from '@/lib/capacitor';
import { featureFlags } from '@/lib/feature-flags';
import { getRemoteFeatureFlags, type RemoteFeatureFlags } from '@/lib/remote-feature-flags';
import { getAssetPath, decodeHtmlEntities, glassmorphicStyle } from './components/utils';
import InsightsCards from './components/InsightsCards';
import AuthorFactsTooltips from './components/AuthorFactsTooltips';
import PodcastEpisodes from './components/PodcastEpisodes';
import YouTubeVideos from './components/YouTubeVideos';
import AnalysisArticles from './components/AnalysisArticles';
import RelatedBooks from './components/RelatedBooks';
import RelatedMovies from './components/RelatedMovies';
import MusicModal from './components/MusicModal';
import WatchModal from './components/WatchModal';
import ResearchSection from './components/ResearchSection';
// ArrowAnimation moved to BookshelfView
import LightbulbAnimation from './components/LightbulbAnimation';
import RatingStars, { RATING_FEEDBACK } from './components/RatingStars';

function lazyWithChunkRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  chunkKey: string,
) {
  return lazy(async () => {
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
          // Stale client chunk map after rebuild/restart; one hard reload resolves it.
          window.location.reload();
        }
      }
      throw error;
    }
  });
}

const AddBookSheet = lazyWithChunkRetry(() => import('./components/AddBookSheet'), 'AddBookSheet');
const ConnectAccountModal = lazyWithChunkRetry(() => import('./components/ConnectAccountModal'), 'ConnectAccountModal');
const NotesEditorOverlay = lazyWithChunkRetry(() => import('./components/NotesEditorOverlay'), 'NotesEditorOverlay');
const AccountPage = lazyWithChunkRetry(() => import('./components/AccountPage'), 'AccountPage');
const FeedPage = lazyWithChunkRetry(() => import('./components/FeedPage'), 'FeedPage');
const ChatPage = lazyWithChunkRetry(() => import('./components/ChatPage'), 'ChatPage');
const FollowingPage = lazyWithChunkRetry(() => import('./components/FollowingPage'), 'FollowingPage');
import { getChatList, getCharacterChatList, lookupOrphanedChatCoverUrls, reassignChatsToBook, getProactiveCandidates, generateProactiveMessage, markProactiveReplied, type ChatListItem, type CharacterChatListItem, type BookChatContext } from './services/chat-service';
import { getCached, setCache, CACHE_KEYS } from './services/cache-service';
import HeartButton from './components/HeartButton';
import { getContentHash, toggleHeart, loadHearts } from './services/heart-service';
import BookSummaryComponent from './components/BookSummary';
import CharacterAvatars from './components/CharacterAvatars';
// CharacterChat removed — character chats now use BookChat with characterContext prop
// getBookSummary import moved to useBookDetailData hook
import { getCharacterContext } from './services/character-avatars-service';
import type { CharacterChatContext } from './services/chat-service';

// Helper function to get the correct path for static assets (handles basePath)
// getAssetPath imported from ./components/utils

// Helper function for relative time display
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// decodeHtmlEntities imported from ./components/utils


// --- Types & Constants (extracted to ./types.ts) ---
// --- Services (extracted to ./services/) ---
import {
  RATING_DIMENSIONS,
  type PodcastEpisode, type AnalysisArticle, type YouTubeVideo, type RelatedBook, type RelatedMovie,
  type BookResearch,
  type DomainInsights, type DidYouKnowItem,
  type BookInfographic,
  type FeedItem, type PersonalizedFeedItem,
  type ReadingStatus, type Book, type BookWithRatings,
  type DiscussionQuestion,
  type MusicLinks, type WatchLinks,
} from './types';
import { extractColorsFromImage } from './services/color-utils';
import { convertBookToApp, calculateAvg, getGradient } from './services/book-utils';
import { lookupBooksOnAppleBooks } from './services/apple-books-service';
import { lookupBooksOnWikipedia } from './services/wikipedia-service';
import { getAISuggestions } from './services/book-search-service';
// articles-service and youtube-service imports moved to useBookDetailData hook
import { getTelegramTopic, getOrCreateTelegramTopic } from './services/telegram-service';
import { getDiscussionQuestions } from './services/discussion-service';
import { getGrokBookInfographicWithSearch } from './services/infographic-service';
import { ensureTriviaQuestionsForBook } from './services/trivia-service';
// insights-service imports moved to useBookDetailData hook
// podcast-service import moved to useBookDetailData hook
// related-books-service and related-movies-service imports moved to useBookDetailData hook
import { createFriendBookFeedItem, generateFeedItemsForBook, getPersonalizedFeed, markFeedItemsAsShown, getReadFeedItems, setFeedItemReadStatus } from './services/feed-service';
import { analytics } from './services/analytics-service';
import { useBookDetailCardCallbacks } from './hooks/useBookDetailCardCallbacks';
import { useBookDetailData } from './hooks/useBookDetailData';
import BookDetailView from './components/BookDetailView';
import BookshelfView from './components/BookshelfView';
const BookDiscoverySwipe = lazyWithChunkRetry(() => import('./components/BookDiscoverySwipe'), 'BookDiscoverySwipe');

// Stable empty array to avoid creating new references on every render (for React.memo)
const EMPTY_ARRAY: never[] = [];

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

const SpotlightSection = React.memo(function SpotlightSection({
  spotlightRecommendation,
  didYouKnow,
  podcastEpisodes,
  youtubeVideos,
  relatedBooks,
  analysisArticles,
  relatedMovies,
  spotlightIndex,
  setSpotlightIndex,
  setShowAccountPage,
  handleAddBook,
  moreBelowAnimRef,
  readingStatus,
  spoilerRevealed,
  setSpoilerRevealed,
  bookId,
  heartCounts,
  userHearted,
  handleToggleHeart,
  showMoviePlayButtons,
  showComment,
  showSend,
  onPin,
  isContentPinned,
}: {
  spotlightRecommendation: { item: { type: string; icon: any; label: string; title: string; subtitle: string; url?: string; imageUrl?: string; itemIndex: number }; next: { type: string; icon: any; label: string; title: string; subtitle: string; url?: string; imageUrl?: string; itemIndex: number } | null; total: number; bookId: string };
  didYouKnow: Map<string, any[]>;
  podcastEpisodes: Map<string, any>;
  youtubeVideos: Map<string, any[]>;
  relatedBooks: Map<string, any[]>;
  analysisArticles: Map<string, any[]>;
  relatedMovies: Map<string, any[]>;
  spotlightIndex: number;
  setSpotlightIndex: React.Dispatch<React.SetStateAction<number>>;
  setShowAccountPage: React.Dispatch<React.SetStateAction<boolean>>;
  handleAddBook: any;
  moreBelowAnimRef: any;
  readingStatus: string | null | undefined;
  spoilerRevealed: Map<string, Set<string>>;
  setSpoilerRevealed: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>;
  bookId: string;
  heartCounts: Map<string, number>;
  userHearted: Set<string>;
  handleToggleHeart: (contentHash: string) => void;
  showMoviePlayButtons?: boolean;
  showComment?: boolean;
  showSend?: boolean;
  onPin?: (content: string, type: string, url?: string, imageUrl?: string) => void;
  isContentPinned?: (content: string) => boolean;
}) {
  const [isVisible, setIsVisible] = useState(true);
  const outerRef = useRef<HTMLDivElement>(null);
  const nextMeasureRef = useRef<HTMLDivElement>(null);
  const [targetHeight, setTargetHeight] = useState<number | undefined>(undefined);
  const spot = spotlightRecommendation.item;
  const nextSpot = spotlightRecommendation.next;
  const spotBookId = spotlightRecommendation.bookId;

  const handleSpotlightNext = () => {
    if (spotlightRecommendation.total <= 1) return;
    const nextH = nextMeasureRef.current?.offsetHeight;
    const currentH = outerRef.current?.offsetHeight;

    // Phase 1: Fade out current card (300ms)
    setTargetHeight(currentH);
    setIsVisible(false);

    setTimeout(() => {
      // Phase 2: Swap content (invisible) and animate height to next size (300ms)
      setSpotlightIndex(prev => prev + 1);
      setTargetHeight(nextH && nextH > 0 ? nextH : currentH);

      setTimeout(() => {
        // Phase 3: Fade in new card
        setIsVisible(true);
        // Release height lock after fade-in completes
        setTimeout(() => setTargetHeight(undefined), 350);
      }, 300);
    }, 300);
  };

  const renderContentForItem = (item: { type: string; itemIndex: number }, keyPrefix: string) => {
    const idx = item.itemIndex;
    switch (item.type) {
      case 'did_you_know': {
        const dykItems = didYouKnow.get(spotBookId);
        if (!dykItems || idx >= dykItems.length) return null;
        const dyk = dykItems[idx];
        const insights = [{ text: dyk.notes.join('\n\n'), sourceUrl: dyk.source_url, label: 'Did You Know?' }];
        return <InsightsCards insights={insights} bookId={`${keyPrefix}-${spotBookId}-${idx}`} isLoading={false} showComment={showComment} showSend={showSend} renderAction={() => {
          const hash = getContentHash('insight', dyk.notes[0]?.substring(0, 50) || '');
          return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
        }} onPin={onPin ? () => {
          const text = dyk.notes.join('\n\n');
          onPin(text, 'insight');
        } : undefined} isPinned={isContentPinned ? () => {
          const text = dyk.notes.join('\n\n');
          return isContentPinned(text);
        } : undefined} />;
      }
      case 'podcast': {
        const pods = podcastEpisodes.get(spotBookId);
        const allPods = [...(pods?.curated || []), ...(pods?.apple || [])];

        if (idx >= allPods.length) return null;
        return <PodcastEpisodes episodes={[allPods[idx]]} bookId={`${keyPrefix}-${spotBookId}-${idx}`} isLoading={false} showComment={showComment} showSend={showSend} renderAction={() => {
          const hash = getContentHash('podcast', allPods[idx]?.url || '');
          return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
        }} onPin={onPin ? () => {
          const pod = allPods[idx];
          if (pod) onPin(`${pod.podcast_name || 'Podcast'} — ${pod.title}`, 'podcast', pod.url || pod.audioUrl, pod.thumbnail);
        } : undefined} isPinned={isContentPinned ? () => {
          const pod = allPods[idx];
          return pod ? isContentPinned(`${pod.podcast_name || 'Podcast'} — ${pod.title}`) : false;
        } : undefined} />;
      }
      case 'video': {
        const vids = youtubeVideos.get(spotBookId);

        if (!vids || idx >= vids.length) return null;
        return <YouTubeVideos videos={[vids[idx]]} bookId={`${keyPrefix}-${spotBookId}-${idx}`} isLoading={false} showComment={showComment} showSend={showSend} renderAction={() => {
          const hash = getContentHash('youtube', vids[idx]?.videoId || '');
          return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
        }} onPin={onPin ? () => {
          const vid = vids[idx];
          if (vid) onPin(`${vid.title} — ${vid.channelTitle || 'YouTube'}`, 'youtube', vid.videoId ? `https://www.youtube.com/watch?v=${vid.videoId}` : undefined, vid.thumbnail);
        } : undefined} isPinned={isContentPinned ? () => {
          const vid = vids[idx];
          return vid ? isContentPinned(`${vid.title} — ${vid.channelTitle || 'YouTube'}`) : false;
        } : undefined} />;
      }
      case 'article': {
        const arts = analysisArticles.get(spotBookId);

        if (!arts) return null;
        const realArts = arts.filter((a: any) => !a.url?.includes('scholar.google.com/scholar?q='));
        if (idx >= realArts.length) return null;
        return <AnalysisArticles articles={[realArts[idx]]} bookId={`${keyPrefix}-${spotBookId}-${idx}`} isLoading={false} showComment={showComment} showSend={showSend} renderAction={() => {
          const hash = getContentHash('article', realArts[idx]?.url || '');
          return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
        }} onPin={onPin ? () => {
          const art = realArts[idx];
          if (art) onPin(`${art.title}${art.url ? ` — ${art.url}` : ''}`, 'article', art.url);
        } : undefined} isPinned={isContentPinned ? () => {
          const art = realArts[idx];
          return art ? isContentPinned(`${art.title}${art.url ? ` — ${art.url}` : ''}`) : false;
        } : undefined} />;
      }
      case 'movie': {
        const movies = relatedMovies.get(spotBookId);

        if (!movies || idx >= movies.length) return null;
        return <RelatedMovies movies={[movies[idx]]} bookId={`${keyPrefix}-${spotBookId}-${idx}`} isLoading={false} showPlayButtons={showMoviePlayButtons} showComment={showComment} showSend={showSend} renderAction={() => {
          const hash = getContentHash('movie', movies[idx]?.title || '');
          return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
        }} onPin={onPin ? () => {
          const movie = movies[idx];
          if (movie) onPin(`${movie.title} (${movie.type}) — ${movie.director}`, movie.type, movie.itunes_url, movie.poster_url || movie.itunes_artwork);
        } : undefined} isPinned={isContentPinned ? () => {
          const movie = movies[idx];
          return movie ? isContentPinned(`${movie.title} (${movie.type}) — ${movie.director}`) : false;
        } : undefined} />;
      }
      default:
        return null;
    }
  };

  const content = renderContentForItem(spot, 'spotlight');
  const nextContent = nextSpot ? renderContentForItem(nextSpot, 'spotlight-next') : null;
  if (!content) return null;

  // Spoiler protection for did_you_know items
  const isNotRead = readingStatus !== 'read_it';
  const revealedSections = spoilerRevealed.get(bookId) || new Set<string>();
  const isSpotlightRevealed = revealedSections.has('spotlight');
  const shouldBlur = spot.type === 'did_you_know' && isNotRead && !isSpotlightRevealed;

  const handleRevealSpoiler = (e: React.MouseEvent) => {
    if (!shouldBlur) return;
    e.stopPropagation();
    setSpoilerRevealed(prev => {
      const newMap = new Map(prev);
      const revealed = newMap.get(bookId) || new Set<string>();
      revealed.add('spotlight');
      newMap.set(bookId, revealed);
      return newMap;
    });
  };

  return (
    <div className="w-full relative">
      {/* Animation header */}
      <div ref={moreBelowAnimRef} className="relative mb-2">
        <div className="flex justify-center">
          <Lottie
            animationData={dailySpotAnimation}
            loop={true}
            style={{ width: 148, height: 65 }}
          />
        </div>
        <button
          onClick={() => { setShowAccountPage(true); }}
          className="absolute right-[17px] top-1/2 -translate-y-1/2 active:scale-90 transition-transform"
        >
          <Settings2 size={18} className="text-white" />
        </button>
      </div>

      {/* Hidden pre-render of next item for height measurement */}
      {nextContent && (
        <div
          ref={nextMeasureRef}
          aria-hidden
          className="absolute left-0 right-0 pointer-events-none [&_.pb-3]:!pb-0 [&_.rounded-2xl]:!border-[3px] [&_.rounded-2xl]:!border-white/85 spotlight-icons"
          style={{ visibility: 'hidden', position: 'absolute', zIndex: -1 }}
        >
          {nextContent}
        </div>
      )}

      {/* Spotlight content with white stroke */}
      <div ref={outerRef} className="relative pb-3" style={targetHeight !== undefined ? { height: targetHeight, overflow: 'hidden', transition: 'height 300ms ease-in-out' } : undefined}>
        <div
          className="relative cursor-pointer [&_.pb-3]:!pb-0 [&_.rounded-2xl]:!border-[3px] [&_.rounded-2xl]:!border-white/85 spotlight-icons"
          style={{
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 300ms ease',
          }}
          onClick={shouldBlur ? handleRevealSpoiler : handleSpotlightNext}
        >
          {shouldBlur && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-sm shadow-sm">
                <Lightbulb size={14} className="text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Spoiler alert, tap to reveal</span>
              </div>
            </div>
          )}
          <div className={shouldBlur ? '[&_p]:blur-[5px] [&_span]:blur-[5px] [&_button]:blur-[5px] [&_svg]:blur-[5px] select-none pointer-events-none' : ''}>
            {content}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function App() {
  const { user, loading: authLoading, signOut, isReviewer, isAnonymous } = useAuth();
  const [books, setBooks] = useState<BookWithRatings[]>([]);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // Screenshot mode for App Store screenshots
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [screenshotOverlayText, setScreenshotOverlayText] = useState('Discover the world around your books');
  const [viewingUserBooks, setViewingUserBooks] = useState<BookWithRatings[]>([]);
  const [viewingUserName, setViewingUserName] = useState<string>('');
  const [viewingUserFullName, setViewingUserFullName] = useState<string | null>(null);
  const [viewingUserAvatar, setViewingUserAvatar] = useState<string | null>(null);
  const [viewingUserIsPrivate, setViewingUserIsPrivate] = useState(false);
  const [viewingBookFromOtherUser, setViewingBookFromOtherUser] = useState<BookWithRatings | null>(null);
  const [overlayBookSummary, setOverlayBookSummary] = useState<string | null>(null);
  useEffect(() => {
    if (!viewingBookFromOtherUser) { setOverlayBookSummary(null); return; }
    const title = (viewingBookFromOtherUser.title || '').toLowerCase().trim();
    const author = (viewingBookFromOtherUser.author || '').toLowerCase().trim();
    if (!title) return;
    supabase.from('book_summary_cache')
      .select('summary_data')
      .eq('book_title', title)
      .eq('book_author', author)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.summary_data?.summary) {
          setOverlayBookSummary(data.summary_data.summary);
        }
      });
  }, [viewingBookFromOtherUser]);
  const [isLoadingViewingUserBooks, setIsLoadingViewingUserBooks] = useState(false);
  const [isFadingOutViewingUser, setIsFadingOutViewingUser] = useState(false);
  const [isFollowingViewingUser, setIsFollowingViewingUser] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [myFollowingCount, setMyFollowingCount] = useState(0);
  const [viewingUserFollowingCount, setViewingUserFollowingCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [addBookSheetMode, setAddBookSheetMode] = useState<'default' | 'chat_picker'>('default');
  const [showConnectAccountModal, setShowConnectAccountModal] = useState(false);
  const [connectAccountReason, setConnectAccountReason] = useState<'book_limit' | 'follow' | 'feed' | 'account'>('book_limit');
  const [migratedBooksCount, setMigratedBooksCount] = useState<number | null>(null);
  const [nudgeBannerDismissed, setNudgeBannerDismissed] = useState(true); // Default true, loaded on mount
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showBookMenu, setShowBookMenu] = useState(false);
  const [selectingReadingStatusInRating, setSelectingReadingStatusInRating] = useState(false);
  const [selectingReadingStatusForExisting, setSelectingReadingStatusForExisting] = useState(false);
  const [pendingBookMeta, setPendingBookMeta] = useState<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> | null>(null);
  
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isShowingNotes, setIsShowingNotes] = useState(false);
  const openNotesAfterNavRef = useRef(false); // Track when to open notes after navigating from notes list
  const [newlyAddedNoteTimestamp, setNewlyAddedNoteTimestamp] = useState<string | null>(null);
  const [noteSavedToast, setNoteSavedToast] = useState(false);
  const [noteText, setNoteText] = useState('');
  const lastSavedNoteTextRef = useRef<string>('');
  const noteTextOnFocusRef = useRef<string>('');
  const noteSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prevIsShowingNotesRef = useRef(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(true);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  // Book detail data states moved to useBookDetailData hook

  const [showInfographicModal, setShowInfographicModal] = useState(false);
  const [infographicSection, setInfographicSection] = useState<'characters' | 'timeline'>('characters');
  const [isInfographicDropdownOpen, setIsInfographicDropdownOpen] = useState(false);
  // bookshelfGroupingDropdownRef moved to BookshelfView
  const scrollY = useRef(0);
  const headerLogoRef = useRef<HTMLDivElement | null>(null);
  const headerBarRef = useRef<HTMLDivElement | null>(null);
  const bookDetailHeaderRef = useRef<HTMLDivElement | null>(null);
  // showProfileMenu moved to BookshelfView
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Update scrollY ref and header opacity via direct DOM manipulation (avoids ~30 re-renders/sec)
  const updateScrollY = useCallback((value: number) => {
    scrollY.current = value;
    const opacity = value > 20 ? Math.max(0, 1 - (value - 20) / 40) : 1;
    const pointerEvents = value > 60 ? 'none' : 'auto';
    if (headerLogoRef.current) {
      headerLogoRef.current.style.opacity = String(opacity);
    }
    if (headerBarRef.current) {
      headerBarRef.current.style.opacity = String(opacity);
      headerBarRef.current.style.pointerEvents = pointerEvents;
    }
    if (bookDetailHeaderRef.current) {
      bookDetailHeaderRef.current.style.opacity = String(opacity);
      bookDetailHeaderRef.current.style.pointerEvents = pointerEvents;
    }
  }, []);

  const attachHeaderLogoRef = useCallback((el: HTMLDivElement | null) => {
    headerLogoRef.current = el;
    if (el) {
      const opacity = scrollY.current > 20 ? Math.max(0, 1 - (scrollY.current - 20) / 40) : 1;
      el.style.opacity = String(opacity);
    }
  }, []);

  const attachHeaderBarRef = useCallback((el: HTMLDivElement | null) => {
    headerPullRef.current = el;
    headerBarRef.current = el;
    if (el) {
      const opacity = scrollY.current > 20 ? Math.max(0, 1 - (scrollY.current - 20) / 40) : 1;
      const pointerEvents = scrollY.current > 60 ? 'none' : 'auto';
      el.style.opacity = String(opacity);
      el.style.pointerEvents = pointerEvents;
    }
  }, []);

  const attachBookDetailHeaderRef = useCallback((el: HTMLDivElement | null) => {
    bookDetailHeaderRef.current = el;
    if (el) {
      const opacity = scrollY.current > 20 ? Math.max(0, 1 - (scrollY.current - 20) / 40) : 1;
      const pointerEvents = scrollY.current > 60 ? 'none' : 'auto';
      el.style.opacity = String(opacity);
      el.style.pointerEvents = pointerEvents;
    }
  }, []);

  // BookRequestType and request token system moved to useBookDetailData hook

  // Scroll to top when status bar area is tapped (iOS pattern)
  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  // Helper function to get last page from localStorage
  const getLastPageState = (): { showBookshelfCovers: boolean; showNotesView: boolean; showAccountPage: boolean; showFollowingPage: boolean; showFeedPage: boolean } => {
    if (typeof window === 'undefined') {
      return { showBookshelfCovers: false, showNotesView: false, showAccountPage: false, showFollowingPage: false, showFeedPage: false };
    }
    try {
      const saved = localStorage.getItem('lastPageState');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          showBookshelfCovers: parsed.showBookshelfCovers === true,
          showNotesView: parsed.showNotesView === true,
          showAccountPage: parsed.showAccountPage === true,
          showFollowingPage: parsed.showFollowingPage === true,
          showFeedPage: parsed.showFeedPage === true,
        };
      }
    } catch (err) {
      console.error('[getLastPageState] Error reading from localStorage:', err);
    }
    return { showBookshelfCovers: false, showNotesView: false, showAccountPage: false, showFollowingPage: false, showFeedPage: false };
  };

  // Helper function to save current page state to localStorage
  const savePageState = (state: { showBookshelfCovers: boolean; showNotesView: boolean; showAccountPage: boolean; showFollowingPage: boolean; showFeedPage: boolean }) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('lastPageState', JSON.stringify(state));
    } catch (err) {
      console.error('[savePageState] Error saving to localStorage:', err);
    }
  };

  // Track where user came from for sub-page back navigation
  type ViewOrigin = 'book-detail' | 'bookshelf-covers' | 'bookshelf-spines' | 'feed' | 'chat' | 'notes' | 'following';
  const previousViewRef = useRef<ViewOrigin>('bookshelf-covers');
  const capturePreviousView = (): void => {
    if (showFollowingPage) previousViewRef.current = 'following';
    else if (showFeedPage) previousViewRef.current = 'feed';
    else if (showChatPage) previousViewRef.current = 'chat';
    else if (showNotesView) previousViewRef.current = 'notes';
    else if (showBookshelfCovers) previousViewRef.current = 'bookshelf-covers';
    else previousViewRef.current = 'book-detail';
  };
  const restorePreviousView = (): void => {
    setShowAccountPage(false);
    setShowFollowingPage(false);
    setShowNotesView(false);
    setShowCreatePost(false);
    const target = previousViewRef.current;
    if (target === 'book-detail') {
      setShowBookshelfCovers(false);
    } else if (target === 'feed') {
      setShowFeedPage(true);
    } else if (target === 'chat') {
      setShowChatPage(true);
    } else if (target === 'following') {
      setShowFollowingPage(true);
    } else if (target === 'notes') {
      setShowNotesView(true);
    } else if (target === 'bookshelf-spines') {
    } else {
      setShowBookshelfCovers(true);
    }
    previousViewRef.current = 'bookshelf-covers';
  };

  // Initialize page states from localStorage
  const [showAccountPage, setShowAccountPage] = useState(() => getLastPageState().showAccountPage);
  // showBookshelf (spines view) removed — was deprecated, unreachable UI
  const [showBookshelfCovers, setShowBookshelfCovers] = useState(() => getLastPageState().showBookshelfCovers);
  const [showNotesView, setShowNotesView] = useState(() => getLastPageState().showNotesView);
  const [showFollowingPage, setShowFollowingPage] = useState(() => getLastPageState().showFollowingPage);
  const [showFeedPage, setShowFeedPage] = useState(() => getLastPageState().showFeedPage);
  const [showChatPage, setShowChatPage] = useState(false);
  const [chatComingSoon, setChatComingSoon] = useState(false);
  const chatNavButtonRef = useRef<HTMLButtonElement>(null);
  const triviaGameRef = useRef<TriviaGameHandle>(null);
  const [chatBookSelected, setChatBookSelected] = useState(false);
  const [chatGeneralMode, setChatGeneralMode] = useState(false);
  const chatOpenedFromBookPage = useRef(false);
  const [characterChatContext, setCharacterChatContext] = useState<CharacterChatContext | null>(null);
  const [loadingCharacterChat, setLoadingCharacterChat] = useState<string | false>(false);
  const [avatarExpandTransition, setAvatarExpandTransition] = useState<{ imageUrl: string; rect: DOMRect; characterName: string } | null>(null);
  const avatarButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [characterChatList, setCharacterChatList] = useState<CharacterChatListItem[]>([]);
  const [chatListLoading, setChatListLoading] = useState(false);
  const [unreadChatCounts, setUnreadChatCounts] = useState<Map<string, number>>(new Map());
  const [dismissedChatIds, setDismissedChatIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem('dismissedChatIds') || '[]')); } catch { return new Set(); }
  });
  const headerPullRef = useRef<HTMLDivElement | null>(null);
  const [showAboutScreen, setShowAboutScreen] = useState(false);
  const [showDiscoverySwipe, setShowDiscoverySwipe] = useState(false);
  const [discoveryToast, setDiscoveryToast] = useState<string | null>(null);
  const [showBookPageOnboarding, setShowBookPageOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('hasSeenBookPageOnboarding');
  });
  const [showAddBookTooltip, setShowAddBookTooltip] = useState(false);
  useEffect(() => {
    if (showBookshelfCovers && books.length < 5 && books.length > 0) {
      setShowAddBookTooltip(true);
      const timer = setTimeout(() => setShowAddBookTooltip(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowAddBookTooltip(false);
    }
  }, [showBookshelfCovers, books.length]);
  const moreBelowAnimRef = useRef<HTMLDivElement>(null);
  const defaultContentPrefs = { fun_facts: true, podcasts: true, youtube: true, related_work: true, articles: true, related_books: true, _order: ['fun_facts', 'podcasts', 'youtube', 'related_work', 'articles', 'related_books'] };
  const [contentPreferences, setContentPreferences] = useState<Record<string, any>>(() => {
    if (typeof window === 'undefined') return defaultContentPrefs;
    const saved = localStorage.getItem('contentPreferences');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed._order) parsed._order = ['fun_facts', 'podcasts', 'youtube', 'related_work', 'articles', 'related_books'];
      if (parsed.related_books === undefined) parsed.related_books = true;
      if (!parsed._order.includes('related_books')) parsed._order.push('related_books');
      return parsed;
    }
    return defaultContentPrefs;
  });
  const [personalizedFeedItems, setPersonalizedFeedItems] = useState<PersonalizedFeedItem[]>([]);
  const [isLoadingPersonalizedFeed, setIsLoadingPersonalizedFeed] = useState(false);
  const [heartCounts, setHeartCounts] = useState<Map<string, number>>(new Map());
  const [userHearted, setUserHearted] = useState<Set<string>>(new Set());

  // Create post
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [createPostText, setCreatePostText] = useState('');

  // Remote feature flags
  const [remoteFlags, setRemoteFlags] = useState<RemoteFeatureFlags>({ chat_enabled: false, create_post_enabled: false, related_work_play_buttons: false, commenting_enabled: false, send_enabled: false, show_grok_costs: false, discovery_swipe: false });
  useEffect(() => { getRemoteFeatureFlags().then(setRemoteFlags); }, []);

  // Book discussion state
  const [showBookDiscussion, setShowBookDiscussion] = useState(false);
  const [discussionQuestions, setDiscussionQuestions] = useState<DiscussionQuestion[]>([]);
  const [isLoadingDiscussionQuestions, setIsLoadingDiscussionQuestions] = useState(false);

  // Telegram discussion topic state
  interface TelegramTopic {
    topicId: number;
    inviteLink: string;
  }
  const [telegramTopics, setTelegramTopics] = useState<Map<string, TelegramTopic>>(new Map());
  const [isLoadingTelegramTopic, setIsLoadingTelegramTopic] = useState(false);
  const [showTelegramJoinModal, setShowTelegramJoinModal] = useState(false);

  // showReadingBookPicker moved to BookshelfView

  // Book readers state (users who have the same book)
  interface BookReader {
    id: string;
    name: string;
    avatar: string | null;
    isFollowing: boolean;
  }
  const [bookReaders, setBookReaders] = useState<BookReader[]>([]);
  const [isLoadingBookReaders, setIsLoadingBookReaders] = useState(false);

  const [editingNoteBookId, setEditingNoteBookId] = useState<string | null>(null);
  const [notesSortOrder, setNotesSortOrder] = useState<'edited_desc' | 'edited_asc' | 'name_asc' | 'name_desc'>('edited_desc');
  // bookshelfGrouping, selectedBookIds, showListSheet, showNewListInput,
  // newListName, longPressTimerRef, longPressFiredRef, isBookshelfGroupingDropdownOpen
  // — all moved to BookshelfView component
  // isSelectMode kept here so bottom nav can hide when select mode is active
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [backgroundGradient, setBackgroundGradient] = useState<string>('241,245,249,226,232,240'); // Default slate colors as RGB
  const [previousGradient, setPreviousGradient] = useState<string | null>(null);
  const [isGradientTransitioning, setIsGradientTransitioning] = useState(false);
  
  // Game state
  const [isPlayingGame, setIsPlayingGame] = useState(false);
  const [gameBook1, setGameBook1] = useState<BookWithRatings | null>(null);
  const [gameBook2, setGameBook2] = useState<BookWithRatings | null>(null);
  const [gameShownBooks, setGameShownBooks] = useState<Set<string>>(new Set());
  const [gameRound, setGameRound] = useState(0);
  const [showSortingResults, setShowSortingResults] = useState(false);
  const [isGameCompleting, setIsGameCompleting] = useState(false);
  const [showGameResults, setShowGameResults] = useState(false);
  const [draggedBookId, setDraggedBookId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [resultsUpdateTrigger, setResultsUpdateTrigger] = useState(0);
  
  // spoilerRevealed state moved to useBookDetailData hook

  // Merge Sort Implementation - O(n log n) comparisons
  // Uses a queue-based state machine to track merge operations
  
  type MergeSortState = {
    comparisonQueue: Array<{ leftId: string; rightId: string }>; // Pending comparisons
    sortedLists: Array<string[]>; // Current sorted sublists (by book ID)
    comparedCount: number; // Number of comparisons made
  };
  
  // Get merge sort state from localStorage
  const getMergeSortState = (): MergeSortState | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('bookMergeSortState');
      if (!stored) return null;
      return JSON.parse(stored) as MergeSortState;
    } catch {
      return null;
    }
  };
  
  // Save merge sort state to localStorage
  const saveMergeSortState = (state: MergeSortState) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('bookMergeSortState', JSON.stringify(state));
    } catch (err) {
      console.warn('[saveMergeSortState] Failed to save:', err);
    }
  };
  
  // Initialize merge sort state from books
  const initializeMergeSort = (availableBooks: BookWithRatings[]): MergeSortState => {
    // Start with individual books as sorted lists of size 1
    const sortedLists: string[][] = availableBooks.map(b => [b.id]);
    return {
      comparisonQueue: [],
      sortedLists,
      comparedCount: 0
    };
  };
  
  // Generate next comparison in merge sort (builds comparison queue)
  const getNextMergeComparison = (state: MergeSortState): { leftId: string; rightId: string } | null => {
    // Find the first pair of lists that can be merged
    for (let i = 0; i < state.sortedLists.length - 1; i += 2) {
      const leftList = state.sortedLists[i];
      const rightList = state.sortedLists[i + 1];
      
      if (!leftList || !rightList) continue;
      
      // Get the next comparison for merging these two lists
      // We track which indices we're at in the merge via the comparison queue
      // For simplicity, we'll rebuild the queue each time
      
      // Find the first uncompared pair between these lists
      // This happens during merge: compare heads of both lists
      for (const leftId of leftList) {
        for (const rightId of rightList) {
          // Check if we've already decided the order
          // We can infer this from the sorted structure, but for now
          // we'll add all cross-list comparisons to the queue
          const exists = state.comparisonQueue.find(c => 
            (c.leftId === leftId && c.rightId === rightId) ||
            (c.leftId === rightId && c.rightId === leftId)
          );
          if (!exists) {
            return { leftId, rightId };
          }
        }
      }
    }
    
    return null;
  };
  
  // Record a comparison and advance merge sort state
  const recordMergeComparison = (winnerId: string, loserId: string, currentState: MergeSortState): MergeSortState => {
    // Remove this comparison from queue
    const updatedQueue = currentState.comparisonQueue.filter(c => 
      !((c.leftId === winnerId && c.rightId === loserId) ||
        (c.leftId === loserId && c.rightId === winnerId))
    );
    
    // Update sorted lists based on the comparison
    // This is simplified - we'd need to track merge positions more carefully
    // For now, we'll use a simpler approach: maintain a full comparison queue
    
    return {
      ...currentState,
      comparisonQueue: updatedQueue,
      comparedCount: currentState.comparedCount + 1
    };
  };
  
  // Simplified: Build complete comparison queue for merge sort
  // This generates all comparisons needed for merge sort
  const buildMergeSortQueue = (availableBooks: BookWithRatings[]): Array<{ leftId: string; rightId: string }> => {
    const queue: Array<{ leftId: string; rightId: string }> = [];
    const books = availableBooks.map(b => b.id);
    
    // Merge sort comparison pattern: we need to merge adjacent pairs
    // For simplicity, we'll generate comparisons level by level
    
    // Start with individual lists
    let currentLists: string[][] = books.map(id => [id]);
    
    // While we have more than one list
    while (currentLists.length > 1) {
      const nextLists: string[][] = [];
      
      // Process pairs of lists
      for (let i = 0; i < currentLists.length; i += 2) {
        const left = currentLists[i];
        const right = currentLists[i + 1];
        
        if (!right) {
          // Odd one out, move to next level
          nextLists.push(left);
          continue;
        }
        
        // Generate comparisons needed to merge left and right
        // During merge, we compare heads of lists
        // For now, we'll generate all necessary comparisons
        let leftIdx = 0, rightIdx = 0;
        const merged: string[] = [];
        
        // Generate comparisons for merging
        while (leftIdx < left.length && rightIdx < right.length) {
          // This is the comparison we need
          queue.push({ leftId: left[leftIdx], rightId: right[rightIdx] });
          
          // We don't know the result yet, so we'll let the user decide
          // For now, we'll just track that we need this comparison
          leftIdx++;
          rightIdx++;
        }
      }
      
      if (nextLists.length === 1 && currentLists.length <= 2) {
        break; // We're done
      }
      
      currentLists = nextLists;
    }
    
    return queue;
  };
  
  // Better approach: Maintain merge state more explicitly
  type MergeOperation = {
    leftList: string[];
    rightList: string[];
    leftIdx: number;
    rightIdx: number;
    merged: string[];
  };
  
  type MergeSortStateV2 = {
    mergeStack: MergeOperation[];
    completedSortedLists: string[][]; // Track ALL completed sorted lists at current level
    comparedCount: number;
  };
  
  // Initialize merge sort with explicit merge operations
  const initializeMergeSortV2 = (availableBooks: BookWithRatings[]): MergeSortStateV2 => {
    const bookIds = availableBooks.map(b => b.id);
    console.log('[initializeMergeSortV2] 🎮 Initializing merge sort with', bookIds.length, 'books');
    
    // Create initial merge operations (adjacent pairs)
    const mergeStack: MergeOperation[] = [];
    for (let i = 0; i < bookIds.length; i += 2) {
      const left = [bookIds[i]];
      const right = bookIds[i + 1] ? [bookIds[i + 1]] : [];
      if (right.length > 0) {
        mergeStack.push({
          leftList: left,
          rightList: right,
          leftIdx: 0,
          rightIdx: 0,
          merged: []
        });
      }
    }
    
    console.log('[initializeMergeSortV2] 📊 Created', mergeStack.length, 'initial merge operations');
    
    return {
      mergeStack,
      completedSortedLists: [],
      comparedCount: 0
    };
  };
  
  // Get next comparison from current merge operation
  const getNextComparisonFromMerge = (state: MergeSortStateV2): { leftId: string; rightId: string } | null => {
    console.log('[getNextComparisonFromMerge] 🔍 State:', {
      mergeStackLength: state.mergeStack.length,
      completedSortedListsCount: state.completedSortedLists?.length || 0,
      completedSortedLists: state.completedSortedLists || [],
      comparedCount: state.comparedCount
    });
    
    if (state.mergeStack.length === 0) {
      console.log('[getNextComparisonFromMerge] ✅ Merge stack empty - sorting complete');
      return null; // Sorting complete
    }
    
    const currentMerge = state.mergeStack[0];
    console.log('[getNextComparisonFromMerge] 📋 Current merge:', {
      leftListLength: currentMerge.leftList.length,
      rightListLength: currentMerge.rightList.length,
      leftIdx: currentMerge.leftIdx,
      rightIdx: currentMerge.rightIdx,
      mergedLength: currentMerge.merged.length
    });
    
    if (currentMerge.leftIdx >= currentMerge.leftList.length) {
      // Left list exhausted, merge remaining right
      console.log('[getNextComparisonFromMerge] ⚠️ Left list exhausted');
      return null; // Should advance merge
    }
    if (currentMerge.rightIdx >= currentMerge.rightList.length) {
      // Right list exhausted, merge remaining left
      console.log('[getNextComparisonFromMerge] ⚠️ Right list exhausted');
      return null; // Should advance merge
    }
    
    const comparison = {
      leftId: currentMerge.leftList[currentMerge.leftIdx],
      rightId: currentMerge.rightList[currentMerge.rightIdx]
    };
    console.log('[getNextComparisonFromMerge] ✅ Next comparison:', comparison);
    return comparison;
  };
  
  // Record comparison and advance merge
  const recordMergeComparisonV2 = (
    winnerId: string, 
    loserId: string, 
    state: MergeSortStateV2
  ): MergeSortStateV2 => {
    console.log('[recordMergeComparisonV2] 🎯 Recording:', { winnerId, loserId, mergeStackLength: state.mergeStack.length });
    
    // Ensure completedSortedLists is always defined
    const safeState = {
      ...state,
      completedSortedLists: state.completedSortedLists || []
    };
    
    if (safeState.mergeStack.length === 0) {
      console.warn('[recordMergeComparisonV2] ⚠️ Merge stack empty, nothing to record');
      return safeState;
    }
    
    const [currentMerge, ...restStack] = safeState.mergeStack;
    console.log('[recordMergeComparisonV2] 📊 Current merge state:', {
      leftList: currentMerge.leftList,
      rightList: currentMerge.rightList,
      leftIdx: currentMerge.leftIdx,
      rightIdx: currentMerge.rightIdx,
      merged: currentMerge.merged,
      restStackLength: restStack.length
    });
    
    // Determine which list the winner came from
    const winnerFromLeft = currentMerge.leftList[currentMerge.leftIdx] === winnerId;
    
    // Add winner to merged list
    const newMerged = [...currentMerge.merged, winnerId];
    
    // Advance the appropriate index
    let newLeftIdx = currentMerge.leftIdx;
    let newRightIdx = currentMerge.rightIdx;
    
    if (winnerFromLeft) {
      newLeftIdx++;
    } else {
      newRightIdx++;
    }
    
    // Check if merge is complete
    const leftDone = newLeftIdx >= currentMerge.leftList.length;
    const rightDone = newRightIdx >= currentMerge.rightList.length;
    
    if (leftDone || rightDone) {
      // One list exhausted, add remaining from the other
      const finalMerged = [
        ...newMerged,
        ...(leftDone ? [] : currentMerge.leftList.slice(newLeftIdx)),
        ...(rightDone ? [] : currentMerge.rightList.slice(newRightIdx))
      ];
      
      console.log('[recordMergeComparisonV2] ✅ Merge complete! Final merged:', finalMerged);
      console.log('[recordMergeComparisonV2] 📊 Completed lists so far:', safeState.completedSortedLists);
      console.log('[recordMergeComparisonV2] 📊 Remaining merges in stack:', restStack.length);
      
      // Add this completed merge to the list of completed sorted lists
      const updatedCompletedLists = [...safeState.completedSortedLists, finalMerged];
      
      // If we have incomplete merges in restStack, we need to continue them
      // Only when all merges at the current level are done, we create the next level
      if (restStack.length === 0) {
        // All merges at this level are complete - create next level merges
        console.log('[recordMergeComparisonV2] 🎉 All merges at this level complete! Creating next level...');
        console.log('[recordMergeComparisonV2] 📋 All completed lists:', updatedCompletedLists);
        
        const newMergeStack: MergeOperation[] = [];
        for (let i = 0; i < updatedCompletedLists.length; i += 2) {
          const left = updatedCompletedLists[i];
          const right = updatedCompletedLists[i + 1];
          if (left && right) {
            newMergeStack.push({
              leftList: left,
              rightList: right,
              leftIdx: 0,
              rightIdx: 0,
              merged: []
            });
          }
        }
        
        console.log('[recordMergeComparisonV2] 📊 Created', newMergeStack.length, 'new merge operations for next level');
        
        // If only one list remains, that's our final sorted list (keep it in completedSortedLists)
        // Otherwise, clear completed lists and start new level
        return {
          ...safeState,
          mergeStack: newMergeStack,
          completedSortedLists: updatedCompletedLists.length === 1 ? updatedCompletedLists : [],
          comparedCount: safeState.comparedCount + 1
        };
      } else {
        // Still have incomplete merges - keep track of all completed merges
        console.log('[recordMergeComparisonV2] ⏸️ Merge complete but', restStack.length, 'merges remaining');
        
        return {
          ...safeState,
          mergeStack: restStack,
          completedSortedLists: updatedCompletedLists, // Store ALL completed merges
          comparedCount: safeState.comparedCount + 1
        };
      }
    }
    
    // Continue current merge
    const updatedMerge: MergeOperation = {
      ...currentMerge,
      leftIdx: newLeftIdx,
      rightIdx: newRightIdx,
      merged: newMerged
    };
    
    return {
      ...safeState,
      mergeStack: [updatedMerge, ...restStack],
      comparedCount: safeState.comparedCount + 1
    };
  };
  
  // Simplified wrapper functions for the game
  const getMergeSortStateFromStorage = (): MergeSortStateV2 | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('bookMergeSortState');
      if (!stored) return null;
      const parsed = JSON.parse(stored) as any;
      
      // Migrate old state format (sortedBooks) to new format (completedSortedLists)
      if (parsed.sortedBooks && !parsed.completedSortedLists) {
        console.log('[getMergeSortStateFromStorage] 🔄 Migrating old state format...');
        return {
          mergeStack: parsed.mergeStack || [],
          completedSortedLists: parsed.sortedBooks && parsed.sortedBooks.length > 0 
            ? [parsed.sortedBooks] 
            : [],
          comparedCount: parsed.comparedCount || 0
        };
      }
      
      // Ensure completedSortedLists exists (handle undefined/null)
      if (!parsed.completedSortedLists) {
        parsed.completedSortedLists = [];
      }
      
      return parsed as MergeSortStateV2;
    } catch {
      return null;
    }
  };
  
  const saveMergeSortStateToStorage = (state: MergeSortStateV2) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('bookMergeSortState', JSON.stringify(state));
    } catch (err) {
      console.warn('[saveMergeSortStateToStorage] Failed to save:', err);
    }
  };
  
  // Efficiently add a new book to the merge sort game state
  const addBookToMergeSortState = (bookId: string) => {
    console.log('[addBookToMergeSortState] 📚 Adding book to merge sort state:', bookId);
    
    const state = getMergeSortStateFromStorage();
    
    // If no state exists, don't create one - it will be initialized when game starts
    if (!state) {
      console.log('[addBookToMergeSortState] ℹ️ No merge sort state found - will be initialized when game starts');
      return;
    }
    
    // Check if book already exists in any list
    const bookExists = 
      state.mergeStack.some(op => 
        op.leftList.includes(bookId) || 
        op.rightList.includes(bookId) || 
        op.merged.includes(bookId)
      ) ||
      (state.completedSortedLists || []).some(list => list.includes(bookId));
    
    if (bookExists) {
      console.log('[addBookToMergeSortState] ℹ️ Book already in merge sort state');
      return;
    }
    
    // If game is complete (only 1 list and empty stack), add book as singleton
    // It will be naturally included in future games
    if (state.mergeStack.length === 0 && state.completedSortedLists?.length === 1) {
      console.log('[addBookToMergeSortState] ✅ Game complete - adding book as singleton for future merges');
      const updatedState = {
        ...state,
        completedSortedLists: [...(state.completedSortedLists || []), [bookId]]
      };
      saveMergeSortStateToStorage(updatedState);
      return;
    }
    
    // If game is in progress, add book as singleton to completedSortedLists
    // This is the most efficient - it will naturally merge at the current level
    // If all merges at current level are done, it will be included in the next level
    console.log('[addBookToMergeSortState] ✅ Adding book as singleton to completedSortedLists');
    const updatedState = {
      ...state,
      completedSortedLists: [...(state.completedSortedLists || []), [bookId]]
    };
    saveMergeSortStateToStorage(updatedState);
  };
  
  // Clean merge sort state by removing book IDs that no longer exist
  const cleanMergeSortState = (state: MergeSortStateV2, availableBookIds: Set<string>): MergeSortStateV2 => {
    // Filter merge stack operations
    const cleanedMergeStack = state.mergeStack
      .map(op => ({
        ...op,
        leftList: op.leftList.filter(id => availableBookIds.has(id)),
        rightList: op.rightList.filter(id => availableBookIds.has(id)),
        merged: op.merged.filter(id => availableBookIds.has(id))
      }))
      .filter(op => op.leftList.length > 0 && op.rightList.length > 0); // Remove operations with empty lists
    
    // Filter completed sorted lists
    const cleanedCompletedLists = (state.completedSortedLists || [])
      .map(list => list.filter(id => availableBookIds.has(id)))
      .filter(list => list.length > 0); // Remove empty lists
    
    return {
      ...state,
      mergeStack: cleanedMergeStack,
      completedSortedLists: cleanedCompletedLists
    };
  };

  // Get next pair to compare (merge sort approach)
  const getNextMergePair = (availableBooks: BookWithRatings[]): [BookWithRatings, BookWithRatings] | null => {
    let state = getMergeSortStateFromStorage();
    
    // Create set of available book IDs for quick lookup
    const availableBookIds = new Set(availableBooks.map(b => b.id));
    
    // Initialize if needed
    if (!state) {
      console.log('[getNextMergePair] 🎮 No state found, initializing...');
      state = initializeMergeSortV2(availableBooks);
      saveMergeSortStateToStorage(state);
    } else {
      // Clean state to remove any book IDs that no longer exist
      const cleanedState = cleanMergeSortState(state, availableBookIds);
      if (JSON.stringify(cleanedState) !== JSON.stringify(state)) {
        console.log('[getNextMergePair] 🧹 Cleaned merge sort state - removed missing books');
        state = cleanedState;
        saveMergeSortStateToStorage(state);
      }
    }
    
    // If mergeStack is empty but we have multiple completed lists, create new merge operations
    if (state.mergeStack.length === 0 && (state.completedSortedLists || []).length > 1) {
      console.log('[getNextMergePair] 🔄 Merge stack empty but multiple completed lists found, creating new merge operations...');
      const completedLists = state.completedSortedLists || [];
      const newMergeStack: MergeOperation[] = [];
      
      // Create merge operations from pairs of completed lists
      for (let i = 0; i < completedLists.length; i += 2) {
        const left = completedLists[i];
        const right = completedLists[i + 1];
        if (left && right && left.length > 0 && right.length > 0) {
          newMergeStack.push({
            leftList: left,
            rightList: right,
            leftIdx: 0,
            rightIdx: 0,
            merged: []
          });
        }
      }
      
      // If there's an odd list left (no pair), keep it in completedSortedLists for next level
      const hasOddList = completedLists.length % 2 === 1;
      const remainingCompletedList = hasOddList && completedLists[completedLists.length - 1].length > 0 
        ? [completedLists[completedLists.length - 1]] 
        : [];
      
      console.log('[getNextMergePair] 📊 Created', newMergeStack.length, 'new merge operations', hasOddList ? '(1 list left unpaired)' : '');
      
      // Update state with new merge stack
      state = {
        ...state,
        mergeStack: newMergeStack,
        completedSortedLists: remainingCompletedList
      };
      saveMergeSortStateToStorage(state);
    }
    
    let comparison = getNextComparisonFromMerge(state);
    
    if (!comparison) {
      // Don't log when checking button state - only log when actually playing
      return null; // Sorting complete or needs state update
    }
    
    const book1 = availableBooks.find(b => b.id === comparison.leftId);
    const book2 = availableBooks.find(b => b.id === comparison.rightId);
    
    if (!book1 || !book2) {
      // Books not found - clean state and return null
      console.warn('[getNextMergePair] ⚠️ Books not found, cleaning state:', { leftId: comparison.leftId, rightId: comparison.rightId });
      const cleanedState = cleanMergeSortState(state, availableBookIds);
      saveMergeSortStateToStorage(cleanedState);
      return null;
    }
    
    console.log('[getNextMergePair] ✅ Returning pair:', { book1: book1.title, book2: book2.title });
    return [book1, book2];
  };
  
  // Update comparison results when a book is manually moved in the results list
  const updateComparisonResultsForManualMove = (movedBookId: string, newIndex: number, sortedBooks: BookWithRatings[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('bookComparisonResults');
      const results: { [key: string]: { beats: string[]; losesTo: string[] } } = stored ? JSON.parse(stored) : {};
      
      // Ensure the moved book has an entry
      if (!results[movedBookId]) {
        results[movedBookId] = { beats: [], losesTo: [] };
      }
      
      // Update comparisons: the moved book beats all books below it (higher index)
      // and loses to all books above it (lower index)
      sortedBooks.forEach((book, index) => {
        if (book.id === movedBookId) return; // Skip the moved book itself
        
        // Ensure this book has an entry
        if (!results[book.id]) {
          results[book.id] = { beats: [], losesTo: [] };
        }
        
        if (index < newIndex) {
          // Book is above the moved book - moved book loses to it
          if (!results[movedBookId].losesTo.includes(book.id)) {
            results[movedBookId].losesTo.push(book.id);
          }
          if (!results[book.id].beats.includes(movedBookId)) {
            results[book.id].beats.push(movedBookId);
          }
        } else if (index > newIndex) {
          // Book is below the moved book - moved book beats it
          if (!results[movedBookId].beats.includes(book.id)) {
            results[movedBookId].beats.push(book.id);
          }
          if (!results[book.id].losesTo.includes(movedBookId)) {
            results[book.id].losesTo.push(movedBookId);
          }
        }
      });
      
      localStorage.setItem('bookComparisonResults', JSON.stringify(results));
      console.log('[updateComparisonResultsForManualMove] ✅ Updated comparison results for manual move');
    } catch (err) {
      console.warn('[updateComparisonResultsForManualMove] Failed to update comparison results:', err);
    }
  };

  // Record comparison (merge sort approach)
  const recordMergeComparisonForGame = (winnerId: string, loserId: string, availableBooks: BookWithRatings[]) => {
    console.log('[recordMergeComparisonForGame] 🎮 Recording game comparison:', { winnerId, loserId });
    
    let state = getMergeSortStateFromStorage();
    
    if (!state) {
      console.log('[recordMergeComparisonForGame] 🎮 No state found, initializing...');
      state = initializeMergeSortV2(availableBooks);
    }
    
    // Store comparison result for sorting
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('bookComparisonResults');
        const results: { [key: string]: { beats: string[]; losesTo: string[] } } = stored ? JSON.parse(stored) : {};
        
        if (!results[winnerId]) results[winnerId] = { beats: [], losesTo: [] };
        if (!results[loserId]) results[loserId] = { beats: [], losesTo: [] };
        
        if (!results[winnerId].beats.includes(loserId)) {
          results[winnerId].beats.push(loserId);
        }
        if (!results[loserId].losesTo.includes(winnerId)) {
          results[loserId].losesTo.push(winnerId);
        }
        
        localStorage.setItem('bookComparisonResults', JSON.stringify(results));
      } catch (err) {
        console.warn('[recordMergeComparisonForGame] Failed to save comparison result:', err);
      }
    }
    
    const newState = recordMergeComparisonV2(winnerId, loserId, state);
    console.log('[recordMergeComparisonForGame] 💾 Saving new state:', {
      mergeStackLength: newState.mergeStack.length,
      completedSortedListsLength: newState.completedSortedLists?.length || 0,
      comparedCount: newState.comparedCount
    });
    saveMergeSortStateToStorage(newState);
  };
  
  // Get comparison results from localStorage
  const getComparisonResultsFromState = (): { [bookId: string]: { beats: Set<string>; losesTo: Set<string> } } => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('bookComparisonResults');
      if (!stored) return {};
      const parsed = JSON.parse(stored) as { [key: string]: { beats: string[]; losesTo: string[] } };
      // Convert arrays back to Sets
      const results: { [bookId: string]: { beats: Set<string>; losesTo: Set<string> } } = {};
      for (const [bookId, data] of Object.entries(parsed)) {
        results[bookId] = {
          beats: new Set(data.beats || []),
          losesTo: new Set(data.losesTo || [])
        };
      }
      return results;
    } catch {
      return {};
    }
  };
  
  // Get sorted books based on comparison results
  const getSortedBooks = (availableBooks: BookWithRatings[]): BookWithRatings[] => {
    // Get comparison results from localStorage
    const comparisonResults = getComparisonResultsFromState();
    
    // Calculate win/loss scores for each book
    const scores: { [bookId: string]: number } = {};
    availableBooks.forEach(book => {
      scores[book.id] = 0;
    });
    
    // Count wins (books this book beats)
    Object.entries(comparisonResults).forEach(([bookId, data]) => {
      scores[bookId] = (scores[bookId] || 0) + data.beats.size;
    });
    
    // Sort by score (descending) - books with more wins rank higher
    const sorted = [...availableBooks].sort((a, b) => {
      const scoreA = scores[a.id] || 0;
      const scoreB = scores[b.id] || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA; // Higher score first
      }
      // If scores are equal, use comparison results to break ties
      const aBeatsB = comparisonResults[a.id]?.beats.has(b.id);
      const bBeatsA = comparisonResults[b.id]?.beats.has(a.id);
      if (aBeatsB) return -1;
      if (bBeatsA) return 1;
      return 0;
    });
    
    return sorted;
  };
  
  // Get total comparisons needed (for progress)
  const getTotalMergeComparisons = (n: number): number => {
    // Merge sort requires approximately n * log2(n) comparisons
    return Math.ceil(n * Math.log2(n));
  };
  
  // Get current comparison count
  const getCurrentComparisonCount = (): number => {
    const state = getMergeSortStateFromStorage();
    return state?.comparedCount || 0;
  };

  // Check if there are unranked books (books without comparison results)
  const hasUnrankedBooks = (availableBooks: BookWithRatings[]): boolean => {
    const comparisonResults = getComparisonResultsFromState();
    const rankedBookIds = new Set(Object.keys(comparisonResults));
    
    // A book is ranked if it has at least one comparison (beats or losesTo)
    for (const book of availableBooks) {
      const hasComparisons = 
        comparisonResults[book.id] && 
        (comparisonResults[book.id].beats.size > 0 || comparisonResults[book.id].losesTo.size > 0);
      
      if (!hasComparisons) {
        return true; // Found an unranked book
      }
    }
    
    return false; // All books are ranked
  };
  // Podcast source selector removed - now always fetches from both sources

  // Spoiler revealed load/persist effects moved to useBookDetailData hook

  // Detect screenshot mode from URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isScreenshot = params.get('screenshot') === '1';
      const overlayText = params.get('text');
      console.log('[Screenshot Mode] Checking URL params:', { isScreenshot, overlayText, search: window.location.search });
      if (isScreenshot) {
        setScreenshotMode(true);
        // Also mark intro as seen to prevent about screen from showing
        if (user) localStorage.setItem(`hasSeenIntro_${user.id}`, 'true');
        if (overlayText) {
          setScreenshotOverlayText(decodeURIComponent(overlayText));
        }
      }
    }
  }, []);

  // Load books from Supabase (with stale-while-revalidate cache)
  useEffect(() => {
    if (authLoading) return;

    // If no user, mark as loaded so we can show login screen
    if (!user) {
      setIsLoaded(true);
      return;
    }

    // Show cached books instantly
    const savedBookId = typeof window !== 'undefined' ? localStorage.getItem('lastSelectedBookId') : null;
    const cachedBooks = getCached<any[]>(CACHE_KEYS.books(user.id));
    if (cachedBooks && cachedBooks.length > 0) {
      setBooks(cachedBooks);
      if (savedBookId) {
        const idx = cachedBooks.findIndex((b: any) => b.id === savedBookId);
        if (idx >= 0) setSelectedIndex(idx);
      }
      setIsLoaded(true);
    }

    async function loadBooks() {
      try {
        // Verify we have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !user) {
          console.error('No session or user found when loading books');
          setIsLoaded(true);
          return;
        }

        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('user_id', user.id) // Explicitly filter by current user
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error loading books:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          throw error;
        }

        const appBooks = (data || []).map(convertBookToApp);
        setBooks(appBooks);
        setCache(CACHE_KEYS.books(user.id), appBooks);

        // Fetch my following count
        const { count: followingCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', user.id);
        setMyFollowingCount(followingCount || 0);

        // Restore selected book by ID (stable across reorders/additions)
        if (appBooks.length > 0 && savedBookId) {
          const idx = appBooks.findIndex(b => b.id === savedBookId);
          setSelectedIndex(idx >= 0 ? idx : 0);
        } else if (appBooks.length === 0) {
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Error loading books:', err);
      } finally {
        setIsLoaded(true);
      }
    }

    loadBooks();
  }, [user, authLoading]);

  // Load another user's books when viewingUserId changes
  useEffect(() => {
    if (!viewingUserId || !user) {
      setViewingUserBooks([]);
      setViewingUserName('');
      setViewingUserFullName(null);
      setViewingUserAvatar(null);
      setViewingUserIsPrivate(false);
      setIsFollowingViewingUser(false);
      setViewingUserFollowingCount(0);
      return;
    }

    const userId = viewingUserId; // Store in local variable after null check
    const currentUserId = user.id; // Store user.id for async function

    setIsLoadingViewingUserBooks(true);

    async function loadUserBooks() {
      try {
        // First, get user info from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, full_name, avatar_url, is_public')
          .eq('id', userId)
          .single();

        if (!userError && userData) {
          setViewingUserFullName(userData.full_name);
          setViewingUserAvatar(userData.avatar_url);
          setViewingUserName(userData.full_name || userData.email || userId);
          setViewingUserIsPrivate(userData.is_public === false);
        } else {
          // Fallback if users table doesn't have the user
          const emailMatch = userId.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
          setViewingUserName(emailMatch ? userId.split('@')[0] : userId.substring(0, 8));
          setViewingUserFullName(null);
          setViewingUserAvatar(null);
          setViewingUserIsPrivate(false);
        }

        // If the user is private, don't load their books
        if (userData?.is_public === false) {
          setViewingUserBooks([]);
          setIsLoadingViewingUserBooks(false);
          return;
        }

        // Check if current user follows this user
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', userId)
          .single();

        setIsFollowingViewingUser(!!followData);

        // Get viewed user's following count
        const { count: viewedUserFollowingCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId);
        setViewingUserFollowingCount(viewedUserFollowingCount || 0);

        // Then get their books
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading user books:', error);
          setIsLoadingViewingUserBooks(false);
          return;
        }

        const appBooks = (data || []).map(convertBookToApp);
        setViewingUserBooks(appBooks);
      } catch (err) {
        console.error('Error loading user books:', err);
      } finally {
        setIsLoadingViewingUserBooks(false);
      }
    }

    loadUserBooks();
  }, [viewingUserId, user]);

  // Set default view to bookshelf covers when user has no books (first-time user)
  useEffect(() => {
    if (isLoaded && books.length === 0 && !showBookshelfCovers && !showNotesView && !showAccountPage && !showFollowingPage) {
      // First-time user: default to bookshelf covers view
      setShowBookshelfCovers(true);
      // BookshelfView initializes bookshelfGrouping from localStorage (default: 'reading_status')
    }
  }, [isLoaded, books.length, showBookshelfCovers, showNotesView, showAccountPage]);

  // Show intro screen for new users who haven't seen it (per-account)
  useEffect(() => {
    if (isLoaded && user && books.length === 0) {
      const introKey = `hasSeenIntro_${user.id}`;
      const hasSeenIntro = localStorage.getItem(introKey);
      console.log('[Intro Debug] Checking intro:', { isLoaded, userId: user.id, booksLength: books.length, hasSeenIntro });
      if (!hasSeenIntro) {
        console.log('[Intro Debug] Showing intro screen for new user');
        setShowAboutScreen(true);
      }
    }
  }, [isLoaded, user, books.length]);

  // Load content preferences from Supabase
  useEffect(() => {
    if (!user) return;
    supabase.from('users').select('content_preferences').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data?.content_preferences) {
        const prefs = data.content_preferences;
        if (!prefs._order) prefs._order = ['fun_facts', 'podcasts', 'youtube', 'related_work', 'articles'];
        setContentPreferences(prefs);
        localStorage.setItem('contentPreferences', JSON.stringify(prefs));
      }
    });
  }, [user?.id]);

  // Load nudge banner dismissed state for anonymous users
  useEffect(() => {
    if (!isAnonymous) return;
    storageGet('nudge_banner_dismissed').then((val) => {
      setNudgeBannerDismissed(val === 'true');
    });
  }, [isAnonymous]);

  // Check for migrated books count after reload (set by AuthContext migration)
  useEffect(() => {
    const count = localStorage.getItem('migrated_books_count');
    if (count) {
      localStorage.removeItem('migrated_books_count');
      setMigratedBooksCount(parseInt(count, 10));
    }
  }, []);

  // Save page state to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      savePageState({
        showBookshelfCovers,
        showNotesView,
        showAccountPage,
        showFollowingPage,
        showFeedPage,
      });
    }
  }, [isLoaded, showBookshelfCovers, showNotesView, showAccountPage, showFollowingPage, showFeedPage]);

  // Analytics: track view changes
  useEffect(() => {
    if (showBookshelfCovers) analytics.trackEvent('bookshelf', 'view', { view_type: 'covers', book_count: books.length });
  }, [showBookshelfCovers]);

  useEffect(() => {
    if (showFeedPage) analytics.trackView('feed');
  }, [showFeedPage]);

  useEffect(() => {
    if (!showBookshelfCovers && !showFeedPage && !showAccountPage && !showFollowingPage && !showNotesView && !showChatPage && books.length > 0 && selectedIndex >= 0 && selectedIndex < books.length) {
      const book = books[selectedIndex];
      if (book) analytics.trackEvent('book', 'view', { book_title: book.title, book_author: book.author });
    }
  }, [selectedIndex, showBookshelfCovers, showFeedPage, showAccountPage, showFollowingPage, showNotesView, showChatPage]);

  // Android hardware back button
  const backButtonStateRef = useRef({
    showAboutScreen, isAdding, showShareDialog, showBookMenu,
    isEditing, isShowingNotes, isConfirmingDelete,
    showAccountPage, showFollowingPage, showFeedPage, showChatPage, chatBookSelected, showCreatePost, showSortingResults, showNotesView,
    showBookshelfCovers,
  });
  useEffect(() => {
    backButtonStateRef.current = {
      showAboutScreen, isAdding, showShareDialog, showBookMenu,
      isEditing, isShowingNotes, isConfirmingDelete,
      showAccountPage, showFollowingPage, showFeedPage, showChatPage, chatBookSelected, showCreatePost, showSortingResults, showNotesView,
      showBookshelfCovers,
    };
  });
  useEffect(() => {
    return listenForBackButton(() => {
      const s = backButtonStateRef.current;
      // 1. Dismiss modals/overlays (topmost first)
      if (triviaGameRef.current?.isPlaying) { triviaGameRef.current.close(); return; }
      if (s.showAboutScreen) { setShowAboutScreen(false); return; }
      if (s.isAdding) { setIsAdding(false); return; }
      if (s.showShareDialog) { setShowShareDialog(false); return; }
      if (s.showBookMenu) { setShowBookMenu(false); return; }
      if (s.isConfirmingDelete) { setIsConfirmingDelete(false); return; }
      // 2. Close inline overlays on book detail
      if (s.isEditing) { setIsEditing(false); return; }
      if (s.isShowingNotes) { setIsShowingNotes(false); return; }
      // 3. Sub-pages → back to previous view
      if (s.showAccountPage) { restorePreviousView(); return; }
      if (s.showFollowingPage) { setShowFollowingPage(false); setShowBookshelfCovers(true); return; }
      if (s.showFeedPage) { setShowFeedPage(false); setShowBookshelfCovers(true); return; }
      if (s.showChatPage && s.chatBookSelected) {
        setChatBookSelected(false); setChatGeneralMode(false); setCharacterChatContext(null); updateScrollY(0);
        if (chatOpenedFromBookPage.current) { chatOpenedFromBookPage.current = false; setShowChatPage(false); }
        return;
      }
      if (s.showChatPage) { setShowChatPage(false); return; }
      if (s.showCreatePost) { setShowCreatePost(false); setShowBookshelfCovers(true); return; }
      if (s.showSortingResults) { setShowSortingResults(false); setShowBookshelfCovers(true); return; }
      if (s.showNotesView) { setShowNotesView(false); setShowBookshelfCovers(true); return; }
      // 4. Book detail → bookshelf covers
      if (!s.showBookshelfCovers) { setShowBookshelfCovers(true); return; }
      // 5. Spines view → covers view
      // 6. At root (bookshelf covers) → exit app
      exitApp();
    });
  }, []);

  // Load chat list when entering chat page (stale-while-revalidate)
  useEffect(() => {
    if (!showChatPage || chatBookSelected || !user) return;
    let cancelled = false;

    // Show cached chat list instantly
    const cachedList = getCached<ChatListItem[]>(CACHE_KEYS.chatList(user.id));
    const cachedCharList = getCached<CharacterChatListItem[]>(CACHE_KEYS.characterChatList(user.id));
    if (cachedList && cachedList.length > 0 && chatList.length === 0) {
      setChatList(cachedList);
      if (cachedCharList) setCharacterChatList(cachedCharList);
      setChatListLoading(false);
    } else {
      setChatListLoading(true);
    }

    // Fetch fresh in background
    (async () => {
      const [list, charList] = await Promise.all([getChatList(), getCharacterChatList()]);
      if (cancelled) return;
      // Enrich orphaned chats (deleted books) with cover URLs from cache
      const bookIds = new Set(books.map(b => b.id));
      const orphaned = list.filter(c => c.book_id !== '00000000-0000-0000-0000-000000000000' && !bookIds.has(c.book_id));
      if (orphaned.length > 0) {
        const coverMap = await lookupOrphanedChatCoverUrls(orphaned);
        for (const chat of orphaned) {
          const cover = coverMap.get(chat.book_title.toLowerCase().trim());
          if (cover) chat.cover_url = cover;
        }
      }
      setChatList(list);
      setCharacterChatList(charList);
      setCache(CACHE_KEYS.chatList(user.id), list);
      setCache(CACHE_KEYS.characterChatList(user.id), charList);
      setChatListLoading(false);
    })();
    return () => { cancelled = true; };
  }, [showChatPage, chatBookSelected]);

  // Proactive messages — check on app mount and resume from background
  const proactiveCheckedRef = useRef(false);
  const proactiveRunningRef = useRef(false);

  useEffect(() => {
    if (!user || books.length === 0) return;

    async function checkProactive() {
      if (proactiveRunningRef.current) return;
      proactiveRunningRef.current = true;
      try {
        const list = await getChatList();
        const candidates = await getProactiveCandidates(list, books);
        if (candidates.length === 0) return;

        // Prioritize currently-reading, then general — process up to 2
        const sorted = [...candidates.filter(c => c.chatType === 'book'), ...candidates.filter(c => c.chatType === 'general')];
        let generated = 0;

        for (const candidate of sorted) {
          if (generated >= 2) break;
          let ctx: BookChatContext;
          if (candidate.chatType === 'general') {
            ctx = {
              title: 'My Bookshelf',
              author: '',
              readingStatus: null,
              generalMode: true,
              summary: `The user's bookshelf contains ${books.length} books:\n${books.map(b => {
                const parts = [`- "${b.title}" by ${b.author}`];
                if (b.reading_status) parts.push(`(${b.reading_status.replace('_', ' ')})`);
                return parts.join(' ');
              }).join('\n')}`,
            };
          } else {
            const book = books.find(b => b.id === candidate.bookId);
            ctx = {
              title: candidate.bookTitle,
              author: candidate.bookAuthor,
              readingStatus: book?.reading_status || null,
            };
            if (book) {
              const cached = podcastEpisodes.get(book.id);
              const pods = [...(cached?.curated || []), ...(cached?.apple || [])];
              if (pods.length) ctx.podcasts = pods.map(p => ({ title: p.title, podcast_name: p.podcast_name, url: p.url, thumbnail: p.thumbnail, length: p.length, audioUrl: p.audioUrl }));
              const vids = youtubeVideos.get(book.id);
              if (vids?.length) ctx.videos = vids.map(v => ({ title: v.title, channelTitle: v.channelTitle, videoId: v.videoId }));
              const movies = relatedMovies.get(book.id);
              if (movies?.length) ctx.relatedWorks = movies.map(m => ({ title: m.title, director: m.director, reason: m.reason, type: m.type, poster_url: m.poster_url, release_year: m.release_year, wikipedia_url: m.wikipedia_url, itunes_url: m.itunes_url, itunes_artwork: m.itunes_artwork, music_links: m.music_links }));
            }
          }
          const proactiveMsg = await generateProactiveMessage(ctx, candidate.chatKey, candidate.bookId, candidate.bookTitle, candidate.bookAuthor);
          if (proactiveMsg) {
            generated++;
            const key = candidate.chatType === 'general' ? '00000000-0000-0000-0000-000000000000' : candidate.bookId;
            setUnreadChatCounts(prev => { const next = new Map(prev); next.set(key, (next.get(key) || 0) + 1); return next; });
          }
        }
        if (generated > 0) {
          const refreshed = await getChatList();
          setChatList(refreshed);
        }
      } catch (err) {
        console.error('[proactive] Error:', err);
      } finally {
        proactiveRunningRef.current = false;
      }
    }

    // Run once on mount (after books load)
    if (!proactiveCheckedRef.current) {
      proactiveCheckedRef.current = true;
      checkProactive();
    }

    // Run on app resume from background
    const handleVisibilityChange = () => {
      if (!document.hidden) checkProactive();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let resumeListener: any;
    (async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        resumeListener = await CapApp.addListener('resume', () => checkProactive());
      } catch {}
    })();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resumeListener?.remove();
    };
  }, [user, books.length > 0]);



  // All hooks must be called before any conditional returns
  const activeBook = books[selectedIndex] || null;
  const [editingDimension, setEditingDimension] = useState<typeof RATING_DIMENSIONS[number] | null>(null);

  // Book detail data hook — all data fetching state, effects, and memos for book detail page
  const {
    bookInfluences,
    bookDomain,
    bookContext,
    didYouKnow,
    podcastEpisodes,
    analysisArticles,
    youtubeVideos,
    relatedBooks,
    relatedMovies,
    researchData,
    bookSummaries,
    characterAvatars,
    bookInfographics,
    loadingFactsForBookId,
    loadingInfluencesForBookId,
    loadingDomainForBookId,
    loadingContextForBookId,
    loadingDidYouKnowForBookId,
    loadingPodcastsForBookId,
    loadingAnalysisForBookId,
    loadingVideosForBookId,
    loadingRelatedForBookId,
    loadingRelatedMoviesForBookId,
    loadingResearchForBookId,
    loadingSummaryForBookId,
    loadingAvatarsForBookId,
    loadingInfographicForBookId,
    selectedInsightCategory,
    setSelectedInsightCategory,
    isInsightCategoryDropdownOpen,
    setIsInsightCategoryDropdownOpen,
    spotlightIndex,
    setSpotlightIndex,
    spoilerRevealed,
    setSpoilerRevealed,
    setBookSummaries,
    setCharacterAvatars,
    setBookInfographics,
    retryCharacterAvatars,
    combinedPodcastEpisodes,
    bookDetailInsightsState,
    activeVideos,
    activeArticles,
    activeRelatedMovies,
    activeRelatedBooks,
    spotlightRecommendation,
  } = useBookDetailData({
    activeBook,
    books,
    selectedIndex,
    setBooks,
    user,
    contentPreferences,
    featureFlags,
  });

  // Memoize filtered feed items for pagination
  // combinedPodcastEpisodes now comes from useBookDetailData hook

  // No all-or-nothing gate for book page sections — each section independently
  // manages its own loading skeleton so one slow/failing service never blocks the rest.

  // bookDetailInsightsState now comes from useBookDetailData hook

  // activeVideos, activeArticles, activeRelatedMovies, activeRelatedBooks now come from useBookDetailData hook

  function toggleHeartAction(contentHash: string): void {
    void handleToggleHeart(contentHash);
  }

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
  } = useBookDetailCardCallbacks({
    currentInsights: bookDetailInsightsState.currentInsights,
    combinedPodcastEpisodes,
    activeVideos,
    activeArticles,
    activeRelatedMovies,
    activeRelatedBooks,
    heartCounts,
    userHearted,
    getContentHash,
    onToggleHeart: toggleHeartAction,
    handlePinForLater,
    isContentPinned,
  });

  // Spotlight state moved to useBookDetailData hook

  // Save bookshelf grouping preference — moved to BookshelfView

  // Save selected book ID to localStorage (not index — index is fragile across reloads)
  useEffect(() => {
    if (typeof window !== 'undefined' && books.length > 0 && selectedIndex >= 0 && selectedIndex < books.length) {
      localStorage.setItem('lastSelectedBookId', books[selectedIndex].id);
    }
  }, [selectedIndex, books]);

  // Expose one-time feed backfill on window (run window.backfillFeed() in console)
  useEffect(() => {
    if (typeof window === 'undefined' || !user || books.length === 0) return;
    (window as any).backfillFeed = async () => {
      console.log(`[backfillFeed] Starting backfill for ${books.length} books...`);
      let totalCreated = 0;
      let totalErrors: string[] = [];
      for (let i = 0; i < books.length; i++) {
        const book = books[i];
        console.log(`[backfillFeed] (${i + 1}/${books.length}) ${book.title}...`);
        const result = await generateFeedItemsForBook(
          user.id,
          book.id,
          book.title,
          book.author || '',
          book.cover_url || null,
          book.reading_status || null,
          book.created_at
        );
        totalCreated += result.created;
        totalErrors.push(...result.errors);
      }
      console.log(`[backfillFeed] ✅ Done! Created ${totalCreated} feed items across ${books.length} books (${totalErrors.length} errors)`);
      if (totalErrors.length > 0) console.warn('[backfillFeed] Errors:', totalErrors);
      return { totalCreated, totalErrors };
    };
    return () => { delete (window as any).backfillFeed; };
  }, [user, books]);

  // getAlphabeticalRange moved to BookshelfView

  // Update a book's lists (optimistic update) — supports single or batch
  const handleUpdateBookLists = async (bookId: string | string[], lists: string[]) => {
    if (!user) return;
    const bookIds = Array.isArray(bookId) ? bookId : [bookId];
    // Enforce Top 5 max limit
    if (lists.includes(DEFAULT_LIST)) {
      const currentTop5Count = books.filter(b => b.lists?.includes(DEFAULT_LIST) && !bookIds.includes(b.id)).length;
      if (currentTop5Count >= 5) {
        lists = lists.filter(l => l !== DEFAULT_LIST);
      }
    }
    const prevBooks = [...books];
    setBooks(prev => prev.map(b => bookIds.includes(b.id) ? { ...b, lists } : b));
    const now = new Date().toISOString();
    const results = await Promise.all(
      bookIds.map(id =>
        supabase
          .from('books')
          .update({ lists, updated_at: now })
          .eq('id', id)
          .eq('user_id', user.id)
      )
    );
    if (results.some(r => r.error)) {
      console.error('[handleUpdateBookLists] Error in batch update:', results.filter(r => r.error).map(r => r.error));
      setBooks(prevBooks);
    }
  };

  // Group books for bookshelf view based on selected grouping
  // Determine which books to use for bookshelf display
  const booksForBookshelf = viewingUserId ? viewingUserBooks : books;

  // Default list that always exists and cannot be deleted
  const DEFAULT_LIST = 'Top 5';

  // allListNames moved to BookshelfView

  // groupedBooksForBookshelf moved to BookshelfView

  // When editing, show the first dimension that needs rating, or first dimension if all are rated
  const currentEditingDimension = useMemo((): typeof RATING_DIMENSIONS[number] | null => {
    if (!activeBook || !isEditing || selectingReadingStatusInRating) return null;
    if (editingDimension) return editingDimension;
    // Find first unrated dimension, or default to first dimension
    return RATING_DIMENSIONS.find(d => activeBook.ratings[d] === null) || RATING_DIMENSIONS[0];
  }, [activeBook, isEditing, editingDimension, selectingReadingStatusInRating]);
  
  const showRatingOverlay = activeBook && isEditing;
  const showReadingStatusSelection = selectingReadingStatusInRating || selectingReadingStatusForExisting;

  // Reset states on selectedIndex change — moved to BookDetailView

  // Close bookshelf grouping dropdown — moved to BookshelfView

  // Close insight category dropdown — moved to BookDetailView
  // Load note text on book change — moved to BookDetailView


  // Update background gradient when book changes
  // Disabled: always use default gradient instead of extracting from cover
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _backgroundGradientEffect = null;
  // useEffect(() => {
  //   const currentBook = books[selectedIndex];
  //   if (currentBook?.cover_url) {
  //     const prevGradient = backgroundGradient;
  //     setPreviousGradient(prevGradient);
  //     setIsGradientTransitioning(true);
  //     extractColorsFromImage(currentBook.cover_url).then(gradient => {
  //       setBackgroundGradient(gradient);
  //       setTimeout(() => { setPreviousGradient(null); setIsGradientTransitioning(false); }, 450);
  //     }).catch(() => {
  //       setBackgroundGradient('241,245,249,226,232,240');
  //       setTimeout(() => { setPreviousGradient(null); setIsGradientTransitioning(false); }, 450);
  //     });
  //   } else {
  //     const prevGradient = backgroundGradient;
  //     setPreviousGradient(prevGradient);
  //     setIsGradientTransitioning(true);
  //     setBackgroundGradient('241,245,249,226,232,240');
  //     setTimeout(() => { setPreviousGradient(null); setIsGradientTransitioning(false); }, 450);
  //   }
  // }, [selectedIndex, books]);

  // Data fetching effects (author facts, influences, domain, context, did-you-know,
  // podcasts, articles, videos, related books, related movies, summary+avatars, research,
  // and feed generation trigger) moved to useBookDetailData hook.

  // (Old data fetching effects removed — now in useBookDetailData hook)

  // Fetch book readers — moved to BookDetailView
  // Telegram topic prefetch, discussion questions, discussion reset — moved to BookDetailView

  // Feed generation trigger moved to useBookDetailData hook

  // Track if feed has been loaded to prevent reload on app resume
  const feedLoadedRef = useRef(false);

  // Load personalized feed when feed page is shown (with stale-while-revalidate cache)
  useEffect(() => {
    if (!showFeedPage || !user) return;

    // Don't reload if we already have feed items (prevents reload on app resume)
    if (feedLoadedRef.current && personalizedFeedItems.length > 0) {
      console.log('[Feed] ℹ️ Feed already loaded, skipping reload');
      return;
    }

    // Show cached feed instantly
    const cachedFeed = getCached<PersonalizedFeedItem[]>(CACHE_KEYS.feed(user.id));
    if (cachedFeed && cachedFeed.length > 0 && personalizedFeedItems.length === 0) {
      const readItems = getReadFeedItems();
      const cachedWithReadStatus = cachedFeed.map(item => ({
        ...item,
        read: readItems.has(item.id)
      }));
      setPersonalizedFeedItems(cachedWithReadStatus);
      setIsLoadingPersonalizedFeed(false);
    }

    async function loadPersonalizedFeed() {
      if (!cachedFeed || cachedFeed.length === 0) {
        setIsLoadingPersonalizedFeed(true);
      }
      try {
        console.log('[Feed] 🔄 Loading personalized feed...');
        const items = await getPersonalizedFeed(user!.id);

        // Merge read status from localStorage
        const readItems = getReadFeedItems();
        const itemsWithReadStatus = items.map(item => ({
          ...item,
          read: readItems.has(item.id)
        }));

        setPersonalizedFeedItems(itemsWithReadStatus as PersonalizedFeedItem[]);
        if (user) setCache(CACHE_KEYS.feed(user.id), items);
        feedLoadedRef.current = true;
        console.log(`[Feed] ✅ Loaded ${items.length} feed items (${readItems.size} marked as read)`);

        // Mark only first 8 items as shown
        const initialItems = items.slice(0, 8);
        if (initialItems.length > 0) {
          markFeedItemsAsShown(initialItems.map(item => item.id));
        }
      } catch (error) {
        console.error('[Feed] ❌ Error loading feed:', error);
      } finally {
        setIsLoadingPersonalizedFeed(false);
      }
    }

    loadPersonalizedFeed();
  }, [showFeedPage, user]);

  // Load heart counts for feed items
  useEffect(() => {
    if (personalizedFeedItems.length === 0) return;
    const hashes = personalizedFeedItems
      .map(item => item.content_hash)
      .filter((h): h is string => !!h);
    if (hashes.length === 0) return;
    loadHearts(user?.id || null, hashes).then(({ counts, userHearted: uh }) => {
      setHeartCounts(prev => {
        const next = new Map(prev);
        counts.forEach((v, k) => next.set(k, v));
        return next;
      });
      setUserHearted(prev => {
        const next = new Set(prev);
        uh.forEach(h => next.add(h));
        return next;
      });
    });
  }, [personalizedFeedItems, user?.id]);

  // Handle toggling a heart (stable ref for useCallback)
  const userHeartedRef = useRef(userHearted);
  userHeartedRef.current = userHearted;

  const handleToggleHeart = useCallback(async (contentHash: string) => {
    if (!user?.id) return;
    const wasHearted = userHeartedRef.current.has(contentHash);
    analytics.trackEvent('feed', 'heart', { is_hearted: !wasHearted });
    // Optimistic update
    setUserHearted(prev => {
      const next = new Set(prev);
      if (wasHearted) next.delete(contentHash);
      else next.add(contentHash);
      return next;
    });
    setHeartCounts(prev => {
      const next = new Map(prev);
      const current = next.get(contentHash) || 0;
      next.set(contentHash, wasHearted ? Math.max(0, current - 1) : current + 1);
      return next;
    });
    // Persist
    try {
      await toggleHeart(user.id, contentHash);
    } catch {
      // Revert on error
      setUserHearted(prev => {
        const next = new Set(prev);
        if (wasHearted) next.add(contentHash);
        else next.delete(contentHash);
        return next;
      });
      setHeartCounts(prev => {
        const next = new Map(prev);
        const current = next.get(contentHash) || 0;
        next.set(contentHash, wasHearted ? current + 1 : Math.max(0, current - 1));
        return next;
      });
    }
  }, [user?.id]);

  // Helper function to generate canonical book ID (matches edge function)
  function generateCanonicalBookId(title: string, author: string): string {
    const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Extract primary author only (before & / "and" / co-author comma)
    const primaryAuthor = (a: string) => {
      let primary = a.split(/\s+&\s+|\s+and\s+/i)[0];
      const commaParts = primary.split(',');
      if (commaParts.length > 1 && commaParts[0].trim().includes(' ')) {
        primary = commaParts[0];
      }
      return primary.trim();
    };

    let normalizedTitle = stripDiacritics((title || '').toLowerCase().trim())
      .replace(/\s+/g, ' ')
      .replace(/\s*\([^)]*\)\s*/g, ' ')  // strip parentheticals
      .replace(/-/g, ' ')                 // hyphens → spaces
      .replace(/\s+/g, ' ')
      .trim();

    let normalizedAuthor = stripDiacritics((author || '').toLowerCase().trim());
    normalizedAuthor = primaryAuthor(normalizedAuthor)
      .replace(/\s+/g, ' ')
      .replace(/\.\s+/g, '.')             // collapse initial spacing
      .replace(/-/g, ' ')                 // hyphens → spaces
      .replace(/\s+/g, ' ')
      .trim();

    return `${normalizedTitle}|${normalizedAuthor}`;
  }

  // Set of canonical book keys for filtering discovery swipe
  const existingBookKeys = useMemo(() => {
    const keys = new Set<string>();
    books.forEach(b => {
      keys.add(generateCanonicalBookId(b.title, b.author || ''));
    });
    return keys;
  }, [books]);

  const ANONYMOUS_BOOK_LIMIT = 20;

  function openAddBookSheet(mode: 'default' | 'chat_picker' = 'default') {
    if (isAnonymous && books.length >= ANONYMOUS_BOOK_LIMIT) {
      setConnectAccountReason('book_limit');
      setShowConnectAccountModal(true);
      return;
    }
    setAddBookSheetMode(mode);
    setIsAdding(true);
  }

  async function handleAddBook(meta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) {
    if (!user) return;
    // Safety net: block adding beyond limit even if AddBookSheet was already open
    if (isAnonymous && books.length >= ANONYMOUS_BOOK_LIMIT) {
      setIsAdding(false);
      setConnectAccountReason('book_limit');
      setShowConnectAccountModal(true);
      return;
    }

    // Store the book metadata and add the book, then show rating overlay with reading status selection
    setPendingBookMeta(meta);
    setIsAdding(false);
    setShowFeedPage(false);
    setShowChatPage(false);
    setChatBookSelected(false);
    // Add book without status first, then show rating overlay
    // Pass meta directly to avoid race conditions with state updates
    await handleAddBookWithStatus(null as any, meta); // Add with null status, will update later
  }

  async function handleUpdateReadingStatus(id: string, readingStatus: ReadingStatus) {
    if (!user) return;
    
    // Optimistic update
    setBooks(prev => prev.map(book => 
      book.id === id 
        ? { ...book, reading_status: readingStatus }
        : book
    ));

    try {
      const { data, error } = await supabase
        .from('books')
        .update({ 
          reading_status: readingStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select();

      if (error) {
        // Log error in multiple ways to catch all possible error formats
        console.error('[handleUpdateReadingStatus] Supabase error object:', error);
        console.error('[handleUpdateReadingStatus] Error stringified:', JSON.stringify(error, null, 2));
        console.error('[handleUpdateReadingStatus] Error details:', {
          message: error?.message || 'No message',
          code: error?.code || 'No code',
          details: error?.details || 'No details',
          hint: error?.hint || 'No hint',
          fullError: error
        });
        
        // Check if column doesn't exist (common error codes)
        const errorMessage = error?.message || '';
        const errorCode = error?.code || '';
        
        if (errorCode === '42703' || errorMessage.includes('column') || errorMessage.includes('reading_status') || errorMessage.includes('does not exist')) {
          console.warn('[handleUpdateReadingStatus] ⚠️ reading_status column may not exist. Please run the migration in Supabase SQL Editor.');
          console.warn('[handleUpdateReadingStatus] Migration SQL: See migrations/add_reading_status.sql');
        }
        
        // Revert on error
        setBooks(prev => prev.map(book => 
          book.id === id 
            ? { ...book, reading_status: activeBook?.reading_status || null }
            : book
        ));
      } else {
        console.log(`[handleUpdateReadingStatus] ✅ Successfully updated reading_status to ${readingStatus}`, data);
        
        // If status changed to "read_it", integrate the book into merge sort game
        if (readingStatus === 'read_it') {
          addBookToMergeSortState(id);
        }
      }
    } catch (err: any) {
      console.error('[handleUpdateReadingStatus] ❌ Error updating reading status:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        fullError: err
      });
      // Revert on error
      setBooks(prev => prev.map(book => 
        book.id === id 
          ? { ...book, reading_status: activeBook?.reading_status || null }
          : book
      ));
    }
  }

  async function handleAddBookWithStatus(readingStatus: ReadingStatus | null, metaOverride?: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) {
    // Use metaOverride if provided (to avoid race conditions), otherwise use pendingBookMeta
    const meta = metaOverride || pendingBookMeta;
    if (!user || !meta) return;

    try {
      // Generate canonical book ID
      const canonicalBookId = generateCanonicalBookId(meta.title || '', meta.author || '');
      
      // Check if user already has this book
      const { data: existingBook, error: checkError } = await supabase
        .from('books')
        .select('id, title, author, cover_url')
        .eq('user_id', user.id)
        .eq('canonical_book_id', canonicalBookId)
        .maybeSingle();
      
      if (existingBook) {
        // Update cover if the search result has a different one (user expects the cover they clicked)
        if (meta.cover_url && meta.cover_url !== existingBook.cover_url) {
          await supabase.from('books').update({ cover_url: meta.cover_url }).eq('id', existingBook.id);
        }

        // Find the book in the current books array and navigate to it
        const existingBookIndex = books.findIndex(book => book.id === existingBook.id);
        if (existingBookIndex !== -1) {
          // Update cover in local state too
          if (meta.cover_url && meta.cover_url !== books[existingBookIndex].cover_url) {
            setBooks(prev => prev.map((b, i) => i === existingBookIndex ? { ...b, cover_url: meta.cover_url! } : b));
          }
          setSelectedIndex(existingBookIndex);
          setPendingBookMeta(null);
          setShowBookshelfCovers(false);
          setShowNotesView(false);
        } else {
          // Book exists in DB but not loaded yet - reload books to include it
          const { data: allBooks } = await supabase
            .from('books')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (allBooks) {
            const appBooks = allBooks.map(convertBookToApp);
            setBooks(appBooks);
            const foundIndex = appBooks.findIndex(book => book.id === existingBook.id);
            if (foundIndex !== -1) {
              setSelectedIndex(foundIndex);
            }
          }
          setPendingBookMeta(null);
          setShowBookshelfCovers(false);
          setShowNotesView(false);
        }
        return;
      }
      
      // Check how many other users have this book (for future feature)
      const { count: sharedCount } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .eq('canonical_book_id', canonicalBookId)
        .neq('user_id', user.id);
      
      if (sharedCount && sharedCount > 0) {
        console.log(`[handleAddBook] 📚 ${sharedCount} other user(s) also have this book`);
      }

      // Build bookData
      const bookData: any = {
        title: meta.title || '',
        author: meta.author || 'Unknown Author',
        canonical_book_id: canonicalBookId,
        publish_year: meta.publish_year ?? null,
        first_issue_year: meta.first_issue_year ?? null,
        genre: meta.genre ?? null,
        isbn: meta.isbn ?? null,
        cover_url: meta.cover_url ?? null,
        wikipedia_url: meta.wikipedia_url ?? null,
        google_books_url: meta.google_books_url ?? null,
        summary: meta.summary ?? null,
        apple_rating: meta.apple_rating ?? null,
        apple_rating_count: meta.apple_rating_count ?? null,
        user_id: user.id,
        rating_writing: null,
        rating_insights: null,
        rating_flow: null,
        rating_world: null,
        rating_characters: null,
        reading_status: readingStatus,
      };
      
      // Only include genre if it exists (column may not exist in database yet)
      if (meta.genre) {
        bookData.genre = meta.genre;
      }

      console.log('Inserting book data:', JSON.stringify(bookData, null, 2));

      const { data, error } = await supabase
        .from('books')
        .insert(bookData)
        .select()
        .single();

      if (error) {
        console.error('[handleAddBook] Supabase error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        
        // Handle unique constraint violation (duplicate book)
        if (error.code === '23505') { // Unique violation
          alert(`You already have this book in your library.`);
          return;
        }
        
        // Check if genre column doesn't exist
        if (error.code === '42703' || (error.message && (error.message.includes('column') || error.message.includes('genre')))) {
          console.warn('[handleAddBook] ⚠️ Genre column may not exist. Retrying without genre...');
          // Retry without genre
          const bookDataWithoutGenre = { ...bookData };
          delete bookDataWithoutGenre.genre;
          
          const { data: retryData, error: retryError } = await supabase
            .from('books')
            .insert(bookDataWithoutGenre)
            .select()
            .single();
            
          if (retryError) {
            console.error('[handleAddBook] Supabase error (retry):', {
              message: retryError.message,
              code: retryError.code,
              details: retryError.details,
              hint: retryError.hint,
            });
            const errorMessage = retryError?.message || retryError?.code || 'Unknown error';
            alert(`Failed to add book: ${errorMessage}`);
            return;
          }
          
          // Success on retry - continue with retryData
          const newBook = convertBookToApp(retryData);
          analytics.trackEvent('add_book', 'confirm', { book_title: newBook.title, book_author: newBook.author, reading_status: readingStatus });
          // Reconnect orphaned chats from a previously deleted copy of this book
          reassignChatsToBook(newBook.id, newBook.title, newBook.author || '').then(count => {
            if (count > 0) console.log(`[handleAddBook] Reconnected ${count} orphaned chat messages to new book`);
          });
          // Trigger book page onboarding for first book
          if (books.length === 0 && !localStorage.getItem('hasSeenBookPageOnboarding')) {
            setTimeout(() => { setShowBookPageOnboarding(true); }, 800);
          }
          setBooks(prev => [newBook, ...prev]);
          setSelectedIndex(0);
          setIsAdding(false);

          // Create friend_book feed item for social feed
          createFriendBookFeedItem(
            user.id,
            newBook.id,
            newBook.title,
            newBook.author || '',
            newBook.cover_url || null,
            readingStatus,
            newBook.summary || null
          );
          // Generate trivia questions if not already cached (fire-and-forget)
          ensureTriviaQuestionsForBook(newBook.title, newBook.author || '');
          // Switch to books view (in case we're on bookshelf/notes screen)
          setShowBookshelfCovers(false);
          setShowNotesView(false);
          
          // If status is "read_it", integrate the new book into the merge sort game
          if (readingStatus === 'read_it') {
            addBookToMergeSortState(newBook.id);
          }
          
          // If readingStatus is null, we need to show reading status selection in rating overlay
          if (readingStatus === null) {
            setSelectingReadingStatusInRating(true);
            setTimeout(() => {
              setIsEditing(true);
            }, 100);
          } else if (readingStatus === 'read_it') {
            // If status is "read_it", proceed to rating dimensions
            setPendingBookMeta(null);
            setSelectingReadingStatusInRating(false);
          setTimeout(() => {
            setIsEditing(true);
            setEditingDimension(null); // Will default to first unrated dimension
          }, 100);
          } else {
            // For "reading" or "want_to_read", just close
            setPendingBookMeta(null);
            setSelectingReadingStatusInRating(false);
          }
          return;
        }
        
        // Show user-friendly error message for other errors
        const errorMessage = error?.message || error?.code || 'Unknown error';
        alert(`Failed to add book: ${errorMessage}`);
        return;
      }

      const newBook = convertBookToApp(data);
      analytics.trackEvent('add_book', 'confirm', { book_title: newBook.title, book_author: newBook.author, reading_status: readingStatus });
      triggerSuccessHaptic();
      // Reconnect orphaned chats from a previously deleted copy of this book
      reassignChatsToBook(newBook.id, newBook.title, newBook.author || '').then(count => {
        if (count > 0) console.log(`[handleAddBook] Reconnected ${count} orphaned chat messages to new book`);
      });
      // Trigger book page onboarding for first book
      if (books.length === 0 && !localStorage.getItem('hasSeenBookPageOnboarding')) {
        setTimeout(() => { setShowBookPageOnboarding(true); }, 800);
      }
      setBooks(prev => [newBook, ...prev]);
      setSelectedIndex(0);
      setIsAdding(false);
      // Switch to books view (in case we're on bookshelf/notes screen)
      setShowBookshelfCovers(false);
      setShowNotesView(false);

      // Create friend_book feed item for social feed
      createFriendBookFeedItem(
        user.id,
        newBook.id,
        newBook.title,
        newBook.author || '',
        newBook.cover_url || null,
        readingStatus,
        newBook.summary || null
      );

      // Generate trivia questions if not already cached (fire-and-forget)
      ensureTriviaQuestionsForBook(newBook.title, newBook.author || '');

      // If status is "read_it", integrate the new book into the merge sort game
      if (readingStatus === 'read_it') {
        addBookToMergeSortState(newBook.id);
      }

      // If readingStatus is null, we need to show reading status selection in rating overlay
      if (readingStatus === null) {
        setSelectingReadingStatusInRating(true);
        setTimeout(() => {
          setIsEditing(true);
        }, 100);
      } else if (readingStatus === 'read_it') {
        // If status is "read_it", proceed to rating dimensions
        setPendingBookMeta(null);
        setSelectingReadingStatusInRating(false);
      setTimeout(() => {
        setIsEditing(true);
        setEditingDimension(null); // Will default to first unrated dimension
      }, 100);
          } else {
        // For "reading" or "want_to_read", just close
        setPendingBookMeta(null);
        setSelectingReadingStatusInRating(false);
      }

      // Note: We don't fetch data here anymore - let the useEffect hooks handle it
      // They will check the cache first and only make API calls if needed
      // This prevents duplicate calls when a book is added and then becomes active
      // The useEffect hooks will automatically trigger when the new book becomes activeBook
    } catch (err: any) {
      console.error('Error adding book:', err);
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        stack: err?.stack,
      });
      console.error('Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      // Show user-friendly error message
      const errorMessage = err?.message || err?.code || 'Unknown error';
      alert(`Failed to add book: ${errorMessage}`);
    }
  }

  // Silent book add for discovery swipe — no navigation, no rating overlay
  async function handleDiscoveryAddBook(
    meta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>,
    readingStatus: ReadingStatus,
    rating?: number | null,
  ) {
    if (!user) return;
    const canonicalBookId = generateCanonicalBookId(meta.title || '', meta.author || '');
    const bookData: any = {
      title: meta.title || '',
      author: meta.author || 'Unknown Author',
      canonical_book_id: canonicalBookId,
      publish_year: meta.publish_year ?? null,
      first_issue_year: meta.first_issue_year ?? null,
      genre: meta.genre ?? null,
      cover_url: meta.cover_url ?? null,
      wikipedia_url: meta.wikipedia_url ?? null,
      google_books_url: meta.google_books_url ?? null,
      summary: meta.summary ?? null,
      user_id: user.id,
      rating_writing: null,
      rating_insights: null,
      rating_flow: null,
      rating_world: null,
      rating_characters: null,
      reading_status: readingStatus,
    };
    // If rated via discovery, store as overall → rating_writing (first dimension)
    if (rating != null) {
      bookData.rating_writing = rating;
    }
    try {
      const { data, error } = await supabase.from('books').insert(bookData).select().single();
      if (error) {
        if (error.code === '23505') return; // duplicate, ignore
        console.error('[discovery] Insert error:', error);
        return;
      }
      const newBook = convertBookToApp(data);
      analytics.trackEvent('discovery_swipe', readingStatus === 'read_it' ? 'read' : 'want_to_read', { book_title: newBook.title });
      // Prepend book but bump selectedIndex so activeBook doesn't shift (avoids triggering enrichment)
      setSelectedIndex(prev => prev + 1);
      setBooks(prev => [newBook, ...prev]);
      // Only create friend feed item — skip enrichment queries (trivia, insights, etc.)
      // Those will run when the user actually opens the book
      createFriendBookFeedItem(user.id, newBook.id, newBook.title, newBook.author || '', newBook.cover_url || null, readingStatus, newBook.summary || null);
    } catch (err) {
      console.error('[discovery] Error:', err);
    }
  }

  async function handleRate(id: string, dimension: string, value: number | null) {
    if (!user) return; // Safety check
    
    const ratingField = `rating_${dimension}` as 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters';
    
    console.log(`[handleRate] Updating ${ratingField} to ${value} for book ${id}`);
    
    // Store original value for revert
    const originalValue = activeBook?.ratings[dimension as keyof typeof activeBook.ratings] ?? null;
    
    // Optimistic update
    setBooks(prev => prev.map(book => 
      book.id === id 
        ? { ...book, ratings: { ...book.ratings, [dimension]: value } }
        : book
    ));

    try {
      const updateData: Record<string, any> = {
        [ratingField]: value,
        updated_at: new Date().toISOString()
      };
      
      const { error, data } = await supabase
        .from('books')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id) // Ensure user can only update their own books
        .select();

      if (error) {
        console.error('[handleRate] Supabase error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        
        // Check if column doesn't exist
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
          console.error(`[handleRate] ⚠️ Column "${ratingField}" may not exist. Please run the migration in Supabase SQL Editor.`);
          console.error(`[handleRate] Migration SQL: ALTER TABLE public.books ADD COLUMN IF NOT EXISTS ${ratingField} int CHECK (${ratingField} between 1 and 5);`);
        }
        
        throw error;
      }
      
      console.log(`[handleRate] ✅ Successfully updated ${ratingField} to ${value}`);
      analytics.trackEvent('rating', 'rate', { book_title: activeBook?.title, dimension, value });

      // After rating, move to next dimension or close if all done
      if (value !== null && activeBook) {
        const currentIndex = RATING_DIMENSIONS.indexOf(dimension as typeof RATING_DIMENSIONS[number]);
        const nextIndex = currentIndex + 1;
        if (nextIndex < RATING_DIMENSIONS.length) {
          setEditingDimension(RATING_DIMENSIONS[nextIndex]);
        } else {
          // All dimensions rated, close after a brief moment
          setTimeout(() => {
            setIsEditing(false);
            setEditingDimension(null);
            // Show share dialog for high ratings (4 or 5 hearts), but not during onboarding
            if (value >= 4 && !showBookPageOnboarding) {
              setTimeout(() => setShowShareDialog(true), 50);
            }
          }, 250);
        }
      } else if (value === null) {
        // If skipped, move to next dimension
        const currentIndex = RATING_DIMENSIONS.indexOf(dimension as typeof RATING_DIMENSIONS[number]);
        const nextIndex = currentIndex + 1;
        if (nextIndex < RATING_DIMENSIONS.length) {
          setEditingDimension(RATING_DIMENSIONS[nextIndex]);
        } else {
          // All dimensions processed, close after a brief moment
          setTimeout(() => {
            setIsEditing(false);
            setEditingDimension(null);
          }, 250);
        }
      }
    } catch (err: any) {
      console.error('[handleRate] ❌ Error updating rating:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        fullError: err
      });
      
      // Revert on error
      setBooks(prev => prev.map(book => 
        book.id === id 
          ? { ...book, ratings: { ...book.ratings, [dimension]: originalValue } }
          : book
      ));
    }
  }

  // handleDelete moved to BookDetailView

  // Batch delete books from bookshelf select mode
  async function handleBatchDeleteBooks(bookIds: string[]) {
    if (!user || bookIds.length === 0) return;
    const { error } = await supabase
      .from('books')
      .delete()
      .in('id', bookIds)
      .eq('user_id', user.id);
    if (error) {
      console.error('[batch delete] Error:', error);
      return;
    }
    triggerHeavyHaptic();
    const deletedSet = new Set(bookIds);
    const newBooks = books.filter(b => !deletedSet.has(b.id));
    // Adjust selectedIndex to stay within bounds
    const newIndex = Math.min(selectedIndex, Math.max(0, newBooks.length - 1));
    setSelectedIndex(newIndex);
    setBooks(newBooks);
  }

  // Helper function to format timestamp for notes
  const formatNoteTimestamp = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // Helper function to parse notes into sections with timestamps
  const parseNotes = (notes: string | null): Array<{ timestamp: string; content: string }> => {
    if (!notes || notes.trim() === '') {
      return [];
    }

    const sections: Array<{ timestamp: string; content: string }> = [];
    // Match pattern: {timestamp}\n or {timestamp} at end
    const timestampRegex = /\{(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\}\n?/g;
    let match;
    const matches: Array<{ timestamp: string; index: number; fullMatch: string }> = [];

    // Collect all timestamp matches first
    while ((match = timestampRegex.exec(notes)) !== null) {
      matches.push({ timestamp: match[1], index: match.index, fullMatch: match[0] });
    }

    // Process each match
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const contentStart = current.index + current.fullMatch.length;
      const contentEnd = next ? next.index : notes.length;
      const content = notes.substring(contentStart, contentEnd).trim();

      // Always create a section, even with empty content
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

  async function handleSaveNote(text?: string, bookId?: string) {
    const targetBookId = bookId || activeBook?.id;
    if (!targetBookId || !user) return;

    const currentText = text !== undefined ? text : noteText;
    const textToSave = currentText.trim() || null;

    try {
      const { error } = await supabase
        .from('books')
        .update({
          notes: textToSave,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetBookId)
        .eq('user_id', user.id);

      if (error) throw error;

      setBooks(prev => prev.map(book =>
        book.id === targetBookId ? { ...book, notes: textToSave } : book
      ));
    } catch (err) {
      console.error('Error saving note:', err);
    }
  }

  // Pin content as a new note on the active book
  const [pinConfirmText, setPinConfirmText] = useState<string | null>(null);
  const pinConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function makePinMarker(type: string, content: string, url?: string, imageUrl?: string): string {
    return `{{pin:${type}|${content}|${url || ''}|${imageUrl || ''}}}`;
  }

  function isContentPinned(content: string): boolean {
    if (!activeBook?.notes) return false;
    return activeBook.notes.includes(content);
  }

  async function handlePinForLater(content: string, type: string = 'note', url?: string, imageUrl?: string) {
    if (!activeBook || !user) return;
    const bookId = activeBook.id;
    const existingNotes = activeBook.notes || '';
    const marker = makePinMarker(type, content, url, imageUrl);

    if (isContentPinned(content)) {
      // Unpin: remove the note section containing this content
      const sections = existingNotes.split(/(?=\{\d{4}-\d{2}-\d{2} \d{2}:\d{2}\})/).filter(s => s.trim());
      const filtered = sections.filter(s => !s.includes(content));
      const newNotes = filtered.join('\n\n').trim() || null;
      await handleSaveNote(newNotes || '', bookId);
      return;
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `{${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}}`;

    // Each pin creates a new note section with rich marker
    const newSection = `${ts}\n${marker}`;
    const newNotes = existingNotes ? `${newSection}\n\n${existingNotes}` : newSection;

    await handleSaveNote(newNotes, bookId);

    // Show brief confirmation
    setPinConfirmText(content.length > 40 ? content.substring(0, 40) + '...' : content);
    if (pinConfirmTimeoutRef.current) clearTimeout(pinConfirmTimeoutRef.current);
    pinConfirmTimeoutRef.current = setTimeout(() => setPinConfirmText(null), 1500);
  }

  // Toggle follow/unfollow for the currently viewed user
  async function handleToggleFollow() {
    if (!viewingUserId || !user) return;

    if (isAnonymous) {
      setConnectAccountReason('follow');
      setShowConnectAccountModal(true);
      return;
    }

    setIsFollowLoading(true);
    try {
      if (isFollowingViewingUser) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', viewingUserId);

        if (error) {
          console.error('Error unfollowing:', error);
          return;
        }
        setIsFollowingViewingUser(false);
        setMyFollowingCount(prev => Math.max(0, prev - 1));
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: viewingUserId,
          });

        if (error) {
          console.error('Error following:', error);
          return;
        }
        setIsFollowingViewingUser(true);
        setMyFollowingCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setIsFollowLoading(false);
    }
  }

  // Get user avatar from Google account
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  // Show login screen only when auth is done and there's no user
  if (!authLoading && !user) {
    return <LoginScreen />;
  }

  // Show skeleton bookshelf during auth loading or while loading books
  if (authLoading || !isLoaded) {
    const skeletonGlassmorphic: React.CSSProperties = {
      background: 'var(--glass-bg)',
      borderRadius: '16px',
      boxShadow: 'var(--glass-shadow)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      border: 'var(--glass-border)',
    };
    return (
      <div
        className="fixed inset-0 text-slate-900 dark:text-slate-100 font-sans select-none overflow-hidden flex flex-col"
        style={{
          backgroundColor: '#95DCFF',
          backgroundImage: `url(${getAssetPath('/bg.webp')})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          width: '100vw',
          height: '100dvh',
          minHeight: '-webkit-fill-available',
        } as React.CSSProperties}
      >
        <div className="flex-1 flex flex-col items-center relative pt-20 overflow-hidden">
          <div className="w-full flex flex-col items-center px-4">
            <div className="w-full max-w-[1600px] flex flex-col gap-2.5 py-8">
              {/* Profile skeleton */}
              <motion.div
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-2xl p-4 mb-4"
                style={skeletonGlassmorphic}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-300/50 dark:bg-slate-600/50" />
                  <div className="flex-1 flex gap-6">
                    <div className="text-center">
                      <div className="w-8 h-7 bg-slate-300/50 dark:bg-slate-600/50 rounded mx-auto mb-1" />
                      <div className="w-10 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded mx-auto" />
                    </div>
                    <div className="text-center">
                      <div className="w-8 h-7 bg-slate-300/50 dark:bg-slate-600/50 rounded mx-auto mb-1" />
                      <div className="w-14 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded mx-auto" />
                    </div>
                  </div>
                </div>
              </motion.div>
              {/* Grouping selector skeleton */}
              <div className="flex items-center justify-between px-4 mb-1.5">
                <motion.div
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
                  className="w-20 h-10 bg-slate-300/30 rounded-lg"
                />
              </div>
              {/* Bookshelf group skeleton - Reading */}
              <motion.div
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                className="rounded-2xl p-4"
                style={skeletonGlassmorphic}
              >
                <div className="w-24 h-5 bg-slate-300/50 dark:bg-slate-600/50 rounded mb-4" />
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i}>
                      <div className="w-full aspect-[2/3] bg-slate-300/50 dark:bg-slate-600/50 rounded-lg mb-2" />
                      <div className="w-full h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded mb-1" />
                      <div className="w-2/3 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                    </div>
                  ))}
                </div>
              </motion.div>
              {/* Bookshelf group skeleton - Read it */}
              <motion.div
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                className="rounded-2xl p-4"
                style={skeletonGlassmorphic}
              >
                <div className="w-32 h-5 bg-slate-300/50 dark:bg-slate-600/50 rounded mb-4" />
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i}>
                      <div className="w-full aspect-[2/3] bg-slate-300/50 dark:bg-slate-600/50 rounded-lg mb-2" />
                      <div className="w-full h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded mb-1" />
                      <div className="w-2/3 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userEmail = user?.email || user?.user_metadata?.email || 'User';
  const userName = user?.user_metadata?.full_name || userEmail.split('@')[0];

  // Parse gradient for inline style (format: "r1,g1,b1,r2,g2,b2")
  const isDefaultGradient = backgroundGradient === '241,245,249,226,232,240';
  const [r1, g1, b1, r2, g2, b2] = backgroundGradient.split(',').map(Number);
  const gradientStyle = {
    background: isDefaultGradient
      ? `linear-gradient(to bottom right, rgb(var(--gradient-start)), rgb(var(--gradient-end)))`
      : `linear-gradient(to bottom right, rgb(${r1}, ${g1}, ${b1}), rgb(${r2}, ${g2}, ${b2}))`,
  };

  // Previous gradient style (for fade out)
  const previousGradientStyle = previousGradient ? (() => {
    const isPrevDefault = previousGradient === '241,245,249,226,232,240';
    const [pr1, pg1, pb1, pr2, pg2, pb2] = previousGradient.split(',').map(Number);
    return {
      background: isPrevDefault
        ? `linear-gradient(to bottom right, rgb(var(--gradient-start)), rgb(var(--gradient-end)))`
        : `linear-gradient(to bottom right, rgb(${pr1}, ${pg1}, ${pb1}), rgb(${pr2}, ${pg2}, ${pb2}))`,
    };
  })() : null;
  
  // Use background image for all pages (including book details)
  const shouldUseBackgroundImage = true;
  const backgroundImageStyle: React.CSSProperties = {
    backgroundColor: 'white',
    backgroundImage: `url(${getAssetPath('/bg.webp')})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
  
  // Glassmorphic style for cover page buttons (20% less opacity)
  const coverButtonGlassmorphicStyle: React.CSSProperties = {
    background: 'var(--glass-bg-cover-btn)',
    borderRadius: '16px',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: 'var(--glass-border)',
  };

  // Standard glassmorphism style (for bookshelf, notes, account pages)
  const standardGlassmorphicStyle: React.CSSProperties = {
    background: 'var(--glass-bg-subtle)',
    borderRadius: '16px',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: 'var(--glass-border)',
  };

  // Blue glassmorphism for primary actions
  const blueGlassmorphicStyle: React.CSSProperties = {
    background: 'var(--glass-bg-blue)',
    borderRadius: '999px',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: 'var(--glass-border-blue)',
  };

  // Yellow glassmorphism for profile section
  const yellowGlassmorphicStyle: React.CSSProperties = {
    background: 'var(--glass-bg-yellow)',
    borderRadius: '16px',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: 'var(--glass-border-yellow)',
  };

  // Consistent glassmorphism style (less transparent for book page info cards)
  const glassmorphicStyle: React.CSSProperties = {
    background: 'var(--glass-bg)',
    borderRadius: '16px',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: 'var(--glass-border)',
  };

  // Less transparent glassmorphism style for book page summary box and section menus
  const bookPageGlassmorphicStyle: React.CSSProperties = {
    background: 'var(--glass-bg)',
    borderRadius: '16px',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: 'var(--glass-border)',
  };
  
  return (
    <div className="fixed inset-0 text-slate-900 dark:text-slate-100 font-sans select-none overflow-hidden flex flex-col"
      style={{
        ...(shouldUseBackgroundImage ? backgroundImageStyle : { background: gradientStyle.background }),
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh', // Use dynamic viewport height for mobile (includes safe areas)
        minHeight: '-webkit-fill-available', // iOS Safari fallback
      } as React.CSSProperties}
    >
      {/* Tap zone for scroll-to-top (iOS status bar pattern) */}
      <div
        className="fixed top-0 left-0 right-0 h-[44px] z-[9999]"
        onClick={scrollToTop}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      />

      {/* Gradient background - new gradient fades in first, then old fades out (only for book pages) */}
      {!shouldUseBackgroundImage && (
        <>
          {/* Previous gradient - stays at full opacity until new one is ready, then fades out */}
          {previousGradient && previousGradientStyle && (
            <motion.div
              key={`gradient-prev-${previousGradient}`}
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 pointer-events-none z-0"
              style={{
                ...previousGradientStyle,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100dvh',
                minHeight: '-webkit-fill-available',
              } as React.CSSProperties}
              transition={{ duration: 0.4, ease: "easeInOut", delay: 0.4 }}
              onAnimationComplete={() => {
                // Only clear previous gradient after fade out animation completes
                if (!isGradientTransitioning) {
                  setPreviousGradient(null);
                }
              }}
            />
          )}
          {/* Current gradient - always visible, fades in when updated */}
          <motion.div
            key={`gradient-${books[selectedIndex]?.id || 'default'}-${backgroundGradient}`}
            initial={{ opacity: previousGradient ? 0 : 1 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 pointer-events-none z-0"
            style={{
              ...gradientStyle,
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100dvh', // Use dynamic viewport height for mobile (includes safe areas)
              minHeight: '-webkit-fill-available', // iOS Safari fallback
            } as React.CSSProperties}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
          {/* Background image overlay */}
          <div
            className="fixed inset-0 pointer-events-none z-0 dark:brightness-50 dark:saturate-[0.6]"
            style={{
              backgroundColor: 'white',
              backgroundImage: `url(${getAssetPath('/bg.webp')})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 'var(--bg-overlay-opacity)',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100dvh',
              minHeight: '-webkit-fill-available',
            } as React.CSSProperties}
          />
        </>
      )}
      {/* Dark mode overlay for pages using bg.webp directly as background */}
      {shouldUseBackgroundImage && (
        <div className="fixed inset-0 pointer-events-none z-0 hidden dark:block bg-black/60" />
      )}
      {/* Logo text header - shows on main views (bookshelf, feed, following, notes, book details) */}
      {!showAccountPage && !showSortingResults && !viewingUserId && (
        <motion.div
          ref={attachHeaderLogoRef}
          className="fixed top-[20px] left-0 right-0 flex justify-center z-40 pointer-events-none"
        >
          <img
            src={getAssetPath('/logo_text.png')}
            alt="Logo"
            className="h-[20px] object-contain dark:invert"
          />
        </motion.div>
      )}

      {/* Simple header - fades on scroll and during transitions (hidden on book pages) */}
      {!(!showBookshelfCovers && !showNotesView && !showAccountPage && !showSortingResults && !showFollowingPage && !showFeedPage && (!showChatPage || chatBookSelected) && !showCreatePost) && (
      <AnimatePresence mode="wait">
        <motion.div
          key={showSortingResults ? 'sorting-results-header' : showNotesView ? 'notes-header' : 'books-header'}
          ref={attachHeaderBarRef}
          className="w-full z-40 fixed top-[50px] left-0 right-0 px-4 py-3 flex items-center justify-between"
          style={{
            background: 'transparent',
          }}
        >
          {/* BOOKS/BOOKSHELF/NOTES text on left with icon */}
          <div className="flex items-center gap-3">
            {viewingUserId ? (
              <motion.button
                initial={{ opacity: 1 }}
                animate={{ opacity: isFadingOutViewingUser ? 0 : 1 }}
                onClick={() => {
                  setIsFadingOutViewingUser(true);
                  setTimeout(() => {
                    setViewingUserId(null);
                    setViewingUserBooks([]);
                    setViewingUserName('');
                    setViewingUserFullName(null);
                    setViewingUserAvatar(null);
                    setIsFadingOutViewingUser(false);
                    restorePreviousView();
                  }, 300);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                style={{ ...standardGlassmorphicStyle, borderRadius: '50%' }}
              >
                <ChevronLeft size={18} className="text-slate-950 dark:text-slate-50" />
              </motion.button>
            ) : (showNotesView || showFollowingPage || showAccountPage) && (
              <button
                onClick={() => {
                  updateScrollY(0);
                  if (showAccountPage) {
                    restorePreviousView();
                  } else {
                    setShowBookshelfCovers(true);
                    setShowNotesView(false);
                    setShowFollowingPage(false);
                  }
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                style={{ ...standardGlassmorphicStyle, borderRadius: '50%' }}
              >
                <ChevronLeft size={18} className="text-slate-950 dark:text-slate-50" />
              </button>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={
                  viewingUserId ? `user-${viewingUserId}` :
                  isShowingNotes ? 'notes-editor' :
                  showAccountPage ? 'account' :
                  showFollowingPage ? 'following' :
                  showFeedPage ? 'feed' :
                  showChatPage ? 'chat' :
                  showSortingResults ? 'sorted' :
                  showNotesView ? 'notes' :
                  showBookshelfCovers ? 'bookshelf-covers' :
                  'books'
                }
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                {isShowingNotes && activeBook ? (
                  <Pencil size={24} className="text-slate-950 dark:text-slate-50" />
                ) : showAccountPage ? (
                  <User size={24} className="text-slate-950 dark:text-slate-50" />
                ) : showFollowingPage ? (
                  <Users size={24} className="text-slate-950 dark:text-slate-50" />
                ) : showFeedPage ? (
                  featureFlags.hand_drawn_icons ? (
                    <img src={getAssetPath("/feed.svg")} alt="Feed" className="w-[24px] h-[24px]" />
                  ) : (
                    <Birdhouse size={24} className="text-slate-950 dark:text-slate-50" />
                  )
                ) : showChatPage ? (
                  <MessageSquareHeart size={24} className="text-slate-950 dark:text-slate-50" />
                ) : showCreatePost ? (
                  <Plus size={24} className="text-slate-950 dark:text-slate-50" />
                ) : showSortingResults ? (
                  <Star size={24} className="text-slate-950 dark:text-slate-50" />
                ) : showNotesView ? (
                  <Bookmark size={24} className="text-slate-950 dark:text-slate-50" />
                ) : showBookshelfCovers ? (
                  featureFlags.hand_drawn_icons ? (
                    <img src={getAssetPath("/library.svg")} alt="Library" className="w-[24px] h-[24px]" />
                  ) : (
                    <Library size={24} className="text-slate-950 dark:text-slate-50" />
                  )
                ) : (
                  <BookOpen size={24} className="text-slate-950 dark:text-slate-50" />
                )}
                <h1 className={`text-2xl font-bold text-slate-950 dark:text-slate-50 drop-shadow-sm ${viewingUserId ? 'truncate max-w-[60vw]' : ''}`}>
                  {viewingUserId
                    ? (viewingUserFullName || viewingUserName).toUpperCase()
                    : showAccountPage
                      ? 'ACCOUNT'
                      : showFollowingPage
                        ? 'FOLLOWING'
                        : showFeedPage
                          ? 'FEED'
                          : showChatPage
                            ? 'CHATS'
                            : showCreatePost
                              ? 'NEW POST'
                            : showSortingResults
                            ? 'SORTED RESULTS'
                            : showNotesView
                              ? 'NOTES'
                              : showBookshelfCovers
                                ? 'BOOKSHELF'
                                  : 'BOOKS'}
                </h1>
              </motion.div>
            </AnimatePresence>
          </div>
        
        {/* Back button when on sorting results */}
        {showSortingResults && (
          <button
            onClick={() => {
              setShowSortingResults(false);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 active:scale-95 transition-all"
            style={{ ...glassmorphicStyle, borderRadius: '50%' }}
          >
            <ChevronLeft size={18} className="text-slate-950 dark:text-slate-50" />
          </button>
        )}

        {/* New chat button when on chat list */}
        {showChatPage && !chatBookSelected && (
          <div className="relative">
            <button
              onClick={() => openAddBookSheet('chat_picker')}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 active:scale-95 transition-all"
              style={{ ...glassmorphicStyle, borderRadius: '50%' }}
            >
              <Plus size={18} className="text-slate-950 dark:text-slate-50" />
            </button>
            <AnimatePresence>
              {!chatListLoading && chatList.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white whitespace-nowrap pointer-events-none z-50"
                  style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                >
                  Start a chat!
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Info button when on bookshelf (not when viewing another user) */}
        {(showBookshelfCovers) && !showAccountPage && !showSortingResults && !showFollowingPage && !showNotesView && !showFeedPage && !showChatPage && !viewingUserId && (
          <button
            onClick={() => { setShowAboutScreen(true); }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 active:scale-95 transition-all"
          >
            <Info size={18} className="text-slate-950 dark:text-slate-50" />
          </button>
        )}
        </motion.div>
      </AnimatePresence>
      )}

      <Suspense fallback={null}>
      <AnimatePresence mode="wait">
        {showAccountPage ? (
          <AccountPage
            user={user}
            isAnonymous={isAnonymous}
            signOut={signOut}
            bookCount={books.length}
            contentPreferences={contentPreferences}
            onContentPreferencesChange={(next) => {
              setContentPreferences(next);
              localStorage.setItem('contentPreferences', JSON.stringify(next));
              if (user) {
                supabase.from('users').update({ content_preferences: next }).eq('id', user.id).then(() => {});
              }
            }}
            onConnectAccount={() => {
              setConnectAccountReason('account');
              setShowConnectAccountModal(true);
            }}
            onClose={() => setShowAccountPage(false)}
            scrollContainerRef={scrollContainerRef}
            onScroll={(scrollTop) => updateScrollY(scrollTop)}
            remoteFlags={remoteFlags}
          />
        ) : showFollowingPage ? (
          <FollowingPage
            user={user!}
            supabase={supabase}
            scrollContainerRef={scrollContainerRef}
            onScroll={(scrollTop) => updateScrollY(scrollTop)}
            onUserClick={(userId) => {
              capturePreviousView();
              setViewingUserId(userId);
              setShowFollowingPage(false);
              setShowFeedPage(false);
              setShowBookshelfCovers(true);
              setShowNotesView(false);
              setShowAccountPage(false);
              setShowSortingResults(false);
            }}
            standardGlassmorphicStyle={standardGlassmorphicStyle}
          />
        ) : showFeedPage ? (
          <FeedPage
            user={user}
            isAnonymous={isAnonymous}
            personalizedFeedItems={personalizedFeedItems}
            setPersonalizedFeedItems={setPersonalizedFeedItems}
            isLoadingPersonalizedFeed={isLoadingPersonalizedFeed}
            heartCounts={heartCounts}
            userHearted={userHearted}
            handleToggleHeart={handleToggleHeart}
            remoteFlags={remoteFlags}
            glassmorphicStyle={glassmorphicStyle}
            scrollContainerRef={scrollContainerRef}
            setScrollY={updateScrollY}
            headerPullRef={headerPullRef}
            refreshAnimation={refreshAnimation}
            setViewingBookFromOtherUser={setViewingBookFromOtherUser}
            handleAddBook={handleAddBook}
            capturePreviousView={capturePreviousView}
            setViewingUserId={setViewingUserId}
            setShowFeedPage={setShowFeedPage}
            setShowBookshelfCovers={setShowBookshelfCovers}
            setConnectAccountReason={setConnectAccountReason}
            setShowConnectAccountModal={setShowConnectAccountModal}
          />
        ) : showChatPage ? (
          <ChatPage
            user={user}
            books={books}
            activeBook={activeBook}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            chatBookSelected={chatBookSelected}
            setChatBookSelected={setChatBookSelected}
            chatGeneralMode={chatGeneralMode}
            setChatGeneralMode={setChatGeneralMode}
            characterChatContext={characterChatContext}
            setCharacterChatContext={setCharacterChatContext}
            loadingCharacterChat={loadingCharacterChat}
            setLoadingCharacterChat={setLoadingCharacterChat}
            chatOpenedFromBookPage={chatOpenedFromBookPage}
            chatList={chatList}
            setChatList={setChatList}
            characterChatList={characterChatList}
            setCharacterChatList={setCharacterChatList}
            chatListLoading={chatListLoading}
            setChatListLoading={setChatListLoading}
            unreadChatCounts={unreadChatCounts}
            setUnreadChatCounts={setUnreadChatCounts}
            scrollContainerRef={scrollContainerRef}
            setScrollY={updateScrollY}
            headerPullRef={headerPullRef}
            refreshAnimation={refreshAnimation}
            handleAddBook={handleAddBook}
            setShowChatPage={setShowChatPage}
            bookInfluences={bookInfluences}
            bookDomain={bookDomain}
            bookContext={bookContext}
            didYouKnow={didYouKnow}
            combinedPodcastEpisodes={combinedPodcastEpisodes}
            youtubeVideos={youtubeVideos}
            analysisArticles={analysisArticles}
            relatedBooks={relatedBooks}
            relatedMovies={relatedMovies}
            discussionQuestions={discussionQuestions}
            characterAvatars={characterAvatars}
            dismissedChatIds={dismissedChatIds}
            setDismissedChatIds={setDismissedChatIds}
          />
        ) : showCreatePost ? (
          <motion.main
            key="create-post"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem + var(--safe-area-bottom, 0px))' }}
          >
            <div className="w-full max-w-[600px] mx-auto px-4 py-4" style={{ marginTop: '30px' }}>
              <div className="rounded-2xl overflow-hidden" style={glassmorphicStyle}>
                {/* Compose area */}
                <div className="px-4 pt-4">
                  <div className="flex gap-3">
                    {/* Avatar + thread line */}
                    <div className="flex flex-col items-center">
                      {userAvatar ? (
                        <img
                          src={userAvatar}
                          alt={userName}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/30 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{userName.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="w-px flex-1 bg-white/30 dark:bg-white/15 mt-2 min-h-[24px]" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-4">
                      <p className="font-bold text-[15px] text-slate-900 dark:text-slate-100">{userName}</p>
                      <textarea
                        ref={(el) => { if (el && showCreatePost) setTimeout(() => el.focus(), 300); }}
                        value={createPostText}
                        onChange={(e) => {
                          setCreatePostText(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        placeholder="What's new?"
                        className="w-full mt-1 text-[15px] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 bg-transparent outline-none resize-none min-h-[80px]"
                        rows={4}
                      />

                      {/* Attachment icons */}
                      <div className="flex items-center gap-4 mt-1">
                        <button className="active:opacity-60">
                          <ImageIcon size={20} className="text-slate-400 dark:text-slate-500" />
                        </button>
                        <button className="active:opacity-60">
                          <Quote size={20} className="text-slate-400 dark:text-slate-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/20 dark:border-white/10">
                  <button
                    onClick={() => {
                      setCreatePostText('');
                      setShowCreatePost(false);
                      setShowBookshelfCovers(true);
                    }}
                    className="px-4 py-2 rounded-full font-bold text-[15px] text-slate-500 dark:text-slate-400 active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!createPostText.trim()}
                    onClick={() => {
                      if (!createPostText.trim()) return;
                      const newPost: PersonalizedFeedItem = {
                        id: `user-post-${Date.now()}`,
                        user_id: '',
                        source_book_id: '',
                        source_book_title: '',
                        source_book_author: '',
                        source_book_cover_url: null,
                        type: 'user_post',
                        content: {
                          text: createPostText.trim(),
                          user_name: userName,
                          user_avatar: userAvatar,
                        },
                        content_hash: null,
                        reading_status: null,
                        base_score: 1000,
                        times_shown: 0,
                        last_shown_at: null,
                        created_at: new Date().toISOString(),
                        read: false,
                        source_book_created_at: null,
                      };
                      setPersonalizedFeedItems(prev => [newPost, ...prev]);
                      setCreatePostText('');
                      setShowCreatePost(false);
                      setShowFeedPage(true);
                      setShowBookshelfCovers(false);
                      setShowNotesView(false);
                      setShowAccountPage(false);
                      setShowSortingResults(false);
                      setShowChatPage(false);
                      setChatBookSelected(false);
                      updateScrollY(0);
                    }}
                    className="px-5 py-2 rounded-full font-bold text-[15px] text-white transition-all active:scale-95 disabled:opacity-40"
                    style={{
                      background: createPostText.trim()
                        ? 'rgba(59, 130, 246, 0.85)'
                        : 'rgba(59, 130, 246, 0.3)',
                      backdropFilter: 'blur(9.4px)',
                      WebkitBackdropFilter: 'blur(9.4px)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </motion.main>
        ) : showSortingResults ? (
          <motion.main
            key="sorting-results"
            ref={(el) => { scrollContainerRef.current = el; }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: '#f5f5f1', paddingBottom: 'calc(1rem + 50px + 4rem + var(--safe-area-bottom, 0px))' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              updateScrollY(target.scrollTop);
            }}
          >
            {/* Sorting Results View */}
            <div className="w-full max-w-[600px] md:max-w-[800px] flex flex-col gap-4 px-4 py-8">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-slate-950 dark:text-slate-50">RANKED BY YOU</h1>
                <button
                  onClick={() => {
                    // Reset merge sort state to replay
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('bookMergeSortState');
                      localStorage.removeItem('bookComparisonResults');
                    }
                    // Close results view and start new game
                    setShowSortingResults(false);
                    // The Play button will now be available again
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-all bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white active:scale-95"
                >
                  <Play size={14} />
                  <span>Replay</span>
                </button>
              </div>
              {(() => {
                const availableBooks = books.filter(b => b.reading_status === 'read_it');
                const sortedBooks = getSortedBooks(availableBooks);
                
                if (sortedBooks.length === 0) {
                  return (
                    <div className="w-full bg-white/80 dark:bg-white/15 backdrop-blur-md rounded-2xl p-8 border border-white/30 dark:border-white/10 shadow-lg text-center">
                      <BookOpen size={32} className="mx-auto mb-3 text-slate-400" />
                      <p className="text-slate-800 dark:text-slate-200 text-sm font-medium">No books to display</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    {sortedBooks.map((book: BookWithRatings, index: number) => (
                      <motion.div
                        key={book.id || `sorted-${index}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white/80 dark:bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/30 dark:border-white/10 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                        onClick={() => {
                          const bookIndex = books.findIndex(b => b.id === book.id);
                          if (bookIndex !== -1) {
                            setSelectedIndex(bookIndex);
                            setShowSortingResults(false);
                          }
                        }}
                      >
                        <div className="flex gap-4 items-center">
                          {/* Rank Number */}
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-black text-lg">
                            {index + 1}
                          </div>
                          
                          {/* Book Cover */}
                          <div className="flex-shrink-0">
                            {book.cover_url ? (
                              <img 
                                src={book.cover_url} 
                                alt={book.title}
                                className="w-16 h-24 object-cover rounded-lg shadow-md"
                              />
                            ) : (
                              <div className={`w-16 h-24 rounded-lg flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                                <BookOpen size={24} className="text-white opacity-50" />
                              </div>
                            )}
                          </div>
                          
                          {/* Book Info */}
                          <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50 mb-1 line-clamp-1">{book.title}</h2>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{book.author}</p>
                            {(() => {
                              const avgScore = calculateAvg(book.ratings);
                              if (avgScore) {
                                return (
                                  <div className="flex items-center gap-1">
                                    <Heart size={12} className="fill-pink-500 text-pink-500" />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{avgScore}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </motion.main>
        ) : showNotesView ? (
          <motion.main
            key="notes"
            ref={(el) => { scrollContainerRef.current = el; }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem + var(--safe-area-bottom, 0px))' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              updateScrollY(target.scrollTop);
            }}
          >
            {/* Notes View */}
            <div className="w-full max-w-[600px] md:max-w-[800px] flex flex-col gap-4 px-4 py-8">
              {/* Sort Button */}
              <div className="flex justify-start mb-0">
                <button
                  onClick={() => {
                    const order: Array<'edited_desc' | 'edited_asc' | 'name_asc' | 'name_desc'> = ['edited_desc', 'edited_asc', 'name_asc', 'name_desc'];
                    const currentIndex = order.indexOf(notesSortOrder);
                    const nextIndex = (currentIndex + 1) % order.length;
                    setNotesSortOrder(order[nextIndex]);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all text-slate-700 dark:text-slate-300 hover:opacity-80 active:scale-95"
                  style={standardGlassmorphicStyle}
                >
                  <span>
                    {notesSortOrder === 'edited_desc' ? 'Recent ↓' :
                     notesSortOrder === 'edited_asc' ? 'Recent ↑' :
                     notesSortOrder === 'name_asc' ? 'Name A-Z' : 'Name Z-A'}
                  </span>
                </button>
              </div>
              {(() => {
                const booksWithNotes = books
                  .filter(book => book.notes && book.notes.trim().length > 0)
                  .sort((a, b) => {
                    if (notesSortOrder === 'edited_desc') {
                      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
                    } else if (notesSortOrder === 'edited_asc') {
                      return new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime();
                    } else if (notesSortOrder === 'name_asc') {
                      return a.title.localeCompare(b.title);
                    } else {
                      return b.title.localeCompare(a.title);
                    }
                  });

                if (booksWithNotes.length === 0) {
                  return (
                    <div className="w-full rounded-2xl p-8 text-center" style={glassmorphicStyle}>
                      <Bookmark size={32} className="mx-auto mb-3 text-slate-400" />
                      <p className="text-slate-800 dark:text-slate-200 text-sm font-medium">No notes yet</p>
                      <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">Add notes to your books to see them here</p>
                    </div>
                  );
                }

                return booksWithNotes.map((book, index) => (
                  <motion.div
                    key={book.id || `note-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl p-4 cursor-pointer hover:shadow-xl transition-shadow"
                    style={glassmorphicStyle}
                    onClick={() => {
                      // Only navigate if not editing
                      if (editingNoteBookId !== book.id) {
                        // Find book index and navigate to it, then open notes
                        const bookIndex = books.findIndex(b => b.id === book.id);
                        if (bookIndex !== -1) {
                          setShowNotesView(false);
                          setShowBookshelfCovers(false);
                          setShowAccountPage(false);
                          setShowFollowingPage(false);
                          setShowFeedPage(false);
                          if (bookIndex === selectedIndex) {
                            // Already on this book, just open notes directly
                            setIsShowingNotes(true);
                          } else {
                            // Different book — ref tells the selectedIndex useEffect to open notes
                            openNotesAfterNavRef.current = true;
                            setSelectedIndex(bookIndex);
                          }
                        }
                      }
                    }}
                  >
                    <div className="relative flex gap-4">
                      {/* Book Cover */}
                      <div className="flex-shrink-0">
                        {book.cover_url ? (
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            className="w-16 h-24 object-cover rounded-lg shadow-md"
                          />
                        ) : (
                          <div className={`w-16 h-24 rounded-lg flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                            <BookOpen size={24} className="text-white opacity-50" />
                          </div>
                        )}
                      </div>

                      {/* Bookmark count — bottom right */}
                      <span className="absolute bottom-0 right-0 flex items-center gap-0.5 text-slate-900">
                        <Bookmark size={12} className="fill-slate-900" />
                        <span className="text-[11px] font-semibold">{(book.notes || '').split(/\{\d{4}-\d{2}-\d{2} \d{2}:\d{2}\}/).filter(p => p.trim()).length}</span>
                      </span>

                      {/* Book Info and Notes */}
                      <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50 mb-1 line-clamp-1">{book.title}</h2>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs text-slate-600 dark:text-slate-400">{book.author}</p>
                        </div>
                        
                        {editingNoteBookId === book.id ? (
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            <textarea
                              value={book.notes || ''}
                              onChange={(e) => {
                                const newText = e.target.value;
                                // Update local state immediately
                                setBooks(prev => prev.map(b => 
                                  b.id === book.id ? { ...b, notes: newText } : b
                                ));
                                // Clear existing timeout
                                if (noteSaveTimeoutRef.current) {
                                  clearTimeout(noteSaveTimeoutRef.current);
                                }
                                // Debounced auto-save
                                noteSaveTimeoutRef.current = setTimeout(() => {
                                  handleSaveNote(newText, book.id);
                                }, 1000);
                              }}
                              onBlur={() => {
                                handleSaveNote(book.notes || '', book.id);
                                setEditingNoteBookId(null);
                              }}
                              placeholder="Write your notes here..."
                              className="w-full text-xs text-slate-800 dark:text-slate-200 bg-transparent border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:border-blue-500"
                              rows={4}
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                handleSaveNote(book.notes || '', book.id);
                                setEditingNoteBookId(null);
                              }}
                              className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <div className="pb-4">
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                              {(() => {
                                // Show most recent note content, strip timestamps
                                const raw = book.notes || '';
                                const parts = raw.split(/\{\d{4}-\d{2}-\d{2} \d{2}:\d{2}\}\n?/);
                                const content = parts.filter(p => p.trim()).shift()?.trim();
                                return content || raw.replace(/\{\d{4}-\d{2}-\d{2} \d{2}:\d{2}\}/g, '').trim();
                              })()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ));
              })()}
            </div>
          </motion.main>
        ) : showBookshelfCovers ? (
          <BookshelfView
            books={books}
            booksForBookshelf={booksForBookshelf}
            user={user}
            isReviewer={isReviewer}
            isAnonymous={isAnonymous}
            userName={userName}
            userAvatar={userAvatar}
            myFollowingCount={myFollowingCount}
            viewingUserId={viewingUserId}
            viewingUserBooks={viewingUserBooks}
            viewingUserName={viewingUserName}
            viewingUserFullName={viewingUserFullName}
            viewingUserAvatar={viewingUserAvatar}
            viewingUserIsPrivate={viewingUserIsPrivate}
            viewingUserFollowingCount={viewingUserFollowingCount}
            isLoadingViewingUserBooks={isLoadingViewingUserBooks}
            isFadingOutViewingUser={isFadingOutViewingUser}
            isFollowingViewingUser={isFollowingViewingUser}
            isFollowLoading={isFollowLoading}
            handleToggleFollow={handleToggleFollow}
            nudgeBannerDismissed={nudgeBannerDismissed}
            setNudgeBannerDismissed={setNudgeBannerDismissed}
            scrollContainerRef={scrollContainerRef}
            updateScrollY={updateScrollY}
            onBookSelect={(bookIndex: number) => {
              updateScrollY(0);
              setSelectedIndex(bookIndex);
              setShowBookshelfCovers(false);
              setTimeout(() => {
                const main = document.querySelector('main');
                if (main) {
                  main.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }, 100);
            }}
            onViewOtherUserBook={setViewingBookFromOtherUser}
            openAddBookSheet={() => openAddBookSheet()}
            onShowAboutScreen={() => setShowAboutScreen(true)}
            onShowNotesView={() => setShowNotesView(true)}
            onShowFollowingPage={() => setShowFollowingPage(true)}
            onShowAccountPage={() => setShowAccountPage(true)}
            onUpdateBookLists={handleUpdateBookLists}
            onSelectModeChange={setIsSelectMode}
            signOut={signOut}
            setConnectAccountReason={setConnectAccountReason}
            setShowConnectAccountModal={setShowConnectAccountModal}
            setBooks={setBooks}
            capturePreviousView={capturePreviousView}
            setShowChatPage={setShowChatPage}
            setChatBookSelected={setChatBookSelected}
            setShowBookshelfCovers={setShowBookshelfCovers}
            onDeleteBooks={handleBatchDeleteBooks}
            onShowDiscoverySwipe={() => setShowDiscoverySwipe(true)}
            remoteFlags={remoteFlags}
          />
        ) : (
          <BookDetailView
            activeBook={activeBook}
            books={books}
            booksForBookshelf={booksForBookshelf}
            selectedIndex={selectedIndex}
            user={user}
            isReviewer={isReviewer}
            bookDetailData={{
              bookInfluences,
              bookDomain,
              bookContext,
              didYouKnow,
              podcastEpisodes,
              analysisArticles: analysisArticles as any,
              youtubeVideos,
              relatedBooks,
              relatedMovies,
              bookSummaries,
              characterAvatars,
              loadingFactsForBookId,
              loadingInfluencesForBookId,
              loadingDomainForBookId,
              loadingContextForBookId,
              loadingDidYouKnowForBookId,
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
            }}
            cardCallbacks={{
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
            }}
            heartCounts={heartCounts}
            userHearted={userHearted}
            handleToggleHeart={handleToggleHeart}
            isContentPinned={isContentPinned}
            handlePinForLater={handlePinForLater}
            scrollContainerRef={scrollContainerRef}
            updateScrollY={updateScrollY}
            attachBookDetailHeaderRef={attachBookDetailHeaderRef}
            onNavigateToBookshelf={() => {
              updateScrollY(0);
              setShowBookshelfCovers(true);
              setShowNotesView(false);
              setShowAccountPage(false);
              setShowSortingResults(false);
            }}
            openAddBookSheet={() => openAddBookSheet()}
            capturePreviousView={capturePreviousView}
            setShowAccountPage={setShowAccountPage}
            showAccountPage={showAccountPage}
            setShowBookshelfCovers={setShowBookshelfCovers}
            setShowNotesView={setShowNotesView}
            setShowSortingResults={setShowSortingResults}
            handleRate={handleRate}
            handleUpdateReadingStatus={handleUpdateReadingStatus}
            selectingReadingStatusForExisting={selectingReadingStatusForExisting}
            setSelectingReadingStatusForExisting={setSelectingReadingStatusForExisting}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            showShareDialog={showShareDialog}
            setShowShareDialog={setShowShareDialog}
            showBookMenu={showBookMenu}
            setShowBookMenu={setShowBookMenu}
            selectingReadingStatusInRating={selectingReadingStatusInRating}
            setSelectingReadingStatusInRating={setSelectingReadingStatusInRating}
            isConfirmingDelete={isConfirmingDelete}
            setIsConfirmingDelete={setIsConfirmingDelete}
            isShowingNotes={isShowingNotes}
            setIsShowingNotes={setIsShowingNotes}
            editingDimension={editingDimension}
            setEditingDimension={setEditingDimension}
            showBookPageOnboarding={showBookPageOnboarding}
            setShowBookPageOnboarding={setShowBookPageOnboarding}
            setPendingBookMeta={setPendingBookMeta}
            setBooks={setBooks}
            setSelectedIndex={setSelectedIndex}
            chatSystem={{
              chatOpenedFromBookPage,
              setChatBookSelected,
              setShowChatPage,
              setCharacterChatContext,
              loadingCharacterChat,
              setLoadingCharacterChat,
              avatarButtonRefs,
              setAvatarExpandTransition,
            }}
            telegramSystem={{
              telegramTopics,
              setTelegramTopics,
              isLoadingTelegramTopic,
              setIsLoadingTelegramTopic,
              showTelegramJoinModal,
              setShowTelegramJoinModal,
            }}
            discussionSystem={{
              showBookDiscussion,
              setShowBookDiscussion,
              discussionQuestions,
              setDiscussionQuestions,
              isLoadingDiscussionQuestions,
              setIsLoadingDiscussionQuestions,
            }}
            bookReadersSystem={{
              bookReaders,
              setBookReaders,
              isLoadingBookReaders,
              setIsLoadingBookReaders,
            }}
            userAvatar={userAvatar}
            userName={userName}
            viewingUserId={viewingUserId}
            viewingUserIsPrivate={viewingUserIsPrivate}
            remoteFlags={remoteFlags}
            contentPreferences={contentPreferences}
            SpotlightSection={SpotlightSection}
            handleAddBook={handleAddBook}
            moreBelowAnimRef={moreBelowAnimRef}
          />
        )}
      </AnimatePresence>
      </Suspense>

      {/* Avatar expand transition — grows avatar to full screen then reveals chat */}
      <AnimatePresence>
        {avatarExpandTransition && (
          <motion.div
            key="avatar-expand"
            className="fixed inset-0 z-[200] flex items-center justify-center"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="absolute rounded-full overflow-hidden"
              initial={{
                top: avatarExpandTransition.rect.top,
                left: avatarExpandTransition.rect.left,
                width: avatarExpandTransition.rect.width,
                height: avatarExpandTransition.rect.height,
                borderRadius: 9999,
              }}
              animate={{
                top: 0,
                left: 0,
                width: typeof window !== 'undefined' ? window.innerWidth : 400,
                height: typeof window !== 'undefined' ? window.innerHeight : 800,
                borderRadius: 0,
              }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              onAnimationComplete={() => {
                setChatBookSelected(true);
                setShowChatPage(true);
                // Delay so chat renders behind, then clear overlay
                setTimeout(() => setAvatarExpandTransition(null), 150);
              }}
            >
              <img
                src={avatarExpandTransition.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pin confirmation toast */}
      <AnimatePresence>
        {pinConfirmText && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
            style={{ background: 'rgba(30, 30, 30, 0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          >
            <Bookmark size={14} className="text-white fill-white flex-shrink-0" />
            <span className="text-xs text-white font-medium">Saved to For later</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discovery swipe toast */}
      <AnimatePresence>
        {discoveryToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
            style={{ background: 'rgba(30, 30, 30, 0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          >
            <span className="text-xs text-white font-medium whitespace-nowrap">{discoveryToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Book page onboarding overlay — outside motion.main so fixed positioning works on mobile */}
      <AnimatePresence>
        {showBookPageOnboarding && activeBook && !showRatingOverlay && (
          <>
            <motion.div
              key="onboarding-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[60] bg-black/40"
              onClick={() => {
                setShowBookPageOnboarding(false);
                localStorage.setItem('hasSeenBookPageOnboarding', 'true');
              }}
            />
            <motion.div
              key="onboarding-tip"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="fixed left-10 right-10 bottom-[20vh] z-[80] flex flex-col items-center gap-3"
              onClick={() => {
                setShowBookPageOnboarding(false);
                localStorage.setItem('hasSeenBookPageOnboarding', 'true');
              }}
            >
              <div className="rounded-2xl px-5 py-4 text-center" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.4)' }}>
                <p className="text-base font-bold text-slate-900 mb-1">This is your book&apos;s page</p>
                <p className="text-sm text-slate-600">Everything about <span className="font-semibold">{activeBook.title}</span> — all in one place</p>
              </div>
              <span className="text-xs text-white/80 font-medium">Tap to dismiss</span>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <TriviaGame
        ref={triviaGameRef}
        books={books}
        isLoaded={isLoaded}
        user={user}
        showBookshelfCovers={showBookshelfCovers}
        viewingUserId={viewingUserId}
        isSelectMode={isSelectMode}
        isReviewer={isReviewer}
      />

      {/* Bottom Navigation Bar — hidden when BookChat is open or select mode is active */}
      {!(showChatPage && chatBookSelected) && !isSelectMode && (
      <div className="fixed left-0 right-0 z-[50] flex justify-center px-4 pointer-events-none" style={{ bottom: 'calc(16px + var(--safe-area-bottom, 0px))' }}>
          <motion.div
            key="nav-bar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
        <div 
          className="flex items-center gap-2 rounded-2xl px-3 py-2.5 pointer-events-auto"
          style={glassmorphicStyle}
        >
          {/* Bookshelf button - left (circular, grid view) */}
          <button
            onClick={() => {
              triggerLightHaptic();
              if (
                showBookshelfCovers &&
                !showFeedPage &&
                !showNotesView &&
                !showAccountPage &&
                !showSortingResults &&
                !showFollowingPage &&
                !showChatPage &&
                !viewingUserId
              ) {
                return; // Already on bookshelf, do nothing
              }
              analytics.trackEvent('nav', 'tap', { destination: 'bookshelf' });
              updateScrollY(0); // Reset scroll when switching views
              setViewingUserId(null);
              setViewingUserBooks([]);
              setViewingUserName('');
              setViewingUserFullName(null);
              setViewingUserAvatar(null);
              setShowBookshelfCovers(true);
              setShowNotesView(false);
              setShowAccountPage(false);
              setShowSortingResults(false);
              setShowFollowingPage(false);
              setShowFeedPage(false);
              setShowChatPage(false);
              setChatBookSelected(false);
              setShowCreatePost(false);
            }}
            className={`w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
              showBookshelfCovers
                ? 'bg-white/40 dark:bg-white/10 hover:bg-white/50 dark:bg-white/15'
                : 'bg-white/20 dark:bg-white/8 hover:bg-white/30 dark:bg-white/12'
            }`}
          >
            {featureFlags.hand_drawn_icons ? (
              <img src={getAssetPath("/library.svg")} alt="Library" className="w-[18px] h-[18px]" />
            ) : (
              <Library size={18} className="text-slate-700 dark:text-slate-300" />
            )}
          </button>

          {/* Chat button */}
          {!isReviewer && featureFlags.chat_enabled && remoteFlags.chat_enabled && (
              <button
                ref={chatNavButtonRef}
                onClick={() => {
                  triggerLightHaptic();
                  if (showChatPage) return;
                  analytics.trackEvent('nav', 'tap', { destination: 'chat_list' });
                  updateScrollY(0);
                  setChatBookSelected(false);
                  setShowChatPage(true);
                  setShowFeedPage(false);
                  setShowBookshelfCovers(false);
                  setShowNotesView(false);
                  setShowAccountPage(false);
                  setShowSortingResults(false);
                  setShowCreatePost(false);
                }}
                className={`relative w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
                  showChatPage
                    ? 'bg-white/40 dark:bg-white/10 hover:bg-white/50 dark:bg-white/15'
                    : 'bg-white/20 dark:bg-white/8 hover:bg-white/30 dark:bg-white/12'
                }`}
              >
                <MessageSquareHeart size={18} className="text-slate-700 dark:text-slate-300" />
                <AnimatePresence>
                  {chatComingSoon && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white whitespace-nowrap pointer-events-none z-50"
                      style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                    >
                      Coming soon!
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
          )}

          {/* Create post button */}
          {remoteFlags.create_post_enabled && <button
            onClick={() => {
              triggerLightHaptic();
              if (showCreatePost) return;
              analytics.trackEvent('nav', 'tap', { destination: 'create_post' });
              updateScrollY(0);
              setCreatePostText('');
              setShowCreatePost(true);
              setShowChatPage(false);
              setChatBookSelected(false);
              setShowFeedPage(false);
              setShowBookshelfCovers(false);
              setShowNotesView(false);
              setShowAccountPage(false);
              setShowSortingResults(false);
            }}
            className={`w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
              showCreatePost
                ? 'bg-white/40 dark:bg-white/10 hover:bg-white/50 dark:bg-white/15'
                : 'bg-white/20 dark:bg-white/8 hover:bg-white/30 dark:bg-white/12'
            }`}
          >
            <Plus size={20} className="text-slate-700 dark:text-slate-300" />
          </button>}

          {/* Feed button */}
          <button
            onClick={() => {
              triggerLightHaptic();
              if (showFeedPage) return; // Already on feed, do nothing
              analytics.trackEvent('nav', 'tap', { destination: 'feed' });
              updateScrollY(0);
              setViewingUserId(null);
              setViewingUserBooks([]);
              setViewingUserName('');
              setViewingUserFullName(null);
              setViewingUserAvatar(null);
              setShowFeedPage(true);
              setShowBookshelfCovers(false);
              setShowNotesView(false);
              setShowAccountPage(false);
              setShowSortingResults(false);
              setShowChatPage(false);
              setChatBookSelected(false);
              setShowCreatePost(false);
            }}
            className={`w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
              showFeedPage
                ? 'bg-white/40 dark:bg-white/10 hover:bg-white/50 dark:bg-white/15'
                : 'bg-white/20 dark:bg-white/8 hover:bg-white/30 dark:bg-white/12'
            }`}
          >
            {featureFlags.hand_drawn_icons ? (
              <img src={getAssetPath("/feed.svg")} alt="Feed" className="w-[18px] h-[18px]" />
            ) : (
              <Birdhouse size={18} className="text-slate-700 dark:text-slate-300" />
            )}
          </button>

          {/* Search button - right (circular) */}
          <button
            onClick={() => { triggerLightHaptic(); analytics.trackEvent('nav', 'tap', { destination: 'search' }); openAddBookSheet(); }}
            className="relative ml-auto w-11 h-11 rounded-full bg-white/20 dark:bg-white/8 hover:bg-white/30 dark:bg-white/12 active:scale-95 transition-all flex items-center justify-center"
          >
            {featureFlags.hand_drawn_icons ? (
              <img src={getAssetPath("/search.svg")} alt="Search" className="w-[18px] h-[18px]" />
            ) : (
              <Search size={18} className="text-slate-700 dark:text-slate-300" />
            )}
            <AnimatePresence>
              {showAddBookTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.9, x: '-50%' }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
                  exit={{ opacity: 0, y: 4, scale: 0.95, x: '-50%' }}
                  className="absolute bottom-full left-1/2 mb-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white whitespace-nowrap pointer-events-none z-50"
                  style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                >
                  Add a book!
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
          </motion.div>
      </div>
      )}

      {/* Unread chat badge — rendered outside glassmorphic nav to avoid blur */}
      {unreadChatCounts.size > 0 && !viewingBookFromOtherUser && !(showChatPage && chatBookSelected) && !showDiscoverySwipe && chatNavButtonRef.current && createPortal(
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            zIndex: 60,
            left: chatNavButtonRef.current.getBoundingClientRect().left + chatNavButtonRef.current.getBoundingClientRect().width * 0.55 + 2,
            top: chatNavButtonRef.current.getBoundingClientRect().top + chatNavButtonRef.current.getBoundingClientRect().height * 0.05 + 8,
          }}
        >
          <div className="w-[9px] h-[9px] rounded-full bg-blue-500" />
        </div>,
        document.body
      )}

      {/* Game Overlay */}
      <AnimatePresence>
        {(isPlayingGame && (gameBook1 && gameBook2 || isGameCompleting || showGameResults)) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !showGameResults) {
                setIsPlayingGame(false);
                setShowGameResults(false);
                setIsGameCompleting(false);
              }
            }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white/80 dark:bg-white/15 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30 dark:border-white/10 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="w-full flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-slate-400 rounded-full" />
              </div>
              
              <div className="px-4 pb-6 max-h-[90vh] overflow-y-auto">
                {/* Game Header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50">
                    {showGameResults ? 'Ranked Results' : 'Pick Your Favorite'}
                  </h2>
                  <button
                    onClick={() => {
                      setIsPlayingGame(false);
                      setShowGameResults(false);
                      setIsGameCompleting(false);
                    }}
                    className="w-8 h-8 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-md hover:bg-white/85 border border-white/30 dark:border-white/10 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                  >
                    <ChevronLeft size={16} className="text-slate-700 dark:text-slate-300 rotate-90" />
                  </button>
                </div>
              
                {/* Progress Bar - Show merge sort progress */}
                {!showGameResults && (() => {
                  const availableBooks = books.filter(b => b.reading_status === 'read_it');
                  const n = availableBooks.length;
                  const totalComparisons = getTotalMergeComparisons(n);
                  const comparedCount = getCurrentComparisonCount();
                  const progress = totalComparisons > 0 ? (comparedCount / totalComparisons) * 100 : 0;
                  
                  return (
                    <div className="mb-4">
                      <div className="text-xs text-slate-600 dark:text-slate-400 text-center mb-2">
                        {comparedCount} / ~{totalComparisons} comparisons ({Math.round(progress)}%)
                      </div>
                      <div className="w-full h-2 bg-slate-300/50 dark:bg-slate-600/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.3 }}
                          className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })()}
              
                {/* Two Books Side by Side - Hide when completing or showing results */}
                {!isGameCompleting && !showGameResults && gameBook1 && gameBook2 && (
                <div className="grid grid-cols-2 gap-4 relative">
                {/* Book 1 */}
                <AnimatePresence mode="wait">
                  <motion.button
                    key={gameBook1?.id || 'game-book-1'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                    // Record comparison: book1 beats book2
                    if (gameBook1 && gameBook2) {
                      const availableBooks = books.filter(b => b.reading_status === 'read_it');
                      recordMergeComparisonForGame(gameBook1.id, gameBook2.id, availableBooks);
                    }
                    
                    // Replace both books with next merge sort comparison
                    const availableBooks = books.filter(b => b.reading_status === 'read_it');
                    const nextPair = getNextMergePair(availableBooks);
                    
                    if (!nextPair) {
                      // Merge sort complete - show results immediately
                      setGameBook1(null);
                      setGameBook2(null);
                      setShowGameResults(true);
                      return;
                    }
                    
                    const [newBook1, newBook2] = nextPair;
                    setGameBook1(newBook1);
                    setGameBook2(newBook2);
                    setGameShownBooks(new Set([newBook1.id, newBook2.id]));
                    setGameRound(prev => prev + 1);
                  }}
                  className="flex items-center justify-center p-2 rounded-2xl hover:bg-white/20 dark:bg-white/8 transition-colors"
                >
                  {gameBook1 && (
                    <>
                      {gameBook1.cover_url ? (
                        <img 
                          src={gameBook1.cover_url} 
                          alt={gameBook1.title}
                          className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg"
                        />
                      ) : (
                        <div className={`w-full aspect-[2/3] flex items-center justify-center bg-gradient-to-br ${getGradient(gameBook1.id)} rounded-lg shadow-lg`}>
                          <BookOpen size={48} className="text-white opacity-50" />
                        </div>
                      )}
                    </>
                  )}
                </motion.button>
                </AnimatePresence>
                
                {/* Book 2 */}
                <AnimatePresence mode="wait">
                  <motion.button
                    key={gameBook2?.id || 'game-book-2'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                    // Record comparison: book2 beats book1
                    if (gameBook1 && gameBook2) {
                      const availableBooks = books.filter(b => b.reading_status === 'read_it');
                      recordMergeComparisonForGame(gameBook2.id, gameBook1.id, availableBooks);
                    }
                    
                    // Replace both books with next merge sort comparison
                    const availableBooks = books.filter(b => b.reading_status === 'read_it');
                    const nextPair = getNextMergePair(availableBooks);
                    
                    if (!nextPair) {
                      // Merge sort complete - show results immediately
                      setGameBook1(null);
                      setGameBook2(null);
                      setShowGameResults(true);
                      return;
                    }
                    
                    const [newBook1, newBook2] = nextPair;
                    setGameBook1(newBook1);
                    setGameBook2(newBook2);
                    setGameShownBooks(new Set([newBook1.id, newBook2.id]));
                    setGameRound(prev => prev + 1);
                  }}
                  className="flex items-center justify-center p-2 rounded-2xl hover:bg-white/20 dark:bg-white/8 transition-colors"
                >
                  {gameBook2 && (
                    <>
                      {gameBook2.cover_url ? (
                        <img 
                          src={gameBook2.cover_url} 
                          alt={gameBook2.title}
                          className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg"
                        />
                      ) : (
                        <div className={`w-full aspect-[2/3] flex items-center justify-center bg-gradient-to-br ${getGradient(gameBook2.id)} rounded-lg shadow-lg`}>
                          <BookOpen size={48} className="text-white opacity-50" />
                        </div>
                      )}
                    </>
                  )}
                </motion.button>
                </AnimatePresence>
                </div>
                )}
                
                {/* Completion Spinner - Show on top of empty dialog */}
                <AnimatePresence>
                  {isGameCompleting && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center min-h-[400px] rounded-3xl"
                    >
                      <div className="text-center">
                        <Lottie animationData={spinnerAnimation} loop={true} className="w-24 h-24 mx-auto" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Ranked Results List - Expand vertically after spinner */}
                <AnimatePresence>
                  {showGameResults && (() => {
                  const availableBooks = books.filter(b => b.reading_status === 'read_it');
                  // Reference resultsUpdateTrigger to force re-render after manual reorder
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                  const _trigger = resultsUpdateTrigger;
                  const sortedBooks = getSortedBooks(availableBooks);
                  
                  if (sortedBooks.length === 0) {
                    return (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                        className="flex items-center justify-center min-h-[200px] text-slate-700 dark:text-slate-300"
                      >
                        <p className="text-xs">No books to display</p>
                      </motion.div>
                    );
                  }
                  
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="space-y-3 mt-4"
                    >
                      {sortedBooks.map((book: BookWithRatings, index: number) => {
                        const isDragging = draggedBookId === book.id;
                        const isDragOver = dragOverIndex === index && draggedBookId !== book.id;

                        return (
                          <motion.div
                            key={book.id || `drag-${index}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ 
                              opacity: isDragging ? 0.5 : isDragOver ? 0.8 : 1, 
                              y: 0,
                              scale: isDragOver ? 1.02 : 1
                            }}
                            transition={{ delay: index * 0.05 }}
                            draggable
                            onDragStart={(e) => {
                              const dragEvent = e as unknown as React.DragEvent;
                              setDraggedBookId(book.id);
                              dragEvent.dataTransfer.effectAllowed = 'move';
                              dragEvent.dataTransfer.setData('text/plain', book.id);
                            }}
                            onDragOver={(e) => {
                              const dragEvent = e as unknown as React.DragEvent;
                              dragEvent.preventDefault();
                              dragEvent.dataTransfer.dropEffect = 'move';
                              if (draggedBookId !== book.id) {
                                setDragOverIndex(index);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverIndex === index) {
                                setDragOverIndex(null);
                              }
                            }}
                            onDrop={(e) => {
                              const dragEvent = e as unknown as React.DragEvent;
                              dragEvent.preventDefault();
                              const droppedBookId = dragEvent.dataTransfer.getData('text/plain');
                              
                              if (droppedBookId && droppedBookId !== book.id) {
                                // Find the old index of the dragged book
                                const oldIndex = sortedBooks.findIndex(b => b.id === droppedBookId);
                                
                                if (oldIndex !== -1 && oldIndex !== index) {
                                  // Create new order by moving the book
                                  const newSortedBooks = [...sortedBooks];
                                  const [movedBook] = newSortedBooks.splice(oldIndex, 1);
                                  newSortedBooks.splice(index, 0, movedBook);
                                  
                                  // Update comparison results to reflect new order
                                  updateComparisonResultsForManualMove(droppedBookId, index, newSortedBooks);
                                  
                                  // Force re-render by updating trigger state
                                  setResultsUpdateTrigger(prev => prev + 1);
                                }
                              }
                              
                              setDraggedBookId(null);
                              setDragOverIndex(null);
                            }}
                            onDragEnd={() => {
                              setDraggedBookId(null);
                              setDragOverIndex(null);
                            }}
                            className={`bg-white/80 dark:bg-white/15 backdrop-blur-md rounded-xl p-4 border border-white/30 dark:border-white/10 shadow-sm transition-all ${
                              isDragging ? 'cursor-grabbing opacity-50' : 'cursor-grab hover:bg-white/85'
                            } ${isDragOver ? 'border-blue-400 border-2' : ''}`}
                            onClick={(e) => {
                              // Only navigate if not dragging
                              if (!draggedBookId) {
                                const bookIndex = books.findIndex(b => b.id === book.id);
                                if (bookIndex !== -1) {
                                  setSelectedIndex(bookIndex);
                                  setIsPlayingGame(false);
                                  setShowGameResults(false);
                                  setShowBookshelfCovers(false);
                                  setShowNotesView(false);
                                  // Reset scroll to top
                                  updateScrollY(0);
                                  const main = document.querySelector('main');
                                  if (main) {
                                    main.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }
                              }
                            }}
                          >
                          <div className="flex gap-4 items-center">
                            {/* Drag Handle */}
                            <div className="flex-shrink-0 text-slate-400 cursor-grab active:cursor-grabbing">
                              <GripVertical size={20} />
                            </div>
                            
                            {/* Rank Number */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </div>
                            
                            {/* Book Cover */}
                            <div className="flex-shrink-0">
                              {book.cover_url ? (
                                <img 
                                  src={book.cover_url} 
                                  alt={book.title}
                                  className="w-16 h-24 object-cover rounded-lg shadow-sm"
                                />
                              ) : (
                                <div className={`w-16 h-24 rounded-lg flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                                  <BookOpen size={24} className="text-white opacity-50" />
                                </div>
                              )}
                            </div>
                            
                            {/* Book Info */}
                            <div className="flex-1 min-w-0">
                              <h2 className="text-xs font-bold text-slate-950 dark:text-slate-50 mb-1 line-clamp-1">{book.title}</h2>
                              <p className="text-xs text-slate-700 dark:text-slate-300 mb-1">{book.author}</p>
                              {book.genre && (
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{book.genre}</p>
                              )}
                              {(() => {
                                const avgScore = calculateAvg(book.ratings);
                                if (avgScore) {
                                  return (
                                    <div className="flex items-center gap-1">
                                      <Heart size={12} className="fill-pink-500 text-pink-500" />
                                      <span className="text-xs font-bold text-slate-950 dark:text-slate-50">{avgScore}</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </motion.div>
                        );
                      })}
                      
                      {/* Replay/Rank More Button - At bottom of list */}
                      {(() => {
                        const availableBooks = books.filter(b => b.reading_status === 'read_it');
                        const hasUnranked = hasUnrankedBooks(availableBooks);
                        const buttonText = hasUnranked ? 'Rank More' : 'Replay';
                        const buttonAction = hasUnranked ? () => {
                          // Continue ranking - just close results and start next comparison
                          setShowGameResults(false);
                          setIsGameCompleting(false);
                          
                          // Start next comparison
                          setTimeout(() => {
                            const availableBooks = books.filter(b => b.reading_status === 'read_it');
                            if (availableBooks.length >= 2) {
                              const mergePair = getNextMergePair(availableBooks);
                              if (mergePair) {
                                const [book1, book2] = mergePair;
                                setGameBook1(book1);
                                setGameBook2(book2);
                                setGameShownBooks(new Set([book1.id, book2.id]));
                                setGameRound(1);
                              } else {
                                // No more comparisons needed
                                setIsPlayingGame(false);
                              }
                            } else {
                              setIsPlayingGame(false);
                            }
                          }, 100);
                        } : () => {
                          // Reset merge sort state to replay
                          if (typeof window !== 'undefined') {
                            localStorage.removeItem('bookMergeSortState');
                            localStorage.removeItem('bookComparisonResults');
                          }
                          // Reset game state first - close results view
                          setShowGameResults(false);
                          setIsGameCompleting(false);
                          
                          // Then start new game after a brief delay to allow animation to reset
                          setTimeout(() => {
                            const availableBooks = books.filter(b => b.reading_status === 'read_it');
                            if (availableBooks.length >= 2) {
                              const mergePair = getNextMergePair(availableBooks);
                              if (mergePair) {
                                const [book1, book2] = mergePair;
                                setGameBook1(book1);
                                setGameBook2(book2);
                                setGameShownBooks(new Set([book1.id, book2.id]));
                                setGameRound(1);
                              } else {
                                // If somehow no pair available, just close
                                setIsPlayingGame(false);
                              }
                            } else {
                              // Not enough books, just close
                              setIsPlayingGame(false);
                            }
                          }, 100);
                        };
                        
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: sortedBooks.length * 0.05 }}
                            className="mt-4 pt-4 border-t border-white/30 dark:border-white/10"
                          >
                            <button
                              onClick={buttonAction}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 text-white active:scale-95 shadow-sm"
                            >
                              <Play size={16} />
                              <span>{buttonText}</span>
                            </button>
                          </motion.div>
                        );
                      })()}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
      <ConnectAccountModal
        isOpen={showConnectAccountModal}
        onClose={() => setShowConnectAccountModal(false)}
        reason={connectAccountReason}
        bookCount={books.length}
      />
      </Suspense>

      {/* Migration success toast */}
      <AnimatePresence>
        {migratedBooksCount !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
            onClick={() => setMigratedBooksCount(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300, duration: 0.4 }}
              className="relative w-full max-w-sm rounded-xl p-6 text-center"
              style={{
                background: 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(9.4px)',
                WebkitBackdropFilter: 'blur(9.4px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                }}
              >
                <Library size={24} className="text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Books migrated</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
                {migratedBooksCount} book{migratedBooksCount !== 1 ? 's' : ''} from your guest account {migratedBooksCount !== 1 ? 'have' : 'has'} been added to your library.
              </p>
              <button
                onClick={() => setMigratedBooksCount(null)}
                className="w-[180px] h-[44px] mx-auto rounded-lg flex items-center justify-center text-white font-bold active:scale-95 transition-all"
                style={{
                  background: 'rgba(59, 130, 246, 0.85)',
                  backdropFilter: 'blur(9.4px)',
                  WebkitBackdropFilter: 'blur(9.4px)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
      <AnimatePresence>
          {isAdding && (
            <AddBookSheet
              isOpen={isAdding}
              onClose={() => setIsAdding(false)}
              onAdd={handleAddBook}
              books={books}
              mode={addBookSheetMode}
              onSelectBook={(bookId) => {
                const bookIndex = books.findIndex(b => b.id === bookId);
                if (bookIndex !== -1) {
                  if (addBookSheetMode === 'chat_picker') {
                    // Undismiss so the chat reappears in the list
                    if (dismissedChatIds.has(bookId)) {
                      setDismissedChatIds(prev => {
                        const next = new Set(prev);
                        next.delete(bookId);
                        localStorage.setItem('dismissedChatIds', JSON.stringify([...next]));
                        return next;
                      });
                    }
                    // Navigate to this book's chat
                    setSelectedIndex(bookIndex);
                    setChatGeneralMode(false);
                    setChatBookSelected(true);
                    setShowChatPage(true);
                    setShowBookshelfCovers(false);
                    setShowNotesView(false);
                    setShowFeedPage(false);
                  } else {
                    setSelectedIndex(bookIndex);
                    setShowBookshelfCovers(false);
                    setShowNotesView(false);
                    setShowFeedPage(false);
                    setShowChatPage(false);
                    setChatBookSelected(false);
                  }
                }
              }}
              onSelectGeneral={() => {
                // Undismiss bookshelf chat
                const BID = '00000000-0000-0000-0000-000000000000';
                if (dismissedChatIds.has(BID)) {
                  setDismissedChatIds(prev => {
                    const next = new Set(prev);
                    next.delete(BID);
                    localStorage.setItem('dismissedChatIds', JSON.stringify([...next]));
                    return next;
                  });
                }
                setChatGeneralMode(true);
                setChatBookSelected(true);
                setShowChatPage(true);
                setShowBookshelfCovers(false);
                setShowNotesView(false);
                setShowFeedPage(false);
              }}
              onSelectUser={(userId) => {
                setViewingUserId(userId);
                setShowBookshelfCovers(true);
                setShowNotesView(false);
                setShowAccountPage(false);
                setShowFeedPage(false);
                setShowSortingResults(false);
                setShowFollowingPage(false);
                setIsAdding(false);
              }}
              onSearchAppleBooks={lookupBooksOnAppleBooks}
              onSearchWikipedia={lookupBooksOnWikipedia}
              onGetAISuggestions={getAISuggestions}
              characterAvatars={characterAvatars}
              characterChatList={characterChatList}
              onSelectCharacter={async (bookId, characterName, avatarUrl) => {
                const bookIndex = books.findIndex(b => b.id === bookId);
                if (bookIndex === -1) return;
                const book = books[bookIndex];
                setSelectedIndex(bookIndex);
                setLoadingCharacterChat(characterName);
                try {
                  const context = await getCharacterContext(characterName, book.title, book.author);
                  if (context) {
                    setCharacterChatContext({
                      characterName,
                      bookTitle: book.title,
                      bookAuthor: book.author,
                      context,
                      avatarUrl,
                    });
                    setChatBookSelected(true);
                    setShowChatPage(true);
                    setShowBookshelfCovers(false);
                    setShowNotesView(false);
                    setShowFeedPage(false);
                  }
                } catch (err) {
                  console.error('[ChatPicker] Error loading character context:', err);
                } finally {
                  setLoadingCharacterChat(false);
                }
              }}
            />
          )}
      </AnimatePresence>
      </Suspense>


        {/* Book Discussion Modal */}
        <AnimatePresence>
          {!isReviewer && showBookDiscussion && activeBook && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-white"
              style={backgroundImageStyle}
            >
              {/* Single scrollable page */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="h-full overflow-y-auto px-4 pt-8 pb-8 space-y-3 ios-scroll"
              >
                {/* Header (scrolls with content) */}
                <div
                  className="flex items-center justify-between py-3 px-4 rounded-2xl mb-4 mt-10"
                  style={standardGlassmorphicStyle}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowBookDiscussion(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                      style={standardGlassmorphicStyle}
                    >
                      <X size={18} className="text-slate-950 dark:text-slate-50" />
                    </button>
                    <div>
                      <h2 className="font-bold text-slate-950 dark:text-slate-50 text-sm">Discussions</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{activeBook.title}</p>
                    </div>
                  </div>
                  <div className="flex -space-x-1">
                    {/* Bot reader in discussions header */}
                    {activeBook?.canonical_book_id && telegramTopics.has(activeBook.canonical_book_id) && (
                      <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-6 h-6 rounded-full border border-sky-400 object-cover" title="Book.luver" />
                    )}
                    {bookReaders.slice(0, 3).map((reader) => (
                      reader.avatar ? (
                        <img
                          key={reader.id}
                          src={reader.avatar}
                          alt={reader.name}
                          className="w-6 h-6 shrink-0 rounded-full border border-white object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          key={reader.id}
                          className="w-6 h-6 shrink-0 rounded-full border border-white flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: avatarGradient(reader.id) }}
                          title={reader.name}
                        >
                          {reader.name.charAt(0).toUpperCase()}
                        </div>
                      )
                    ))}
                  </div>
                </div>

                {/* Section header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm" style={glassmorphicStyle}>
                    <Cloud size={16} className="text-slate-500 dark:text-slate-400" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Discussion Topics</span>
                  </div>
                </div>

                {isLoadingDiscussionQuestions ? (
                  // Loading skeleton
                  <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="space-y-3"
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="rounded-2xl p-4" style={standardGlassmorphicStyle}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-300/50 dark:bg-slate-600/50 flex-shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="w-16 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                            <div className="w-full h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                            <div className="w-3/4 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : discussionQuestions.length > 0 ? (
                  // Discussion questions
                  discussionQuestions.map((question, index) => {
                    const categoryColors: Record<string, string> = {
                      'themes': 'bg-purple-100 text-purple-700',
                      'characters': 'bg-blue-100 text-blue-700',
                      'writing style': 'bg-green-100 text-green-700',
                      'ethics': 'bg-red-100 text-red-700',
                      'personal reflection': 'bg-amber-100 text-amber-700',
                      'real world': 'bg-cyan-100 text-cyan-700',
                    };
                    const colorClass = categoryColors[question.category] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';

                    return (
                      <motion.div
                        key={question.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="rounded-2xl p-4"
                        style={standardGlassmorphicStyle}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{question.id}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${colorClass}`}>
                                {question.category}
                              </span>
                            </div>
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{question.question}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  // Empty state
                  <div className="rounded-xl p-4 text-center" style={standardGlassmorphicStyle}>
                    <p className="text-xs text-slate-600 dark:text-slate-400">No discussion topics available yet.</p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Book Infographic Modal */}
        <AnimatePresence>
          {showInfographicModal && activeBook && bookInfographics.has(activeBook.id) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-white"
              style={backgroundImageStyle}
            >
              {(() => {
                const infographic = bookInfographics.get(activeBook.id)!;
                const phaseColors: Record<string, string> = {
                  'opening': 'bg-emerald-500',
                  'early_setup': 'bg-blue-500',
                  'early_story': 'bg-purple-500',
                  'mid_story': 'bg-amber-500',
                };
                const phaseLabels: Record<string, string> = {
                  'opening': 'Opening',
                  'early_setup': 'Early Setup',
                  'early_story': 'Early Story',
                  'mid_story': 'Mid Story',
                };

                // Lucide icon mapping for timeline events
                const iconMap: Record<string, LucideIcon> = {
                  Sunrise, Sunset, Users, User, UserPlus, MapPin, Compass, MessageCircle,
                  Swords, Shield, Heart, Eye, AlertTriangle, Home, Building, Skull, Gift,
                  Lock, Unlock, Flag, Crown, Flame, Footprints, Handshake, Hammer, Key,
                  Mountain, Ship, Tent, TreePine, Wind, Workflow, Megaphone, ScrollText,
                  Feather, Scale, Bomb, Ghost, Wand2, Anchor, BellRing, Bird, Briefcase,
                  Car, Coffee, Drama, Clock, Star, BookOpen, Lightbulb, Target, Search,
                  Sparkles, X, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2,
                  CheckCircle2, Circle, ExternalLink, Info, Play, Pencil, Trophy, Rss,
                  Network, MapIcon, UserCircle,
                };

                const getTimelineIcon = (iconName?: string): LucideIcon => {
                  if (!iconName) return Circle;
                  // Try exact match first
                  if (iconMap[iconName]) return iconMap[iconName];
                  // Try case-insensitive match
                  const lowerName = iconName.toLowerCase();
                  const matchedKey = Object.keys(iconMap).find(k => k.toLowerCase() === lowerName);
                  if (matchedKey) return iconMap[matchedKey];
                  // Default fallback
                  return Circle;
                };

                // Glassmorphic card component following design guidelines
                const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
                  <div
                    className={`rounded-xl ${className}`}
                    style={{
                      background: 'rgba(255, 255, 255, 0.6)',
                      backdropFilter: 'blur(9.4px)',
                      WebkitBackdropFilter: 'blur(9.4px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    {children}
                  </div>
                );

                return (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="h-full overflow-y-auto px-5 pt-8 pb-16 ios-scroll"
                  >
                    {/* Header */}
                    <header className="space-y-4 mb-8 mt-10">
                      {/* Header bar - same style as discussion topics */}
                      <div
                        className="flex items-center justify-between py-3 px-4 rounded-2xl"
                        style={standardGlassmorphicStyle}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setShowInfographicModal(false)}
                            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                            style={standardGlassmorphicStyle}
                          >
                            <X size={18} className="text-slate-950 dark:text-slate-50" />
                          </button>
                          <div>
                            <h2 className="font-bold text-slate-950 dark:text-slate-50 text-sm">Reader's Guide</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{activeBook.title}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={glassmorphicStyle}>
                          <MapIcon size={14} className="text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>

                      {/* Book title and author */}
                      <div className="text-center pt-4">
                        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-tight px-4">
                          {activeBook.title}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.2em] text-xs mt-2">{activeBook.author}</p>
                      </div>

                      <div className="flex justify-center pt-4">
                        <motion.div
                          animate={{ y: [0, 6, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="p-2.5 rounded-full"
                          style={glassmorphicStyle}
                        >
                          <ChevronDown size={20} className="text-slate-400" />
                        </motion.div>
                      </div>
                    </header>

                    {/* Section 1: Core Cast */}
                    {infographic.core_cast && infographic.core_cast.length > 0 && (
                      <section className="space-y-4 mb-10">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 flex items-center gap-2 px-1">
                          <Star size={16} /> Main Characters
                        </h2>
                        <div className="space-y-4">
                          {infographic.core_cast.map((char, index) => (
                            <motion.div
                              key={`core-${index}`}
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.08 }}
                            >
                              <GlassCard className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight">{char.name}</h3>
                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1.5">{char.role}</p>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">"{char.short_identity}"</p>

                                  <div className="grid grid-cols-2 gap-4 border-t border-slate-200/50 pt-4">
                                    {char.main_goal && (
                                      <div>
                                        <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                          <Target size={14} /> Goal
                                        </h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{char.main_goal}</p>
                                      </div>
                                    )}
                                    {char.key_connections && char.key_connections.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                          <Users size={14} /> Ties
                                        </h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{char.key_connections.join(', ')}</p>
                                      </div>
                                    )}
                                  </div>

                                  {char.why_reader_should_track && (
                                    <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-100/50">
                                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                        <span className="text-blue-600 dark:text-blue-400 font-black uppercase text-xs mr-1.5">Reader Tip:</span>
                                        {char.why_reader_should_track}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </GlassCard>
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Section 2: The Ensemble (Other Characters) */}
                    {infographic.full_character_list && infographic.full_character_list.filter(c => c.importance !== 'major').length > 0 && (
                      <section className="space-y-4 mb-10">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-purple-600 flex items-center gap-2 px-1">
                          <Users size={16} /> Supporting Characters
                        </h2>
                        <div className="space-y-3">
                          {infographic.full_character_list.filter(c => c.importance !== 'major').map((char, index) => (
                            <motion.div
                              key={`ensemble-${index}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.04 }}
                            >
                              <GlassCard className="p-4 flex items-center gap-3">
                                <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${char.importance === 'supporting' ? 'bg-purple-500' : 'bg-slate-300'}`} />
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-base font-black text-slate-900 dark:text-slate-100">{char.name}</h4>
                                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">{char.short_identity}</p>
                                </div>
                                <div className="text-xs font-black text-slate-400 uppercase tracking-tight">
                                  {char.importance}
                                </div>
                              </GlassCard>
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Section 3: Journey Roadmap (Timeline) */}
                    {infographic.plot_timeline && infographic.plot_timeline.length > 0 && (
                      <section className="space-y-4 mb-10">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-2 px-1">
                          <Clock size={16} /> Timeline
                        </h2>
                        <div className="relative ml-4 pl-8 space-y-6 pb-4">
                          {/* Vertical timeline line - centered with icons */}
                          <div
                            className="absolute top-0 bottom-0 w-[2px] rounded-full"
                            style={{
                              left: '5px',
                              background: 'rgba(255, 255, 255, 0.5)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                            }}
                          />
                          {infographic.plot_timeline.map((event, index) => {
                            const TimelineIcon = getTimelineIcon(event.icon);
                            return (
                              <motion.div
                                key={`timeline-${index}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.06 }}
                                className="relative"
                              >
                                {/* Timeline icon - glassmorphic style, aligned with header */}
                                <div
                                  className="absolute -left-[38px] -top-[2px] w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.7)',
                                    backdropFilter: 'blur(9.4px)',
                                    WebkitBackdropFilter: 'blur(9.4px)',
                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                  }}
                                >
                                  <TimelineIcon
                                    size={16}
                                    strokeWidth={2}
                                    className={
                                      event.phase === 'opening' ? 'text-emerald-600' :
                                      event.phase === 'early_setup' ? 'text-blue-600 dark:text-blue-400' :
                                      event.phase === 'early_story' ? 'text-purple-600' :
                                      event.phase === 'mid_story' ? 'text-amber-600' :
                                      'text-slate-600 dark:text-slate-400'
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">{event.event_label}</h4>
                                  <GlassCard className="p-4">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{event.what_happens}</p>
                                    {event.characters_involved && event.characters_involved.length > 0 && (
                                      <div className="flex items-center gap-2 pt-3 border-t border-slate-200/30 text-xs font-black uppercase text-slate-400 tracking-tight">
                                        <Users size={14} /> {event.characters_involved.join(', ')}
                                      </div>
                                    )}
                                    {event.why_it_helps_orientation && (
                                      <p className="text-sm text-emerald-600 font-medium mt-3 pt-3 border-t border-slate-200/30">
                                        💡 {event.why_it_helps_orientation}
                                      </p>
                                    )}
                                  </GlassCard>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* Footer */}
                    <div className="pt-10 flex flex-col items-center gap-3 opacity-40">
                      <BookOpen size={24} className="text-slate-500 dark:text-slate-400" />
                      <p className="text-xs uppercase font-black tracking-[0.3em] text-slate-500 dark:text-slate-400">End of Guide</p>
                    </div>
                  </motion.div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick View Modal for Books from Other Users */}
      <AnimatePresence>
          {viewingBookFromOtherUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[100] flex items-center justify-center px-4"
              onClick={() => setViewingBookFromOtherUser(null)}
            >
              {/* Full screen glassmorphic background */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0"
                style={{ ...standardGlassmorphicStyle, borderRadius: 0 }}
              />
              
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className="relative flex flex-col items-center pointer-events-auto z-10 p-4"
                style={{ maxHeight: '80vh' }}
              >
                {/* Close button - top right */}
                <button
                  onClick={() => setViewingBookFromOtherUser(null)}
                  className="absolute top-[-50px] right-0 w-8 h-8 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-md hover:bg-white/85 border border-white/30 dark:border-white/10 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                >
                  <X size={16} className="text-slate-700 dark:text-slate-300" />
                </button>
                {/* Book Cover - matching book page style */}
                <div
                  className="relative w-[190px] aspect-[2/3] overflow-hidden rounded-lg cursor-pointer"
                  style={{
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), 0 0 30px 5px rgba(255, 255, 255, 0.3)',
                  }}
                  onClick={() => setViewingBookFromOtherUser(null)}
                >
                  {viewingBookFromOtherUser.cover_url ? (
                    <img
                      src={viewingBookFromOtherUser.cover_url}
                      alt={viewingBookFromOtherUser.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                      <BookOpen size={48} className="text-slate-400" />
                    </div>
                  )}

                  {/* Rating Display - Bottom Left Corner */}
                  {(() => {
                    const avgScore = calculateAvg(viewingBookFromOtherUser.ratings);
                    if (avgScore) {
                      return (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
                          <Heart size={14} className="fill-pink-500 text-pink-500" />
                          <span className="text-sm font-bold text-white">
                            {avgScore}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Book Info */}
                <div className="mt-4 text-center space-y-2 max-w-[272px]">
                  <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                    {viewingBookFromOtherUser.title}
                  </h2>
                  {viewingBookFromOtherUser.author && (
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      {viewingBookFromOtherUser.author}
                    </p>
                  )}
                  {viewingBookFromOtherUser.publish_year && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {viewingBookFromOtherUser.publish_year}
                    </p>
                  )}
                </div>

                {/* Summary — fade in smoothly when loaded */}
                <AnimatePresence>
                  {overlayBookSummary && (
                    <motion.p
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed text-center max-w-[272px] line-clamp-6 overflow-hidden"
                    >
                      {overlayBookSummary}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Add Button */}
                <button
                  onClick={async () => {
                    if (!user) return;

                    // Prepare book metadata (exclude user-specific fields)
                    const bookMeta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> = {
                      title: viewingBookFromOtherUser.title || '',
                      author: viewingBookFromOtherUser.author || 'Unknown Author',
                      publish_year: viewingBookFromOtherUser.publish_year || null,
                      cover_url: viewingBookFromOtherUser.cover_url || null,
                      wikipedia_url: viewingBookFromOtherUser.wikipedia_url || null,
                      google_books_url: viewingBookFromOtherUser.google_books_url || null,
                      genre: viewingBookFromOtherUser.genre || null,
                      first_issue_year: viewingBookFromOtherUser.first_issue_year || null,
                      summary: (viewingBookFromOtherUser as any).summary || null,
                      notes: null, // Don't copy notes
                      reading_status: null, // User will set this
                    };

                    // Close the modal first
                    setViewingBookFromOtherUser(null);

                    // Close bookshelf views
                    setViewingUserId(null);
                    setShowBookshelfCovers(false);
                    setShowNotesView(false);
                    setShowAccountPage(false);
                    setShowFeedPage(false);

                    // Add the book - handleAddBook will handle navigation
                    await handleAddBook(bookMeta);
                  }}
                  className="mt-4 py-2.5 px-8 text-white font-bold rounded-xl active:scale-95 transition-all"
                  style={{
                    background: 'rgba(59, 130, 246, 0.85)',
                    backdropFilter: 'blur(9.4px)',
                    WebkitBackdropFilter: 'blur(9.4px)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  Add book
                </button>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Telegram Join Modal */}
      <AnimatePresence>
        {showTelegramJoinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setShowTelegramJoinModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center"
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(9.4px)',
                WebkitBackdropFilter: 'blur(9.4px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <MessagesSquare size={32} className="text-blue-600 dark:text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50 mb-2">Join the Book Chat</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
                To discuss this book with others, first join our Telegram group. Then come back and tap the chat button again to jump straight to the conversation.
              </p>
              <button
                onClick={() => {
                  localStorage.setItem('hasJoinedTelegramGroup', 'true');
                  window.open('https://t.me/bookluvgroup', '_blank');
                  setShowTelegramJoinModal(false);
                }}
                className="w-full py-2.5 rounded-xl text-white font-bold text-sm active:scale-95 transition-all"
                style={{
                  background: 'rgba(59, 130, 246, 0.85)',
                  backdropFilter: 'blur(9.4px)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                Join Group
              </button>
              <button
                onClick={() => setShowTelegramJoinModal(false)}
                className="mt-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discovery Swipe Modal */}
      <AnimatePresence>
        {showDiscoverySwipe && (
          <Suspense fallback={null}>
            <BookDiscoverySwipe
              isOpen={showDiscoverySwipe}
              onClose={(booksAdded) => {
                setShowDiscoverySwipe(false);
                if (booksAdded && booksAdded > 0) {
                  setDiscoveryToast(`${booksAdded} book${booksAdded !== 1 ? 's' : ''} added`);
                  setTimeout(() => setDiscoveryToast(null), 3000);
                }
              }}
              onNotEnoughBooks={() => {
                setDiscoveryToast('Not enough new books to sort right now');
                setTimeout(() => setDiscoveryToast(null), 3000);
              }}
              existingBookKeys={existingBookKeys}
              onAddBook={handleDiscoveryAddBook}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* About Screen Modal */}
      <AnimatePresence>
        {showAboutScreen && (
          <OnboardingScreen
            variant={featureFlags.info_page_variant}
            userId={user?.id}
            contentPreferences={contentPreferences}
            onClose={() => setShowAboutScreen(false)}
            onOpenAddBook={() => openAddBookSheet()}
            onSavePreferences={(prefs) => {
              setContentPreferences(prefs);
              localStorage.setItem('contentPreferences', JSON.stringify(prefs));
              if (user) supabase.from('users').update({ content_preferences: prefs }).eq('id', user.id).then(() => {});
            }}
            triggerLightHaptic={triggerLightHaptic}
          />
        )}
      </AnimatePresence>


      {/* Screenshot Mode Overlay - for App Store screenshots */}
      {screenshotMode && (
        <>
          <div
            className="fixed left-0 right-0 z-[10000] flex justify-center px-6 pointer-events-none"
            style={{ bottom: 'calc(48px + var(--safe-area-bottom, 0px))' }}
          >
            <div
              className="text-center"
              style={{
                padding: '20px 32px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: 20,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                maxWidth: '90%',
              }}
            >
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {screenshotOverlayText}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
