/**
 * Guard tests for feed UI bugs found during FeedPage extraction.
 *
 * Ensures:
 * - Pull-to-refresh indicator doesn't block clicks (pointer-events-none + correct display logic)
 * - HeartButton size matches sibling action icons
 * - manifest.json uses relative paths (works in both dev and production)
 * - Favicon images have onError fallbacks for dead domains
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf-8');

const feedPageSource = read('app/components/FeedPage.tsx');
const heartButtonSource = read('app/components/HeartButton.tsx');
const analysisArticlesSource = read('app/components/AnalysisArticles.tsx');
const manifestJson = read('public/manifest.json');

describe('pull-to-refresh indicator does not block clicks', () => {
  it('indicator div should have pointer-events-none', () => {
    // The pull indicator at z-50 covers the filter button area.
    // Without pointer-events-none it blocks taps on the feed filter dropdown.
    expect(feedPageSource).toMatch(/feedPullIndicatorRef.*pointer-events-none/);
  });

  it('updateFeedPullDOM should hide indicator when dist is 0', () => {
    // Bug: was `dist > 0 ? '' : ''` — both branches identical, indicator never hidden.
    // Fix: `dist > 0 ? '' : 'none'`
    expect(feedPageSource).toMatch(/\.display\s*=\s*dist\s*>\s*0\s*\?\s*''\s*:\s*'none'/);
  });

  it('updateFeedPullDOM should NOT have identical ternary branches for display', () => {
    // Guard against regression: both branches returning '' means indicator stays visible forever
    expect(feedPageSource).not.toMatch(/\.display\s*=\s*dist\s*>\s*0\s*\?\s*''\s*:\s*''\s*;/);
  });
});

describe('HeartButton size matches sibling action icons', () => {
  it('default size should be 17 to match MessageCircle and Send', () => {
    // Feed renders Heart, MessageCircle, and Send at size={17}.
    // HeartButton default was 14, making it visually smaller.
    expect(heartButtonSource).toMatch(/size\s*=\s*17/);
  });

  it('feed action icons should all use the same size', () => {
    // MessageCircle and Send are rendered at size={17} in FeedPage
    const messageSizes = [...feedPageSource.matchAll(/MessageCircle\s+size=\{(\d+)\}/g)].map(m => m[1]);
    const sendSizes = [...feedPageSource.matchAll(/Send\s+size=\{(\d+)\}/g)].map(m => m[1]);
    const allSizes = [...messageSizes, ...sendSizes];
    // All should be the same size
    expect(allSizes.length).toBeGreaterThan(0);
    expect(new Set(allSizes).size).toBe(1);
  });
});

describe('manifest.json uses relative paths', () => {
  it('should not contain hardcoded /book_review/ prefix', () => {
    // Hardcoded /book_review/ causes 404 in dev mode (localhost:3000)
    // and on Capacitor (capacitor://localhost). Relative paths resolve
    // correctly in all environments.
    expect(manifestJson).not.toMatch(/\/book_review\//);
  });

  it('icon src should be a relative path', () => {
    const parsed = JSON.parse(manifestJson);
    for (const icon of parsed.icons) {
      expect(icon.src).not.toMatch(/^\//);
    }
  });
});

describe('favicon images have onError fallback', () => {
  it('FeedPage favicon img should have onError handler', () => {
    // Google favicon service returns 404 for dead domains (e.g. go.gale.com).
    // Without onError, the broken image pollutes the console.
    const faviconLine = feedPageSource.match(/google\.com\/s2\/favicons.*?\/>/s);
    expect(faviconLine).toBeTruthy();
    expect(faviconLine![0]).toContain('onError');
  });

  it('AnalysisArticles favicon img should have onError handler', () => {
    const faviconLine = analysisArticlesSource.match(/google\.com\/s2\/favicons.*?\/>/s);
    expect(faviconLine).toBeTruthy();
    expect(faviconLine![0]).toContain('onError');
  });
});
