import { supabase } from '@/lib/supabase';
import type { ReadingStatus, MusicLinks } from '../types';

export interface ChatListItem {
  book_id: string;
  book_title: string;
  book_author: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
  cover_url?: string;
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

/** Look up cover URLs for orphaned chats (book deleted but chat remains) from feed_items cache */
export async function lookupOrphanedChatCoverUrls(orphanedChats: ChatListItem[]): Promise<Map<string, string>> {
  const coverMap = new Map<string, string>();
  if (orphanedChats.length === 0) return coverMap;

  // Try feed_items — has source_book_cover_url. Use original titles (stored as-is).
  const titles = [...new Set(orphanedChats.map(c => c.book_title))];
  const { data } = await supabase
    .from('feed_items')
    .select('source_book_title, source_book_cover_url')
    .in('source_book_title', titles)
    .not('source_book_cover_url', 'is', null)
    .limit(100);

  for (const row of data || []) {
    if (row.source_book_cover_url) {
      coverMap.set(row.source_book_title.toLowerCase().trim(), row.source_book_cover_url);
    }
  }
  return coverMap;
}

/** Reassign orphaned book_chats to a newly added book (matching by title+author) */
export async function reassignChatsToBook(newBookId: string, bookTitle: string, bookAuthor: string): Promise<number> {
  const { data, error } = await supabase
    .from('book_chats')
    .update({ book_id: newBookId })
    .ilike('book_title', bookTitle.trim())
    .ilike('book_author', bookAuthor.trim())
    .neq('book_id', newBookId)
    .select('id');

  if (error) {
    console.error('[reassignChatsToBook] Error:', error);
    return 0;
  }
  return data?.length || 0;
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
  podcasts?: Array<{ title: string; podcast_name?: string; url: string; thumbnail?: string; length?: string; audioUrl?: string }>;
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

  const content = data?.content || '';
  if (!content) {
    console.warn('[sendChatMessage] ⚠️ Empty response from edge function. data:', JSON.stringify(data));
  } else {
    console.log('[sendChatMessage] ✅ Response received:', content.length, 'chars');
  }
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
): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const rows = messages.map(m => ({
    user_id: user.id,
    book_id: bookId,
    book_title: bookTitle,
    book_author: bookAuthor,
    role: m.role,
    content: m.content,
  }));

  const { data, error } = await supabase.from('book_chats').insert(rows).select('id');
  if (error) {
    console.error('[saveChatMessages] Error:', error);
    return [];
  }
  return (data || []).map(r => r.id);
}

export async function deleteChatMessage(messageId: string): Promise<boolean> {
  const { error } = await supabase.from('book_chats').delete().eq('id', messageId);
  if (error) {
    console.error('[deleteChatMessage] Error:', error);
    return false;
  }
  return true;
}

// --- Character Chat Functions ---

export interface CharacterChatContext {
  characterName: string;
  bookTitle: string;
  bookAuthor: string;
  context: Record<string, string>; // The structured JSON from Grok
  avatarUrl?: string;
}

export async function sendCharacterChatMessage(
  messages: ChatMessage[],
  characterContext: CharacterChatContext
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('quick-processor', {
    body: {
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      characterContext,
    },
  });

  if (error) {
    console.error('[sendCharacterChatMessage] ❌ Error:', error);
    throw new Error('Failed to send message');
  }

  const content = data?.content || '';
  if (!content) {
    console.warn('[sendCharacterChatMessage] ⚠️ Empty response from edge function. data:', JSON.stringify(data));
  } else {
    console.log('[sendCharacterChatMessage] ✅ Response received:', content.length, 'chars');
  }
  return content;
}

export async function generateCharacterGreeting(
  characterContext: CharacterChatContext,
  lastMessageAt?: string | null
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('quick-processor', {
    body: {
      characterContext,
      mode: 'greeting',
      lastMessageAt,
    },
  });

  if (error) {
    console.error('[generateCharacterGreeting] Error:', error);
    throw new Error('Failed to generate greeting');
  }

  return data?.content || '';
}

