/**
 * Page Wiring Tests
 *
 * These tests verify that extracted components are properly wired in page.tsx
 * and that orphaned state/refs/effects have been cleaned up. They work by
 * reading the source file and checking for patterns — no rendering needed.
 *
 * Why: When extracting components from the monolithic page.tsx, the most
 * common bugs are at the seams — callbacks passing wrong values, state
 * variables left behind, or dialogs that reference deleted state. Unit tests
 * on the extracted component don't catch these.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const pageSource = readFileSync(join(__dirname, '../app/page.tsx'), 'utf-8');
const bookDetailViewSource = readFileSync(join(__dirname, '../app/components/BookDetailView.tsx'), 'utf-8');
const articlesServiceSource = readFileSync(join(__dirname, '../app/services/articles-service.ts'), 'utf-8');
const youtubeServiceSource = readFileSync(join(__dirname, '../app/services/youtube-service.ts'), 'utf-8');
const relatedBooksServiceSource = readFileSync(join(__dirname, '../app/services/related-books-service.ts'), 'utf-8');
const relatedMoviesServiceSource = readFileSync(join(__dirname, '../app/services/related-movies-service.ts'), 'utf-8');
const summaryServiceSource = readFileSync(join(__dirname, '../app/services/book-summary-service.ts'), 'utf-8');
const apiUtilsServiceSource = readFileSync(join(__dirname, '../app/services/api-utils.ts'), 'utf-8');
const insightsServiceSource = readFileSync(join(__dirname, '../app/services/insights-service.ts'), 'utf-8');
const podcastServiceSource = readFileSync(join(__dirname, '../app/services/podcast-service.ts'), 'utf-8');
const avatarsServiceSource = readFileSync(join(__dirname, '../app/services/character-avatars-service.ts'), 'utf-8');
const bookDetailDataHookSource = readFileSync(join(__dirname, '../app/hooks/useBookDetailData.ts'), 'utf-8');

describe('AccountPage wiring in page.tsx', () => {
  it('should not contain orphaned AccountPage state variables', () => {
    // These state variables were moved to AccountPage.tsx
    const movedState = [
      'grokUsageLogs',
      'isLoadingGrokLogs',
      'isProfilePublic',
      'isLoadingPrivacySetting',
      'isSavingPrivacySetting',
      'showDeleteAccountConfirm',
      'isDeletingAccount',
    ];
    for (const name of movedState) {
      // Should not appear as useState declarations
      expect(pageSource).not.toMatch(new RegExp(`useState.*${name}|\\[${name},\\s*set`));
    }
  });

  it('should not contain orphaned AccountPage refs', () => {
    const movedRefs = ['prefDragRef', 'prefListRef'];
    for (const name of movedRefs) {
      expect(pageSource).not.toContain(name);
    }
  });

  it('should import AccountPage component', () => {
    expect(pageSource).toMatch(/AccountPage/);
  });

  it('should render <AccountPage with required props', () => {
    expect(pageSource).toMatch(/<AccountPage/);
    // Verify key props are passed
    expect(pageSource).toMatch(/onConnectAccount=\{/);
    expect(pageSource).toMatch(/onClose=\{/);
    expect(pageSource).toMatch(/signOut=\{/);
  });

  it('should use "account" reason for connect from AccountPage, not "book_limit"', () => {
    // Find the onConnectAccount callback passed to AccountPage
    // It should set reason to 'account', not 'book_limit'
    const accountPageBlock = pageSource.slice(
      pageSource.indexOf('<AccountPage'),
      pageSource.indexOf('/>', pageSource.indexOf('<AccountPage')) + 2
    );
    expect(accountPageBlock).toContain("'account'");
    expect(accountPageBlock).not.toContain("'book_limit'");
  });

  it('should not have inline delete account dialog (moved to AccountPage)', () => {
    // The delete dialog should only exist inside AccountPage.tsx, not page.tsx
    // Count occurrences of "Delete Account?" (the dialog title)
    const matches = pageSource.match(/Delete Account\?/g);
    expect(matches).toBeNull();
  });
});

describe('FollowingPage wiring in page.tsx', () => {
  it('should not contain orphaned FollowingPage state variables', () => {
    const movedState = [
      'followingUsers',
      'isLoadingFollowing',
      'followingSortOrder',
    ];
    for (const name of movedState) {
      expect(pageSource).not.toMatch(new RegExp(`useState.*${name}|\\[${name},\\s*set`));
    }
  });

  it('should import FollowingPage component', () => {
    expect(pageSource).toMatch(/FollowingPage/);
  });

  it('should render <FollowingPage with required props', () => {
    expect(pageSource).toMatch(/<FollowingPage/);
    expect(pageSource).toMatch(/onUserClick=\{/);
    expect(pageSource).toMatch(/onScroll=\{/);
    expect(pageSource).toMatch(/standardGlassmorphicStyle=\{/);
  });

  it('should not have inline following page load effect', () => {
    expect(pageSource).not.toMatch(/Load followed users when following page/);
  });

  it('should capture previous view before navigating to a profile', () => {
    // The onUserClick callback should call capturePreviousView() so the back button
    // returns to the following page, not the bookshelf
    const followingBlock = pageSource.slice(
      pageSource.indexOf('<FollowingPage'),
      pageSource.indexOf('/>', pageSource.indexOf('<FollowingPage')) + 2
    );
    expect(followingBlock).toContain('capturePreviousView()');
  });

  it('should support "following" as a ViewOrigin for back navigation', () => {
    // capturePreviousView must capture 'following' and restorePreviousView must handle it
    expect(pageSource).toMatch(/previousViewRef\.current\s*=\s*'following'/);
    expect(pageSource).toMatch(/target\s*===\s*'following'/);
  });
});

describe('Extracted component checklist (general)', () => {
  it('page.tsx should not import getGrokUsageLogs (moved to AccountPage)', () => {
    expect(pageSource).not.toMatch(/import.*getGrokUsageLogs/);
  });

  it('page.tsx should not import GrokUsageLog type (moved to AccountPage)', () => {
    expect(pageSource).not.toMatch(/GrokUsageLog/);
  });
});

describe('Book detail card callback stability wiring', () => {
  // Card rendering now lives in BookDetailView.tsx (extracted from page.tsx)
  function getBlock(anchor: string, length = 1000) {
    const start = bookDetailViewSource.indexOf(anchor);
    expect(start).toBeGreaterThan(-1);
    return bookDetailViewSource.slice(start, start + length);
  }

  it('uses stable InsightsCards callbacks in book detail', () => {
    const block = getBlock("bookId={`${activeBook.id}-${selectedInsightCategory}`}");
    expect(block).toContain('renderAction={renderInsightsHeartAction}');
    expect(block).toContain('onPin={pinInsightItem}');
    expect(block).toContain('isPinned={isInsightItemPinned}');
    expect(block).not.toContain('renderAction={(idx)');
    expect(block).not.toContain('onPin={(idx)');
    expect(block).not.toContain('isPinned={(idx)');
  });

  it('uses stable PodcastEpisodes callbacks in book detail', () => {
    const block = getBlock("bookId={activeBook?.id || ''}");
    expect(block).toContain('renderAction={renderPodcastHeartAction}');
    expect(block).toContain('onPin={pinPodcastItem}');
    expect(block).toContain('isPinned={isPodcastItemPinned}');
    expect(block).not.toContain('renderAction={(idx)');
    expect(block).not.toContain('onPin={(idx)');
    expect(block).not.toContain('isPinned={(idx)');
  });

  it('uses stable YouTubeVideos callbacks in book detail', () => {
    const block = getBlock('videos={videos}');
    expect(block).toContain('renderAction={renderYouTubeHeartAction}');
    expect(block).toContain('onPin={pinYouTubeItem}');
    expect(block).toContain('isPinned={isYouTubeItemPinned}');
    expect(block).not.toContain('renderAction={(idx)');
    expect(block).not.toContain('onPin={(idx)');
    expect(block).not.toContain('isPinned={(idx)');
  });

  it('uses stable AnalysisArticles callbacks in book detail', () => {
    const block = getBlock('articles={articles}');
    expect(block).toContain('renderAction={renderArticleHeartAction}');
    expect(block).toContain('onPin={pinArticleItem}');
    expect(block).toContain('isPinned={isArticleItemPinned}');
    expect(block).not.toContain('renderAction={(idx)');
    expect(block).not.toContain('onPin={(idx)');
    expect(block).not.toContain('isPinned={(idx)');
  });

  it('uses stable RelatedMovies callbacks in book detail', () => {
    const block = getBlock('movies={movies}');
    expect(block).toContain('renderAction={renderRelatedMovieHeartAction}');
    expect(block).toContain('onPin={pinRelatedMovieItem}');
    expect(block).toContain('isPinned={isRelatedMovieItemPinned}');
    expect(block).not.toContain('renderAction={(idx)');
    expect(block).not.toContain('onPin={(idx)');
    expect(block).not.toContain('isPinned={(idx)');
  });

  it('uses stable RelatedBooks callbacks in book detail', () => {
    const block = getBlock('books={related}');
    expect(block).toContain('renderAction={renderRelatedBookHeartAction}');
    expect(block).toContain('onPin={pinRelatedBookItem}');
    expect(block).toContain('isPinned={isRelatedBookItemPinned}');
    expect(block).not.toContain('renderAction={(idx)');
    expect(block).not.toContain('onPin={(idx)');
    expect(block).not.toContain('isPinned={(idx)');
  });
});

describe('Header scroll visibility guards', () => {
  it('book detail header should not force opacity animation on rerender', () => {
    // Book detail header now lives in BookDetailView.tsx
    const start = bookDetailViewSource.indexOf('ref={attachBookDetailHeaderRef}');
    expect(start).toBeGreaterThan(-1);
    const block = bookDetailViewSource.slice(start, start + 240);
    expect(block).not.toContain('animate={{ opacity: 1 }}');
  });

  it('logo header should use ref attach and not force opacity animation', () => {
    const start = pageSource.indexOf('ref={attachHeaderLogoRef}');
    expect(start).toBeGreaterThan(-1);
    const block = pageSource.slice(start, start + 220);
    expect(block).not.toContain('animate={{ opacity: 1 }}');
  });
});

describe('Lazy chunk retry guards', () => {
  it('uses lazyWithChunkRetry for NotesEditorOverlay import', () => {
    expect(pageSource).toContain("const NotesEditorOverlay = lazyWithChunkRetry(() => import('./components/NotesEditorOverlay'), 'NotesEditorOverlay');");
  });

  it('defines lazyWithChunkRetry to recover from chunk load errors', () => {
    expect(pageSource).toContain('function lazyWithChunkRetry');
    expect(pageSource).toContain('window.location.reload()');
    expect(pageSource).toContain('ChunkLoadError');
  });
});

describe('Book detail navigation controls', () => {
  it('should not keep swipe-based next/prev book navigation state in page.tsx', () => {
    expect(pageSource).not.toContain('bookTouchStart');
    expect(pageSource).not.toContain('bookTouchEnd');
    expect(pageSource).not.toContain('handleBookSwipe');
  });

  it('should not render hover prev/next cover arrow buttons', () => {
    expect(pageSource).not.toContain('<ChevronLeft size={36} />');
    expect(pageSource).not.toContain('<ChevronRight size={36} />');
  });
});

describe('Book detail request stale-response guards', () => {
  it('defines request token guard helpers in useBookDetailData hook', () => {
    expect(bookDetailDataHookSource).toContain('const activeBookRequestsRef = useRef<Map<BookRequestType');
    expect(bookDetailDataHookSource).toContain('const beginBookRequest = useCallback');
    expect(bookDetailDataHookSource).toContain('const isActiveBookRequest = useCallback');
  });

  it('guards async book-detail fetch handlers against stale responses', () => {
    expect(bookDetailDataHookSource).toContain("isActiveBookRequest('podcasts', bookId, requestToken)");
    expect(bookDetailDataHookSource).toContain("isActiveBookRequest('videos', bookId, requestToken)");
    expect(bookDetailDataHookSource).toContain("isActiveBookRequest('articles', bookId, requestToken)");
    expect(bookDetailDataHookSource).toContain("isActiveBookRequest('related_books', bookId, requestToken)");
    expect(bookDetailDataHookSource).toContain("isActiveBookRequest('related_movies', bookId, requestToken)");
  });
});

describe('Book detail request cancellation wiring', () => {
  it('creates AbortController per fetch effect and aborts on cleanup', () => {
    expect(bookDetailDataHookSource).toContain('const abortController = new AbortController();');
    expect(bookDetailDataHookSource).toContain('abortController.abort();');
  });

  it('passes AbortController signal to cancellable book-detail services', () => {
    expect(bookDetailDataHookSource).toContain('getGoogleScholarAnalysis(bookTitle, bookAuthor, abortController.signal)');
    expect(bookDetailDataHookSource).toContain('getYouTubeVideos(bookTitle, bookAuthor, abortController.signal)');
    expect(bookDetailDataHookSource).toContain('getRelatedBooks(bookTitle, bookAuthor, abortController.signal)');
    expect(bookDetailDataHookSource).toContain('getRelatedMovies(bookTitle, bookAuthor, abortController.signal)');
    expect(bookDetailDataHookSource).toContain('getBookSummary(currentBook.title, currentBook.author, abortController.signal)');
    expect(bookDetailDataHookSource).toContain('getPodcastEpisodes(bookTitle, bookAuthor, abortController.signal)');
    expect(bookDetailDataHookSource).toContain('getCharacterAvatars(currentBook.title, currentBook.author, avatarAbortController.signal)');
  });

  it('supports signal argument in service fetch entry points', () => {
    expect(articlesServiceSource).toContain('signal?: AbortSignal');
    expect(youtubeServiceSource).toContain('signal?: AbortSignal');
    expect(relatedBooksServiceSource).toContain('signal?: AbortSignal');
    expect(relatedMoviesServiceSource).toContain('signal?: AbortSignal');
    expect(summaryServiceSource).toContain('signal?: AbortSignal');
    expect(podcastServiceSource).toContain('signal?: AbortSignal');
    expect(avatarsServiceSource).toContain('signal?: AbortSignal');
  });

  it('stops retry loop immediately on abort in fetchWithRetry', () => {
    expect(apiUtilsServiceSource).toContain("if (options.signal?.aborted)");
    expect(apiUtilsServiceSource).toContain("if ((err as any)?.name === 'AbortError')");
  });

  it('declares analysis abort controller in same effect scope', () => {
    const start = bookDetailDataHookSource.indexOf('// Load analysis articles from Google Scholar');
    expect(start).toBeGreaterThan(-1);
    const end = bookDetailDataHookSource.indexOf('}, [activeBook?.id])', start);
    expect(end).toBeGreaterThan(start);
    const block = bookDetailDataHookSource.slice(start, end);
    expect(block).toContain('const abortController = new AbortController();');
    expect(block).toContain('getGoogleScholarAnalysis(bookTitle, bookAuthor, abortController.signal)');
    expect(block).toContain('abortController.abort();');
  });

  it('does not add AbortController to chat-list effect yet', () => {
    const start = pageSource.indexOf('// Load chat list when entering chat page (stale-while-revalidate)');
    expect(start).toBeGreaterThan(-1);
    const block = pageSource.slice(start, start + 900);
    expect(block).not.toContain('new AbortController()');
  });

  it('ignores expected AbortError in analysis catch before logging', () => {
    const start = bookDetailDataHookSource.indexOf("console.error('Error fetching analysis articles:', err);");
    expect(start).toBeGreaterThan(-1);
    const block = bookDetailDataHookSource.slice(start - 300, start + 120);
    expect(block).toContain("if ((err as any)?.name === 'AbortError')");
    expect(block).toContain('return;');
  });

  it('podcast effect creates AbortController and aborts on cleanup', () => {
    const start = bookDetailDataHookSource.indexOf("console.log(`[Podcast Episodes]");
    expect(start).toBeGreaterThan(-1);
    const effectStart = bookDetailDataHookSource.lastIndexOf('useEffect(', start);
    const effectEnd = bookDetailDataHookSource.indexOf('}, [activeBook?.id])', effectStart);
    const block = bookDetailDataHookSource.slice(effectStart, effectEnd);
    expect(block).toContain('const abortController = new AbortController()');
    expect(block).toContain('abortController.abort()');
    expect(block).toContain("if ((err as any)?.name === 'AbortError')");
  });

  it('avatar fetch creates separate AbortController and aborts on cleanup', () => {
    const start = bookDetailDataHookSource.indexOf('const avatarAbortController = new AbortController()');
    expect(start).toBeGreaterThan(-1);
    const effectEnd = bookDetailDataHookSource.indexOf('}, [activeBook?.id])', start);
    const block = bookDetailDataHookSource.slice(start, effectEnd);
    expect(block).toContain('avatarAbortController.signal');
    expect(block).toContain('avatarAbortController.abort()');
  });

  it('podcast service passes signal through to Apple fetch', () => {
    const start = podcastServiceSource.indexOf('export async function getPodcastEpisodes');
    expect(start).toBeGreaterThan(-1);
    const block = podcastServiceSource.slice(start, start + 2000);
    expect(block).toContain('signal?: AbortSignal');
    expect(block).toContain("signal?.aborted");
  });

  it('avatar service passes signal through to Grok and image generation', () => {
    expect(avatarsServiceSource).toContain('getCharacterPrompts(bookTitle, author, signal)');
    expect(avatarsServiceSource).toContain('generateCharacterImage(char.prompt, signal)');
  });
});

describe('First issue year schema compatibility', () => {
  it('does not query missing first_issue_year column from author_facts_cache', () => {
    expect(insightsServiceSource).not.toContain(".select('first_issue_year')");
  });

  it('does not write first_issue_year into author_facts_cache payloads', () => {
    expect(insightsServiceSource).not.toContain('first_issue_year: year');
    expect(insightsServiceSource).not.toContain('Saved first_issue_year');
  });
});

describe('useBookDetailData hook extraction wiring', () => {
  // Verify page.tsx calls the hook and destructures its return
  it('imports and calls useBookDetailData in page.tsx', () => {
    expect(pageSource).toContain("import { useBookDetailData } from './hooks/useBookDetailData'");
    expect(pageSource).toContain('} = useBookDetailData({');
  });

  // Verify no orphaned data-fetching state declarations remain in page.tsx
  it('does not declare moved data Map states in page.tsx', () => {
    const movedMaps = [
      'bookInfluences', 'bookDomain', 'bookContext', 'didYouKnow',
      'podcastEpisodes', 'analysisArticles', 'youtubeVideos',
      'relatedBooks', 'relatedMovies', 'researchData',
      'bookSummaries', 'characterAvatars', 'bookInfographics',
    ];
    for (const name of movedMaps) {
      expect(pageSource).not.toMatch(new RegExp(`\\[${name},\\s*set${name[0].toUpperCase()}${name.slice(1)}`));
    }
  });

  it('does not declare moved loading states in page.tsx', () => {
    const movedLoading = [
      'loadingFactsForBookId', 'loadingInfluencesForBookId', 'loadingDomainForBookId',
      'loadingContextForBookId', 'loadingDidYouKnowForBookId', 'loadingPodcastsForBookId',
      'loadingAnalysisForBookId', 'loadingVideosForBookId', 'loadingRelatedForBookId',
      'loadingRelatedMoviesForBookId', 'loadingResearchForBookId',
      'loadingSummaryForBookId', 'loadingAvatarsForBookId', 'loadingInfographicForBookId',
    ];
    for (const name of movedLoading) {
      expect(pageSource).not.toMatch(new RegExp(`\\[${name},\\s*set`));
    }
  });

  it('does not declare moved fetchingRefs in page.tsx', () => {
    const movedRefs = [
      'fetchingFactsForBooksRef', 'fetchingInfluencesForBooksRef',
      'fetchingDomainForBooksRef', 'fetchingContextForBooksRef',
      'fetchingDidYouKnowForBooksRef', 'fetchingPodcastsForBooksRef',
      'fetchingAnalysisForBooksRef', 'fetchingVideosForBooksRef',
      'fetchingRelatedForBooksRef', 'fetchingRelatedMoviesRef',
      'activeBookRequestsRef', 'nextBookRequestTokenRef',
      'generatedFeedForBooksRef', 'loadingTimestamps',
    ];
    for (const name of movedRefs) {
      expect(pageSource).not.toMatch(new RegExp(`const ${name}\\s*=\\s*useRef`));
    }
  });

  it('does not declare moved useMemos in page.tsx', () => {
    expect(pageSource).not.toContain('const combinedPodcastEpisodes = useMemo');
    expect(pageSource).not.toContain('const bookDetailInsightsState = useMemo');
    expect(pageSource).not.toContain('const spotlightRecommendation = useMemo');
    expect(pageSource).not.toContain('const activeVideos = useMemo');
    expect(pageSource).not.toContain('const activeArticles = useMemo');
    expect(pageSource).not.toContain('const activeRelatedMovies = useMemo');
    expect(pageSource).not.toContain('const activeRelatedBooks = useMemo');
  });

  // Verify the hook file contains all expected data-fetching effects
  it('hook contains all data-fetching effects', () => {
    expect(bookDetailDataHookSource).toContain('getAuthorFacts(');
    expect(bookDetailDataHookSource).toContain('getBookInfluences(');
    expect(bookDetailDataHookSource).toContain('getBookDomain(');
    expect(bookDetailDataHookSource).toContain('getBookContext(');
    expect(bookDetailDataHookSource).toContain('getDidYouKnow(');
    expect(bookDetailDataHookSource).toContain('getPodcastEpisodes(');
    expect(bookDetailDataHookSource).toContain('getGoogleScholarAnalysis(');
    expect(bookDetailDataHookSource).toContain('getYouTubeVideos(');
    expect(bookDetailDataHookSource).toContain('getRelatedBooks(');
    expect(bookDetailDataHookSource).toContain('getRelatedMovies(');
    expect(bookDetailDataHookSource).toContain('getBookSummary(');
    expect(bookDetailDataHookSource).toContain('getCharacterAvatars(');
    expect(bookDetailDataHookSource).toContain('generateFeedItemsForBook(');
  });

  // Verify the hook contains the loading timeout safety net
  it('hook contains loading timeout safety net', () => {
    expect(bookDetailDataHookSource).toContain('[LoadingTimeout] Clearing stuck loading state');
    expect(bookDetailDataHookSource).toContain('30_000');
  });
});
