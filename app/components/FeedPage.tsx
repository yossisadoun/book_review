'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import {
  BookOpen,
  Circle,
  ExternalLink,
  Headphones,
  Play,
  ChevronDown,
  Users,
  X,
  MessageCircle,
  Send,
  Plus,
  Check,
  ChevronsRight,
  Film,
  Tv,
  Music,
  Disc3,
  Birdhouse,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { featureFlags } from '@/lib/feature-flags';
import type { RemoteFeatureFlags } from '@/lib/remote-feature-flags';
import { isNativePlatform, openSystemBrowser, openDeepLink, triggerMediumHaptic } from '@/lib/capacitor';
import { getAssetPath, decodeHtmlEntities } from './utils';
import HeartButton from './HeartButton';
import MusicModal from './MusicModal';
import WatchModal from './WatchModal';
import type {
  PersonalizedFeedItem,
  BookWithRatings,
  Book,
  MusicLinks,
  WatchLinks,
} from '../types';
import {
  getPersonalizedFeed,
  markFeedItemsAsShown,
  getReadFeedItems,
  setFeedItemReadStatus,
} from '../services/feed-service';
import { getCached, setCache, CACHE_KEYS } from '../services/cache-service';
import { analytics } from '../services/analytics-service';

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const feedCardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.45)',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
};

export interface FeedPageProps {
  user: { id: string } | null;
  isAnonymous: boolean;
  personalizedFeedItems: PersonalizedFeedItem[];
  setPersonalizedFeedItems: React.Dispatch<React.SetStateAction<PersonalizedFeedItem[]>>;
  isLoadingPersonalizedFeed: boolean;
  heartCounts: Map<string, number>;
  userHearted: Set<string>;
  handleToggleHeart: (contentHash: string) => void;
  remoteFlags: RemoteFeatureFlags;
  glassmorphicStyle: React.CSSProperties;
  scrollContainerRef: React.MutableRefObject<HTMLElement | null>;
  setScrollY: (y: number) => void;
  headerPullRef: React.RefObject<HTMLDivElement | null>;
  refreshAnimation: any;
  setViewingBookFromOtherUser: (book: BookWithRatings | null) => void;
  handleAddBook: (meta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) => void;
  capturePreviousView: () => void;
  setViewingUserId: (id: string) => void;
  setShowFeedPage: (show: boolean) => void;
  setShowBookshelfCovers: (show: boolean) => void;
  setConnectAccountReason: (reason: 'book_limit' | 'follow' | 'feed' | 'account') => void;
  setShowConnectAccountModal: (show: boolean) => void;
}

