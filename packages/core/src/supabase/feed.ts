// Feed generation and query functions

import { SupabaseClient } from '@supabase/supabase-js';
import { ReadingStatus } from '../types/book';

// Feed item types matching the database constraint
export type FeedItemType =
  | 'fact'
  | 'context'
  | 'drilldown'
  | 'influence'
  | 'podcast'
  | 'article'
  | 'related_book'
  | 'video'
  | 'friend_book';

export interface FeedItem {
  id: string;
  user_id: string;
  source_book_id: string;
  source_book_title: string;
  source_book_author: string;
  source_book_cover_url: string | null;
  type: FeedItemType;
  content: Record<string, any>;
  content_hash: string | null;
  reading_status: ReadingStatus;
  base_score: number;
  times_shown: number;
  last_shown_at: string | null;
  created_at: string;
  // Computed at query time
  computed_score?: number;
}

export interface BookInfo {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  reading_status: ReadingStatus;
}

// Generate a hash for content deduplication (browser-compatible)
async function generateContentHash(type: string, content: any): Promise<string> {
  const str = JSON.stringify({ type, content });
  // Use Web Crypto API for browser compatibility
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Synchronous hash for simpler cases (djb2 algorithm)
function generateContentHashSync(type: string, content: any): string {
  const str = JSON.stringify({ type, content });
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// ============================================
// FEED ITEM GENERATION
// ============================================

interface GenerateFeedItemsOptions {
  client: SupabaseClient;
  userId: string;
  book: BookInfo;
}

/**
 * Generate feed items for a book from all cached content sources.
 * Call this after a book is added and content has been fetched.
 */
export async function generateFeedItemsForBook({
  client,
  userId,
  book,
}: GenerateFeedItemsOptions): Promise<{ created: number; errors: string[] }> {
  const feedItems: Omit<FeedItem, 'id' | 'created_at' | 'computed_score'>[] = [];
  const errors: string[] = [];

  const normalizedTitle = book.title.toLowerCase().trim();
  const normalizedAuthor = (book.author || '').toLowerCase().trim();

  // Fetch all cached content in parallel
  const [
    authorFacts,
    bookContext,
    bookDomain,
    bookInfluences,
    podcasts,
    articles,
    relatedBooks,
    youtubeVideos,
  ] = await Promise.all([
    fetchCacheData(client, 'author_facts_cache', normalizedTitle, normalizedAuthor),
    fetchCacheData(client, 'book_context_cache', normalizedTitle, normalizedAuthor),
    fetchCacheData(client, 'book_domain_cache', normalizedTitle, normalizedAuthor),
    fetchCacheData(client, 'book_influences_cache', normalizedTitle, normalizedAuthor),
    fetchCacheData(client, 'podcast_episodes_cache', normalizedTitle, normalizedAuthor),
    fetchCacheData(client, 'google_scholar_articles', normalizedTitle, normalizedAuthor),
    fetchCacheData(client, 'related_books', normalizedTitle, normalizedAuthor),
    fetchCacheData(client, 'youtube_videos', normalizedTitle, normalizedAuthor),
  ]);

  // Process author facts
  if (authorFacts?.author_facts && Array.isArray(authorFacts.author_facts)) {
    for (const fact of authorFacts.author_facts) {
      feedItems.push(createFeedItem(userId, book, 'fact', { fact }));
    }
  }

  // Process context insights
  if (bookContext?.context_insights && Array.isArray(bookContext.context_insights)) {
    for (const insight of bookContext.context_insights) {
      feedItems.push(createFeedItem(userId, book, 'context', { insight }));
    }
  }

  // Process domain/drilldown insights
  if (bookDomain?.domain_insights && Array.isArray(bookDomain.domain_insights)) {
    const domainLabel = bookDomain.domain_label || 'Domain';
    for (const insight of bookDomain.domain_insights) {
      feedItems.push(
        createFeedItem(userId, book, 'drilldown', {
          insight,
          domain_label: domainLabel,
        })
      );
    }
  }

  // Process influences
  if (bookInfluences?.influences && Array.isArray(bookInfluences.influences)) {
    for (const influence of bookInfluences.influences) {
      feedItems.push(createFeedItem(userId, book, 'influence', { influence }));
    }
  }

  // Process podcasts (both curated and apple)
  if (podcasts) {
    const allPodcasts = [
      ...(podcasts.podcast_episodes_curated || []),
      ...(podcasts.podcast_episodes_apple || []),
    ];
    for (const episode of allPodcasts) {
      feedItems.push(createFeedItem(userId, book, 'podcast', { episode }));
    }
  }

  // Process articles
  if (articles?.articles && Array.isArray(articles.articles)) {
    for (const article of articles.articles) {
      feedItems.push(createFeedItem(userId, book, 'article', { article }));
    }
  }

  // Process related books
  if (relatedBooks?.related_books && Array.isArray(relatedBooks.related_books)) {
    for (const relatedBook of relatedBooks.related_books) {
      feedItems.push(createFeedItem(userId, book, 'related_book', { related_book: relatedBook }));
    }
  }

  // Process YouTube videos
  if (youtubeVideos?.videos && Array.isArray(youtubeVideos.videos)) {
    for (const video of youtubeVideos.videos) {
      feedItems.push(createFeedItem(userId, book, 'video', { video }));
    }
  }

  // Insert feed items (with deduplication via content_hash)
  let created = 0;
  for (const item of feedItems) {
    try {
      const { error } = await client.from('feed_items').upsert(item, {
        onConflict: 'user_id,type,content_hash',
        ignoreDuplicates: true,
      });

      if (error) {
        errors.push(`Failed to insert ${item.type}: ${error.message}`);
      } else {
        created++;
      }
    } catch (e: any) {
      errors.push(`Exception inserting ${item.type}: ${e.message}`);
    }
  }

  return { created, errors };
}

function createFeedItem(
  userId: string,
  book: BookInfo,
  type: FeedItemType,
  content: Record<string, any>
): Omit<FeedItem, 'id' | 'created_at' | 'computed_score'> {
  return {
    user_id: userId,
    source_book_id: book.id,
    source_book_title: book.title,
    source_book_author: book.author || '',
    source_book_cover_url: book.cover_url,
    type,
    content,
    content_hash: generateContentHashSync(type, content),
    reading_status: book.reading_status,
    base_score: 1.0,
    times_shown: 0,
    last_shown_at: null,
  };
}

async function fetchCacheData(
  client: SupabaseClient,
  table: string,
  title: string,
  author: string
): Promise<any | null> {
  try {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('book_title', title)
      .eq('book_author', author)
      .maybeSingle();

    if (error) {
      console.warn(`Error fetching from ${table}:`, error.message);
      return null;
    }

    return data;
  } catch (e) {
    console.warn(`Exception fetching from ${table}:`, e);
    return null;
  }
}

// ============================================
// FEED QUERY WITH SCORING
// ============================================

interface GetFeedOptions {
  client: SupabaseClient;
  userId: string;
  limit?: number;
  includeFriendBooks?: boolean;
}

/**
 * Get personalized feed with scoring and type diversity.
 */
export async function getPersonalizedFeed({
  client,
  userId,
  limit = 20,
  includeFriendBooks = true,
}: GetFeedOptions): Promise<FeedItem[]> {
  // Fetch candidate items from each type (more than needed for diversity selection)
  const candidatesPerType = Math.ceil(limit / 2);

  const typeQueries = [
    fetchFeedItemsByType(client, userId, 'fact', candidatesPerType),
    fetchFeedItemsByType(client, userId, 'context', candidatesPerType),
    fetchFeedItemsByType(client, userId, 'drilldown', candidatesPerType),
    fetchFeedItemsByType(client, userId, 'influence', candidatesPerType),
    fetchFeedItemsByType(client, userId, 'podcast', candidatesPerType),
    fetchFeedItemsByType(client, userId, 'article', candidatesPerType),
    fetchFeedItemsByType(client, userId, 'related_book', candidatesPerType),
    fetchFeedItemsByType(client, userId, 'video', candidatesPerType),
  ];

  if (includeFriendBooks) {
    typeQueries.push(fetchFriendBookItems(client, userId, candidatesPerType));
  }

  const results = await Promise.all(typeQueries);
  const allCandidates = results.flat();

  if (allCandidates.length === 0) {
    return [];
  }

  // Greedy selection with diversity scoring
  const feed: FeedItem[] = [];
  const recentTypes: string[] = [];
  const recentBooks: string[] = [];
  const remainingCandidates = [...allCandidates];

  while (feed.length < limit && remainingCandidates.length > 0) {
    // Score all remaining candidates
    for (const item of remainingCandidates) {
      item.computed_score = calculateFeedScore(item, recentTypes, recentBooks);
    }

    // Sort by score (highest first)
    remainingCandidates.sort((a, b) => (b.computed_score || 0) - (a.computed_score || 0));

    // Pick the highest scored item
    const selected = remainingCandidates.shift()!;
    feed.push(selected);

    // Track recent types and books for diversity
    recentTypes.unshift(selected.type);
    recentBooks.unshift(selected.source_book_id);

    // Keep only last 5 for diversity check
    if (recentTypes.length > 5) recentTypes.pop();
    if (recentBooks.length > 5) recentBooks.pop();
  }

  return feed;
}

/**
 * Calculate feed score with freshness and diversity factors.
 */
function calculateFeedScore(
  item: FeedItem,
  recentTypes: string[],
  recentBooks: string[]
): number {
  let score = item.base_score;

  // 1. FRESHNESS - Decay over 14 days (newer = higher)
  const createdAt = new Date(item.created_at).getTime();
  const daysSinceCreated = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
  const freshnessFactor = Math.max(0.2, 1 - daysSinceCreated / 14);
  score *= freshnessFactor;

  // 2. READING STATUS - Boost books you've actually read
  const statusMultiplier: Record<string, number> = {
    read_it: 1.5,
    reading: 1.3,
    want_to_read: 0.7,
  };
  score *= statusMultiplier[item.reading_status || ''] || 0.5;

  // 3. STALENESS BOOST - Items not shown recently get priority
  if (item.last_shown_at) {
    const lastShown = new Date(item.last_shown_at).getTime();
    const daysSinceShown = (Date.now() - lastShown) / (1000 * 60 * 60 * 24);
    score += daysSinceShown * 0.5; // +0.5 per day not shown
  } else {
    score += 5; // Never shown = big boost
  }

  // 4. DIMINISHING RETURNS - Penalize frequently shown items
  score *= 1 / (1 + item.times_shown * 0.15);

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

async function fetchFeedItemsByType(
  client: SupabaseClient,
  userId: string,
  type: FeedItemType,
  limit: number
): Promise<FeedItem[]> {
  const { data, error } = await client
    .from('feed_items')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`Error fetching ${type} feed items:`, error.message);
    return [];
  }

  return data || [];
}

async function fetchFriendBookItems(
  client: SupabaseClient,
  userId: string,
  limit: number
): Promise<FeedItem[]> {
  // First get the list of users this user follows
  const { data: follows, error: followsError } = await client
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (followsError || !follows || follows.length === 0) {
    return [];
  }

  const followingIds = follows.map((f) => f.following_id);

  // Fetch friend_book items from followed users
  const { data, error } = await client
    .from('feed_items')
    .select('*')
    .in('user_id', followingIds)
    .eq('type', 'friend_book')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('Error fetching friend book items:', error.message);
    return [];
  }

  return data || [];
}

