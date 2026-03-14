'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

interface RatingStarsProps {
  value: number | null;
  onRate: (dimension: string, value: number | null) => void;
  dimension: string;
}

export const RATING_FEEDBACK: Record<number, string> = {
  0.5: "REALLY BAD!",
  1: "A BAD BOOK!",
  1.5: "PRETTY BAD",
  2: "MEH...",
  2.5: "JUST OK",
  3: "AN OK BOOK",
  3.5: "NOT BAD",
  4: "A GOOD BOOK",
  4.5: "A GREAT BOOK!",
  5: "A GREAAAAAT BOOK!",
};

function RatingStars({ value, onRate, dimension }: RatingStarsProps) {
  const [localValue, setLocalValue] = useState(value || 0);
  const [isLocked, setIsLocked] = useState(false);
  const [ratingFeedback, setRatingFeedback] = useState<string | null>(
    value ? RATING_FEEDBACK[value] : null
  );

  // Only sync from prop when dimension changes (new rating context)
  useEffect(() => {
    setLocalValue(value || 0);
    setIsLocked(false);
    setRatingFeedback(value ? RATING_FEEDBACK[value] : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension]);

  function handleStarClick(star: number, e: React.MouseEvent<HTMLButtonElement>) {
    if (isLocked) return;

    // Detect if click is on left or right half of the star
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeftHalf = clickX < rect.width / 2;

    const rating = isLeftHalf ? star - 0.5 : star;

    setIsLocked(true);
    setLocalValue(rating);
    setRatingFeedback(RATING_FEEDBACK[rating]);

    // Delay the onRate call to show feedback first
    setTimeout(() => {
      onRate(dimension, rating);
      setIsLocked(false);
    }, 400);
  }

  function handleSkip() {
    if (isLocked) return;
    setIsLocked(true);
    // Clear stars visually first
    setLocalValue(0);
    setRatingFeedback("SKIPPED");
    // Wait for animation then close
    setTimeout(() => {
      onRate(dimension, null);
      setIsLocked(false);
    }, 250);
  }

  const titleText = ratingFeedback || "RATING";

  // Render a star with proper fill based on localValue
  const renderStar = (star: number) => {
    const fillAmount = Math.max(0, Math.min(1, localValue - (star - 1)));
    const isFullyFilled = fillAmount >= 1;
    const isHalfFilled = fillAmount >= 0.5 && fillAmount < 1;
    const isEmpty = fillAmount < 0.5;

    return (
      <div className="relative w-8 h-8">
        {/* Background (empty) heart */}
        <Heart
          size={32}
          className="absolute inset-0 text-slate-300 fill-transparent transition-all duration-200"
        />
        {/* Filled heart with clip for half-heart support */}
        <div
          className="absolute inset-0 overflow-hidden transition-all duration-200"
          style={{
            width: isFullyFilled ? '100%' : isHalfFilled ? '50%' : '0%',
          }}
        >
          <Heart
            size={32}
            className={`fill-pink-500 text-pink-500 transition-all duration-200 ${
              fillAmount > 0 ? 'scale-110' : 'scale-100'
            }`}
            style={{ transitionDelay: fillAmount > 0 ? `${star * 30}ms` : '0ms' }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <AnimatePresence mode="wait">
        <motion.h3
          key={titleText}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="text-sm font-bold uppercase tracking-widest text-slate-950"
        >
          {titleText}
        </motion.h3>
      </AnimatePresence>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            onClick={(e) => handleStarClick(star, e)}
            className="p-1 focus:outline-none"
            whileTap={{ scale: 0.7 }}
          >
            {renderStar(star)}
          </motion.button>
        ))}
      </div>
      <button
        onClick={handleSkip}
        className="px-3 py-0.5 text-xs font-medium text-slate-950 hover:text-slate-700 active:scale-95 transition-all"
      >
        Skip
      </button>
    </div>
  );
}

export default RatingStars;
