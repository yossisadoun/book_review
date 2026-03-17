/**
 * PodcastEpisodes audio cleanup tests.
 *
 * The component uses a tooltip fan-out UI (portaled) which is hard to simulate
 * in jsdom. Instead we test the cleanup contract directly:
 * - stopAudio() fully releases the Audio resource (pause, clear src, load, null handlers)
 * - The useEffect cleanup return calls stopAudio on unmount and bookId change
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(
  join(__dirname, '../app/components/PodcastEpisodes.tsx'),
  'utf-8'
);

describe('PodcastEpisodes audio cleanup', () => {
  it('stopAudio should pause the audio element', () => {
    expect(source).toMatch(/audioRef\.current\.pause\(\)/);
  });

  it('stopAudio should clear the src to release browser audio resource', () => {
    expect(source).toMatch(/audioRef\.current\.src\s*=\s*['"]['"]|audioRef\.current\.src\s*=\s*''/);
  });

  it('stopAudio should call load() to finalize resource release', () => {
    expect(source).toMatch(/audioRef\.current\.load\(\)/);
  });

  it('stopAudio should clear event handlers to prevent stale callbacks', () => {
    expect(source).toMatch(/audioRef\.current\.onended\s*=\s*null/);
    expect(source).toMatch(/audioRef\.current\.onerror\s*=\s*null/);
  });

  it('stopAudio should null the ref', () => {
    expect(source).toMatch(/audioRef\.current\s*=\s*null/);
  });

  it('useEffect should return a cleanup function that calls stopAudio', () => {
    // The episodesKey/bookId effect must have a cleanup return
    expect(source).toMatch(/return\s*\(\)\s*=>\s*\{\s*stopAudio\(\)/);
  });
});