export async function loadCharacterChatHistory(
  bookTitle: string,
  bookAuthor: string,
  characterName: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('character_chats')
    .select('id, role, content, created_at')
    .eq('book_title', bookTitle.toLowerCase().trim())
    .eq('book_author', bookAuthor.toLowerCase().trim())
    .eq('character_name', characterName)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[loadCharacterChatHistory] Error:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    created_at: row.created_at,
  }));
}

export async function saveCharacterChatMessages(
  bookTitle: string,
  bookAuthor: string,
  characterName: string,
  messages: ChatMessage[]
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const rows = messages.map(m => ({
    user_id: user.id,
    book_title: bookTitle.toLowerCase().trim(),
    book_author: bookAuthor.toLowerCase().trim(),
    character_name: characterName,
    role: m.role,
    content: m.content,
  }));

  const { error } = await supabase.from('character_chats').insert(rows);
  if (error) {
    console.error('[saveCharacterChatMessages] Error:', error);
  }
}

export interface CharacterChatListItem {
  character_name: string;
  book_title: string;
  book_author: string;
  avatar_url?: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
}

export async function getCharacterChatList(): Promise<CharacterChatListItem[]> {
  const [chatsResult, avatarsResult] = await Promise.all([
    supabase
      .from('character_chats')
      .select('character_name, book_title, book_author, content, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('character_avatars_cache')
      .select('book_title, book_author, avatars'),
  ]);

  if (chatsResult.error) {
    console.error('[getCharacterChatList] Error:', chatsResult.error);
    return [];
  }

  // Build avatar URL lookup: "character::book_title" -> image_url
  const avatarUrlMap = new Map<string, string>();
  for (const row of avatarsResult.data || []) {
    const avatars = row.avatars as Array<{ character: string; image_url: string }> | null;
    if (avatars) {
      for (const a of avatars) {
        avatarUrlMap.set(`${a.character}::${row.book_title}`, a.image_url);
      }
    }
  }

  // Deduplicate by character_name+book_title: keep latest message + count
  const map = new Map<string, CharacterChatListItem>();
  for (const row of chatsResult.data || []) {
    const key = `${row.character_name}::${row.book_title}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        character_name: row.character_name,
        book_title: row.book_title,
        book_author: row.book_author,
        avatar_url: avatarUrlMap.get(key),
        last_message: row.content,
        last_message_at: row.created_at,
        message_count: 1,
      });
    } else {
      existing.message_count++;
    }
  }

  return Array.from(map.values());
}

export async function deleteCharacterChat(characterName: string, bookTitle: string): Promise<void> {
  const { error } = await supabase
    .from('character_chats')
    .delete()
    .eq('character_name', characterName)
    .eq('book_title', bookTitle.toLowerCase().trim());

  if (error) {
    console.error('[deleteCharacterChat] Error:', error);
  }
}

// --- Proactive Message Functions ---

interface ProactiveCandidate {
  chatType: 'book' | 'general';
  chatKey: string;  // book_id or 'general'
  bookContext: BookChatContext;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
}

/** Check which chats qualify for a proactive message */
export async function getProactiveCandidates(
  bookChats: ChatListItem[],
  books: Array<{ id: string; title: string; author: string; reading_status?: string | null }>,
): Promise<{ chatKey: string; chatType: 'book' | 'general'; lastMessageAt: string | null; bookId: string; bookTitle: string; bookAuthor: string }[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Time-of-day guard: only send between 7am-10pm local time
  const hour = new Date().getHours();
  if (hour < 7 || hour >= 22) return [];

  // Load proactive log
  const { data: logs, error: logError } = await supabase
    .from('proactive_message_log')
    .select('chat_key, sent_at, was_replied')
    .eq('user_id', user.id)
    .order('sent_at', { ascending: false });

  if (logError) {
    console.error('[proactive] Log query error:', logError);
    return [];
  }

  const logMap = new Map<string, { sent_at: string; was_replied: boolean }>();
  for (const log of logs || []) {
    if (!logMap.has(log.chat_key)) {
      logMap.set(log.chat_key, { sent_at: log.sent_at, was_replied: log.was_replied });
    }
  }

  // Count proactive messages sent today (global cap)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = (logs || []).filter(l => new Date(l.sent_at) >= todayStart).length;
  if (todayCount >= 3) return [];

  const candidates: { chatKey: string; chatType: 'book' | 'general'; lastMessageAt: string | null; bookId: string; bookTitle: string; bookAuthor: string }[] = [];
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  // Check "currently reading" books — daily cooldown (not weekly)
  const readingBooks = books.filter(b => b.reading_status === 'reading');
  for (const book of readingBooks) {
    const lastLog = logMap.get(book.id);
    // Skip if last proactive was < 1 day ago (daily for reading books)
    if (lastLog && new Date(lastLog.sent_at).getTime() > oneDayAgo) continue;
    // Skip if last proactive wasn't replied to
    if (lastLog && !lastLog.was_replied) continue;

    const chat = bookChats.find(c => c.book_id === book.id);
    candidates.push({
      chatKey: book.id,
      chatType: 'book',
      lastMessageAt: chat?.last_message_at || null,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
    });
  }

  // Check general/bookshelf chat
  const GENERAL_KEY = 'general';
  const BOOKSHELF_ID = '00000000-0000-0000-0000-000000000000';
  const lastGeneralLog = logMap.get(GENERAL_KEY);
  if (
    (!lastGeneralLog || (new Date(lastGeneralLog.sent_at).getTime() <= sevenDaysAgo && lastGeneralLog.was_replied))
    && books.length > 0
  ) {
    const generalChat = bookChats.find(c => c.book_id === BOOKSHELF_ID);
    candidates.push({
      chatKey: GENERAL_KEY,
      chatType: 'general',
      lastMessageAt: generalChat?.last_message_at || null,
      bookId: BOOKSHELF_ID,
      bookTitle: 'My Bookshelf',
      bookAuthor: '',
    });
  }

  return candidates;
}

/** Generate and save a proactive message */
export async function generateProactiveMessage(
  bookContext: BookChatContext,
  chatKey: string,
  bookId: string,
  bookTitle: string,
  bookAuthor: string,
): Promise<ChatMessage | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase.functions.invoke('quick-processor', {
      body: {
        bookContext,
        mode: 'proactive',
      },
    });

    if (error) {
      console.error('[generateProactiveMessage] Error:', error);
      return null;
    }

    const content = data?.content || '';
    if (!content) return null;

    // Backdate by 5-30 minutes to feel like it arrived while away
    const backdateMinutes = 5 + Math.floor(Math.random() * 25);
    const backdatedTime = new Date(Date.now() - backdateMinutes * 60 * 1000).toISOString();

    // Save message to book_chats
    const { error: insertError } = await supabase.from('book_chats').insert({
      user_id: user.id,
      book_id: bookId,
      book_title: bookTitle,
      book_author: bookAuthor,
      role: 'assistant',
      content,
      is_proactive: true,
      created_at: backdatedTime,
    });

    if (insertError) {
      console.error('[generateProactiveMessage] Insert error:', insertError);
      return null;
    }

    // Log the proactive message
    await supabase.from('proactive_message_log').insert({
      user_id: user.id,
      chat_type: bookContext.generalMode ? 'general' : 'book',
      chat_key: chatKey,
    });

    return { role: 'assistant', content, created_at: backdatedTime };
  } catch (err) {
    console.error('[generateProactiveMessage] Error:', err);
    return null;
  }
}

/** Mark that user replied after a proactive message (call when user sends a message) */
export async function markProactiveReplied(chatKey: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('proactive_message_log')
    .update({ was_replied: true })
    .eq('user_id', user.id)
    .eq('chat_key', chatKey)
    .eq('was_replied', false);
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
