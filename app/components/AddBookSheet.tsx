'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, User, Library, MessageSquareHeart, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { featureFlags } from '@/lib/feature-flags';
import { isHebrew, getAssetPath } from './utils';
import { isAndroid } from '@/lib/capacitor';

interface PodcastEpisode {
  title: string;
  length?: string;
  air_date?: string;
  url: string;
  audioUrl?: string; // Direct audio URL for playback (from Apple Podcasts episodeUrl)
  platform: string;
  podcast_name?: string; // Name of the podcast show
  episode_summary: string;
  podcast_summary: string;
  thumbnail?: string; // Episode or show thumbnail image URL
}

type ReadingStatus = 'read_it' | 'reading' | 'want_to_read' | null;

interface Book {
  id: string;
  user_id: string;
  canonical_book_id?: string; // Normalized identifier for deduplication
  title: string;
  author: string;
  publish_year?: number | null;
  first_issue_year?: number | null;
  genre?: string | null;
  isbn?: string | null;
  cover_url?: string | null;
  wikipedia_url?: string | null;
  google_books_url?: string | null;
  summary?: string | null; // Book synopsis/summary from Apple Books or Wikipedia
  rating_writing?: number | null;
  rating_insights?: number | null;
  rating_flow?: number | null;
  rating_world?: number | null;
  rating_characters?: number | null;
  reading_status?: ReadingStatus; // Reading status: 'read_it', 'reading', 'want_to_read', or null
  author_facts?: string[] | null; // JSON array of author facts
  podcast_episodes?: PodcastEpisode[] | null; // JSON array of podcast episodes (deprecated - use source-specific columns)
  podcast_episodes_grok?: PodcastEpisode[] | null; // JSON array of podcast episodes from Grok
  podcast_episodes_apple?: PodcastEpisode[] | null; // JSON array of podcast episodes from Apple Podcasts
  podcast_episodes_curated?: PodcastEpisode[] | null; // JSON array of podcast episodes from curated source
  notes?: string | null; // User notes for the book
  created_at: string;
  updated_at: string;
}

// Local app interface (for easier manipulation)
interface BookWithRatings extends Omit<Book, 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> {
  ratings: {
    writing: number | null;
    insights: number | null;
    flow: number | null;
    world: number | null;
    characters: number | null;
  };
  reading_status?: ReadingStatus; // Reading status
  author_facts?: string[]; // Fun facts about the author
  podcast_episodes?: PodcastEpisode[]; // Podcast episodes about the book (deprecated - use source-specific)
  podcast_episodes_grok?: PodcastEpisode[]; // Podcast episodes from Grok
  podcast_episodes_apple?: PodcastEpisode[]; // Podcast episodes from Apple Podcasts
  podcast_episodes_curated?: PodcastEpisode[]; // Podcast episodes from curated source
  notes?: string | null; // User notes for the book
}

interface AddBookSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) => void;
  books: BookWithRatings[];
  onSelectBook?: (bookId: string) => void;
  onSelectGeneral?: () => void;
  onSelectUser?: (userId: string) => void;
  onSearchAppleBooks: (query: string) => Promise<(Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>)[]>;
  onSearchWikipedia: (query: string) => Promise<(Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>)[]>;
  onGetAISuggestions: (query: string) => Promise<string[]>;
  mode?: 'default' | 'chat_picker';
  characterAvatars?: Map<string, { character: string; image_url: string }[]>;
  characterChatList?: { character_name: string; book_title: string; book_author: string; avatar_url?: string }[];
  onSelectCharacter?: (bookId: string, characterName: string, avatarUrl: string) => void;
}

interface UserSearchResult {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  book_count?: number;
}

interface DBBookSearchResult {
  id: string;
  title: string;
  author: string;
  cover_url?: string | null;
  publish_year?: number | null;
  wikipedia_url?: string | null;
  google_books_url?: string | null;
  genre?: string | null;
  first_issue_year?: number | null;
  summary?: string | null;
  user_id: string;
  user_name?: string | null;
  user_avatar?: string | null;
}

