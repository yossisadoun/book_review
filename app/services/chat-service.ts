import { supabase } from '@/lib/supabase';
import type { ReadingStatus, MusicLinks } from '../types';
import { logGrokUsage } from './api-utils';

export interface ChatListItem {
  book_id: string;
  book_title: string;
  book_author: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
}

export async function getChatList(): Promise<ChatListItem[]> {
  const { data, error } = await supabase
    .from('book_chats')
    .select('book_id, book_title, book_author, content, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getChatList] Error:', error);
    return [];
  }

  // Deduplicate by book_id: keep latest message + count
  const map = new Map<string, ChatListItem>();
  for (const row of data || []) {
    const existing = map.get(row.book_id);
    if (!existing) {
      map.set(row.book_id, {
        book_id: row.book_id,
        book_title: row.book_title,
        book_author: row.book_author,
        last_message: row.content,
        last_message_at: row.created_at,
        message_count: 1,
      });
    } else {
      existing.message_count++;
    }
  }

  // Already ordered by latest first (first occurrence per book_id is latest)
  return Array.from(map.values());
}

export async function deleteChatForBook(bookId: string): Promise<void> {
  const { error } = await supabase
    .from('book_chats')
    .delete()
    .eq('book_id', bookId);

  if (error) {
    console.error('[deleteChatForBook] Error:', error);
  }
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export interface BookChatContext {
  title: string;
  author: string;
  genre?: string | null;
  publishYear?: number | null;
  summary?: string | null;
  readingStatus: ReadingStatus;
  generalMode?: boolean;
  userNotes?: string | null;
  userRatings?: {
    writing: number | null;
    insights: number | null;
    flow: number | null;
    world: number | null;
    characters: number | null;
  };
  insights?: {
    authorFacts?: string[];
    influences?: string[];
    domain?: { label: string; facts: string[] };
    context?: string[];
    didYouKnow?: Array<{ notes: string[] }>;
  };
  podcasts?: Array<{ title: string; podcast_name?: string; url: string; thumbnail?: string; length?: string }>;
  videos?: Array<{ title: string; channelTitle: string; videoId: string }>;
  articles?: Array<{ title: string; url: string; snippet?: string; authors?: string; year?: string }>;
  relatedBooks?: Array<{ title: string; author: string; reason: string; cover_url?: string; thumbnail?: string }>;
  relatedWorks?: Array<{ title: string; director: string; reason: string; type: 'movie' | 'show' | 'album'; poster_url?: string; release_year?: number; wikipedia_url?: string; itunes_url?: string; itunes_artwork?: string; music_links?: MusicLinks }>;
  discussionQuestions?: Array<{ question: string; category: string }>;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  bookContext: BookChatContext
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('quick-processor', {
    body: {
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      bookContext,
    },
  });

  if (error) {
    let errorDetail = '';
    try {
      if (error.context?.body) {
        const reader = error.context.body.getReader?.();
        if (reader) {
          const { value } = await reader.read();
          errorDetail = new TextDecoder().decode(value);
        }
      }
    } catch (_) { /* ignore */ }
    console.error('[sendChatMessage] Error:', error, errorDetail || '');
    throw new Error('Failed to send message');
  }

  logGrokUsage('book_chat', data?.usage);

  const content = data?.content || '';
  console.log('[sendChatMessage] Raw response:', JSON.stringify(content));
  return content;
}

export async function generateGreeting(
  bookContext: BookChatContext,
  lastMessageAt?: string | null
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('quick-processor', {
    body: {
      bookContext,
      mode: 'greeting',
      lastMessageAt,
    },
  });

  if (error) {
    console.error('[generateGreeting] Error:', error);
    throw new Error('Failed to generate greeting');
  }

  logGrokUsage('book_chat_greeting', data?.usage);

  return data?.content || '';
}

export async function loadChatHistory(bookId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('book_chats')
    .select('id, role, content, created_at')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[loadChatHistory] Error:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    created_at: row.created_at,
  }));
}

export async function saveChatMessages(
  bookId: string,
  bookTitle: string,
  bookAuthor: string,
  messages: ChatMessage[]
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const rows = messages.map(m => ({
    user_id: user.id,
    book_id: bookId,
    book_title: bookTitle,
    book_author: bookAuthor,
    role: m.role,
    content: m.content,
  }));

  const { error } = await supabase.from('book_chats').insert(rows);
  if (error) {
    console.error('[saveChatMessages] Error:', error);
  }
}

export function getStarterPrompts(readingStatus: ReadingStatus, generalMode?: boolean): string[] {
  if (generalMode) {
    return [
      'Recommend me what to read next',
      'What patterns do you see in my taste?',
      'Which unread book should I start?',
    ];
  }
  switch (readingStatus) {
    case 'reading':
      return [
        'What should I pay attention to?',
        'Tell me about the author',
        'What makes this book special?',
      ];
    case 'want_to_read':
      return [
        'Should I read this?',
        "What's it about without spoilers?",
        'How does it compare to similar books?',
      ];
    case 'read_it':
      return [
        'What did I miss?',
        'What should I read next?',
        "Let's discuss the ending",
      ];
    default:
      return [
        'Tell me about this book',
        'What makes this book interesting?',
        'Tell me about the author',
      ];
  }
}
