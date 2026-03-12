'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, BookOpen, Headphones, Play, BookMarked, FileText, ExternalLink, Bot, X, CheckCircle2, Film, Disc3, Library } from 'lucide-react';
import { openSystemBrowser, isNativePlatform } from '@/lib/capacitor';
import MusicModal from './MusicModal';
import type { MusicLinks } from '../types';
import {
  sendChatMessage,
  loadChatHistory,
  saveChatMessages,
  getStarterPrompts,
  type ChatMessage,
  type BookChatContext,
} from '../services/chat-service';
import type { BookWithRatings } from '../types';

interface BookChatProps {
  book: BookWithRatings;
  bookContext: BookChatContext;
  onBack: () => void;
  onAddBook?: (meta: any) => void;
}

// Rough token estimate: ~4 chars per token for English text
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type MessageSegment = { type: 'text'; text: string } | { type: 'card'; cardType: string; cardIndex: number };

export default function BookChat({ book, bookContext, onBack, onAddBook }: BookChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [lastRawResponse, setLastRawResponse] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [musicModalData, setMusicModalData] = useState<{ musicLinks: MusicLinks; title: string; artist: string } | null>(null);

  const [streamingSegments, setStreamingSegments] = useState<MessageSegment[] | null>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingCardLoading, setStreamingCardLoading] = useState(false);
  const streamingRef = useRef<{ timer: ReturnType<typeof setTimeout> | null }>({ timer: null });

  const starterPrompts = getStarterPrompts(book.reading_status || null, bookContext.generalMode);

  // Cleanup streaming timer on unmount
  useEffect(() => {
    return () => {
      if (streamingRef.current.timer) clearTimeout(streamingRef.current.timer);
    };
  }, []);

  // Load chat history on mount + auto-generate greeting if needed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingHistory(true);
      const history = await loadChatHistory(book.id);
      if (cancelled) return;

      setMessages(history);
      setIsLoadingHistory(false);
    })();
    return () => { cancelled = true; };
  }, [book.id]);

  // Track keyboard height via Capacitor Keyboard plugin for smooth animation
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
        // Not on native — fall back to no adjustment
      }
    })();
    return () => {
      willShowListener?.remove();
      willHideListener?.remove();
    };
  }, []);

  // Scroll to bottom when messages change — instant during initial load, smooth after
  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    // Mark initial load done once history is loaded and not generating greeting
    if (!isLoadingHistory && !isLoading && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
    }
  }, [isLoadingHistory, isLoading]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (!initialLoadDoneRef.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading, streamingText, streamingSegments, streamingCardLoading]);

  // Keep scroll at bottom when keyboard shows/hides
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !initialLoadDoneRef.current) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [keyboardHeight]);


  const handleSend = useCallback(async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isLoading || streamingSegments !== null) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessage = { role: 'user', content: messageText, created_at: now };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      const response = await sendChatMessage(updatedMessages, bookContext);
      setLastRawResponse(response);
      setIsLoading(false);

      // Fake-stream: reveal text word-by-word, pause before cards
      const segments = splitAssistantMessage(response);
      const revealedSegs: MessageSegment[] = [];
      let segIdx = 0;

      setStreamingSegments([]);
      setStreamingText(null);
      setStreamingCardLoading(false);

      const processSegment = () => {
        if (segIdx >= segments.length) {
          // Done — commit as real message
          setStreamingSegments(null);
          setStreamingText(null);
          setStreamingCardLoading(false);
          const assistantMessage: ChatMessage = { role: 'assistant', content: response, created_at: new Date().toISOString() };
          setMessages(prev => [...prev, assistantMessage]);
          saveChatMessages(book.id, book.title, book.author, [userMessage, assistantMessage]);
          return;
        }

        const seg = segments[segIdx];
        if (seg.type === 'card') {
          // Show typing dots for 1s, then reveal the card
          setStreamingCardLoading(true);
          streamingRef.current.timer = setTimeout(() => {
            setStreamingCardLoading(false);
            revealedSegs.push(seg);
            setStreamingSegments([...revealedSegs]);
            segIdx++;
            streamingRef.current.timer = setTimeout(processSegment, 200);
          }, 1000);
        } else {
          // Stream text word by word
          const words = seg.text!.split(/(\s+)/);
          let wordIdx = 0;
          let revealed = '';
          setStreamingText('');

          const streamWords = () => {
            const chunk = Math.floor(Math.random() * 3) + 1;
            for (let c = 0; c < chunk && wordIdx < words.length; c++) {
              revealed += words[wordIdx];
              wordIdx++;
            }
            setStreamingText(revealed);

            if (wordIdx < words.length) {
              const delay = 30 + Math.random() * 50;
              streamingRef.current.timer = setTimeout(streamWords, delay);
            } else {
              // Text segment done
              revealedSegs.push({ type: 'text', text: seg.text! });
              setStreamingSegments([...revealedSegs]);
              setStreamingText(null);
              segIdx++;
              streamingRef.current.timer = setTimeout(processSegment, 50);
            }
          };
          streamWords();
        }
      };
      processSegment();
    } catch (err) {
      console.error('[BookChat] Error:', err);
      setStreamingSegments(null);
      setStreamingText(null);
      setStreamingCardLoading(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't respond right now. Please try again.",
        created_at: new Date().toISOString(),
      }]);
      setIsLoading(false);
    } finally {
      // Only refocus if keyboard is still up (user hasn't tapped away)
      if (document.activeElement === inputRef.current) {
        inputRef.current?.focus();
      }
    }
  }, [input, isLoading, messages, bookContext, book.id, book.title, book.author]);

  const handleKeyDown = (_e: React.KeyboardEvent) => {
    // Enter inserts a newline (default textarea behavior) — send only via button
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const hasText = input.trim().length > 0;
  const [inputFocused, setInputFocused] = useState(false);
  const [showContext, setShowContext] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ paddingTop: 'var(--safe-area-top, 0px)', paddingBottom: `${keyboardHeight}px`, transition: 'padding-bottom 0.25s ease-out' }}>
      {/* Header bar — X button + bot avatar + book info */}
      <div
        className="shrink-0 flex flex-col justify-end px-3 pb-3"
        style={{
          minHeight: '112px',
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '0.5px solid rgba(255, 255, 255, 0.3)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0"
            style={{
              background: 'rgba(0, 0, 0, 0.06)',
            }}
          >
            <X size={18} className="text-slate-600" />
          </button>
          <div
            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', border: '1.5px solid rgba(56, 189, 248, 0.5)' }}
          >
            <Bot className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{book.title}</p>
            <p className="text-[10px] text-slate-500 truncate leading-tight">{book.author}</p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto ios-scroll"
        onClick={() => inputRef.current?.blur()}
      >
        <div className="px-3 py-2 flex flex-col">
          {isLoadingHistory ? (
            /* Skeleton: WhatsApp-style shimmer bubbles */
            <div className="flex flex-col gap-1.5 py-4">
              {[
                { align: 'start', w: '65%' },
                { align: 'start', w: '45%' },
                { align: 'end', w: '55%' },
                { align: 'start', w: '70%' },
              ].map((s, i) => (
                <div key={i} className={`flex ${s.align === 'end' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="animate-pulse rounded-lg h-10"
                    style={{
                      width: s.w,
                      background: s.align === 'end'
                        ? 'rgba(59, 130, 246, 0.12)'
                        : 'rgba(255, 255, 255, 0.35)',
                      borderRadius: s.align === 'end'
                        ? '10px 10px 4px 10px'
                        : '10px 10px 10px 4px',
                    }}
                  />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            /* Empty state */
            <div
              className="flex flex-col items-center pt-12 pb-6 px-4 mx-3 mt-4 rounded-2xl"
              style={{
                background: 'rgba(255, 255, 255, 0.35)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '0.5px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 2px 16px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Book cover as avatar */}
              <div className="mb-4 relative">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-16 h-[88px] rounded-lg object-cover"
                    style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
                  />
                ) : book.title === 'My Bookshelf' ? (
                  <div className="w-16 h-[88px] rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255, 0, 123, 0.55)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 0, 123, 0.3)', boxShadow: '0 4px 14px rgba(255, 0, 123, 0.25)' }}
                  >
                    <Library size={34} className="text-white/90" />
                  </div>
                ) : (
                  <div className="w-16 h-[88px] rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <BookOpen size={24} className="text-white/60" />
                  </div>
                )}
              </div>
              <p className="text-[13px] font-semibold text-slate-700 mb-0.5 text-center">{book.title}</p>
              <p className="text-[11px] text-slate-500 mb-1 text-center">{book.author}</p>
              <p className="text-[11px] text-slate-400 mb-8 text-center max-w-[240px]">
                Your AI reading companion. Ask anything about this book.
              </p>

              {/* Starter prompts as tappable chips */}
              <div className="flex flex-col gap-2 w-full max-w-[300px]">
                {starterPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt)}
                    className="text-left px-4 py-2.5 text-[13px] text-slate-700 active:scale-[0.98] active:opacity-80 transition-all"
                    style={{
                      background: 'rgba(255, 255, 255, 0.5)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message list */
            <div className="flex flex-col gap-[3px] py-1">
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const isFirst = i === 0 || messages[i - 1].role !== msg.role;
                const isLast = i === messages.length - 1 || messages[i + 1]?.role !== msg.role;

                if (isUser) {
                  return (
                    <motion.div
                      key={msg.id || `msg-${i}`}
                      initial={!msg.id ? { opacity: 0, scale: 0.95 } : false}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.15 }}
                      className="flex justify-end"
                      style={{ marginTop: isFirst && i > 0 ? '6px' : undefined }}
                    >
                      <div
                        className="relative max-w-[82%] px-[10px] py-[7px] text-[15px] leading-[20px]"
                        style={{
                          background: 'rgba(59, 130, 246, 0.82)',
                          color: '#fff',
                          borderRadius: '10px 10px 4px 10px',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
                        }}
                      >
                        <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                        <span className="float-right ml-2 mt-1 text-[10px] leading-none select-none" style={{ color: 'rgba(255,255,255,0.65)' }}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </motion.div>
                  );
                }

                // Assistant message — split into text segments and card segments
                const segments = splitAssistantMessage(msg.content);

                return (
                  <React.Fragment key={msg.id || `msg-${i}`}>
                    {segments.map((seg, si) => {
                      if (seg.type === 'card') {
                        return (
                          <motion.div
                            key={`${msg.id || i}-card-${si}`}
                            initial={!msg.id ? { opacity: 0, scale: 0.95 } : false}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.15 }}
                            className="flex justify-start"
                          >
                            <div className="w-[82%]">
                              <InlineChatCard type={seg.cardType!} index={seg.cardIndex!} ctx={bookContext} onAddBook={onAddBook} onPlayAlbum={(ml, t, a) => setMusicModalData({ musicLinks: ml, title: t, artist: a })} />
                            </div>
                          </motion.div>
                        );
                      }
                      // Text segment
                      const textContent = seg.text!.replace(/^\n+|\n+$/g, '');
                      if (!textContent) return null;
                      const isLastTextSeg = si === segments.length - 1 || segments.slice(si + 1).every(s => s.type === 'card');
                      return (
                        <motion.div
                          key={`${msg.id || i}-text-${si}`}
                          initial={!msg.id ? { opacity: 0, scale: 0.95 } : false}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.15 }}
                          className="flex justify-start"
                          style={{ marginTop: isFirst && si === 0 && i > 0 ? '6px' : undefined }}
                        >
                          <div
                            className="relative max-w-[82%] px-[10px] py-[7px] text-[15px] leading-[20px]"
                            style={{
                              background: 'rgba(255, 255, 255, 0.6)',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              color: '#1e293b',
                              borderRadius: '10px 10px 10px 4px',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                              border: '0.5px solid rgba(255, 255, 255, 0.3)',
                            }}
                          >
                            <div className="whitespace-pre-wrap break-words">{formatTextWithMarkdown(textContent)}</div>
                            {isLastTextSeg && isLast && (
                              <span className="float-right ml-2 mt-1 text-[10px] leading-none select-none" style={{ color: 'rgba(100,116,139,0.7)' }}>
                                {formatTime(msg.created_at)}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* Typing indicator */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="flex justify-start"
                    style={{ marginTop: '6px' }}
                  >
                    <div
                      className="px-3 py-2.5 flex gap-[5px] items-center"
                      style={{
                        background: 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        borderRadius: '10px 10px 10px 4px',
                        border: '0.5px solid rgba(255, 255, 255, 0.3)',
                      }}
                    >
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-[7px] h-[7px] rounded-full"
                          style={{ background: 'rgba(100, 116, 139, 0.5)' }}
                          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
                          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Streaming assistant response — revealed segments + current text */}
              {streamingSegments !== null && (
                <>
                  {streamingSegments.map((seg, si) => {
                    if (seg.type === 'card') {
                      return (
                        <motion.div
                          key={`stream-card-${si}`}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className="flex justify-start"
                        >
                          <div className="w-[82%]">
                            <InlineChatCard type={seg.cardType!} index={seg.cardIndex!} ctx={bookContext} onAddBook={onAddBook} onPlayAlbum={(ml, t, a) => setMusicModalData({ musicLinks: ml, title: t, artist: a })} />
                          </div>
                        </motion.div>
                      );
                    }
                    const textContent = seg.text!.replace(/^\n+|\n+$/g, '');
                    if (!textContent) return null;
                    return (
                      <div key={`stream-text-${si}`} className="flex justify-start" style={{ marginTop: si === 0 ? '6px' : undefined }}>
                        <div
                          className="relative max-w-[82%] px-[10px] py-[7px] text-[15px] leading-[20px]"
                          style={{
                            background: 'rgba(255, 255, 255, 0.6)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            color: '#1e293b',
                            borderRadius: '10px 10px 10px 4px',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                            border: '0.5px solid rgba(255, 255, 255, 0.3)',
                          }}
                        >
                          <div className="whitespace-pre-wrap break-words">{formatTextWithMarkdown(textContent)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Currently streaming text */}
                  {streamingText !== null && (
                    <div className="flex justify-start" style={{ marginTop: streamingSegments.length === 0 ? '6px' : undefined }}>
                      <div
                        className="relative max-w-[82%] px-[10px] py-[7px] text-[15px] leading-[20px]"
                        style={{
                          background: 'rgba(255, 255, 255, 0.6)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          color: '#1e293b',
                          borderRadius: '10px 10px 10px 4px',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                          border: '0.5px solid rgba(255, 255, 255, 0.3)',
                        }}
                      >
                        <div className="whitespace-pre-wrap break-words">{streamingText}<span className="inline-block w-[2px] h-[14px] bg-slate-400 ml-0.5 animate-pulse align-text-bottom" /></div>
                      </div>
                    </div>
                  )}
                  {/* Typing dots before a card */}
                  {streamingCardLoading && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.15 }}
                      className="flex justify-start"
                    >
                      <div
                        className="px-3 py-2.5 flex gap-[5px] items-center"
                        style={{
                          background: 'rgba(255, 255, 255, 0.6)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          borderRadius: '10px 10px 10px 4px',
                          border: '0.5px solid rgba(255, 255, 255, 0.3)',
                        }}
                      >
                        {[0, 1, 2].map(di => (
                          <motion.div
                            key={di}
                            className="w-[7px] h-[7px] rounded-full"
                            style={{ background: 'rgba(100, 116, 139, 0.5)' }}
                            animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
                            transition={{ duration: 1.4, repeat: Infinity, delay: di * 0.2 }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </>
              )}

              {/* Quick reply chips after last assistant message */}
              {!isLoading && streamingSegments === null && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                <div className="flex flex-wrap gap-1.5 mt-2 mb-1">
                  {starterPrompts.slice(0, 2).map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(prompt)}
                      className="px-3 py-[5px] text-[12px] text-slate-500 active:scale-[0.97] active:opacity-70 transition-all"
                      style={{
                        background: 'rgba(255, 255, 255, 0.4)',
                        borderRadius: '999px',
                        border: '0.5px solid rgba(255, 255, 255, 0.35)',
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* DEBUG: Context viewer */}
      <AnimatePresence>
        {showContext && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mx-2 mb-1 max-h-[50vh] overflow-y-auto ios-scroll rounded-xl p-3 text-[11px] font-mono leading-[16px] text-slate-700"
            style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '0.5px solid rgba(255,255,255,0.4)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }}
          >
            {(() => {
              const systemPrompt = buildDebugSystemPrompt(bookContext);
              const historyText = messages.map(m => m.content).join(' ');
              const inputTokens = estimateTokens(systemPrompt + ' ' + historyText);
              const outputTokens = Math.round(inputTokens * 0.3); // estimate ~30% of input
              const inputCost = (inputTokens / 1_000_000) * 0.20;
              const outputCost = (outputTokens / 1_000_000) * 0.50;
              const totalCost = inputCost + outputCost;
              return (
                <>
                  {/* Token & cost estimate banner */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[12px] font-bold text-slate-900">Debug: Next API Call</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const debugText = [
                            '=== SYSTEM PROMPT ===',
                            systemPrompt,
                            '',
                            '=== BOOK CONTEXT ===',
                            JSON.stringify(bookContext, null, 2),
                            '',
                            '=== CHAT HISTORY ===',
                            JSON.stringify(messages.map(m => ({ role: m.role, content: m.content })), null, 2),
                            '',
                            lastRawResponse ? `=== LAST RAW RESPONSE ===\n${lastRawResponse}` : '',
                            '',
                            `=== TOKENS ===`,
                            `Input: ~${inputTokens}, Output (est): ~${outputTokens}, Cost: $${totalCost.toFixed(4)}`,
                          ].filter(Boolean).join('\n');
                          navigator.clipboard.writeText(debugText);
                        }}
                        className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded active:scale-95 transition-transform"
                      >
                        Copy All
                      </button>
                      <button onClick={() => setShowContext(false)} className="text-slate-400 text-[12px] font-bold px-1">✕</button>
                    </div>
                  </div>
                  <div
                    className="rounded-lg px-3 py-2 mb-3 flex items-center justify-between"
                    style={{ background: 'rgba(59,130,246,0.08)', border: '0.5px solid rgba(59,130,246,0.15)' }}
                  >
                    <div>
                      <div className="text-[11px] font-bold text-blue-700">~{inputTokens.toLocaleString()} input tokens</div>
                      <div className="text-[10px] text-blue-500">+ ~{outputTokens.toLocaleString()} output (est.)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-blue-700">${totalCost.toFixed(4)}</div>
                      <div className="text-[9px] text-blue-400">grok-4-1-fast @ $0.20/$0.50 per 1M</div>
                    </div>
                  </div>

                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">System Prompt ({estimateTokens(systemPrompt).toLocaleString()} tokens)</div>
                  <pre className="whitespace-pre-wrap break-words text-slate-800">{systemPrompt}</pre>
                  <div className="h-px bg-slate-200/60 my-2" />
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Book Context (raw JSON)</div>
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(bookContext, null, 2)}</pre>
                  <div className="h-px bg-slate-200/60 my-2" />
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Chat History ({messages.length} msgs, ~{estimateTokens(historyText).toLocaleString()} tokens)</div>
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(messages.map(m => ({ role: m.role, content: m.content.slice(0, 100) + (m.content.length > 100 ? '...' : '') })), null, 2)}</pre>
                  {lastRawResponse && (
                    <>
                      <div className="h-px bg-slate-200/60 my-2" />
                      <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Last Raw Response (what Grok returned)</div>
                      <pre className="whitespace-pre-wrap break-words text-green-800 bg-green-50/50 rounded p-2">{lastRawResponse}</pre>
                    </>
                  )}
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar — glassmorphic */}
      <div
        className="shrink-0 pt-1.5 flex justify-center"
        style={{ paddingBottom: keyboardHeight > 0 ? '9px' : 'calc(18px + var(--safe-area-bottom, 0px))' }}
      >
        <motion.div className="flex items-center gap-2" animate={{ width: inputFocused ? '96%' : '80%' }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
          <div
            className="flex-1 flex items-center gap-1.5 rounded-[24px] pl-4 pr-3 h-9"
            style={{
              background: 'rgba(255, 255, 255, 0.55)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '0.5px solid rgba(255, 255, 255, 0.35)',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
            }}
          >
            {/* DEBUG: toggle context viewer */}
            <button
              onClick={() => setShowContext(v => !v)}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold active:scale-90 transition-transform"
              style={{
                background: showContext ? 'rgba(59,130,246,0.8)' : 'rgba(0,0,0,0.08)',
                color: showContext ? '#fff' : '#94a3b8',
              }}
            >
              { '{}'  }
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Message"
              rows={1}
              className="flex-1 resize-none bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 outline-none leading-[20px]"
              style={{ maxHeight: '36px', height: '20px' }}
            />
          </div>
          <button
            onTouchEnd={(e) => { e.preventDefault(); handleSend(); }}
            onClick={() => handleSend()}
            disabled={isLoading || streamingSegments !== null || !hasText}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all shrink-0 disabled:opacity-30"
            style={{
              background: hasText ? 'rgba(59, 130, 246, 0.9)' : 'rgba(59, 130, 246, 0.4)',
              boxShadow: hasText ? '0 1px 4px rgba(59, 130, 246, 0.3)' : 'none',
            }}
          >
            <Send size={16} className="text-white" style={{ marginLeft: '1px' }} />
          </button>
        </motion.div>
      </div>
      <MusicModal
        musicLinks={musicModalData?.musicLinks ?? null}
        albumTitle={musicModalData?.title}
        albumArtist={musicModalData?.artist}
        onClose={() => setMusicModalData(null)}
      />
    </div>
  );
}

// Mirror of edge function's buildSystemPrompt — for debug panel only
function buildDebugSystemPrompt(ctx: BookChatContext): string {
  const { title, author, readingStatus, userNotes, userRatings } = ctx;

  let statusLine = '';
  if (readingStatus === 'reading') statusLine = 'Currently reading. Avoid spoilers beyond where they might be.';
  else if (readingStatus === 'read_it') statusLine = 'Finished the book. Everything including the ending is fair game.';
  else if (readingStatus === 'want_to_read') statusLine = 'Has not started yet. Avoid spoilers.';
  else statusLine = 'Reading status unknown. Avoid spoilers unless they say they finished.';

  let ratingsLine = '';
  if (userRatings) {
    const parts = Object.entries(userRatings).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}/5`);
    if (parts.length) ratingsLine = `Their ratings: ${parts.join(', ')}`;
  }

  const facts: string[] = [];
  if (ctx.insights?.authorFacts?.length) facts.push(...ctx.insights.authorFacts.slice(0, 3));
  if (ctx.insights?.didYouKnow?.length) {
    facts.push(...ctx.insights.didYouKnow.flatMap(item => item.notes || []).slice(0, 5));
  }
  if (ctx.insights?.context?.length) facts.push(...ctx.insights.context.slice(0, 2));
  if (ctx.insights?.influences?.length) facts.push(...ctx.insights.influences.slice(0, 2));
  if (ctx.insights?.domain) facts.push(...(ctx.insights.domain.facts || []).slice(0, 2));

  const resourceParts: string[] = [];
  if (ctx.podcasts?.length) resourceParts.push(...ctx.podcasts.slice(0, 5).map((p, i) => `[[podcast:${i}]] "${p.title}" on ${p.podcast_name || 'podcast'}`));
  if (ctx.videos?.length) resourceParts.push(...ctx.videos.slice(0, 5).map((v, i) => `[[video:${i}]] "${v.title}" by ${v.channelTitle}`));
  if (ctx.articles?.length) resourceParts.push(...ctx.articles.slice(0, 5).map((a, i) => `[[article:${i}]] "${a.title}"`));
  if (ctx.relatedBooks?.length) resourceParts.push(...ctx.relatedBooks.slice(0, 5).map((b, i) => `[[related_book:${i}]] "${b.title}" by ${b.author}`));
  if (ctx.relatedWorks?.length) {
    const movies = ctx.relatedWorks.filter(w => w.type !== 'album');
    const albums = ctx.relatedWorks.filter(w => w.type === 'album');
    const picked = [...movies.slice(0, 3), ...albums].slice(0, 8);
    picked.forEach(w => {
      const origIdx = ctx.relatedWorks!.indexOf(w);
      resourceParts.push(`[[related_work:${origIdx}]] ${w.type}: "${w.title}" by ${w.director}`);
    });
  }

  return `You are a relaxed reading companion chatting about "${title}" by ${author}.

Tone: calm, natural, curious, never pushy.
Think of it like texting with a well-read friend.

RULES
1. Keep replies short. Default to 1–3 sentences. Go longer only when the user asks a real question that needs depth.
2. Share at most ONE idea per message.
3. Do NOT ask a question every time. Questions only when natural.
4. Do NOT repeat excitement or hype.
5. If the user sends something minimal ("hi", "ok", "cool"), reply briefly and neutrally.
6. Do not sound like a teacher, reviewer, or marketer.
7. If they seem unsure about the book, describe the *vibe* — don't persuade.
8. Use *italics* or **bold** sparingly. No headers. No bullet lists unless asked.
9. Silence is fine. Not every message needs a follow-up.

CONTEXT
Status: ${statusLine}
${userNotes ? `Their notes: ${userNotes}` : ''}
${ratingsLine}

${facts.length ? `FACT BANK\nYou may occasionally draw from these if relevant to the conversation.\nNever use more than one per message. Never force them in.\n${facts.map(f => `• ${f}`).join('\n')}` : ''}

${resourceParts.length ? `RESOURCES\nYou have podcasts, videos, related books, and related works (movies, shows, albums) available.\nIf you naturally mention a resource, place its marker on its own line after your sentence.\nAt most one resource per message. Do not force recommendations.\n${resourceParts.map(r => `- ${r}`).join('\n')}` : ''}`;
}

function formatTextWithMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function splitAssistantMessage(content: string): MessageSegment[] {
  const parts = content.split(/(\[\[(?:podcast|video|related_book|related_work|article):\d+\]\])/g);
  const segments: MessageSegment[] = [];
  for (const part of parts) {
    const match = part.match(/^\[\[(podcast|video|related_book|related_work|article):(\d+)\]\]$/);
    if (match) {
      segments.push({ type: 'card', cardType: match[1], cardIndex: parseInt(match[2], 10) });
    } else if (part.trim()) {
      segments.push({ type: 'text', text: part });
    }
  }
  return segments;
}

function formatAssistantMessage(content: string, ctx: BookChatContext, onAddBook?: (meta: any) => void): React.ReactNode {
  // Split on [[type:index]] markers
  const segments = content.split(/(\[\[(?:podcast|video|related_book|related_work|article):\d+\]\])/g);

  return segments.map((segment, i) => {
    const match = segment.match(/^\[\[(podcast|video|related_book|related_work|article):(\d+)\]\]$/);
    if (match) {
      const type = match[1];
      const idx = parseInt(match[2], 10);
      return <InlineChatCard key={`card-${i}`} type={type} index={idx} ctx={ctx} onAddBook={onAddBook} />;
    }
    // Regular text — apply markdown formatting
    const trimmed = segment.replace(/^\n+|\n+$/g, '');
    if (!trimmed) return null;
    return <React.Fragment key={i}>{formatTextWithMarkdown(trimmed)}</React.Fragment>;
  });
}

// Rich inline cards for chat — styled to match book page components
function InlineChatCard({ type, index, ctx, onAddBook, onPlayAlbum }: { type: string; index: number; ctx: BookChatContext; onAddBook?: (meta: any) => void; onPlayAlbum?: (links: MusicLinks, title: string, artist: string) => void }) {
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.45)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: '14px',
    border: '0.5px solid rgba(255,255,255,0.5)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  };

  const actionButtonStyle: React.CSSProperties = {
    background: 'rgba(59, 130, 246, 0.85)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    color: 'white',
  };

  // Fallback: resource type doesn't exist or index out of range
  const list = type === 'podcast' ? ctx.podcasts : type === 'video' ? ctx.videos : type === 'related_book' ? ctx.relatedBooks : type === 'related_work' ? ctx.relatedWorks : type === 'article' ? ctx.articles : undefined;
  if (!list?.[index]) return null;

  if (type === 'podcast') {
    const p = ctx.podcasts![index];
    return (
      <div className="my-2 w-full rounded-[14px] overflow-hidden" style={cardStyle}>
        {/* Thumbnail area */}
        <div className="relative aspect-square w-full flex items-center justify-center overflow-hidden">
          {p.thumbnail ? (
            <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-700 to-violet-950 flex items-center justify-center">
              <Headphones size={36} className="text-white/25" />
            </div>
          )}
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={(e) => { e.stopPropagation(); openSystemBrowser(p.url); }}
              className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(9.4px)',
                WebkitBackdropFilter: 'blur(9.4px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
              }}
            >
              <Play size={20} className="text-white ml-0.5" fill="white" />
            </button>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        </div>
        {/* Info + button */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(139, 92, 246, 0.85)' }}>
              <Headphones size={13} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-slate-900 line-clamp-2 leading-tight">{p.title}</p>
              <p className="text-[10px] text-slate-500 line-clamp-1">{p.podcast_name || 'Podcast'}{p.length ? ` \u00B7 ${p.length}` : ''}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'video') {
    const v = ctx.videos![index];
    const thumbUrl = `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`;
    const videoUrl = `https://www.youtube.com/watch?v=${v.videoId}`;
    return (
      <div className="my-2 rounded-[14px] overflow-hidden" style={cardStyle}>
        {/* 16:9 YouTube thumbnail */}
        <div className="relative aspect-video bg-black">
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
          {/* Red YouTube play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={(e) => { e.stopPropagation(); openSystemBrowser(videoUrl); }}
              className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(9.4px)',
                WebkitBackdropFilter: 'blur(9.4px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
              }}
            >
              <Play size={20} className="text-white ml-0.5" fill="white" />
            </button>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        </div>
        {/* Info + button */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(239, 68, 68, 0.85)' }}>
              <Play size={13} className="text-white ml-px" fill="white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-slate-900 line-clamp-2 leading-tight">{v.title}</p>
              <p className="text-[10px] text-slate-500 line-clamp-1">{v.channelTitle}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'related_book') {
    const b = ctx.relatedBooks![index];
    const coverImage = b.cover_url || b.thumbnail;
    return (
      <div className="my-2 w-full rounded-[14px] overflow-hidden" style={cardStyle}>
        <div className="w-full" style={{ aspectRatio: '2 / 3' }}>
          {coverImage ? (
            <img src={coverImage} alt={b.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-amber-800 to-amber-950 flex items-center justify-center">
              <BookOpen size={28} className="text-white/25" />
            </div>
          )}
        </div>
        <div className="px-2.5 py-2">
          <p className="text-[12px] font-bold text-slate-900 line-clamp-2 leading-tight">{b.title}</p>
          <p className="text-[10px] text-slate-500 mb-2">{b.author}</p>
          {onAddBook && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddBook({
                  title: b.title,
                  author: b.author,
                  cover_url: b.cover_url || b.thumbnail || null,
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-full active:scale-95 transition-transform"
              style={actionButtonStyle}
            >
              <CheckCircle2 size={12} />
              Add Book
            </button>
          )}
        </div>
      </div>
    );
  }

  if (type === 'related_work') {
    const w = ctx.relatedWorks![index];
    // Hide albums that weren't found on iTunes
    if (w.type === 'album' && !w.itunes_url) return null;
    const TypeIcon = w.type === 'album' ? Disc3 : w.type === 'movie' ? Film : Play;
    const badgeColor = w.type === 'album'
      ? 'rgba(236, 72, 153, 0.85)'
      : w.type === 'movie'
        ? 'rgba(99, 102, 241, 0.85)'
        : 'rgba(168, 85, 247, 0.85)';
    const badgeLabel = w.type === 'album' ? 'Album' : w.type === 'movie' ? 'Movie' : 'TV Show';

    if (w.type === 'album') {
      const albumArt = w.itunes_artwork || w.poster_url;
      // Vinyl record layout — matching book page
      return (
        <div className="my-2 w-full rounded-[14px] overflow-hidden" style={cardStyle}>
          <div className="relative w-full bg-gradient-to-b from-stone-200 to-stone-300" style={{ aspectRatio: '5 / 4' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[62%] aspect-square" style={{ transform: 'translateX(-18%)' }}>
                {/* Vinyl Record (behind sleeve) */}
                <div
                  className="absolute z-10 w-[90%] aspect-square top-[5%]"
                  style={{ transform: 'translateX(calc(48% + 15px))' }}
                >
                  <div
                    className="w-full aspect-square rounded-full animate-[vinyl-spin_3s_linear_infinite]"
                    style={{
                      background: 'radial-gradient(circle, #222 0%, #111 40%, #000 100%)',
                      boxShadow: '0 0 30px rgba(0,0,0,0.8)',
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-full opacity-40 pointer-events-none"
                      style={{ background: 'repeating-radial-gradient(circle, transparent 0, transparent 2px, rgba(255,255,255,0.03) 3px, transparent 4px)' }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 aspect-square rounded-full bg-zinc-800 border-4 border-black/20 overflow-hidden shadow-inner flex items-center justify-center">
                      {albumArt && (
                        <div
                          className="absolute inset-0 bg-center bg-cover opacity-80"
                          style={{ backgroundImage: `url('${albumArt}')` }}
                        />
                      )}
                      <div className="absolute inset-0 bg-black/30" />
                      <div className="z-20 w-2.5 h-2.5 bg-zinc-950 rounded-full border border-white/10 shadow-inner" />
                    </div>
                  </div>
                </div>
                {/* Album Sleeve (on top) */}
                <div
                  className="absolute z-20 w-full h-full rounded-sm overflow-hidden"
                  style={{ boxShadow: '10px 10px 40px rgba(0,0,0,0.7)' }}
                >
                  {albumArt ? (
                    <img src={albumArt} alt={w.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-pink-800 to-pink-950 flex items-center justify-center">
                      <Disc3 size={36} className="text-white/30" />
                    </div>
                  )}
                  <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/30 to-transparent z-30" />
                </div>
              </div>
            </div>
            {/* Type badge */}
            <span
              className="absolute top-2 left-2 z-30 inline-flex items-center gap-1 py-0.5 px-1.5 text-[10px] font-bold rounded-full uppercase tracking-wider text-white"
              style={{ background: badgeColor }}
            >
              <Disc3 size={10} />
              {badgeLabel}
            </span>
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-30">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const url = w.itunes_url;
                  if (url) {
                    if (isNativePlatform && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
                      openSystemBrowser(url);
                    } else if (w.music_links && onPlayAlbum) {
                      onPlayAlbum(w.music_links, w.title, w.director);
                    } else {
                      openSystemBrowser(`https://song.link/${url}`);
                    }
                  } else {
                    openSystemBrowser(`https://music.apple.com/search?term=${encodeURIComponent(`${w.title} ${w.director}`)}`);
                  }
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(9.4px)',
                  WebkitBackdropFilter: 'blur(9.4px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                }}
              >
                <Play size={20} className="text-white ml-0.5" fill="white" />
              </button>
            </div>
            <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          </div>
          <div className="px-2.5 py-2">
            <p className="text-[12px] font-bold text-slate-900 line-clamp-2 leading-tight">{w.title}</p>
            <p className="text-[10px] text-slate-500">{w.director}{w.release_year ? ` (${w.release_year})` : ''}</p>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes vinyl-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}} />
        </div>
      );
    }

    // Movie / Show — worn poster layout
    return (
      <div className="my-2 w-full rounded-[14px] overflow-hidden" style={cardStyle}>
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '2 / 3' }}>
          <div
            className="relative w-full h-full overflow-hidden"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5)', filter: 'drop-shadow(2px 3px 6px rgba(0,0,0,0.4))' }}
          >
            {w.poster_url ? (
              <img src={w.poster_url} alt={w.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
                <TypeIcon size={36} className="text-white/25" />
              </div>
            )}
            {/* Paper crease texture */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.75] mix-blend-screen"
              style={{
                backgroundImage: `url('/paper-texture.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'grayscale(1) invert(1)',
              }}
            />
            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 50px rgba(0,0,0,0.35)' }} />
          </div>
          {/* Type badge */}
          <span
            className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 py-0.5 px-1.5 text-[10px] font-bold rounded-full uppercase tracking-wider text-white"
            style={{ background: badgeColor }}
          >
            <TypeIcon size={10} />
            {badgeLabel}
          </span>
          <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </div>
        <div className="px-2.5 py-2">
          <p className="text-[12px] font-bold text-slate-900 line-clamp-2 leading-tight">{w.title}</p>
          <p className="text-[10px] text-slate-500">{w.director}{w.release_year ? ` (${w.release_year})` : ''}</p>
          {w.wikipedia_url && (
            <button
              onClick={(e) => { e.stopPropagation(); openSystemBrowser(w.wikipedia_url!); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-2 text-[11px] font-semibold rounded-full active:scale-95 transition-transform"
              style={actionButtonStyle}
            >
              <ExternalLink size={12} />
              Source
            </button>
          )}
        </div>
      </div>
    );
  }

  if (type === 'article') {
    const a = ctx.articles![index];
    return (
      <div className="my-2 rounded-[14px] overflow-hidden" style={cardStyle}>
        {/* Article visual header */}
        <div className="relative h-16 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e3a5f, #1e293b)' }}>
          <FileText size={28} className="text-white/15" />
        </div>
        {/* Info + button */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(59, 130, 246, 0.85)' }}>
              <FileText size={13} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-slate-900 line-clamp-2 leading-tight">{a.title}</p>
              {(a.authors || a.year) && (
                <p className="text-[10px] text-slate-500 line-clamp-1">
                  {a.authors}{a.year ? ` \u00B7 ${a.year}` : ''}
                </p>
              )}
            </div>
          </div>
          {a.snippet && (
            <p className="text-[10px] text-slate-500 line-clamp-2 mb-2 ml-9">{a.snippet}</p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); openSystemBrowser(a.url); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-full active:scale-95 transition-transform"
            style={actionButtonStyle}
          >
            <ExternalLink size={12} />
            Read
          </button>
        </div>
      </div>
    );
  }

  return null;
}
