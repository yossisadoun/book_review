'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Quote, BookHeart, BookOpen, Lightbulb, ListChecks, BookMarked,
  CheckCircle2, Circle,
  Target, Zap, ArrowRight, Globe, Sparkles, Eye, Brain, Flame,
  Tag,
} from 'lucide-react';
const frostedGlassStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.25)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '16px',
};
import type { BookSummary as BookSummaryType } from '../types';

const ICON_MAP_COLORED: Record<string, (color: string) => React.ReactNode> = {
  Target: (c) => <Target size={14} className={c} />,
  Zap: (c) => <Zap size={14} className={c} />,
  ArrowRight: (c) => <ArrowRight size={14} className={c} />,
  CheckCircle2: (c) => <CheckCircle2 size={14} className={c} />,
  Globe: (c) => <Globe size={14} className={c} />,
  Sparkles: (c) => <Sparkles size={14} className={c} />,
  BookOpen: (c) => <BookOpen size={14} className={c} />,
  Lightbulb: (c) => <Lightbulb size={14} className={c} />,
  Eye: (c) => <Eye size={14} className={c} />,
  Brain: (c) => <Brain size={14} className={c} />,
  Flame: (c) => <Flame size={14} className={c} />,
};

interface SummaryCard {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  accent: string;
  accentLight: string;
}

function buildCards(summary: BookSummaryType): SummaryCard[] {
  const cards: SummaryCard[] = [
    {
      id: 'quote_and_summary',
      label: summary.title,
      subtitle: summary.author,
      icon: <BookHeart size={20} className="text-slate-600 dark:text-slate-300" />,
      iconBg: 'rgba(99, 102, 241, 0.85)',
      iconBorder: 'rgba(99, 102, 241, 0.3)',
      accent: 'indigo',
      accentLight: 'rgba(99, 102, 241, 0.08)',
    },
  ];
  if (summary.cards?.length > 0) {
    cards.push({
      id: 'cards',
      label: summary.cardsTitle,
      subtitle: `${summary.cards.length} concepts`,
      icon: <BookHeart size={20} className="text-slate-600 dark:text-slate-300" />,
      iconBg: 'rgba(245, 158, 11, 0.85)',
      iconBorder: 'rgba(245, 158, 11, 0.3)',
      accent: 'amber',
      accentLight: 'rgba(245, 158, 11, 0.08)',
    });
  }
  if (summary.tasks?.length > 0) {
    cards.push({
      id: 'actions',
      label: summary.actionTitle,
      subtitle: `${summary.tasks.length} items`,
      icon: <BookHeart size={20} className="text-slate-600 dark:text-slate-300" />,
      iconBg: 'rgba(16, 185, 129, 0.85)',
      iconBorder: 'rgba(16, 185, 129, 0.3)',
      accent: 'emerald',
      accentLight: 'rgba(16, 185, 129, 0.08)',
    });
  }
  if (summary.glossary?.length > 0) {
    cards.push({
      id: 'glossary',
      label: summary.glossaryTitle,
      subtitle: `${summary.glossary.length} terms`,
      icon: <BookHeart size={20} className="text-slate-600 dark:text-slate-300" />,
      iconBg: 'rgba(168, 85, 247, 0.85)',
      iconBorder: 'rgba(168, 85, 247, 0.3)',
      accent: 'purple',
      accentLight: 'rgba(168, 85, 247, 0.08)',
    });
  }
  return cards;
}

interface BookSummaryProps {
  summary: BookSummaryType;
  bookId: string;
  isLoading?: boolean;
  infoCard?: React.ReactNode;
  firstIssueYear?: number | null;
  readersSection?: React.ReactNode;
}

