'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, User, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { featureFlags } from '@/lib/feature-flags';
import { isHebrew, getAssetPath } from './utils';

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
  onSelectUser?: (userId: string) => void;
  onSearchAppleBooks: (query: string) => Promise<(Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>)[]>;
  onSearchWikipedia: (query: string) => Promise<(Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>)[]>;
  onGetAISuggestions: (query: string) => Promise<string[]>;
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

function AddBookSheet({ isOpen, onClose, onAdd, books, onSelectBook, onSelectUser, onSearchAppleBooks, onSearchWikipedia, onGetAISuggestions }: AddBookSheetProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<(Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> & { source?: 'apple_books' | 'wikipedia' })[]>([]);
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [dbBookResults, setDbBookResults] = useState<DBBookSearchResult[]>([]);
  const [bookshelfResults, setBookshelfResults] = useState<BookWithRatings[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter bookshelf as user types
  useEffect(() => {
    if (query.trim()) {
      const lowerQuery = query.toLowerCase().trim();
      const filtered = books.filter(book =>
        book.title.toLowerCase().includes(lowerQuery) ||
        book.author.toLowerCase().includes(lowerQuery)
      );
      setBookshelfResults(filtered);
    } else {
      setBookshelfResults([]);
    }
  }, [query, books]);

  // Debounced user search as user types
  useEffect(() => {
    if (query.trim().length <= 2) {
      setUserResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const users = await searchUsers(query);
      setUserResults(users);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query, user]);

  // Debounced book search from database as user types
  useEffect(() => {
    if (query.trim().length <= 2) {
      setDbBookResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const dbBooks = await searchBooksFromDB(query);
      setDbBookResults(dbBooks);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query, user]);

  // Search for users by querying users table
  async function searchUsers(searchQuery: string) {
    if (!searchQuery.trim() || !user) return [];

    try {
      const lowerQuery = searchQuery.toLowerCase();

      // Query users table - search by email or full_name
      const { data: usersData, error } = await supabase
        .from('users')
        .select('id, email, full_name, avatar_url')
        .neq('id', user.id) // Exclude current user
        .or(`email.ilike.%${lowerQuery}%,full_name.ilike.%${lowerQuery}%`)
        .limit(10);

      if (error) {
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
    } catch (err) {
      console.error('Error searching users:', err);
      return [];
    }
  }

  // Search for books in database using trigram indexes
  async function searchBooksFromDB(searchQuery: string): Promise<DBBookSearchResult[]> {
    if (!searchQuery.trim() || !user) return [];

    try {
      const lowerQuery = searchQuery.toLowerCase();

      // Query books table - search by title or author using trigram-indexed ilike
      const { data: booksData, error } = await supabase
        .from('books')
        .select('id, title, author, cover_url, publish_year, wikipedia_url, google_books_url, genre, first_issue_year, summary, user_id')
        .neq('user_id', user.id) // Exclude current user's books
        .or(`title.ilike.%${lowerQuery}%,author.ilike.%${lowerQuery}%`)
        .limit(10);

      if (error) {
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

      // Map books with user info
      return booksData.map(book => ({
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
    } catch (err) {
      console.error('Error searching books:', err);
      return [];
    }
  }

  async function handleSearch(titleToSearch = query) {
    if (!titleToSearch.trim()) {
      setUserResults([]);
      setDbBookResults([]);
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults([]);
    setSuggestions([]); // Clear suggestions first

    try {
      // Start both book searches simultaneously
      const applePromise = onSearchAppleBooks(titleToSearch).then(results =>
        results.slice(0, 7).map(book => ({ ...book, source: 'apple_books' as const }))
      ).catch(() => []);

      const wikiPromise = onSearchWikipedia(titleToSearch).then(results =>
        results.slice(0, 7).map(book => ({ ...book, source: 'wikipedia' as const }))
      ).catch(() => []);

      // Show Apple Books results as soon as they return
      const appleResults = await applePromise;
      if (appleResults.length > 0) {
        setSearchResults(appleResults);
        setSuggestions([]);
      }

      // Wait for Wikipedia results and append them
      const wikiResults = await wikiPromise;
      if (wikiResults.length > 0) {
        // Append Wikipedia results to existing Apple Books results
        setSearchResults(prev => [...prev, ...wikiResults]);
      }

      // Check if we have any results after both complete
      const combinedResults = [...appleResults, ...wikiResults];
      if (combinedResults.length === 0 && userResults.length === 0 && dbBookResults.length === 0) {
        setError(`No results found.`);

        // Fetch AI suggestions only when no results
        try {
          const aiSuggestions = await onGetAISuggestions(titleToSearch);
      setSuggestions(aiSuggestions);
        } catch (aiErr) {
          console.error('Error fetching AI suggestions:', aiErr);
          // Don't set error for AI suggestions failure, just leave suggestions empty
        }
      }
    } catch (err) {
      setError("Search failed. Please try a different title.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectBook(book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> & { source?: 'apple_books' | 'wikipedia' }) {
    // Remove source property before adding to database
    const { source, ...bookWithoutSource } = book;
    onAdd(bookWithoutSource);
    setQuery('');
    setSuggestions([]);
    setSearchResults([]);
    onClose();
  }

  function handleSuggestionClick(s: string) {
    // Extract just the book title (before the slash) for searching
    const bookTitle = s.split('/')[0].trim();
    setQuery(bookTitle);
    handleSearch(bookTitle);
  }

  // Track keyboard visibility
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Monitor viewport changes to detect keyboard
  useEffect(() => {
    if (!isOpen) return;

    const handleViewportChange = () => {
            if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const heightDiff = windowHeight - viewportHeight;

        if (heightDiff > 150) {
          setIsKeyboardVisible(true);
          setKeyboardHeight(heightDiff);
        } else {
          setIsKeyboardVisible(false);
          setKeyboardHeight(0);
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      handleViewportChange();
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
    };
  }, [isOpen]);

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
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
        paddingBottom: '0px'
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300, duration: 0.4 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30 flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight: isKeyboardVisible && window.visualViewport
            ? `${window.visualViewport.height - 40}px`
            : '90vh'
        }}
      >
        {/* Handle bar */}
        <div className="w-full flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-12 h-1 bg-slate-400 rounded-full" />
        </div>

        {/* Results area - scrollable, behind search box, starts at top */}
        <div
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto px-4 ios-scroll"
          style={{
            paddingBottom: '120px', // Space for search box at bottom
            maxHeight: isKeyboardVisible && window.visualViewport
              ? `${window.visualViewport.height - (window.visualViewport.offsetTop || 0) - 200}px` // Account for keyboard and search box
              : 'calc(100vh - 250px)' // Default: account for header, handle bar, and search box
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
                  <div className="text-xs font-medium text-slate-700 mb-2">
                    Your bookshelf:
            </div>
                  {bookshelfResults.slice(0, 5).map((book, i) => (
                    <motion.button
                      key={`bookshelf-${book.id || `book-${i}`}`}
                type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                onClick={() => {
                        if (onSelectBook) {
                          onSelectBook(book.id);
                        }
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-blue-50/80 backdrop-blur-md hover:bg-blue-100/85 rounded-xl border border-blue-200/30 shadow-sm transition-all text-left"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-blue-100 rounded flex-shrink-0 flex items-center justify-center">
                          <BookOpen size={20} className="text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 truncate">{book.title}</h3>
                        <p className="text-xs text-slate-800 truncate">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {book.publish_year && (
                            <p className="text-[10px] text-slate-600">{book.publish_year}</p>
                          )}
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-blue-700 bg-blue-100">
                            Your Book
                </span>
            </div>
              </div>
                    </motion.button>
                  ))}
                </motion.div>
            )}
            </AnimatePresence>

            {/* User Results */}
            <AnimatePresence>
              {userResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 mb-4"
                >
                  <div className="text-xs font-medium text-slate-700 mb-2">
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
                        <h3 className="text-sm font-bold text-slate-950 truncate">
                          {userResult.full_name || userResult.email}
                        </h3>
                        <p className="text-xs text-slate-600">{userResult.book_count || 0} {userResult.book_count === 1 ? 'book' : 'books'}</p>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Database Book Results - Books from other users */}
            <AnimatePresence>
              {dbBookResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 mb-4"
                >
                  <div className="text-xs font-medium text-slate-700 mb-2">
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
                        <h3 className="text-sm font-bold text-slate-950 truncate">{book.title}</h3>
                        <p className="text-xs text-slate-800 truncate">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {book.publish_year && (
                            <p className="text-[10px] text-slate-600">{book.publish_year}</p>
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

            {/* Search Results */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <div className="text-xs font-medium text-slate-700 mb-2">
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
                      className="w-full flex items-center gap-3 p-3 bg-white/80 backdrop-blur-md hover:bg-white/85 rounded-xl border border-white/30 shadow-sm transition-all text-left"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-slate-100 rounded flex-shrink-0 flex items-center justify-center">
                          <BookOpen size={20} className="text-slate-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 truncate">{book.title}</h3>
                        <p className="text-xs text-slate-800 truncate">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                        {book.publish_year && (
                            <p className="text-[10px] text-slate-600">{book.publish_year}</p>
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

            {/* Suggestions - only show if no search results */}
            <AnimatePresence>
              {suggestions.length > 0 && searchResults.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-wrap gap-2"
                >
                  <div className="w-full text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-400" />
                    <span>Did you mean?</span>
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSuggestionClick(s)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors border border-blue-100"
                    >
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

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
              ? `${Math.max(12, keyboardHeight > 0 ? 16 : 12)}px`
              : 'calc(12px + env(safe-area-inset-bottom, 0px))',
            marginTop: '-120px' // Overlap with results area
          }}
        >
          <div className="bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 rounded-full px-1.5 py-1.5 shadow-2xl border border-white/30">
            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="search"
                  placeholder={isQueryHebrew ? "\u05D7\u05E4\u05E9 \u05E1\u05E4\u05E8..." : "Search for book, author, user..."}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className={`w-full h-11 bg-white/20 border border-white/30 rounded-full focus:outline-none focus:bg-white/30 text-base transition-all text-slate-950 placeholder:text-slate-600 ${isQueryHebrew ? 'text-right pr-12 pl-4' : 'pl-12 pr-4'}`}
                  dir={isQueryHebrew ? "rtl" : "ltr"}
                />
                <button
                  type="submit"
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800 active:scale-95 transition-all cursor-pointer ${isQueryHebrew ? 'right-4' : 'left-4'}`}
                  aria-label="Search"
                >
                  {featureFlags.hand_drawn_icons ? (
                    <img src={getAssetPath("/search.svg")} alt="Search" className="w-[18px] h-[18px]" />
                  ) : (
                    <Search size={18} className="text-slate-600" />
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
