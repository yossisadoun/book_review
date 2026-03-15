'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { isNativePlatform } from '@/lib/capacitor';
import {
  sendCharacterChatMessage,
  generateCharacterGreeting,
  loadCharacterChatHistory,
  saveCharacterChatMessages,
  type ChatMessage,
  type CharacterChatContext,
} from '../services/chat-service';

interface CharacterChatProps {
  characterContext: CharacterChatContext;
  onBack: () => void;
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CharacterChat({ characterContext, onBack }: CharacterChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Streaming state
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const streamingRef = useRef<{ timer: ReturnType<typeof setTimeout> | null }>({ timer: null });

  const { characterName, bookTitle, bookAuthor, avatarUrl } = characterContext;

  const starterPrompts = [
    `What's on your mind, ${characterName.split(' ')[0]}?`,
    'Tell me about yourself',
    'What do you think about what happened?',
  ];

  useEffect(() => {
    return () => {
      if (streamingRef.current.timer) clearTimeout(streamingRef.current.timer);
    };
  }, []);

  // Load history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingHistory(true);
      const history = await loadCharacterChatHistory(bookTitle, bookAuthor, characterName);
      if (cancelled) return;
      setMessages(history);
      setIsLoadingHistory(false);

      // Generate greeting if no history
      if (history.length === 0) {
        try {
          const greeting = await generateCharacterGreeting(characterContext);
          if (cancelled || !greeting) return;
          const greetingMsg: ChatMessage = { role: 'assistant', content: greeting, created_at: new Date().toISOString() };
          setMessages([greetingMsg]);
          await saveCharacterChatMessages(bookTitle, bookAuthor, characterName, [greetingMsg]);
        } catch (err) {
          console.error('[CharacterChat] Greeting error:', err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [characterName, bookTitle, bookAuthor]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Keyboard height tracking for native
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
      } catch {}
    })();
    return () => {
      willShowListener?.remove?.();
      willHideListener?.remove?.();
    };
  }, []);

  const fakeStream = (text: string, onDone: () => void) => {
    const words = text.split(' ');
    let idx = 0;
    setStreamingText('');
    const tick = () => {
      if (idx < words.length) {
        setStreamingText(prev => (prev || '') + (idx > 0 ? ' ' : '') + words[idx]);
        idx++;
        streamingRef.current.timer = setTimeout(tick, 30 + Math.random() * 50);
      } else {
        setStreamingText(null);
        onDone();
      }
    };
    tick();
  };

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const allMessages = [...messages, userMsg];
      // Keep last 20 messages for context window
      const contextMessages = allMessages.slice(-20);
      const response = await sendCharacterChatMessage(contextMessages, characterContext);

      const assistantMsg: ChatMessage = { role: 'assistant', content: response, created_at: new Date().toISOString() };

      fakeStream(response, () => {
        setMessages(prev => [...prev, assistantMsg]);
        saveCharacterChatMessages(bookTitle, bookAuthor, characterName, [userMsg, assistantMsg]);
      });
    } catch (err) {
      console.error('[CharacterChat] Send error:', err);
      const errorMsg: ChatMessage = { role: 'assistant', content: "Sorry, I couldn't respond. Try again.", created_at: new Date().toISOString() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const bottomPadding = isNativePlatform ? Math.max(keyboardHeight, 0) : 0;

  return (
    <div className="flex flex-col h-full" style={{ paddingBottom: bottomPadding ? `${bottomPadding}px` : undefined }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{
          background: 'rgba(255, 255, 255, 0.3)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <button onClick={onBack} className="p-1 active:scale-90 transition-transform">
          <X size={20} className="text-slate-600" />
        </button>
        {avatarUrl && (
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0" style={{ border: '2px solid rgba(255, 255, 255, 0.5)' }}>
            <img src={avatarUrl} alt={characterName} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{characterName}</p>
          <p className="text-[11px] text-slate-500 truncate">from {bookTitle}</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ paddingBottom: '20px' }}
      >
        {isLoadingHistory ? (
          <div className="flex justify-center py-8">
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-sm text-slate-400"
            >
              Loading...
            </motion.div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {msg.role === 'assistant' && avatarUrl && (
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mb-1" style={{ border: '1.5px solid rgba(255,255,255,0.4)' }}>
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl ${msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'}`}
                    style={msg.role === 'user' ? {
                      background: 'rgba(59, 130, 246, 0.85)',
                      color: 'white',
                    } : {
                      background: 'rgba(255, 255, 255, 0.5)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    <p className={`text-[13px] leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                      {msg.content}
                    </p>
                    {msg.created_at && (
                      <p className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Streaming text */}
            {streamingText !== null && (
              <div className="flex justify-start">
                <div className="flex items-end gap-2 max-w-[85%]">
                  {avatarUrl && (
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mb-1" style={{ border: '1.5px solid rgba(255,255,255,0.4)' }}>
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div
                    className="px-3.5 py-2.5 rounded-2xl rounded-bl-md"
                    style={{
                      background: 'rgba(255, 255, 255, 0.5)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    <p className="text-[13px] leading-relaxed text-slate-700">{streamingText}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading dots */}
            {isLoading && streamingText === null && (
              <div className="flex justify-start">
                <div className="flex items-end gap-2">
                  {avatarUrl && (
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mb-1" style={{ border: '1.5px solid rgba(255,255,255,0.4)' }}>
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div
                    className="px-4 py-3 rounded-2xl rounded-bl-md flex gap-1"
                    style={{
                      background: 'rgba(255, 255, 255, 0.5)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        className="w-2 h-2 rounded-full bg-slate-400"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Starter prompts */}
      {messages.length <= 1 && !isLoading && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {starterPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="px-3 py-1.5 rounded-full text-[12px] text-slate-600 active:scale-95 transition-transform"
              style={{
                background: 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        className="flex items-end gap-2 px-4 py-3 flex-shrink-0"
        style={{
          background: 'rgba(255, 255, 255, 0.3)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Message ${characterName.split(' ')[0]}...`}
          rows={1}
          className="flex-1 bg-transparent text-slate-700 placeholder-slate-400 text-[14px] resize-none outline-none py-2 max-h-[100px]"
          style={{ fontSize: '16px' }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="p-2.5 rounded-full active:scale-90 transition-all disabled:opacity-30"
          style={{
            background: input.trim() ? 'rgba(59, 130, 246, 0.85)' : 'rgba(148, 163, 184, 0.3)',
          }}
        >
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}
