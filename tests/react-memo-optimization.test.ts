/**
 * Guard tests for React.memo + useCallback optimizations.
 *
 * Ensures:
 * - All card components are wrapped in React.memo
 * - HeartButton is wrapped in React.memo
 * - handleToggleHeart uses useCallback in page.tsx
 * - Stable EMPTY_ARRAY constant exists (no `|| []` anti-pattern for memoized props)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf-8');

const pageSource = read('app/page.tsx');
const heartButton = read('app/components/HeartButton.tsx');
const insightsCards = read('app/components/InsightsCards.tsx');
const podcastEpisodes = read('app/components/PodcastEpisodes.tsx');
const youtubeVideos = read('app/components/YouTubeVideos.tsx');
const analysisArticles = read('app/components/AnalysisArticles.tsx');
const relatedMovies = read('app/components/RelatedMovies.tsx');
const relatedBooks = read('app/components/RelatedBooks.tsx');
const ratingStars = read('app/components/RatingStars.tsx');

describe('React.memo wrapping', () => {
  it('HeartButton should be wrapped in React.memo', () => {
    expect(heartButton).toMatch(/React\.memo\(function HeartButton/);
  });

  it('InsightsCards should be wrapped in React.memo', () => {
    expect(insightsCards).toMatch(/React\.memo\(function InsightsCards/);
  });

  it('PodcastEpisodes should be wrapped in React.memo', () => {
    expect(podcastEpisodes).toMatch(/React\.memo\(function PodcastEpisodes/);
  });

  it('YouTubeVideos should be wrapped in React.memo', () => {
    expect(youtubeVideos).toMatch(/React\.memo\(function YouTubeVideos/);
  });

  it('AnalysisArticles should be wrapped in React.memo', () => {
    expect(analysisArticles).toMatch(/React\.memo\(function AnalysisArticles/);
  });

  it('RelatedMovies should be wrapped in React.memo', () => {
    expect(relatedMovies).toMatch(/React\.memo\(function RelatedMovies/);
  });

  it('RelatedBooks should be wrapped in React.memo', () => {
    expect(relatedBooks).toMatch(/React\.memo\(function RelatedBooks/);
  });

  it('RatingStars should be wrapped in React.memo', () => {
    expect(ratingStars).toMatch(/React\.memo\(function RatingStars/);
  });
});

describe('useCallback optimizations in page.tsx', () => {
  it('should import useCallback from React', () => {
    expect(pageSource).toMatch(/useCallback/);
  });

  it('handleToggleHeart should use useCallback', () => {
    expect(pageSource).toMatch(/handleToggleHeart = useCallback/);
  });

  it('should have userHeartedRef for stable handleToggleHeart', () => {
    expect(pageSource).toMatch(/userHeartedRef.*=.*useRef.*userHearted/);
  });
});

describe('Stable array references', () => {
  it('should have EMPTY_ARRAY constant', () => {
    expect(pageSource).toMatch(/const EMPTY_ARRAY.*never\[\].*=.*\[\]/);
  });

  it('should not use inline || [] for memoized component props (memos guarantee stable arrays)', () => {
    // activeRelatedMovies/activeRelatedBooks useMemos return [] (never undefined),
    // so props use the memo value directly — no || [] or || EMPTY_ARRAY needed
    expect(pageSource).toMatch(/movies={movies}/);
    expect(pageSource).toMatch(/books={related}/);
    // Should NOT have inline || [] which creates new array reference every render
    expect(pageSource).not.toMatch(/movies={movies \|\| \[\]}/);
    expect(pageSource).not.toMatch(/books={related \|\| \[\]}/);
  });
});
