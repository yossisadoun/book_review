import React, { useCallback } from 'react';
import HeartButton from '@/app/components/HeartButton';
import type {
  PodcastEpisode,
  AnalysisArticle,
  YouTubeVideo,
  RelatedBook,
  RelatedMovie,
} from '@/app/types';

type InsightItem = { text: string; sourceUrl?: string; label: string };

interface UseBookDetailCardCallbacksArgs {
  currentInsights: InsightItem[];
  combinedPodcastEpisodes: PodcastEpisode[];
  activeVideos: YouTubeVideo[];
  activeArticles: AnalysisArticle[];
  activeRelatedMovies: RelatedMovie[];
  activeRelatedBooks: RelatedBook[];
  heartCounts: Map<string, number>;
  userHearted: Set<string>;
  getContentHash: (type: string, content: string) => string;
  onToggleHeart: (contentHash: string) => void;
  handlePinForLater: (content: string, type?: string, url?: string, imageUrl?: string) => void;
  isContentPinned: (content: string) => boolean;
}

export function useBookDetailCardCallbacks({
  currentInsights,
  combinedPodcastEpisodes,
  activeVideos,
  activeArticles,
  activeRelatedMovies,
  activeRelatedBooks,
  heartCounts,
  userHearted,
  getContentHash,
  onToggleHeart,
  handlePinForLater,
  isContentPinned,
}: UseBookDetailCardCallbacksArgs) {
  const renderInsightsHeartAction = useCallback((idx: number) => {
    const insight = currentInsights[idx];
    const hash = getContentHash('insight', insight?.text?.substring(0, 50) || '');
    return (
      <HeartButton
        contentHash={hash}
        count={heartCounts.get(hash) || 0}
        isHearted={userHearted.has(hash)}
        onToggle={onToggleHeart}
        size={17}
      />
    );
  }, [currentInsights, getContentHash, heartCounts, userHearted, onToggleHeart]);

  const pinInsightItem = useCallback((idx: number) => {
    const insight = currentInsights[idx];
    if (insight) handlePinForLater(insight.text, 'insight');
  }, [currentInsights, handlePinForLater]);

  const isInsightItemPinned = useCallback((idx: number) => {
    const insight = currentInsights[idx];
    return insight ? isContentPinned(insight.text) : false;
  }, [currentInsights, isContentPinned]);

  const renderPodcastHeartAction = useCallback((idx: number) => {
    const episode = combinedPodcastEpisodes[idx];
    const hash = getContentHash('podcast', episode?.url || '');
    return (
      <HeartButton
        contentHash={hash}
        count={heartCounts.get(hash) || 0}
        isHearted={userHearted.has(hash)}
        onToggle={onToggleHeart}
        size={17}
      />
    );
  }, [combinedPodcastEpisodes, getContentHash, heartCounts, userHearted, onToggleHeart]);

  const pinPodcastItem = useCallback((idx: number) => {
    const ep = combinedPodcastEpisodes[idx];
    if (ep) handlePinForLater(`${ep.podcast_name || 'Podcast'} — ${ep.title}`, 'podcast', ep.url || ep.audioUrl, ep.thumbnail);
  }, [combinedPodcastEpisodes, handlePinForLater]);

  const isPodcastItemPinned = useCallback((idx: number) => {
    const ep = combinedPodcastEpisodes[idx];
    return ep ? isContentPinned(`${ep.podcast_name || 'Podcast'} — ${ep.title}`) : false;
  }, [combinedPodcastEpisodes, isContentPinned]);

  const renderYouTubeHeartAction = useCallback((idx: number) => {
    const video = activeVideos[idx];
    const hash = getContentHash('youtube', video?.videoId || '');
    return (
      <HeartButton
        contentHash={hash}
        count={heartCounts.get(hash) || 0}
        isHearted={userHearted.has(hash)}
        onToggle={onToggleHeart}
        size={17}
      />
    );
  }, [activeVideos, getContentHash, heartCounts, userHearted, onToggleHeart]);

  const pinYouTubeItem = useCallback((idx: number) => {
    const v = activeVideos[idx];
    if (v) handlePinForLater(`${v.title} — ${v.channelTitle}`, 'youtube', v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : undefined, v.thumbnail);
  }, [activeVideos, handlePinForLater]);

  const isYouTubeItemPinned = useCallback((idx: number) => {
    const v = activeVideos[idx];
    return v ? isContentPinned(`${v.title} — ${v.channelTitle}`) : false;
  }, [activeVideos, isContentPinned]);

  const renderArticleHeartAction = useCallback((idx: number) => {
    const article = activeArticles[idx];
    const hash = getContentHash('article', article?.url || '');
    return (
      <HeartButton
        contentHash={hash}
        count={heartCounts.get(hash) || 0}
        isHearted={userHearted.has(hash)}
        onToggle={onToggleHeart}
        size={17}
      />
    );
  }, [activeArticles, getContentHash, heartCounts, userHearted, onToggleHeart]);

  const pinArticleItem = useCallback((idx: number) => {
    const article = activeArticles[idx];
    if (article) handlePinForLater(`${article.title}${article.url ? ` — ${article.url}` : ''}`, 'article', article.url);
  }, [activeArticles, handlePinForLater]);

  const isArticleItemPinned = useCallback((idx: number) => {
    const article = activeArticles[idx];
    return article ? isContentPinned(`${article.title}${article.url ? ` — ${article.url}` : ''}`) : false;
  }, [activeArticles, isContentPinned]);

  const renderRelatedMovieHeartAction = useCallback((idx: number) => {
    const movie = activeRelatedMovies[idx];
    const hash = getContentHash('related_work', movie?.title || '');
    return (
      <HeartButton
        contentHash={hash}
        count={heartCounts.get(hash) || 0}
        isHearted={userHearted.has(hash)}
        onToggle={onToggleHeart}
        size={17}
      />
    );
  }, [activeRelatedMovies, getContentHash, heartCounts, userHearted, onToggleHeart]);

  const pinRelatedMovieItem = useCallback((idx: number) => {
    const movie = activeRelatedMovies[idx];
    if (movie) handlePinForLater(`${movie.title} (${movie.type}) — ${movie.director}`, movie.type, movie.itunes_url, movie.poster_url || movie.itunes_artwork);
  }, [activeRelatedMovies, handlePinForLater]);

  const isRelatedMovieItemPinned = useCallback((idx: number) => {
    const movie = activeRelatedMovies[idx];
    return movie ? isContentPinned(`${movie.title} (${movie.type}) — ${movie.director}`) : false;
  }, [activeRelatedMovies, isContentPinned]);

  const renderRelatedBookHeartAction = useCallback((idx: number) => {
    const book = activeRelatedBooks[idx];
    const hash = getContentHash('related_book', book?.title || '');
    return (
      <HeartButton
        contentHash={hash}
        count={heartCounts.get(hash) || 0}
        isHearted={userHearted.has(hash)}
        onToggle={onToggleHeart}
        size={17}
      />
    );
  }, [activeRelatedBooks, getContentHash, heartCounts, userHearted, onToggleHeart]);

  const pinRelatedBookItem = useCallback((idx: number) => {
    const book = activeRelatedBooks[idx];
    if (book) handlePinForLater(`${book.title} by ${book.author}`, 'book', book.wikipedia_url || book.google_books_url, book.cover_url || book.thumbnail);
  }, [activeRelatedBooks, handlePinForLater]);

  const isRelatedBookItemPinned = useCallback((idx: number) => {
    const book = activeRelatedBooks[idx];
    return book ? isContentPinned(`${book.title} by ${book.author}`) : false;
  }, [activeRelatedBooks, isContentPinned]);

  return {
    renderInsightsHeartAction,
    pinInsightItem,
    isInsightItemPinned,
    renderPodcastHeartAction,
    pinPodcastItem,
    isPodcastItemPinned,
    renderYouTubeHeartAction,
    pinYouTubeItem,
    isYouTubeItemPinned,
    renderArticleHeartAction,
    pinArticleItem,
    isArticleItemPinned,
    renderRelatedMovieHeartAction,
    pinRelatedMovieItem,
    isRelatedMovieItemPinned,
    renderRelatedBookHeartAction,
    pinRelatedBookItem,
    isRelatedBookItemPinned,
  };
}
