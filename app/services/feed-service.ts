import { supabase } from '@/lib/supabase';
import { featureFlags } from '@/lib/feature-flags';
import { storageGet, storageSet } from '@/lib/capacitor';
import type { FeedItemType, FeedItemContent } from '../types';

// Generate a hash for content deduplication (browser-compatible djb2)
function generateFeedContentHash(type: string, content: any): string {
  const str = JSON.stringify({ type, content });
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// Create a friend_book feed item when user adds a book
export async function createFriendBookFeedItem(
  userId: string,
  bookId: string,
  bookTitle: string,
  bookAuthor: string,
  bookCoverUrl: string | null,
  readingStatus: string | null,
  description?: string | null
): Promise<void> {
  const content: Record<string, any> = {
    action: 'added',
    book_title: bookTitle,
    book_author: bookAuthor,
    book_cover_url: bookCoverUrl,
  };
  if (description) {
    content.description = description;
  }

  const feedItem = {
    user_id: userId,
    source_book_id: bookId,
    source_book_title: bookTitle,
    source_book_author: bookAuthor || '',
    source_book_cover_url: bookCoverUrl,
    type: 'friend_book' as FeedItemType,
    content,
    content_hash: generateFeedContentHash('friend_book', content),
    reading_status: readingStatus,
    base_score: 1.0,
    times_shown: 0,
    last_shown_at: null,
  };

  const { error } = await supabase.from('feed_items').upsert(feedItem, {
    onConflict: 'user_id,type,content_hash',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('[createFriendBookFeedItem] ❌ Error:', error.message);
  } else {
    console.log('[createFriendBookFeedItem] ✅ Created friend_book feed item');
  }
}

// Generate feed items from cached content for a book
export async function generateFeedItemsForBook(
  userId: string,
  bookId: string,
  bookTitle: string,
  bookAuthor: string,
  bookCoverUrl: string | null,
  readingStatus: string | null,
  bookCreatedAt: string
): Promise<{ created: number; errors: string[]; skipped?: boolean }> {
  const generatedTypes: FeedItemType[] = ['fact', 'context', 'drilldown', 'influence', 'podcast', 'article', 'related_book', 'video', 'did_you_know', 'related_work'];

  // Note: We no longer skip based on existing items - the upsert with ignoreDuplicates handles deduplication.
  // This allows new content types to be added to books that already have some feed items.

  const errors: string[] = [];
  let created = 0;

  const normalizedTitle = bookTitle.toLowerCase().trim();
  const normalizedAuthor = (bookAuthor || '').toLowerCase().trim();

  // Verify book still exists in the database before inserting feed items
  const { data: bookExists } = await supabase.from('books').select('id').eq('id', bookId).maybeSingle();
  if (!bookExists) {
    console.warn(`[generateFeedItemsForBook] ⚠️ Book ${bookId} not found in database, skipping feed generation`);
    return { created: 0, errors: [], skipped: true };
  }

  // Helper to create and insert feed item
  async function insertFeedItem(type: FeedItemType, content: FeedItemContent): Promise<boolean> {
    // Skip if session expired (e.g. user signed out while feed was generating)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const feedItem = {
      user_id: userId,
      source_book_id: bookId,
      source_book_title: bookTitle,
      source_book_author: bookAuthor || '',
      source_book_cover_url: bookCoverUrl,
      type,
      content,
      content_hash: generateFeedContentHash(type, content),
      reading_status: readingStatus,
      base_score: 1.0,
      times_shown: 0,
      last_shown_at: null,
      source_book_created_at: bookCreatedAt,
    };

    const { error } = await supabase.from('feed_items').upsert(feedItem, {
      onConflict: 'user_id,type,content_hash',
      ignoreDuplicates: true,
    });

    if (error) {
      // Silently skip foreign key violations (book may have been deleted between check and insert)
      if (error.code === '23503') {
        return false;
      }
      console.error(`[insertFeedItem] ❌ Error inserting ${type}:`, error.message, error.code, error.details);
      errors.push(`${type}: ${error.message}`);
      return false;
    }
    return true;
  }

  // Fetch all cached content in parallel
  const [
    authorFactsData,
    bookContextData,
    bookDomainData,
    bookInfluencesData,
    podcastsData,
    articlesData,
    relatedBooksData,
    youtubeVideosData,
    didYouKnowData,
    relatedMoviesData,
  ] = await Promise.all([
    supabase.from('author_facts_cache').select('author_facts').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('book_context_cache').select('context_insights').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('book_domain_cache').select('domain_insights, domain_label').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('book_influences_cache').select('influences').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('podcast_episodes_cache').select('podcast_episodes_curated, podcast_episodes_apple').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('google_scholar_articles').select('articles').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('related_books').select('related_books').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('youtube_videos').select('videos').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('did_you_know_cache').select('insights').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('related_movies').select('related_movies').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
  ]);

  // Debug: Log what we found in cache tables
  console.log(`[generateFeedItemsForBook] 📊 Cache data for "${normalizedTitle}" by "${normalizedAuthor}":`);
  console.log(`  - author_facts: ${authorFactsData.data?.author_facts?.length || 0} items, error: ${authorFactsData.error?.message || 'none'}`);
  console.log(`  - context: ${bookContextData.data?.context_insights?.length || 0} items, error: ${bookContextData.error?.message || 'none'}`);
  console.log(`  - domain: ${bookDomainData.data?.domain_insights?.length || 0} items, error: ${bookDomainData.error?.message || 'none'}`);
  console.log(`  - influences: ${bookInfluencesData.data?.influences?.length || 0} items, error: ${bookInfluencesData.error?.message || 'none'}`);
  console.log(`  - did_you_know: ${didYouKnowData.data?.insights?.length || 0} items, error: ${didYouKnowData.error?.message || 'none'}`);

  // Process author facts (only if feature flag enabled)
  if (featureFlags.insights.author_facts) {
    const authorFacts = authorFactsData.data?.author_facts;
    if (authorFacts && Array.isArray(authorFacts)) {
      for (const fact of authorFacts) {
        if (await insertFeedItem('fact', { fact })) created++;
      }
    }
  }

  // Process context insights (only if feature flag enabled)
  if (featureFlags.insights.book_context) {
    const contextInsights = bookContextData.data?.context_insights;
    if (contextInsights && Array.isArray(contextInsights)) {
      for (const insight of contextInsights) {
        if (await insertFeedItem('context', { insight })) created++;
      }
    }
  }

  // Process domain/drilldown insights (only if feature flag enabled)
  if (featureFlags.insights.book_domain) {
    const domainInsights = bookDomainData.data?.domain_insights;
    const domainLabel = bookDomainData.data?.domain_label || 'Domain';
    if (domainInsights && Array.isArray(domainInsights)) {
      for (const insight of domainInsights) {
        if (await insertFeedItem('drilldown', { insight, domain_label: domainLabel })) created++;
      }
    }
  }

  // Process influences (only if feature flag enabled)
  if (featureFlags.insights.book_influences) {
    const influences = bookInfluencesData.data?.influences;
    if (influences && Array.isArray(influences)) {
      for (const influence of influences) {
        if (await insertFeedItem('influence', { influence })) created++;
      }
    }
  }

  // Process podcasts
  const curatedPodcasts = podcastsData.data?.podcast_episodes_curated || [];
  const applePodcasts = podcastsData.data?.podcast_episodes_apple || [];
  for (const episode of [...curatedPodcasts, ...applePodcasts]) {
    if (await insertFeedItem('podcast', { episode })) created++;
  }

  // Process articles
  const articles = articlesData.data?.articles;
  if (articles && Array.isArray(articles)) {
    for (const article of articles) {
      if (await insertFeedItem('article', { article })) created++;
    }
  }

  // Process related books (only those with an Apple Books listing)
  const relatedBooks = relatedBooksData.data?.related_books;
  if (relatedBooks && Array.isArray(relatedBooks)) {
    for (const relatedBook of relatedBooks) {
      if (relatedBook.google_books_url) {
        if (await insertFeedItem('related_book', { related_book: relatedBook })) created++;
      }
    }
  }

  // Process YouTube videos
  const videos = youtubeVideosData.data?.videos;
  if (videos && Array.isArray(videos)) {
    for (const video of videos) {
      if (await insertFeedItem('video', { video })) created++;
    }
  }

  // Process "Did you know?" insights - each item has 3 notes shown together (only if feature flag enabled)
  if (featureFlags.insights.did_you_know) {
    const didYouKnowInsights = didYouKnowData.data?.insights;
    if (didYouKnowInsights && Array.isArray(didYouKnowInsights)) {
      for (const item of didYouKnowInsights) {
        // Each did_you_know item contains { rank, notes: [string, string, string] }
        if (item.notes && Array.isArray(item.notes) && item.notes.length === 3) {
          if (await insertFeedItem('did_you_know', {
            rank: item.rank,
            notes: item.notes
          })) created++;
        }
      }
    }
  }

  // Process related movies/shows/albums
  const relatedMovies = relatedMoviesData.data?.related_movies;
  if (relatedMovies && Array.isArray(relatedMovies)) {
    for (const movie of relatedMovies) {
      // Only include items with a poster/artwork
      if (movie.poster_url || movie.itunes_artwork) {
        if (await insertFeedItem('related_work', { related_work: movie })) created++;
      }
    }
  }

  console.log(`[generateFeedItemsForBook] ✅ Created ${created} feed items for "${bookTitle}" (${errors.length} errors)`);
  return { created, errors };
}

// Get personalized feed with scoring and type diversity
export async function getPersonalizedFeed(userId: string): Promise<any[]> {
  const POOL_SIZE = 60;

  // Fetch a large candidate pool from each type
  const typeQueries = [
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'fact').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'context').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'drilldown').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'influence').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'podcast').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'did_you_know').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'article').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'related_book').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'video').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'related_work').order('created_at', { ascending: false }).limit(POOL_SIZE),
  ];

  // Also fetch friend_book items from followed users
  const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
  if (follows && follows.length > 0) {
    const followingIds = follows.map(f => f.following_id);
    let publicFollowingIds = followingIds;
    const { data: publicUsers, error: publicUsersError } = await supabase
      .from('users')
      .select('id')
      .in('id', followingIds)
      .eq('is_public', true);

    if (!publicUsersError && publicUsers && publicUsers.length > 0) {
      publicFollowingIds = publicUsers.map(user => user.id);
    }

    if (publicFollowingIds.length > 0) {
      typeQueries.push(
        supabase.from('feed_items').select('*').in('user_id', publicFollowingIds).eq('type', 'friend_book').order('created_at', { ascending: false }).limit(POOL_SIZE)
      );
    }
  }

  const results = await Promise.all(typeQueries);
  const allCandidates = results.flatMap(r => r.data || []);

  if (allCandidates.length === 0) {
    return [];
  }

  // Enrich friend_book items with friend's avatar and name
  const friendItems = allCandidates.filter(item => item.type === 'friend_book');
  console.log(`[getPersonalizedFeed] Found ${friendItems.length} friend_book items to enrich`);
  if (friendItems.length > 0) {
    const friendIds = [...new Set(friendItems.map(item => item.user_id))];
    console.log(`[getPersonalizedFeed] Looking up profiles for user IDs:`, friendIds);
    const { data: friendProfiles, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .in('id', friendIds);
    console.log(`[getPersonalizedFeed] Profile lookup result:`, { count: friendProfiles?.length, error: profileError?.message, profiles: friendProfiles?.map(p => ({ id: p.id, name: p.full_name, avatar: p.avatar_url?.substring(0, 50) })) });
    if (friendProfiles) {
      const profileMap = new Map(friendProfiles.map(p => [p.id, p]));
      for (const item of friendItems) {
        const profile = profileMap.get(item.user_id);
        if (profile) {
          item.content = { ...item.content, friend_name: profile.full_name, friend_avatar_url: profile.avatar_url };
          console.log(`[getPersonalizedFeed] Enriched friend_book item with avatar:`, profile.avatar_url?.substring(0, 50));
        }
      }
    }
  }

  // Greedy selection with diversity scoring — process all candidates
  const feed: any[] = [];
  const recentTypes: string[] = [];
  const recentBooks: string[] = [];
  const remainingCandidates = [...allCandidates];

  while (remainingCandidates.length > 0) {
    for (const item of remainingCandidates) {
      item.computed_score = calculateFeedScore(item, recentTypes, recentBooks);
    }

    remainingCandidates.sort((a, b) => (b.computed_score || 0) - (a.computed_score || 0));

    const selected = remainingCandidates.shift()!;
    feed.push(selected);

    recentTypes.unshift(selected.type);
    recentBooks.unshift(selected.source_book_id);

    if (recentTypes.length > 5) recentTypes.pop();
    if (recentBooks.length > 5) recentBooks.pop();
  }

  return feed;
}

