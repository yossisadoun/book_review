/**
 * Guard tests for TriviaGame extraction from page.tsx.
 *
 * Ensures:
 * - All trivia state/effects live in TriviaGame.tsx, not page.tsx
 * - page.tsx imports and renders TriviaGame with correct props
 * - TriviaGame exposes imperative handle for back button support
 * - TriviaCover helper moved to TriviaGame.tsx
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const pageSource = readFileSync(
  join(__dirname, '../app/page.tsx'),
  'utf-8'
);

const triviaSource = readFileSync(
  join(__dirname, '../app/components/TriviaGame.tsx'),
  'utf-8'
);

describe('TriviaGame extraction — page.tsx cleanup', () => {
  it('should not have any trivia useState declarations in page.tsx', () => {
    // All 17 trivia useState should be in TriviaGame, not page.tsx
    expect(pageSource).not.toMatch(/isPlayingTrivia.*useState/);
    expect(pageSource).not.toMatch(/triviaQuestions.*useState/);
    expect(pageSource).not.toMatch(/triviaScore.*useState/);
    expect(pageSource).not.toMatch(/triviaGameComplete.*useState/);
    expect(pageSource).not.toMatch(/isTriviaLoading.*useState/);
    expect(pageSource).not.toMatch(/isTriviaMuted.*useState/);
    expect(pageSource).not.toMatch(/showTriviaTooltip.*useState/);
  });

  it('should not have trivia useRef declarations in page.tsx', () => {
    expect(pageSource).not.toMatch(/useRef.*triviaAudioRef/);
    expect(pageSource).not.toMatch(/useRef.*triviaLottieRef/);
    expect(pageSource).not.toMatch(/useRef.*prevTriviaGameComplete/);
    expect(pageSource).not.toMatch(/useRef.*triviaButtonMount/);
  });

  it('should not have TriviaCover component in page.tsx', () => {
    expect(pageSource).not.toMatch(/function TriviaCover/);
  });

  it('should not import trivia animation JSON in page.tsx', () => {
    expect(pageSource).not.toMatch(/import.*triviaAnimation.*trivia\.json/);
  });

  it('should not import trivia service functions that moved to TriviaGame', () => {
    // These are only used inside TriviaGame now
    expect(pageSource).not.toMatch(/countBooksWithTriviaQuestions/);
    expect(pageSource).not.toMatch(/loadRandomTriviaQuestions/);
    expect(pageSource).not.toMatch(/setTriviaQuestionsCountRefreshCallback/);
  });

  it('should still import ensureTriviaQuestionsForBook (used in book add flow)', () => {
    expect(pageSource).toMatch(/ensureTriviaQuestionsForBook/);
  });
});

describe('TriviaGame extraction — page.tsx wiring', () => {
  it('should import TriviaGame component', () => {
    expect(pageSource).toMatch(/import TriviaGame from/);
  });

  it('should import TriviaGameHandle type', () => {
    expect(pageSource).toMatch(/import.*TriviaGameHandle/);
  });

  it('should render <TriviaGame with required props', () => {
    expect(pageSource).toMatch(/<TriviaGame/);
    expect(pageSource).toMatch(/ref={triviaGameRef}/);
    expect(pageSource).toMatch(/books={books}/);
    expect(pageSource).toMatch(/isLoaded={isLoaded}/);
    expect(pageSource).toMatch(/user={user}/);
    expect(pageSource).toMatch(/showBookshelfCovers={showBookshelfCovers}/);
    expect(pageSource).toMatch(/viewingUserId={viewingUserId}/);
    expect(pageSource).toMatch(/isSelectMode={isSelectMode}/);
    expect(pageSource).toMatch(/isReviewer={isReviewer}/);
  });

  it('should have triviaGameRef for back button support', () => {
    expect(pageSource).toMatch(/triviaGameRef.*useRef.*TriviaGameHandle/);
  });

  it('should use triviaGameRef in back button handler', () => {
    expect(pageSource).toMatch(/triviaGameRef\.current\?\.isPlaying/);
    expect(pageSource).toMatch(/triviaGameRef\.current\.close\(\)/);
  });
});

describe('TriviaGame component', () => {
  it('should use forwardRef with TriviaGameHandle', () => {
    expect(triviaSource).toMatch(/forwardRef.*TriviaGameHandle/);
  });

  it('should expose close() and isPlaying via useImperativeHandle', () => {
    expect(triviaSource).toMatch(/useImperativeHandle/);
    expect(triviaSource).toMatch(/close:.*setIsPlayingTrivia\(false\)/);
    expect(triviaSource).toMatch(/isPlaying/);
  });

  it('should contain TriviaCover helper component', () => {
    expect(triviaSource).toMatch(/function TriviaCover/);
  });

  it('should contain all trivia state', () => {
    expect(triviaSource).toMatch(/isPlayingTrivia.*useState/);
    expect(triviaSource).toMatch(/triviaQuestions.*useState/);
    expect(triviaSource).toMatch(/triviaScore.*useState/);
    expect(triviaSource).toMatch(/triviaGameComplete.*useState/);
    expect(triviaSource).toMatch(/isTriviaLoading.*useState/);
    expect(triviaSource).toMatch(/isTriviaMuted.*useState/);
    expect(triviaSource).toMatch(/showTriviaTooltip.*useState/);
  });

  it('should contain trivia music control effects', () => {
    expect(triviaSource).toMatch(/Control trivia theme music/);
    expect(triviaSource).toMatch(/Pause music when browser goes to background/);
  });

  it('should contain confetti effect', () => {
    expect(triviaSource).toMatch(/Fire confetti when trivia game completes/);
    expect(triviaSource).toMatch(/confetti-pop-sound/);
  });

  it('should render both the button and the modal overlay', () => {
    expect(triviaSource).toMatch(/Floating Trivia button/);
    expect(triviaSource).toMatch(/Trivia Game Overlay/);
  });

  it('should only set isTriviaReady when no questions exist (2nd play music fix)', () => {
    // Bug: on 2nd play, questions already exist so ready screen is skipped,
    // but isTriviaReady=true caused music effect to pause instead of play.
    // Fix: isTriviaReady should be conditional on questions length.
    expect(triviaSource).toMatch(/setIsTriviaReady\(triviaQuestions\.length === 0\)/);
  });

  it('should trigger haptics for correct and incorrect answers', () => {
    expect(triviaSource).toMatch(/triggerSuccessHaptic/);
    expect(triviaSource).toMatch(/triggerErrorHaptic/);
  });
});
