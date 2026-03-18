/**
 * Guard tests for the pull-to-refresh useRef refactor.
 *
 * Verifies that feedPullDistance and chatPullDistance use useRef (not useState),
 * eliminating ~60 re-renders/sec during touch drag.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const pageSource = readFileSync(join(__dirname, '../app/page.tsx'), 'utf-8');
const feedPageSource = readFileSync(join(__dirname, '../app/components/FeedPage.tsx'), 'utf-8');
const chatPageSource = readFileSync(join(__dirname, '../app/components/ChatPage.tsx'), 'utf-8');

describe('pull-to-refresh uses useRef instead of useState', () => {
  it('feedPullDistance should be a useRef, not useState', () => {
    expect(feedPageSource).not.toMatch(/useState.*feedPullDistance|\[feedPullDistance,\s*set/);
    expect(feedPageSource).toMatch(/useRef.*feedPullDistance|feedPullDistance\s*=\s*useRef/);
  });

  it('chatPullDistance should be a useRef, not useState', () => {
    expect(chatPageSource).not.toMatch(/useState.*chatPullDistance|\[chatPullDistance,\s*set/);
    expect(chatPageSource).toMatch(/useRef.*chatPullDistance|chatPullDistance\s*=\s*useRef/);
  });

  it('should not have setFeedPullDistance or setChatPullDistance calls', () => {
    expect(pageSource).not.toContain('setFeedPullDistance');
    expect(feedPageSource).not.toContain('setFeedPullDistance');
    expect(pageSource).not.toContain('setChatPullDistance');
    expect(chatPageSource).not.toContain('setChatPullDistance');
  });

  it('touch handlers should read from .current', () => {
    // The onTouchEnd threshold check should use .current
    expect(feedPageSource).toMatch(/feedPullDistance\.current\s*>=\s*30/);
    expect(chatPageSource).toMatch(/chatPullDistance\.current\s*>=\s*30/);
  });
});
