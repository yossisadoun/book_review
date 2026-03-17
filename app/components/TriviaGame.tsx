'use client';

import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import { Play, ChevronLeft, Volume2, VolumeX, BookOpen, Trophy } from 'lucide-react';
import triviaAnimation from '@/public/trivia.json';
import { featureFlags } from '@/lib/feature-flags';
import { getAssetPath, glassmorphicStyle } from './utils';
import { triggerMediumHaptic, triggerSuccessHaptic, triggerErrorHaptic } from '@/lib/capacitor';
import { analytics } from '../services/analytics-service';
import {
  setTriviaQuestionsCountRefreshCallback,
  countBooksWithTriviaQuestions,
  loadRandomTriviaQuestions,
} from '../services/trivia-service';

interface TriviaQuestion {
  question: string;
  correct_answer: string;
  wrong_answers: string[];
  book_title?: string;
  book_author?: string;
}

interface TriviaBook {
  id: string;
  title: string;
  author: string | null;
  cover_url?: string | null;
  reading_status?: string | null;
}

export interface TriviaGameHandle {
  close: () => void;
  isPlaying: boolean;
}

interface TriviaGameProps {
  books: TriviaBook[];
  isLoaded: boolean;
  user: any;
  showBookshelfCovers: boolean;
  viewingUserId: string | null;
  isSelectMode: boolean;
  isReviewer: boolean;
}

function TriviaCover({ src, alt, index, coverW, coverH, overlapPx }: {
  src: string; alt: string; index: number; coverW: number; coverH: number; overlapPx: number;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="absolute top-0"
      style={{ left: index * (coverW - overlapPx), zIndex: index, width: coverW, height: coverH }}
    >
      <motion.div
        animate={{ opacity: loaded ? 0 : [0.5, 0.8, 0.5] }}
        transition={loaded ? { duration: 0.2 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-md bg-slate-300/50"
        style={{ border: '2px solid rgba(255,255,255,0.8)' }}
      />
      <motion.img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.35, delay: loaded ? index * 0.07 : 0, ease: 'easeOut' }}
        className="absolute inset-0 rounded-md object-cover shadow-md"
        style={{ width: coverW, height: coverH, border: '2px solid rgba(255,255,255,0.8)' }}
      />
    </div>
  );
}

