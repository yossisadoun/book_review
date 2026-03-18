import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Lightbulb,
  Headphones,
  Play,
  ScrollText,
  Film,
  Tv,
  Music,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { featureFlags, type FeatureFlags } from '@/lib/feature-flags';
import type {
  PodcastEpisode,
  AnalysisArticle,
  YouTubeVideo,
  RelatedBook,
  RelatedMovie,
  BookResearch,
  DomainInsights,
  DidYouKnowItem,
  BookInfographic,
  BookWithRatings,
  BookSummary,
  CharacterAvatar,
} from '../types';
import { getAuthorFacts, getBookInfluences, getBookDomain, getBookContext, getDidYouKnow, getFirstIssueYear } from '../services/insights-service';
import { getPodcastEpisodes } from '../services/podcast-service';
import { getGoogleScholarAnalysis } from '../services/articles-service';
import { getYouTubeVideos } from '../services/youtube-service';
import { getRelatedBooks } from '../services/related-books-service';
import { getRelatedMovies } from '../services/related-movies-service';
import { getBookSummary } from '../services/book-summary-service';
import { getCharacterAvatars } from '../services/character-avatars-service';
import { generateFeedItemsForBook } from '../services/feed-service';
import { getSpoilerRevealedFromStorage, loadSpoilerRevealedFromStorage, saveSpoilerRevealedToStorage } from '../services/feed-service';
import { isNativePlatform } from '@/lib/capacitor';

interface UseBookDetailDataParams {
  activeBook: BookWithRatings | null;
  books: BookWithRatings[];
  selectedIndex: number;
  setBooks: React.Dispatch<React.SetStateAction<BookWithRatings[]>>;
  user: { id: string } | null;
  contentPreferences: Record<string, any>;
  featureFlags: FeatureFlags;
}

type BookRequestType =
  | 'podcasts'
  | 'articles'
  | 'videos'
  | 'related_books'
  | 'related_movies'
  | 'summary'
  | 'avatars'
  | 'influences'
  | 'domain'
  | 'context'
  | 'did_you_know';

