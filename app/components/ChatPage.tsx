'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Library, BookOpen, MessageCircle, MessageSquareHeart, Trash2, Heart } from 'lucide-react';
import Lottie from 'lottie-react';
import BookChat from './BookChat';
import { getAssetPath } from './utils';
import {
  getChatList,
  deleteChatForBook,
  deleteCharacterChat,
  type ChatListItem,
  type CharacterChatListItem,
  type BookChatContext,
  type CharacterChatContext,
} from '../services/chat-service';
import { getCharacterContext, generateSingleCharacterAvatar } from '../services/character-avatars-service';
import { triggerMediumHaptic } from '@/lib/capacitor';
import type { BookWithRatings } from '../types';

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export interface ChatPageProps {
  user: { id: string } | null;
  books: BookWithRatings[];
  activeBook: BookWithRatings | null;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  // Chat navigation state (stays in page.tsx, passed as props)
  chatBookSelected: boolean;
  setChatBookSelected: (v: boolean) => void;
  chatGeneralMode: boolean;
  setChatGeneralMode: (v: boolean) => void;
  characterChatContext: CharacterChatContext | null;
  setCharacterChatContext: (v: CharacterChatContext | null) => void;
  loadingCharacterChat: string | false;
  setLoadingCharacterChat: (v: string | false) => void;
  chatOpenedFromBookPage: React.MutableRefObject<boolean>;
  // Chat list data (fetched in page.tsx, passed as props)
  chatList: ChatListItem[];
  setChatList: React.Dispatch<React.SetStateAction<ChatListItem[]>>;
  characterChatList: CharacterChatListItem[];
  setCharacterChatList: React.Dispatch<React.SetStateAction<CharacterChatListItem[]>>;
  chatListLoading: boolean;
  setChatListLoading: (v: boolean) => void;
  // Unread counts (shared with nav badge)
  unreadChatCounts: Map<string, number>;
  setUnreadChatCounts: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  // Shared refs and callbacks
  scrollContainerRef: React.MutableRefObject<HTMLElement | null>;
  setScrollY: (v: number) => void;
  headerPullRef: React.MutableRefObject<HTMLDivElement | null>;
  refreshAnimation: any;
  handleAddBook: (meta: any) => Promise<void>;
  setShowChatPage: (v: boolean) => void;
  // Book insight data for BookChat context building
  bookInfluences: Map<string, any[]>;
  bookDomain: Map<string, any>;
  bookContext: Map<string, any[]>;
  didYouKnow: Map<string, any[]>;
  combinedPodcastEpisodes: any[] | null;
  youtubeVideos: Map<string, any[]>;
  analysisArticles: Map<string, any[]>;
  relatedBooks: Map<string, any[]>;
  relatedMovies: Map<string, any[]>;
  discussionQuestions: any[] | null;
  characterAvatars: Map<string, any[]>;
  dismissedChatIds: Set<string>;
  setDismissedChatIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export default function ChatPage({
  user,
  books,
  activeBook,
  selectedIndex,
  setSelectedIndex,
  chatBookSelected,
  setChatBookSelected,
  chatGeneralMode,
  setChatGeneralMode,
  characterChatContext,
  setCharacterChatContext,
  loadingCharacterChat,
  setLoadingCharacterChat,
  chatOpenedFromBookPage,
  chatList,
  setChatList,
  characterChatList,
  setCharacterChatList,
  chatListLoading,
  setChatListLoading,
  unreadChatCounts,
  setUnreadChatCounts,
  scrollContainerRef,
  setScrollY,
  headerPullRef,
  refreshAnimation,
  handleAddBook,
  setShowChatPage,
  bookInfluences,
  bookDomain,
  bookContext,
  didYouKnow,
  combinedPodcastEpisodes,
  youtubeVideos,
  analysisArticles,
  relatedBooks,
  relatedMovies,
  discussionQuestions,
  characterAvatars,
  dismissedChatIds,
  setDismissedChatIds,
}: ChatPageProps) {
  // --- Local state ---
  const [orphanedChatBook, setOrphanedChatBook] = useState<{ id: string; title: string; author: string; cover_url?: string | null } | null>(null);
  const [chatSwipeId, setChatSwipeId] = useState<string | null>(null);
  const [deletingChatKey, setDeletingChatKey] = useState<string | null>(null);
  const [chatRefreshing, setChatRefreshing] = useState(false);
  const [chatRefreshDone, setChatRefreshDone] = useState(false);
  const [chatRefreshFading, setChatRefreshFading] = useState(false);

  // --- Local refs ---
  const chatSwipeRef = useRef<{ startX: number; currentX: number; bookId: string } | null>(null);
  const chatPullDistance = useRef(0);
  const chatPullStartY = useRef<number | null>(null);
  const chatPullIndicatorRef = useRef<HTMLDivElement>(null);
  const chatPullContentRef = useRef<HTMLDivElement>(null);
  const chatPullLottieRef = useRef<HTMLDivElement>(null);
  const chatHapticFired = useRef(false);
  const chatLottieRef = useRef<any>(null);

  // Clean up orphanedChatBook when chatBookSelected becomes false
  useEffect(() => {
    if (!chatBookSelected) {
      setOrphanedChatBook(null);
    }
  }, [chatBookSelected]);

  // --- DOM manipulation for pull-to-refresh ---
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
      headerPullRef.current.style.transform = `translateY(${dist}px)`;
      headerPullRef.current.style.transition = chatPullStartY.current !== null ? 'none' : 'transform 0.3s ease-out';
    }
  };

  // --- General mode context (memoized) ---
  const generalModeContext = useMemo((): BookChatContext => {
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
  }, [books, relatedBooks]);

  // --- Memoized book chat context ---
  const activeBookId = activeBook?.id;
  const activeBookContext = useMemo((): BookChatContext | null => {
    if (!activeBook) return null;
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
    const ins: BookChatContext['insights'] = {};
    const authorFacts = activeBook.author_facts;
    if (authorFacts?.length) ins.authorFacts = authorFacts;
    const influences = bookInfluences.get(activeBook.id);
    if (influences?.length) ins.influences = influences;
    const domain = bookDomain.get(activeBook.id);
    if (domain) ins.domain = domain;
    const context = bookContext.get(activeBook.id);
    if (context?.length) ins.context = context;
    const dyk = didYouKnow.get(activeBook.id);
    if (dyk?.length) ins.didYouKnow = dyk;
    if (Object.keys(ins).length) ctx.insights = ins;
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
  }, [activeBookId, activeBook?.title, activeBook?.author, activeBook?.genre, activeBook?.publish_year, activeBook?.summary, activeBook?.reading_status, activeBook?.notes, activeBook?.ratings, activeBook?.author_facts, bookInfluences, bookDomain, bookContext, didYouKnow, combinedPodcastEpisodes, youtubeVideos, analysisArticles, relatedBooks, relatedMovies, discussionQuestions]);

  // --- Render ---
  return (
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
              if (user) {
                const { setCache, CACHE_KEYS } = await import('../services/cache-service');
                setCache(CACHE_KEYS.chatList(user.id), list);
              }
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
          bookContext={generalModeContext}
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
          bookContext={activeBookContext!}
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
          <div ref={chatPullIndicatorRef} className="absolute left-0 right-0 flex justify-center z-50 pointer-events-none" style={{ top: '60px', display: (chatRefreshing || chatRefreshDone || chatRefreshFading) ? '' : 'none' }}>
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
            {/* Book picker for new chat -- hidden for now */}
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
                  {/* My Bookshelf -- general chat */}
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
                  {/* All chats -- single sorted list */}
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
                                      // If avatar is missing, generate one in the background
                                      let avatarUrl = item.avatarUrl;
                                      if (!avatarUrl) {
                                        generateSingleCharacterAvatar(item.character_name!, item.book_title!, item.book_author!)
                                          .then(url => {
                                            if (url) {
                                              // Update the chat list so it appears on next render
                                              setCharacterChatList(prev => prev.map(c =>
                                                c.character_name === item.character_name && c.book_title === item.book_title
                                                  ? { ...c, avatar_url: url }
                                                  : c
                                              ));
                                            }
                                          })
                                          .catch(err => console.warn('[ChatList] Background avatar generation failed:', err));
                                      }
                                      setCharacterChatContext({
                                        characterName: item.character_name!,
                                        bookTitle: item.book_title!,
                                        bookAuthor: item.book_author!,
                                        context,
                                        avatarUrl,
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
                                    // Orphaned chat -- book was deleted, construct lightweight book object
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

                  {/* Placeholder chats -- books you're reading but haven't chatted about */}
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
  );
}
