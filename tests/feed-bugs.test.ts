/**
 * Guard tests for feed correctness bugs.
 *
 * Ensures:
 * - createFriendBookItem uses sync hash (not async Promise)
 * - book_summary_cache fetch is in useEffect, not render path
 * - markFeedItemsAsShown uses batched approach, not N+1
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf-8');

const feedCore = read('packages/core/src/supabase/feed.ts');
const feedService = read('app/services/feed-service.ts');
const pageSource = read('app/page.tsx');

describe('createFriendBookItem hash bug', () => {
  it('should use generateContentHashSync, not async generateContentHash', () => {
    // The async version returns a Promise which would be assigned as content_hash
    expect(feedCore).toMatch(/createFriendBookItem[\s\S]*?content_hash:\s*generateContentHashSync/);
  });

  it('should not call async generateContentHash in createFriendBookItem', () => {
    // Extract createFriendBookItem function body
    const fnMatch = feedCore.match(/export async function createFriendBookItem[\s\S]*?^}/m);
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).not.toMatch(/content_hash:\s*generateContentHash\(/);
    expect(fnBody).toMatch(/content_hash:\s*generateContentHashSync\(/);
  });
});

describe('render-time book_summary_cache fetch', () => {
  it('should preload feed summaries in a useEffect, not during render', () => {
    // The useEffect should contain the book_summary_cache fetch
    expect(pageSource).toMatch(/useEffect\(\(\) => \{[\s\S]*?friend_book[\s\S]*?book_summary_cache/);
  });

  it('should not have book_summary_cache fetch in the friend_book render block', () => {
    // Find the friend_book card render section (after summaryKey, before the JSX return)
    // The old pattern was: if (!feedSummaryFetchedRef.current.has(summaryKey)) { supabase.from('book_summary_cache')...
    // It should now just read from the preloaded map
    const renderSection = pageSource.match(/friendBookSummary = feedBookSummaries\.get/);
    expect(renderSection).toBeTruthy();

    // There should be no supabase.from('book_summary_cache') near the feedBookSummaries.get call
    const feedBookSummaryIdx = pageSource.indexOf("friendBookSummary = feedBookSummaries.get");
    const surroundingCode = pageSource.substring(feedBookSummaryIdx - 200, feedBookSummaryIdx + 50);
    expect(surroundingCode).not.toMatch(/supabase\.from\('book_summary_cache'\)/);
  });
});

describe('markFeedItemsAsShown N+1 fix', () => {
  it('should not have per-item select+update loop', () => {
    // Old pattern: for (const id of itemIds) { supabase.from('feed_items').select('times_shown')...
    expect(feedService).not.toMatch(/for\s*\(\s*const\s+id\s+of\s+itemIds\s*\)\s*\{[\s\S]*?\.select\('times_shown'\)/);
  });

  it('should use batch RPC or single update', () => {
    expect(feedService).toMatch(/batch_mark_feed_items_shown|\.in\('id',\s*itemIds\)/);
  });
});
