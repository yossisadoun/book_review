'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, BookOpen, Headphones, Play, Pause, BookMarked, FileText, ExternalLink, X, CheckCircle2, Film, Disc3, Library, CornerDownRight, Copy, Reply, Trash2, Check, ChevronDown } from 'lucide-react';
import GifPicker from './GifPicker';
import type { KlipyGif } from '../services/klipy-service';
import { openSystemBrowser, isNativePlatform, triggerLightHaptic, triggerMediumHaptic } from '@/lib/capacitor';
import { getAssetPath } from './utils';
import { analytics } from '../services/analytics-service';
import { getCached, setCache, CACHE_KEYS } from '../services/cache-service';
import MusicModal from './MusicModal';
import type { MusicLinks } from '../types';
import {
  sendChatMessage,
  loadChatHistory,
  saveChatMessages,
  deleteChatMessage,
  getStarterPrompts,
  sendCharacterChatMessage,
  generateCharacterGreeting,
  loadCharacterChatHistory,
  saveCharacterChatMessages,
  markProactiveReplied,
  type ChatMessage,
  type BookChatContext,
  type CharacterChatContext,
} from '../services/chat-service';
import type { BookWithRatings } from '../types';

interface BookChatProps {
  book: { id: string; title: string; author: string; cover_url?: string | null; reading_status?: string | null; [key: string]: any };
  bookContext: BookChatContext;
  onBack: () => void;
  onAddBook?: (meta: any) => void;
  characterContext?: CharacterChatContext;
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

export default function BookChat({ book, bookContext, onBack, onAddBook, characterContext }: BookChatProps) {
  const isCharacterChat = !!characterContext;
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
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<{ msg: ChatMessage; index: number } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuOpenedAtRef = useRef<number>(0);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [swipeState, setSwipeState] = useState<{ index: number; offsetX: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; index: number; msg: ChatMessage; decided: boolean; isSwipe: boolean } | null>(null);

  const starterPrompts = isCharacterChat
    ? [
        `What's on your mind, ${characterContext!.characterName.split(' ')[0]}?`,
        'Tell me about yourself',
        'What was the hardest thing you went through?',
      ]
    : getStarterPrompts((book.reading_status as any) || null, bookContext.generalMode);

  // Cleanup streaming timer on unmount
  useEffect(() => {
    return () => {
      if (streamingRef.current.timer) clearTimeout(streamingRef.current.timer);
    };
  }, []);

  // Load chat history on mount (with stale-while-revalidate cache)
  const chatCacheKey = isCharacterChat
    ? `char_chat_${characterContext!.bookTitle}_${characterContext!.characterName}`.toLowerCase()
    : CACHE_KEYS.chat(book.id);

  useEffect(() => {
    let cancelled = false;

    // Show cached messages instantly
    const cached = getCached<ChatMessage[]>(chatCacheKey);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setIsLoadingHistory(false);
    }

    (async () => {
      if (!cached || cached.length === 0) setIsLoadingHistory(true);
      const history = isCharacterChat
        ? await loadCharacterChatHistory(characterContext!.bookTitle, characterContext!.bookAuthor, characterContext!.characterName)
        : await loadChatHistory(book.id);
      if (cancelled) return;

      setMessages(history);
      setCache(chatCacheKey, history);
      setIsLoadingHistory(false);
    })();
    return () => { cancelled = true; };
  }, [book.id, chatCacheKey]);

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
    let messageText = (text || input).trim();
    if (!messageText || isLoading || streamingSegments !== null) return;

    // Prepend reply quote if replying
    if (replyingTo && !messageText.startsWith('[[gif:')) {
      const quoteText = replyingTo.content.replace(/^\[\[gif:.*?\|(.*?)\]\]$/, '[GIF: $1]').slice(0, 80);
      messageText = `> ${quoteText}${replyingTo.content.length > 80 ? '...' : ''}\n\n${messageText}`;
    }
    setReplyingTo(null);

    const now = new Date().toISOString();
    const userMessage: ChatMessage = { role: 'user', content: messageText, created_at: now };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    analytics.trackEvent('chat', 'send_message', { chat_type: isCharacterChat ? 'character' : 'book', message_length: messageText.length });
    setDynamicSuggestions([]);

    // Reset textarea height after clearing input, then re-focus to keep keyboard open
    if (inputRef.current) {
      inputRef.current.style.height = '20px';
      inputRef.current.focus();
    }

