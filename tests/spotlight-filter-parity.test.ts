/**
 * Guard tests for spotlight candidate filters.
 *
 * The spotlight useMemo (in useBookDetailData hook) builds candidates from the
 * same Maps that child components (RelatedMovies, etc.) render. If the child
 * applies a filter that the spotlight doesn't, phantom empty items appear.
 *
 * These tests ensure filter parity between candidate creation and rendering.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const pageSource = readFileSync(join(__dirname, '../app/page.tsx'), 'utf-8');
const hookSource = readFileSync(join(__dirname, '../app/hooks/useBookDetailData.ts'), 'utf-8');
const relatedMoviesSource = readFileSync(join(__dirname, '../app/components/RelatedMovies.tsx'), 'utf-8');

describe('Spotlight candidate filter parity', () => {
  it('spotlight skips albums without itunes_url (matches RelatedMovies filter)', () => {
    // RelatedMovies filters: movies.filter(m => m.type !== 'album' || m.itunes_url)
    expect(relatedMoviesSource).toContain("m.type !== 'album' || m.itunes_url");

    // Spotlight candidates must apply the same filter (now in useBookDetailData hook)
    expect(hookSource).toContain("movie.type === 'album' && !movie.itunes_url");
  });

  it('spotlight skips movies/albums without artwork', () => {
    // In the spotlight useMemo (now in hook), movies without poster or itunes artwork are skipped
    expect(hookSource).toContain('!movie.poster_url && !movie.itunes_artwork');
  });

  it('spotlight pre-filters articles to exclude scholar placeholder URLs', () => {
    // The spotlight useMemo filters articles before building candidates (now in hook)
    const spotlightStart = hookSource.indexOf('const spotlightRecommendation = useMemo');
    const spotlightEnd = hookSource.indexOf('], [activeBook?.id, spotlightIndex', spotlightStart);
    const spotlightBlock = hookSource.slice(spotlightStart, spotlightEnd);
    expect(spotlightBlock).toContain("scholar.google.com/scholar?q=");
  });

  it('spotlight uses stable sort instead of Fisher-Yates shuffle', () => {
    // Fisher-Yates changes order when candidate count changes (causes stale items after fetches)
    // Hash-based sort is stable regardless of new candidates arriving (now in hook)
    const shuffleBlock = hookSource.slice(
      hookSource.indexOf('// Seeded sort'),
      hookSource.indexOf('const current = shuffled[')
    );
    expect(shuffleBlock).toContain('.sort(');
    expect(shuffleBlock).not.toMatch(/\[shuffled\[i\], shuffled\[j\]\]\s*=\s*\[shuffled\[j\], shuffled\[i\]\]/);
  });
});
