'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  LogOut,
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
  Minus,
  Film,
  Tv,
  Music,
  Disc3,
  Settings2,
  Image as ImageIcon,
  Quote,
  type LucideIcon,
  StickyNote,
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
import ArrowAnimation from './components/ArrowAnimation';
import LightbulbAnimation from './components/LightbulbAnimation';
import RatingStars, { RATING_FEEDBACK } from './components/RatingStars';
import AddBookSheet from './components/AddBookSheet';
import ConnectAccountModal from './components/ConnectAccountModal';
import BookChat from './components/BookChat';
import NotesEditorOverlay from './components/NotesEditorOverlay';
import AccountPage from './components/AccountPage';
import FollowingPage from './components/FollowingPage';
import { getChatList, deleteChatForBook, getCharacterChatList, deleteCharacterChat, lookupOrphanedChatCoverUrls, reassignChatsToBook, getProactiveCandidates, generateProactiveMessage, markProactiveReplied, type ChatListItem, type CharacterChatListItem, type BookChatContext } from './services/chat-service';
import { getCached, setCache, CACHE_KEYS } from './services/cache-service';
import HeartButton from './components/HeartButton';
import { getContentHash, toggleHeart, loadHearts } from './services/heart-service';
import BookSummaryComponent from './components/BookSummary';
import CharacterAvatars from './components/CharacterAvatars';
// CharacterChat removed — character chats now use BookChat with characterContext prop
import { getBookSummary } from './services/book-summary-service';
import { getCharacterAvatars, getCharacterContext } from './services/character-avatars-service';
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