// Calculate feed score with freshness and diversity factors
function calculateFeedScore(item: any, recentTypes: string[], recentBooks: string[]): number {
  let score = item.base_score || 1.0;

  // 1. FRESHNESS - Decay over 14 days
  const createdAt = new Date(item.created_at).getTime();
  const daysSinceCreated = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
  const freshnessFactor = Math.max(0.2, 1 - daysSinceCreated / 14);
  score *= freshnessFactor;

  // 2. READING STATUS - Prioritize "reading" books, then recently added "read_it"
  if (item.reading_status === 'reading') {
    score *= 2.0;
  } else if (item.reading_status === 'read_it') {
    if (item.source_book_created_at) {
      const bookAddedAt = new Date(item.source_book_created_at).getTime();
      const daysSinceBookAdded = (Date.now() - bookAddedAt) / (1000 * 60 * 60 * 24);
      score *= Math.max(1.0, 1.8 - (daysSinceBookAdded / 60) * 0.8);
    } else {
      score *= 1.3;
    }
  } else if (item.reading_status === 'want_to_read') {
    score *= 0.7;
  } else {
    score *= 0.5;
  }

  // 3. STALENESS BOOST - Items not shown recently get priority
  if (item.last_shown_at) {
    const lastShown = new Date(item.last_shown_at).getTime();
    const daysSinceShown = (Date.now() - lastShown) / (1000 * 60 * 60 * 24);
    score += daysSinceShown * 0.5;
  } else {
    score += 5; // Never shown = big boost
  }

  // 4. DIMINISHING RETURNS - Penalize frequently shown items
  score *= 1 / (1 + (item.times_shown || 0) * 0.15);

  // 5. TYPE DIVERSITY - Penalize if same type was recent
  const typeRecency = recentTypes.indexOf(item.type);
  if (typeRecency !== -1) {
    score *= Math.max(0.3, 1 - 0.2 * (5 - typeRecency));
  }

  // 6. BOOK DIVERSITY - Penalize if same book was recent
  const bookRecency = recentBooks.indexOf(item.source_book_id);
  if (bookRecency !== -1) {
    score *= Math.max(0.4, 1 - 0.15 * (5 - bookRecency));
  }

  return score;
}

