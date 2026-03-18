import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBookDetailCardCallbacks } from '@/app/hooks/useBookDetailCardCallbacks';
import type {
  PodcastEpisode,
  AnalysisArticle,
  YouTubeVideo,
  RelatedBook,
  RelatedMovie,
} from '@/app/types';

type HookArgs = Parameters<typeof useBookDetailCardCallbacks>[0];

function buildArgs(overrides: Partial<HookArgs> = {}): HookArgs {
  const currentInsights = [{ text: 'Insight one', label: 'Trivia' }];
  const combinedPodcastEpisodes: PodcastEpisode[] = [{
    title: 'Episode 1',
    url: 'https://pod.example/1',
    audioUrl: 'https://audio.example/1.mp3',
    platform: 'apple',
    podcast_name: 'Book Pod',
    episode_summary: 'summary',
    podcast_summary: 'pod summary',
    thumbnail: 'https://img.example/pod.jpg',
  }];
  const activeVideos: YouTubeVideo[] = [{
    id: 'id-1',
    title: 'Video 1',
    description: 'desc',
    thumbnail: 'https://img.example/yt.jpg',
    channelTitle: 'Channel',
    publishedAt: '2024-01-01',
    videoId: 'abc123',
  }];
  const activeArticles: AnalysisArticle[] = [{
    title: 'Article 1',
    snippet: 'snippet',
    url: 'https://scholar.example/1',
  }];
  const activeRelatedMovies: RelatedMovie[] = [{
    title: 'Movie 1',
    type: 'movie',
    director: 'Director 1',
    reason: 'Because',
    poster_url: 'https://img.example/movie.jpg',
    itunes_artwork: 'https://img.example/movie-itunes.jpg',
    itunes_url: 'https://itunes.example/movie',
  }];
  const activeRelatedBooks: RelatedBook[] = [{
    title: 'Related Book 1',
    author: 'Author 1',
    reason: 'Because',
    cover_url: 'https://img.example/book.jpg',
    wikipedia_url: 'https://wikipedia.example/book',
  }];

  return {
    currentInsights,
    combinedPodcastEpisodes,
    activeVideos,
    activeArticles,
    activeRelatedMovies,
    activeRelatedBooks,
    heartCounts: new Map([['insight:Insight one', 2]]),
    userHearted: new Set(['insight:Insight one']),
    getContentHash: (type: string, content: string) => `${type}:${content}`,
    onToggleHeart: vi.fn(),
    handlePinForLater: vi.fn(),
    isContentPinned: vi.fn(() => false),
    ...overrides,
  };
}

describe('useBookDetailCardCallbacks', () => {
  it('keeps callback identity stable across unrelated rerenders', () => {
    const baseArgs = buildArgs();
    const { result, rerender } = renderHook(
      ({ noise, ...args }: HookArgs & { noise: number }) => {
        void noise;
        return useBookDetailCardCallbacks(args);
      },
      { initialProps: { ...baseArgs, noise: 0 } },
    );

    const firstInsightsRender = result.current.renderInsightsHeartAction;
    const firstPodcastPin = result.current.pinPodcastItem;
    const firstRelatedBookPinned = result.current.isRelatedBookItemPinned;

    rerender({ ...baseArgs, noise: 1 });

    expect(result.current.renderInsightsHeartAction).toBe(firstInsightsRender);
    expect(result.current.pinPodcastItem).toBe(firstPodcastPin);
    expect(result.current.isRelatedBookItemPinned).toBe(firstRelatedBookPinned);
  });

  it('changes only callbacks tied to changed dependencies', () => {
    const baseArgs = buildArgs();
    const { result, rerender } = renderHook(
      (args: HookArgs) => useBookDetailCardCallbacks(args),
      { initialProps: baseArgs },
    );

    const firstInsightsRender = result.current.renderInsightsHeartAction;
    const firstPodcastRender = result.current.renderPodcastHeartAction;

    rerender({
      ...baseArgs,
      currentInsights: [...baseArgs.currentInsights],
    });

    expect(result.current.renderInsightsHeartAction).not.toBe(firstInsightsRender);
    expect(result.current.renderPodcastHeartAction).toBe(firstPodcastRender);
  });

  it('executes pin/pinned callbacks with expected content contracts', () => {
    const handlePinForLater = vi.fn();
    const isContentPinned = vi.fn((content: string) => content.includes('Video 1'));
    const args = buildArgs({ handlePinForLater, isContentPinned });
    const { result } = renderHook(() => useBookDetailCardCallbacks(args));

    result.current.pinPodcastItem(0);
    expect(handlePinForLater).toHaveBeenCalledWith(
      'Book Pod — Episode 1',
      'podcast',
      'https://pod.example/1',
      'https://img.example/pod.jpg',
    );

    const isPinned = result.current.isYouTubeItemPinned(0);
    expect(isPinned).toBe(true);
    expect(isContentPinned).toHaveBeenCalledWith('Video 1 — Channel');
  });
});