// Feed card glassmorphism style
const feedCardStyle = {
  background: 'rgba(255, 255, 255, 0.45)',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
};

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
import { convertBookToApp, calculateAvg, calculateScore, getGradient } from './services/book-utils';
import { lookupBooksOnAppleBooks } from './services/apple-books-service';
import { lookupBooksOnWikipedia } from './services/wikipedia-service';
import { getAISuggestions } from './services/book-search-service';
import { getGoogleScholarAnalysis } from './services/articles-service';
import { getYouTubeVideos } from './services/youtube-service';
import { getTelegramTopic, getOrCreateTelegramTopic } from './services/telegram-service';
import { getDiscussionQuestions } from './services/discussion-service';
import { getGrokBookInfographicWithSearch } from './services/infographic-service';
import { ensureTriviaQuestionsForBook } from './services/trivia-service';
import { getAuthorFacts, getBookInfluences, getBookDomain, getBookContext, getDidYouKnow, getFirstIssueYear } from './services/insights-service';
import { getPodcastEpisodes } from './services/podcast-service';
import { getRelatedBooks } from './services/related-books-service';
import { getRelatedMovies } from './services/related-movies-service';
import { createFriendBookFeedItem, generateFeedItemsForBook, getPersonalizedFeed, markFeedItemsAsShown, getReadFeedItems, setFeedItemReadStatus, getSpoilerRevealedFromStorage, loadSpoilerRevealedFromStorage, saveSpoilerRevealedToStorage } from './services/feed-service';
import { analytics } from './services/analytics-service';

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
  const [isLoadingViewingUserBooks, setIsLoadingViewingUserBooks] = useState(false);
  const [isFadingOutViewingUser, setIsFadingOutViewingUser] = useState(false);
  const [isFollowingViewingUser, setIsFollowingViewingUser] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [myFollowingCount, setMyFollowingCount] = useState(0);
  const [viewingUserFollowingCount, setViewingUserFollowingCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastSelectedBookIndex');
      const parsed = saved ? parseInt(saved, 10) : 0;
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  });
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
  
  // Swipe detection state for book navigation
  const [bookTouchStart, setBookTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [bookTouchEnd, setBookTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50;
  
  // Handle book navigation swipe
  const handleBookSwipe = () => {
    if (!bookTouchStart || !bookTouchEnd) return;

    // Don't allow swiping when in notes editor
    if (isShowingNotes) return;
    
    const distanceX = bookTouchStart.x - bookTouchEnd.x;
    const distanceY = bookTouchStart.y - bookTouchEnd.y;
    
    // Only handle horizontal swipes (ignore if vertical scroll is more dominant)
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      triggerMediumHaptic();
      if (distanceX > 0) {
        // Swipe left = next book
        setSelectedIndex(prev => (prev < books.length - 1 ? prev + 1 : 0));
      } else {
        // Swipe right = previous book
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : books.length - 1));
      }
    }
    
    // Reset touch state
    setBookTouchStart(null);
    setBookTouchEnd(null);
  };
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
  const [loadingFactsForBookId, setLoadingFactsForBookId] = useState<string | null>(null);
  const [bookInfluences, setBookInfluences] = useState<Map<string, string[]>>(new Map());
  const [loadingInfluencesForBookId, setLoadingInfluencesForBookId] = useState<string | null>(null);
  const [bookDomain, setBookDomain] = useState<Map<string, DomainInsights>>(new Map());
  const [loadingDomainForBookId, setLoadingDomainForBookId] = useState<string | null>(null);
  const [bookContext, setBookContext] = useState<Map<string, string[]>>(new Map());
  const [loadingContextForBookId, setLoadingContextForBookId] = useState<string | null>(null);
  const [didYouKnow, setDidYouKnow] = useState<Map<string, DidYouKnowItem[]>>(new Map());
  const [loadingDidYouKnowForBookId, setLoadingDidYouKnowForBookId] = useState<string | null>(null);
  const [loadingPodcastsForBookId, setLoadingPodcastsForBookId] = useState<string | null>(null);
  const [podcastEpisodes, setPodcastEpisodes] = useState<Map<string, { curated: PodcastEpisode[]; apple: PodcastEpisode[] }>>(new Map());
  const [loadingAnalysisForBookId, setLoadingAnalysisForBookId] = useState<string | null>(null);
  const [analysisArticles, setAnalysisArticles] = useState<Map<string, AnalysisArticle[]>>(new Map());
  const [loadingVideosForBookId, setLoadingVideosForBookId] = useState<string | null>(null);
  const [youtubeVideos, setYoutubeVideos] = useState<Map<string, YouTubeVideo[]>>(new Map());
  const [loadingRelatedForBookId, setLoadingRelatedForBookId] = useState<string | null>(null);
  const [relatedBooks, setRelatedBooks] = useState<Map<string, RelatedBook[]>>(new Map());
  const [loadingRelatedMoviesForBookId, setLoadingRelatedMoviesForBookId] = useState<string | null>(null);
  const [relatedMovies, setRelatedMovies] = useState<Map<string, RelatedMovie[]>>(new Map());
  const [loadingResearchForBookId, setLoadingResearchForBookId] = useState<string | null>(null);
  const [researchData, setResearchData] = useState<Map<string, BookResearch>>(new Map());
  const [selectedInsightCategory, setSelectedInsightCategory] = useState<string>('trivia'); // 'trivia' or pillar names from research
  const [isInsightCategoryDropdownOpen, setIsInsightCategoryDropdownOpen] = useState(false);
  // Book summary state
  const [bookSummaries, setBookSummaries] = useState<Map<string, import('./types').BookSummary>>(new Map());
  const [loadingSummaryForBookId, setLoadingSummaryForBookId] = useState<string | null>(null);
  // Character avatars state
  const [characterAvatars, setCharacterAvatars] = useState<Map<string, import('./types').CharacterAvatar[]>>(new Map());
  const [loadingAvatarsForBookId, setLoadingAvatarsForBookId] = useState<string | null>(null);
  // Book infographic state
  const [bookInfographics, setBookInfographics] = useState<Map<string, BookInfographic>>(new Map());
  const [loadingInfographicForBookId, setLoadingInfographicForBookId] = useState<string | null>(null);
  const [showInfographicModal, setShowInfographicModal] = useState(false);
  const [infographicSection, setInfographicSection] = useState<'characters' | 'timeline'>('characters');
  const [isInfographicDropdownOpen, setIsInfographicDropdownOpen] = useState(false);
  const bookshelfGroupingDropdownRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Scroll to top when status bar area is tapped (iOS pattern)
  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  // Helper function to get last page from localStorage
  const getLastPageState = (): { showBookshelf: boolean; showBookshelfCovers: boolean; showNotesView: boolean; showAccountPage: boolean; showFollowingPage: boolean; showFeedPage: boolean } => {
    if (typeof window === 'undefined') {
      return { showBookshelf: false, showBookshelfCovers: false, showNotesView: false, showAccountPage: false, showFollowingPage: false, showFeedPage: false };
    }
    try {
      const saved = localStorage.getItem('lastPageState');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          showBookshelf: parsed.showBookshelf === true,
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
    return { showBookshelf: false, showBookshelfCovers: false, showNotesView: false, showAccountPage: false, showFollowingPage: false, showFeedPage: false };
  };

  // Helper function to save current page state to localStorage
  const savePageState = (state: { showBookshelf: boolean; showBookshelfCovers: boolean; showNotesView: boolean; showAccountPage: boolean; showFollowingPage: boolean; showFeedPage: boolean }) => {
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
    else if (showBookshelf) previousViewRef.current = 'bookshelf-spines';
    else previousViewRef.current = 'book-detail';
  };
  const restorePreviousView = (): void => {
    setShowAccountPage(false);
    setShowFollowingPage(false);
    setShowNotesView(false);
    setShowCreatePost(false);
    const target = previousViewRef.current;
    if (target === 'book-detail') {
      setShowBookshelf(false);
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
      setShowBookshelf(true);
    } else {
      setShowBookshelfCovers(true);
    }
    previousViewRef.current = 'bookshelf-covers';
  };

  // Initialize page states from localStorage
  const [showAccountPage, setShowAccountPage] = useState(() => getLastPageState().showAccountPage);
  const [showBookshelf, setShowBookshelf] = useState(() => getLastPageState().showBookshelf);
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
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [characterChatList, setCharacterChatList] = useState<CharacterChatListItem[]>([]);
  const [chatListLoading, setChatListLoading] = useState(false);
  const [unreadChatCounts, setUnreadChatCounts] = useState<Map<string, number>>(new Map());
  const [orphanedChatBook, setOrphanedChatBook] = useState<{ id: string; title: string; author: string; cover_url?: string | null } | null>(null);
  useEffect(() => { if (!chatBookSelected) setOrphanedChatBook(null); }, [chatBookSelected]);
  const [chatSwipeId, setChatSwipeId] = useState<string | null>(null);
  const [deletingChatKey, setDeletingChatKey] = useState<string | null>(null);
  const chatSwipeRef = useRef<{ startX: number; currentX: number; bookId: string } | null>(null);
  const chatPullDistance = useRef(0);
  const [chatRefreshing, setChatRefreshing] = useState(false);
  const chatPullStartY = useRef<number | null>(null);
  const feedPullDistance = useRef(0);
  const feedPullIndicatorRef = useRef<HTMLDivElement>(null);
  const feedPullContentRef = useRef<HTMLDivElement>(null);
  const feedPullLottieRef = useRef<HTMLDivElement>(null);
  const chatPullIndicatorRef = useRef<HTMLDivElement>(null);
  const chatPullContentRef = useRef<HTMLDivElement>(null);
  const chatPullLottieRef = useRef<HTMLDivElement>(null);
  const headerPullRef = useRef<HTMLDivElement>(null);

  const updateFeedPullDOM = (dist: number) => {
    feedPullDistance.current = dist;
    if (feedPullIndicatorRef.current) {
      feedPullIndicatorRef.current.style.top = `${60 + dist}px`;
      feedPullIndicatorRef.current.style.transition = feedPullStartY.current !== null ? 'none' : 'top 0.3s ease-out';
      feedPullIndicatorRef.current.style.display = dist > 0 ? '' : '';
    }
    if (feedPullLottieRef.current) {
      feedPullLottieRef.current.style.opacity = String(Math.min(dist / 30, 1));
    }
    if (feedPullContentRef.current) {
      feedPullContentRef.current.style.transform = `translateY(${dist}px)`;
      feedPullContentRef.current.style.transition = feedPullStartY.current !== null ? 'none' : 'transform 0.3s ease-out';
    }
    if (headerPullRef.current) {
      headerPullRef.current.style.transform = `translateY(${dist || chatPullDistance.current}px)`;
      headerPullRef.current.style.transition = (feedPullStartY.current !== null || chatPullStartY.current !== null) ? 'none' : 'transform 0.3s ease-out';
    }
  };

  const updateChatPullDOM = (dist: number) => {
    chatPullDistance.current = dist;
    if (chatPullIndicatorRef.current) {
      chatPullIndicatorRef.current.style.top = `${60 + dist}px`;
      chatPullIndicatorRef.current.style.transition = chatPullStartY.current !== null ? 'none' : 'top 0.3s ease-out';
    }
    if (chatPullLottieRef.current) {
      chatPullLottieRef.current.style.opacity = String(Math.min(dist / 30, 1));
    }
    if (chatPullContentRef.current) {
      chatPullContentRef.current.style.transform = `translateY(${dist}px)`;
      chatPullContentRef.current.style.transition = chatPullStartY.current !== null ? 'none' : 'transform 0.3s ease-out';
    }
    if (headerPullRef.current) {
      headerPullRef.current.style.transform = `translateY(${feedPullDistance.current || dist}px)`;
      headerPullRef.current.style.transition = (feedPullStartY.current !== null || chatPullStartY.current !== null) ? 'none' : 'transform 0.3s ease-out';
    }
  };
  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [feedRefreshDone, setFeedRefreshDone] = useState(false);
  const [feedRefreshFading, setFeedRefreshFading] = useState(false);
  const feedPullStartY = useRef<number | null>(null);
  const feedHapticFired = useRef(false);
  const feedLottieRef = useRef<any>(null);
  const [chatRefreshDone, setChatRefreshDone] = useState(false);
  const [chatRefreshFading, setChatRefreshFading] = useState(false);
  const chatHapticFired = useRef(false);
  const chatLottieRef = useRef<any>(null);
  const [dismissedChatIds, setDismissedChatIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try { return new Set(JSON.parse(localStorage.getItem('dismissedChatIds') || '[]')); } catch { return new Set(); }
  });
  const [showAboutScreen, setShowAboutScreen] = useState(false);
  const [showBookPageOnboarding, setShowBookPageOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('hasSeenBookPageOnboarding');
  });
  const [showAddBookTooltip, setShowAddBookTooltip] = useState(false);
  useEffect(() => {
    if ((showBookshelfCovers || showBookshelf) && books.length < 5 && books.length > 0) {
      setShowAddBookTooltip(true);
      const timer = setTimeout(() => setShowAddBookTooltip(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowAddBookTooltip(false);
    }
  }, [showBookshelfCovers, showBookshelf, books.length]);
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
  const [feedView, setFeedView] = useState<'following' | 'community'>('following');
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [personalizedFeedItems, setPersonalizedFeedItems] = useState<PersonalizedFeedItem[]>([]);
  const [isLoadingPersonalizedFeed, setIsLoadingPersonalizedFeed] = useState(false);
  const [feedDisplayCount, setFeedDisplayCount] = useState(8);
  const [feedFilter, setFeedFilter] = useState<'all' | 'unread'>('all');
  const [feedTypeFilter, setFeedTypeFilter] = useState<'all' | 'fact' | 'context' | 'drilldown' | 'influence' | 'podcast' | 'article' | 'related_book' | 'video' | 'friend_book' | 'did_you_know' | 'related_work'>('all');
  const [isFeedTypeDropdownOpen, setIsFeedTypeDropdownOpen] = useState(false);
  const feedTypeDropdownRef = useRef<HTMLDivElement>(null);
  const [isLoadingMoreFeed, setIsLoadingMoreFeed] = useState(false);
  const [feedPlayingAudioUrl, setFeedPlayingAudioUrl] = useState<string | null>(null);
  const feedAudioRef = useRef<HTMLAudioElement | null>(null);
  const [feedPlayingVideoId, setFeedPlayingVideoId] = useState<string | null>(null);
  const [feedMusicModalData, setFeedMusicModalData] = useState<{ id: string; musicLinks: MusicLinks; title: string; artist: string } | null>(null);
  const [feedWatchModalData, setFeedWatchModalData] = useState<{ id: string; watchLinks: WatchLinks; title: string; year?: number } | null>(null);
  const feedPlayButtonRef = useRef<HTMLButtonElement | null>(null);
  const [feedPodcastTooltip, setFeedPodcastTooltip] = useState<{ id: string; url: string; audioUrl?: string } | null>(null);
  const [feedPodcastAudioPlaying, setFeedPodcastAudioPlaying] = useState(false);
  const [expandedFeedDescriptions, setExpandedFeedDescriptions] = useState<Set<string>>(new Set());
  const [feedCoverBrightness, setFeedCoverBrightness] = useState<Map<string, 'light' | 'dark'>>(new Map());
  const [feedBookSummaries, setFeedBookSummaries] = useState<Map<string, string>>(new Map());
  const feedSummaryFetchedRef = useRef<Set<string>>(new Set());
  const [feedPodcastExpandedMap, setFeedPodcastExpandedMap] = useState<Map<string, boolean>>(new Map());
  const [didYouKnowNoteIndex, setDidYouKnowNoteIndex] = useState<Map<string, number>>(new Map());
  const [heartCounts, setHeartCounts] = useState<Map<string, number>>(new Map());
  const [userHearted, setUserHearted] = useState<Set<string>>(new Set());

  // Create post
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [createPostText, setCreatePostText] = useState('');

  // Remote feature flags
  const [remoteFlags, setRemoteFlags] = useState<RemoteFeatureFlags>({ chat_enabled: false, create_post_enabled: false, related_work_play_buttons: false, commenting_enabled: false, send_enabled: false });
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

  // Reading book picker state (for empty Reading group)
  const [showReadingBookPicker, setShowReadingBookPicker] = useState(false);

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
  const [bookshelfGrouping, setBookshelfGrouping] = useState<'reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bookshelfGrouping');
      const validOptions: ('reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year' | 'list')[] = ['reading_status', 'added', 'rating', 'title', 'author', 'genre', 'publication_year', 'list'];
      return (validOptions.includes(saved as any) ? saved : 'reading_status') as 'reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year' | 'list';
    }
    return 'reading_status';
  });

  // Book lists (selection mode) state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [showListSheet, setShowListSheet] = useState(false);
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressFiredRef = useRef(false);
  const [isBookshelfGroupingDropdownOpen, setIsBookshelfGroupingDropdownOpen] = useState(false);
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
  
  const [spoilerRevealed, setSpoilerRevealed] = useState<Map<string, Set<string>>>(() => getSpoilerRevealedFromStorage());
  
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

  // Load spoiler status from cross-platform storage on native (runs once on mount)
  useEffect(() => {
    if (isNativePlatform) {
      loadSpoilerRevealedFromStorage().then(loaded => {
        if (loaded.size > 0) {
          setSpoilerRevealed(loaded);
        }
      });
    }
  }, []);

  // Persist spoiler revealed status to storage
  useEffect(() => {
    saveSpoilerRevealedToStorage(spoilerRevealed);
  }, [spoilerRevealed]);

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
    const cachedBooks = getCached<any[]>(CACHE_KEYS.books(user.id));
    if (cachedBooks && cachedBooks.length > 0) {
      setBooks(cachedBooks);
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

        // Restore saved selectedIndex if valid, otherwise reset to 0
        if (appBooks.length > 0) {
          if (typeof window !== 'undefined') {
            const savedIndex = localStorage.getItem('lastSelectedBookIndex');
            const parsedIndex = savedIndex ? parseInt(savedIndex, 10) : null;
            if (parsedIndex !== null && !isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < appBooks.length) {
              setSelectedIndex(parsedIndex);
            } else {
              // If saved index is invalid or out of bounds, reset to 0
              setSelectedIndex(0);
            }
          } else {
            // Server-side: ensure index is valid
            if (selectedIndex >= appBooks.length) {
              setSelectedIndex(0);
            }
          }
        } else {
          // No books, reset to 0
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
    if (isLoaded && books.length === 0 && !showBookshelf && !showBookshelfCovers && !showNotesView && !showAccountPage && !showFollowingPage) {
      // First-time user: default to bookshelf covers view
      setShowBookshelfCovers(true);
      setBookshelfGrouping('reading_status'); // Ensure it's grouped by status
    }
  }, [isLoaded, books.length, showBookshelf, showBookshelfCovers, showNotesView, showAccountPage]);

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
        showBookshelf,
        showBookshelfCovers,
        showNotesView,
        showAccountPage,
        showFollowingPage,
        showFeedPage,
      });
    }
  }, [isLoaded, showBookshelf, showBookshelfCovers, showNotesView, showAccountPage, showFollowingPage, showFeedPage]);

  // Analytics: track view changes
  useEffect(() => {
    if (showBookshelfCovers) analytics.trackEvent('bookshelf', 'view', { view_type: 'covers', book_count: books.length });
    else if (showBookshelf) analytics.trackEvent('bookshelf', 'view', { view_type: 'spines', book_count: books.length });
  }, [showBookshelfCovers, showBookshelf]);

  useEffect(() => {
    if (showFeedPage) analytics.trackView('feed');
  }, [showFeedPage]);

  useEffect(() => {
    if (!showBookshelf && !showBookshelfCovers && !showFeedPage && !showAccountPage && !showFollowingPage && !showNotesView && !showChatPage && books.length > 0 && selectedIndex >= 0 && selectedIndex < books.length) {
      const book = books[selectedIndex];
      if (book) analytics.trackEvent('book', 'view', { book_title: book.title, book_author: book.author });
    }
  }, [selectedIndex, showBookshelf, showBookshelfCovers, showFeedPage, showAccountPage, showFollowingPage, showNotesView, showChatPage]);

  // Android hardware back button
  const backButtonStateRef = useRef({
    showAboutScreen, isAdding, showShareDialog, showBookMenu,
    isEditing, isShowingNotes, isConfirmingDelete,
    showAccountPage, showFollowingPage, showFeedPage, showChatPage, chatBookSelected, showCreatePost, showSortingResults, showNotesView,
    showBookshelf, showBookshelfCovers,
  });
  useEffect(() => {
    backButtonStateRef.current = {
      showAboutScreen, isAdding, showShareDialog, showBookMenu,
      isEditing, isShowingNotes, isConfirmingDelete,
      showAccountPage, showFollowingPage, showFeedPage, showChatPage, chatBookSelected, showCreatePost, showSortingResults, showNotesView,
      showBookshelf, showBookshelfCovers,
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
        setChatBookSelected(false); setChatGeneralMode(false); setCharacterChatContext(null); setScrollY(0);
        if (chatOpenedFromBookPage.current) { chatOpenedFromBookPage.current = false; setShowChatPage(false); }
        return;
      }
      if (s.showChatPage) { setShowChatPage(false); return; }
      if (s.showCreatePost) { setShowCreatePost(false); setShowBookshelfCovers(true); return; }
      if (s.showSortingResults) { setShowSortingResults(false); setShowBookshelfCovers(true); return; }
      if (s.showNotesView) { setShowNotesView(false); setShowBookshelfCovers(true); return; }
      // 4. Book detail → bookshelf covers
      if (!s.showBookshelf && !s.showBookshelfCovers) { setShowBookshelfCovers(true); return; }
      // 5. Spines view → covers view
      if (s.showBookshelf && !s.showBookshelfCovers) { setShowBookshelf(false); setShowBookshelfCovers(true); return; }
      // 6. At root (bookshelf covers) → exit app
      exitApp();
    });
  }, []);

  // Load chat list when entering chat page
  useEffect(() => {
    if (!showChatPage || chatBookSelected) return;
    let cancelled = false;
    (async () => {
      setChatListLoading(true);
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

  // Memoize filtered feed items for pagination
  const filteredFeedItems = useMemo(() => {
    let items = personalizedFeedItems;
    // Filter by read status
    if (feedFilter === 'unread') {
      items = items.filter(item => !item.read);
    }
    // Filter by type
    if (feedTypeFilter !== 'all') {
      items = items.filter(item => item.type === feedTypeFilter);
    }
    // Hide albums that have no play URL (matching book page behavior)
    items = items.filter(item => {
      if (item.type !== 'related_work') return true;
      const rw = item.content?.related_work;
      if (rw?.type === 'album' && !rw.itunes_url && !rw.music_links) return false;
      return true;
    });
    return items;
  }, [personalizedFeedItems, feedFilter, feedTypeFilter]);

  const displayedFeedItems = filteredFeedItems.slice(0, feedDisplayCount);
  const hasMoreFeedItems = feedDisplayCount < filteredFeedItems.length;

  // Memoize combined podcast episodes to prevent recalculation on every render
  const combinedPodcastEpisodes = useMemo(() => {
    if (!activeBook) return [];

    const cached = podcastEpisodes.get(activeBook.id);
    const curatedEpisodes = cached?.curated || [];
    const appleEpisodes = cached?.apple || [];

    // Combine episodes, avoiding duplicates by URL
    const seenUrls = new Set<string>();
    const episodes: PodcastEpisode[] = [];

    [...curatedEpisodes, ...appleEpisodes].forEach(ep => {
      if (ep.url && !seenUrls.has(ep.url)) {
        seenUrls.add(ep.url);
        episodes.push(ep);
      }
    });

    return episodes;
  }, [activeBook?.id, podcastEpisodes]);

  const bookPageSectionsResolved = useMemo(() => {
    if (!activeBook) return true;

    const hasFacts = activeBook.author_facts && activeBook.author_facts.length > 0;
    const research = researchData.get(activeBook.id) || null;
    const hasResearch = !!(research && research.pillars && research.pillars.length > 0);
    const influences = bookInfluences.get(activeBook.id) || [];
    const hasInfluences = influences.length > 0;
    const domainData = bookDomain.get(activeBook.id);
    const hasDomain = !!(domainData && domainData.facts && domainData.facts.length > 0);
    const contextInsights = bookContext.get(activeBook.id) || [];
    const hasContext = contextInsights.length > 0;

    const isLoadingFacts = loadingFactsForBookId === activeBook.id && !hasFacts;
    const isLoadingResearch = loadingResearchForBookId === activeBook.id && !hasResearch;
    const isLoadingInfluences = loadingInfluencesForBookId === activeBook.id && !hasInfluences;
    const isLoadingDomain = loadingDomainForBookId === activeBook.id && !hasDomain;
    const isLoadingContext = loadingContextForBookId === activeBook.id && !hasContext;
    const isInsightsLoading = isLoadingFacts || isLoadingResearch || isLoadingInfluences || isLoadingDomain || isLoadingContext;

    const hasEpisodes = combinedPodcastEpisodes.length > 0;
    const isPodcastsLoading = loadingPodcastsForBookId === activeBook.id && !hasEpisodes;

    const videos = youtubeVideos.get(activeBook.id) || [];
    const hasVideos = videos.length > 0;
    const isVideosLoading = loadingVideosForBookId === activeBook.id && !hasVideos;

    const articles = analysisArticles.get(activeBook.id) || [];
    const hasRealArticles = articles.length > 0 && articles.some(article => {
      const isFallback = article.title?.includes('Search Google Scholar') ||
                         (article.url && article.url.includes('scholar.google.com/scholar?q='));
      return !isFallback;
    });
    const hasOnlyFallback = articles.length > 0 && !hasRealArticles;
    const hasArticles = hasRealArticles;
    const isAnalysisLoading = loadingAnalysisForBookId === activeBook.id && !hasArticles && !hasOnlyFallback;

    const related = relatedBooks.get(activeBook.id);
    const hasData = related !== undefined;
    const isRelatedLoading = loadingRelatedForBookId === activeBook.id && !hasData;

    return !(isInsightsLoading || isPodcastsLoading || isVideosLoading || isAnalysisLoading || isRelatedLoading);
  }, [
    activeBook?.id,
    activeBook?.author_facts,
    combinedPodcastEpisodes.length,
    researchData,
    bookInfluences,
    bookDomain,
    bookContext,
    youtubeVideos,
    analysisArticles,
    relatedBooks,
    loadingFactsForBookId,
    loadingResearchForBookId,
    loadingInfluencesForBookId,
    loadingDomainForBookId,
    loadingContextForBookId,
    loadingPodcastsForBookId,
    loadingVideosForBookId,
    loadingAnalysisForBookId,
    loadingRelatedForBookId,
  ]);

  // Spotlight recommendation — pick one random content item from available data
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const lastSpotlightRef = useRef<{ item: { type: string; icon: LucideIcon; label: string; title: string; subtitle: string; url?: string; imageUrl?: string; itemIndex: number }; next: { type: string; icon: LucideIcon; label: string; title: string; subtitle: string; url?: string; imageUrl?: string; itemIndex: number } | null; total: number; bookId: string } | null>(null);
  const spotlightRecommendation = useMemo(() => {
    if (!activeBook) return lastSpotlightRef.current;
    type SpotlightItem = { type: string; icon: LucideIcon; label: string; title: string; subtitle: string; url?: string; imageUrl?: string; itemIndex: number };
    const candidates: SpotlightItem[] = [];

    // Did You Know facts
    if (contentPreferences.fun_facts !== false) {
      const dykItems = didYouKnow.get(activeBook.id);
      if (dykItems) {
        dykItems.forEach((item, i) => {
          candidates.push({ type: 'did_you_know', icon: Lightbulb, label: 'Did You Know?', title: item.notes[0], subtitle: item.notes[1], url: item.source_url, itemIndex: i });
        });
      }
    }

    // Podcasts
    if (contentPreferences.podcasts !== false) {
      const pods = podcastEpisodes.get(activeBook.id);
      const allPods = [...(pods?.curated || []), ...(pods?.apple || [])];
      allPods.forEach((pod, i) => {
        candidates.push({ type: 'podcast', icon: Headphones, label: 'Podcast', title: pod.title, subtitle: pod.podcast_name || pod.episode_summary, imageUrl: pod.thumbnail, url: pod.url, itemIndex: i });
      });
    }

    // YouTube videos
    if (contentPreferences.youtube !== false) {
      const vids = youtubeVideos.get(activeBook.id);
      if (vids) {
        vids.forEach((vid, i) => {
          candidates.push({ type: 'video', icon: Play, label: 'Video', title: vid.title, subtitle: vid.channelTitle, imageUrl: vid.thumbnail, url: `https://www.youtube.com/watch?v=${vid.videoId}`, itemIndex: i });
        });
      }
    }


    // Articles
    if (contentPreferences.articles !== false) {
      const arts = analysisArticles.get(activeBook.id);
      if (arts) {
        const realArts = arts.filter((a: any) => !a.url?.includes('scholar.google.com/scholar?q='));
        realArts.forEach((art, i) => {
          candidates.push({ type: 'article', icon: ScrollText, label: 'Article', title: art.title, subtitle: art.snippet, url: art.url, itemIndex: i });
        });
      }
    }

    // Related movies/shows/music — only include items with artwork
    if (contentPreferences.related_work !== false) {
      const movies = relatedMovies.get(activeBook.id);
      if (movies) {
        movies.forEach((movie, i) => {
          if (!movie.poster_url && !movie.itunes_artwork) return;
          const icon = movie.type === 'album' ? Music : movie.type === 'show' ? Tv : Film;
          const label = movie.type === 'album' ? 'Music' : movie.type === 'show' ? 'TV Show' : 'Movie';
          candidates.push({ type: 'movie', icon, label, title: movie.title, subtitle: `${movie.director} — ${movie.reason}`, imageUrl: movie.itunes_artwork || movie.poster_url, url: movie.itunes_url || movie.wikipedia_url, itemIndex: i });
        });
      }
    }

    if (candidates.length === 0) {
      // Keep showing last valid spotlight during transitions
      return lastSpotlightRef.current;
    }
    // Seeded shuffle so order is stable per book but randomized across types
    const seed = activeBook.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = ((seed * (i + 1) * 2654435761) >>> 0) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const current = shuffled[spotlightIndex % shuffled.length];
    const next = shuffled.length > 1 ? shuffled[(spotlightIndex + 1) % shuffled.length] : null;
    const result = { item: current, next, total: shuffled.length, bookId: activeBook.id };
    lastSpotlightRef.current = result;
    return result;
  }, [activeBook?.id, spotlightIndex, didYouKnow, podcastEpisodes, youtubeVideos, relatedBooks, analysisArticles, relatedMovies, contentPreferences]);

  // Save bookshelf grouping preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bookshelfGrouping', bookshelfGrouping);
    }
  }, [bookshelfGrouping]);

  // Save selected book index to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && books.length > 0 && selectedIndex >= 0 && selectedIndex < books.length) {
      localStorage.setItem('lastSelectedBookIndex', selectedIndex.toString());
    }
  }, [selectedIndex, books.length]);

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

  // Helper function to get alphabetical range for a letter
  const getAlphabeticalRange = (letter: string): string => {
    const upper = letter.toUpperCase();
    if (upper >= 'A' && upper <= 'D') return 'A-D';
    if (upper >= 'E' && upper <= 'H') return 'E-H';
    if (upper >= 'I' && upper <= 'M') return 'I-M';
    if (upper >= 'N' && upper <= 'S') return 'N-S';
    return 'T-Z';
  };

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
          // null or undefined reading_status goes to TBD
          groups[3].books.push(book);
        }
      });
      
      // Sort each group by rating descending
      groups.forEach(group => {
        group.books.sort((a, b) => {
          const scoreA = calculateScore(a.ratings);
          const scoreB = calculateScore(b.ratings);
          return scoreB - scoreA;
        });
      });

      // Keep Reading group visible even when empty (only for own bookshelf and only if they have at least one book)
      return groups.filter(group => group.books.length > 0 || (group.label === 'Reading' && !viewingUserId && booksForBookshelf.length > 0));
    } else if (bookshelfGrouping === 'rating') {
      // Group by rating score ranges
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
          groups[5].books.push(book); // Unrated
        } else if (score >= 4.5) {
          groups[0].books.push(book); // 5 hearts
        } else if (score >= 3.5) {
          groups[1].books.push(book); // 4 hearts
        } else if (score >= 2.5) {
          groups[2].books.push(book); // 3 hearts
        } else if (score >= 1.5) {
          groups[3].books.push(book); // 2 hearts
        } else {
          groups[4].books.push(book); // 1 heart
        }
      });
      
      // Sort each group by rating descending (already sorted within each group by score ranges)
      groups.forEach(group => {
        group.books.sort((a, b) => {
          const scoreA = calculateScore(a.ratings);
          const scoreB = calculateScore(b.ratings);
          return scoreB - scoreA; // Descending order
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
      
      // Sort each group by created_at descending (newest first)
      groups.forEach(group => {
        group.books.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA; // Descending order
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
      
      // Sort each group by title
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
      
      // Sort each group by author name
      groups.forEach(group => {
        group.books.sort((a, b) => {
          const authorA = (a.author || '').toUpperCase();
          const authorB = (b.author || '').toUpperCase();
          return authorA.localeCompare(authorB);
        });
      });
      
      return groups.filter(group => group.books.length > 0);
    } else if (bookshelfGrouping === 'genre') {
      // Group by actual genre name (case-insensitive)
      const genreMap = new Map<string, BookWithRatings[]>();
      const genreDisplayNames = new Map<string, string>(); // Store original case for display
      
      booksForBookshelf.forEach(book => {
        const genre = book.genre || 'No Genre';
        const genreLower = genre.toLowerCase();
        
        // Use lowercase as key for case-insensitive grouping
        if (!genreMap.has(genreLower)) {
          genreMap.set(genreLower, []);
          genreDisplayNames.set(genreLower, genre); // Store first occurrence's case for display
        }
        genreMap.get(genreLower)!.push(book);
      });
      
      // Convert to groups array and sort by genre name
      const groups: { label: string; books: BookWithRatings[] }[] = Array.from(genreMap.entries())
        .map(([genreLower, books]) => ({
          label: genreDisplayNames.get(genreLower) || genreLower, // Use original case for display
          books: books.sort((a, b) => {
            // Sort books within each genre by title
          const titleA = (a.title || '').toUpperCase();
          const titleB = (b.title || '').toUpperCase();
          return titleA.localeCompare(titleB);
          })
        }))
        .sort((a, b) => {
          // Sort groups by genre name (case-insensitive, put "No Genre" at the end)
          const labelA = a.label.toLowerCase();
          const labelB = b.label.toLowerCase();
          if (labelA === 'no genre') return 1;
          if (labelB === 'no genre') return -1;
          return labelA.localeCompare(labelB);
        });
      
      return groups;
    } else if (bookshelfGrouping === 'publication_year') {
      // Group by decades using first_issue_year (fallback to publish_year)
      const decadeMap = new Map<string, BookWithRatings[]>();
      
      booksForBookshelf.forEach(book => {
        const year = book.first_issue_year || book.publish_year;
        let decadeLabel: string;
        
        if (year && typeof year === 'number' && year > 0) {
          // Calculate decade: e.g., 2023 -> "2020s", 1995 -> "1990s"
          const decade = Math.floor(year / 10) * 10;
          decadeLabel = `${decade}s`;
        } else {
          // Books without publication year
          decadeLabel = 'Unknown';
        }
        
        if (!decadeMap.has(decadeLabel)) {
          decadeMap.set(decadeLabel, []);
        }
        decadeMap.get(decadeLabel)!.push(book);
      });
      
      // Convert to groups array
      const groups: { label: string; books: BookWithRatings[] }[] = Array.from(decadeMap.entries())
        .map(([decadeLabel, books]) => ({
          label: decadeLabel,
          books: books.sort((a, b) => {
            // Sort books within each decade by year descending (newest first)
            // Use first_issue_year if available, otherwise publish_year
            const yearA = a.first_issue_year || a.publish_year || 0;
            const yearB = b.first_issue_year || b.publish_year || 0;
            return yearB - yearA; // Descending order
          })
        }))
        .sort((a, b) => {
          // Sort decades descending (newest first)
          // Put "Unknown" at the end
          if (a.label === 'Unknown') return 1;
          if (b.label === 'Unknown') return -1;
          
          // Extract decade number from label (e.g., "2020s" -> 2020)
          const decadeA = parseInt(a.label.replace('s', '')) || 0;
          const decadeB = parseInt(b.label.replace('s', '')) || 0;
          return decadeB - decadeA; // Descending order
        });
      
      return groups;
    } else if (bookshelfGrouping === 'list') {
      // Group by user-defined lists
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
  
  // When editing, show the first dimension that needs rating, or first dimension if all are rated
  const currentEditingDimension = useMemo((): typeof RATING_DIMENSIONS[number] | null => {
    if (!activeBook || !isEditing || selectingReadingStatusInRating) return null;
    if (editingDimension) return editingDimension;
    // Find first unrated dimension, or default to first dimension
    return RATING_DIMENSIONS.find(d => activeBook.ratings[d] === null) || RATING_DIMENSIONS[0];
  }, [activeBook, isEditing, editingDimension, selectingReadingStatusInRating]);
  
  const showRatingOverlay = activeBook && isEditing;
  const showReadingStatusSelection = selectingReadingStatusInRating || selectingReadingStatusForExisting;

  useEffect(() => {
    setIsEditing(false);
    setIsConfirmingDelete(false);
    // Check if we should open notes after navigating from notes list
    if (openNotesAfterNavRef.current) {
      openNotesAfterNavRef.current = false;
      setIsShowingNotes(true);
    } else {
      setIsShowingNotes(false);
    }
    setNewlyAddedNoteTimestamp(null);
    setEditingDimension(null);
    setSelectedInsightCategory('trivia'); // Reset to trivia when book changes
    setIsInsightCategoryDropdownOpen(false); // Close dropdown when book changes

    setIsMetaExpanded(true);
    setIsSummaryExpanded(false); // Reset summary expansion when book changes
    const timer = setTimeout(() => {
      setIsMetaExpanded(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [selectedIndex]);

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

  // Close feed type dropdown when clicking outside
  useEffect(() => {
    if (!isFeedTypeDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (feedTypeDropdownRef.current && !feedTypeDropdownRef.current.contains(e.target as Node)) {
        setIsFeedTypeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFeedTypeDropdownOpen]);

  // Close insight category dropdown when clicking outside
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
      // Format notes for display with timestamps visible
      const formattedNotes = formatNotesForDisplay(activeBook.notes ?? null);
      setNoteText(formattedNotes);
      lastSavedNoteTextRef.current = formattedNotes;
      noteTextOnFocusRef.current = formattedNotes; // Track initial state
    }
    // Cleanup timeout on book change
    return () => {
      if (noteSaveTimeoutRef.current) {
        clearTimeout(noteSaveTimeoutRef.current);
        noteSaveTimeoutRef.current = null;
      }
    };
  }, [activeBook?.id, activeBook?.notes]);


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

  // Track which books we're currently fetching facts for to prevent duplicate concurrent fetches
  const fetchingFactsForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch author facts for existing books when they're selected
  // Now uses cache table instead of books table
  useEffect(() => {
    // Skip if feature flag is disabled
    if (!featureFlags.insights.author_facts) {
      setLoadingFactsForBookId(null);
      return;
    }

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingFactsForBookId(null);
      return;
    }

      const bookId = currentBook.id;
    const bookTitle = currentBook.title;
    const bookAuthor = currentBook.author;
    
    // Check if facts or first_issue_year already exist in local state - if so, don't fetch again
    const hasFacts = currentBook.author_facts &&
                     Array.isArray(currentBook.author_facts) &&
                     currentBook.author_facts.length > 0;
    const hasFirstIssueYear = currentBook.first_issue_year != null;

    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingFactsForBooksRef.current.has(bookId);

    if (hasFacts || hasFirstIssueYear) {
      // Facts or first_issue_year already loaded in state, no need to fetch again
      setLoadingFactsForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingFactsForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingFactsForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingFactsForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      console.log(`[Author Facts] 🔄 Fetching author facts for "${bookTitle}" by ${bookAuthor}...`);
      getAuthorFacts(bookTitle, bookAuthor).then(async (result) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingFactsForBookId(null);
        fetchingFactsForBooksRef.current.delete(bookId);
        
        if (result.facts.length > 0 || result.first_issue_year) {
          console.log(`[Author Facts] ✅ Received ${result.facts.length} facts, first_issue_year: ${result.first_issue_year} for "${bookTitle}"`);

          // Update local state for display (cache is already saved by getAuthorFacts)
          // Only update if the book is still the active one
          setBooks(prev => prev.map(book =>
            book.id === bookId
              ? { ...book, author_facts: result.facts, first_issue_year: result.first_issue_year || book.first_issue_year }
              : book
          ));

          // Save first_issue_year to database if we got it
          if (result.first_issue_year && user) {
            try {
              const { error: updateError } = await supabase
                .from('books')
                .update({ first_issue_year: result.first_issue_year, updated_at: new Date().toISOString() })
                .eq('id', bookId)
                .eq('user_id', user.id);

              if (updateError) {
                console.error('[Author Facts] ❌ Error saving first_issue_year:', updateError);
              } else {
                console.log(`[Author Facts] 💾 Saved first_issue_year ${result.first_issue_year} to database for "${bookTitle}"`);
              }
            } catch (err) {
              console.error('[Author Facts] ❌ Error saving first_issue_year:', err);
            }
          }
        } else {
          console.log(`[Author Facts] ⚠️ No facts or first_issue_year received for "${bookTitle}"`);
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingFactsForBookId(null);
          console.error('Error fetching author facts:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingFactsForBooksRef.current.delete(bookId);
      });
    }, 300); // Short debounce for scroll; above-the-fold content

    return () => {
      cancelled = true;
      setLoadingFactsForBookId(null);
      fetchingFactsForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Fetch first_issue_year independently (not gated by author_facts feature flag)
  const fetchingFirstIssueYearRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) return;

    const bookId = currentBook.id;

    // Skip if already have first_issue_year
    if (currentBook.first_issue_year != null) return;

    // Skip if already fetching
    if (fetchingFirstIssueYearRef.current.has(bookId)) return;

    let cancelled = false;
    fetchingFirstIssueYearRef.current.add(bookId);

    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      console.log(`[First Issue Year] 🔄 Fetching for "${currentBook.title}" by ${currentBook.author}...`);
      getFirstIssueYear(currentBook.title, currentBook.author).then(async (year) => {
        if (cancelled) return;
        fetchingFirstIssueYearRef.current.delete(bookId);

        if (year != null) {
          console.log(`[First Issue Year] ✅ Got year ${year} for "${currentBook.title}"`);

          setBooks(prev => prev.map(book =>
            book.id === bookId
              ? { ...book, first_issue_year: year }
              : book
          ));

          // Save to books table
          if (user) {
            try {
              const { error: updateError } = await supabase
                .from('books')
                .update({ first_issue_year: year, updated_at: new Date().toISOString() })
                .eq('id', bookId)
                .eq('user_id', user.id);

              if (updateError) {
                console.error('[First Issue Year] ❌ Error saving to books table:', updateError);
              } else {
                console.log(`[First Issue Year] 💾 Saved year ${year} to books table`);
              }
            } catch (err) {
              console.error('[First Issue Year] ❌ Error saving to books table:', err);
            }
          }
        } else {
          console.log(`[First Issue Year] ⚠️ No year found for "${currentBook.title}"`);
        }
      }).catch(err => {
        if (!cancelled) {
          console.error('[First Issue Year] ❌ Error:', err);
        }
        fetchingFirstIssueYearRef.current.delete(bookId);
      });
    }, 300); // Short debounce for scroll

    return () => {
      cancelled = true;
      fetchingFirstIssueYearRef.current.delete(bookId);
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]);

  // Track which books we're currently fetching influences for to prevent duplicate concurrent fetches
  const fetchingInfluencesForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch book influences for existing books when they're selected
  useEffect(() => {
    // Skip if feature flag is disabled
    if (!featureFlags.insights.book_influences) {
      setLoadingInfluencesForBookId(null);
      return;
    }

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingInfluencesForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const bookTitle = currentBook.title;
    const bookAuthor = currentBook.author;
    
    // Check if influences already exist in local state
    const influences = bookInfluences.get(bookId);
    const hasInfluences = influences && influences.length > 0;
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingInfluencesForBooksRef.current.has(bookId);
    
    if (hasInfluences) {
      // Influences already loaded in state, no need to fetch again
      setLoadingInfluencesForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingInfluencesForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingInfluencesForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingInfluencesForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      console.log(`[Book Influences] 🔄 Fetching influences for "${bookTitle}" by ${bookAuthor}...`);
      getBookInfluences(bookTitle, bookAuthor).then((influences) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingInfluencesForBookId(null);
        fetchingInfluencesForBooksRef.current.delete(bookId);
        
        if (influences.length > 0) {
          console.log(`[Book Influences] ✅ Received ${influences.length} influences for "${bookTitle}"`);
          
          // Store in state
          setBookInfluences(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, influences);
            return newMap;
          });
        } else {
          console.log(`[Book Influences] ⚠️ No influences received for "${bookTitle}"`);
          // Store empty array to prevent future fetches
          setBookInfluences(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, []);
            return newMap;
          });
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingInfluencesForBookId(null);
          console.error('Error fetching book influences:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingInfluencesForBooksRef.current.delete(bookId);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      setLoadingInfluencesForBookId(null);
      fetchingInfluencesForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching domain insights for to prevent duplicate concurrent fetches
  const fetchingDomainForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch book domain insights for existing books when they're selected
  useEffect(() => {
    // Skip if feature flag is disabled
    if (!featureFlags.insights.book_domain) {
      setLoadingDomainForBookId(null);
      return;
    }

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingDomainForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const bookTitle = currentBook.title;
    const bookAuthor = currentBook.author;
    
    // Check if domain insights already exist in local state
    const domainData = bookDomain.get(bookId);
    const hasDomain = domainData && domainData.facts && domainData.facts.length > 0;
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingDomainForBooksRef.current.has(bookId);
    
    if (hasDomain) {
      // Domain insights already loaded in state, no need to fetch again
      setLoadingDomainForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingDomainForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingDomainForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingDomainForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      console.log(`[Book Domain] 🔄 Fetching domain insights for "${bookTitle}" by ${bookAuthor}...`);
      getBookDomain(bookTitle, bookAuthor).then((domainData) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingDomainForBookId(null);
        fetchingDomainForBooksRef.current.delete(bookId);
        
        if (domainData && domainData.facts.length > 0) {
          console.log(`[Book Domain] ✅ Received ${domainData.facts.length} domain insights for "${bookTitle}" with label: ${domainData.label}`);
          
          // Store in state
          setBookDomain(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, domainData);
            return newMap;
          });
        } else {
          console.log(`[Book Domain] ⚠️ No domain insights received for "${bookTitle}"`);
          // Store empty data to prevent future fetches
          setBookDomain(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, { label: 'Domain', facts: [] });
            return newMap;
          });
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingDomainForBookId(null);
          console.error('Error fetching book domain insights:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingDomainForBooksRef.current.delete(bookId);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      setLoadingDomainForBookId(null);
      fetchingDomainForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching context for to prevent duplicate concurrent fetches
  const fetchingContextForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch book context insights for existing books when they're selected
  useEffect(() => {
    // Skip if feature flag is disabled
    if (!featureFlags.insights.book_context) {
      setLoadingContextForBookId(null);
      return;
    }

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingContextForBookId(null);
      return;
    }

    const bookId = currentBook.id;
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
    
    // Check if context insights already exist in local state
    const contextInsights = bookContext.get(bookId);
    const hasContext = contextInsights && contextInsights.length > 0;
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingContextForBooksRef.current.has(bookId);
    
    if (hasContext) {
      // Context insights already loaded in state, no need to fetch again
      setLoadingContextForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingContextForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingContextForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingContextForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
        if (cancelled) return;
        
      console.log(`[Book Context] 🔄 Fetching context insights for "${bookTitle}" by ${bookAuthor}...`);
      getBookContext(bookTitle, bookAuthor).then((contextInsights) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingContextForBookId(null);
        fetchingContextForBooksRef.current.delete(bookId);
        
        if (contextInsights.length > 0) {
          console.log(`[Book Context] ✅ Received ${contextInsights.length} context insights for "${bookTitle}"`);
          
          // Store in state
          setBookContext(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, contextInsights);
            return newMap;
          });
        } else {
          console.log(`[Book Context] ⚠️ No context insights received for "${bookTitle}"`);
          // Store empty array to prevent future fetches
          setBookContext(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, []);
            return newMap;
          });
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingContextForBookId(null);
          console.error('Error fetching book context insights:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingContextForBooksRef.current.delete(bookId);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      setLoadingContextForBookId(null);
      fetchingContextForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching "Did you know?" insights for to prevent duplicate concurrent fetches
  const fetchingDidYouKnowForBooksRef = useRef<Set<string>>(new Set());

  // Fetch "Did you know?" insights for existing books when they're selected
  useEffect(() => {
    // Skip if feature flag is disabled
    if (!featureFlags.insights.did_you_know) {
      setLoadingDidYouKnowForBookId(null);
      return;
    }

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingDidYouKnowForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const bookTitle = currentBook.title;
    const bookAuthor = currentBook.author;

    // Check if "Did you know?" insights already exist in local state
    const didYouKnowData = didYouKnow.get(bookId);
    const hasDidYouKnow = didYouKnowData && didYouKnowData.length > 0;

    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingDidYouKnowForBooksRef.current.has(bookId);

    if (hasDidYouKnow) {
      // "Did you know?" insights already loaded in state, no need to fetch again
      setLoadingDidYouKnowForBookId(null);
      return;
    }

    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingDidYouKnowForBookId(bookId);
      return;
    }

    let cancelled = false;

    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingDidYouKnowForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingDidYouKnowForBookId(bookId);

    // Add a short delay to avoid rate limits when scrolling through books
    // Shorter delay than other insights since this is the only enabled insight type by default
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      console.log(`[Did You Know] 🔄 Fetching "Did you know?" insights for "${bookTitle}" by ${bookAuthor}...`);
      getDidYouKnow(bookTitle, bookAuthor).then((insights) => {
        if (cancelled) return;

        // Clear loading state and remove from fetching set
        setLoadingDidYouKnowForBookId(null);
        fetchingDidYouKnowForBooksRef.current.delete(bookId);

        if (insights.length > 0) {
          console.log(`[Did You Know] ✅ Received ${insights.length} "Did you know?" insights for "${bookTitle}"`);

          // Store in state
          setDidYouKnow(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, insights);
            return newMap;
          });
        } else {
          console.log(`[Did You Know] ⚠️ No "Did you know?" insights received for "${bookTitle}"`);
          // Store empty array to prevent future fetches
          setDidYouKnow(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, []);
            return newMap;
          });
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingDidYouKnowForBookId(null);
          console.error('Error fetching "Did you know?" insights:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingDidYouKnowForBooksRef.current.delete(bookId);
      });
    }, 300); // Short debounce for scroll; above-the-fold content

    return () => {
      cancelled = true;
      setLoadingDidYouKnowForBookId(null);
      fetchingDidYouKnowForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching podcasts for to prevent duplicate concurrent fetches
  const fetchingPodcastsForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch podcast episodes for existing books when they're selected
  // Now uses cache table instead of books table
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
        setLoadingPodcastsForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const bookTitle = currentBook.title;
    const bookAuthor = currentBook.author;
    
    // Check if episodes already exist in local state (Map)
    const cached = podcastEpisodes.get(bookId);
    const hasEpisodes = cached && (cached.curated.length > 0 || cached.apple.length > 0);
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingPodcastsForBooksRef.current.has(bookId);
    
    if (hasEpisodes) {
      // Episodes already loaded in state, no need to fetch again
      setLoadingPodcastsForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingPodcastsForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingPodcastsForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingPodcastsForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      console.log(`[Podcast Episodes] 🔄 Fetching podcast episodes for "${bookTitle}" by ${bookAuthor}...`);
      getPodcastEpisodes(bookTitle, bookAuthor).then((allEpisodes) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingPodcastsForBookId(null);
        fetchingPodcastsForBooksRef.current.delete(bookId);
        
        if (allEpisodes.length > 0) {
          console.log(`[Podcast Episodes] ✅ Received ${allEpisodes.length} combined episodes for "${bookTitle}"`);
          
          // Separate episodes by source
          const curated: PodcastEpisode[] = [];
          const apple: PodcastEpisode[] = [];

          allEpisodes.forEach(ep => {
            if (ep.platform === 'Curated') {
              curated.push(ep);
            } else {
              apple.push(ep);
            }
          });

          // Store in Map state (like videos, articles, etc.)
          setPodcastEpisodes(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, { curated, apple });
            return newMap;
          });
        } else {
          console.log(`[Podcast Episodes] ⚠️ No episodes found for "${bookTitle}"`);
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingPodcastsForBookId(null);
          console.error('Error fetching podcast episodes:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingPodcastsForBooksRef.current.delete(bookId);
      });
    }, 600); // Short debounce for scroll; services check Supabase cache first (~50ms)

    return () => {
      cancelled = true;
      setLoadingPodcastsForBookId(null);
      fetchingPodcastsForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching analysis for to prevent duplicate concurrent fetches
  const fetchingAnalysisForBooksRef = useRef<Set<string>>(new Set());

  // Load analysis articles from Google Scholar
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingAnalysisForBookId(null);
      return;
    }

    const bookId = currentBook.id;

    // Check if analysis already exists in state
    const hasAnalysis = analysisArticles.has(bookId);
    const isCurrentlyFetching = fetchingAnalysisForBooksRef.current.has(bookId);
    
    if (hasAnalysis) {
      setLoadingAnalysisForBookId(null);
      return;
    }

    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingAnalysisForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark as being fetched (to prevent concurrent fetches)
    fetchingAnalysisForBooksRef.current.add(bookId);

    setLoadingAnalysisForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[Analysis Articles] 🔄 Fetching from Google Scholar for "${bookTitle}" by ${bookAuthor}...`);
      getGoogleScholarAnalysis(bookTitle, bookAuthor).then((articles) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingAnalysisForBookId(null);
        fetchingAnalysisForBooksRef.current.delete(bookId);
        
        // Store in state (including empty arrays to prevent future fetches)
          setAnalysisArticles(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, articles);
            return newMap;
          });

        if (articles.length > 0) {
          console.log(`[Analysis Articles] ✅ Received ${articles.length} articles for "${bookTitle}"`);
        } else {
          console.log(`[Analysis Articles] ⚠️ No articles found for "${bookTitle}" (cached for future requests)`);
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingAnalysisForBookId(null);
        console.error('Error fetching analysis articles:', err);
        // Remove from fetching set on error so we can retry
        fetchingAnalysisForBooksRef.current.delete(bookId);
      });
    }, 600); // Short debounce for scroll; services check Supabase cache first (~50ms)

    return () => {
      cancelled = true;
      setLoadingAnalysisForBookId(null);
      fetchingAnalysisForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching videos for to prevent duplicate concurrent fetches
  const fetchingVideosForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch YouTube videos for existing books when they're selected (if missing)
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingVideosForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const videos = youtubeVideos.get(bookId);
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingVideosForBooksRef.current.has(bookId);
    
    // If videos already exist in state, don't fetch again
    if (videos !== undefined) {
      setLoadingVideosForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingVideosForBookId(bookId);
      return;
    }
    
    // Force fetch to check cache - this ensures cached data is loaded on initial page load

    let cancelled = false;
    
    // Mark as being fetched (to prevent concurrent fetches)
    fetchingVideosForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingVideosForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[YouTube Videos] 🔄 Fetching for "${bookTitle}" by ${bookAuthor}...`);
      getYouTubeVideos(bookTitle, bookAuthor).then((videos) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingVideosForBookId(null);
        fetchingVideosForBooksRef.current.delete(bookId);
        
        if (videos.length > 0) {
          console.log(`[YouTube Videos] ✅ Received ${videos.length} videos for "${bookTitle}"`);
          // Store in state
          setYoutubeVideos(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, videos);
            return newMap;
          });
        } else {
          console.log(`[YouTube Videos] ⚠️ No videos found for "${bookTitle}"`);
          // Store empty array to prevent future fetches
          setYoutubeVideos(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, []);
            return newMap;
          });
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingVideosForBookId(null);
        console.error('Error fetching YouTube videos:', err);
        // Remove from fetching set on error so we can retry
        fetchingVideosForBooksRef.current.delete(bookId);
      });
    }, 600); // Short debounce for scroll; services check Supabase cache first (~50ms)

    return () => {
      cancelled = true;
      setLoadingVideosForBookId(null);
      fetchingVideosForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching related books for to prevent duplicate concurrent fetches
  const fetchingRelatedForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch related books when activeBook changes
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingRelatedForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const related = relatedBooks.get(bookId);
    
    // If related books already exist in state (including empty array), don't fetch again
    if (related !== undefined) {
      setLoadingRelatedForBookId(null);
      return;
    }
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingRelatedForBooksRef.current.has(bookId);
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingRelatedForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark as being fetched (to prevent concurrent fetches)
    fetchingRelatedForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingRelatedForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[Related Books] 🔄 Fetching for "${bookTitle}" by ${bookAuthor}...`);
      getRelatedBooks(bookTitle, bookAuthor).then((books) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingRelatedForBookId(null);
        fetchingRelatedForBooksRef.current.delete(bookId);
        
        if (books.length > 0) {
          console.log(`[Related Books] ✅ Received ${books.length} related books for "${bookTitle}"`);
        } else {
          console.log(`[Related Books] ⚠️ No related books found for "${bookTitle}"`);
        }
        
        // Always store in state (even if empty) to mark as fetched
        setRelatedBooks(prev => {
          const newMap = new Map(prev);
          newMap.set(bookId, books);
          return newMap;
        });
      }).catch((err) => {
        if (cancelled) return;
        setLoadingRelatedForBookId(null);
        console.error('Error fetching related books:', err);
        // Remove from fetching set on error so we can retry
        fetchingRelatedForBooksRef.current.delete(bookId);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      setLoadingRelatedForBookId(null);
      fetchingRelatedForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching related movies for to prevent duplicate concurrent fetches
  const fetchingRelatedMoviesRef = useRef<Set<string>>(new Set());

  // Fetch related movies when activeBook changes
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingRelatedMoviesForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const related = relatedMovies.get(bookId);

    if (related !== undefined) {
      setLoadingRelatedMoviesForBookId(null);
      return;
    }

    const isCurrentlyFetching = fetchingRelatedMoviesRef.current.has(bookId);
    if (isCurrentlyFetching) {
      setLoadingRelatedMoviesForBookId(bookId);
      return;
    }

    let cancelled = false;
    fetchingRelatedMoviesRef.current.add(bookId);
    setLoadingRelatedMoviesForBookId(bookId);

    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;

      console.log(`[Related Movies] Fetching for "${bookTitle}" by ${bookAuthor}...`);
      getRelatedMovies(bookTitle, bookAuthor).then((movies) => {
        if (cancelled) return;

        setLoadingRelatedMoviesForBookId(null);
        fetchingRelatedMoviesRef.current.delete(bookId);

        if (movies.length > 0) {
          console.log(`[Related Movies] Received ${movies.length} related movies for "${bookTitle}"`);
        } else {
          console.log(`[Related Movies] No related movies found for "${bookTitle}"`);
        }

        setRelatedMovies(prev => {
          const newMap = new Map(prev);
          newMap.set(bookId, movies);
          return newMap;
        });
      }).catch((err) => {
        if (cancelled) return;
        setLoadingRelatedMoviesForBookId(null);
        console.error('Error fetching related movies:', err);
        fetchingRelatedMoviesRef.current.delete(bookId);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      setLoadingRelatedMoviesForBookId(null);
      fetchingRelatedMoviesRef.current.delete(bookId);
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]);

  // Fetch book summary when activeBook changes
  const fetchingSummaryRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook?.title || !currentBook?.author) {
      setLoadingSummaryForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    if (bookSummaries.has(bookId)) {
      setLoadingSummaryForBookId(null);
      return;
    }
    if (fetchingSummaryRef.current.has(bookId)) {
      setLoadingSummaryForBookId(bookId);
      return;
    }

    let cancelled = false;
    fetchingSummaryRef.current.add(bookId);
    setLoadingSummaryForBookId(bookId);

    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      getBookSummary(currentBook.title, currentBook.author).then((summary) => {
        if (cancelled) return;
        setLoadingSummaryForBookId(null);
        fetchingSummaryRef.current.delete(bookId);
        if (summary) {
          setBookSummaries(prev => {
            const next = new Map(prev);
            next.set(bookId, summary);
            return next;
          });
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingSummaryForBookId(null);
        fetchingSummaryRef.current.delete(bookId);
        console.error('[BookSummary] Error:', err);
      });
    }, 300); // Short debounce for scroll; above-the-fold content

    // Also fetch character avatars
    if (!characterAvatars.has(bookId)) {
      setLoadingAvatarsForBookId(bookId);
      getCharacterAvatars(currentBook.title, currentBook.author).then((avatars) => {
        if (cancelled) return;
        setLoadingAvatarsForBookId(null);
        if (avatars.length > 0) {
          setCharacterAvatars(prev => {
            const next = new Map(prev);
            next.set(bookId, avatars);
            return next;
          });
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingAvatarsForBookId(null);
        console.error('[CharacterAvatars] Error:', err);
      });
    }

    return () => {
      cancelled = true;
      setLoadingSummaryForBookId(null);
      setLoadingAvatarsForBookId(null);
      fetchingSummaryRef.current.delete(bookId);
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]);

  // Fetch research when activeBook changes
  // DISABLED: getBookResearch call is temporarily disabled
  useEffect(() => {
    // Early return to disable research fetching
    setLoadingResearchForBookId(null);
    return;
    
    /* DISABLED CODE
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingResearchForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const research = researchData.get(bookId);
    
    // If research already exists, don't fetch again
    if (research && research.pillars && research.pillars.length > 0) {
      return;
    }

    let cancelled = false;

    // Set loading state
    setLoadingResearchForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[Book Research] 🔄 Fetching for "${bookTitle}" by ${bookAuthor}...`);
      getBookResearch(bookTitle, bookAuthor).then((research) => {
        if (cancelled) return;
        
        // Clear loading state
        setLoadingResearchForBookId(null);
        
        if (research && research.pillars && research.pillars.length > 0) {
          console.log(`[Book Research] ✅ Received research with ${research.pillars.length} pillars for "${bookTitle}"`);
          // Store in state
          setResearchData(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, research);
            return newMap;
          });
        } else {
          console.log(`[Book Research] ⚠️ No research data found for "${bookTitle}"`);
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingResearchForBookId(null);
        console.error('Error fetching book research:', err);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      setLoadingResearchForBookId(null);
      clearTimeout(fetchTimer);
    };
    */
  }, [selectedIndex, books, researchData]); // Depend on selectedIndex, books, and researchData

  // Fetch other users who have the same book (book readers)
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
        // 1. Get all books with the same canonical_book_id from other users
        const { data: otherUsersBooks, error: booksError } = await supabase
          .from('books')
          .select('user_id')
          .eq('canonical_book_id', currentBook.canonical_book_id)
          .neq('user_id', user.id)
          .limit(20);

        if (booksError || !otherUsersBooks || otherUsersBooks.length === 0) {
          if (!cancelled) {
            setBookReaders([]);
            setIsLoadingBookReaders(false);
          }
          return;
        }

        const userIds = [...new Set(otherUsersBooks.map(b => b.user_id))];

        // 2. Get user profile info from users table
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, is_public')
          .in('id', userIds)
          .eq('is_public', true);

        if (usersError || !usersData || usersData.length === 0) {
          if (!cancelled) {
            setBookReaders([]);
            setIsLoadingBookReaders(false);
          }
          return;
        }

        // 3. Get list of users current user follows
        const { data: followsData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        const followingIds = new Set(followsData?.map(f => f.following_id) || []);

        // 4. Build readers list with following status, sorted by following first
        const readers: BookReader[] = (usersData || []).map(u => ({
          id: u.id,
          name: u.full_name || 'User',
          avatar: u.avatar_url,
          isFollowing: followingIds.has(u.id),
        })).sort((a, b) => (b.isFollowing ? 1 : 0) - (a.isFollowing ? 1 : 0));

        if (!cancelled) {
          setBookReaders(readers);
          setIsLoadingBookReaders(false);
        }
      } catch (err) {
        console.error('[BookReaders] Error fetching:', err);
        if (!cancelled) {
          setBookReaders([]);
          setIsLoadingBookReaders(false);
        }
      }
    };

    // Small delay to batch with other fetches
    const timer = setTimeout(fetchBookReaders, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeBook?.canonical_book_id, user]);

  // Pre-fetch/create Telegram topic in the background when book loads
  useEffect(() => {
    if (!user || !activeBook?.canonical_book_id) return;

    // Skip if already cached locally
    if (telegramTopics.has(activeBook.canonical_book_id)) return;

    let cancelled = false;

    const prefetchTelegramTopic = async () => {
      try {
        // First check if topic exists in database
        const existing = await getTelegramTopic(activeBook.canonical_book_id!);
        if (existing) {
          if (!cancelled) {
            setTelegramTopics(prev => new Map(prev).set(activeBook.canonical_book_id!, existing));
          }
          return;
        }

        // Topic doesn't exist - create it in the background
        const topic = await getOrCreateTelegramTopic(
          activeBook.title,
          activeBook.author,
          activeBook.canonical_book_id!,
          activeBook.cover_url || undefined,
          activeBook.genre || undefined
        );

        if (topic && !cancelled) {
          setTelegramTopics(prev => new Map(prev).set(activeBook.canonical_book_id!, topic));
        }
      } catch (err) {
        console.error('[TelegramTopic] Error prefetching:', err);
      }
    };

    // Small delay to not compete with other fetches
    const timer = setTimeout(prefetchTelegramTopic, 1000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeBook?.canonical_book_id, user]);

  // Fetch discussion questions when the discussion modal opens
  useEffect(() => {
    if (!showBookDiscussion || !activeBook || !activeBook.canonical_book_id) {
      return;
    }

    analytics.trackEvent('discussion', 'view', { book_title: activeBook.title });

    // Don't fetch if we already have questions for this book
    if (discussionQuestions.length > 0) {
      return;
    }

    let cancelled = false;
    setIsLoadingDiscussionQuestions(true);

    const fetchQuestions = async () => {
      try {
        const questions = await getDiscussionQuestions(
          activeBook.title,
          activeBook.author,
          activeBook.canonical_book_id!
        );

        if (!cancelled) {
          setDiscussionQuestions(questions);
          setIsLoadingDiscussionQuestions(false);
        }
      } catch (err) {
        console.error('[DiscussionQuestions] Error fetching:', err);
        if (!cancelled) {
          setIsLoadingDiscussionQuestions(false);
        }
      }
    };

    fetchQuestions();

    return () => {
      cancelled = true;
    };
  }, [showBookDiscussion, activeBook?.canonical_book_id]);

  // Reset discussion questions when the book changes
  useEffect(() => {
    setDiscussionQuestions([]);
  }, [activeBook?.id]);

  // Track which books we've generated feed items for to avoid duplicate generation
  const generatedFeedForBooksRef = useRef<Set<string>>(new Set());

  // Generate feed items when content is cached for a book
  useEffect(() => {
    if (!user) return;

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title) return;

    const bookId = currentBook.id;

    // Skip if we've already generated feed items for this book
    if (generatedFeedForBooksRef.current.has(bookId)) return;

    // Check if this book has any cached content (indicating content has been fetched)
    // We'll trigger feed generation after a delay to allow content fetching to complete
    const timer = setTimeout(async () => {
      // Double-check we haven't already generated
      if (generatedFeedForBooksRef.current.has(bookId)) return;

      // Check if the book has some cached content
      const hasInfluences = bookInfluences.has(bookId) && (bookInfluences.get(bookId)?.length || 0) > 0;
      const hasContext = bookContext.has(bookId) && (bookContext.get(bookId)?.length || 0) > 0;
      const hasDomain = bookDomain.has(bookId) && (bookDomain.get(bookId)?.facts?.length || 0) > 0;
      const hasFacts = currentBook.author_facts && currentBook.author_facts.length > 0;
      const hasVideos = youtubeVideos.has(bookId) && (youtubeVideos.get(bookId)?.length || 0) > 0;
      const hasDidYouKnow = didYouKnow.has(bookId) && (didYouKnow.get(bookId)?.length || 0) > 0;

      // Only generate if we have at least some content
      if (hasInfluences || hasContext || hasDomain || hasFacts || hasVideos || hasDidYouKnow) {
        console.log(`[Feed Generation] 🔄 Generating feed items for "${currentBook.title}"...`);
        generatedFeedForBooksRef.current.add(bookId);

        const result = await generateFeedItemsForBook(
          user.id,
          bookId,
          currentBook.title,
          currentBook.author || '',
          currentBook.cover_url || null,
          currentBook.reading_status || null,
          currentBook.created_at
        );

        console.log(`[Feed Generation] ✅ Created ${result.created} feed items for "${currentBook.title}"`);
      }
    }, 5000); // Wait 5 seconds for content fetching to complete

    return () => clearTimeout(timer);
  }, [activeBook?.id, user, bookInfluences, bookContext, bookDomain, youtubeVideos, didYouKnow]);

  // Track if feed has been loaded to prevent reload on app resume
  const feedLoadedRef = useRef(false);

  // Load personalized feed when feed page is shown (with stale-while-revalidate cache)
  useEffect(() => {
    if (!showFeedPage || !user || isAnonymous) return;

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
      setFeedDisplayCount(8); // Reset pagination
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

  // Cleanup feed audio when leaving feed page
  useEffect(() => {
    if (!showFeedPage && feedAudioRef.current) {
      feedAudioRef.current.pause();
      feedAudioRef.current = null;
      setFeedPlayingAudioUrl(null);
    }
  }, [showFeedPage]);

  // Cleanup feed audio on unmount
  useEffect(() => {
    return () => {
      if (feedAudioRef.current) {
        feedAudioRef.current.pause();
        feedAudioRef.current = null;
      }
    };
  }, []);

  // Handle feed podcast play/pause
  function handleFeedPodcastPlay(episode: any) {
    const audioUrl = episode?.audioUrl || (episode?.url && episode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? episode.url : null);

    if (audioUrl) {
      // Direct audio playback
      if (feedPlayingAudioUrl === audioUrl) {
        // Pause if already playing
        if (feedAudioRef.current) {
          feedAudioRef.current.pause();
          setFeedPlayingAudioUrl(null);
        }
      } else {
        // Stop any currently playing audio
        if (feedAudioRef.current) {
          feedAudioRef.current.pause();
        }
        // Play new audio
        setFeedPlayingAudioUrl(audioUrl);
        feedAudioRef.current = new Audio(audioUrl);
        feedAudioRef.current.addEventListener('ended', () => {
          setFeedPlayingAudioUrl(null);
        });
        feedAudioRef.current.addEventListener('error', () => {
          console.error('[Feed] Audio playback failed, opening URL:', episode.url);
          window.open(episode.url, '_blank');
          setFeedPlayingAudioUrl(null);
        });
        feedAudioRef.current.play();
      }
    } else if (episode?.url) {
      // No direct audio URL - open in new tab
      if (feedPlayingAudioUrl === episode.url) {
        setFeedPlayingAudioUrl(null);
      } else {
        if (feedAudioRef.current) {
          feedAudioRef.current.pause();
          setFeedPlayingAudioUrl(null);
        }
        setFeedPlayingAudioUrl(episode.url);
        window.open(episode.url, '_blank');
        setTimeout(() => setFeedPlayingAudioUrl(null), 1000);
      }
    }
  }

  // Helper function to generate canonical book ID (matches database function)
  function generateCanonicalBookId(title: string, author: string): string {
    const normalizedTitle = (title || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedAuthor = (author || '').toLowerCase().trim().replace(/\s+/g, ' ');
    return `${normalizedTitle}|${normalizedAuthor}`;
  }

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
        .select('id, title, author')
        .eq('user_id', user.id)
        .eq('canonical_book_id', canonicalBookId)
        .maybeSingle();
      
      if (existingBook) {
        // Find the book in the current books array and navigate to it
        const existingBookIndex = books.findIndex(book => book.id === existingBook.id);
        if (existingBookIndex !== -1) {
          // Book is already loaded, just navigate to it
          setSelectedIndex(existingBookIndex);
          setPendingBookMeta(null);
          // Make sure we're on the books view (not bookshelf/notes)
          setShowBookshelf(false);
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
          setShowBookshelf(false);
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
          setShowBookshelf(false);
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
      setShowBookshelf(false);
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

  async function handleDelete() {
    if (!activeBook || !user) return;

    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', activeBook.id)
        .eq('user_id', user.id); // Ensure user can only delete their own books

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
          initial={{ opacity: 0 }}
          animate={{
            opacity: scrollY > 20 ? Math.max(0, 1 - (scrollY - 20) / 40) : 1,
          }}
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
      {!(!showBookshelf && !showBookshelfCovers && !showNotesView && !showAccountPage && !showSortingResults && !showFollowingPage && !showFeedPage && (!showChatPage || chatBookSelected) && !showCreatePost) && (
      <AnimatePresence mode="wait">
        <motion.div
          key={showSortingResults ? 'sorting-results-header' : showNotesView ? 'notes-header' : showBookshelf ? 'bookshelf-header' : 'books-header'}
          initial={{ opacity: 0 }}
          animate={{
            opacity: scrollY > 20 ? Math.max(0, 1 - (scrollY - 20) / 40) : 1,
            pointerEvents: scrollY > 60 ? 'none' : 'auto'
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          ref={headerPullRef}
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
                  setScrollY(0);
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
                  showBookshelf ? 'bookshelf' :
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
                  <Pencil size={24} className="text-slate-950 dark:text-slate-50" />
                ) : showBookshelfCovers ? (
                  featureFlags.hand_drawn_icons ? (
                    <img src={getAssetPath("/library.svg")} alt="Library" className="w-[24px] h-[24px]" />
                  ) : (
                    <Library size={24} className="text-slate-950 dark:text-slate-50" />
                  )
                ) : showBookshelf ? (
                  featureFlags.hand_drawn_icons ? (
                    <img src={getAssetPath("/library.svg")} alt="Library" className="w-[24px] h-[24px]" />
                  ) : (
                    <Library size={24} className="text-slate-950 dark:text-slate-50" />
                  )
                ) : (
                  <BookOpen size={24} className="text-slate-950 dark:text-slate-50" />
                )}
                <h1 className="text-2xl font-bold text-slate-950 dark:text-slate-50 drop-shadow-sm">
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
                                : showBookshelf
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
        {(showBookshelf || showBookshelfCovers) && !showAccountPage && !showSortingResults && !showFollowingPage && !showNotesView && !showFeedPage && !showChatPage && !viewingUserId && (
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
            onScroll={(scrollTop) => setScrollY(scrollTop)}
          />
        ) : showFollowingPage ? (
          <FollowingPage
            user={user!}
            supabase={supabase}
            scrollContainerRef={scrollContainerRef}
            onScroll={(scrollTop) => setScrollY(scrollTop)}
            onUserClick={(userId) => {
              capturePreviousView();
              setViewingUserId(userId);
              setShowFollowingPage(false);
              setShowFeedPage(false);
              setShowBookshelf(false);
              setShowBookshelfCovers(true);
              setShowNotesView(false);
              setShowAccountPage(false);
              setShowSortingResults(false);
            }}
            standardGlassmorphicStyle={standardGlassmorphicStyle}
          />
        ) : showFeedPage ? (
          <motion.main
            key="feed"
            ref={(el) => { scrollContainerRef.current = el; }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem + var(--safe-area-bottom, 0px))' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);

              // Infinite scroll: load more when within 300px of bottom
              if (
                hasMoreFeedItems &&
                !isLoadingMoreFeed &&
                target.scrollHeight - target.scrollTop - target.clientHeight < 300
              ) {
                setIsLoadingMoreFeed(true);
                const nextCount = Math.min(feedDisplayCount + 8, filteredFeedItems.length);
                const newItems = filteredFeedItems.slice(feedDisplayCount, nextCount);
                if (newItems.length > 0) {
                  markFeedItemsAsShown(newItems.map(item => item.id));
                }
                setFeedDisplayCount(nextCount);
                setIsLoadingMoreFeed(false);
              }
            }}
            onTouchStart={(e) => {
              if (e.currentTarget.scrollTop <= 0 && !feedRefreshing) {
                feedPullStartY.current = e.touches[0].clientY;
                feedHapticFired.current = false;
              }
            }}
            onTouchMove={(e) => {
              if (feedPullStartY.current === null || feedRefreshing) return;
              const dy = e.touches[0].clientY - feedPullStartY.current;
              if (dy > 0) {
                const dist = Math.min(dy * 0.3, 40);
                updateFeedPullDOM(dist);
                if (dist >= 30 && !feedHapticFired.current) {
                  feedHapticFired.current = true;
                  triggerMediumHaptic();
                }
              } else {
                feedPullStartY.current = null;
                updateFeedPullDOM(0);
              }
            }}
            onTouchEnd={() => {
              if (feedPullStartY.current === null) return;
              feedPullStartY.current = null;
              if (feedPullDistance.current >= 30) {
                setFeedRefreshing(true);
                updateFeedPullDOM(20);
                if (feedLottieRef.current) {
                  feedLottieRef.current.loop = true;
                  feedLottieRef.current.goToAndPlay(0);
                }
                (async () => {
                  try {
                    const items = await getPersonalizedFeed(user!.id);
                    const readItems = getReadFeedItems();
                    const itemsWithReadStatus = items.map(item => ({
                      ...item,
                      read: readItems.has(item.id)
                    }));
                    setPersonalizedFeedItems(itemsWithReadStatus as PersonalizedFeedItem[]);
                    if (user) setCache(CACHE_KEYS.feed(user.id), items);
                    setFeedDisplayCount(8);
                  } catch (error) {
                    console.error('[Feed] ❌ Error refreshing feed:', error);
                  } finally {
                    setFeedRefreshDone(true);
                    if (feedLottieRef.current) {
                      feedLottieRef.current.loop = false;
                    }
                  }
                })();
              } else {
                updateFeedPullDOM(0);
              }
            }}
          >
            {/* Feed Page */}
            {/* Pull to refresh indicator - always rendered, visibility controlled via ref */}
            <div ref={feedPullIndicatorRef} className="absolute left-0 right-0 flex justify-center z-50" style={{ top: '60px', display: (feedRefreshing || feedRefreshDone || feedRefreshFading) ? '' : 'none' }}>
              <div
                ref={feedPullLottieRef}
                className="w-20 h-20"
                style={{
                  opacity: feedRefreshFading ? 1 : feedRefreshDone ? 1 : feedRefreshing ? 1 : 0,
                  animation: feedRefreshFading ? 'fadeOut 0.8s ease-out forwards' : undefined,
                }}
              >
                <Lottie
                  lottieRef={feedLottieRef}
                  animationData={refreshAnimation}
                  loop={true}
                  autoplay={false}
                  onLoopComplete={() => {
                    if (feedRefreshDone) {
                      setFeedRefreshing(false);
                      setFeedRefreshDone(false);
                      setFeedRefreshFading(true);
                      setTimeout(() => {
                        setFeedRefreshFading(false);
                        updateFeedPullDOM(0);
                      }, 800);
                    }
                  }}
                />
              </div>
            </div>
            <div ref={feedPullContentRef} className="w-full max-w-[700px] md:mx-auto flex flex-col gap-0 px-0 pt-8">
              {/* Anonymous user feed empty state */}
              {isAnonymous ? (
                <div
                  className="w-full rounded-2xl overflow-hidden p-8 text-center mx-3"
                  style={{
                    background: 'rgba(255, 255, 255, 0.45)',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(9.4px)',
                    WebkitBackdropFilter: 'blur(9.4px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    maxWidth: 'calc(100% - 24px)',
                  }}
                >
                  <Birdhouse size={32} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-slate-800 dark:text-slate-200 font-medium mb-2">Your personalized feed</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Connect an account to unlock your feed with insights, podcasts, and more for your books.</p>
                  <button
                    onClick={() => {
                      setConnectAccountReason('feed');
                      setShowConnectAccountModal(true);
                    }}
                    className="px-6 py-2.5 rounded-lg font-bold text-sm text-white active:scale-95 transition-all"
                    style={{
                      background: 'rgba(59, 130, 246, 0.85)',
                      backdropFilter: 'blur(9.4px)',
                      WebkitBackdropFilter: 'blur(9.4px)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    Connect account
                  </button>
                </div>
              ) : (<>
              {/* Feed filter pills */}
              <div key={`filters-${feedFilter}`} className="flex items-center gap-2 mb-3 px-4">
                {/* Read status filter — hidden for now */}
                {/* Type filter dropdown */}
                <div className="relative" ref={feedTypeDropdownRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFeedTypeDropdownOpen(!isFeedTypeDropdownOpen);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all text-slate-700 dark:text-slate-300 hover:opacity-80"
                    style={glassmorphicStyle}
                  >
                    <span className="text-slate-400 font-normal">Show</span>
                    <span>
                      {feedTypeFilter === 'all' ? 'All posts' :
                       feedTypeFilter === 'fact' ? 'Facts' :
                       feedTypeFilter === 'context' ? 'Context' :
                       feedTypeFilter === 'drilldown' ? 'Insights' :
                       feedTypeFilter === 'influence' ? 'Influences' :
                       feedTypeFilter === 'podcast' ? 'Podcasts' :
                       feedTypeFilter === 'article' ? 'Articles' :
                       feedTypeFilter === 'related_book' ? 'Books' :
                       feedTypeFilter === 'video' ? 'Videos' :
                       feedTypeFilter === 'friend_book' ? 'Friends' : 'All posts'}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${isFeedTypeDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isFeedTypeDropdownOpen && (
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsFeedTypeDropdownOpen(false)}
                      />
                      {/* Menu */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full right-0 mt-1 z-40 rounded-lg min-w-[120px] overflow-hidden"
                        style={feedCardStyle}
                      >
                        {[
                          { value: 'all', label: 'All posts', enabled: true },
                          { value: 'fact', label: 'Facts', enabled: featureFlags.insights.author_facts },
                          { value: 'context', label: 'Context', enabled: featureFlags.insights.book_context },
                          { value: 'drilldown', label: 'Insights', enabled: featureFlags.insights.book_domain },
                          { value: 'influence', label: 'Influences', enabled: featureFlags.insights.book_influences },
                          { value: 'did_you_know', label: 'Did You Know?', enabled: featureFlags.insights.did_you_know },
                          { value: 'podcast', label: 'Podcasts', enabled: true },
                          { value: 'article', label: 'Articles', enabled: true },
                          { value: 'related_book', label: 'Books', enabled: true },
                          { value: 'video', label: 'Videos', enabled: true },
                          { value: 'related_work', label: 'Movies & Music', enabled: true },
                          { value: 'friend_book', label: 'Friends', enabled: true },
                        ].filter(option => option.enabled).map((option, idx, filteredArray) => (
                          <button
                            key={option.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFeedTypeFilter(option.value as typeof feedTypeFilter);
                              setFeedDisplayCount(8);
                              setIsFeedTypeDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                              feedTypeFilter === option.value
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-white/30 dark:bg-white/12'
                            } ${idx === 0 ? 'rounded-t-lg' : ''} ${idx === filteredArray.length - 1 ? 'rounded-b-lg' : ''}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </div>
              </div>

              {/* Loading skeleton */}
              {isLoadingPersonalizedFeed && (
                <>
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={`skeleton-${i}`}
                      animate={{ opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
                      className="w-full"
                    >
                      <div className="flex gap-3 px-4 pt-3 pb-2">
                        <div className="w-11 h-11 rounded-full bg-slate-300/50 dark:bg-slate-600/50 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-28 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                            <div className="w-8 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                          </div>
                          <div className="w-full h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded mb-2" />
                          <div className="w-4/5 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded mb-2" />
                          <div className="w-2/3 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                        </div>
                      </div>
                      <div className="h-px bg-slate-200/50 dark:bg-slate-700/40" />
                    </motion.div>
                  ))}
                </>
              )}

              {/* Empty state - no feed items at all */}
              {!isLoadingPersonalizedFeed && personalizedFeedItems.length === 0 && (
                <div
                  className="rounded-2xl overflow-hidden p-8 text-center mx-4"
                  style={{
                    background: 'rgba(255, 255, 255, 0.45)',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(9.4px)',
                    WebkitBackdropFilter: 'blur(9.4px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <Birdhouse size={32} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-slate-800 dark:text-slate-200 font-medium mb-2">Your feed is empty</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Add books and mark them as read to see personalized content here.</p>
                </div>
              )}

              {/* Empty state - filters resulted in no items */}
              {!isLoadingPersonalizedFeed && personalizedFeedItems.length > 0 && filteredFeedItems.length === 0 && (
                <div
                  className="rounded-2xl overflow-hidden p-8 text-center mx-4"
                  style={{
                    background: 'rgba(255, 255, 255, 0.45)',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(9.4px)',
                    WebkitBackdropFilter: 'blur(9.4px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <Birdhouse size={32} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-slate-800 dark:text-slate-200 font-medium mb-2">No matching items</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your filters to see more content.</p>
                </div>
              )}

              {/* Dynamic Feed Items */}
              <AnimatePresence mode="popLayout">
              {!isLoadingPersonalizedFeed && displayedFeedItems.map((item) => {
                // Helper to render read toggle button
                // Unread = blue dot, Read = empty circle
                const ReadToggle = () => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newRead = !item.read;
                      setFeedItemReadStatus(item.id, newRead);
                      setPersonalizedFeedItems(prev =>
                        prev.map(fi => fi.id === item.id ? { ...fi, read: newRead } : fi)
                      );
                    }}
                    className="ml-1 p-1.5 rounded-full hover:bg-white/30 dark:bg-white/12 transition-colors flex items-center justify-center"
                    title={item.read ? 'Mark as unread' : 'Mark as read'}
                  >
                    {item.read ? (
                      <Circle size={14} className="text-slate-400" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                    )}
                  </button>
                );
                const feedContentHash = item.content_hash || item.id;
                const FeedHeart = () => (
                  <HeartButton
                    contentHash={feedContentHash}
                    count={heartCounts.get(feedContentHash) || 0}
                    isHearted={userHearted.has(feedContentHash)}
                    onToggle={handleToggleHeart}
                    size={17}
                  />
                );
                const cardOpacity = '';
                const openSourceBookOverlay = () => {
                  const bookForModal: BookWithRatings = {
                    id: `feed-source-${item.id}`,
                    user_id: user?.id || '',
                    title: item.source_book_title || 'Book',
                    author: item.source_book_author || 'Unknown Author',
                    cover_url: item.source_book_cover_url || null,
                    publish_year: null,
                    wikipedia_url: null,
                    google_books_url: null,
                    genre: null,
                    first_issue_year: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    reading_status: null,
                    ratings: { writing: null, insights: null, flow: null, world: null, characters: null },
                  };
                  setViewingBookFromOtherUser(bookForModal);
                };

                // Threads-style card wrapper
                const renderThreadCard = (_typeLabel: string, content: React.ReactNode) => (
                  <motion.div key={item.id} initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className={`w-full ${cardOpacity}`}>
                    <div className="flex gap-3 px-4 pt-3 pb-2">
                      {/* Avatar */}
                      <button onClick={openSourceBookOverlay} className="flex-shrink-0 active:scale-95 transition-transform self-start mt-1 relative">
                        {item.source_book_cover_url ? (
                          <img src={item.source_book_cover_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center">
                            <BookOpen size={18} className="text-slate-400" />
                          </div>
                        )}
                        <img src={getAssetPath('/avatars/bookluver.webp')} alt="" className="absolute -bottom-1.5 -right-1.5 w-[24px] h-[24px] rounded-full border-2 border-white dark:border-slate-900 object-cover" />
                      </button>
                      {/* Content column */}
                      <div className="flex-1 min-w-0 break-words">
                        {/* Header: book title + time */}
                        <div className="flex items-baseline gap-2 mb-2">
                          <button onClick={openSourceBookOverlay} className="active:opacity-70 min-w-0 flex-1">
                            <span className="font-bold text-[15px] text-slate-900 dark:text-slate-100 line-clamp-1 text-left">{item.source_book_title}</span>
                          </button>
                          <span className="text-[13px] text-slate-600 dark:text-slate-500 flex-shrink-0">{timeAgo(item.created_at)}</span>
                        </div>
                        {/* Content — type woven in */}
                        {content}
                        {/* Action bar */}
                        <div className="flex items-center gap-6 mt-2.5 pb-1">
                          <FeedHeart />
                          {remoteFlags.commenting_enabled && <MessageCircle size={17} className="text-slate-600 dark:text-slate-400" />}
                              {remoteFlags.send_enabled && <Send size={17} className="text-slate-600 dark:text-slate-400" />}
                        </div>
                      </div>
                    </div>
                    <div className="h-px bg-slate-200/50 dark:bg-slate-700/40" />
                  </motion.div>
                );

                // Render based on type
                switch (item.type) {
                  case 'fact':
                    return renderThreadCard('fact', (
                      <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">{item.content.fact}</p>
                    ));

                  case 'context':
                    const contextData = item.content.insight;
                    return renderThreadCard('context', (
                      <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">
                        {typeof contextData === 'string' ? contextData : contextData?.text || JSON.stringify(contextData)}
                      </p>
                    ));

                  case 'drilldown':
                    const drilldownData = item.content.insight;
                    return renderThreadCard('drilldown', (
                      <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">
                        {typeof drilldownData === 'string' ? drilldownData : drilldownData?.text || JSON.stringify(drilldownData)}
                      </p>
                    ));

                  case 'influence':
                    const influenceData = item.content.influence;
                    return renderThreadCard('influence', (
                      <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">
                        {typeof influenceData === 'string' ? influenceData : influenceData?.title || JSON.stringify(influenceData)}
                      </p>
                    ));

                  case 'podcast':
                    const episode = item.content.episode;
                    const podcastAudioUrl = episode?.audioUrl || (episode?.url && episode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? episode.url : null);
                    const isPodcastPlaying = feedPlayingAudioUrl === (podcastAudioUrl || episode?.url);
                    return renderThreadCard('podcast', (
                      <>
                        {/* Thumbnail with play button overlay */}
                        <div className="relative w-1/2 aspect-square rounded-xl overflow-hidden mb-2">
                          {episode?.thumbnail ? (
                            <img src={episode.thumbnail} alt={episode.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-b from-violet-700 to-violet-950 flex items-center justify-center">
                              <Headphones size={32} className="text-white/30" />
                            </div>
                          )}
                          {/* Play button */}
                          {(() => { const isThisTooltipOpen = feedPodcastTooltip?.id === item.id; return (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: isThisTooltipOpen ? 10000 : 1 }}>
                            <button
                              onTouchStart={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isNativePlatform && episode?.url) {
                                  openDeepLink(episode.url);
                                  return;
                                }
                                feedPlayButtonRef.current = e.currentTarget as HTMLButtonElement;
                                if (isThisTooltipOpen) {
                                  setFeedPodcastTooltip(null);
                                } else {
                                  setFeedPodcastTooltip({ id: item.id, url: episode?.url || '', audioUrl: episode?.audioUrl });
                                }
                              }}
                              className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
                              style={{
                                background: isThisTooltipOpen ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.25)',
                                backdropFilter: 'blur(9.4px)',
                                WebkitBackdropFilter: 'blur(9.4px)',
                                border: isThisTooltipOpen ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.3)',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                              }}
                            >
                              {isThisTooltipOpen ? <X size={16} className="text-white" /> : <Play size={18} className="text-white ml-0.5" fill="white" />}
                            </button>
                          </div>
                          ); })()}
                          {/* Bottom gradient */}
                          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                          {/* Overlay info */}
                          <div className="absolute inset-x-3 bottom-3">
                            <p className="text-xs text-white/80 font-medium">{episode?.podcast_name || 'Podcast'}{episode?.length ? ` · ${episode.length}` : ''}</p>
                          </div>
                        </div>
                        {/* Title + summary */}
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-[15px] line-clamp-2">{episode?.title || 'Podcast Episode'}</p>
                        {episode?.episode_summary && (
                          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                            <p className={`text-sm text-slate-600 dark:text-slate-400 leading-snug ${expandedFeedDescriptions.has(item.id) ? '' : 'line-clamp-2'}`}>{episode.episode_summary}</p>
                            {episode.episode_summary.length > 120 && (
                              <button
                                onClick={() => {
                                  setExpandedFeedDescriptions(prev => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    return next;
                                  });
                                }}
                                className="text-blue-600 dark:text-blue-400 text-sm font-semibold mt-1"
                              >
                                {expandedFeedDescriptions.has(item.id) ? 'Show less' : 'more'}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    ));

                  case 'video':
                    const video = item.content.video;
                    const videoId = video?.videoId || video?.id;
                    const isVideoPlaying = feedPlayingVideoId === videoId;
                    return renderThreadCard('video', (
                      <>
                        {isVideoPlaying ? (
                          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                            <iframe
                              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                            <button onClick={() => setFeedPlayingVideoId(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                              <X size={16} className="text-white" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setFeedPlayingVideoId(videoId)} className="block w-full text-left">
                            <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden">
                              {video?.thumbnail && <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center"
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.25)',
                                    backdropFilter: 'blur(9.4px)',
                                    WebkitBackdropFilter: 'blur(9.4px)',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                                  }}
                                >
                                  <Play size={18} className="text-white ml-0.5" fill="white" />
                                </div>
                              </div>
                            </div>
                          </button>
                        )}
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-2 line-clamp-2">{decodeHtmlEntities(video?.title || 'YouTube Video')}</p>
                        {video?.description && (
                          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                            <p className={`text-sm text-slate-600 dark:text-slate-400 leading-snug ${
                              expandedFeedDescriptions.has(item.id) ? '' : 'line-clamp-2'
                            }`}>
                              {video.description}
                            </p>
                            {video.description.length > 120 && (
                              <button
                                onClick={() => {
                                  setExpandedFeedDescriptions(prev => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    return next;
                                  });
                                }}
                                className="text-blue-600 dark:text-blue-400 text-sm font-semibold mt-1"
                              >
                                {expandedFeedDescriptions.has(item.id) ? 'Show less' : 'more'}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    ));

                  case 'related_book':
                    const relatedBook = item.content.related_book;
                    const handleRelatedBookClick = () => {
                      if (!relatedBook) return;
                      const bookForModal: BookWithRatings = {
                        id: `related-${item.id}`,
                        user_id: user?.id || '',
                        title: relatedBook.title || 'Related Book',
                        author: relatedBook.author || 'Unknown Author',
                        cover_url: relatedBook.cover_url || null,
                        publish_year: null,
                        wikipedia_url: null,
                        google_books_url: null,
                        genre: null,
                        first_issue_year: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        reading_status: null,
                        ratings: { writing: null, insights: null, flow: null, world: null, characters: null },
                      };
                      setViewingBookFromOtherUser(bookForModal);
                    };
                    return renderThreadCard('related_book', (
                      <div onClick={handleRelatedBookClick} className="w-full text-left active:scale-[0.98] transition-transform cursor-pointer">
                        <div className="flex items-center gap-3 mt-2 mb-3">
                          <div className="relative flex-shrink-0">
                            {item.source_book_cover_url ? (
                              <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-[70px] h-[106px] object-cover rounded-lg shadow-sm" />
                            ) : (
                              <div className="w-[70px] h-[106px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                                <BookOpen size={18} className="text-slate-400" />
                              </div>
                            )}
                            <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                              <Check size={12} className="text-white" strokeWidth={3} />
                            </div>
                          </div>
                          <ChevronsRight size={18} className="text-slate-600 dark:text-slate-500 flex-shrink-0" />
                          <div className="flex-shrink-0 relative">
                            {relatedBook?.cover_url ? (
                              <img
                                src={relatedBook.cover_url}
                                alt={relatedBook.title}
                                className="w-32 h-48 object-cover rounded-lg shadow-sm"
                                crossOrigin="anonymous"
                                onLoad={(e) => {
                                  try {
                                    const img = e.currentTarget;
                                    const canvas = document.createElement('canvas');
                                    const size = 64;
                                    canvas.width = size;
                                    canvas.height = size;
                                    const ctx = canvas.getContext('2d');
                                    if (!ctx) return;
                                    ctx.drawImage(img, 0, 0, size, size);
                                    const startY = Math.floor(size * 0.6);
                                    const data = ctx.getImageData(0, startY, size, size - startY).data;
                                    let totalLuminance = 0;
                                    const pixelCount = data.length / 4;
                                    for (let i = 0; i < data.length; i += 4) {
                                      totalLuminance += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                                    }
                                    const avgLuminance = totalLuminance / pixelCount;
                                    setFeedCoverBrightness(prev => new Map(prev).set(item.id, avgLuminance > 140 ? 'light' : 'dark'));
                                  } catch {}
                                }}
                              />
                            ) : (
                              <div className="w-32 h-48 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                                <BookOpen size={24} className="text-slate-400" />
                              </div>
                            )}
                            {/* + Add button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddBook({
                                  title: relatedBook?.title || '',
                                  author: relatedBook?.author || '',
                                  cover_url: relatedBook?.cover_url || null,
                                  publish_year: null,
                                  wikipedia_url: null,
                                  google_books_url: null,
                                });
                              }}
                              className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-all active:scale-95"
                              style={{
                                background: 'rgba(255, 255, 255, 0.25)',
                                backdropFilter: 'blur(9.4px)',
                                WebkitBackdropFilter: 'blur(9.4px)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                                color: (feedCoverBrightness.get(item.id) || 'dark') === 'light' ? 'rgba(0,0,0,0.8)' : 'white',
                              }}
                            >
                              <Plus size={14} />
                              Add
                            </button>
                          </div>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">{decodeHtmlEntities(relatedBook?.title || 'Related Book')}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{decodeHtmlEntities(relatedBook?.author || '')}</p>
                        {relatedBook?.reason && (
                          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                            <p className={`text-sm text-slate-600 dark:text-slate-300 leading-snug ${
                              expandedFeedDescriptions.has(item.id) ? '' : 'line-clamp-3'
                            }`}>
                              {decodeHtmlEntities(relatedBook.reason)}
                            </p>
                            {relatedBook.reason.length > 150 && (
                              <button
                                onClick={() => {
                                  setExpandedFeedDescriptions(prev => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    return next;
                                  });
                                }}
                                className="text-blue-600 dark:text-blue-400 text-sm font-semibold mt-1"
                              >
                                {expandedFeedDescriptions.has(item.id) ? 'Show less' : 'more'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ));

                  case 'related_work':
                    const relatedWork = item.content.related_work;
                    const workType = relatedWork?.type || 'movie';
                    const WorkIcon = workType === 'album' ? Music : workType === 'show' ? Tv : Film;
                    const workLabel = workType === 'album' ? 'Album' : workType === 'show' ? 'TV Show' : 'Movie';
                    const workPosterUrl = (workType === 'album' && relatedWork?.itunes_artwork) || relatedWork?.poster_url;

                    if (workType === 'album') {
                      const albumArt = relatedWork?.itunes_artwork || relatedWork?.poster_url;
                      const albumPlayUrl = relatedWork?.itunes_url
                        ? `https://song.link/${relatedWork.itunes_url}`
                        : null;
                      return renderThreadCard('related_work', (
                        <div>
                          {/* Vinyl record visual — container height = vinyl disc, sleeve = disc * 1.05 */}
                          <div className="relative w-[96%] mx-auto my-6 flex items-center" style={{ aspectRatio: '1.7 / 1' }}>
                            {/* Vinyl disc (behind sleeve) — 100% height, right-aligned */}
                            <div
                              className="absolute z-10 aspect-square"
                              style={{ height: '100%', right: '20px', top: '50%', transform: 'translateY(-50%)' }}
                            >
                              <div
                                className="w-full aspect-square rounded-full animate-[vinyl-spin_3s_linear_infinite]"
                                style={{
                                  background: 'radial-gradient(circle, #222 0%, #111 40%, #000 100%)',
                                  boxShadow: '0 0 30px rgba(0,0,0,0.6)',
                                }}
                              >
                                {/* Grooves */}
                                <div
                                  className="absolute inset-0 rounded-full opacity-40 pointer-events-none"
                                  style={{ background: 'repeating-radial-gradient(circle, transparent 0, transparent 2px, rgba(255,255,255,0.03) 3px, transparent 4px)' }}
                                />
                                {/* Center label */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 aspect-square rounded-full bg-zinc-800 border-4 border-black/20 overflow-hidden shadow-inner flex items-center justify-center">
                                  {albumArt && (
                                    <div
                                      className="absolute inset-0 bg-center bg-cover opacity-80"
                                      style={{ backgroundImage: `url('${albumArt}')` }}
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-black/30" />
                                  <div className="z-20 w-2 h-2 bg-zinc-950 rounded-full border border-white/10 shadow-inner" />
                                </div>
                              </div>
                            </div>

                            {/* Album sleeve (on top) — 105% of disc height, vertically centered */}
                            <div
                              className="absolute z-20 aspect-square rounded-sm"
                              style={{ height: '105%', left: 0, top: '50%', transform: 'translateY(-50%)', boxShadow: '10px 10px 40px rgba(0,0,0,0.5)' }}
                            >
                              <div className="absolute inset-0 rounded-sm overflow-hidden">
                                {albumArt ? (
                                  <img
                                    src={albumArt}
                                    alt={decodeHtmlEntities(relatedWork?.title || '')}
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="absolute inset-0 bg-gradient-to-b from-pink-800 to-pink-950 flex items-center justify-center">
                                    <Disc3 size={36} className="text-white/30" />
                                  </div>
                                )}
                                <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/30 to-transparent z-30" />
                              </div>

                              {/* Play button — centered on album art */}
                              {(relatedWork?.itunes_url || relatedWork?.music_links) && (() => { const isThisMusicOpen = feedMusicModalData?.id === item.id; return (
                                <button
                                  onTouchStart={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    feedPlayButtonRef.current = e.currentTarget as HTMLButtonElement;
                                    if (isThisMusicOpen) {
                                      setFeedMusicModalData(null);
                                    } else if (isNativePlatform && /iPhone|iPad|iPod/.test(navigator.userAgent) && relatedWork.itunes_url) {
                                      openDeepLink(relatedWork.itunes_url);
                                    } else if (relatedWork.music_links) {
                                      setFeedMusicModalData({ id: item.id, musicLinks: relatedWork.music_links, title: relatedWork.title || '', artist: relatedWork.director || '' });
                                    } else if (relatedWork.itunes_url) {
                                      window.open(`https://song.link/${relatedWork.itunes_url}`, '_blank');
                                    }
                                  }}
                                  className="absolute w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                                  style={{
                                    zIndex: isThisMusicOpen ? 10000 : 30,
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: isThisMusicOpen ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.25)',
                                    backdropFilter: 'blur(9.4px)',
                                    WebkitBackdropFilter: 'blur(9.4px)',
                                    border: isThisMusicOpen ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.3)',
                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                                  }}
                                >
                                  {isThisMusicOpen ? <X size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" fill="white" />}
                                </button>
                              ); })()}
                            </div>
                          </div>
                          {/* Text info */}
                          <span className="inline-flex items-center gap-1 py-0.5 px-1.5 text-[10px] font-bold rounded-full uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 mb-1">
                            <Music size={10} />
                            Album
                          </span>
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-[15px] leading-tight">{decodeHtmlEntities(relatedWork?.title || '')}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {decodeHtmlEntities(relatedWork?.director || '')}
                            {relatedWork?.release_year ? ` (${relatedWork.release_year})` : ''}
                          </p>
                          {relatedWork?.reason && (
                            <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                              <p className={`text-sm text-slate-600 dark:text-slate-400 leading-snug ${expandedFeedDescriptions.has(item.id) ? '' : 'line-clamp-2'}`}>{decodeHtmlEntities(relatedWork.reason)}</p>
                              {relatedWork.reason.length > 150 && (
                                <button
                                  onClick={() => {
                                    setExpandedFeedDescriptions(prev => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    });
                                  }}
                                  className="text-blue-600 dark:text-blue-400 text-xs font-semibold mt-1"
                                >
                                  {expandedFeedDescriptions.has(item.id) ? 'Show less' : 'more'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ));
                    }

                    return renderThreadCard('related_work', (
                      <div>
                        <div className="relative w-[70%] rounded-lg mb-3" style={{ aspectRatio: '2 / 3' }}>
                          <div className="absolute inset-0 rounded-lg overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5)', filter: 'drop-shadow(2px 3px 6px rgba(0,0,0,0.4))' }}>
                            {workPosterUrl ? (
                              <img src={workPosterUrl} alt={decodeHtmlEntities(relatedWork?.title || '')} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
                                <WorkIcon size={40} className="text-white/30" />
                              </div>
                            )}
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
                            {/* Vignette */}
                            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 50px rgba(0,0,0,0.35)' }} />
                          </div>
                          {/* Play button — centered on poster (feature-flagged for movies/shows) */}
                          {remoteFlags.related_work_play_buttons && (() => { const isThisWatchOpen = feedWatchModalData?.id === item.id; return (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: isThisWatchOpen ? 10000 : 30 }}>
                            <button
                              onTouchStart={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                feedPlayButtonRef.current = e.currentTarget as HTMLButtonElement;
                                if (isThisWatchOpen) {
                                  setFeedWatchModalData(null);
                                } else {
                                  const wl = relatedWork?.watch_links;
                                  if (isNativePlatform && /iPhone|iPad|iPod/.test(navigator.userAgent) && wl?.apple) {
                                    openDeepLink(wl.apple);
                                  } else if (wl && Object.keys(wl).some(k => k !== 'tmdb_url' && wl[k as keyof typeof wl])) {
                                    setFeedWatchModalData({ id: item.id, watchLinks: wl, title: relatedWork?.title || '', year: relatedWork?.release_year });
                                  } else if (relatedWork?.itunes_url) {
                                    window.open(relatedWork.itunes_url, '_blank');
                                  }
                                }
                              }}
                              className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
                              style={{
                                background: isThisWatchOpen ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.25)',
                                backdropFilter: 'blur(9.4px)',
                                WebkitBackdropFilter: 'blur(9.4px)',
                                border: isThisWatchOpen ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.3)',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                              }}
                            >
                              {isThisWatchOpen ? <X size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" fill="white" />}
                            </button>
                          </div>
                          ); })()}
                        </div>
                        <div>
                          <span className="inline-flex items-center gap-1 py-0.5 px-1.5 text-[10px] font-bold rounded-full uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 mb-1">
                            <WorkIcon size={10} />
                            {workLabel}
                          </span>
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-[15px] leading-tight">{decodeHtmlEntities(relatedWork?.title || '')}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {decodeHtmlEntities(relatedWork?.director || '')}
                            {relatedWork?.release_year ? ` (${relatedWork.release_year})` : ''}
                          </p>
                          {relatedWork?.reason && (
                            <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                              <p className={`text-sm text-slate-600 dark:text-slate-400 leading-snug ${expandedFeedDescriptions.has(item.id) ? '' : 'line-clamp-2'}`}>{decodeHtmlEntities(relatedWork.reason)}</p>
                              {relatedWork.reason.length > 150 && (
                                <button
                                  onClick={() => {
                                    setExpandedFeedDescriptions(prev => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    });
                                  }}
                                  className="text-blue-600 dark:text-blue-400 text-xs font-semibold mt-1"
                                >
                                  {expandedFeedDescriptions.has(item.id) ? 'Show less' : 'more'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ));

                  case 'article':
                    const article = item.content.article;
                    const articleDomain = (() => {
                      try { return new URL(article?.url || '').hostname.replace('www.', ''); } catch { return ''; }
                    })();
                    return renderThreadCard('article', (
                      <>
                        {article?.url && (
                          <p className="text-[15px] mb-2">
                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 block truncate" onClick={(e) => e.stopPropagation()}>{article.url}</a>
                          </p>
                        )}
                      <a
                        href={article?.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-3.5 py-3">
                          {articleDomain && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <img src={`https://www.google.com/s2/favicons?domain=${articleDomain}&sz=32`} alt="" className="w-4 h-4 rounded-sm" />
                              <span className="text-[13px] text-slate-500 dark:text-slate-400">{articleDomain}</span>
                            </div>
                          )}
                          <p className="font-semibold text-slate-900 dark:text-slate-100 text-[15px] leading-snug line-clamp-2">{decodeHtmlEntities(article?.title || 'Article')}</p>
                          {article?.snippet && (
                            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{decodeHtmlEntities(article.snippet)}</p>
                          )}
                        </div>
                      </a>
                      </>
                    ));

                  case 'friend_book':
                    const handleFriendBookAdd = () => {
                      const bookForModal: BookWithRatings = {
                        id: `friend-${item.id}`,
                        user_id: user?.id || '',
                        title: item.source_book_title || 'Book',
                        author: item.source_book_author || 'Unknown Author',
                        cover_url: item.source_book_cover_url || null,
                        publish_year: null,
                        wikipedia_url: null,
                        google_books_url: null,
                        genre: null,
                        first_issue_year: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        reading_status: null,
                        ratings: { writing: null, insights: null, flow: null, world: null, characters: null },
                      };
                      setViewingBookFromOtherUser(bookForModal);
                    };
                    const friendAvatarUrl = item.content.friend_avatar_url;
                    const friendName = item.content.friend_name || 'A friend';
                    // Fetch book summary if not already fetched
                    const summaryKey = `${(item.source_book_title || '').toLowerCase().trim()}::${(item.source_book_author || '').toLowerCase().trim()}`;
                    if (!feedSummaryFetchedRef.current.has(summaryKey) && item.source_book_title && item.source_book_author) {
                      feedSummaryFetchedRef.current.add(summaryKey);
                      supabase.from('book_summary_cache')
                        .select('summary_data')
                        .eq('book_title', (item.source_book_title || '').toLowerCase().trim())
                        .eq('book_author', (item.source_book_author || '').toLowerCase().trim())
                        .maybeSingle()
                        .then(({ data }) => {
                          if (data?.summary_data?.summary) {
                            setFeedBookSummaries(prev => new Map(prev).set(summaryKey, data.summary_data.summary));
                          }
                        });
                    }
                    const friendBookSummary = feedBookSummaries.get(summaryKey);
                    return (
                      <motion.div key={item.id} initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className={`w-full ${cardOpacity}`}>
                        <div className="flex gap-3 px-4 pt-3 pb-2">
                          {/* Friend's avatar */}
                          <button onClick={() => { if (item.user_id) { capturePreviousView(); setScrollY(0); setViewingUserId(item.user_id); setShowFeedPage(false); setShowBookshelfCovers(true); }}} className="flex-shrink-0 self-start mt-1 active:scale-95 transition-transform">
                            {friendAvatarUrl ? (
                              <img src={friendAvatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center">
                                <Users size={18} className="text-slate-400" />
                              </div>
                            )}
                          </button>
                          {/* Content column */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-2">
                              <button onClick={() => { if (item.user_id) { capturePreviousView(); setScrollY(0); setViewingUserId(item.user_id); setShowFeedPage(false); setShowBookshelfCovers(true); }}} className="active:opacity-70 min-w-0 flex-1">
                                <span className="font-bold text-[15px] text-slate-900 dark:text-slate-100 line-clamp-1 text-left">{friendName}</span>
                              </button>
                              <span className="text-[13px] text-slate-600 dark:text-slate-500 flex-shrink-0">{timeAgo(item.created_at)}</span>
                            </div>
                            <p className="text-[15px] text-slate-800 dark:text-slate-200 mb-2">{item.content.action || 'added'} a book</p>
                            {/* Book card */}
                            <div onClick={handleFriendBookAdd} className="w-full text-left active:scale-[0.98] transition-transform cursor-pointer">
                              {item.source_book_cover_url && (
                                <div className="relative w-[80%] aspect-[3/4] rounded-xl mb-2">
                                  <div className="absolute inset-0 rounded-xl overflow-hidden">
                                    <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-full h-full object-cover" />
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFriendBookAdd();
                                    }}
                                    className="absolute z-30 bottom-2 right-2 h-8 px-3 rounded-full flex items-center gap-1.5 active:scale-95 transition-transform"
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.25)',
                                      backdropFilter: 'blur(9.4px)',
                                      WebkitBackdropFilter: 'blur(9.4px)',
                                      border: '1px solid rgba(255, 255, 255, 0.3)',
                                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                                    }}
                                  >
                                    <Plus size={12} className="text-black" />
                                    <span className="text-black text-xs font-semibold">Add</span>
                                  </button>
                                </div>
                              )}
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-[15px]">{item.source_book_title}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">{item.source_book_author}</p>
                            </div>
                            {(friendBookSummary || item.content.description) && (
                              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                <p className={`text-[15px] text-slate-700 dark:text-slate-300 leading-relaxed ${
                                  expandedFeedDescriptions.has(item.id) ? '' : 'line-clamp-4'
                                }`}>
                                  {friendBookSummary || item.content.description}
                                </p>
                                {(friendBookSummary || item.content.description || '').length > 200 && (
                                  <button
                                    onClick={() => {
                                      setExpandedFeedDescriptions(prev => {
                                        const next = new Set(prev);
                                        if (next.has(item.id)) next.delete(item.id);
                                        else next.add(item.id);
                                        return next;
                                      });
                                    }}
                                    className="text-blue-600 dark:text-blue-400 text-sm font-semibold mt-1"
                                  >
                                    {expandedFeedDescriptions.has(item.id) ? 'Show less' : 'more'}
                                  </button>
                                )}
                              </div>
                            )}
                            {/* Action bar */}
                            <div className="flex items-center gap-6 mt-2.5 pb-1">
                              <FeedHeart />
                              {remoteFlags.commenting_enabled && <MessageCircle size={17} className="text-slate-600 dark:text-slate-400" />}
                              {remoteFlags.send_enabled && <Send size={17} className="text-slate-600 dark:text-slate-400" />}
                            </div>
                          </div>
                        </div>
                        <div className="h-px bg-slate-200/50 dark:bg-slate-700/40" />
                      </motion.div>
                    );

                  case 'did_you_know':
                    const didYouKnowNotes: string[] = item.content.notes || [];
                    const didYouKnowSourceUrl: string | undefined = item.content.source_url;

                    return renderThreadCard('did_you_know', (
                      <div className="space-y-2">
                        {didYouKnowNotes.map((note, idx) => (
                          <p key={idx} className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">{note}</p>
                        ))}
                        {didYouKnowSourceUrl && (
                          <a
                            href={didYouKnowSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 dark:text-blue-400 font-semibold"
                          >
                            <ExternalLink size={12} />
                            Source
                          </a>
                        )}
                      </div>
                    ));

                  case 'user_post':
                    return (
                      <motion.div key={item.id} initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className={`w-full ${cardOpacity}`}>
                        <div className="flex gap-3 px-4 pt-3 pb-2">
                          {/* Avatar */}
                          <div className="flex-shrink-0 self-start mt-1">
                            {item.content.user_avatar ? (
                              <img src={item.content.user_avatar} alt="" className="w-11 h-11 rounded-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center">
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{(item.content.user_name || '?').charAt(0).toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                          {/* Content column */}
                          <div className="flex-1 min-w-0 break-words">
                            <div className="flex items-baseline gap-2 mb-2">
                              <span className="font-bold text-[15px] text-slate-900 dark:text-slate-100">{item.content.user_name || 'You'}</span>
                              <span className="text-[13px] text-slate-600 dark:text-slate-500 flex-shrink-0">{timeAgo(item.created_at)}</span>
                            </div>
                            <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{item.content.text}</p>
                            {/* Action bar */}
                            <div className="flex items-center gap-6 mt-2.5 pb-1">
                              <FeedHeart />
                              {remoteFlags.commenting_enabled && <MessageCircle size={17} className="text-slate-600 dark:text-slate-400" />}
                              {remoteFlags.send_enabled && <Send size={17} className="text-slate-600 dark:text-slate-400" />}
                            </div>
                          </div>
                        </div>
                        <div className="h-px bg-slate-200/50 dark:bg-slate-700/40" />
                      </motion.div>
                    );

                  default:
                    return null;
                }
              })}
              </AnimatePresence>

              {/* Load more indicator */}
              {hasMoreFeedItems && !isLoadingPersonalizedFeed && (
                <div className="w-full flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                </div>
              )}

              {/* End of feed */}
              {!isLoadingPersonalizedFeed && !hasMoreFeedItems && displayedFeedItems.length > 0 && (
                <p className="text-center text-xs text-slate-400 py-4">You've reached the end</p>
              )}

              </>)}
            </div>
          </motion.main>
        ) : showChatPage ? (
          <motion.main
            key={chatBookSelected && activeBook ? 'chat-book' : 'chat-list'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={chatBookSelected && activeBook ? 'flex-1' : 'flex-1 flex flex-col relative pt-20 overflow-y-auto ios-scroll'}
            style={chatBookSelected && activeBook ? undefined : { backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem + var(--safe-area-bottom, 0px))' }}
            {...(!(chatBookSelected && activeBook) ? {
              onScroll: (e: React.UIEvent<HTMLElement>) => { setScrollY(e.currentTarget.scrollTop); },
              onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
                if (e.currentTarget.scrollTop <= 0 && !chatRefreshing) {
                  chatPullStartY.current = e.touches[0].clientY;
                  chatHapticFired.current = false;
                }
              },
              onTouchMove: (e: React.TouchEvent<HTMLElement>) => {
                if (chatPullStartY.current === null || chatRefreshing) return;
                const dy = e.touches[0].clientY - chatPullStartY.current;
                if (dy > 0) {
                  const dist = Math.min(dy * 0.3, 40);
                  updateChatPullDOM(dist);
                  if (dist >= 30 && !chatHapticFired.current) {
                    chatHapticFired.current = true;
                    triggerMediumHaptic();
                  }
                } else {
                  chatPullStartY.current = null;
                  updateChatPullDOM(0);
                }
              },
              onTouchEnd: () => {
                if (chatPullStartY.current === null) return;
                chatPullStartY.current = null;
                if (chatPullDistance.current >= 30) {
                  setChatRefreshing(true);
                  updateChatPullDOM(20);
                  if (chatLottieRef.current) {
                    chatLottieRef.current.loop = true;
                    chatLottieRef.current.goToAndPlay(0);
                  }
                  (async () => {
                    setChatListLoading(true);
                    const list = await getChatList();
                    setChatList(list);
                    setChatListLoading(false);
                    setChatRefreshDone(true);
                    if (chatLottieRef.current) {
                      chatLottieRef.current.loop = false;
                    }
                  })();
                } else {
                  updateChatPullDOM(0);
                }
              },
            } : {})}
          >
            {chatBookSelected && chatGeneralMode ? (
              <BookChat
                book={{
                  id: '00000000-0000-0000-0000-000000000000',
                  user_id: user?.id || '',
                  title: 'My Bookshelf',
                  author: '',
                  ratings: { writing: null, insights: null, flow: null, world: null, characters: null },
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }}
                bookContext={(() => {
                  // Sort books by average rating descending so related books from favorites come first
                  const sortedBooks = [...books].sort((a, b) => {
                    const avgA = [a.ratings.writing, a.ratings.insights, a.ratings.flow, a.ratings.world, a.ratings.characters].filter(r => r != null);
                    const avgB = [b.ratings.writing, b.ratings.insights, b.ratings.flow, b.ratings.world, b.ratings.characters].filter(r => r != null);
                    const scoreA = avgA.length > 0 ? avgA.reduce((s, c) => s + c!, 0) / avgA.length : 0;
                    const scoreB = avgB.length > 0 ? avgB.reduce((s, c) => s + c!, 0) / avgB.length : 0;
                    return scoreB - scoreA;
                  });

                  // Collect related books prioritized by source book rating
                  const allRelated: Array<{ title: string; author: string; reason: string; cover_url?: string; thumbnail?: string }> = [];
                  const seenKeys = new Set<string>();

                  // First: unread books already on shelf (highest priority for recommendations)
                  const unreadBooks = books.filter(b => b.reading_status === 'want_to_read' || !b.reading_status);
                  unreadBooks.forEach(b => {
                    const key = `${b.title.toLowerCase()}::${b.author.toLowerCase()}`;
                    if (!seenKeys.has(key)) {
                      seenKeys.add(key);
                      allRelated.push({ title: b.title, author: b.author, reason: 'Already on your bookshelf (unread)', cover_url: b.cover_url || undefined, thumbnail: undefined });
                    }
                  });

                  // Then: related books from highest-rated books first
                  sortedBooks.forEach(b => {
                    const rel = relatedBooks.get(b.id);
                    if (rel?.length) {
                      const avgRatings = [b.ratings.writing, b.ratings.insights, b.ratings.flow, b.ratings.world, b.ratings.characters].filter(r => r != null);
                      const avgScore = avgRatings.length > 0 ? (avgRatings.reduce((s, c) => s + c!, 0) / avgRatings.length).toFixed(1) : null;
                      rel.forEach(r => {
                        const key = `${r.title.toLowerCase()}::${r.author.toLowerCase()}`;
                        // Skip books already on the shelf (they're either in unread above or already read)
                        const onShelf = books.some(sb => sb.title.toLowerCase() === r.title.toLowerCase() && sb.author.toLowerCase() === r.author.toLowerCase());
                        if (!seenKeys.has(key) && !onShelf) {
                          seenKeys.add(key);
                          allRelated.push({ title: r.title, author: r.author, reason: `${r.reason} (related to "${b.title}"${avgScore ? `, rated ${avgScore}/5` : ''})`, cover_url: r.cover_url, thumbnail: r.thumbnail });
                        }
                      });
                    }
                  });

                  const ctx: BookChatContext = {
                    title: 'My Bookshelf',
                    author: '',
                    readingStatus: null,
                    generalMode: true,
                    summary: `The user's bookshelf contains ${books.length} books. Here is their collection:\n${books.map(b => {
                      const parts = [`- "${b.title}" by ${b.author}`];
                      if (b.reading_status) parts.push(`(${b.reading_status.replace('_', ' ')})`);
                      if (b.genre) parts.push(`[${b.genre}]`);
                      const avgRating = [b.ratings.writing, b.ratings.insights, b.ratings.flow, b.ratings.world, b.ratings.characters].filter(r => r != null);
                      if (avgRating.length > 0) parts.push(`avg rating: ${(avgRating.reduce((a, c) => a + c!, 0) / avgRating.length).toFixed(1)}/5`);
                      if (b.notes) parts.push(`notes: "${b.notes}"`);
                      return parts.join(' ');
                    }).join('\n')}`,
                    relatedBooks: allRelated.slice(0, 50),
                  };
                  return ctx;
                })()}
                onBack={() => {
                  setChatBookSelected(false);
                  setChatGeneralMode(false);
                  setScrollY(0);
                  if (chatOpenedFromBookPage.current) { chatOpenedFromBookPage.current = false; setShowChatPage(false); }
                }}
                onAddBook={async (meta) => {
                  setChatBookSelected(false);
                  setChatGeneralMode(false);
                  setShowChatPage(false);
                  await handleAddBook(meta);
                }}
              />
            ) : chatBookSelected && characterChatContext && activeBook ? (
              <BookChat
                book={activeBook}
                bookContext={{
                  title: characterChatContext.bookTitle,
                  author: characterChatContext.bookAuthor,
                  readingStatus: activeBook.reading_status || null,
                }}
                characterContext={characterChatContext}
                onBack={() => {
                  setChatBookSelected(false);
                  setCharacterChatContext(null);
                  setScrollY(0);
                  if (chatOpenedFromBookPage.current) { chatOpenedFromBookPage.current = false; setShowChatPage(false); }
                }}
              />
            ) : chatBookSelected && orphanedChatBook ? (
              <BookChat
                book={orphanedChatBook}
                bookContext={{
                  title: orphanedChatBook.title,
                  author: orphanedChatBook.author,
                  readingStatus: null,
                }}
                onBack={() => {
                  setChatBookSelected(false);
                  setOrphanedChatBook(null);
                  setScrollY(0);
                  if (chatOpenedFromBookPage.current) { chatOpenedFromBookPage.current = false; setShowChatPage(false); }
                }}
                onAddBook={async (meta) => {
                  setChatBookSelected(false);
                  setOrphanedChatBook(null);
                  setShowChatPage(false);
                  await handleAddBook(meta);
                }}
              />
            ) : chatBookSelected && activeBook ? (
              <BookChat
                book={activeBook}
                bookContext={(() => {
                  const ctx: BookChatContext = {
                    title: activeBook.title,
                    author: activeBook.author,
                    genre: activeBook.genre,
                    publishYear: activeBook.publish_year,
                    summary: activeBook.summary,
                    readingStatus: activeBook.reading_status || null,
                    userNotes: activeBook.notes,
                    userRatings: activeBook.ratings,
                  };
                  const insights: BookChatContext['insights'] = {};
                  const authorFacts = activeBook.author_facts;
                  if (authorFacts?.length) insights.authorFacts = authorFacts;
                  const influences = bookInfluences.get(activeBook.id);
                  if (influences?.length) insights.influences = influences;
                  const domain = bookDomain.get(activeBook.id);
                  if (domain) insights.domain = domain;
                  const context = bookContext.get(activeBook.id);
                  if (context?.length) insights.context = context;
                  const dyk = didYouKnow.get(activeBook.id);
                  if (dyk?.length) insights.didYouKnow = dyk;
                  if (Object.keys(insights).length) ctx.insights = insights;
                  if (combinedPodcastEpisodes?.length) ctx.podcasts = combinedPodcastEpisodes.map(p => ({ title: p.title, podcast_name: p.podcast_name, url: p.url, thumbnail: p.thumbnail, length: p.length, audioUrl: p.audioUrl }));
                  const videos = youtubeVideos.get(activeBook.id);
                  if (videos?.length) ctx.videos = videos.map(v => ({ title: v.title, channelTitle: v.channelTitle, videoId: v.videoId }));
                  const articles = analysisArticles.get(activeBook.id);
                  if (articles?.length) ctx.articles = articles.map(a => ({ title: a.title, url: a.url, snippet: a.snippet, authors: a.authors, year: a.year }));
                  const related = relatedBooks.get(activeBook.id);
                  if (related?.length) ctx.relatedBooks = related.map(b => ({ title: b.title, author: b.author, reason: b.reason, cover_url: b.cover_url, thumbnail: b.thumbnail }));
                  const movies = relatedMovies.get(activeBook.id);
                  if (movies?.length) ctx.relatedWorks = movies.map(m => ({ title: m.title, director: m.director, reason: m.reason, type: m.type, poster_url: m.poster_url, release_year: m.release_year, wikipedia_url: m.wikipedia_url, itunes_url: m.itunes_url, itunes_artwork: m.itunes_artwork, music_links: m.music_links }));
                  if (discussionQuestions?.length) ctx.discussionQuestions = discussionQuestions.map(q => ({ question: q.question, category: q.category }));
                  return ctx;
                })()}
                onBack={() => {
                  setChatBookSelected(false);
                  setScrollY(0);
                  if (chatOpenedFromBookPage.current) { chatOpenedFromBookPage.current = false; setShowChatPage(false); }
                }}
                onAddBook={async (meta) => {
                  setChatBookSelected(false);
                  setShowChatPage(false);
                  await handleAddBook(meta);
                }}
              />
            ) : (
              /* Chat list view */
                <>
                {/* Pull to refresh indicator - always rendered, visibility controlled via ref */}
                <div ref={chatPullIndicatorRef} className="absolute left-0 right-0 flex justify-center z-50" style={{ top: '60px', display: (chatRefreshing || chatRefreshDone || chatRefreshFading) ? '' : 'none' }}>
                  <div
                    ref={chatPullLottieRef}
                    className="w-20 h-20"
                    style={{
                      opacity: chatRefreshFading ? 1 : chatRefreshDone ? 1 : chatRefreshing ? 1 : 0,
                      animation: chatRefreshFading ? 'fadeOut 0.8s ease-out forwards' : undefined,
                    }}
                  >
                    <Lottie
                      lottieRef={chatLottieRef}
                      animationData={refreshAnimation}
                      loop={true}
                      autoplay={false}
                      onLoopComplete={() => {
                        if (chatRefreshDone) {
                          setChatRefreshing(false);
                          setChatRefreshDone(false);
                          setChatRefreshFading(true);
                          setTimeout(() => {
                            setChatRefreshFading(false);
                            updateChatPullDOM(0);
                          }, 800);
                        }
                      }}
                    />
                  </div>
                </div>
                <div ref={chatPullContentRef} className="w-full max-w-[600px] mx-auto px-4 py-4" style={{ marginTop: '30px' }}>
                  {/* Book picker for new chat — hidden for now */}
                  {false && books.length > 0 && (
                    <div
                      className="mb-4 rounded-2xl px-3 py-3"
                      style={{
                        background: 'rgba(255, 255, 255, 0.35)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '0.5px solid rgba(255, 255, 255, 0.4)',
                        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.04)',
                      }}
                    >
                      <p className="text-[11px] font-semibold text-slate-900 uppercase tracking-wider mb-2">START A CHAT ABOUT</p>
                      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                        {/* My Bookshelf — general chat */}
                        <button
                          onClick={() => {
                            setChatGeneralMode(true);
                            setChatBookSelected(true);
                          }}
                          className="shrink-0 flex flex-col items-center gap-1 active:scale-95 transition-transform"
                          style={{ width: '82px' }}
                        >
                          <div className="rounded-xl flex items-center justify-center"
                            style={{ width: '67px', height: '94px', background: 'rgba(255, 0, 123, 0.55)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 0, 123, 0.3)', boxShadow: '0 4px 14px rgba(255, 0, 123, 0.25)' }}
                          >
                            <Library size={34} className="text-white/90" />
                          </div>
                          <p className="text-[10px] font-semibold text-black text-center line-clamp-2 leading-tight w-full">My Bookshelf</p>
                        </button>
                        {[...books].sort((a, b) => {
                          const aReading = a.reading_status === 'reading' ? 0 : 1;
                          const bReading = b.reading_status === 'reading' ? 0 : 1;
                          if (aReading !== bReading) return aReading - bReading;
                          return a.title.localeCompare(b.title);
                        }).map((b) => {
                          const isReading = b.reading_status === 'reading';
                          return (
                            <button
                              key={b.id}
                              onClick={() => {
                                const idx = books.indexOf(b);
                                if (idx >= 0) setSelectedIndex(idx);
                                setChatBookSelected(true);
                              }}
                              className="shrink-0 flex flex-col items-center gap-1 active:scale-95 transition-transform"
                              style={{ width: isReading ? '82px' : '67px' }}
                            >
                              {b.cover_url ? (
                                <img
                                  src={b.cover_url}
                                  alt={b.title}
                                  className={`${isReading ? 'rounded-xl' : 'rounded-lg'} object-cover`}
                                  style={{ width: isReading ? '67px' : '53px', height: isReading ? '94px' : '72px', boxShadow: isReading ? '0 4px 14px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.12)', border: isReading ? '2px solid rgba(59, 130, 246, 0.4)' : 'none' }}
                                />
                              ) : (
                                <div className={`${isReading ? 'rounded-xl' : 'rounded-lg'} bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center`}
                                  style={{ width: isReading ? '67px' : '53px', height: isReading ? '94px' : '72px', border: isReading ? '2px solid rgba(59, 130, 246, 0.4)' : 'none' }}
                                >
                                  <BookOpen size={isReading ? 22 : 18} className="text-white/60" />
                                </div>
                              )}
                              <p className={`${isReading ? 'text-[10px] font-semibold text-slate-800' : 'text-[9px] text-slate-600'} text-center line-clamp-2 leading-tight w-full`}>{b.title}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No divider — chat list flows directly */}

                  {/* Chat list */}
                  {chatListLoading ? (
                    <div className="flex flex-col gap-3">
                      {[1, 2, 3].map(i => (
                        <motion.div
                          key={i}
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
                          className="rounded-xl p-3.5 flex items-center gap-3"
                          style={{
                            background: 'rgba(255, 255, 255, 0.6)',
                            backdropFilter: 'blur(9.4px)',
                            WebkitBackdropFilter: 'blur(9.4px)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                          }}
                        >
                          <div className="w-12 h-12 rounded-full bg-slate-300/50 shrink-0" />
                          <div className="flex-1 flex flex-col gap-2">
                            <div className="w-3/4 h-3.5 bg-slate-300/50 rounded" />
                            <div className="w-full h-3 bg-slate-300/50 rounded" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (() => {
                    const BOOKSHELF_ID = '00000000-0000-0000-0000-000000000000';
                    const existingBookshelfChat = chatList.find(c => c.book_id === BOOKSHELF_ID);
                    const bookshelfEntry: ChatListItem = existingBookshelfChat || {
                      book_id: BOOKSHELF_ID,
                      book_title: 'My Bookshelf',
                      book_author: '',
                      last_message: 'Chat about your books, get recommendations...',
                      last_message_at: new Date().toISOString(),
                      message_count: 0,
                    };

                    // Build unified list: book chats + character chats, all as one type
                    type UnifiedChatItem = {
                      key: string;
                      type: 'book' | 'character';
                      title: string;
                      subtitle: string;
                      last_message: string;
                      last_message_at: string;
                      message_count: number;
                      isReading?: boolean;
                      // Book chat fields
                      book_id?: string;
                      coverUrl?: string;
                      matchingBook?: typeof books[0];
                      isGeneral?: boolean;
                      // Character chat fields
                      character_name?: string;
                      book_title?: string;
                      book_author?: string;
                      avatarUrl?: string;
                    };

                    const unifiedItems: UnifiedChatItem[] = [];

                    // Add bookshelf/general chat
                    unifiedItems.push({
                      key: BOOKSHELF_ID,
                      type: 'book',
                      title: 'Your Bookshelf',
                      subtitle: '',
                      last_message: bookshelfEntry.last_message,
                      last_message_at: bookshelfEntry.last_message_at,
                      message_count: bookshelfEntry.message_count,
                      book_id: BOOKSHELF_ID,
                      isGeneral: true,
                    });

                    // Add book chats (excluding bookshelf)
                    for (const chat of chatList) {
                      if (chat.book_id === BOOKSHELF_ID) continue;
                      const matchingBook = books.find(b => b.id === chat.book_id);
                      unifiedItems.push({
                        key: chat.book_id,
                        type: 'book',
                        title: chat.book_title,
                        subtitle: chat.book_author,
                        last_message: chat.last_message,
                        last_message_at: chat.last_message_at,
                        message_count: chat.message_count,
                        isReading: matchingBook?.reading_status === 'reading',
                        book_id: chat.book_id,
                        coverUrl: matchingBook?.cover_url || chat.cover_url || undefined,
                        matchingBook,
                      });
                    }

                    // Add reading books without chats as placeholders
                    const existingBookIds = new Set(chatList.map(c => c.book_id));
                    for (const b of books.filter(bk => bk.reading_status === 'reading')) {
                      if (existingBookIds.has(b.id) || dismissedChatIds.has(b.id)) continue;
                      unifiedItems.push({
                        key: b.id,
                        type: 'book',
                        title: b.title,
                        subtitle: b.author || '',
                        last_message: 'Tap to start chatting',
                        last_message_at: new Date().toISOString(),
                        message_count: 0,
                        isReading: true,
                        book_id: b.id,
                        coverUrl: b.cover_url || undefined,
                        matchingBook: b,
                      });
                    }

                    // Add character chats
                    for (const chat of characterChatList) {
                      const matchingBook = books.find(b => b.title.toLowerCase().trim() === chat.book_title.toLowerCase().trim());
                      const avatars = matchingBook ? characterAvatars.get(matchingBook.id) || [] : [];
                      const avatarUrl = avatars.find(a => a.character === chat.character_name)?.image_url || chat.avatar_url;
                      unifiedItems.push({
                        key: `char_${chat.character_name}_${chat.book_title}`,
                        type: 'character',
                        title: chat.character_name,
                        subtitle: chat.book_title,
                        last_message: chat.last_message,
                        last_message_at: chat.last_message_at,
                        message_count: chat.message_count,
                        isReading: matchingBook?.reading_status === 'reading',
                        character_name: chat.character_name,
                        book_title: chat.book_title,
                        book_author: chat.book_author,
                        avatarUrl,
                        coverUrl: matchingBook?.cover_url || undefined,
                        matchingBook,
                      });
                    }

                    // Sort: items with messages sorted by last_message_at desc, then placeholders at bottom
                    const withMessages = unifiedItems.filter(c => c.message_count > 0).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
                    const placeholders = unifiedItems.filter(c => c.message_count === 0);
                    const sortedItems = [...withMessages, ...placeholders];

                    const handleDeleteChat = async (bookId: string) => {
                      setDeletingChatKey(bookId);
                      setChatSwipeId(null);
                      // Wait for exit animation then remove from state
                      setTimeout(() => {
                        setChatList(prev => prev.filter(c => c.book_id !== bookId));
                        setDismissedChatIds(prev => {
                          const next = new Set(prev);
                          next.add(bookId);
                          localStorage.setItem('dismissedChatIds', JSON.stringify([...next]));
                          return next;
                        });
                        setDeletingChatKey(null);
                      }, 300);
                      await deleteChatForBook(bookId);
                    };

                    const swipeHandlers = (key: string) => ({
                      onTouchStart: (e: React.TouchEvent) => {
                        chatSwipeRef.current = { startX: e.touches[0].clientX, currentX: e.touches[0].clientX, bookId: key };
                        if (chatSwipeId && chatSwipeId !== key) setChatSwipeId(null);
                      },
                      onTouchMove: (e: React.TouchEvent) => {
                        if (!chatSwipeRef.current || chatSwipeRef.current.bookId !== key) return;
                        chatSwipeRef.current.currentX = e.touches[0].clientX;
                      },
                      onTouchEnd: () => {
                        if (!chatSwipeRef.current || chatSwipeRef.current.bookId !== key) return;
                        const dx = chatSwipeRef.current.startX - chatSwipeRef.current.currentX;
                        if (dx > 60) setChatSwipeId(key);
                        else if (dx < -30) setChatSwipeId(null);
                        chatSwipeRef.current = null;
                      },
                    });

                    const activeItems = sortedItems.filter(c => c.message_count > 0);
                    const placeholderItems = sortedItems.filter(c => c.message_count === 0);

                    return (
                      <>
                        {/* All chats — single sorted list */}
                        {activeItems.length > 0 && (
                          <div
                            className="rounded-2xl overflow-hidden mb-3"
                            style={{
                              background: 'rgba(255, 255, 255, 0.5)',
                              backdropFilter: 'blur(12px)',
                              WebkitBackdropFilter: 'blur(12px)',
                              border: '0.5px solid rgba(255, 255, 255, 0.3)',
                              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                            }}
                          >
                            {activeItems.map((item, i) => {
                              const isSwiped = chatSwipeId === item.key;
                              const showDivider = i < activeItems.length - 1;
                              const isDeleting = deletingChatKey === item.key;
                              return (
                                <motion.div
                                  key={item.key}
                                  className="relative"
                                  animate={{ opacity: isDeleting ? 0 : 1, height: isDeleting ? 0 : 'auto', marginBottom: isDeleting ? 0 : undefined }}
                                  transition={{ duration: 0.3, ease: 'easeOut' }}
                                  style={{ overflow: isDeleting ? 'hidden' : undefined }}
                                  {...swipeHandlers(item.key)}
                                >
                                  {/* Delete button behind */}
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-red-500/10 rounded-r-xl"
                                    style={{ opacity: isSwiped ? 1 : 0, pointerEvents: isSwiped ? 'auto' : 'none', transition: 'opacity 0.2s ease-out' }}
                                  >
                                    <button
                                      onClick={async () => {
                                        if (item.type === 'character') {
                                          setDeletingChatKey(item.key);
                                          setChatSwipeId(null);
                                          setTimeout(() => {
                                            setCharacterChatList(prev => prev.filter(c => !(c.character_name === item.character_name && c.book_title === item.book_title)));
                                            setDeletingChatKey(null);
                                          }, 300);
                                          await deleteCharacterChat(item.character_name!, item.book_title!);
                                        } else {
                                          handleDeleteChat(item.book_id!);
                                        }
                                      }}
                                      className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
                                    >
                                      <Trash2 size={18} className="text-red-500" />
                                      <span className="text-[10px] font-semibold text-red-500">Delete</span>
                                    </button>
                                  </div>
                                  {/* Chat row */}
                                  <button
                                    onClick={async () => {
                                      if (isSwiped) { setChatSwipeId(null); return; }
                                      if (item.type === 'character') {
                                        if (!item.matchingBook) return;
                                        const idx = books.indexOf(item.matchingBook);
                                        if (idx >= 0) setSelectedIndex(idx);
                                        setLoadingCharacterChat(item.character_name!);
                                        try {
                                          const context = await getCharacterContext(item.character_name!, item.book_title!, item.book_author!);
                                          if (context) {
                                            setCharacterChatContext({
                                              characterName: item.character_name!,
                                              bookTitle: item.book_title!,
                                              bookAuthor: item.book_author!,
                                              context,
                                              avatarUrl: item.avatarUrl,
                                            });
                                            setChatBookSelected(true);
                                          }
                                        } catch (err) {
                                          console.error('[ChatList] Error loading character context:', err);
                                        } finally {
                                          setLoadingCharacterChat(false);
                                        }
                                      } else {
                                        if (item.isGeneral) {
                                          setChatGeneralMode(true);
                                        } else if (item.matchingBook) {
                                          const idx = books.indexOf(item.matchingBook);
                                          if (idx >= 0) setSelectedIndex(idx);
                                        } else if (item.book_id) {
                                          // Orphaned chat — book was deleted, construct lightweight book object
                                          setOrphanedChatBook({
                                            id: item.book_id,
                                            title: item.title,
                                            author: item.subtitle || '',
                                            cover_url: item.coverUrl || null,
                                          });
                                        }
                                        if (dismissedChatIds.has(item.book_id!)) {
                                          setDismissedChatIds(prev => {
                                            const next = new Set(prev);
                                            next.delete(item.book_id!);
                                            localStorage.setItem('dismissedChatIds', JSON.stringify([...next]));
                                            return next;
                                          });
                                        }
                                        // Clear unread badge for this chat
                                        if (item.book_id && unreadChatCounts.has(item.book_id)) {
                                          setUnreadChatCounts(prev => { const next = new Map(prev); next.delete(item.book_id!); return next; });
                                        }
                                        setChatBookSelected(true);
                                      }
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-3 text-left active:opacity-80 relative z-10"
                                    style={{
                                      transform: isSwiped ? 'translateX(-80px)' : 'translateX(0)',
                                      transition: 'transform 0.25s ease-out',
                                    }}
                                  >
                                    {/* Thumbnail */}
                                    {item.isGeneral ? (
                                      <div className="relative w-12 h-12 shrink-0">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center absolute top-1 left-0"
                                          style={{ background: 'rgba(255, 0, 123, 0.55)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 0, 123, 0.3)' }}
                                        >
                                          <Library size={18} className="text-white/90" />
                                        </div>
                                        <div className="w-9 h-9 rounded-full overflow-hidden absolute bottom-0 right-0 bg-slate-200" style={{ border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                                          <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-full h-full object-cover" />
                                        </div>
                                      </div>
                                    ) : item.type === 'character' ? (
                                      /* Character: book cover behind, character avatar on top offset right */
                                      <div className="relative w-12 h-12 shrink-0">
                                        {item.coverUrl ? (
                                          <div className="w-10 h-10 rounded-full overflow-hidden absolute top-1 left-0 bg-slate-200">
                                            <img src={item.coverUrl} alt="" className="w-full h-full object-cover" />
                                          </div>
                                        ) : (
                                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center absolute top-1 left-0">
                                            <BookOpen size={14} className="text-white/60" />
                                          </div>
                                        )}
                                        {item.avatarUrl ? (
                                          <div className="w-9 h-9 rounded-full overflow-hidden absolute bottom-0 right-0 bg-slate-200" style={{ border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                                            <img src={item.avatarUrl} alt={item.character_name} className="w-full h-full object-cover" />
                                          </div>
                                        ) : (
                                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center absolute bottom-0 right-0" style={{ border: '2px solid white' }}>
                                            <MessageCircle size={12} className="text-white/80" />
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      /* Book chat: book cover behind, bookluver avatar on top offset right */
                                      <div className="relative w-12 h-12 shrink-0">
                                        {item.coverUrl ? (
                                          <div className="w-10 h-10 rounded-full overflow-hidden absolute top-1 left-0 bg-slate-200">
                                            <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
                                          </div>
                                        ) : (
                                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center absolute top-1 left-0">
                                            <BookOpen size={14} className="text-white/60" />
                                          </div>
                                        )}
                                        <div className="w-9 h-9 rounded-full overflow-hidden absolute bottom-0 right-0 bg-slate-200" style={{ border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                                          <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-full h-full object-cover" />
                                        </div>
                                      </div>
                                    )}
                                    {/* Text content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <p className={`text-[15px] font-semibold truncate ${item.book_id && unreadChatCounts.has(item.book_id) ? 'text-slate-900' : 'text-slate-800'}`}>{item.title}</p>
                                          {item.isReading && (
                                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0 leading-none">Reading</span>
                                          )}
                                        </div>
                                        <span className={`text-[11px] shrink-0 ${item.book_id && unreadChatCounts.has(item.book_id) ? 'text-blue-500 font-semibold' : 'text-slate-400'}`}>{timeAgo(item.last_message_at)}</span>
                                      </div>
                                      <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <p className={`text-[13px] truncate ${item.book_id && unreadChatCounts.has(item.book_id) ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>{item.last_message}</p>
                                        {item.book_id && unreadChatCounts.has(item.book_id) && (
                                          <div className="min-w-[20px] h-[20px] rounded-full bg-blue-500 flex items-center justify-center px-1.5 shrink-0">
                                            <span className="text-[11px] font-bold text-white leading-none">{unreadChatCounts.get(item.book_id)}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                  {showDivider && !isDeleting && (
                                    <div className="ml-[72px] mr-3 h-px bg-slate-200/60" />
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        )}

                        {/* Placeholder chats — books you're reading but haven't chatted about */}
                        {placeholderItems.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {placeholderItems.map((item) => {
                              const coverUrl = item.coverUrl;
                              return (
                                <div
                                  key={item.key}
                                  className="relative rounded-2xl"
                                  style={{ border: '1px solid rgba(0, 0, 0, 0.08)' }}
                                >
                                  <button
                                    onClick={() => {
                                      if (item.isGeneral) {
                                        setChatGeneralMode(true);
                                      } else if (item.matchingBook) {
                                        const idx = books.indexOf(item.matchingBook);
                                        if (idx >= 0) setSelectedIndex(idx);
                                      }
                                      setChatBookSelected(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-3 text-left active:opacity-80"
                                  >
                                    {item.isGeneral ? (
                                      <div className="relative w-12 h-12 shrink-0">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center absolute top-1 left-0"
                                          style={{ background: 'rgba(255, 0, 123, 0.55)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 0, 123, 0.3)' }}
                                        >
                                          <Library size={18} className="text-white/90" />
                                        </div>
                                        <div className="w-9 h-9 rounded-full overflow-hidden absolute bottom-0 right-0 bg-slate-200" style={{ border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                                          <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-full h-full object-cover" />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="relative w-12 h-12 shrink-0">
                                        {coverUrl ? (
                                          <div className="w-10 h-10 rounded-full overflow-hidden absolute top-1 left-0 bg-slate-200">
                                            <img src={coverUrl} alt={item.title} className="w-full h-full object-cover" />
                                          </div>
                                        ) : (
                                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center absolute top-1 left-0">
                                            <BookOpen size={14} className="text-white/60" />
                                          </div>
                                        )}
                                        <div className="w-9 h-9 rounded-full overflow-hidden absolute bottom-0 right-0 bg-slate-200" style={{ border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                                          <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-full h-full object-cover" />
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <MessageSquareHeart size={14} className="text-slate-400 shrink-0" />
                                        <p className="text-[13px] text-slate-500">Start a chat about</p>
                                      </div>
                                      <p className="text-[15px] font-semibold text-slate-800 truncate">
                                        {item.isGeneral ? 'Your books, recommendations, anything at all' : item.title}
                                      </p>
                                    </div>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Feedback placeholder */}
                        <div
                          className="relative rounded-2xl mt-2"
                          style={{ border: '1px solid rgba(0, 0, 0, 0.08)' }}
                        >
                          <button
                            onClick={() => {
                              const subject = encodeURIComponent('BOOK App Feedback');
                              window.location.href = `mailto:book.luv@burning-bush.com?subject=${subject}`;
                            }}
                            className="w-full flex items-center gap-3 px-3 py-3 text-left active:opacity-80"
                          >
                            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(59, 130, 246, 0.3)', border: '1px solid rgba(59, 130, 246, 0.4)' }}
                            >
                              <Heart size={20} className="text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-bold text-slate-700">Give us feedback</p>
                              <p className="text-[13px] text-slate-600">We'd love to hear from you</p>
                            </div>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
                </>
            )}
          </motion.main>
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
                      // Navigate to feed and ensure post is visible
                      setFeedTypeFilter('all');
                      setFeedFilter('all');
                      setFeedDisplayCount(8);
                      setShowCreatePost(false);
                      setShowFeedPage(true);
                      setShowBookshelf(false);
                      setShowBookshelfCovers(false);
                      setShowNotesView(false);
                      setShowAccountPage(false);
                      setShowSortingResults(false);
                      setShowChatPage(false);
                      setChatBookSelected(false);
                      setScrollY(0);
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
              setScrollY(target.scrollTop);
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
              setScrollY(target.scrollTop);
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
                      <Pencil size={32} className="mx-auto mb-3 text-slate-400" />
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
                          setShowBookshelf(false);
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
                    <div className="flex gap-4">
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
                      
                      {/* Book Info and Notes */}
                      <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50 mb-1 line-clamp-1">{book.title}</h2>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs text-slate-600 dark:text-slate-400">{book.author}</p>
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-200/50 dark:bg-slate-700/50 rounded-full px-1.5 py-0.5">
                            {(book.notes || '').split(/\{\d{4}-\d{2}-\d{2} \d{2}:\d{2}\}/).filter(p => p.trim()).length}
                          </span>
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
                          <div>
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
              setScrollY(target.scrollTop);
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
                          onClick={() => { analytics.trackEvent('nav', 'tap', { destination: 'notes' }); setShowNotesView(true); }}
                          className="text-center hover:opacity-70 active:scale-95 transition-all"
                        >
                          <p className="text-2xl font-bold text-slate-950 dark:text-slate-50">{books.filter(b => b.notes && b.notes.trim()).length}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Notes</p>
                        </button>
                        <button
                          onClick={() => { analytics.trackEvent('nav', 'tap', { destination: 'following' }); setShowFollowingPage(true); }}
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
                      onClick={() => { setShowAboutScreen(true); }}
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
                            // Check if there are "Want to read" books
                            const wantToReadBooks = books.filter(b => b.reading_status === 'want_to_read');
                            if (wantToReadBooks.length > 0) {
                              setShowReadingBookPicker(true);
                            } else {
                              // No want to read books, open search
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
                                // In select mode: toggle selection
                                triggerLightHaptic();
                                setSelectedBookIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(book.id)) {
                                    next.delete(book.id);
                                  } else {
                                    next.add(book.id);
                                  }
                                  // Exit select mode if nothing selected
                                  if (next.size === 0) {
                                    setIsSelectMode(false);
                                  }
                                  return next;
                                });
                                return;
                              }
                              if (viewingUserId) {
                                // When viewing another user's bookshelf, show quick view
                                setViewingBookFromOtherUser(book);
                              } else if (bookIndex !== -1) {
                                setScrollY(0);
                                setSelectedIndex(bookIndex);
                                setShowBookshelfCovers(false);
                                setTimeout(() => {
                                  const main = document.querySelector('main');
                                  if (main) {
                                    main.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }, 100);
                              }
                            }}
                            onTouchStart={(e) => {
                              if (viewingUserId) return;
                              if (isSelectMode) return; // Tap handles it in select mode
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
                              // Store start position for move detection
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
        ) : showBookshelf ? (
          <motion.main
            key="bookshelf"
            ref={(el) => { scrollContainerRef.current = el; }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem + var(--safe-area-bottom, 0px))' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
          >
            {/* Bookshelf View */}
            <div 
              className="w-full flex flex-col items-center px-4"
            >
              {booksForBookshelf.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-20">
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
              <div className="w-full max-w-[1600px] flex flex-col gap-2.5 py-8">
                {/* Grouping Selector - Dropdown */}
                <div className="flex items-center justify-start px-4 mb-1.5">
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
                </div>

                {/* Summary Section */}
                <div className="flex items-center justify-center gap-4 px-4 mb-2.5">
                  {(() => {
                    // Calculate KPIs
                    const totalBooks = books.length;
                    const booksWithRatings = books.filter(book => {
                      const values = Object.values(book.ratings).filter(v => v != null) as number[];
                      return values.length > 0;
                    });
                    const totalUnrated = totalBooks - booksWithRatings.length;
                    
                    // Calculate average score across all books
                    let avgScore = 0;
                    if (booksWithRatings.length > 0) {
                      const totalScore = booksWithRatings.reduce((sum, book) => {
                        return sum + calculateScore(book.ratings);
                      }, 0);
                      avgScore = totalScore / booksWithRatings.length;
                    }

                    return (
                      <>
                        {/* Total Books KPI */}
                        <div className="rounded-xl p-4 flex flex-col items-center min-w-[100px]" style={glassmorphicStyle}>
                          <span className="text-lg font-bold text-slate-950 dark:text-slate-50 mb-1">
                            {totalBooks}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Total</span>
                        </div>

                        {/* Average Score KPI */}
                        <div className="rounded-xl p-4 flex flex-col items-center min-w-[100px]" style={glassmorphicStyle}>
                          <div className="flex items-center gap-1 mb-1">
                            <Heart size={16} className="fill-pink-500 text-pink-500" />
                            <span className="text-lg font-bold text-slate-950 dark:text-slate-50">
                              {avgScore > 0 ? avgScore.toFixed(1) : '—'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Avg Score</span>
                        </div>

                        {/* Total Unrated KPI */}
                        <div className="rounded-xl p-4 flex flex-col items-center min-w-[100px]" style={glassmorphicStyle}>
                          <span className="text-lg font-bold text-slate-950 dark:text-slate-50 mb-1">
                            {totalUnrated}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Unrated</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                {groupedBooksForBookshelf.map((group, groupIdx) => (
                  <div
                    key={group.label || `group-${groupIdx}`}
                    className="flex flex-col gap-4 rounded-2xl overflow-hidden"
                    style={{
                      ...glassmorphicStyle,
                      padding: '2rem 0',
                    }}
                  >
                    {/* Shelf Label */}
                    <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50 px-[10vw] flex items-center gap-2">
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
                    
                    {/* Shelf Container */}
                    <div 
                      className="bookshelf-scroll scrollbar-hide flex items-end justify-start overflow-x-auto overflow-y-hidden px-[10vw] ios-horizontal-scroll"
                      style={{
                        scrollSnapType: 'x proximity',
                        cursor: 'grab',
                      } as React.CSSProperties}
                      onMouseDown={(e) => {
                        const shelf = e.currentTarget;
                        const startX = e.pageX - shelf.offsetLeft;
                        const scrollLeft = shelf.scrollLeft;
                        let isDown = true;

                        const handleMouseMove = (e: MouseEvent) => {
                          if (!isDown) return;
                          e.preventDefault();
                          const x = e.pageX - shelf.offsetLeft;
                          const walk = (x - startX) * 2;
                          shelf.scrollLeft = scrollLeft - walk;
                        };

                        const handleMouseUp = () => {
                          isDown = false;
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      <div className="flex items-end gap-1 min-h-[400px]">
                        {group.books.map((book, idx) => {
                      const score = calculateScore(book.ratings);
                      const avgScore = calculateAvg(book.ratings);
                      
                      // Generate consistent colors and fonts based on book ID
                      const hash = (book.id || `${idx}`).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                      const colorSets = [
                        { main: "#5199fc", accent: "#afd7fb" },
                        { main: "#ff9868", accent: "#d06061" },
                        { main: "#ff5068", accent: "#d93368" },
                        { main: "#A1D821", accent: "#7ca81a" },
                        { main: "#FCCF47", accent: "#d4af3b" },
                        { main: "#5856d6", accent: "#4543a8" },
                        { main: "#1c1c1e", accent: "#48484a" }
                      ];
                      const fonts = ["'Bebas Neue'", "'Oswald'", "'Antonio'", "'Archivo Narrow'"];
                      const styleSet = colorSets[hash % colorSets.length];
                      const bookFont = fonts[hash % fonts.length];
                      
                      // Calculate text color for THIS specific book's color: 50% darker or brighter based on background luminance
                      const bookColorHex = styleSet.main; // This book's specific color
                      const r = parseInt(bookColorHex.slice(1, 3), 16);
                      const g = parseInt(bookColorHex.slice(3, 5), 16);
                      const b = parseInt(bookColorHex.slice(5, 7), 16);
                      
                      // Calculate relative luminance (0-1) for this book's color
                      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                      
                      // If this book's background is light (luminance > 0.5), make text 50% darker
                      // If this book's background is dark (luminance <= 0.5), make text 50% brighter
                      const factor = luminance > 0.5 ? -0.5 : 0.5;
                      
                      const textR = Math.max(0, Math.min(255, Math.round(r * (1 + factor))));
                      const textG = Math.max(0, Math.min(255, Math.round(g * (1 + factor))));
                      const textB = Math.max(0, Math.min(255, Math.round(b * (1 + factor))));
                      
                      const textColor = `rgb(${textR}, ${textG}, ${textB})`;
                      
                      // Height based on score (224-336px range, 20% smaller)
                      const height = score > 0 ? (280 + (score * 28)) * 0.8 : 280 * 0.8;
                      // Width varies (44-68px, 20% smaller)
                      const width = (55 + (hash % 30)) * 0.8;
                      
                      // Font sizing logic - Maximal sizing for vertical text
                      const availableHeight = height - 80; // 40px buffer for decoration and margin
                      const availableWidth = width - 10; // 5px padding on each side
                      let fontSize = availableWidth;
                      
                      // If showing author, account for both title and author height
                      if (bookshelfGrouping === 'author' && book.author) {
                        const titleHeight = book.title.length * (fontSize * 0.55);
                        const authorHeight = book.author.length * (fontSize * 0.5 * 0.55); // 50% size
                        const gap = fontSize * 0.1; // Small gap between title and author
                        const totalHeight = titleHeight + authorHeight + gap;
                        
                        if (totalHeight > availableHeight) {
                          // Scale down to fit both
                          fontSize = (availableHeight / (book.title.length * 0.55 + book.author.length * 0.5 * 0.55 + 0.1));
                        }
                      } else {
                        // Only title, use original logic
                        const estimatedTextLength = book.title.length * (fontSize * 0.55);
                        if (estimatedTextLength > availableHeight) {
                          fontSize = (availableHeight / book.title.length) / 0.55;
                        }
                      }
                      
                      fontSize = Math.max(fontSize, 20);
                      
                      // Find book index in original array for navigation
                      const bookIndex = books.findIndex(b => b.id === book.id);
                      
                      return (
                        <motion.div
                          key={book.id || `book-${groupIdx}-${idx}`}
                          initial={{ opacity: 0, y: 200 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: (groupIdx * 0.1) + (idx * 0.05),
                            duration: 0.6,
                            type: "spring",
                            stiffness: 100,
                            damping: 15
                          }}
                          className="flex flex-col items-center"
                        >
                          {/* Rating - Above the book */}
                          {avgScore && (
                            <div className="flex items-center gap-1 mb-3">
                              <Heart size={14} className="fill-pink-500 text-pink-500" />
                              <span className="font-black text-sm text-slate-950 dark:text-slate-50">
                                {avgScore}
                              </span>
                            </div>
                          )}
                          
                          {/* Book Spine */}
                          <div
                            className="book-spine relative flex-shrink-0 cursor-pointer group"
                            style={{
                              height: `${height}px`,
                              width: `${width}px`,
                              backgroundColor: styleSet.main,
                              color: textColor,
                            } as React.CSSProperties}
                            onClick={() => {
                              if (viewingUserId) {
                                // When viewing another user's bookshelf, show quick view
                                setViewingBookFromOtherUser(book);
                              } else if (bookIndex !== -1) {
                                setScrollY(0); // Reset scroll when switching views
                                setSelectedIndex(bookIndex);
                                setShowBookshelf(false);
                                setTimeout(() => {
                                  const main = document.querySelector('main');
                                  if (main) {
                                    main.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }, 100);
                              }
                            }}
                          >
                            {/* Tooltip */}
                            {avgScore && (
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50"
                                style={{
                                  top: '-65px',
                                  background: '#1d1d1f',
                                  color: '#fff',
                                  padding: '8px 14px',
                                  borderRadius: '10px',
                                  fontSize: '0.8rem',
                                  fontWeight: '700',
                                  boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                                }}
                              >
                                <span className="text-pink-500 mr-1">
                                  {'♥'.repeat(Math.floor(parseFloat(avgScore)))}
                                  {'♡'.repeat(5 - Math.floor(parseFloat(avgScore)))}
                                </span>
                                {avgScore}
                              </div>
                            )}
                            
                            {/* Decoration Stripes */}
                            <div
                              className="absolute top-[15px] left-1/2 -translate-x-1/2 flex flex-col gap-1 opacity-30 z-10"
                              style={{ width: '60%', color: styleSet.accent }}
                            >
                              <div className="h-[3px] w-full rounded-sm" style={{ background: 'currentColor' }} />
                              <div className="h-[3px] w-full rounded-sm" style={{ background: 'currentColor' }} />
                            </div>
                            
                            {/* Spine Content */}
                            <div
                              className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none z-0"
                              style={{
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                transform: 'rotate(180deg)',
                                fontFamily: bookFont,
                              }}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <div
                                  className="text-center leading-[0.85] whitespace-nowrap"
                                  style={{
                                    fontSize: `${fontSize}px`,
                                  }}
                                >
                                  {bookshelfGrouping === 'author' 
                                    ? (book.author || 'Unknown Author').toUpperCase()
                                    : book.title.toUpperCase()}
                                </div>
                              </div>
                            </div>
                            
                            {/* Bottom Shadow */}
                            <div
                              className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none z-0"
                              style={{
                                background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.15), transparent)',
                                filter: 'blur(10px)',
                                transform: 'translateY(50%)',
                              }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </motion.main>
        ) : (
          <motion.main
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            ref={(el) => {
              scrollContainerRef.current = el;
              if (el) {
                // Enable rubber band bounce effect
                el.style.overscrollBehaviorY = 'auto';
                (el.style as any).webkitOverflowScrolling = 'touch';
                // Reset scroll position when entering book details
                el.scrollTop = 0;
                setScrollY(0);
              }
            }}
            className={`flex-1 flex flex-col items-center justify-start p-4 relative pt-28 pb-20 ios-scroll min-h-0 ${showBookPageOnboarding ? 'overflow-hidden' : 'overflow-y-auto'}`}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
            onTouchStart={(e) => {
              // Track touch start for book navigation swipe
              const touch = e.touches[0];
              setBookTouchStart({ x: touch.clientX, y: touch.clientY });
            }}
            onTouchMove={(e) => {
              // Allow native bounce on touch devices
              const target = e.currentTarget;
              const { scrollTop, scrollHeight, clientHeight } = target;
              const isAtTop = scrollTop === 0;
              const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
              
              // Track touch end for swipe detection (only at top/bottom to avoid scroll interference)
              if ((isAtTop || isAtBottom) && bookTouchStart) {
                const touch = e.touches[0];
                setBookTouchEnd({ x: touch.clientX, y: touch.clientY });
              }
              
              // Let native bounce behavior work
              if (isAtTop || isAtBottom) {
                // Native iOS bounce will handle this
                return;
              }
            }}
            onTouchEnd={() => {
              if (bookTouchStart && bookTouchEnd) {
                handleBookSwipe();
              }
            }}
          >
          {/* Back button and book info header */}
          <motion.div
            className="fixed top-[62px] left-4 right-4 z-50 flex items-center gap-3"
            animate={{
              opacity: scrollY > 20 ? Math.max(0, 1 - (scrollY - 20) / 40) : 1,
              pointerEvents: scrollY > 60 ? 'none' : 'auto'
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <button
              onClick={() => {
                setScrollY(0); // Reset scroll when switching views
                setShowBookshelfCovers(true);
                setShowBookshelf(false);
                setShowNotesView(false);
                setShowAccountPage(false);
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

              {/* Notes editor is now a separate modal overlay — see Notes Editor Overlay below */}

              <AnimatePresence>
                {isConfirmingDelete && !isShowingNotes && (
                  <>
                    {/* Backdrop to close on click outside */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-[59]"
                      onClick={() => setIsConfirmingDelete(false)}
                    />
                    {/* Tooltip menu */}
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
                      // Reading Status Selection
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
                                // Proceed to rating dimensions (both for new books and existing books changing to "read_it")
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
                      // Rating Dimensions
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
              {(showRatingOverlay || selectingReadingStatusForExisting) && (
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

              {/* Share Dialog - appears after high rating (4 or 5 stars) */}
              <AnimatePresence>
                {showShareDialog && activeBook && (
                  <>
                    {/* Click outside to close - high z-index to capture all clicks */}
                    <div
                      className="fixed inset-0 z-[100]"
                      onClick={() => setShowShareDialog(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="absolute left-4 right-4 z-[101] flex flex-col items-center justify-center p-4 rounded-2xl overflow-hidden"
                      style={{ ...standardGlassmorphicStyle, bottom: 'calc(64px + var(--safe-area-bottom, 0px))' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-950 dark:text-slate-50">
                          A {activeBook.ratings.writing === 5 ? 'GREAAAAAT' : activeBook.ratings.writing === 4.5 ? 'GREAT' : 'GOOD'} BOOK LIKE THIS...
                        </h3>
                        <p className="text-xs text-slate-950 dark:text-slate-50">someone you know needs to read it</p>
                        <div className="flex gap-3 mt-2">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const bookUrl = activeBook.google_books_url || '';
                              const shareText = `I just rated "${activeBook.title}" by ${activeBook.author} - ${RATING_FEEDBACK[activeBook.ratings.writing || 4]}${bookUrl ? `\n${bookUrl}` : ''}\n\nDownload Book.luv: https://yossisadoun.github.io/book_review/`;
                              try {
                                // Use Capacitor Share for native mobile sharing
                                await CapacitorShare.share({
                                  title: activeBook.title,
                                  text: shareText,
                                  dialogTitle: 'Share this book',
                                });
                              } catch (err: any) {
                                // Don't fallback if user just cancelled the share dialog
                                if (err?.message?.includes('cancel') || err?.message?.includes('dismiss')) {
                                  console.log('Share cancelled by user');
                                } else {
                                  // Fallback to clipboard for non-native platforms
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
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-95 transition-all"
                          >
                            <Share size={16} />
                            Share
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowShareDialog(false);
                            }}
                            className="px-4 py-2 rounded-xl text-slate-950 dark:text-slate-50 text-sm font-medium hover:bg-white/30 dark:bg-white/12 active:scale-95 transition-all"
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
                      onClick={() => setShowBookMenu(!showBookMenu)}
                      className="p-2.5 rounded-full shadow-lg text-black active:scale-90 transition-all"
                      style={{ ...coverButtonGlassmorphicStyle, borderRadius: '50%' }}
                    >
                      <MoreVertical size={20} />
                    </button>

                    {/* Drop-up menu */}
                    <AnimatePresence>
                      {showBookMenu && (
                        <>
                          {/* Backdrop to close menu */}
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
                              <StickyNote size={18} />
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

              {/* Bottom left button row: Rate | Read Status | Notes */}
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
                        setIsEditing(true);
                        setEditingDimension(null); // Will default to first unrated or first dimension
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
                        // Open reading status selection interface
                        setSelectingReadingStatusForExisting(true);
                        setIsEditing(true);
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

              {books.length > 1 && !isShowingNotes && (
                <>
                  <button onClick={() => { triggerMediumHaptic(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : books.length - 1)); }} className="absolute left-0 top-1/2 -translate-y-1/2 p-4 text-white drop-shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft size={36} /></button>
                  <button onClick={() => { triggerMediumHaptic(); setSelectedIndex(prev => (prev < books.length - 1 ? prev + 1 : 0)); }} className="absolute right-0 top-1/2 -translate-y-1/2 p-4 text-white drop-shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight size={36} /></button>
                </>
              )}
            </div>

            {/* Chat Panel — row of 5 avatars below cover */}
            {!showRatingOverlay && activeBook && (() => {
              const avatars = characterAvatars.get(activeBook.id) || [];
              const isLoadingAvatars = loadingAvatarsForBookId === activeBook.id;
              const hasTelegramTopic = !!(activeBook.canonical_book_id && telegramTopics.has(activeBook.canonical_book_id));

              return (
                <div className="w-full mt-3 px-2">
                  <p className="text-[12px] uppercase tracking-[0.15em] font-bold text-slate-500 mb-2.5 text-center">Chat about it with</p>
                  <div className="flex items-center justify-center gap-2.5">
                    {/* 1. General book chatbot */}
                    <button
                      onClick={() => {
                        chatOpenedFromBookPage.current = true;
                        setChatBookSelected(true);
                        setShowChatPage(true);
                        setCharacterChatContext(null);
                      }}
                      className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden" style={{ border: '2px solid rgba(255, 255, 255, 0.5)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                        <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 max-w-[64px] truncate">Book.luver</span>
                    </button>

                    {/* 2-4. Character avatars (or loading skeletons) */}
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
                      avatars.slice(0, 3).map((avatar, i) => {
                        const isThisLoading = loadingCharacterChat === avatar.character;
                        return (
                        <motion.button
                          key={avatar.character}
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
                                setChatBookSelected(true);
                                setShowChatPage(true);
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
                      })
                    ) : null}

                    {/* 5. Readers count with overlapping avatars */}
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
                  </div>
                </div>
              );
            })()}

            {/* Info + Book Summary — unified card stack below cover */}
            {!showRatingOverlay && (() => {
              const summary = bookSummaries.get(activeBook.id);
              const isLoadingSummary = loadingSummaryForBookId === activeBook.id && !summary;

              const infoCardContent = (
                <>
                  {/* Title */}
                  <h2 className="text-sm font-black text-slate-950 dark:text-slate-50 leading-tight line-clamp-2 mb-2">{activeBook.title}</h2>
                  {/* Summary/Synopsis */}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSummaryExpanded(!isSummaryExpanded);
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium mt-1"
                        >
                          {isSummaryExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  )}
                  {/* Author */}
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">{activeBook.author}</p>
                  {/* Labels */}
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
                  {/* Divider between info and readers */}
                  {!isReviewer && <div className="border-t border-white/20 dark:border-white/10 my-2" />}
                  {/* Readers section */}
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
                                activeBook.title,
                                activeBook.author,
                                activeBook.canonical_book_id,
                                activeBook.cover_url || undefined,
                                activeBook.genre || undefined
                              );

                              if (topic) {
                                setTelegramTopics(prev => new Map(prev).set(activeBook.canonical_book_id!, topic));
                                if (newWindow) {
                                  newWindow.location.href = topic.inviteLink;
                                } else {
                                  window.open(topic.inviteLink, '_blank');
                                }
                              } else {
                                newWindow?.close();
                              }
                            } catch (err) {
                              console.error('Error opening Telegram topic:', err);
                              newWindow?.close();
                            } finally {
                              setIsLoadingTelegramTopic(false);
                            }
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

              // If summary is loading or available, show unified stack with info as card 1
              if (isLoadingSummary || summary) {
                const readersContent = !isReviewer ? (
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
                                  <img src={userAvatar} alt={userName} className="w-8 h-8 shrink-0 rounded-full border-2 border-emerald-400 object-cover" style={{ zIndex: 7 }} title={`${userName} (you)`} referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-8 h-8 shrink-0 rounded-full border-2 border-emerald-400 flex items-center justify-center text-xs font-bold text-white" style={{ zIndex: 7, background: avatarGradient(user?.id || userName) }} title={`${userName} (you)`}>
                                    {userName.charAt(0).toUpperCase()}
                                  </div>
                                ))}
                                {showBot && (
                                  <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-8 h-8 shrink-0 rounded-full border-2 border-sky-400 object-cover" style={{ zIndex: 6 }} title="Book.luver" />
                                )}
                                {sortedReaders.slice(0, maxReaders).map((reader, index) => (
                                  reader.avatar ? (
                                    <img key={reader.id} src={reader.avatar} alt={reader.name} className="w-8 h-8 shrink-0 rounded-full border-2 border-white object-cover" style={{ zIndex: 4 - index }} title={reader.name} referrerPolicy="no-referrer" />
                                  ) : (
                                    <div key={reader.id} className="w-8 h-8 shrink-0 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white" style={{ zIndex: 4 - index, background: avatarGradient(reader.id) }} title={reader.name}>
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
                        className="flex items-center justify-center w-8 h-8 rounded-full active:scale-95 transition-all disabled:opacity-50"
                        style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}
                      >
                        {isLoadingTelegramTopic ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full" />
                        ) : (
                          <MessagesSquare size={16} className="text-slate-700 dark:text-slate-300" />
                        )}
                      </button>
                    )}
                  </div>
                ) : undefined;

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

              // No summary at all — show info card as standalone glassmorphic box
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

            {/* Spotlight recommendation with neon header — uses the same component UI as the book page sections */}
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
                onPin={(content, type, url, imageUrl) => handlePinForLater(content, type, url, imageUrl)}
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

            {/* Insights Section - Show below cover with spacing */}
            {!showRatingOverlay && (
              <>
                {!bookPageSectionsResolved ? (
                  <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-full space-y-6"
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={`book-page-skeleton-${i}`} className="rounded-xl p-4" style={glassmorphicStyle}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-24 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                          <div className="w-12 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                        </div>
                        <div className="space-y-2">
                          <div className="w-full h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                          <div className="w-5/6 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                          <div className="w-3/4 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded" />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="w-full space-y-6"
                  >
                {/* Insights: Show if we have facts, research, or are loading */}
                {(() => {
                  if (contentPreferences.fun_facts === false) return null;
                  const isNotRead = activeBook.reading_status !== 'read_it';
                  const revealedSections = spoilerRevealed.get(activeBook.id) || new Set<string>();
                  const isInsightsRevealed = revealedSections.has('insights');
                  const shouldBlurInsights = isNotRead && !isInsightsRevealed;
                  const hasFacts = activeBook.author_facts && activeBook.author_facts.length > 0;
                  const research = researchData.get(activeBook.id) || null;
                  const hasResearch = research && research.pillars && research.pillars.length > 0;
                  const influences = bookInfluences.get(activeBook.id) || [];
                  const hasInfluences = influences.length > 0;
                  const domainData = bookDomain.get(activeBook.id);
                  const hasDomain = domainData && domainData.facts && domainData.facts.length > 0;
                  const domainLabel = domainData?.label || 'Domain';
                  const contextInsights = bookContext.get(activeBook.id) || [];
                  const hasContext = contextInsights.length > 0;
                  const didYouKnowInsights = didYouKnow.get(activeBook.id) || [];
                  const hasDidYouKnow = didYouKnowInsights.length > 0;
                  const isLoadingFacts = !bookPageSectionsResolved && loadingFactsForBookId === activeBook.id && !hasFacts;
                  const isLoadingResearch = !bookPageSectionsResolved && loadingResearchForBookId === activeBook.id && !hasResearch;
                  const isLoadingInfluences = !bookPageSectionsResolved && loadingInfluencesForBookId === activeBook.id && !hasInfluences;
                  const isLoadingDomain = !bookPageSectionsResolved && loadingDomainForBookId === activeBook.id && !hasDomain;
                  const isLoadingContext = !bookPageSectionsResolved && loadingContextForBookId === activeBook.id && !hasContext;
                  const isLoadingDidYouKnow = !bookPageSectionsResolved && loadingDidYouKnowForBookId === activeBook.id && !hasDidYouKnow;
                  
                  // Get available categories (only show enabled insight types)
                  const categories: { id: string; label: string; count: number }[] = [];
                  if (featureFlags.insights.author_facts && (hasFacts || isLoadingFacts)) {
                    categories.push({ id: 'trivia', label: 'Trivia', count: activeBook.author_facts?.length || 0 });
                  }
                  if (featureFlags.insights.book_influences && (hasInfluences || isLoadingInfluences)) {
                    categories.push({ id: 'influences', label: 'Influences', count: influences.length });
                  }
                  if (featureFlags.insights.book_domain && (hasDomain || isLoadingDomain)) {
                    categories.push({ id: 'domain', label: domainLabel, count: domainData?.facts?.length || 0 });
                  }
                  if (featureFlags.insights.book_context && (hasContext || isLoadingContext)) {
                    categories.push({ id: 'context', label: 'Context', count: contextInsights.length });
                  }
                  if (featureFlags.insights.did_you_know && (hasDidYouKnow || isLoadingDidYouKnow)) {
                    categories.push({ id: 'did_you_know', label: 'Did you know?', count: didYouKnowInsights.length });
                  }
                  if (hasResearch) {
                    research.pillars.forEach(pillar => {
                      categories.push({ 
                        id: pillar.pillar_name.toLowerCase().replace(/\s+/g, '_'), 
                        label: pillar.pillar_name, 
                        count: pillar.content_items.length 
                      });
                    });
                  }
                  
                  // Only render if loading or has data (for enabled insight types)
                  const hasEnabledInsights =
                    (featureFlags.insights.author_facts && (isLoadingFacts || hasFacts)) ||
                    (featureFlags.insights.book_influences && (isLoadingInfluences || hasInfluences)) ||
                    (featureFlags.insights.book_domain && (isLoadingDomain || hasDomain)) ||
                    (featureFlags.insights.book_context && (isLoadingContext || hasContext)) ||
                    (featureFlags.insights.did_you_know && (isLoadingDidYouKnow || hasDidYouKnow)) ||
                    (isLoadingResearch || hasResearch); // Research doesn't have a feature flag
                  if (!hasEnabledInsights) return null;
                  
                  // Determine current category data
                  const currentCategory = categories.find(c => c.id === selectedInsightCategory) || categories[0];
                  let currentInsights: { text: string; sourceUrl?: string; label: string }[] = [];
                  let isLoading = false;
                  
                  if (currentCategory?.id === 'trivia') {
                    currentInsights = (activeBook.author_facts || []).map(fact => ({ text: fact, label: 'Trivia' }));
                    isLoading = isLoadingFacts;
                  } else if (currentCategory?.id === 'influences') {
                    currentInsights = influences.map(influence => ({ text: influence, label: 'Influences' }));
                    isLoading = isLoadingInfluences;
                  } else if (currentCategory?.id === 'domain') {
                    const domainDataForBook = bookDomain.get(activeBook.id);
                    const domainLabelForBook = domainDataForBook?.label || 'Domain';
                    currentInsights = (domainDataForBook?.facts || []).map(insight => ({ text: insight, label: domainLabelForBook }));
                    isLoading = isLoadingDomain;
                  } else if (currentCategory?.id === 'context') {
                    currentInsights = contextInsights.map(insight => ({ text: insight, label: 'Context' }));
                    isLoading = isLoadingContext;
                  } else if (currentCategory?.id === 'did_you_know') {
                    // Combine all 3 notes per item into a single insight card
                    currentInsights = didYouKnowInsights.map(item => ({
                      text: item.notes.join('\n\n'),
                      label: 'Did you know?',
                      sourceUrl: item.source_url
                    }));
                    isLoading = isLoadingDidYouKnow;
                  } else if (currentCategory && hasResearch) {
                    const pillar = research.pillars.find(p => p.pillar_name.toLowerCase().replace(/\s+/g, '_') === currentCategory.id);
                    if (pillar) {
                      currentInsights = pillar.content_items.map(item => ({ 
                        text: item.deep_insight, 
                        sourceUrl: item.source_url,
                        label: pillar.pillar_name
                      }));
                    }
                    isLoading = isLoadingResearch;
                  }
                  
                  return (
                    <div className="w-full space-y-2">
                      {/* Insights Header with Category Selector - hidden when featureFlags.bookPageSectionHeaders.insights is true */}
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
                      {/* Content with spoiler protection */}
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
                        {shouldBlurInsights && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-sm shadow-sm">
                              <Lightbulb size={14} className="text-slate-600 dark:text-slate-400" />
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Spoiler alert, tap to reveal</span>
                            </div>
                          </div>
                        )}
                        <div className={`[&_p]:transition-[filter] [&_p]:duration-300 [&_span]:transition-[filter] [&_span]:duration-300 [&_button]:transition-[filter] [&_button]:duration-300 ${shouldBlurInsights ? '[&_p]:blur-[5px] [&_span]:blur-[5px] [&_button]:blur-[5px] select-none pointer-events-none' : ''}`}>
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
                              renderAction={(idx) => {
                                const hash = getContentHash('insight', currentInsights[idx]?.text?.substring(0, 50) || '');
                                return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
                              }}
                              onPin={(idx) => {
                                const insight = currentInsights[idx];
                                if (insight) handlePinForLater(insight.text, 'insight');
                              }}
                              isPinned={(idx) => {
                                const insight = currentInsights[idx];
                                return insight ? isContentPinned(insight.text) : false;
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Podcast Episodes - Show below author facts */}
                {(() => {
                  if (contentPreferences.podcasts === false) return null;
                  const episodes = combinedPodcastEpisodes;
                  const hasEpisodes = episodes.length > 0;
                  // Only show loading if we don't have episodes yet. Once loaded, always show.
                  const isLoading = !bookPageSectionsResolved && activeBook && loadingPodcastsForBookId === activeBook.id && !hasEpisodes;
                  
                  // Only show the podcast section if loading or has episodes
                  if (!isLoading && !hasEpisodes) return null;
                  
                  return (
                    <div className="w-full space-y-2">
                      {/* Podcast Header - hidden when featureFlags.bookPageSectionHeaders.podcasts is true */}
                      {!featureFlags.bookPageSectionHeaders.podcasts && (
                        <div className="flex items-center justify-center mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">PODCASTS:</span>
                            <span className="text-[10px] font-bold text-slate-400">/</span>
                            <span className="text-[10px] font-bold text-blue-700">Curated + Apple</span>
                          </div>
                        </div>
                      )}
                      {/* Content */}
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
                              renderAction={(idx) => {
                                const hash = getContentHash('podcast', episodes[idx]?.url || '');
                                return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
                              }}
                              onPin={(idx) => {
                                const ep = episodes[idx];
                                if (ep) handlePinForLater(`${ep.podcast_name || 'Podcast'} — ${ep.title}`, 'podcast', ep.url || ep.audioUrl, ep.thumbnail);
                              }}
                              isPinned={(idx) => {
                                const ep = episodes[idx];
                                return ep ? isContentPinned(`${ep.podcast_name || 'Podcast'} — ${ep.title}`) : false;
                              }}
                            />
                          )}
                      </div>
                    </div>
                  );
                })()}

                {/* YouTube Videos - Show below podcasts */}
                {(() => {
                  if (contentPreferences.youtube === false) return null;
                  const videos = youtubeVideos.get(activeBook.id) || [];
                  const hasVideos = videos.length > 0;
                  const isLoading = !bookPageSectionsResolved && loadingVideosForBookId === activeBook.id && !hasVideos;

                  // Only show the videos section if loading or has videos
                  if (!isLoading && !hasVideos) return null;

                  return (
                    <div className="w-full space-y-2">
                      {/* Videos Header - hidden when featureFlags.bookPageSectionHeaders.youtube is true */}
                      {!featureFlags.bookPageSectionHeaders.youtube && (
                        <div className="flex items-center justify-center mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">VIDEOS:</span>
                            <span className="text-[10px] font-bold text-slate-400">/</span>
                            <span className="text-[10px] font-bold text-blue-700">YouTube</span>
                          </div>
                        </div>
                      )}
                      {/* Content */}
                      <div>
                          {isLoading ? (
                            // Show loading placeholder
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
                              renderAction={(idx) => {
                                const hash = getContentHash('youtube', videos[idx]?.videoId || '');
                                return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
                              }}
                              onPin={(idx) => {
                                const v = videos[idx];
                                if (v) handlePinForLater(`${v.title} — ${v.channelTitle}`, 'youtube', v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : undefined, v.thumbnail);
                              }}
                              isPinned={(idx) => {
                                const v = videos[idx];
                                return v ? isContentPinned(`${v.title} — ${v.channelTitle}`) : false;
                              }}
                            />
                          )}
                      </div>
                    </div>
                  );
                })()}

                {/* Analysis Articles - Show below videos */}
                {(() => {
                  if (contentPreferences.articles === false) return null;
                  const articles = analysisArticles.get(activeBook.id) || [];
                  // Check if we have real articles (not just the fallback search URL)
                  // A fallback article has a title that starts with "Search Google Scholar" and URL contains "scholar.google.com/scholar?q="
                  const hasRealArticles = articles.length > 0 && articles.some(article => {
                    const isFallback = article.title?.includes('Search Google Scholar') ||
                                       (article.url && article.url.includes('scholar.google.com/scholar?q='));
                    return !isFallback;
                  });
                  const hasOnlyFallback = articles.length > 0 && !hasRealArticles;
                  const hasArticles = hasRealArticles;
                  const isLoading = !bookPageSectionsResolved && loadingAnalysisForBookId === activeBook.id && !hasArticles && !hasOnlyFallback;

                  // Only show the analysis section if loading or has articles
                  if (!isLoading && !hasArticles) return null;

                  return (
                    <div className="w-full space-y-2">
                      {/* Analysis Header - hidden when featureFlags.bookPageSectionHeaders.articles is true */}
                      {!featureFlags.bookPageSectionHeaders.articles && (
                        <div className="flex items-center justify-center mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">ANALYSIS:</span>
                            <span className="text-[10px] font-bold text-slate-400">/</span>
                            <span className="text-[10px] font-bold text-blue-700">Google Scholar</span>
                          </div>
                        </div>
                      )}
                      {/* Content */}
                      <div>
                          {isLoading ? (
                            // Show loading placeholder
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
                            // Show articles
                            <AnalysisArticles
                              articles={articles}
                              bookId={activeBook.id}
                              isLoading={false}
                              showComment={false}
                              showSend={remoteFlags.send_enabled}
                              renderAction={(idx) => {
                                const hash = getContentHash('article', articles[idx]?.url || '');
                                return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
                              }}
                              onPin={(idx) => {
                                const a = articles[idx];
                                if (a) handlePinForLater(`${a.title}${a.url ? ` — ${a.url}` : ''}`, 'article', a.url);
                              }}
                              isPinned={(idx) => {
                                const a = articles[idx];
                                return a ? isContentPinned(`${a.title}${a.url ? ` — ${a.url}` : ''}`) : false;
                              }}
                            />
                          )}
                      </div>
                    </div>
                  );
                })()}

                {/* Related Movies & Shows */}
                {(() => {
                  if (contentPreferences.related_work === false) return null;
                  const movies = relatedMovies.get(activeBook.id);
                  const hasData = movies !== undefined;
                  const hasMovies = movies && movies.length > 0;
                  const isLoading = !bookPageSectionsResolved && loadingRelatedMoviesForBookId === activeBook.id && !hasData;

                  if (!isLoading && !hasMovies) return null;

                  return (
                    <div className="w-full space-y-2">
                      {!featureFlags.bookPageSectionHeaders.relatedMovies && (
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
                          movies={movies || EMPTY_ARRAY}
                          bookId={activeBook.id}
                          isLoading={false}
                          showPlayButtons={remoteFlags.related_work_play_buttons}
                          showComment={false}
                          showSend={remoteFlags.send_enabled}
                          renderAction={(idx) => {
                            const m = (movies || EMPTY_ARRAY)[idx];
                            const hash = getContentHash('related_work', m?.title || '');
                            return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
                          }}
                          onPin={(idx) => {
                            const m = (movies || EMPTY_ARRAY)[idx];
                            if (m) handlePinForLater(`${m.title} (${m.type}) — ${m.director}`, m.type, m.itunes_url, m.poster_url || m.itunes_artwork);
                          }}
                          isPinned={(idx) => {
                            const m = (movies || EMPTY_ARRAY)[idx];
                            return m ? isContentPinned(`${m.title} (${m.type}) — ${m.director}`) : false;
                          }}
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
                        <button onClick={() => { capturePreviousView(); setScrollY(0); setShowAccountPage(true); }} className="text-xs font-medium text-blue-500 active:opacity-70 flex-shrink-0 ml-2">Settings</button>
                      </div>
                    </div>
                  );
                })()}

                {/* Related Books - Show below Related Movies */}
                {(() => {
                  if (contentPreferences.related_books === false) return null;
                  const related = relatedBooks.get(activeBook.id);
                  const hasData = related !== undefined;
                  const hasRelated = related && related.length > 0;
                  const isLoading = !bookPageSectionsResolved && loadingRelatedForBookId === activeBook.id && !hasData;

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
                          books={related || EMPTY_ARRAY}
                          bookId={activeBook.id}
                          isLoading={false}
                          onAddBook={handleAddBook}
                          showComment={false}
                          showSend={remoteFlags.send_enabled}
                          sourceBookCoverUrl={activeBook.cover_url}
                          sourceBookTitle={activeBook.title}
                          renderAction={(idx) => {
                            const b = (related || EMPTY_ARRAY)[idx];
                            const hash = getContentHash('related_book', b?.title || '');
                            return <HeartButton contentHash={hash} count={heartCounts.get(hash) || 0} isHearted={userHearted.has(hash)} onToggle={handleToggleHeart} size={17} />;
                          }}
                          onPin={(idx) => {
                            const b = (related || EMPTY_ARRAY)[idx];
                            if (b) handlePinForLater(`${b.title} by ${b.author}`, 'book', b.wikipedia_url || b.google_books_url, b.cover_url || b.thumbnail);
                          }}
                          isPinned={(idx) => {
                            const b = (related || EMPTY_ARRAY)[idx];
                            return b ? isContentPinned(`${b.title} by ${b.author}`) : false;
                          }}
                        />
                      )}
                    </div>
                    </>
                  );
                })()}

                  </motion.div>
                )}
              </>
            )}
          </div>
        )}

          </motion.main>
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
            <StickyNote size={14} className="text-amber-400 flex-shrink-0" />
            <span className="text-xs text-white font-medium">Saved to For later</span>
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

      {/* Bottom Navigation Bar / Selection Mode Action Bar — hidden when BookChat is open */}
      {!(showChatPage && chatBookSelected) && (
      <div className="fixed left-0 right-0 z-[50] flex justify-center px-4 pointer-events-none" style={{ bottom: 'calc(16px + var(--safe-area-bottom, 0px))' }}>
        <AnimatePresence mode="wait">
        {isSelectMode && selectedBookIds.size > 0 ? (
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
        ) : (
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
              setScrollY(0); // Reset scroll when switching views
              setViewingUserId(null);
              setViewingUserBooks([]);
              setViewingUserName('');
              setViewingUserFullName(null);
              setViewingUserAvatar(null);
              setShowBookshelfCovers(true);
              setShowBookshelf(false);
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
                  setScrollY(0);
                  setChatBookSelected(false);
                  setShowChatPage(true);
                  setShowFeedPage(false);
                  setShowBookshelf(false);
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
              setScrollY(0);
              setCreatePostText('');
              setShowCreatePost(true);
              setShowChatPage(false);
              setChatBookSelected(false);
              setShowFeedPage(false);
              setShowBookshelf(false);
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
              setScrollY(0);
              setViewingUserId(null);
              setViewingUserBooks([]);
              setViewingUserName('');
              setViewingUserFullName(null);
              setViewingUserAvatar(null);
              setShowFeedPage(true);
              setShowBookshelf(false);
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
        )}
        </AnimatePresence>
      </div>
      )}

      {/* Unread chat badge — rendered outside glassmorphic nav to avoid blur */}
      {unreadChatCounts.size > 0 && !(showChatPage && chatBookSelected) && chatNavButtonRef.current && createPortal(
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
                    whileHover={{ scale: 1.02 }}
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
                    whileHover={{ scale: 1.02 }}
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
                                  setShowBookshelf(false);
                                  setShowBookshelfCovers(false);
                                  setShowNotesView(false);
                                  // Reset scroll to top
                                  setScrollY(0);
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

      {/* Notes Editor Overlay */}
      <AnimatePresence>
        {isShowingNotes && activeBook && (
          <NotesEditorOverlay
            bookId={activeBook.id}
            bookTitle={activeBook.title}
            initialNotes={activeBook.notes || null}
            onClose={(finalNotes) => {
              const hadChanges = (finalNotes || null) !== (activeBook.notes || null);
              setIsShowingNotes(false);
              // Persist to local state + DB on close
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

      <ConnectAccountModal
        isOpen={showConnectAccountModal}
        onClose={() => setShowConnectAccountModal(false)}
        reason={connectAccountReason}
        bookCount={books.length}
      />

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
                    setShowBookshelf(false);
                    setShowBookshelfCovers(false);
                    setShowNotesView(false);
                    setShowFeedPage(false);
                  } else {
                    setSelectedIndex(bookIndex);
                    setShowBookshelf(false);
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
                setShowBookshelf(false);
                setShowBookshelfCovers(false);
                setShowNotesView(false);
                setShowFeedPage(false);
              }}
              onSelectUser={(userId) => {
                setViewingUserId(userId);
                setShowBookshelf(false);
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
                    setShowBookshelf(false);
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

        {/* Music Modal for feed album items */}
        {feedMusicModalData && (
          <MusicModal
            musicLinks={feedMusicModalData.musicLinks}
            albumTitle={feedMusicModalData.title}
            albumArtist={feedMusicModalData.artist}
            onClose={() => setFeedMusicModalData(null)}
            anchorRef={feedPlayButtonRef}
          />
        )}

        {/* Watch Modal for feed movie/show items */}
        {feedWatchModalData && (
          <WatchModal
            watchLinks={feedWatchModalData.watchLinks}
            title={feedWatchModalData.title}
            year={feedWatchModalData.year}
            onClose={() => setFeedWatchModalData(null)}
            anchorRef={feedPlayButtonRef}
          />
        )}

        {/* Podcast fan-out tooltip for feed */}
        <AnimatePresence>
          {feedPodcastTooltip && feedPlayButtonRef.current && (() => {
            const anchorRect = feedPlayButtonRef.current!.getBoundingClientRect();
            const hasPreview = !!feedPodcastTooltip.audioUrl;
            const items: { key: string; icon: React.ReactNode; color: string; onClick: (e: React.MouseEvent) => void }[] = [];
            if (hasPreview) {
              items.push({
                key: 'preview',
                icon: feedPodcastAudioPlaying ? <span className="text-white text-xs font-bold">■</span> : <Headphones size={18} className="text-white" />,
                color: '#8B5CF6',
                onClick: (e) => {
                  e.stopPropagation();
                  if (feedPodcastAudioPlaying) {
                    if (feedAudioRef.current) { feedAudioRef.current.pause(); feedAudioRef.current = null; }
                    setFeedPodcastAudioPlaying(false);
                  } else {
                    const audio = new Audio(feedPodcastTooltip.audioUrl);
                    audio.onended = () => setFeedPodcastAudioPlaying(false);
                    audio.play();
                    feedAudioRef.current = audio;
                    setFeedPodcastAudioPlaying(true);
                  }
                },
              });
            }
            items.push({
              key: 'apple',
              icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                  <path d="M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0zm6.525 2.568c4.988 0 8.93 3.637 9.32 8.378a.19.19 0 01-.19.208h-1.758a.19.19 0 01-.187-.163 7.26 7.26 0 00-7.186-6.298 7.26 7.26 0 00-7.186 6.298.19.19 0 01-.186.163H2.733a.19.19 0 01-.19-.208c.39-4.741 4.333-8.378 9.321-8.378zm.058 3.39a5.608 5.608 0 015.265 3.87.19.19 0 01-.18.252h-1.762a.19.19 0 01-.176-.12 3.578 3.578 0 00-6.294 0 .19.19 0 01-.176.12H6.833a.19.19 0 01-.18-.253 5.608 5.608 0 015.27-3.868zm-.033 3.39a2.25 2.25 0 110 4.5 2.25 2.25 0 010-4.5zm-.024 5.719c1.024 0 1.854.83 1.854 1.854v2.688c0 1.024-.83 1.854-1.854 1.854a1.854 1.854 0 01-1.854-1.854V16.92c0-1.024.83-1.854 1.854-1.854z"/>
                </svg>
              ),
              color: '#9933CC',
              onClick: (e) => {
                e.stopPropagation();
                if (feedAudioRef.current) { feedAudioRef.current.pause(); feedAudioRef.current = null; }
                setFeedPodcastAudioPlaying(false);
                setFeedPodcastTooltip(null);
                if (isNativePlatform) { openDeepLink(feedPodcastTooltip.url); } else { openSystemBrowser(feedPodcastTooltip.url); }
              },
            });
            const count = items.length;
            const radius = 70;
            const startAngle = Math.PI;
            const endAngle = 2 * Math.PI;
            const angleStep = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;
            const getPos = (index: number) => {
              const angle = count > 1 ? startAngle + angleStep * index : 1.5 * Math.PI;
              return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
            };
            const centerX = anchorRect.left + anchorRect.width / 2;
            const centerY = anchorRect.top + anchorRect.height / 2;
            return (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[9998]"
                  onClick={() => {
                    if (feedAudioRef.current) { feedAudioRef.current.pause(); feedAudioRef.current = null; }
                    setFeedPodcastAudioPlaying(false);
                    setFeedPodcastTooltip(null);
                  }}
                />
                {items.map((item, i) => {
                  const pos = getPos(i);
                  return (
                    <motion.button
                      key={item.key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      onClick={item.onClick}
                      className="fixed z-[9999] w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                      style={{
                        left: centerX + pos.x - 22,
                        top: centerY + pos.y - 22,
                        background: item.color,
                        boxShadow: '0 3px 12px rgba(0,0,0,0.3)',
                      }}
                    >
                      {item.icon}
                    </motion.button>
                  );
                })}
              </>
            );
          })()}
        </AnimatePresence>

        {/* Create Post Sheet - now inline view */}

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
                  className="relative w-[272px] aspect-[2/3] overflow-hidden rounded-lg cursor-pointer"
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
                    setShowBookshelf(false);
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
                  setScrollY(0);
                  setShowAccountPage(true);
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
                    setScrollY(0);
                    setShowAccountPage(true);
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
                          // Remove from list for all selected books
                          bookIds.forEach(id => {
                            const book = books.find(b => b.id === id);
                            if (book) {
                              const newLists = (book.lists || []).filter((l: string) => l !== listName);
                              handleUpdateBookLists(id, newLists);
                            }
                          });
                        } else {
                          // Add to list for all selected books
                          if (isTop5 && isTop5PartialFull) return;
                          bookIds.forEach(id => {
                            const book = books.find(b => b.id === id);
                            if (book && !book.lists?.includes(listName)) {
                              const newLists = [...(book.lists || []), listName];
                              handleUpdateBookLists(id, newLists);
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
                          // Add all selected books to the new list
                          Array.from(selectedBookIds).forEach(id => {
                            const book = books.find(b => b.id === id);
                            if (book && !book.lists?.includes(trimmed)) {
                              const newLists = [...(book.lists || []), trimmed];
                              handleUpdateBookLists(id, newLists);
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
                              handleUpdateBookLists(id, newLists);
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
                <p className="text-xs text-slate-600 dark:text-slate-400">Pick from your "Want to read" list</p>
              </div>

              {/* Book List */}
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 ios-scroll">
                {(() => {
                  const wantToReadBooks = books.filter(b => b.reading_status === 'want_to_read');

                  if (wantToReadBooks.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <BookMarked size={32} className="mx-auto mb-3 text-slate-400" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">No books in your "Want to read" list</p>
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
                        // Update book status to "reading"
                        try {
                          const { error } = await supabase
                            .from('books')
                            .update({ reading_status: 'reading' })
                            .eq('id', book.id);

                          if (!error) {
                            // Update local state
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