export function useBookDetailData({
  activeBook,
  books,
  selectedIndex,
  setBooks,
  user,
  contentPreferences,
  featureFlags: _featureFlags, // accept but use imported featureFlags for consistency
}: UseBookDetailDataParams) {
  // --- State declarations ---
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
  const [selectedInsightCategory, setSelectedInsightCategory] = useState<string>('trivia');
  const [isInsightCategoryDropdownOpen, setIsInsightCategoryDropdownOpen] = useState(false);
  // Book summary state
  const [bookSummaries, setBookSummaries] = useState<Map<string, BookSummary>>(new Map());
  const [loadingSummaryForBookId, setLoadingSummaryForBookId] = useState<string | null>(null);
  // Character avatars state
  const [characterAvatars, setCharacterAvatars] = useState<Map<string, CharacterAvatar[]>>(new Map());
  const [loadingAvatarsForBookId, setLoadingAvatarsForBookId] = useState<string | null>(null);
  // Book infographic state
  const [bookInfographics, setBookInfographics] = useState<Map<string, BookInfographic>>(new Map());
  const [loadingInfographicForBookId, setLoadingInfographicForBookId] = useState<string | null>(null);

  // Spotlight state
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const lastSpotlightRef = useRef<{ item: { type: string; icon: LucideIcon; label: string; title: string; subtitle: string; url?: string; imageUrl?: string; itemIndex: number }; next: { type: string; icon: LucideIcon; label: string; title: string; subtitle: string; url?: string; imageUrl?: string; itemIndex: number } | null; total: number; bookId: string } | null>(null);

  // Spoiler revealed state
  const [spoilerRevealed, setSpoilerRevealed] = useState<Map<string, Set<string>>>(() => getSpoilerRevealedFromStorage());

  // --- Refs ---
  const loadingTimestamps = useRef<Map<string, number>>(new Map());
  const fetchingFactsForBooksRef = useRef<Set<string>>(new Set());
  const fetchingFirstIssueYearRef = useRef<Set<string>>(new Set());
  const fetchingInfluencesForBooksRef = useRef<Set<string>>(new Set());
  const fetchingDomainForBooksRef = useRef<Set<string>>(new Set());
  const fetchingContextForBooksRef = useRef<Set<string>>(new Set());
  const fetchingDidYouKnowForBooksRef = useRef<Set<string>>(new Set());
  const fetchingPodcastsForBooksRef = useRef<Set<string>>(new Set());
  const fetchingAnalysisForBooksRef = useRef<Set<string>>(new Set());
  const fetchingVideosForBooksRef = useRef<Set<string>>(new Set());
  const fetchingRelatedForBooksRef = useRef<Set<string>>(new Set());
  const fetchingRelatedMoviesRef = useRef<Set<string>>(new Set());
  const activeBookRequestsRef = useRef<Map<BookRequestType, { bookId: string; token: number }>>(new Map());
  const nextBookRequestTokenRef = useRef(1);
  const generatedFeedForBooksRef = useRef<Set<string>>(new Set());

  // --- Request token system ---
  const beginBookRequest = useCallback((requestType: BookRequestType, bookId: string): number => {
    const token = nextBookRequestTokenRef.current++;
    activeBookRequestsRef.current.set(requestType, { bookId, token });
    return token;
  }, []);

  const isActiveBookRequest = useCallback((requestType: BookRequestType, bookId: string, token: number): boolean => {
    const active = activeBookRequestsRef.current.get(requestType);
    return !!active && active.bookId === bookId && active.token === token;
  }, []);

  const clearBookRequest = useCallback((requestType: BookRequestType, bookId: string, token: number): void => {
    if (isActiveBookRequest(requestType, bookId, token)) {
      activeBookRequestsRef.current.delete(requestType);
    }
  }, [isActiveBookRequest]);

  // --- Effects ---

  // Safety net: auto-clear any loading state stuck longer than 30 seconds.
  useEffect(() => {
    const loadingStates = [
      { key: 'facts', value: loadingFactsForBookId, clear: setLoadingFactsForBookId },
      { key: 'influences', value: loadingInfluencesForBookId, clear: setLoadingInfluencesForBookId },
      { key: 'domain', value: loadingDomainForBookId, clear: setLoadingDomainForBookId },
      { key: 'context', value: loadingContextForBookId, clear: setLoadingContextForBookId },
      { key: 'didYouKnow', value: loadingDidYouKnowForBookId, clear: setLoadingDidYouKnowForBookId },
      { key: 'podcasts', value: loadingPodcastsForBookId, clear: setLoadingPodcastsForBookId },
      { key: 'analysis', value: loadingAnalysisForBookId, clear: setLoadingAnalysisForBookId },
      { key: 'videos', value: loadingVideosForBookId, clear: setLoadingVideosForBookId },
      { key: 'related', value: loadingRelatedForBookId, clear: setLoadingRelatedForBookId },
      { key: 'relatedMovies', value: loadingRelatedMoviesForBookId, clear: setLoadingRelatedMoviesForBookId },
      { key: 'summary', value: loadingSummaryForBookId, clear: setLoadingSummaryForBookId },
      { key: 'avatars', value: loadingAvatarsForBookId, clear: setLoadingAvatarsForBookId },
    ];
    // Track when each loading state started
    for (const { key, value } of loadingStates) {
      if (value) {
        if (!loadingTimestamps.current.has(key)) loadingTimestamps.current.set(key, Date.now());
      } else {
        loadingTimestamps.current.delete(key);
      }
    }
    const timer = setInterval(() => {
      const now = Date.now();
      for (const { key, value, clear } of loadingStates) {
        const started = loadingTimestamps.current.get(key);
        if (value && started && now - started > 30_000) {
          console.warn(`[LoadingTimeout] Clearing stuck loading state: ${key}`);
          loadingTimestamps.current.delete(key);
          clear(null);
        }
      }
    }, 2000);
    return () => clearInterval(timer);
  });

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

  // Fetch author facts for existing books when they're selected
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
    const requestToken = beginBookRequest('influences', bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      console.log(`[Book Influences] 🔄 Fetching influences for "${bookTitle}" by ${bookAuthor}...`);
      getBookInfluences(bookTitle, bookAuthor).then((influences) => {
        if (cancelled || !isActiveBookRequest('influences', bookId, requestToken)) {
          fetchingInfluencesForBooksRef.current.delete(bookId);
          return;
        }

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
        if (!cancelled && isActiveBookRequest('influences', bookId, requestToken)) {
          setLoadingInfluencesForBookId(null);
          console.error('Error fetching book influences:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingInfluencesForBooksRef.current.delete(bookId);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      fetchingInfluencesForBooksRef.current.delete(bookId);
      if (isActiveBookRequest('influences', bookId, requestToken)) {
        setLoadingInfluencesForBookId(null);
        clearBookRequest('influences', bookId, requestToken);
      }
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

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
    const requestToken = beginBookRequest('domain', bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      console.log(`[Book Domain] 🔄 Fetching domain insights for "${bookTitle}" by ${bookAuthor}...`);
      getBookDomain(bookTitle, bookAuthor).then((domainData) => {
        if (cancelled || !isActiveBookRequest('domain', bookId, requestToken)) {
          fetchingDomainForBooksRef.current.delete(bookId);
          return;
        }

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
        if (!cancelled && isActiveBookRequest('domain', bookId, requestToken)) {
          setLoadingDomainForBookId(null);
          console.error('Error fetching book domain insights:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingDomainForBooksRef.current.delete(bookId);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      fetchingDomainForBooksRef.current.delete(bookId);
      if (isActiveBookRequest('domain', bookId, requestToken)) {
        setLoadingDomainForBookId(null);
        clearBookRequest('domain', bookId, requestToken);
      }
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

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
    const requestToken = beginBookRequest('context', bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
        if (cancelled) return;

      console.log(`[Book Context] 🔄 Fetching context insights for "${bookTitle}" by ${bookAuthor}...`);
      getBookContext(bookTitle, bookAuthor).then((contextInsights) => {
        if (cancelled || !isActiveBookRequest('context', bookId, requestToken)) {
          fetchingContextForBooksRef.current.delete(bookId);
          return;
        }

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
        if (!cancelled && isActiveBookRequest('context', bookId, requestToken)) {
          setLoadingContextForBookId(null);
          console.error('Error fetching book context insights:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingContextForBooksRef.current.delete(bookId);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      fetchingContextForBooksRef.current.delete(bookId);
      if (isActiveBookRequest('context', bookId, requestToken)) {
        setLoadingContextForBookId(null);
        clearBookRequest('context', bookId, requestToken);
      }
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

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
    const requestToken = beginBookRequest('did_you_know', bookId);

    // Add a short delay to avoid rate limits when scrolling through books
    // Shorter delay than other insights since this is the only enabled insight type by default
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      console.log(`[Did You Know] 🔄 Fetching "Did you know?" insights for "${bookTitle}" by ${bookAuthor}...`);
      getDidYouKnow(bookTitle, bookAuthor).then((insights) => {
        if (cancelled || !isActiveBookRequest('did_you_know', bookId, requestToken)) {
          fetchingDidYouKnowForBooksRef.current.delete(bookId);
          return;
        }

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
        if (!cancelled && isActiveBookRequest('did_you_know', bookId, requestToken)) {
          setLoadingDidYouKnowForBookId(null);
          console.error('Error fetching "Did you know?" insights:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingDidYouKnowForBooksRef.current.delete(bookId);
      });
    }, 300); // Short debounce for scroll; above-the-fold content

    return () => {
      cancelled = true;
      fetchingDidYouKnowForBooksRef.current.delete(bookId);
      if (isActiveBookRequest('did_you_know', bookId, requestToken)) {
        setLoadingDidYouKnowForBookId(null);
        clearBookRequest('did_you_know', bookId, requestToken);
      }
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Fetch podcast episodes for existing books when they're selected
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
    const abortController = new AbortController();

    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingPodcastsForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingPodcastsForBookId(bookId);
    const requestToken = beginBookRequest('podcasts', bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      console.log(`[Podcast Episodes] 🔄 Fetching podcast episodes for "${bookTitle}" by ${bookAuthor}...`);
      getPodcastEpisodes(bookTitle, bookAuthor, abortController.signal).then((allEpisodes) => {
        if (cancelled || !isActiveBookRequest('podcasts', bookId, requestToken)) {
          fetchingPodcastsForBooksRef.current.delete(bookId);
          return;
        }

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
        if (cancelled || !isActiveBookRequest('podcasts', bookId, requestToken)) {
          fetchingPodcastsForBooksRef.current.delete(bookId);
          return;
        }
        if ((err as any)?.name === 'AbortError') {
          fetchingPodcastsForBooksRef.current.delete(bookId);
          return;
        }
        setLoadingPodcastsForBookId(null);
        console.error('Error fetching podcast episodes:', err);
        // Remove from fetching set on error so we can retry
        fetchingPodcastsForBooksRef.current.delete(bookId);
      });
    }, 600); // Short debounce for scroll; services check Supabase cache first (~50ms)

    return () => {
      cancelled = true;
      fetchingPodcastsForBooksRef.current.delete(bookId);
      if (isActiveBookRequest('podcasts', bookId, requestToken)) {
        setLoadingPodcastsForBookId(null);
        clearBookRequest('podcasts', bookId, requestToken);
      }
      abortController.abort();
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

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
    const abortController = new AbortController();

    // Mark as being fetched (to prevent concurrent fetches)
    fetchingAnalysisForBooksRef.current.add(bookId);

    setLoadingAnalysisForBookId(bookId);
    const requestToken = beginBookRequest('articles', bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;

      console.log(`[Analysis Articles] 🔄 Fetching from Google Scholar for "${bookTitle}" by ${bookAuthor}...`);
      getGoogleScholarAnalysis(bookTitle, bookAuthor, abortController.signal).then((articles) => {
        if (cancelled || !isActiveBookRequest('articles', bookId, requestToken)) {
          fetchingAnalysisForBooksRef.current.delete(bookId);
          return;
        }

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
        if (cancelled || !isActiveBookRequest('articles', bookId, requestToken)) {
          fetchingAnalysisForBooksRef.current.delete(bookId);
          return;
        }
        if ((err as any)?.name === 'AbortError') {
          fetchingAnalysisForBooksRef.current.delete(bookId);
          return;
        }
        setLoadingAnalysisForBookId(null);
        console.error('Error fetching analysis articles:', err);
        // Remove from fetching set on error so we can retry
        fetchingAnalysisForBooksRef.current.delete(bookId);
      });
    }, 600); // Short debounce for scroll; services check Supabase cache first (~50ms)

    return () => {
      cancelled = true;
      fetchingAnalysisForBooksRef.current.delete(bookId);
      if (isActiveBookRequest('articles', bookId, requestToken)) {
        setLoadingAnalysisForBookId(null);
        clearBookRequest('articles', bookId, requestToken);
      }
      abortController.abort();
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

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
    const abortController = new AbortController();

    // Mark as being fetched (to prevent concurrent fetches)
    fetchingVideosForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingVideosForBookId(bookId);
    const requestToken = beginBookRequest('videos', bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;

      console.log(`[YouTube Videos] 🔄 Fetching for "${bookTitle}" by ${bookAuthor}...`);
      getYouTubeVideos(bookTitle, bookAuthor, abortController.signal).then((videos) => {
        if (cancelled || !isActiveBookRequest('videos', bookId, requestToken)) {
          fetchingVideosForBooksRef.current.delete(bookId);
          return;
        }

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
        if (cancelled || !isActiveBookRequest('videos', bookId, requestToken)) {
          fetchingVideosForBooksRef.current.delete(bookId);
          return;
        }
        setLoadingVideosForBookId(null);
        console.error('Error fetching YouTube videos:', err);
        // Remove from fetching set on error so we can retry
        fetchingVideosForBooksRef.current.delete(bookId);
      });
    }, 600); // Short debounce for scroll; services check Supabase cache first (~50ms)

    return () => {
      cancelled = true;
      fetchingVideosForBooksRef.current.delete(bookId);
      if (isActiveBookRequest('videos', bookId, requestToken)) {
        setLoadingVideosForBookId(null);
        clearBookRequest('videos', bookId, requestToken);
      }
      abortController.abort();
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

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
    const abortController = new AbortController();

    // Mark as being fetched (to prevent concurrent fetches)
    fetchingRelatedForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingRelatedForBookId(bookId);
    const requestToken = beginBookRequest('related_books', bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;

      console.log(`[Related Books] 🔄 Fetching for "${bookTitle}" by ${bookAuthor}...`);
      getRelatedBooks(bookTitle, bookAuthor, abortController.signal).then((books) => {
        if (cancelled || !isActiveBookRequest('related_books', bookId, requestToken)) {
          fetchingRelatedForBooksRef.current.delete(bookId);
          return;
        }

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
        if (cancelled || !isActiveBookRequest('related_books', bookId, requestToken)) {
          fetchingRelatedForBooksRef.current.delete(bookId);
          return;
        }
        setLoadingRelatedForBookId(null);
        console.error('Error fetching related books:', err);
        // Remove from fetching set on error so we can retry
        fetchingRelatedForBooksRef.current.delete(bookId);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      fetchingRelatedForBooksRef.current.delete(bookId);
      if (isActiveBookRequest('related_books', bookId, requestToken)) {
        setLoadingRelatedForBookId(null);
        clearBookRequest('related_books', bookId, requestToken);
      }
      abortController.abort();
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

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
    const abortController = new AbortController();
    fetchingRelatedMoviesRef.current.add(bookId);
    setLoadingRelatedMoviesForBookId(bookId);
    const requestToken = beginBookRequest('related_movies', bookId);

    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;

      console.log(`[Related Movies] Fetching for "${bookTitle}" by ${bookAuthor}...`);
      getRelatedMovies(bookTitle, bookAuthor, abortController.signal).then((movies) => {
        if (cancelled || !isActiveBookRequest('related_movies', bookId, requestToken)) {
          fetchingRelatedMoviesRef.current.delete(bookId);
          return;
        }

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
        if (cancelled || !isActiveBookRequest('related_movies', bookId, requestToken)) {
          fetchingRelatedMoviesRef.current.delete(bookId);
          return;
        }
        setLoadingRelatedMoviesForBookId(null);
        console.error('Error fetching related movies:', err);
        fetchingRelatedMoviesRef.current.delete(bookId);
      });
    }, 1000); // Short debounce for scroll; below-the-fold content

    return () => {
      cancelled = true;
      fetchingRelatedMoviesRef.current.delete(bookId);
      if (isActiveBookRequest('related_movies', bookId, requestToken)) {
        setLoadingRelatedMoviesForBookId(null);
        clearBookRequest('related_movies', bookId, requestToken);
      }
      abortController.abort();
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
    const abortController = new AbortController();
    fetchingSummaryRef.current.add(bookId);
    setLoadingSummaryForBookId(bookId);
    const summaryToken = beginBookRequest('summary', bookId);

    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      getBookSummary(currentBook.title, currentBook.author, abortController.signal).then((summary) => {
        if (cancelled || !isActiveBookRequest('summary', bookId, summaryToken)) {
          fetchingSummaryRef.current.delete(bookId);
          return;
        }
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
        if (cancelled || !isActiveBookRequest('summary', bookId, summaryToken)) {
          fetchingSummaryRef.current.delete(bookId);
          return;
        }
        setLoadingSummaryForBookId(null);
        fetchingSummaryRef.current.delete(bookId);
        console.error('[BookSummary] Error:', err);
      });
    }, 300); // Short debounce for scroll; above-the-fold content

    // Also fetch character avatars
    const avatarAbortController = new AbortController();
    if (!characterAvatars.has(bookId)) {
      setLoadingAvatarsForBookId(bookId);
      const avatarToken = beginBookRequest('avatars', bookId);
      getCharacterAvatars(currentBook.title, currentBook.author, avatarAbortController.signal).then((avatars) => {
        if (cancelled || !isActiveBookRequest('avatars', bookId, avatarToken)) return;
        setLoadingAvatarsForBookId(null);
        // Store result even if empty — prevents infinite retry loop.
        // Empty results can be retried via retryCharacterAvatars().
        setCharacterAvatars(prev => {
          const next = new Map(prev);
          next.set(bookId, avatars);
          return next;
        });
      }).catch((err) => {
        if (cancelled || !isActiveBookRequest('avatars', bookId, avatarToken)) return;
        if ((err as any)?.name === 'AbortError') return;
        setLoadingAvatarsForBookId(null);
        console.error('[CharacterAvatars] Error:', err);
      });
    }

    return () => {
      cancelled = true;
      fetchingSummaryRef.current.delete(bookId);
      if (isActiveBookRequest('summary', bookId, summaryToken)) {
        setLoadingSummaryForBookId(null);
        clearBookRequest('summary', bookId, summaryToken);
      }
      abortController.abort();
      avatarAbortController.abort();
      const activeAvatar = activeBookRequestsRef.current.get('avatars');
      if (activeAvatar?.bookId === bookId) {
        setLoadingAvatarsForBookId(null);
        activeBookRequestsRef.current.delete('avatars');
      }
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

  // --- useMemo hooks ---

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

  const bookDetailInsightsState = useMemo(() => {
    const emptyState = {
      hasEnabledInsights: false,
      shouldBlurInsights: false,
      categories: [] as { id: string; label: string; count: number }[],
      currentCategory: undefined as { id: string; label: string; count: number } | undefined,
      currentInsights: [] as { text: string; sourceUrl?: string; label: string }[],
      isLoading: false,
    };

    if (!activeBook || contentPreferences.fun_facts === false) {
      return emptyState;
    }

    const isNotRead = activeBook.reading_status !== 'read_it';
    const revealedSections = spoilerRevealed.get(activeBook.id) || new Set<string>();
    const isInsightsRevealed = revealedSections.has('insights');
    const shouldBlurInsights = isNotRead && !isInsightsRevealed;

    const hasFacts = activeBook.author_facts && activeBook.author_facts.length > 0;
    const research = researchData.get(activeBook.id) || null;
    const hasResearch = !!(research && research.pillars && research.pillars.length > 0);
    const influences = bookInfluences.get(activeBook.id) || [];
    const hasInfluences = influences.length > 0;
    const domainData = bookDomain.get(activeBook.id);
    const hasDomain = !!(domainData && domainData.facts && domainData.facts.length > 0);
    const domainLabel = domainData?.label || 'Domain';
    const contextInsights = bookContext.get(activeBook.id) || [];
    const hasContext = contextInsights.length > 0;
    const didYouKnowInsights = didYouKnow.get(activeBook.id) || [];
    const hasDidYouKnow = didYouKnowInsights.length > 0;
    const isLoadingFacts = loadingFactsForBookId === activeBook.id && !hasFacts;
    const isLoadingResearch = loadingResearchForBookId === activeBook.id && !hasResearch;
    const isLoadingInfluences = loadingInfluencesForBookId === activeBook.id && !hasInfluences;
    const isLoadingDomain = loadingDomainForBookId === activeBook.id && !hasDomain;
    const isLoadingContext = loadingContextForBookId === activeBook.id && !hasContext;
    const isLoadingDidYouKnow = loadingDidYouKnowForBookId === activeBook.id && !hasDidYouKnow;

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
      research.pillars.forEach((pillar) => {
        categories.push({
          id: pillar.pillar_name.toLowerCase().replace(/\s+/g, '_'),
          label: pillar.pillar_name,
          count: pillar.content_items.length,
        });
      });
    }

    const hasEnabledInsights =
      (featureFlags.insights.author_facts && (isLoadingFacts || hasFacts)) ||
      (featureFlags.insights.book_influences && (isLoadingInfluences || hasInfluences)) ||
      (featureFlags.insights.book_domain && (isLoadingDomain || hasDomain)) ||
      (featureFlags.insights.book_context && (isLoadingContext || hasContext)) ||
      (featureFlags.insights.did_you_know && (isLoadingDidYouKnow || hasDidYouKnow)) ||
      (isLoadingResearch || hasResearch);

    if (!hasEnabledInsights) {
      return emptyState;
    }

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
      currentInsights = didYouKnowInsights.map(item => ({
        text: item.notes.join('\n\n'),
        label: 'Did you know?',
        sourceUrl: item.source_url,
      }));
      isLoading = isLoadingDidYouKnow;
    } else if (currentCategory && hasResearch) {
      const pillar = research.pillars.find(p => p.pillar_name.toLowerCase().replace(/\s+/g, '_') === currentCategory.id);
      if (pillar) {
        currentInsights = pillar.content_items.map(item => ({
          text: item.deep_insight,
          sourceUrl: item.source_url,
          label: pillar.pillar_name,
        }));
      }
      isLoading = isLoadingResearch;
    }

    return {
      hasEnabledInsights,
      shouldBlurInsights,
      categories,
      currentCategory,
      currentInsights,
      isLoading,
    };
  }, [
    activeBook,
    selectedInsightCategory,
    contentPreferences.fun_facts,
    spoilerRevealed,
    researchData,
    bookInfluences,
    bookDomain,
    bookContext,
    didYouKnow,
    loadingFactsForBookId,
    loadingResearchForBookId,
    loadingInfluencesForBookId,
    loadingDomainForBookId,
    loadingContextForBookId,
    loadingDidYouKnowForBookId,
    featureFlags.insights.author_facts,
    featureFlags.insights.book_influences,
    featureFlags.insights.book_domain,
    featureFlags.insights.book_context,
    featureFlags.insights.did_you_know,
  ]);

  const activeVideos = useMemo<YouTubeVideo[]>(() => {
    if (!activeBook) return [];
    return youtubeVideos.get(activeBook.id) || [];
  }, [activeBook?.id, youtubeVideos]);

  const activeArticles = useMemo<AnalysisArticle[]>(() => {
    if (!activeBook) return [];
    return analysisArticles.get(activeBook.id) || [];
  }, [activeBook?.id, analysisArticles]);

  const activeRelatedMovies = useMemo<RelatedMovie[]>(() => {
    if (!activeBook) return [];
    return relatedMovies.get(activeBook.id) || [];
  }, [activeBook?.id, relatedMovies]);

  const activeRelatedBooks = useMemo<RelatedBook[]>(() => {
    if (!activeBook) return [];
    return relatedBooks.get(activeBook.id) || [];
  }, [activeBook?.id, relatedBooks]);

  // Spotlight recommendation — pick one random content item from available data
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
          // Albums without itunes_url are filtered out by RelatedMovies — skip them here too
          if (movie.type === 'album' && !movie.itunes_url) return;
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
    // Seeded sort so order is stable per book AND stable when new candidates arrive
    // (Fisher-Yates shuffle changes order when array length changes; hash-based sort doesn't)
    const seed = activeBook.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const shuffled = [...candidates].sort((a, b) => {
      const hashA = ((seed * 2654435761) ^ (a.type.charCodeAt(0) * 31 + a.itemIndex * 997)) >>> 0;
      const hashB = ((seed * 2654435761) ^ (b.type.charCodeAt(0) * 31 + b.itemIndex * 997)) >>> 0;
      return hashA - hashB;
    });
    const current = shuffled[spotlightIndex % shuffled.length];
    const next = shuffled.length > 1 ? shuffled[(spotlightIndex + 1) % shuffled.length] : null;
    const result = { item: current, next, total: shuffled.length, bookId: activeBook.id };
    lastSpotlightRef.current = result;
    return result;
  }, [activeBook?.id, spotlightIndex, didYouKnow, podcastEpisodes, youtubeVideos, relatedBooks, analysisArticles, relatedMovies, contentPreferences]);

  // Retry character avatars — clears cached empty result and re-fetches
  const retryCharacterAvatars = useCallback(() => {
    if (!activeBook) return;
    const bookId = activeBook.id;
    // Clear the cached empty result so the effect can re-fetch
    setCharacterAvatars(prev => {
      const next = new Map(prev);
      next.delete(bookId);
      return next;
    });
  }, [activeBook?.id]);

  return {
    // Data Maps
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

    // Loading states
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

    // Insight category state
    selectedInsightCategory,
    setSelectedInsightCategory,
    isInsightCategoryDropdownOpen,
    setIsInsightCategoryDropdownOpen,

    // Spotlight state
    spotlightIndex,
    setSpotlightIndex,

    // Spoiler state
    spoilerRevealed,
    setSpoilerRevealed,

    // Setters needed by render for cache updates
    setBookSummaries,
    setCharacterAvatars,
    setBookInfographics,

    // Actions
    retryCharacterAvatars,

    // Memos
    combinedPodcastEpisodes,
    bookDetailInsightsState,
    activeVideos,
    activeArticles,
    activeRelatedMovies,
    activeRelatedBooks,
    spotlightRecommendation,
  };
}
