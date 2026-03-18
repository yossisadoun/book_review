import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fireEvent, render } from '@testing-library/react';
import InsightsCards from '@/app/components/InsightsCards';

const TARGET_FILES = [
  'app/components/InsightsCards.tsx',
  'app/components/PodcastEpisodes.tsx',
  'app/components/YouTubeVideos.tsx',
  'app/components/AnalysisArticles.tsx',
  'app/components/RelatedBooks.tsx',
  'app/components/RelatedMovies.tsx',
];

describe('Sticky note pin style contracts', () => {
  it('uses a single pinned boolean and currentColor fill in all card components', () => {
    for (const relPath of TARGET_FILES) {
      const source = readFileSync(join(__dirname, '..', relPath), 'utf-8');
      expect(source).toContain('const pinned = !!isPinned?.(currentIndex);');
      expect(source).toContain("fill={pinned ? 'currentColor' : 'none'}");
      expect(source).toContain("className={pinned ? 'text-amber-400 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}");
    }
  });
});

describe('InsightsCards sticky note runtime behavior', () => {
  it('renders pinned icon with matching yellow fill and outline', () => {
    const onPin = vi.fn();
    const { container } = render(
      <InsightsCards
        insights={[{ text: 'hello', label: 'Trivia' }]}
        bookId="book-1"
        onPin={onPin}
        isPinned={() => true}
        showComment={false}
        showSend={false}
      />,
    );

    const icon = container.querySelector('svg.lucide-sticky-note');
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute('fill')).toBe('currentColor');
    expect(icon?.getAttribute('class')).toContain('text-amber-400');
  });

  it('clicking sticky note triggers onPin for current card index', () => {
    const onPin = vi.fn();
    const { getByRole } = render(
      <InsightsCards
        insights={[{ text: 'hello', label: 'Trivia' }]}
        bookId="book-1"
        onPin={onPin}
        isPinned={() => false}
        showComment={false}
        showSend={false}
      />,
    );

    fireEvent.click(getByRole('button'));
    expect(onPin).toHaveBeenCalledTimes(1);
    expect(onPin).toHaveBeenCalledWith(0);
  });
});
