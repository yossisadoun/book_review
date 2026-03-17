/**
 * Guard tests for RelatedMovies fan menu dismiss behavior.
 *
 * Bug: MusicModal/WatchModal had a full-screen portal overlay (z-[9998])
 * with onClick={onClose}. When tapping the X button to close the fan menu,
 * both the overlay's onClick and the button's onClick fired (separate DOM trees,
 * stopPropagation doesn't cross portal boundaries). The overlay closed the modal,
 * then the button (now showing Play) reopened it.
 *
 * Fix: Removed the overlay. Dismissal is handled by the parent's onTouchStart
 * (same pattern as PodcastEpisodes tooltips).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const musicModalSource = readFileSync(
  join(__dirname, '../app/components/MusicModal.tsx'),
  'utf-8'
);

const watchModalSource = readFileSync(
  join(__dirname, '../app/components/WatchModal.tsx'),
  'utf-8'
);

const relatedMoviesSource = readFileSync(
  join(__dirname, '../app/components/RelatedMovies.tsx'),
  'utf-8'
);

describe('fan menu dismiss pattern', () => {
  it('MusicModal should not have a full-screen click overlay', () => {
    // A fixed inset-0 overlay with onClick causes double-fire with the X button
    expect(musicModalSource).not.toMatch(/className="fixed inset-0.*onClick/s);
  });

  it('WatchModal should not have a full-screen click overlay', () => {
    expect(watchModalSource).not.toMatch(/className="fixed inset-0.*onClick/s);
  });

  it('RelatedMovies parent onTouchStart should dismiss music and watch modals', () => {
    // The parent container's onTouchStart handles dismissal (same as PodcastEpisodes)
    expect(relatedMoviesSource).toMatch(
      /onTouchStart.*musicModalData.*setMusicModalData\(null\).*setWatchModalData\(null\)/s
    );
  });
});
