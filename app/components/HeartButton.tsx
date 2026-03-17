'use client';

import React from 'react';
import { Heart } from 'lucide-react';

interface HeartButtonProps {
  contentHash: string;
  count: number;
  isHearted: boolean;
  onToggle: (contentHash: string) => void;
  size?: number;
}

function HeartButton({ contentHash, count, isHearted, onToggle, size = 14 }: HeartButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(contentHash);
      }}
      className="flex items-center gap-1"
    >
      <Heart
        size={size}
        className={isHearted ? 'fill-pink-500 text-pink-500' : 'text-slate-600 dark:text-slate-400'}
      />
      {count > 0 && (
        <span className={`text-xs font-medium ${isHearted ? 'text-pink-500' : 'text-slate-400'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

export default HeartButton;