// ============================================
// ENGAGEMENT TRACKING
// ============================================

/**
 * Mark feed items as shown (for staleness tracking).
 */
export async function markFeedItemsAsShown(
  client: SupabaseClient,
  itemIds: string[]
): Promise<void> {
  if (itemIds.length === 0) return;

  const { error } = await client
    .from('feed_items')
    .update({
      times_shown: client.rpc('increment_times_shown'),
      last_shown_at: new Date().toISOString(),
    })
    .in('id', itemIds);

  if (error) {
    // Fallback: update one by one with increment
    for (const id of itemIds) {
      await client.rpc('increment_feed_item_shown', { item_id: id });
    }
  }
}

/**
 * Alternative: Simple increment function (if RPC doesn't work)
 */
export async function markFeedItemAsShown(
  client: SupabaseClient,
  itemId: string
): Promise<void> {
  // First fetch current times_shown
  const { data: item } = await client
    .from('feed_items')
    .select('times_shown')
    .eq('id', itemId)
    .single();

  const currentCount = item?.times_shown || 0;

  await client
    .from('feed_items')
    .update({
      times_shown: currentCount + 1,
      last_shown_at: new Date().toISOString(),
    })
    .eq('id', itemId);
}

// ============================================
// FRIEND BOOK ITEM CREATION
// ============================================

