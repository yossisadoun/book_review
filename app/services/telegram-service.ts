import { supabase } from '@/lib/supabase';
import type { DiscussionQuestion } from '../types';

// Check if a Telegram topic exists for this book
export async function getTelegramTopic(canonicalBookId: string): Promise<{ topicId: number; inviteLink: string } | null> {
  try {
    const { data, error } = await supabase
      .from('telegram_topics')
      .select('telegram_topic_id, invite_link')
      .eq('canonical_book_id', canonicalBookId)
      .maybeSingle();

    if (error) {
      console.error('[getTelegramTopic] Error:', error);
      return null;
    }

    if (data) {
      return {
        topicId: data.telegram_topic_id,
        inviteLink: data.invite_link,
      };
    }

    return null;
  } catch (err) {
    console.error('[getTelegramTopic] Error:', err);
    return null;
  }
}

// Create a new Telegram topic for a book
export async function createTelegramTopic(
  bookTitle: string,
  bookAuthor: string,
  canonicalBookId: string,
  discussionQuestions?: DiscussionQuestion[],
  coverUrl?: string,
  genre?: string
): Promise<{ topicId: number; inviteLink: string } | null> {
  try {
    // Call the Supabase edge function to create the topic
    const { data, error } = await supabase.functions.invoke('create-telegram-topic', {
      body: { bookTitle, bookAuthor, canonicalBookId, discussionQuestions, coverUrl, genre },
    });

    if (error) {
      // Try to extract the actual error body for better debugging
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
      console.error('[createTelegramTopic] Edge Function Error:', error, errorDetail || '');
      return null;
    }

    if (!data?.success) {
      console.error('[createTelegramTopic] API Error:', data?.error);
      return null;
    }

    // Save to Supabase
    const { error: insertError } = await supabase
      .from('telegram_topics')
      .insert({
        canonical_book_id: canonicalBookId,
        book_title: bookTitle,
        book_author: bookAuthor,
        telegram_topic_id: data.topicId,
        invite_link: data.inviteLink,
      });

    if (insertError) {
      console.error('[createTelegramTopic] DB Insert Error:', insertError);
      // Still return the data even if DB save fails
    }

    return {
      topicId: data.topicId,
      inviteLink: data.inviteLink,
    };
  } catch (err) {
    console.error('[createTelegramTopic] Error:', err);
    return null;
  }
}

// Get or create Telegram topic for a book
export async function getOrCreateTelegramTopic(
  bookTitle: string,
  bookAuthor: string,
  canonicalBookId: string,
  coverUrl?: string,
  genre?: string
): Promise<{ topicId: number; inviteLink: string } | null> {
  // First check if topic already exists
  const existing = await getTelegramTopic(canonicalBookId);
  if (existing) {
    return existing;
  }

  // Fetch discussion questions from cache to include in the topic
  let discussionQuestions: DiscussionQuestion[] = [];
  try {
    const { data } = await supabase
      .from('discussion_questions_cache')
      .select('questions')
      .eq('canonical_book_id', canonicalBookId)
      .maybeSingle();

    if (data?.questions) {
      discussionQuestions = data.questions as DiscussionQuestion[];
    }
  } catch (err) {
    console.error('[getOrCreateTelegramTopic] Error fetching questions:', err);
  }

  // Create new topic with discussion questions, cover, and genre
  return await createTelegramTopic(bookTitle, bookAuthor, canonicalBookId, discussionQuestions, coverUrl, genre);
}