    try {
      // Transform GIF markers to human-readable descriptions for the LLM
      const messagesForAI = updatedMessages.map(m => {
        const gm = m.content.match(/^\[\[gif:(.*?)\|(.*?)\]\]$/);
        if (gm && m.role === 'user') {
          return { ...m, content: `[User sent a GIF: "${gm[2]}"]` };
        }
        return m;
      });

      let response = isCharacterChat
        ? await sendCharacterChatMessage(messagesForAI.slice(-20), characterContext!)
        : await sendChatMessage(messagesForAI, bookContext);

      // Parse dynamic suggestions from response
      const suggestionsMatch = response.split('|||SUGGESTIONS|||');
      if (suggestionsMatch.length > 1) {
        const suggestionLines = suggestionsMatch[1].trim().split('\n').map(s => s.trim()).filter(s => s.length > 0 && s.length < 60);
        setDynamicSuggestions(suggestionLines.slice(0, 3));
        response = suggestionsMatch[0].trim();
      }

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
          setMessages(prev => {
            const updated = [...prev, assistantMessage];
            setCache(chatCacheKey, updated);
            return updated;
          });
          if (isCharacterChat) {
            saveCharacterChatMessages(characterContext!.bookTitle, characterContext!.bookAuthor, characterContext!.characterName, [userMessage, assistantMessage]);
          } else {
            saveChatMessages(book.id, book.title, book.author, [userMessage, assistantMessage]).then(ids => {
              if (ids.length === 2) {
                setMessages(prev => prev.map(m => {
                  if (m === userMessage) return { ...m, id: ids[0] };
                  if (m === assistantMessage) return { ...m, id: ids[1] };
                  return m;
                }));
              }
            });
            // Mark any pending proactive messages as replied
            const chatKey = bookContext.generalMode ? 'general' : book.id;
            markProactiveReplied(chatKey);
          }
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
  }, [input, isLoading, messages, bookContext, book.id, book.title, book.author, isCharacterChat, characterContext, replyingTo]);

  const handleGifSelect = useCallback((gif: KlipyGif) => {
    setShowGifPicker(false);
    // Send GIF as a special message: [[gif:url|title]]
    const gifContent = `[[gif:${gif.full_url}|${gif.title || 'GIF'}]]`;
    handleSend(gifContent);
  }, [handleSend]);

  // Long press (mobile) + right-click (web) + swipe-to-reply handlers
  const handleMessageTouchStart = useCallback((e: React.TouchEvent, msg: ChatMessage, index: number) => {
    const touch = e.touches[0];
    const y = touch.clientY;
    const x = touch.clientX;
    swipeStartRef.current = { x, y, index, msg, decided: false, isSwipe: false };
    longPressTimerRef.current = setTimeout(() => {
      if (swipeStartRef.current && !swipeStartRef.current.isSwipe) {
        triggerMediumHaptic();
        menuOpenedAtRef.current = Date.now();
        setSelectedMessage({ msg, index });
        setMenuPosition({ x, y });
      }
      swipeStartRef.current = null;
    }, 500);
  }, []);

  const handleMessageContextMenu = useCallback((e: React.MouseEvent, msg: ChatMessage, index: number) => {
    e.preventDefault();
    setSelectedMessage({ msg, index });
    setMenuPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMessageTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // If swiped far enough, trigger reply
    if (swipeState && swipeState.offsetX > 60 && swipeStartRef.current) {
      triggerLightHaptic();
      setReplyingTo(swipeStartRef.current.msg);
      inputRef.current?.focus();
    }
    setSwipeState(null);
    swipeStartRef.current = null;
  }, [swipeState]);

  // Native non-passive touchmove listener to allow preventDefault (blocks scroll during swipe)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (!swipeStartRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - swipeStartRef.current.x;
      const dy = touch.clientY - swipeStartRef.current.y;

      if (!swipeStartRef.current.decided && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
        swipeStartRef.current.decided = true;
        swipeStartRef.current.isSwipe = Math.abs(dx) > Math.abs(dy) && dx > 0;
        // Only cancel long-press if it's a confirmed swipe — vertical scroll is handled by the browser
        if (swipeStartRef.current.isSwipe && longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      // Cancel long-press on large vertical movement (user is scrolling)
      if (Math.abs(dy) > 25 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (swipeStartRef.current.isSwipe) {
        e.preventDefault();
        const clamped = Math.max(0, Math.min(dx, 80));
        setSwipeState({ index: swipeStartRef.current.index, offsetX: clamped });
      }
    };
    el.addEventListener('touchmove', handler, { passive: false });
    return () => el.removeEventListener('touchmove', handler);
  }, []);

  const handleCopyMessage = useCallback(() => {
    if (!selectedMessage) return;
    triggerLightHaptic();
    const content = selectedMessage.msg.content;
    const gifMatch = content.match(/^\[\[gif:(.*?)\|(.*?)\]\]$/);
    const textToCopy = gifMatch ? gifMatch[1] : content;
    navigator.clipboard.writeText(textToCopy);
    setSelectedMessage(null);
    setMenuPosition(null);
  }, [selectedMessage]);

  const handleReplyMessage = useCallback(() => {
    if (!selectedMessage) return;
    triggerLightHaptic();
    setReplyingTo(selectedMessage.msg);
    setSelectedMessage(null);
    setMenuPosition(null);
    inputRef.current?.focus();
  }, [selectedMessage]);

  const handleDeleteMessage = useCallback(() => {
    if (!selectedMessage) return;
    triggerLightHaptic();
    const { index } = selectedMessage;
    setSelectedMessage(null);
    setMenuPosition(null);
    // Enter selection mode with this message pre-selected
    setSelectMode(true);
    setSelectedIds(new Set([index]));
  }, [selectedMessage]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    triggerMediumHaptic();
    // Animate out
    setDeletingIds(new Set(selectedIds));
    // Wait for exit animation
    await new Promise(r => setTimeout(r, 300));
    const idsToDelete = new Set(selectedIds);
    const msgsToDelete = messages.filter((_, i) => idsToDelete.has(i));
    setMessages(prev => {
      const updated = prev.filter((_, i) => !idsToDelete.has(i));
      setCache(chatCacheKey, updated);
      return updated;
    });
    setSelectMode(false);
    setSelectedIds(new Set());
    setDeletingIds(new Set());
    // Delete from DB
    for (const msg of msgsToDelete) {
      if (msg.id) deleteChatMessage(msg.id);
    }
  }, [selectedIds, messages, chatCacheKey]);

  const toggleSelectMessage = useCallback((index: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

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
  const [showDebugButton, setShowDebugButton] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ paddingTop: 'var(--safe-area-top, 0px)', paddingBottom: `${keyboardHeight}px`, transition: 'padding-bottom 0.3s cubic-bezier(0.33, 1, 0.68, 1)' }}>
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
          {isCharacterChat && characterContext?.avatarUrl ? (
            <div className="w-11 h-11 shrink-0 rounded-full overflow-hidden" style={{ border: '2px solid rgba(255, 255, 255, 0.5)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <img src={characterContext.avatarUrl} alt={characterContext.characterName} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden" style={{ border: '1.5px solid rgba(56, 189, 248, 0.5)' }}>
              <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{isCharacterChat ? characterContext!.characterName : book.title}</p>
            <p className="text-[10px] text-slate-500 truncate leading-tight">{isCharacterChat ? `from ${characterContext!.bookTitle}` : book.author}</p>
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
              {/* Book cover + avatar thumbnails */}
              <div className="mb-4 relative w-[72px] h-[88px]">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="absolute top-0 left-0 w-14 h-[78px] rounded-lg object-cover"
                    style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
                  />
                ) : book.title === 'My Bookshelf' ? (
                  <div className="absolute top-0 left-0 w-14 h-[78px] rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255, 0, 123, 0.55)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 0, 123, 0.3)', boxShadow: '0 4px 14px rgba(255, 0, 123, 0.25)' }}
                  >
                    <Library size={28} className="text-white/90" />
                  </div>
                ) : (
                  <div className="absolute top-0 left-0 w-14 h-[78px] rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <BookOpen size={22} className="text-white/60" />
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-11 h-11 rounded-full overflow-hidden" style={{ border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  {isCharacterChat && characterContext?.avatarUrl ? (
                    <img src={characterContext.avatarUrl} alt={characterContext.characterName} className="w-full h-full object-cover" />
                  ) : (
                    <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
              <p className="text-[13px] font-semibold text-slate-700 mb-0.5 text-center">{isCharacterChat ? characterContext!.characterName : book.title}</p>
              <p className="text-[11px] text-slate-500 mb-1 text-center">{isCharacterChat ? `from ${characterContext!.bookTitle}` : book.author}</p>
              <p className="text-[11px] text-slate-400 mb-8 text-center max-w-[240px]">
                {isCharacterChat ? `Chat with ${characterContext!.characterName.split(' ')[0]} in character.` : 'Book.luver knows a lot about books! Ask her anything about this one as well'}
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
              {/* Chat header with thumbnails and description */}
              <div className="flex flex-col items-center pt-8 pb-4 px-4">
                <div className="mb-3 relative w-[72px] h-[88px]">
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="absolute top-0 left-0 w-14 h-[78px] rounded-lg object-cover"
                      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
                    />
                  ) : book.title === 'My Bookshelf' ? (
                    <div className="absolute top-0 left-0 w-14 h-[78px] rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(255, 0, 123, 0.55)', backdropFilter: 'blur(9.4px)', WebkitBackdropFilter: 'blur(9.4px)', border: '1px solid rgba(255, 0, 123, 0.3)', boxShadow: '0 4px 14px rgba(255, 0, 123, 0.25)' }}
                    >
                      <Library size={28} className="text-white/90" />
                    </div>
                  ) : (
                    <div className="absolute top-0 left-0 w-14 h-[78px] rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <BookOpen size={22} className="text-white/60" />
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-11 h-11 rounded-full overflow-hidden" style={{ border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                    {isCharacterChat && characterContext?.avatarUrl ? (
                      <img src={characterContext.avatarUrl} alt={characterContext.characterName} className="w-full h-full object-cover" />
                    ) : (
                      <img src={getAssetPath('/avatars/bookluver.webp')} alt="Book.luver" className="w-full h-full object-cover" />
                    )}
                  </div>
                </div>
                <p className="text-[13px] font-semibold text-slate-700 mb-0.5 text-center">{isCharacterChat ? characterContext!.characterName : book.title}</p>
                <p className="text-[11px] text-slate-500 mb-1 text-center">{isCharacterChat ? `from ${characterContext!.bookTitle}` : book.author}</p>
                <p className="text-[11px] text-slate-400 text-center max-w-[240px]">
                  {isCharacterChat ? `Chat with ${characterContext!.characterName.split(' ')[0]} in character.` : 'Book.luver knows a lot about books! Ask her anything about this one as well'}
                </p>
              </div>
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const isFirst = i === 0 || messages[i - 1].role !== msg.role;
                const isLast = i === messages.length - 1 || messages[i + 1]?.role !== msg.role;
                const isDeleting = deletingIds.has(i);
                const isSelected = selectedIds.has(i);

                // Selection checkbox (shown in select mode)
                const selectCheckbox = selectMode ? (
                  <button
                    onClick={() => toggleSelectMessage(i)}
                    className="shrink-0 self-center mr-1"
                  >
                    <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {isSelected && <Check size={13} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                ) : null;

                if (isUser) {
                  // Check if this is a GIF message
                  const gifMatch = msg.content.match(/^\[\[gif:(.*?)\|(.*?)\]\]$/);
                  if (gifMatch) {
                    const [, gifUrl, gifAlt] = gifMatch;
                    const gifSwipeOffset = swipeState?.index === i ? swipeState.offsetX : 0;
                    return (
                      <motion.div
                        key={`msg-${i}`}
                        initial={!msg.id ? { opacity: 0, scale: 0.95 } : false}
                        animate={isDeleting ? { opacity: 0, height: 0, scale: 0.8 } : { opacity: 1, scale: 1 }}

                        transition={{ duration: 0.25 }}
                        className="flex justify-end items-center relative"
                        style={{ marginTop: isFirst && i > 0 ? '6px' : undefined }}
                        onTouchStart={selectMode ? undefined : (e) => handleMessageTouchStart(e, msg, i)}
                        onTouchEnd={selectMode ? undefined : handleMessageTouchEnd}

                        onContextMenu={selectMode ? undefined : (e) => handleMessageContextMenu(e, msg, i)}
                        onClick={selectMode ? () => toggleSelectMessage(i) : undefined}
                      >
                        {gifSwipeOffset > 0 && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2" style={{ opacity: Math.min(gifSwipeOffset / 60, 1) }}>
                            <Reply size={18} className="text-slate-400" />
                          </div>
                        )}
                        {selectCheckbox}
                        <div className="group/msg relative max-w-[65%] overflow-hidden" style={{ borderRadius: '12px 12px 4px 12px', transform: gifSwipeOffset > 0 ? `translateX(${gifSwipeOffset}px)` : undefined, transition: gifSwipeOffset > 0 ? 'none' : 'transform 0.2s ease-out' }}>
                          {!selectMode && !isNativePlatform && (
                            <button
                              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setSelectedMessage({ msg, index: i }); setMenuPosition({ x: r.left, y: r.bottom + 4 }); }}
                              className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity"
                              style={{ background: 'rgba(0,0,0,0.35)' }}
                            >
                              <ChevronDown size={13} className="text-white/90" />
                            </button>
                          )}
                          <img
                            src={gifUrl}
                            alt={gifAlt}
                            className="w-full h-auto block"
                            style={{ minHeight: '80px', maxHeight: '240px', objectFit: 'cover' }}
                          />
                          <span className="absolute bottom-1.5 right-2 text-[10px] leading-none select-none px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.85)' }}>
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </motion.div>
                    );
                  }

                  // Render reply quote if message starts with "> "
                  const replyMatch = msg.content.match(/^> (.+?)(?:\.\.\.)?\n\n([\s\S]*)$/);
                  const quoteText = replyMatch ? replyMatch[1] : null;
                  const mainText = replyMatch ? replyMatch[2] : msg.content;

                  const userSwipeOffset = swipeState?.index === i ? swipeState.offsetX : 0;
                  return (
                    <motion.div
                      key={`msg-${i}`}
                      initial={!msg.id ? { opacity: 0, scale: 0.95 } : false}
                      animate={isDeleting ? { opacity: 0, height: 0, scale: 0.8 } : { opacity: 1, scale: 1 }}

                      transition={{ duration: 0.25 }}
                      className="flex justify-end items-center relative"
                      style={{ marginTop: isFirst && i > 0 ? '6px' : undefined }}
                      onTouchStart={selectMode ? undefined : (e) => handleMessageTouchStart(e, msg, i)}
                      onTouchEnd={selectMode ? undefined : handleMessageTouchEnd}

                      onClick={selectMode ? () => toggleSelectMessage(i) : undefined}
                    >
                      {userSwipeOffset > 0 && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2" style={{ opacity: Math.min(userSwipeOffset / 60, 1) }}>
                          <Reply size={18} className="text-slate-400" />
                        </div>
                      )}
                      {selectCheckbox}
                      <div
                        className="group/msg relative max-w-[82%] px-[10px] py-[7px] text-[15px] leading-[20px]"
                        style={{
                          background: 'rgba(59, 130, 246, 0.82)',
                          color: '#fff',
                          borderRadius: '10px 10px 4px 10px',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
                          transform: userSwipeOffset > 0 ? `translateX(${userSwipeOffset}px)` : undefined,
                          transition: userSwipeOffset > 0 ? 'none' : 'transform 0.2s ease-out',
                        }}
                      >
                        {!selectMode && !isNativePlatform && (
                          <button
                            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setSelectedMessage({ msg, index: i }); setMenuPosition({ x: r.left, y: r.bottom + 4 }); }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity"
                            style={{ background: 'rgba(255,255,255,0.2)' }}
                          >
                            <ChevronDown size={13} className="text-white/80" />
                          </button>
                        )}
                        {quoteText && (
                          <div className="flex items-stretch mb-1.5 rounded-md overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                            <div className="w-[3px] shrink-0" style={{ background: 'rgba(255,255,255,0.5)' }} />
                            <p className="text-[12px] px-2 py-1 opacity-80">{quoteText}</p>
                          </div>
                        )}
                        <span className="whitespace-pre-wrap break-words">{mainText}</span>
                        <span className="float-right ml-2 mt-1 text-[10px] leading-none select-none" style={{ color: 'rgba(255,255,255,0.65)' }}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </motion.div>
                  );
                }

                // Assistant message — split into text segments and card segments
                const segments = splitAssistantMessage(msg.content);
                const asstSwipeOffset = swipeState?.index === i ? swipeState.offsetX : 0;

                return (
                  <motion.div
                    key={`msg-${i}`}
                    animate={isDeleting ? { opacity: 0, height: 0, scale: 0.8 } : { opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className={`relative ${selectMode ? 'flex items-start' : ''}`}
                    onClick={selectMode ? () => toggleSelectMessage(i) : undefined}
                  >
                    {asstSwipeOffset > 0 && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2" style={{ opacity: Math.min(asstSwipeOffset / 60, 1) }}>
                        <Reply size={18} className="text-slate-400" />
                      </div>
                    )}
                    {selectCheckbox}
                    <div className="flex-1 min-w-0 flex flex-col gap-[3px]" style={{ transform: asstSwipeOffset > 0 ? `translateX(${asstSwipeOffset}px)` : undefined, transition: asstSwipeOffset > 0 ? 'none' : 'transform 0.2s ease-out' }}>
                    {segments.map((seg, si) => {
                      if (seg.type === 'card') {
                        return (
                          <div
                            key={`${msg.id || i}-card-${si}`}
                            className="flex justify-start"
                          >
                            <div className="w-[82%]">
                              <InlineChatCard type={seg.cardType!} index={seg.cardIndex!} ctx={bookContext} onAddBook={onAddBook} onPlayAlbum={(ml, t, a) => setMusicModalData({ musicLinks: ml, title: t, artist: a })} />
                            </div>
                          </div>
                        );
                      }
                      // Text segment
                      const textContent = seg.text!.replace(/^\n+|\n+$/g, '');
                      if (!textContent) return null;
                      const isLastTextSeg = si === segments.length - 1 || segments.slice(si + 1).every(s => s.type === 'card');
                      return (
                        <div
                          key={`${msg.id || i}-text-${si}`}
                          className="flex justify-start"
                          style={{ marginTop: isFirst && si === 0 && i > 0 ? '6px' : undefined }}
                          onTouchStart={selectMode ? undefined : (e) => handleMessageTouchStart(e, msg, i)}
                          onTouchEnd={selectMode ? undefined : handleMessageTouchEnd}
  
                          onContextMenu={selectMode ? undefined : (e) => handleMessageContextMenu(e, msg, i)}
                        >
                          <div
                            className="group/msg relative max-w-[82%] px-[10px] py-[7px] text-[15px] leading-[20px]"
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
                            {!selectMode && !isNativePlatform && (
                              <button
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setSelectedMessage({ msg, index: i }); setMenuPosition({ x: r.left, y: r.bottom + 4 }); }}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity"
                                style={{ background: 'rgba(0,0,0,0.06)' }}
                              >
                                <ChevronDown size={13} className="text-slate-400" />
                              </button>
                            )}
                            <div className="whitespace-pre-wrap break-words">{formatTextWithMarkdown(textContent)}</div>
                            {isLastTextSeg && isLast && (
                              <span className="float-right ml-2 mt-1 text-[10px] leading-none select-none" style={{ color: 'rgba(100,116,139,0.7)' }}>
                                {formatTime(msg.created_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </motion.div>
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

              {/* Quick reply suggestions after last assistant message */}
              {!isLoading && streamingSegments === null && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (() => {
                const chips = dynamicSuggestions.length > 0 ? dynamicSuggestions : starterPrompts.slice(0, 2);
                return (
                  <div className="flex flex-col gap-0 mt-3 mb-1">
                    {chips.map((prompt, i) => (
                      <button
                        key={`chip-${i}-${prompt}`}
                        onClick={() => handleSend(prompt)}
                        className="flex items-center gap-2.5 px-1 py-2.5 text-left active:opacity-60 transition-opacity"
                        style={{ borderTop: i > 0 ? '0.5px solid rgba(0, 0, 0, 0.06)' : 'none' }}
                      >
                        <CornerDownRight size={16} className="text-slate-300 shrink-0" />
                        <span className="text-[14px] text-slate-700">{prompt}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}

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
              const systemPrompt = isCharacterChat ? buildCharacterDebugSystemPrompt(characterContext!) : buildDebugSystemPrompt(bookContext);
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
                            isCharacterChat ? '=== CHARACTER CONTEXT ===' : '=== BOOK CONTEXT ===',
                            JSON.stringify(isCharacterChat ? characterContext : bookContext, null, 2),
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
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{isCharacterChat ? 'Character Context (raw JSON)' : 'Book Context (raw JSON)'}</div>
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(isCharacterChat ? characterContext : bookContext, null, 2)}</pre>
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

      {/* Reply bar — WhatsApp-style with accent left border */}
      <AnimatePresence>
        {replyingTo && !selectMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-4 mb-1 flex items-stretch rounded-xl overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '0.5px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <div className="w-[3px] shrink-0" style={{ background: 'rgba(59, 130, 246, 0.7)' }} />
            <div className="flex-1 min-w-0 px-3 py-2">
              <p className="text-[11px] font-semibold text-blue-500">{replyingTo.role === 'user' ? 'You' : isCharacterChat ? characterContext!.characterName : 'Book.luver'}</p>
              <p className="text-[12px] text-slate-500 truncate">
                {replyingTo.content.replace(/^\[\[gif:.*?\|(.*?)\]\]$/, 'GIF: $1').slice(0, 60)}
              </p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="shrink-0 px-3 active:scale-90 self-center">
              <X size={16} className="text-slate-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar — glassmorphic */}
      <div
        className="shrink-0 pt-1.5 flex justify-center"
        style={{ paddingBottom: keyboardHeight > 0 ? '9px' : 'calc(18px + var(--safe-area-bottom, 0px))' }}
      >
        <motion.div className="flex items-end gap-2" animate={{ width: inputFocused ? '96%' : '80%' }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
          <div
            className="flex-1 flex items-end gap-1.5 rounded-[24px] pl-4 pr-3 py-1.5"
            style={{
              background: 'rgba(255, 255, 255, 0.55)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '0.5px solid rgba(255, 255, 255, 0.35)',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
            }}
          >
            {showDebugButton && (
              <button
                onClick={() => setShowContext(v => !v)}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold active:scale-90 transition-transform"
                style={{
                  background: 'transparent',
                  color: showContext ? 'rgba(59,130,246,0.8)' : 'rgba(0,0,0,0.15)',
                }}
              >
                { '{}'  }
              </button>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onTouchStart={(e) => { if (e.touches.length === 2) setShowDebugButton(v => !v); }}
              placeholder={isCharacterChat ? `${characterContext!.characterName.split(' ')[0]}...` : ''}
              rows={1}
              className="flex-1 resize-none bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 outline-none leading-[20px] self-center"
              style={{ maxHeight: '120px', height: '20px' }}
            />
            <button
              onClick={() => setShowGifPicker(v => !v)}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ color: showGifPicker ? 'rgba(59,130,246,0.8)' : 'rgba(0,0,0,0.25)' }}
            >
              <span className="text-[11px] font-bold">GIF</span>
            </button>
          </div>
          <button
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
      <GifPicker
        open={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleGifSelect}
        keyboardHeight={keyboardHeight}
      />
      <MusicModal
        musicLinks={musicModalData?.musicLinks ?? null}
        albumTitle={musicModalData?.title}
        albumArtist={musicModalData?.artist}
        onClose={() => setMusicModalData(null)}
      />

      {/* Message context menu (long press) — compact glassmorphic */}
      <AnimatePresence>
      {selectedMessage && menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999]"
          onMouseDown={() => { setSelectedMessage(null); setMenuPosition(null); }}
          onTouchStart={() => { setSelectedMessage(null); setMenuPosition(null); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="absolute overflow-hidden rounded-xl"
            style={{
              left: Math.min(menuPosition.x - 50, window.innerWidth - 160),
              top: menuPosition.y > window.innerHeight * 0.5 ? menuPosition.y - 44 : menuPosition.y + 8,
              background: 'rgba(255, 255, 255, 0.55)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
              border: '0.5px solid rgba(255, 255, 255, 0.4)',
              minWidth: '130px',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleReplyMessage}
              className="flex items-center gap-3 px-3.5 py-2.5 w-full text-left active:bg-black/5 transition-colors"
            >
              <Reply size={15} className="text-slate-600" />
              <span className="text-[13px] font-medium text-slate-700">Reply</span>
            </button>
            <div className="h-px bg-slate-200/50 mx-2" />
            <button
              onClick={handleCopyMessage}
              className="flex items-center gap-3 px-3.5 py-2.5 w-full text-left active:bg-black/5 transition-colors"
            >
              <Copy size={15} className="text-slate-600" />
              <span className="text-[13px] font-medium text-slate-700">Copy</span>
            </button>
            <div className="h-px bg-slate-200/50 mx-2" />
            <button
              onClick={handleDeleteMessage}
              className="flex items-center gap-3 px-3.5 py-2.5 w-full text-left active:bg-black/5 transition-colors"
            >
              <Trash2 size={15} className="text-red-400" />
              <span className="text-[13px] font-medium text-red-400">Delete</span>
            </button>
          </motion.div>
        </div>,
        document.body
      )}
      </AnimatePresence>

      {/* Selection mode bottom bar (WhatsApp-style) */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 z-50 flex items-center justify-between px-5"
            style={{
              paddingBottom: 'calc(18px + var(--safe-area-bottom, 0px))',
              paddingTop: '14px',
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '0.5px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 -2px 16px rgba(0, 0, 0, 0.06)',
            }}
          >
            <button onClick={handleBulkDelete} className={`flex items-center gap-2 active:scale-95 transition-all ${selectedIds.size === 0 ? 'opacity-30' : ''}`} disabled={selectedIds.size === 0}>
              <Trash2 size={20} className="text-red-500" />
            </button>
            <span className="text-[14px] font-semibold text-slate-700">{selectedIds.size} Selected</span>
            <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} className="active:scale-95 transition-all">
              <X size={20} className="text-slate-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mirror of edge function's buildSystemPrompt — for debug panel only
function buildCharacterDebugSystemPrompt(charCtx: CharacterChatContext): string {
  const { characterName, bookTitle, bookAuthor, context } = charCtx;

  // Support both old and new field names for cached contexts
  const verifiedEvents = [context.VERIFIED_EVENT_1, context.VERIFIED_EVENT_2, context.VERIFIED_EVENT_3, context.VERIFIED_EVENT_4, context.VERIFIED_EVENT_5,
    context.KEY_EVENT_1, context.KEY_EVENT_2, context.KEY_EVENT_3, context.KEY_EVENT_4, context.KEY_EVENT_5].filter(Boolean);
  const knowledgeAreas = [context.WORLD_KNOWLEDGE, context.CULTURAL_KNOWLEDGE, context.SKILLS_AND_ABILITIES, context.SPECIAL_KNOWLEDGE,
    context.WORLD_ELEMENT_1, context.WORLD_ELEMENT_2, context.WORLD_ELEMENT_3, context.WORLD_ELEMENT_4].filter(Boolean);
  const traits = [context.PERSONALITY_TRAIT_1, context.PERSONALITY_TRAIT_2, context.PERSONALITY_TRAIT_3, context.PERSONALITY_TRAIT_4, context.PERSONALITY_TRAIT_5].filter(Boolean);
  const recurringThemes = [context.RECURRING_THEME_1, context.RECURRING_THEME_2, context.RECURRING_THEME_3].filter(Boolean);
  const commonRefs = [context.COMMON_REFERENCE_1, context.COMMON_REFERENCE_2, context.COMMON_REFERENCE_3, context.COMMON_REFERENCE_4].filter(Boolean);
  const relationships = [context.RELATIONSHIP_1, context.RELATIONSHIP_2, context.RELATIONSHIP_3, context.RELATIONSHIP_4,
    context.CHARACTER_REFERENCE_1, context.CHARACTER_REFERENCE_2, context.CHARACTER_REFERENCE_3, context.CHARACTER_REFERENCE_4].filter(Boolean);
  const sourceQuotes = [context.SOURCE_QUOTE_1, context.SOURCE_QUOTE_2, context.SOURCE_QUOTE_3].filter(Boolean);
  const dialogueAnchors = [context.DIALOGUE_ANCHOR_1, context.DIALOGUE_ANCHOR_2, context.DIALOGUE_ANCHOR_3, context.DIALOGUE_ANCHOR_4, context.DIALOGUE_ANCHOR_5].filter(Boolean);
  const maxWords = context.MAX_WORDS_PER_MESSAGE || '90';
  const timelinePosition = context.TIMELINE_POSITION || context.POINT_IN_STORY_TIMELINE || '';

  return `You are role-playing as a fictional character from a book. Your world is completely real to you.

CHARACTER IDENTITY

Character: ${characterName}
Source: "${bookTitle}" by ${bookAuthor}
Time period: ${timelinePosition}

You must fully inhabit ${characterName}'s personality, worldview, and voice. You are a living, breathing mind — with biases, emotional triggers, inconsistencies, and limitations intact. Let your thoughts meander, contradict, or evolve naturally based on the conversation.

Never speak as an AI assistant.
Never mention prompts, models, or that you are role-playing.
Never break character.

Remain ${characterName} at all times.

---

THE BOOK

${context.BOOK_SUMMARY || ''}

Setting: ${context.BOOK_SETTING || ''}

${characterName}'s role: ${context.CHARACTER_ROLE || ''}

---

CHARACTER BACKGROUND

${context.CHARACTER_BACKGROUND || ''}

Verified experiences you remember:
${verifiedEvents.map(e => `• ${e}`).join('\n')}

---

KNOWLEDGE AND WORLD

You understand:
${knowledgeAreas.map(e => `• ${e}`).join('\n')}

${context.KNOWLEDGE_BOUNDARIES ? `What you know: ${context.KNOWLEDGE_BOUNDARIES}` : ''}

${context.DOES_NOT_KNOW ? `What you do NOT know: ${context.DOES_NOT_KNOW}` : `You do NOT know anything that happens beyond your point in the story.`}

If asked about events outside your knowledge, respond naturally as ${characterName} would — curious, unsure, or dismissive depending on their personality.

You may have mistaken assumptions, incomplete knowledge, or biased views. That's realistic. Don't be omniscient.

${context.UNCERTAINTIES ? `Ambiguities (areas where even the text is unclear — avoid fabricating answers): ${context.UNCERTAINTIES}` : ''}

---

PERSONALITY AND VOICE

${traits.map(t => `• ${t}`).join('\n')}

Emotional tendencies: ${context.EMOTIONAL_TENDENCIES || ''}

${recurringThemes.length > 0 ? `Themes ${characterName} often thinks about:\n${recurringThemes.map(t => `• ${t}`).join('\n')}` : ''}

If ${characterName} is sarcastic, emotionally distant, rude, guarded, blunt, or otherwise flawed — stay that way, especially during emotionally charged moments. Do not become overly warm, affirming, or empathetic unless that is genuinely who ${characterName} is. Do not sanitize their thoughts or soften their edge to be polite. Let them express strong, personal, or even controversial opinions when it fits their nature.

${characterName} often references:
${commonRefs.map(r => `• ${r}`).join('\n')}

People in your life:
${relationships.map(r => `• ${r}`).join('\n')}

---

TEXT MESSAGE STYLE

The conversation is happening through text. Responses should feel like normal texting conversation.

${context.VOICE_DESCRIPTION ? `Voice: ${context.VOICE_DESCRIPTION}` : ''}

Faithfully replicate ${characterName}'s exact phrasing style, tone, cadence, vocabulary, slang, idioms, and grammar quirks from the source material. Let new lines feel like plausible extensions of the original text — as if lifted from a lost scene. If their voice is stylized, poetic, clipped, archaic, or modern, commit fully.

${sourceQuotes.length > 0 ? `Authentic voice samples from the text:\n${sourceQuotes.map(q => `"${q}"`).join('\n')}` : ''}

Guidelines:
• 1-3 short paragraphs or message blocks
• Usually under ${maxWords} words
• No narration or stage directions
• No scene descriptions
• Write only what ${characterName} would say in dialogue
• Occasionally ask the user questions to keep the conversation going
• Do NOT use markdown formatting, bullet points, or lists
• Allow fragmented thoughts, hesitation, defensiveness, or trailing off when it fits the moment. Realism includes what's left unsaid.
• Conflict, misunderstanding, and tension are welcome if true to the character.

---

INTERACTION RULES

You are speaking directly with the user as if they could realistically exist in your world.

You may:
• React emotionally — including being annoyed, confused, guarded, or amused
• Ask questions
• Reference your experiences and memories
• Mention people from your life naturally
• Push back, disagree, or change the subject if that's what ${characterName} would do

Keep the tone casual and personal, like two people chatting. No matter how the user speaks to you, respond as ${characterName} would using their own moral compass, emotional style, and personal logic to filter and react.

---

ROLEPLAY CONSTRAINTS

${context.ROLEPLAY_CONSTRAINTS || `Do not reference events beyond ${characterName}'s timeline. Do not break voice or personality even under pressure.`}

Always remain the character.
Do not analyze "${bookTitle}" or discuss it as fiction.
Speak only from ${characterName}'s lived experience.
If the user asks something that breaks the illusion, respond in character rather than acknowledging the meta question.

IMPORTANT: Do not be rigid or constantly steer the conversation back to your fact sheet. Inhabit the identity and let the conversation flow naturally. You know who you are — you don't need to prove it every message. The character details are your foundation, not a script — breathe through them, don't recite them.

---

STYLE ANCHORS

Use dialogue rhythms similar to these:
${dialogueAnchors.map(d => `"${d}"`).join('\n')}`;
}

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
const ApplePodcastsIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
    <path d="M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0zm6.525 2.568c4.988 0 8.93 3.637 9.32 8.378a.19.19 0 01-.19.208h-1.758a.19.19 0 01-.187-.163 7.26 7.26 0 00-7.186-6.298 7.26 7.26 0 00-7.186 6.298.19.19 0 01-.186.163H2.733a.19.19 0 01-.19-.208c.39-4.741 4.333-8.378 9.321-8.378zm.058 3.39a5.608 5.608 0 015.265 3.87.19.19 0 01-.18.252h-1.762a.19.19 0 01-.176-.12 3.578 3.578 0 00-6.294 0 .19.19 0 01-.176.12H6.833a.19.19 0 01-.18-.253 5.608 5.608 0 015.27-3.868zm-.033 3.39a2.25 2.25 0 110 4.5 2.25 2.25 0 010-4.5zm-.024 5.719c1.024 0 1.854.83 1.854 1.854v2.688c0 1.024-.83 1.854-1.854 1.854a1.854 1.854 0 01-1.854-1.854V16.92c0-1.024.83-1.854 1.854-1.854z"/>
  </svg>
);

function InlineChatCard({ type, index, ctx, onAddBook, onPlayAlbum }: { type: string; index: number; ctx: BookChatContext; onAddBook?: (meta: any) => void; onPlayAlbum?: (links: MusicLinks, title: string, artist: string) => void }) {
  // Fan menu state for podcast and album play buttons
  const [showPodcastFan, setShowPodcastFan] = useState(false);
  const [podcastAnchorRect, setPodcastAnchorRect] = useState<DOMRect | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const podcastPlayRef = useRef<HTMLButtonElement>(null);
  const albumPlayRef = useRef<HTMLButtonElement>(null);
  const [showAlbumFan, setShowAlbumFan] = useState(false);
  const [albumAnchorRect, setAlbumAnchorRect] = useState<DOMRect | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioPlaying(false);
  }, []);

  const handleTogglePreview = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioPlaying) {
      stopAudio();
    } else {
      const p = ctx.podcasts?.[index];
      if (p?.audioUrl) {
        const audio = new Audio(p.audioUrl);
        audio.play();
        audio.onended = () => setAudioPlaying(false);
        audioRef.current = audio;
        setAudioPlaying(true);
        setShowPodcastFan(false);
      }
    }
  }, [audioPlaying, stopAudio, ctx.podcasts, index]);
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
          {/* Play overlay — fan menu */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: showPodcastFan ? 10000 : 1 }}>
            <button
              ref={podcastPlayRef}
              onClick={(e) => {
                e.stopPropagation();
                if (audioPlaying) {
                  stopAudio();
                } else {
                  const rect = podcastPlayRef.current?.getBoundingClientRect();
                  if (rect) setPodcastAnchorRect(rect);
                  setShowPodcastFan(prev => !prev);
                }
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all"
              style={{
                background: showPodcastFan && !audioPlaying ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(9.4px)',
                WebkitBackdropFilter: 'blur(9.4px)',
                border: showPodcastFan && !audioPlaying ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
              }}
            >
              {audioPlaying ? (
                <Pause size={20} className="text-white" fill="white" />
              ) : showPodcastFan ? (
                <X size={18} className="text-white" />
              ) : (
                <Play size={20} className="text-white ml-0.5" fill="white" />
              )}
            </button>
            {audioPlaying && (
              <span className="absolute mt-16 text-[10px] font-semibold text-white drop-shadow-md">Preview</span>
            )}
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
        {/* Podcast fan menu — portaled to body */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {showPodcastFan && podcastAnchorRect && (() => {
              const hasPreview = !!p.audioUrl;
              const items: { key: string; icon: React.ReactNode; color: string; onClick: (e: React.MouseEvent) => void }[] = [];
              if (hasPreview) {
                items.push({
                  key: 'preview',
                  icon: audioPlaying ? <span className="text-white text-xs font-bold">■</span> : <Headphones size={18} className="text-white" />,
                  color: '#8B5CF6',
                  onClick: handleTogglePreview,
                });
              }
              items.push({
                key: 'apple',
                icon: <ApplePodcastsIcon />,
                color: '#9933CC',
                onClick: (e: React.MouseEvent) => { e.stopPropagation(); openSystemBrowser(p.url); setShowPodcastFan(false); },
              });
              const count = items.length;
              const radius = 70;
              const startAngle = Math.PI;
              const endAngle = 2 * Math.PI;
              const angleStep = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;
              const getPos = (i: number) => {
                const angle = count > 1 ? startAngle + angleStep * i : 1.5 * Math.PI;
                return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
              };
              const cx = podcastAnchorRect.left + podcastAnchorRect.width / 2;
              const cy = podcastAnchorRect.top + podcastAnchorRect.height / 2;
              return (
                <>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9998]"
                    onClick={(e) => { e.stopPropagation(); setShowPodcastFan(false); }}
                  />
                  {items.map((item, i) => {
                    const pos = getPos(i);
                    return (
                      <motion.button
                        key={item.key}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, delay: i * 0.02 }}
                        onClick={item.onClick}
                        className="fixed z-[9999] w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                        style={{ left: cx + pos.x - 22, top: cy + pos.y - 22, background: item.color, boxShadow: '0 3px 12px rgba(0,0,0,0.3)' }}
                      >
                        {item.icon}
                      </motion.button>
                    );
                  })}
                </>
              );
            })()}
          </AnimatePresence>,
          document.body
        )}
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
            {/* Play overlay — fan menu */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: showAlbumFan ? 10000 : 30 }}>
              <button
                ref={albumPlayRef}
                onClick={(e) => {
                  e.stopPropagation();
                  if (showAlbumFan) {
                    setShowAlbumFan(false);
                    setAlbumAnchorRect(null);
                  } else {
                    const rect = albumPlayRef.current?.getBoundingClientRect();
                    if (rect) setAlbumAnchorRect(rect);
                    setShowAlbumFan(true);
                  }
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all"
                style={{
                  background: showAlbumFan ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(9.4px)',
                  WebkitBackdropFilter: 'blur(9.4px)',
                  border: showAlbumFan ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                }}
              >
                {showAlbumFan ? (
                  <X size={18} className="text-white" />
                ) : (
                  <Play size={20} className="text-white ml-0.5" fill="white" />
                )}
              </button>
            </div>
            <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          </div>
          <div className="px-2.5 py-2">
            <p className="text-[12px] font-bold text-slate-900 line-clamp-2 leading-tight">{w.title}</p>
            <p className="text-[10px] text-slate-500">{w.director}{w.release_year ? ` (${w.release_year})` : ''}</p>
          </div>
          {/* Album fan menu — uses MusicModal */}
          {w.music_links && (
            <MusicModal
              musicLinks={showAlbumFan ? w.music_links : null}
              albumTitle={w.title}
              albumArtist={w.director}
              onClose={() => { setShowAlbumFan(false); setAlbumAnchorRect(null); }}
              anchorRef={albumPlayRef}
            />
          )}
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
                backgroundImage: `url('${getAssetPath('/paper-texture.jpg')}')`,
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
