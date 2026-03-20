'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Lightbulb, Headphones, Play, FileText, BookMarked, Film, Bookmark, Disc3, Tv } from 'lucide-react';
import { isAndroid, openSystemBrowser } from '@/lib/capacitor';

interface NoteSection {
  timestamp: string;
  content: string;
}

interface PinInfo {
  type: string;
  text: string;
  url?: string;
  imageUrl?: string;
}

const PIN_REGEX = /^\{\{pin:(\w+)\|([\s\S]+)\}\}$/;

function parsePinContent(content: string): PinInfo | null {
  const trimmed = content.trim();
  const match = trimmed.match(PIN_REGEX);
  if (!match) return null;
  // Format: {{pin:type|text|url|imageUrl}}
  const inner = match[2];
  const parts = inner.split('|');
  return {
    type: match[1],
    text: parts[0],
    url: parts[1] || undefined,
    imageUrl: parts[2] || undefined,
  };
}

const PIN_ICONS: Record<string, React.ReactNode> = {
  insight: <Lightbulb size={18} />,
  podcast: <Headphones size={18} />,
  youtube: <Play size={18} />,
  article: <FileText size={18} />,
  book: <BookMarked size={18} />,
  movie: <Film size={18} />,
  show: <Tv size={18} />,
  album: <Disc3 size={18} />,
  note: <Bookmark size={18} />,
};

const PIN_LABELS: Record<string, string> = {
  insight: 'Insight',
  podcast: 'Podcast',
  youtube: 'Video',
  article: 'Article',
  book: 'Book',
  movie: 'Movie',
  show: 'Show',
  album: 'Album',
  note: 'Saved',
};

interface NotesEditorOverlayProps {
  bookId: string;
  bookTitle: string;
  initialNotes: string | null;
  onClose: (finalNotes: string | null) => void;
}

function formatNoteTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parseNotes(notes: string | null): NoteSection[] {
  if (!notes || notes.trim() === '') return [];

  const sections: NoteSection[] = [];
  const timestampRegex = /\{(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\}\n?/g;
  let match;
  const matches: Array<{ timestamp: string; index: number; fullMatch: string }> = [];

  while ((match = timestampRegex.exec(notes)) !== null) {
    matches.push({ timestamp: match[1], index: match.index, fullMatch: match[0] });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const contentStart = current.index + current.fullMatch.length;
    const contentEnd = next ? next.index : notes.length;
    const content = notes.substring(contentStart, contentEnd).trim();
    sections.push({ timestamp: current.timestamp, content });
  }

  return sections;
}

function serializeSections(sections: NoteSection[]): string | null {
  if (sections.length === 0) return null;
  return sections.map(s => `{${s.timestamp}}\n${s.content}`).join('\n\n');
}

export default function NotesEditorOverlay({ bookId, bookTitle, initialNotes, onClose }: NotesEditorOverlayProps) {
  const [sections, setSections] = useState<NoteSection[]>(() => {
    const parsed = parseNotes(initialNotes);
    if (parsed.length === 0) {
      return [{ timestamp: formatNoteTimestamp(), content: '' }];
    }
    return parsed;
  });
  const [newlyAddedTimestamp, setNewlyAddedTimestamp] = useState<string | null>(() => {
    const parsed = parseNotes(initialNotes);
    return parsed.length === 0 ? 'auto' : null;
  });
  const newNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Track keyboard height via Capacitor Keyboard plugin
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    let willShowListener: any;
    let willHideListener: any;
    (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        willShowListener = await Keyboard.addListener('keyboardWillShow', (info) => {
          setKeyboardHeight(info.keyboardHeight);
        });
        willHideListener = await Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardHeight(0);
        });
      } catch {
        // Not on native — fall back to visualViewport
        const handleViewportChange = () => {
          if (window.visualViewport) {
            const heightDiff = window.innerHeight - window.visualViewport.height;
            setKeyboardHeight(heightDiff > 150 ? heightDiff : 0);
          }
        };
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', handleViewportChange);
          handleViewportChange();
        }
      }
    })();
    return () => {
      willShowListener?.remove();
      willHideListener?.remove();
    };
  }, []);

  // Scroll focused textarea into view when keyboard opens
  useEffect(() => {
    if (keyboardHeight > 0) {
      const active = document.activeElement as HTMLTextAreaElement;
      if (active?.tagName === 'TEXTAREA' && scrollContainerRef.current?.contains(active)) {
        setTimeout(() => {
          active.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [keyboardHeight]);

  // Auto-focus newly added note (delay to let sheet animation finish)
  useEffect(() => {
    if (newlyAddedTimestamp && newNoteRef.current) {
      const el = newNoteRef.current;
      const delay = newlyAddedTimestamp === 'auto' ? 500 : 100;
      const timer = setTimeout(() => {
        el.focus();
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }, delay);
      setNewlyAddedTimestamp(null);
      return () => clearTimeout(timer);
    }
  }, [newlyAddedTimestamp]);

  const handleClose = () => {
    const nonEmpty = sections.filter(s => s.content.trim() !== '');
    onClose(serializeSections(nonEmpty));
  };

  const handleAddNote = () => {
    const ts = formatNoteTimestamp();
    setSections(prev => [{ timestamp: ts, content: '' }, ...prev]);
    setNewlyAddedTimestamp(ts);
  };

  const handleDeleteNote = (idx: number) => {
    setSections(prev => prev.filter((_, i) => i !== idx));
  };

  const handleContentChange = (idx: number, content: string) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, content } : s));
  };

  // Auto-resize textarea
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  // Auto-resize all textareas on mount and when notes change
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        const textareas = scrollContainerRef.current.querySelectorAll('textarea');
        textareas.forEach((ta) => {
          ta.style.height = 'auto';
          ta.style.height = ta.scrollHeight + 'px';
        });
      }
    });
  }, [sections.length]);

  // Dismiss keyboard when tapping the scroll area (not a textarea)
  const handleScrollAreaClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName !== 'TEXTAREA') {
      (document.activeElement as HTMLElement)?.blur();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center px-4"
      style={{ paddingBottom: keyboardHeight > 0 && !isAndroid ? `${keyboardHeight}px` : '0px', transition: 'padding-bottom 0.25s ease-out' }}
      onClick={handleClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-white/80 dark:bg-white/15 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30 dark:border-white/10 relative flex flex-col"
        style={{ maxHeight: 'calc(100% - 60px - var(--safe-area-top, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-full flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-12 h-1 bg-slate-400 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate flex-1">
            Notes
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddNote}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 active:scale-95 transition-transform"
            >
              <Plus size={16} />
              Add
            </button>
            <button
              onClick={handleClose}
              className="text-xs font-bold text-slate-600 dark:text-slate-400 active:scale-95 transition-transform px-2 py-1 rounded-lg"
            >
              Done
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div
          ref={scrollContainerRef}
          className="flex-1 px-4 overflow-y-auto flex flex-col gap-3 ios-scroll"
          style={{
            paddingBottom: keyboardHeight > 0 ? '12px' : 'calc(12px + var(--safe-area-bottom, 0px))',
          }}
          onClick={handleScrollAreaClick}
        >
          <AnimatePresence mode="popLayout">
            {sections.map((section, idx) => (
              <motion.div
                key={`${section.timestamp}-${idx}`}
                layout
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.25 }}
                className="bg-white/60 dark:bg-white/10 rounded-xl p-3 border border-white/30 dark:border-white/5"
              >
                {/* Timestamp + delete */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    {section.timestamp}
                  </span>
                  <button
                    onClick={() => handleDeleteNote(idx)}
                    className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-0.5"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Content: rich pin card or editable textarea */}
                {(() => {
                  const pin = parsePinContent(section.content);
                  if (pin) {
                    const handleOpen = pin.url ? (e: React.MouseEvent) => {
                      e.stopPropagation();
                      openSystemBrowser(pin.url!);
                    } : undefined;
                    return (
                      <div
                        className={`flex items-start gap-2.5 px-1 py-0.5 ${handleOpen ? 'cursor-pointer active:opacity-70' : ''}`}
                        onClick={handleOpen}
                      >
                        {/* Thumbnail with play overlay for media types */}
                        {pin.imageUrl ? (
                          <div className="relative flex-shrink-0 rounded-lg overflow-hidden">
                            <img src={pin.imageUrl} alt="" className="w-12 h-12 object-cover" />
                            {(pin.type === 'podcast' || pin.type === 'youtube' || pin.type === 'album') && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Play size={16} className="text-white" fill="white" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500">
                            {PIN_ICONS[pin.type] || <Bookmark size={18} />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                            {PIN_LABELS[pin.type] || 'Saved'}
                          </span>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug mt-0.5 break-words">
                            {(() => {
                              if (pin.type === 'article' && pin.text.includes(' — http')) {
                                const idx = pin.text.indexOf(' — http');
                                const title = pin.text.substring(0, idx);
                                const url = pin.text.substring(idx + 3);
                                return <>{title}<span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{url}</span></>;
                              }
                              return pin.text;
                            })()}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <textarea
                      ref={idx === 0 && newlyAddedTimestamp ? newNoteRef : undefined}
                      value={section.content}
                      onChange={(e) => {
                        handleContentChange(idx, e.target.value);
                        autoResize(e.target);
                      }}
                      onFocus={(e) => {
                        autoResize(e.target);
                        // Scroll into view after keyboard animation
                        setTimeout(() => {
                          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 300);
                      }}
                      placeholder="Write your note..."
                      className="w-full bg-transparent text-sm text-slate-500 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-600 resize-none outline-none overflow-hidden min-h-[24px]"
                      rows={1}
                    />
                  );
                })()}
              </motion.div>
            ))}
          </AnimatePresence>

          {sections.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400 dark:text-slate-500">No notes yet</p>
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Tap &quot;Add&quot; to start</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