function BookSummaryComponent({ summary, bookId, isLoading = false, infoCard, firstIssueYear, readersSection }: BookSummaryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`book-summary-tasks-${bookId}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;
  const prevBookId = useRef<string>('');

  useEffect(() => {
    if (bookId !== prevBookId.current) {
      prevBookId.current = bookId;
      setCurrentIndex(0);
      setIsVisible(true);
      try {
        const saved = localStorage.getItem(`book-summary-tasks-${bookId}`);
        setCompletedTasks(saved ? JSON.parse(saved) : {});
      } catch { setCompletedTasks({}); }
    }
  }, [bookId]);

  useEffect(() => {
    try {
      localStorage.setItem(`book-summary-tasks-${bookId}`, JSON.stringify(completedTasks));
    } catch { /* ignore */ }
  }, [completedTasks, bookId]);

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-2xl overflow-hidden"
          style={frostedGlassStyle}
        >
          <div className="flex items-center gap-3 px-4 pt-3 pb-2">
            <div className="w-10 h-10 rounded-full bg-slate-300/50 dark:bg-slate-600/50 animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="w-20 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
              <div className="w-40 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
            </div>
          </div>
          <div className="px-4 pb-4 space-y-2">
            <div className="w-full h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
            <div className="w-4/5 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
            <div className="w-3/5 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  const summaryCards = buildCards(summary);
  const hasInfoCard = !!infoCard;
  const totalCards = summaryCards.length + (hasInfoCard ? 1 : 0);

  function handleNext() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % totalCards);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : totalCards - 1));
      setIsVisible(true);
    }, 300);
  }

  const handleSwipe = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) handleNext();
      else handlePrev();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  // If infoCard exists, index 0 = info card, rest are summary cards offset by 1
  const isInfoCardActive = hasInfoCard && currentIndex === 0;
  const summaryCardIndex = hasInfoCard ? currentIndex - 1 : currentIndex;
  const card = isInfoCardActive ? null : summaryCards[summaryCardIndex];

  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...frostedGlassStyle,
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

  const completedCount = summary.tasks ? Object.values(completedTasks).filter(Boolean).length : 0;

  const renderCardContent = () => {
    if (!card) return null;
    switch (card.id) {
      case 'quote_and_summary':
        return (
          <>
            {/* Meta pills */}
            <div className="flex items-center gap-2 px-5 pb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300" style={{ background: 'rgba(100, 116, 139, 0.1)' }}>
                <Tag size={10} /> {summary.category}{firstIssueYear ? ` · ${firstIssueYear}` : ''}
              </span>
            </div>

            {/* Big Idea quote */}
            <div
              className="relative mx-3 rounded-xl overflow-hidden px-5 py-6"
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(9.4px)',
                WebkitBackdropFilter: 'blur(9.4px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              {/* Decorative opening mark — top-left */}
              <span className="absolute top-2 left-3 text-[72px] leading-none font-serif text-slate-500/40 dark:text-slate-400/35 select-none" style={{ fontFamily: 'Georgia, serif' }}>&ldquo;</span>

              {/* Quote text */}
              <p className="relative text-[15px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed pt-4">
                {summary.quote}
              </p>

              {/* Decorative closing mark — bottom-right */}
              <span className="absolute bottom-0 right-3 text-[72px] leading-none font-serif text-slate-500/40 dark:text-slate-400/35 select-none" style={{ fontFamily: 'Georgia, serif' }}>&rdquo;</span>
            </div>

            {/* Summary text */}
            <div className="px-5 pt-4 pb-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">Summary</p>
              <div className={summaryExpanded ? '' : 'line-clamp-4'}>
                {summary.summary.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className={`text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed ${idx > 0 ? 'mt-3' : ''}`}>
                    {paragraph}
                  </p>
                ))}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setSummaryExpanded(prev => !prev); }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-2"
              >
                {summaryExpanded ? 'Read less' : 'Read more'}
              </button>
              {readersSection && (
                <div className="mt-4 pt-3 border-t border-white/20 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
                  {readersSection}
                </div>
              )}
            </div>
          </>
        );

      case 'cards':
        return (
          <div className="px-3 pb-3 space-y-2">
            {summary.cards.map((c, i) => {
              const iconFn = ICON_MAP_COLORED[c.iconName];
              return (
                <div
                  key={i}
                  className="rounded-xl px-3.5 py-3 flex items-start gap-3"
                  style={{
                    background: 'rgba(255, 255, 255, 0.45)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}
                  >
                    {iconFn ? iconFn('text-slate-600 dark:text-slate-300') : <Lightbulb size={14} className="text-slate-600 dark:text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{c.step}: {c.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case 'actions':
        return (
          <div className="px-3" style={{ paddingBottom: '20px' }}>
            {/* Progress indicator */}
            {summary.tasks.length > 1 && (
              <div className="px-1 mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{completedCount}/{summary.tasks.length} done</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(100, 116, 139, 0.15)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${(completedCount / summary.tasks.length) * 100}%`,
                      background: 'linear-gradient(90deg, rgba(100, 116, 139, 0.5), rgba(100, 116, 139, 0.7))',
                    }}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              {summary.tasks.map((task, i) => {
                const done = !!completedTasks[i];
                return (
                  <div
                    key={i}
                    className="px-3.5 py-1.5 flex items-start gap-3 transition-all duration-200"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompletedTasks(prev => ({ ...prev, [i]: !prev[i] }));
                      }}
                      className="flex-shrink-0 mt-0.5 active:scale-90 transition-transform"
                    >
                      {done
                        ? <CheckCircle2 size={16} className="text-slate-600 dark:text-slate-300" />
                        : <Circle size={16} className="text-slate-600 dark:text-slate-300" />
                      }
                    </button>
                    <p className={`text-xs leading-relaxed transition-all duration-200 ${done ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                      {task.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'glossary':
        return (
          <div className="px-3 pb-3 space-y-2">
            {summary.glossary.map((item, i) => (
              <div
                key={i}
                className="rounded-xl px-3.5 py-3"
                style={{
                  background: 'rgba(255, 255, 255, 0.45)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                }}
              >
                <p className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide">{item.term}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-1">{item.def}</p>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      onClick={handleNext}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={handleSwipe}
      className="w-full cursor-pointer"
    >
      <div className="relative pb-3">
        {totalCards > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && isInfoCardActive && (
            <motion.div
              key="info-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={frostedGlassStyle}
            >
              <div className="px-4 py-3">
                {infoCard}
              </div>
              {totalCards > 1 && (
                <div className="absolute top-3 right-4">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {currentIndex + 1}/{totalCards}
                  </span>
                </div>
              )}
            </motion.div>
          )}
          {isVisible && !isInfoCardActive && card && (
            <motion.div
              key={`${card.id}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={frostedGlassStyle}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}
                >
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{card.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{card.subtitle}</p>
                </div>
                {totalCards > 1 && (
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {currentIndex + 1}/{totalCards}
                  </span>
                )}
              </div>

              {/* Content */}
              {renderCardContent()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default BookSummaryComponent;