const TriviaGame = forwardRef<TriviaGameHandle, TriviaGameProps>(function TriviaGame({ books, isLoaded, user, showBookshelfCovers, viewingUserId, isSelectMode, isReviewer }, ref) {
  // Trivia Game state
  const [isPlayingTrivia, setIsPlayingTrivia] = useState(false);
  const [triviaQuestions, setTriviaQuestions] = useState<TriviaQuestion[]>([]);
  const [triviaFirstPlayTimestamp, setTriviaFirstPlayTimestamp] = useState<number | null>(null);
  const [currentTriviaQuestionIndex, setCurrentTriviaQuestionIndex] = useState(0);
  const [triviaScore, setTriviaScore] = useState(0);
  const [selectedTriviaAnswer, setSelectedTriviaAnswer] = useState<string | null>(null);
  const [isTriviaLoading, setIsTriviaLoading] = useState(false);
  const [triviaGameComplete, setTriviaGameComplete] = useState(false);
  const [triviaSelectedAnswers, setTriviaSelectedAnswers] = useState<Map<number, string>>(new Map());
  const [isTriviaTransitioning, setIsTriviaTransitioning] = useState(false);
  const [triviaShuffledAnswers, setTriviaShuffledAnswers] = useState<string[]>([]);
  const [isTriviaReady, setIsTriviaReady] = useState(false);
  const [isTriviaMuted, setIsTriviaMuted] = useState(false);
  const [triviaAnswerFeedback, setTriviaAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [booksWithTriviaQuestions, setBooksWithTriviaQuestions] = useState<number>(0);
  const [triviaQuestionsRefreshTrigger, setTriviaQuestionsRefreshTrigger] = useState(0);
  const [nextQuestionsCountdown, setNextQuestionsCountdown] = useState<{hours: number; minutes: number; seconds: number} | null>(null);
  const [showTriviaTooltip, setShowTriviaTooltip] = useState(false);

  const triviaAudioRef = useRef<HTMLAudioElement | null>(null);
  const triviaLottieRef = useRef<any>(null);
  const prevTriviaGameCompleteRef = useRef(false);
  const triviaButtonMountRef = useRef(0);

  // Reset trivia button delay when leaving bookshelf
  if (!showBookshelfCovers) triviaButtonMountRef.current = 0;

  useImperativeHandle(ref, () => ({
    close: () => setIsPlayingTrivia(false),
    get isPlaying() { return isPlayingTrivia; },
  }), [isPlayingTrivia]);

  // Update count of books with trivia questions
  useEffect(() => {
    const refreshCount = () => {
      if (isLoaded && user) {
        const readBooks = books.filter(b => b.reading_status === 'read_it').map(b => ({ title: b.title, author: b.author || '' }));
        countBooksWithTriviaQuestions(readBooks).then(count => {
          setBooksWithTriviaQuestions(count);
        }).catch(err => {
          console.error('[App] Error counting books with trivia questions:', err);
        });
      }
    };

    setTriviaQuestionsCountRefreshCallback(refreshCount);
    refreshCount();

    return () => {
      setTriviaQuestionsCountRefreshCallback(null);
    };
  }, [isLoaded, user, books.length, triviaQuestionsRefreshTrigger]);

  // Ensure trivia answers are shuffled when question changes
  useEffect(() => {
    if (triviaQuestions.length > 0 && currentTriviaQuestionIndex < triviaQuestions.length && triviaShuffledAnswers.length === 0) {
      const q = triviaQuestions[currentTriviaQuestionIndex];
      const shuffled = [q.correct_answer, ...q.wrong_answers].sort(() => Math.random() - 0.5);
      setTriviaShuffledAnswers(shuffled);
    }
  }, [triviaQuestions, currentTriviaQuestionIndex, triviaShuffledAnswers.length]);

  // Fire confetti when trivia game completes
  useEffect(() => {
    if (triviaGameComplete && !prevTriviaGameCompleteRef.current) {
      analytics.trackEvent('trivia', 'complete', { score: triviaScore, total: triviaQuestions.length });
      const confettiSound = new Audio(getAssetPath('/confetti-pop-sound.mp3'));
      confettiSound.volume = 0.5;
      confettiSound.play().catch(err => {
        console.warn('Failed to play confetti sound:', err);
      });

      if (typeof window !== 'undefined' && (window as any).confetti) {
        const count = 200;
        const defaults = { origin: { y: 0.7 } };

        function fire(particleRatio: number, opts: any) {
          (window as any).confetti(
            Object.assign({}, defaults, opts, {
              particleCount: Math.floor(count * particleRatio),
            })
          );
        }

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
      }
    }
    prevTriviaGameCompleteRef.current = triviaGameComplete;
  }, [triviaGameComplete]);

  // Load trivia first play timestamp from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('triviaFirstPlayTimestamp');
      if (saved) {
        const timestamp = parseInt(saved, 10);
        if (!isNaN(timestamp)) {
          setTriviaFirstPlayTimestamp(timestamp);
        }
      }
    } catch (err) {
      console.warn('[Trivia Timer] Error loading timestamp from localStorage:', err);
    }
  }, []);

  // Calculate countdown to next batch of questions (24 hours)
  useEffect(() => {
    if (!triviaFirstPlayTimestamp) {
      setNextQuestionsCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const timeUntilNext = (triviaFirstPlayTimestamp! + twentyFourHours) - now;

      if (timeUntilNext <= 0) {
        const newTimestamp = Date.now();
        setTriviaFirstPlayTimestamp(newTimestamp);
        try {
          localStorage.setItem('triviaFirstPlayTimestamp', newTimestamp.toString());
        } catch (err) {
          console.warn('[Trivia Timer] Error saving timestamp to localStorage:', err);
        }
        const newTimeUntilNext = twentyFourHours;
        const hours = Math.floor(newTimeUntilNext / (60 * 60 * 1000));
        const minutes = Math.floor((newTimeUntilNext % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((newTimeUntilNext % (60 * 1000)) / 1000);
        setNextQuestionsCountdown({ hours, minutes, seconds });
      } else {
        const hours = Math.floor(timeUntilNext / (60 * 60 * 1000));
        const minutes = Math.floor((timeUntilNext % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeUntilNext % (60 * 1000)) / 1000);
        setNextQuestionsCountdown({ hours, minutes, seconds });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [triviaFirstPlayTimestamp]);

  // Control trivia theme music playback
  useEffect(() => {
    if (triviaAudioRef.current) {
      const audio = triviaAudioRef.current;
      audio.muted = isTriviaMuted;

      if (isPlayingTrivia && triviaQuestions.length > 0 && !triviaGameComplete && !isTriviaReady && !isTriviaLoading) {
        audio.loop = true;
        audio.play().catch(err => {
          console.warn('Failed to play trivia theme:', err);
        });
      } else if (!isPlayingTrivia) {
        audio.pause();
      } else if (triviaGameComplete || isTriviaReady || isTriviaLoading) {
        audio.pause();
      }
    }
  }, [isPlayingTrivia, triviaQuestions.length, triviaGameComplete, isTriviaReady, isTriviaLoading, isTriviaMuted]);

  // Pause music when browser goes to background
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (triviaAudioRef.current) {
        const audio = triviaAudioRef.current;
        audio.muted = isTriviaMuted;
        if (document.hidden) {
          audio.pause();
        } else {
          if (isPlayingTrivia && triviaQuestions.length > 0 && !triviaGameComplete && !isTriviaReady && !isTriviaLoading) {
            audio.loop = true;
            audio.play().catch(err => {
              console.warn('Failed to resume trivia theme:', err);
            });
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlayingTrivia, triviaQuestions.length, triviaGameComplete, isTriviaReady, isTriviaLoading, isTriviaMuted]);

  const showButton = !isReviewer && showBookshelfCovers && !viewingUserId && !isSelectMode && books.length >= 5;

  return (
    <>
      {/* Floating Trivia button — peeks from right edge on bookshelf covers */}
      {showButton && (() => {
        if (!triviaButtonMountRef.current) triviaButtonMountRef.current = Date.now();
        const sinceMountMs = Date.now() - triviaButtonMountRef.current;
        const entranceDelay = sinceMountMs < 600 ? 0.6 : 0;
        return (
        <motion.button
          initial={{ x: 80 }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, delay: entranceDelay }}
          onClick={() => {
            triggerMediumHaptic();
            const minBooks = 5;
            if (books.length < minBooks) {
              setShowTriviaTooltip(true);
              setTimeout(() => setShowTriviaTooltip(false), 2000);
              return;
            }
            analytics.trackEvent('trivia', 'start', { question_count: triviaQuestions.length });
            setIsPlayingTrivia(true);
            // Only show ready screen if no questions loaded yet; otherwise go straight to game
            setIsTriviaReady(triviaQuestions.length === 0);
            setCurrentTriviaQuestionIndex(0);
            setTriviaScore(0);
            setSelectedTriviaAnswer(null);
            setTriviaAnswerFeedback(null);
            setTriviaGameComplete(false);
            setTriviaSelectedAnswers(new Map());
            setIsTriviaTransitioning(false);
            setTriviaShuffledAnswers([]);
          }}
          className="fixed z-[45] flex flex-col items-center gap-0.5 pl-2.5 pr-3.5 py-2 rounded-l-xl active:scale-95"
          style={{
            bottom: 'calc(16px + var(--safe-area-bottom, 0px))',
            right: '-10px',
            rotate: '-8deg',
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            borderRight: 'none',
            boxShadow: '-2px 2px 16px rgba(0, 0, 0, 0.08)',
          }}
        >
          <span className="text-[10px] font-bold text-slate-600 tracking-wider leading-none">DAILY</span>
          {featureFlags.hand_drawn_icons ? (
            <img src={getAssetPath("/Trophy.svg")} alt="Trivia" className="w-[20px] h-[20px]" />
          ) : (
            <Trophy size={20} style={{ color: '#FF007B' }} />
          )}
          <span className="text-[10px] font-bold text-slate-600 tracking-wider leading-none">TRIVIA</span>
          <AnimatePresence>
            {showTriviaTooltip && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white whitespace-nowrap pointer-events-none z-50"
                style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
              >
                Need 5 books to play
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
        );
      })()}

      {/* Trivia Game Overlay */}
      <AnimatePresence>
        {isPlayingTrivia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !triviaGameComplete) {
                setIsPlayingTrivia(false);
                if (triviaQuestions.length === 0) {
                  setIsTriviaReady(false);
                }
              }
            }}
          >
            {/* Trivia theme music */}
            <audio
              ref={triviaAudioRef}
              src={getAssetPath('/trivia_theme.mp3')}
              preload="auto"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onAnimationComplete={() => { if (triviaLottieRef.current) triviaLottieRef.current.goToAndPlay(0); }}
              className="w-full max-w-md bg-white/80 dark:bg-white/15 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30 dark:border-white/10 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Trivia Logo */}
              <AnimatePresence>
                {(isTriviaReady && !isTriviaLoading && !triviaGameComplete && triviaQuestions.length === 0) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                    style={{ top: 'calc(-10rem + 40px)' }}
                  >
                    <Lottie
                      lottieRef={triviaLottieRef}
                      animationData={triviaAnimation}
                      autoplay={false}
                      loop={false}
                      className="h-40 w-auto block mx-auto"
                      style={{ transform: 'scale(1.5)' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Handle bar */}
              <div className="w-full flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-slate-400 rounded-full" />
              </div>

              <div className="px-4 pb-6 max-h-[90vh] overflow-y-auto">
                  {isTriviaReady && !isTriviaLoading && !triviaGameComplete && triviaQuestions.length === 0 ? (
                  <div className="text-center">
                    <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50 mb-0">Ready to play!</h2>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mb-3">Tap to test your knowledge</p>
                    {/* Book covers for trivia-eligible books */}
                    {(() => {
                      const triviaBooks = books.filter(b => b.reading_status === 'read_it' && b.cover_url);
                      if (triviaBooks.length === 0) return null;
                      const maxCovers = 8;
                      const shown = triviaBooks.slice(0, maxCovers);
                      const overlapPx = 12;
                      const coverW = 40;
                      const coverH = 58;
                      const totalWidth = coverW + (shown.length - 1) * (coverW - overlapPx);
                      return (
                        <div className="flex justify-center mb-4">
                          <div className="relative" style={{ width: totalWidth, height: coverH }}>
                            {shown.map((book, i) => (
                              <TriviaCover
                                key={book.id}
                                src={book.cover_url!}
                                alt={book.title}
                                index={i}
                                coverW={coverW}
                                coverH={coverH}
                                overlapPx={overlapPx}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  <button
                    onClick={async () => {
                      setIsTriviaLoading(true);

                      try {
                        const shouldFetchNew = triviaQuestions.length === 0;

                        if (shouldFetchNew) {
                          const readBooks = books.filter(b => b.reading_status === 'read_it').map(b => ({ title: b.title, author: b.author || '' }));
                          const questions = await loadRandomTriviaQuestions(readBooks);
                          if (questions.length === 0) {
                            alert('No trivia questions available yet. Mark books as "Read" to generate questions!');
                            setIsTriviaLoading(false);
                            return;
                          }

                          if (questions.length < 11) {
                            console.warn(`[Trivia Game] Only ${questions.length} questions available, using all of them`);
                          }

                          setTriviaQuestions(questions);
                          const firstQ = questions[0];
                          const firstAnswers = [
                            firstQ.correct_answer,
                            ...firstQ.wrong_answers
                          ].sort(() => Math.random() - 0.5);
                          setTriviaShuffledAnswers(firstAnswers);
                        }

                        if (!triviaFirstPlayTimestamp) {
                          const timestamp = Date.now();
                          setTriviaFirstPlayTimestamp(timestamp);
                          try {
                            localStorage.setItem('triviaFirstPlayTimestamp', timestamp.toString());
                          } catch (err) {
                            console.warn('[Trivia Timer] Error saving timestamp to localStorage:', err);
                          }
                        }

                        setIsTriviaReady(false);
                      } catch (err) {
                        console.error('[Trivia Game] Error:', err);
                        alert('Error loading trivia questions. Please try again.');
                        setIsTriviaLoading(false);
                      } finally {
                        setIsTriviaLoading(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all text-white active:scale-95 shadow-sm"
                    style={{ background: '#2563eb' }}
                  >
                    <Play size={16} />
                    <span>Play</span>
                  </button>
                </div>
              ) : isTriviaLoading ? (
                <div className="w-full">
                  <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-xl p-4"
                    style={glassmorphicStyle}
                  >
                    <div className="h-12 flex items-center justify-center">
                      <div className="w-full h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
                    </div>
                  </motion.div>
                </div>
              ) : triviaGameComplete ? (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50">Trivia Complete!</h2>
                      <button
                        onClick={() => {
                          setIsPlayingTrivia(false);
                          setTriviaGameComplete(false);
                          setCurrentTriviaQuestionIndex(0);
                          setTriviaScore(0);
                          setSelectedTriviaAnswer(null);
                          setTriviaAnswerFeedback(null);
                          setTriviaSelectedAnswers(new Map());
                          setTriviaShuffledAnswers([]);
                          setIsTriviaReady(false);
                        }}
                        className="w-8 h-8 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-md hover:bg-white/85 border border-white/30 dark:border-white/10 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                      >
                        <ChevronLeft size={16} className="text-slate-700 dark:text-slate-300 rotate-90" />
                      </button>
                    </div>
                    <div className="rounded-xl p-4 mb-4 shadow-sm" style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center mb-2">Your Score</p>
                      <p className="text-slate-950 dark:text-slate-50 text-center text-2xl font-bold mb-2">{triviaScore} / {triviaQuestions.length}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                      {triviaScore === triviaQuestions.length
                        ? 'Perfect score! 🎉'
                        : triviaScore >= triviaQuestions.length * 0.8
                        ? 'Great job! 🎯'
                        : triviaScore >= triviaQuestions.length * 0.6
                        ? 'Good effort! 👍'
                        : 'Keep practicing! 📚'}
                    </p>
                  </div>

                    {/* Answers Summary */}
                    <div className="rounded-xl p-4 space-y-3 max-h-[50vh] overflow-y-auto shadow-sm" style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
                      <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-3">Answers Summary</h3>
                    {triviaQuestions.map((question, qIdx) => {
                      const selectedAnswer = triviaSelectedAnswers.get(qIdx);
                      const isCorrect = selectedAnswer === question.correct_answer;

                      return (
                        <div key={qIdx} className="border-b border-white/30 dark:border-white/10 pb-3 last:border-b-0 last:pb-0">
                          <p className="text-xs font-bold text-slate-950 dark:text-slate-50 mb-2">{qIdx + 1}. {question.question}</p>
                          <div className="space-y-1.5">
                            <div className="px-3 py-2 rounded-xl shadow-sm" style={{ background: isCorrect ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)', border: '1px solid rgba(255,255,255,0.2)' }}>
                              <p className="text-xs text-slate-800 dark:text-slate-200">Your answer: <span className="font-bold">{selectedAnswer || 'No answer'}</span></p>
                            </div>
                            {!isCorrect && (
                              <div className="px-3 py-2 rounded-xl shadow-sm" style={{ background: 'rgba(34,197,94,0.5)', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <p className="text-xs text-slate-800 dark:text-slate-200">Correct answer: <span className="font-bold">{question.correct_answer}</span></p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {nextQuestionsCountdown && triviaFirstPlayTimestamp ? (
                    <div className="bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl p-4 border border-slate-200/30 shadow-sm mt-4">
                      <p className="text-xs text-slate-700 dark:text-slate-300 text-center font-medium mb-3">New questions available in:</p>
                      <div className="flex justify-center">
                        <span className="countdown font-mono text-2xl">
                          <span
                            style={{ '--value': nextQuestionsCountdown.hours } as React.CSSProperties}
                            aria-live="polite"
                            aria-label={nextQuestionsCountdown.hours.toString()}
                          >
                            {nextQuestionsCountdown.hours}
                          </span>
                          {' : '}
                          <span
                            style={{ '--value': nextQuestionsCountdown.minutes, '--digits': 2 } as React.CSSProperties}
                            aria-live="polite"
                            aria-label={nextQuestionsCountdown.minutes.toString()}
                          >
                            {String(nextQuestionsCountdown.minutes).padStart(2, '0')}
                          </span>
                          {' : '}
                          <span
                            style={{ '--value': nextQuestionsCountdown.seconds, '--digits': 2 } as React.CSSProperties}
                            aria-live="polite"
                            aria-label={nextQuestionsCountdown.seconds.toString()}
                          >
                            {String(nextQuestionsCountdown.seconds).padStart(2, '0')}
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : triviaFirstPlayTimestamp ? (
                    <div className="bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl p-4 border border-slate-200/30 shadow-sm mt-4">
                      <p className="text-xs text-slate-700 dark:text-slate-300 text-center font-medium">
                        New questions available on next play!
                      </p>
                    </div>
                  ) : null}
                </motion.div>
              ) : triviaQuestions.length > 0 && currentTriviaQuestionIndex < triviaQuestions.length ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTriviaQuestionIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                    style={{ minHeight: '200px' }}
                  >
                      <div className="rounded-xl p-3 mb-3 shadow-sm" style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <div className="flex items-center justify-between">
                          <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50">Trivia Game</h2>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setIsTriviaMuted(!isTriviaMuted)}
                              className="w-8 h-8 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-md hover:bg-white/85 border border-white/30 dark:border-white/10 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                              aria-label={isTriviaMuted ? 'Unmute music' : 'Mute music'}
                            >
                              {isTriviaMuted ? (
                                <VolumeX size={14} className="text-slate-700 dark:text-slate-300" />
                              ) : (
                                <Volume2 size={14} className="text-slate-700 dark:text-slate-300" />
                              )}
                            </button>
                            <span className="text-xs text-slate-700 dark:text-slate-300">
                              Question {currentTriviaQuestionIndex + 1} / {triviaQuestions.length}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl p-4 mb-4 shadow-sm" style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
                        {(() => {
                          const currentQuestion = triviaQuestions[currentTriviaQuestionIndex];
                          const normalizedTitle = (currentQuestion.book_title || '').toLowerCase().trim();
                          const normalizedAuthor = (currentQuestion.book_author || '').toLowerCase().trim();
                          const sourceBook = books.find(
                            (book) =>
                              (book.title || '').toLowerCase().trim() === normalizedTitle &&
                              (book.author || '').toLowerCase().trim() === normalizedAuthor
                          );
                          if (!sourceBook) return null;
                          return (
                            <div className="flex items-center gap-3 mb-3">
                              {sourceBook.cover_url ? (
                                <img
                                  src={sourceBook.cover_url}
                                  alt={sourceBook.title}
                                  className="w-10 h-14 object-cover rounded-lg flex-shrink-0"
                                  style={{ border: '2px solid rgba(255, 255, 255, 0.6)' }}
                                />
                              ) : (
                                <div className="w-10 h-14 bg-white/60 dark:bg-white/12 rounded-lg flex-shrink-0 flex items-center justify-center">
                                  <BookOpen size={14} className="text-slate-500 dark:text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[11px] text-slate-600 dark:text-slate-400">From</p>
                                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{sourceBook.title}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{sourceBook.author}</p>
                              </div>
                            </div>
                          );
                        })()}
                        <p className="text-xs font-bold text-slate-950 dark:text-slate-50 mb-4">
                          {triviaQuestions[currentTriviaQuestionIndex].question}
                        </p>

                      <div className="space-y-2">
                        {triviaShuffledAnswers.map((answer, idx) => {
                          const currentQuestion = triviaQuestions[currentTriviaQuestionIndex];
                          const isSelected = selectedTriviaAnswer === answer;
                          const isCorrect = answer === currentQuestion.correct_answer;
                          const showFeedback = triviaAnswerFeedback !== null;

                          const feedbackState = isSelected && showFeedback
                            ? (isCorrect ? 'correct' : 'incorrect')
                            : isSelected ? 'selected'
                            : (selectedTriviaAnswer !== null && showFeedback && isCorrect) ? 'reveal-correct'
                            : (selectedTriviaAnswer !== null) ? 'dimmed'
                            : 'default';
                          let extraClass = feedbackState === 'dimmed' ? 'opacity-50' : '';

                          return (
                            <div
                              key={idx}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.preventDefault();
                                if (selectedTriviaAnswer === null) {
                                  setSelectedTriviaAnswer(answer);
                                  setTriviaSelectedAnswers(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(currentTriviaQuestionIndex, answer);
                                    return newMap;
                                  });

                                  const wasCorrect = answer === currentQuestion.correct_answer;
                                  if (wasCorrect) {
                                    triggerSuccessHaptic();
                                    setTriviaScore(prev => prev + 1);
                                  } else {
                                    triggerErrorHaptic();
                                  }

                                  setTriviaAnswerFeedback(wasCorrect ? 'correct' : 'incorrect');

                                  setTimeout(() => {
                                    setIsTriviaTransitioning(true);
                                    setTimeout(() => {
                                      if (currentTriviaQuestionIndex < triviaQuestions.length - 1) {
                                        const nextQ = triviaQuestions[currentTriviaQuestionIndex + 1];
                                        const nextAnswers = [
                                          nextQ.correct_answer,
                                          ...nextQ.wrong_answers
                                        ].sort(() => Math.random() - 0.5);
                                        setTriviaShuffledAnswers(nextAnswers);
                                        setCurrentTriviaQuestionIndex(prev => prev + 1);
                                        setSelectedTriviaAnswer(null);
                                        setTriviaAnswerFeedback(null);
                                        setIsTriviaTransitioning(false);
                                      } else {
                                        setTriviaGameComplete(true);
                                      }
                                    }, 150);
                                  }, 500);
                                }
                              }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all duration-200 relative overflow-hidden ${
                                selectedTriviaAnswer === null ? 'cursor-pointer active:scale-[0.98]' : 'pointer-events-none'
                              } ${extraClass}`}
                              style={{ minHeight: '40px', display: 'flex', alignItems: 'center' }}
                            >
                              <div
                                className="absolute inset-0 rounded-xl transition-all duration-200"
                                style={{
                                  background: feedbackState === 'incorrect' ? 'rgba(239,68,68,0.5)'
                                    : feedbackState === 'correct' ? 'rgba(34,197,94,0.5)'
                                    : feedbackState === 'selected' ? 'rgba(226,232,240,0.8)'
                                    : feedbackState === 'reveal-correct' ? '#86efac'
                                    : 'rgba(255,255,255,1)',
                                }}
                              />
                              <div className={`flex items-center justify-between w-full relative z-10 ${
                                feedbackState === 'incorrect' || feedbackState === 'correct' ? 'text-slate-950 dark:text-slate-50' : 'text-slate-950 dark:text-slate-50'
                              }`}>
                                <span>{answer}</span>
                                {isSelected && showFeedback && (
                                  <span className="text-sm font-black">
                                    {isCorrect ? '✓' : '✗'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : null}
              </div>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>
    </>
  );
});

export default TriviaGame;