/**
 * Create a friend_book feed item when a user adds a book.
 * This item is visible to the user's followers.
 */
export async function createFriendBookItem(
  client: SupabaseClient,
  userId: string,
  book: BookInfo
): Promise<void> {
  const content = {
    action: 'added',
    book_title: book.title,
    book_author: book.author,
    book_cover_url: book.cover_url,
  };

  const item: Omit<FeedItem, 'id' | 'created_at' | 'computed_score'> = {
    user_id: userId,
    source_book_id: book.id,
    source_book_title: book.title,
    source_book_author: book.author || '',
    source_book_cover_url: book.cover_url,
    type: 'friend_book',
    content,
    content_hash: generateContentHash('friend_book', content),
    reading_status: book.reading_status,
    base_score: 1.0,
    times_shown: 0,
    last_shown_at: null,
  };

  const { error } = await client.from('feed_items').upsert(item, {
    onConflict: 'user_id,type,content_hash',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('Error creating friend_book feed item:', error.message);
  }
}

// ============================================
// REGENERATE FEED FOR EXISTING BOOKS
// ============================================

/**
 * Regenerate feed items for all of a user's existing books.
 * Useful for backfilling feed for users who already have books.
 */
export async function regenerateFeedForUser(
  client: SupabaseClient,
  userId: string
): Promise<{ total: number; created: number; errors: string[] }> {
  // Fetch all user's books
  const { data: books, error } = await client
    .from('books')
    .select('id, title, author, cover_url, reading_status')
    .eq('user_id', userId);

  if (error || !books) {
    return { total: 0, created: 0, errors: [error?.message || 'No books found'] };
  }

  let totalCreated = 0;
  const allErrors: string[] = [];

  for (const book of books) {
    const result = await generateFeedItemsForBook({
      client,
      userId,
      book: {
        id: book.id,
        title: book.title,
        author: book.author || '',
        cover_url: book.cover_url,
        reading_status: book.reading_status,
      },
    });

    totalCreated += result.created;
    allErrors.push(...result.errors);
  }

  return { total: books.length, created: totalCreated, errors: allErrors };
}
