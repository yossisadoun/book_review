import { SupabaseClient } from '@supabase/supabase-js';
import { ReadingStatus } from '../types/book';
export type FeedItemType = 'fact' | 'context' | 'drilldown' | 'influence' | 'podcast' | 'article' | 'related_book' | 'video' | 'friend_book';
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
    computed_score?: number;
}
export interface BookInfo {
    id: string;
    title: string;
    author: string;
    cover_url: string | null;
    reading_status: ReadingStatus;
}
interface GenerateFeedItemsOptions {
    client: SupabaseClient;
    userId: string;
    book: BookInfo;
}
/**
 * Generate feed items for a book from all cached content sources.
 * Call this after a book is added and content has been fetched.
 */
export declare function generateFeedItemsForBook({ client, userId, book, }: GenerateFeedItemsOptions): Promise<{
    created: number;
    errors: string[];
}>;
interface GetFeedOptions {
    client: SupabaseClient;
    userId: string;
    limit?: number;
    includeFriendBooks?: boolean;
}
/**
 * Get personalized feed with scoring and type diversity.
 */
export declare function getPersonalizedFeed({ client, userId, limit, includeFriendBooks, }: GetFeedOptions): Promise<FeedItem[]>;
/**
 * Mark feed items as shown (for staleness tracking).
 */
export declare function markFeedItemsAsShown(client: SupabaseClient, itemIds: string[]): Promise<void>;
/**
 * Alternative: Simple increment function (if RPC doesn't work)
 */
export declare function markFeedItemAsShown(client: SupabaseClient, itemId: string): Promise<void>;
/**
 * Create a friend_book feed item when a user adds a book.
 * This item is visible to the user's followers.
 */
export declare function createFriendBookItem(client: SupabaseClient, userId: string, book: BookInfo): Promise<void>;
/**
 * Regenerate feed items for all of a user's existing books.
 * Useful for backfilling feed for users who already have books.
 */
export declare function regenerateFeedForUser(client: SupabaseClient, userId: string): Promise<{
    total: number;
    created: number;
    errors: string[];
}>;
export {};
