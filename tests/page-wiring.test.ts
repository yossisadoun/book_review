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
  function getBlock(anchor: string, length = 1000) {
    const start = pageSource.indexOf(anchor);
    expect(start).toBeGreaterThan(-1);
    return pageSource.slice(start, start + length);
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
    const start = pageSource.indexOf('ref={attachBookDetailHeaderRef}');
    expect(start).toBeGreaterThan(-1);
    const block = pageSource.slice(start, start + 240);
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
