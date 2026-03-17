'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { searchGifs, getTrendingGifs, type KlipyGif } from '../services/klipy-service';

interface GifPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: KlipyGif) => void;
  keyboardHeight?: number;
}

export default function GifPicker({ open, onClose, onSelect, keyboardHeight = 0 }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<KlipyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Load trending on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setPage(1);
      setGifs([]);
      loadTrending();
      setTimeout(() => searchInputRef.current?.focus(), 300);
    }
  }, [open]);

  const loadTrending = async () => {
    setLoading(true);
    const results = await getTrendingGifs(1);
    setGifs(results);
    setHasMore(results.length >= 24);
    setLoading(false);
  };

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      loadTrending();
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setPage(1);
      const results = await searchGifs(query.trim(), 1);
      setGifs(results);
      setHasMore(results.length >= 24);
      setLoading(false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  // Load more on scroll
  const handleScroll = useCallback(() => {
    const el = gridRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      const nextPage = page + 1;
      setPage(nextPage);
      setLoading(true);
      const fetcher = query.trim() ? searchGifs(query.trim(), nextPage) : getTrendingGifs(nextPage);
      fetcher.then(results => {
        setGifs(prev => [...prev, ...results]);
        setHasMore(results.length >= 24);
        setLoading(false);
      });
    }
  }, [loading, hasMore, page, query]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-x-0 z-50 flex flex-col"
        style={{
          bottom: `${keyboardHeight}px`,
          height: keyboardHeight > 0 ? `calc(100vh - ${keyboardHeight}px - 100px)` : '55vh',
          transition: 'bottom 0.3s cubic-bezier(0.33, 1, 0.68, 1), height 0.3s cubic-bezier(0.33, 1, 0.68, 1)',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
          border: '0.5px solid rgba(255, 255, 255, 0.4)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <div
            className="flex-1 flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              background: 'rgba(0, 0, 0, 0.05)',
              border: '0.5px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search KLIPY"
              className="flex-1 bg-transparent text-[14px] text-slate-800 placeholder:text-slate-400 outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="shrink-0">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[13px] font-medium text-blue-500 active:opacity-70"
          >
            Cancel
          </button>
        </div>

        {/* GIF Grid */}
        <div
          ref={gridRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2 pb-2"
        >
          {gifs.length === 0 && !loading ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-[13px]">
              {query ? 'No GIFs found' : 'Loading...'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {gifs.map((gif, i) => (
                <button
                  key={`${gif.slug}-${i}`}
                  onClick={() => onSelect(gif)}
                  className="relative overflow-hidden rounded-lg active:scale-[0.97] transition-transform"
                  style={{
                    aspectRatio: '1',
                    background: 'rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <img
                    src={gif.preview_url}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
          {loading && gifs.length > 0 && (
            <div className="flex justify-center py-3">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Attribution */}
        <div className="text-center py-1.5 text-[10px] text-slate-400" style={{ paddingBottom: 'calc(6px + var(--safe-area-bottom, 0px))' }}>
          Powered by KLIPY
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
