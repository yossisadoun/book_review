'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { CharacterAvatar } from '../types';

interface CharacterAvatarsProps {
  avatars: CharacterAvatar[];
  isLoading?: boolean;
  onCharacterClick?: (avatar: CharacterAvatar) => void;
}

export default function CharacterAvatars({ avatars, isLoading = false, onCharacterClick }: CharacterAvatarsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <motion.div
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
              className="w-14 h-14 rounded-full bg-white/30"
              style={{
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '2px solid rgba(255, 255, 255, 0.4)',
              }}
            />
            <div className="w-10 h-2.5 rounded bg-white/20 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!avatars.length) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-3">
      {avatars.map((avatar, i) => (
        <motion.div
          key={avatar.character}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: i * 0.1 }}
          className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
          onClick={() => onCharacterClick?.(avatar)}
        >
          <div
            className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0"
            style={{
              border: '2px solid rgba(255, 255, 255, 0.5)',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            <img
              src={avatar.image_url}
              alt={avatar.character}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 text-center max-w-[70px] truncate">
            {avatar.character.split(' ')[0]}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