export default function FeedPage({
  user,
  isAnonymous,
  personalizedFeedItems,
  setPersonalizedFeedItems,
  isLoadingPersonalizedFeed,
  heartCounts,
  userHearted,
  handleToggleHeart,
  remoteFlags,
  glassmorphicStyle,
  scrollContainerRef,
  setScrollY,
  headerPullRef,
  refreshAnimation,
  setViewingBookFromOtherUser,
  handleAddBook,
  capturePreviousView,
  setViewingUserId,
  setShowFeedPage,
  setShowBookshelfCovers,
  setConnectAccountReason,
  setShowConnectAccountModal,
}: FeedPageProps) {
  // --- Feed display state ---
  const [feedDisplayCount, setFeedDisplayCount] = useState(8);
  const [feedFilter, setFeedFilter] = useState<'all' | 'unread'>('all');
  const [feedTypeFilter, setFeedTypeFilter] = useState<'all' | 'fact' | 'context' | 'drilldown' | 'influence' | 'podcast' | 'article' | 'related_book' | 'video' | 'friend_book' | 'did_you_know' | 'related_work'>('all');
  const [isFeedTypeDropdownOpen, setIsFeedTypeDropdownOpen] = useState(false);
  const feedTypeDropdownRef = useRef<HTMLDivElement>(null);
  const [isLoadingMoreFeed, setIsLoadingMoreFeed] = useState(false);

  // --- Feed interaction state ---
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

  // --- Feed summary preloading ---
  const [feedBookSummaries, setFeedBookSummaries] = useState<Map<string, string>>(new Map());
  const feedSummaryFetchedRef = useRef<Set<string>>(new Set());

  // --- Pull to refresh ---
  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [feedRefreshDone, setFeedRefreshDone] = useState(false);
  const [feedRefreshFading, setFeedRefreshFading] = useState(false);
  const feedPullStartY = useRef<number | null>(null);
  const feedHapticFired = useRef(false);
  const feedLottieRef = useRef<any>(null);
  const feedPullDistance = useRef(0);
  const feedPullIndicatorRef = useRef<HTMLDivElement>(null);
  const feedPullContentRef = useRef<HTMLDivElement>(null);
  const feedPullLottieRef = useRef<HTMLDivElement>(null);

  const updateFeedPullDOM = (dist: number) => {
    feedPullDistance.current = dist;
    if (feedPullIndicatorRef.current) {
      feedPullIndicatorRef.current.style.top = `${60 + dist}px`;
      feedPullIndicatorRef.current.style.transition = feedPullStartY.current !== null ? 'none' : 'top 0.3s ease-out';
      feedPullIndicatorRef.current.style.display = dist > 0 ? '' : 'none';
    }
    if (feedPullLottieRef.current) {
      feedPullLottieRef.current.style.opacity = String(Math.min(dist / 30, 1));
    }
    if (feedPullContentRef.current) {
      feedPullContentRef.current.style.transform = `translateY(${dist}px)`;
      feedPullContentRef.current.style.transition = feedPullStartY.current !== null ? 'none' : 'transform 0.3s ease-out';
    }
    if (headerPullRef.current) {
      headerPullRef.current.style.transform = `translateY(${dist}px)`;
      headerPullRef.current.style.transition = feedPullStartY.current !== null ? 'none' : 'transform 0.3s ease-out';
    }
  };

  // --- Computed ---
  const filteredFeedItems = useMemo(() => {
    let items = personalizedFeedItems;
    if (feedFilter === 'unread') {
      items = items.filter(item => !item.read);
    }
    if (feedTypeFilter !== 'all') {
      items = items.filter(item => item.type === feedTypeFilter);
    }
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

  // --- Effects ---

  // Preload book summaries for friend_book feed items
  useEffect(() => {
    const friendItems = personalizedFeedItems.filter(item => item.type === 'friend_book' && item.source_book_title && item.source_book_author);
    for (const item of friendItems) {
      const summaryKey = `${(item.source_book_title || '').toLowerCase().trim()}::${(item.source_book_author || '').toLowerCase().trim()}`;
      if (feedSummaryFetchedRef.current.has(summaryKey)) continue;
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
  }, [personalizedFeedItems]);

  // Cleanup feed audio on unmount
  useEffect(() => {
    return () => {
      if (feedAudioRef.current) {
        feedAudioRef.current.pause();
        feedAudioRef.current = null;
      }
    };
  }, []);

  // --- Helpers ---
  const openSourceBookOverlay = (item: PersonalizedFeedItem) => {
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

  // Thread card wrapper used by most feed item types
  const renderThreadCard = (item: PersonalizedFeedItem, _typeLabel: string, content: React.ReactNode) => {
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
    return (
      <motion.div key={item.id} initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="w-full">
        <div className="flex gap-3 px-4 pt-3 pb-2">
          {/* Avatar */}
          <button onClick={() => openSourceBookOverlay(item)} className="flex-shrink-0 active:scale-95 transition-transform self-start mt-1 relative">
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
              <button onClick={() => openSourceBookOverlay(item)} className="active:opacity-70 min-w-0 flex-1">
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
  };

  // --- Render feed item by type ---
  const renderFeedItem = (item: PersonalizedFeedItem) => {
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

    switch (item.type) {
      case 'fact':
        return renderThreadCard(item, 'fact', (
          <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">{item.content.fact}</p>
        ));

      case 'context': {
        const contextData = item.content.insight;
        return renderThreadCard(item, 'context', (
          <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">
            {typeof contextData === 'string' ? contextData : contextData?.text || JSON.stringify(contextData)}
          </p>
        ));
      }

      case 'drilldown': {
        const drilldownData = item.content.insight;
        return renderThreadCard(item, 'drilldown', (
          <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">
            {typeof drilldownData === 'string' ? drilldownData : drilldownData?.text || JSON.stringify(drilldownData)}
          </p>
        ));
      }

      case 'influence': {
        const influenceData = item.content.influence;
        return renderThreadCard(item, 'influence', (
          <p className="text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">
            {typeof influenceData === 'string' ? influenceData : influenceData?.title || JSON.stringify(influenceData)}
          </p>
        ));
      }

      case 'podcast': {
        const episode = item.content.episode;
        const podcastAudioUrl = episode?.audioUrl || (episode?.url && episode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? episode.url : null);
        const isPodcastPlaying = feedPlayingAudioUrl === (podcastAudioUrl || episode?.url);
        return renderThreadCard(item, 'podcast', (
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
      }

      case 'video': {
        const video = item.content.video;
        const videoId = video?.videoId || video?.id;
        const isVideoPlaying = feedPlayingVideoId === videoId;
        return renderThreadCard(item, 'video', (
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
      }

      case 'related_book': {
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
        return renderThreadCard(item, 'related_book', (
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
      }

      case 'related_work': {
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
          return renderThreadCard(item, 'related_work', (
            <div>
              {/* Vinyl record visual */}
              <div className="relative w-[96%] mx-auto my-6 flex items-center" style={{ aspectRatio: '1.7 / 1' }}>
                {/* Vinyl disc */}
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
                    <div
                      className="absolute inset-0 rounded-full opacity-40 pointer-events-none"
                      style={{ background: 'repeating-radial-gradient(circle, transparent 0, transparent 2px, rgba(255,255,255,0.03) 3px, transparent 4px)' }}
                    />
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

                {/* Album sleeve */}
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

                  {/* Play button */}
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

        // Movie/TV show
        return renderThreadCard(item, 'related_work', (
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
              {/* Play button */}
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
      }

      case 'article': {
        const article = item.content.article;
        const articleDomain = (() => {
          try { return new URL(article?.url || '').hostname.replace('www.', ''); } catch { return ''; }
        })();
        return renderThreadCard(item, 'article', (
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
                  <img src={`https://www.google.com/s2/favicons?domain=${articleDomain}&sz=32`} alt="" className="w-4 h-4 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
      }

      case 'friend_book': {
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
        const summaryKey = `${(item.source_book_title || '').toLowerCase().trim()}::${(item.source_book_author || '').toLowerCase().trim()}`;
        const friendBookSummary = feedBookSummaries.get(summaryKey);
        const FeedHeart = () => (
          <HeartButton
            contentHash={feedContentHash}
            count={heartCounts.get(feedContentHash) || 0}
            isHearted={userHearted.has(feedContentHash)}
            onToggle={handleToggleHeart}
            size={17}
          />
        );
        return (
          <motion.div key={item.id} initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="w-full">
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
      }

      case 'did_you_know': {
        const didYouKnowNotes: string[] = item.content.notes || [];
        const didYouKnowSourceUrl: string | undefined = item.content.source_url;

        return renderThreadCard(item, 'did_you_know', (
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
      }

      case 'user_post': {
        const FeedHeart = () => (
          <HeartButton
            contentHash={feedContentHash}
            count={heartCounts.get(feedContentHash) || 0}
            isHearted={userHearted.has(feedContentHash)}
            onToggle={handleToggleHeart}
            size={17}
          />
        );
        return (
          <motion.div key={item.id} initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="w-full">
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
      }

      default:
        return null;
    }
  };

  // --- Main render ---
  return (
    <>
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
        {/* Pull to refresh indicator */}
        <div ref={feedPullIndicatorRef} className="absolute left-0 right-0 flex justify-center z-50 pointer-events-none" style={{ top: '60px', display: (feedRefreshing || feedRefreshDone || feedRefreshFading) ? '' : 'none' }}>
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
          <>
          {/* Feed filter pills */}
          <div key={`filters-${feedFilter}`} className="flex items-center gap-2 mb-3 px-4">
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
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsFeedTypeDropdownOpen(false)}
                  />
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
          {!isLoadingPersonalizedFeed && displayedFeedItems.map((item) => renderFeedItem(item))}
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

          </>
        </div>
      </motion.main>

      {/* Feed Music Modal */}
      {feedMusicModalData && (
        <MusicModal
          musicLinks={feedMusicModalData.musicLinks}
          albumTitle={feedMusicModalData.title}
          albumArtist={feedMusicModalData.artist}
          onClose={() => setFeedMusicModalData(null)}
          anchorRef={feedPlayButtonRef}
        />
      )}

      {/* Feed Watch Modal */}
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
    </>
  );
}