// Mark feed items as shown (for staleness tracking)
export async function markFeedItemsAsShown(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;

  for (const id of itemIds) {
    const { data: item } = await supabase
      .from('feed_items')
      .select('times_shown')
      .eq('id', id)
      .single();

    const currentCount = item?.times_shown || 0;

    await supabase
      .from('feed_items')
      .update({
        times_shown: currentCount + 1,
        last_shown_at: new Date().toISOString(),
      })
      .eq('id', id);
  }
}

// Mark a feed item as read/unread
// Store read status in localStorage
const FEED_READ_STORAGE_KEY = 'feed_items_read';

export function getReadFeedItems(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(FEED_READ_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export function setFeedItemReadStatus(itemId: string, read: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const readItems = getReadFeedItems();
    if (read) {
      readItems.add(itemId);
    } else {
      readItems.delete(itemId);
    }
    localStorage.setItem(FEED_READ_STORAGE_KEY, JSON.stringify([...readItems]));
  } catch (e) {
    console.error('[setFeedItemReadStatus] Error saving to localStorage:', e);
  }
}

// Spoiler revealed status storage (per book) - cross-platform
const SPOILER_REVEALED_STORAGE_KEY = 'spoiler_revealed_status';

export function getSpoilerRevealedFromStorage(): Map<string, Set<string>> {
  if (typeof window === 'undefined') return new Map();
  try {
    // Try localStorage first for initial sync load
    const stored = localStorage.getItem(SPOILER_REVEALED_STORAGE_KEY);
    if (!stored) return new Map();
    const parsed = JSON.parse(stored) as Record<string, string[]>;
    const map = new Map<string, Set<string>>();
    for (const [bookId, sections] of Object.entries(parsed)) {
      map.set(bookId, new Set(sections));
    }
    return map;
  } catch {
    return new Map();
  }
}

// Async version for cross-platform storage (call on mount for native)
export async function loadSpoilerRevealedFromStorage(): Promise<Map<string, Set<string>>> {
  try {
    const stored = await storageGet(SPOILER_REVEALED_STORAGE_KEY);
    if (!stored) return new Map();
    const parsed = JSON.parse(stored) as Record<string, string[]>;
    const map = new Map<string, Set<string>>();
    for (const [bookId, sections] of Object.entries(parsed)) {
      map.set(bookId, new Set(sections));
    }
    return map;
  } catch {
    return new Map();
  }
}

export function saveSpoilerRevealedToStorage(revealed: Map<string, Set<string>>): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, string[]> = {};
    revealed.forEach((sections, bookId) => {
      obj[bookId] = [...sections];
    });
    const jsonStr = JSON.stringify(obj);
    // Save to both localStorage (sync) and cross-platform storage (async)
    localStorage.setItem(SPOILER_REVEALED_STORAGE_KEY, jsonStr);
    storageSet(SPOILER_REVEALED_STORAGE_KEY, jsonStr).catch(e => {
      console.error('[saveSpoilerRevealedToStorage] Error saving to Preferences:', e);
    });
  } catch (e) {
    console.error('[saveSpoilerRevealedToStorage] Error saving:', e);
  }
}
