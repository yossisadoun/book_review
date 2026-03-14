'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Image, Quote } from 'lucide-react';
import { glassmorphicStyle } from './utils';

interface CreatePostSheetProps {
  isOpen: boolean;
  onClose: () => void;
  userAvatar?: string | null;
  userName: string;
}

function CreatePostSheet({ isOpen, onClose, userAvatar, userName }: CreatePostSheetProps) {
  const [postText, setPostText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
    if (!isOpen) {
      setPostText('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/50"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-[201] flex flex-col rounded-t-2xl overflow-hidden"
        style={{
          ...glassmorphicStyle,
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 dark:border-white/10">
          <button
            onClick={onClose}
            className="text-[16px] text-slate-600 dark:text-slate-400 font-medium active:opacity-60"
            style={{ WebkitTapHighlightColor: 'transparent' } as any}
          >
            Cancel
          </button>
          <span className="font-bold text-[16px] text-slate-900 dark:text-slate-100">New post</span>
          <div className="w-14" />
        </div>

        {/* Compose area */}
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <div className="flex gap-3">
            {/* Avatar + thread line */}
            <div className="flex flex-col items-center">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/30 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{userName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="w-px flex-1 bg-white/30 dark:bg-white/15 mt-2 min-h-[24px]" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
              <p className="font-bold text-[15px] text-slate-900 dark:text-slate-100">{userName}</p>
              <textarea
                ref={textareaRef}
                value={postText}
                onChange={(e) => {
                  setPostText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                placeholder="What's new?"
                className="w-full mt-1 text-[15px] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 bg-transparent outline-none resize-none min-h-[80px]"
                rows={4}
              />

              {/* Attachment icons */}
              <div className="flex items-center gap-4 mt-1">
                <button className="active:opacity-60">
                  <Image size={20} className="text-slate-400 dark:text-slate-500" />
                </button>
                <button className="active:opacity-60">
                  <Quote size={20} className="text-slate-400 dark:text-slate-500" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-3 border-t border-white/20 dark:border-white/10">
          <button
            disabled={!postText.trim()}
            className="px-5 py-2 rounded-full font-bold text-[15px] text-white transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: postText.trim()
                ? 'rgba(59, 130, 246, 0.85)'
                : 'rgba(59, 130, 246, 0.3)',
              backdropFilter: 'blur(9.4px)',
              WebkitBackdropFilter: 'blur(9.4px)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            Post
          </button>
        </div>
      </motion.div>
    </>
  );
}

export default CreatePostSheet;
