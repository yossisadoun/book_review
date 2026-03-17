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

describe('pull-to-refresh uses useRef instead of useState', () => {
  it('feedPullDistance should be a useRef, not useState', () => {
    expect(pageSource).not.toMatch(/useState.*feedPullDistance|\[feedPullDistance,\s*set/);
    expect(pageSource).toMatch(/useRef.*feedPullDistance|feedPullDistance\s*=\s*useRef/);
  });

  it('chatPullDistance should be a useRef, not useState', () => {
    expect(pageSource).not.toMatch(/useState.*chatPullDistance|\[chatPullDistance,\s*set/);
    expect(pageSource).toMatch(/useRef.*chatPullDistance|chatPullDistance\s*=\s*useRef/);
  });

  it('should not have setFeedPullDistance or setChatPullDistance calls', () => {
    expect(pageSource).not.toContain('setFeedPullDistance');
    expect(pageSource).not.toContain('setChatPullDistance');
  });

  it('touch handlers should read from .current', () => {
    // The onTouchEnd threshold check should use .current
    expect(pageSource).toMatch(/feedPullDistance\.current\s*>=\s*30/);
    expect(pageSource).toMatch(/chatPullDistance\.current\s*>=\s*30/);
  });
});
