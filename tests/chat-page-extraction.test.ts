/**
 * Guard tests for ChatPage extraction from page.tsx.
 *
 * Ensures:
 * - Moved state/refs no longer exist in page.tsx
 * - ChatPage is properly wired with required props
 * - Pull-to-refresh indicator has pointer-events-none and correct display logic
 * - dismissedChatIds is shared (exists in both page.tsx and ChatPage props)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf-8');

const pageSource = read('app/page.tsx');
const chatPageSource = read('app/components/ChatPage.tsx');

describe('moved state is removed from page.tsx', () => {
  const movedState = [
    'orphanedChatBook',
    'chatSwipeId',
    'deletingChatKey',
    'chatRefreshing',
    'chatRefreshDone',
    'chatRefreshFading',
  ];

  for (const name of movedState) {
    it(`should not have useState for ${name} in page.tsx`, () => {
      expect(pageSource).not.toMatch(new RegExp(`\\[${name},\\s*set`));
    });
  }

  const movedRefs = [
    'chatSwipeRef',
    'chatPullDistance',
    'chatPullStartY',
    'chatPullIndicatorRef',
    'chatPullContentRef',
    'chatPullLottieRef',
    'chatHapticFired',
    'chatLottieRef',
  ];

  for (const name of movedRefs) {
    it(`should not have useRef for ${name} in page.tsx`, () => {
      expect(pageSource).not.toMatch(new RegExp(`${name}\\s*=\\s*useRef`));
    });
  }

  it('should not have updateChatPullDOM function in page.tsx', () => {
    expect(pageSource).not.toContain('updateChatPullDOM');
  });

  it('should not have BookChat import in page.tsx', () => {
    expect(pageSource).not.toMatch(/import BookChat from/);
  });
});

describe('ChatPage is wired in page.tsx', () => {
  it('should import ChatPage', () => {
    expect(pageSource).toMatch(/ChatPage/);
  });

  it('should render <ChatPage with required props', () => {
    const chatPageBlock = pageSource.slice(
      pageSource.indexOf('<ChatPage'),
      pageSource.indexOf('/>', pageSource.indexOf('<ChatPage')) + 2
    );
    expect(chatPageBlock).toContain('chatBookSelected={chatBookSelected}');
    expect(chatPageBlock).toContain('unreadChatCounts={unreadChatCounts}');
    expect(chatPageBlock).toContain('handleAddBook={handleAddBook}');
    expect(chatPageBlock).toContain('headerPullRef={headerPullRef}');
    expect(chatPageBlock).toContain('dismissedChatIds={dismissedChatIds}');
  });
});

describe('shared state remains in page.tsx', () => {
  const sharedState = [
    'showChatPage',
    'chatBookSelected',
    'chatGeneralMode',
    'characterChatContext',
    'loadingCharacterChat',
    'chatList',
    'characterChatList',
    'chatListLoading',
    'unreadChatCounts',
    'dismissedChatIds',
  ];

  for (const name of sharedState) {
    it(`should still have useState for ${name} in page.tsx`, () => {
      expect(pageSource).toMatch(new RegExp(`\\[${name},\\s*set`));
    });
  }
});

describe('ChatPage pull-to-refresh safety', () => {
  it('pull indicator should have pointer-events-none', () => {
    expect(chatPageSource).toMatch(/chatPullIndicatorRef.*pointer-events-none/);
  });

  it('updateChatPullDOM should hide indicator when dist is 0', () => {
    expect(chatPageSource).not.toMatch(/\.display\s*=\s*dist\s*>\s*0\s*\?\s*''\s*:\s*''\s*;/);
  });
});