function AddBookSheet({ isOpen, onClose, onAdd, books, onSelectBook, onSelectGeneral, onSelectUser, onSearchAppleBooks, onSearchWikipedia, onGetAISuggestions, mode = 'default', characterAvatars, characterChatList, onSelectCharacter }: AddBookSheetProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // AI suggestions disabled for now
  // const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<(Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> & { source?: 'apple_books' | 'wikipedia' })[]>([]);
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [dbBookResults, setDbBookResults] = useState<DBBookSearchResult[]>([]);
  const [bookshelfResults, setBookshelfResults] = useState<BookWithRatings[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const externalSearchFiredRef = useRef(false);

  // Filter bookshelf as user types (in chat_picker mode, show all books when query is empty)
  useEffect(() => {
    if (query.trim()) {
      const lowerQuery = query.toLowerCase().trim();
      const filtered = books.filter(book => {
        if (book.title.toLowerCase().includes(lowerQuery) || book.author.toLowerCase().includes(lowerQuery)) return true;
        // In chat_picker mode, also match character names with active chats
        if (mode === 'chat_picker' && characterChatList) {
          const normalTitle = book.title.toLowerCase().trim();
          const normalAuthor = book.author.toLowerCase().trim();
          if (characterChatList.some(c => c.book_title.toLowerCase().trim() === normalTitle && c.book_author.toLowerCase().trim() === normalAuthor && c.character_name.toLowerCase().includes(lowerQuery))) return true;
        }
        return false;
      });
      setBookshelfResults(filtered);
    } else if (mode === 'chat_picker') {
      setBookshelfResults(books);
    } else {
      setBookshelfResults([]);
    }
  }, [query, books, mode, characterAvatars]);

  // Unified debounced search: community books + users at 200ms, then Apple Books + Wikipedia at 300ms
  useEffect(() => {
    // Cancel any in-flight search
    searchAbortRef.current?.abort();
    externalSearchFiredRef.current = false;

    if (query.trim().length <= 2) {
      setUserResults([]);
      setDbBookResults([]);
      setSearchResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;

    // Phase 1: Community books + users (200ms)
    const fastTimer = setTimeout(async () => {
      if (controller.signal.aborted) return;
      const [dbBooks, users] = await Promise.all([
        searchBooksFromDB(query, controller.signal).catch(() => []),
        searchUsers(query, controller.signal).catch(() => []),
      ]);
      if (controller.signal.aborted) return;
      setDbBookResults(dbBooks);
      setUserResults(users);
    }, 200);

    // Phase 2: Apple Books + Wikipedia (300ms) — trickles in after community results
    const slowTimer = setTimeout(async () => {
      if (controller.signal.aborted || mode === 'chat_picker') return;
      externalSearchFiredRef.current = true;
      setLoading(true);
      try {
        const appleResults = await onSearchAppleBooks(query).then(results =>
          results.slice(0, 7).map(book => ({ ...book, source: 'apple_books' as const }))
        ).catch(() => []);
        if (controller.signal.aborted) return;
        if (appleResults.length > 0) setSearchResults(appleResults);

        const wikiResults = await onSearchWikipedia(query).then(results =>
          results.slice(0, 7).map(book => ({ ...book, source: 'wikipedia' as const }))
        ).catch(() => []);
        if (controller.signal.aborted) return;
        if (wikiResults.length > 0) {
          setSearchResults(prev => [...prev, ...wikiResults]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(fastTimer);
      clearTimeout(slowTimer);
      controller.abort();
    };
  }, [query, user]);

  // Search for users by querying users table
  async function searchUsers(searchQuery: string, signal?: AbortSignal) {
    if (!searchQuery.trim() || !user) return [];

    try {
      const lowerQuery = searchQuery.toLowerCase();

      // Query users table - search by email or full_name
      const query_builder = supabase
        .from('users')
        .select('id, email, full_name, avatar_url')
        .neq('id', user.id) // Exclude current user
        .or(`email.ilike.%${lowerQuery}%,full_name.ilike.%${lowerQuery}%`)
        .limit(10);
      if (signal) query_builder.abortSignal(signal);
      const { data: usersData, error } = await query_builder;

      if (error) {
        if (error.message?.includes('AbortError') || error.message?.includes('aborted')) return [];
        console.error('Error searching users:', error.message, error.code, error.details, error.hint);
        return [];
      }

      if (!usersData || usersData.length === 0) {
        return [];
      }

      // For each user, count their books
      const userResults: UserSearchResult[] = [];

      for (const userData of usersData) {
        // Count books for this user
        const { count } = await supabase
          .from('books')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userData.id);

        userResults.push({
          id: userData.id,
          email: userData.email || userData.id,
          full_name: userData.full_name,
          avatar_url: userData.avatar_url,
          book_count: count || 0,
        });
      }

      return userResults;
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return [];
      console.error('Error searching users:', err);
      return [];
    }
  }

  // Search for books in database using trigram indexes
  async function searchBooksFromDB(searchQuery: string, signal?: AbortSignal): Promise<DBBookSearchResult[]> {
    if (!searchQuery.trim() || !user) return [];

    try {
      const lowerQuery = searchQuery.toLowerCase();

      // Query books table - search by title or author using trigram-indexed ilike
      const books_query = supabase
        .from('books')
        .select('id, title, author, cover_url, publish_year, wikipedia_url, google_books_url, genre, first_issue_year, summary, user_id')
        .neq('user_id', user.id) // Exclude current user's books
        .or(`title.ilike.%${lowerQuery}%,author.ilike.%${lowerQuery}%`)
        .limit(10);
      if (signal) books_query.abortSignal(signal);
      const { data: booksData, error } = await books_query;

      if (error) {
        if (error.message?.includes('AbortError') || error.message?.includes('aborted')) return [];
        console.error('Error searching books:', error.message, error.code, error.details, error.hint);
        return [];
      }

      if (!booksData || booksData.length === 0) {
        return [];
      }

      // Get unique user IDs to fetch user info
      const userIds = [...new Set(booksData.map(b => b.user_id))];

      // Fetch user info for all book owners
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const userMap = new Map(usersData?.map(u => [u.id, u]) || []);

      // Deduplicate by title+author, preferring entries with cover images
      const seen = new Map<string, typeof booksData[0]>();
      for (const book of booksData) {
        const key = `${book.title.toLowerCase().trim()}::${book.author.toLowerCase().trim()}`;
        const existing = seen.get(key);
        if (!existing || (!existing.cover_url && book.cover_url)) {
          seen.set(key, book);
        }
      }
      const dedupedBooks = Array.from(seen.values());

      // Map books with user info
      return dedupedBooks.map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
        publish_year: book.publish_year,
        wikipedia_url: book.wikipedia_url,
        google_books_url: book.google_books_url,
        genre: book.genre,
        first_issue_year: book.first_issue_year,
        summary: book.summary,
        user_id: book.user_id,
        user_name: userMap.get(book.user_id)?.full_name || null,
        user_avatar: userMap.get(book.user_id)?.avatar_url || null,
      }));
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return [];
      console.error('Error searching books:', err);
      return [];
    }
  }

  // Immediate search (fired on Enter) — cancels debounce and fires external APIs now
  async function handleSearch(titleToSearch = query) {
    if (!titleToSearch.trim()) {
      setUserResults([]);
      setDbBookResults([]);
      setSearchResults([]);
      return;
    }

    // Cancel any pending debounce
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    externalSearchFiredRef.current = true;

    setLoading(true);
    setError('');
    setSearchResults([]);

    try {
      // Fire all searches in parallel
      const [dbBooks, users] = await Promise.all([
        searchBooksFromDB(titleToSearch, controller.signal).catch(() => []),
        searchUsers(titleToSearch, controller.signal).catch(() => []),
      ]);
      if (controller.signal.aborted) return;
      setDbBookResults(dbBooks);
      setUserResults(users);

      const appleResults = await onSearchAppleBooks(titleToSearch).then(results =>
        results.slice(0, 7).map(book => ({ ...book, source: 'apple_books' as const }))
      ).catch(() => []);
      if (controller.signal.aborted) return;
      if (appleResults.length > 0) setSearchResults(appleResults);

      const wikiResults = await onSearchWikipedia(titleToSearch).then(results =>
        results.slice(0, 7).map(book => ({ ...book, source: 'wikipedia' as const }))
      ).catch(() => []);
      if (controller.signal.aborted) return;
      if (wikiResults.length > 0) {
        setSearchResults(prev => [...prev, ...wikiResults]);
      }

      const combinedResults = [...appleResults, ...wikiResults];
      if (combinedResults.length === 0 && users.length === 0 && dbBooks.length === 0) {
        setError('No results found.');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError("Search failed. Please try a different title.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function handleSelectBook(book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> & { source?: 'apple_books' | 'wikipedia' }) {
    // Remove source property before adding to database
    const { source, ...bookWithoutSource } = book;
    onAdd(bookWithoutSource);
    setQuery('');
    setSearchResults([]);
    onClose();
  }

  // AI suggestions disabled for now
  // function handleSuggestionClick(s: string) {
  //   const bookTitle = s.split('/')[0].trim();
  //   setQuery(bookTitle);
  //   handleSearch(bookTitle);
  // }

  // Track keyboard height via Capacitor Keyboard plugin
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [sheetReady, setSheetReady] = useState(false);
  const isKeyboardVisible = keyboardHeight > 0;
  const isNative = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setSheetReady(false);
      setKeyboardHeight(0);
      searchAbortRef.current?.abort();
      return;
    }
    let didShowListener: any;
    let willHideListener: any;
    let viewportHandler: (() => void) | null = null;
    (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        isNative.current = true;
        didShowListener = await Keyboard.addListener('keyboardDidShow', (info) => {
          setKeyboardHeight(info.keyboardHeight);
          setSheetReady(true);
        });
        willHideListener = await Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardHeight(0);
        });
        if (mode === 'chat_picker') {
          // In chat_picker mode, show sheet immediately without keyboard
          setSheetReady(true);
        } else {
          // Focus immediately to trigger keyboard while sheet is off-screen
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      } catch {
        // Not on native — fall back to visualViewport
        isNative.current = false;
        viewportHandler = () => {
          if (window.visualViewport) {
            const heightDiff = window.innerHeight - window.visualViewport.height;
            setKeyboardHeight(heightDiff > 150 ? heightDiff : 0);
          }
        };
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', viewportHandler);
          viewportHandler();
        }
        // On web, show sheet immediately
        setSheetReady(true);
        setTimeout(() => inputRef.current?.focus(), 300);
      }
    })();
    return () => {
      didShowListener?.remove();
      willHideListener?.remove();
      if (viewportHandler && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', viewportHandler);
      }
    };
  }, [isOpen]);

  // Scroll results to top when they appear
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((searchResults.length > 0 || bookshelfResults.length > 0) && resultsContainerRef.current) {
      resultsContainerRef.current.scrollTop = 0;
    }
  }, [searchResults.length, bookshelfResults.length]);

  const isQueryHebrew = isHebrew(query);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-end bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
      style={{
        paddingBottom: isKeyboardVisible && !isAndroid ? `${Math.max(keyboardHeight - 20, 0)}px` : '0px',
      }}
    >
      {/* NEW CHAT title above the sheet */}
      {mode === 'chat_picker' && (
        <>
          {/* Close button fixed at header Plus button position */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: sheetReady ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="fixed z-[60] w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ top: 'calc(50px + 12px)', right: '16px', background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(8px)' }}
          >
            <X size={16} className="text-white" />
          </motion.button>
          {/* Title */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: sheetReady ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md text-center mb-3"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-sm font-bold tracking-widest text-white uppercase">Start a Chat About</span>
          </motion.div>
        </>
      )}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: sheetReady ? 1 : 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-white/80 dark:bg-white/15 dark:bg-slate-900/85 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30 dark:border-white/10 dark:border-white/10 flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight: 'calc(100% - 120px)',
          paddingBottom: isKeyboardVisible ? '20px' : '0px',
        }}
      >
        {/* Handle bar */}
        <div className="w-full flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-12 h-1 bg-slate-400 rounded-full" />
        </div>

        {/* Results area - scrollable, behind search box, starts at top */}
        <div
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto px-4 ios-scroll"
          style={{
            paddingTop: '12px',
            paddingBottom: '120px', // Space for search box at bottom
          }}
        >
          <div className="space-y-4">
            {/* Bookshelf Results - Show first as user types */}
            <AnimatePresence>
              {bookshelfResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 mb-4"
                >
                  {mode !== 'chat_picker' && (
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Your bookshelf:
                    </div>
                  )}
                  {/* "Books in General" option - only in chat_picker mode */}
                  {mode === 'chat_picker' && onSelectGeneral && (
                    <motion.button
                      key="general-chat"
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => {
                        onSelectGeneral();
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left active:opacity-80"
                      style={{ border: '1px solid rgba(0, 0, 0, 0.08)', background: 'rgba(255, 255, 255, 0.55)' }}
                    >
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
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-slate-800">Books in General</p>
                        <p className="text-[13px] text-slate-500">Chat about your whole collection</p>
                      </div>
                      <MessageSquareHeart size={16} className="text-slate-400 shrink-0" />
                    </motion.button>
                  )}
                  {(mode === 'chat_picker' ? (() => {
                    const statusOrder: Record<string, number> = { reading: 0, want_to_read: 1, read_it: 2 };
                    const sorted = [...bookshelfResults].sort((a, b) => {
                      const aOrder = statusOrder[a.reading_status || ''] ?? 3;
                      const bOrder = statusOrder[b.reading_status || ''] ?? 3;
                      if (aOrder !== bOrder) return aOrder - bOrder;
                      return a.title.localeCompare(b.title);
                    });
                    // Build flat list: book chat row + character chat rows per book
                    // Only show characters with active chats (context already generated)
                    const rows: Array<{ type: 'book'; book: BookWithRatings; index: number } | { type: 'character'; book: BookWithRatings; character: string; avatarUrl: string; index: number }> = [];
                    let idx = 0;
                    for (const book of sorted) {
                      rows.push({ type: 'book', book, index: idx++ });
                      if (characterChatList) {
                        const normalTitle = book.title.toLowerCase().trim();
                        const normalAuthor = book.author.toLowerCase().trim();
                        const seen = new Set<string>();
                        for (const chat of characterChatList) {
                          if (chat.book_title.toLowerCase().trim() === normalTitle && chat.book_author.toLowerCase().trim() === normalAuthor && !seen.has(chat.character_name)) {
                            seen.add(chat.character_name);
                            // Prefer avatar from characterAvatars if available (higher quality)
                            const loadedAvatar = characterAvatars?.get(book.id)?.find(a => a.character === chat.character_name);
                            rows.push({ type: 'character', book, character: chat.character_name, avatarUrl: loadedAvatar?.image_url || chat.avatar_url || '', index: idx++ });
                          }
                        }
                      }
                    }
                    return rows;
                  })() : bookshelfResults.slice(0, 5).map((book, i) => ({ type: 'book' as const, book, index: i }))).map((item) =>
                    item.type === 'character' ? (
                    <motion.button
                      key={`char-${item.book.id}-${item.character}`}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: item.index * 0.03 }}
                      onClick={() => {
                        if (onSelectCharacter) {
                          onSelectCharacter(item.book.id, item.character, item.avatarUrl);
                        }
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left active:opacity-80"
                      style={{ border: '1px solid rgba(0, 0, 0, 0.05)', background: 'rgba(255, 255, 255, 0.55)' }}
                    >
                      <div className="relative w-12 h-12 shrink-0">
                        {item.book.cover_url ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden absolute top-1 left-0 bg-slate-200">
                            <img src={item.book.cover_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center absolute top-1 left-0">
                            <BookOpen size={14} className="text-white/60" />
                          </div>
                        )}
                        <div className="w-9 h-9 rounded-full overflow-hidden absolute bottom-0 right-0 bg-slate-200" style={{ border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                          {item.avatarUrl ? (
                            <img src={item.avatarUrl} alt={item.character} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">{item.character?.[0] || '?'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-slate-800 truncate">{item.character}</p>
                        <p className="text-[13px] text-slate-500 truncate">from {item.book.title}</p>
                      </div>
                      <MessageSquareHeart size={16} className="text-slate-400 shrink-0" />
                    </motion.button>
                    ) : (
                    <motion.button
                      key={`bookshelf-${item.book.id || `book-${item.index}`}`}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: item.index * 0.03 }}
                      onClick={() => {
                        if (onSelectBook) {
                          onSelectBook(item.book.id);
                        }
                        onClose();
                      }}
                      className={mode === 'chat_picker'
                        ? "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left active:opacity-80"
                        : "w-full flex items-center gap-3 p-3 bg-blue-50/80 backdrop-blur-md hover:bg-blue-100/85 rounded-xl border border-blue-200/30 shadow-sm transition-all text-left"
                      }
                      style={mode === 'chat_picker' ? { border: '1px solid rgba(0, 0, 0, 0.08)', background: 'rgba(255, 255, 255, 0.55)' } : undefined}
                    >
                      {mode === 'chat_picker' ? (
                        <div className="relative w-12 h-12 shrink-0">
                          {item.book.cover_url ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden absolute top-1 left-0 bg-slate-200">
                              <img src={item.book.cover_url} alt={item.book.title} className="w-full h-full object-cover" />
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
                      ) : item.book.cover_url ? (
                        <img src={item.book.cover_url} alt={item.book.title} className="w-12 h-16 object-cover rounded flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-16 bg-blue-100 rounded flex-shrink-0 flex items-center justify-center">
                          <BookOpen size={20} className="text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {mode === 'chat_picker' ? (
                          <>
                            <p className="text-[15px] font-semibold text-slate-800 truncate">{item.book.title}</p>
                            <p className="text-[13px] text-slate-500 truncate">{item.book.author}</p>
                          </>
                        ) : (
                          <>
                            <h3 className="text-sm font-bold text-slate-950 truncate">{item.book.title}</h3>
                            <p className="text-xs text-slate-800 truncate">{item.book.author}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {item.book.publish_year && (
                                <p className="text-[10px] text-slate-600">{item.book.publish_year}</p>
                              )}
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-blue-700 bg-blue-100">Your Book</span>
                            </div>
                          </>
                        )}
                      </div>
                      {mode === 'chat_picker' && <MessageSquareHeart size={16} className="text-slate-400 shrink-0" />}
                    </motion.button>
                  ))}
                </motion.div>
            )}
            </AnimatePresence>

            {/* User Results - hidden in chat_picker mode */}
            <AnimatePresence>
              {mode !== 'chat_picker' && userResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 mb-4"
                >
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Users:
                  </div>
                  {userResults.map((userResult, i) => (
                    <motion.button
                      key={`user-${userResult.id || `user-${i}`}`}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        if (onSelectUser) {
                          onSelectUser(userResult.id);
                        }
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-purple-50/80 backdrop-blur-md hover:bg-purple-100/85 rounded-xl border border-purple-200/30 shadow-sm transition-all text-left"
                    >
                      {userResult.avatar_url ? (
                        <img
                          src={userResult.avatar_url}
                          alt={userResult.full_name || userResult.email}
                          className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-purple-200/50"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-200 flex-shrink-0 flex items-center justify-center">
                          <User size={20} className="text-purple-700" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 dark:text-slate-50 truncate">
                          {userResult.full_name || userResult.email}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{userResult.book_count || 0} {userResult.book_count === 1 ? 'book' : 'books'}</p>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Database Book Results - hidden in chat_picker mode */}
            <AnimatePresence>
              {mode !== 'chat_picker' && dbBookResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 mb-4"
                >
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    From Community:
                  </div>
                  {dbBookResults.map((book, i) => (
                    <motion.button
                      key={`db-book-${book.id}`}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        // Add book to user's bookshelf
                        onAdd({
                          title: book.title,
                          author: book.author,
                          publish_year: book.publish_year || null,
                          cover_url: book.cover_url || null,
                          wikipedia_url: book.wikipedia_url || null,
                          google_books_url: book.google_books_url || null,
                          genre: book.genre || null,
                          first_issue_year: book.first_issue_year || null,
                          summary: book.summary || null,
                          notes: null,
                          reading_status: null,
                        });
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-emerald-50/80 backdrop-blur-md hover:bg-emerald-100/85 rounded-xl border border-emerald-200/30 shadow-sm transition-all text-left"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-emerald-100 rounded flex-shrink-0 flex items-center justify-center">
                          <BookOpen size={20} className="text-emerald-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 dark:text-slate-50 truncate">{book.title}</h3>
                        <p className="text-xs text-slate-800 dark:text-slate-200 truncate">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {book.publish_year && (
                            <p className="text-[10px] text-slate-600 dark:text-slate-400">{book.publish_year}</p>
                          )}
                          {book.user_name && (
                            <>
                              {book.publish_year && <span className="text-slate-400">&bull;</span>}
                              <div className="flex items-center gap-1">
                                {book.user_avatar ? (
                                  <img
                                    src={book.user_avatar}
                                    alt={book.user_name}
                                    className="w-4 h-4 rounded-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center">
                                    <User size={8} className="text-emerald-700" />
                                  </div>
                                )}
                                <span className="text-[10px] text-emerald-700 truncate max-w-[80px]">{book.user_name}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search Results - hidden in chat_picker mode */}
            <AnimatePresence>
              {mode !== 'chat_picker' && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {bookshelfResults.length > 0 || userResults.length > 0 || dbBookResults.length > 0 ? 'Books:' : 'Select a book to add:'}
                  </div>
                  {searchResults.map((book, i) => (
                    <motion.button
                      key={`search-book-${i}-${book.title || ''}-${book.author || ''}`}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleSelectBook(book)}
                      className="w-full flex items-center gap-3 p-3 bg-white/80 dark:bg-white/15 backdrop-blur-md hover:bg-white/85 rounded-xl border border-white/30 dark:border-white/10 shadow-sm transition-all text-left"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-slate-100 dark:bg-slate-800 rounded flex-shrink-0 flex items-center justify-center">
                          <BookOpen size={20} className="text-slate-600 dark:text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 dark:text-slate-50 truncate">{book.title}</h3>
                        <p className="text-xs text-slate-800 dark:text-slate-200 truncate">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                        {book.publish_year && (
                            <p className="text-[10px] text-slate-600 dark:text-slate-400">{book.publish_year}</p>
                          )}
                          {book.source && (
                            <>
                              {book.publish_year && <span className="text-slate-400">&bull;</span>}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                book.source === 'apple_books'
                                  ? 'text-blue-700 bg-blue-100'
                                  : 'text-purple-700 bg-purple-100'
                              }`}>
                                {book.source === 'apple_books' ? 'Apple Books' : 'Wikipedia'}
                        </span>
                            </>
                      )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI suggestions disabled for now */}

            {/* Error message */}
            {error && (
              <p className="text-red-500 text-sm text-center font-medium">{error}</p>
            )}
          </div>
        </div>

        {/* Search input - sticky at bottom, right above keyboard, overlays results */}
        <div
          className="sticky bottom-0 left-0 right-0 z-30 px-3 pb-3 pt-2"
          style={{
            paddingBottom: isKeyboardVisible
              ? '12px'
              : 'calc(12px + env(safe-area-inset-bottom, 0px))',
            marginTop: '-120px' // Overlap with results area
          }}
        >
          <div className="bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 rounded-full px-1.5 py-1.5 shadow-2xl border border-white/30 dark:border-white/10">
            <form onSubmit={(e) => { e.preventDefault(); inputRef.current?.blur(); if (mode !== 'chat_picker') handleSearch(); }}>
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="search"
                  placeholder={isQueryHebrew ? "\u05D7\u05E4\u05E9 \u05E1\u05E4\u05E8..." : mode === 'chat_picker' ? "Search books or characters..." : "Search for book, author, user..."}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className={`w-full h-11 bg-white/20 dark:bg-white/8 border border-white/30 dark:border-white/10 rounded-full focus:outline-none focus:bg-white/30 text-base transition-all text-slate-950 dark:text-slate-50 placeholder:text-slate-600 dark:text-slate-400 ${isQueryHebrew ? 'text-right pr-12 pl-4' : 'pl-12 pr-4'}`}
                  dir={isQueryHebrew ? "rtl" : "ltr"}
                />
                <button
                  type="submit"
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 active:scale-95 transition-all cursor-pointer ${isQueryHebrew ? 'right-4' : 'left-4'}`}
                  aria-label="Search"
                >
                  {featureFlags.hand_drawn_icons ? (
                    <img src={getAssetPath("/search.svg")} alt="Search" className="w-[18px] h-[18px]" />
                  ) : (
                    <Search size={18} className="text-slate-600 dark:text-slate-400" />
                  )}
                </button>
              </div>
          </form>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default AddBookSheet;
