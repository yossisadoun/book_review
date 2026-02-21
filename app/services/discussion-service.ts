import { supabase } from '@/lib/supabase';
import type { DiscussionQuestion } from '../types';
import { fetchWithRetry, grokApiKey, logGrokUsage } from './api-utils';
import { loadPrompts, formatPrompt } from '@/lib/prompts';

async function getGrokDiscussionQuestions(bookTitle: string, author: string): Promise<DiscussionQuestion[]> {
  console.log('[getGrokDiscussionQuestions] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokDiscussionQuestions] API key is missing!');
    return [];
  }

  console.log('[getGrokDiscussionQuestions] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';

  // Load prompt from yaml
  const prompts = await loadPrompts();
  const prompt = formatPrompt(prompts.discussion_questions.prompt, {
    book_title: bookTitle,
    author_name: author
  });

  const payload = {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.7
  };

  console.log('[getGrokDiscussionQuestions] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);

    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokDiscussionQuestions', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '[]';
    // Try to extract JSON array from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    console.log('[getGrokDiscussionQuestions] ✅ Parsed', result.length, 'discussion questions');
    return result || [];
  } catch (err: any) {
    console.error('[getGrokDiscussionQuestions] Error:', err);
    return [];
  }
}

export async function getDiscussionQuestions(bookTitle: string, author: string, canonicalBookId: string): Promise<DiscussionQuestion[]> {
  console.log(`[getDiscussionQuestions] 🔄 Fetching discussion questions for "${bookTitle}" by ${author}`);

  // Check database cache first using canonical_book_id
  try {
    const { data: cachedData, error: cacheError } = await supabase
      .from('discussion_questions_cache')
      .select('questions')
      .eq('canonical_book_id', canonicalBookId)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.questions && Array.isArray(cachedData.questions)) {
      if (cachedData.questions.length > 0) {
        console.log(`[getDiscussionQuestions] ✅ Found ${cachedData.questions.length} cached questions in database`);
        return cachedData.questions as DiscussionQuestion[];
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getDiscussionQuestions] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getDiscussionQuestions] ⚠️ Error checking cache:', err);
  }

  // Fetch from Grok API
  const questions = await getGrokDiscussionQuestions(bookTitle, author);

  // Save to cache if we got questions
  if (questions.length > 0) {
    await saveDiscussionQuestionsToCache(bookTitle, author, canonicalBookId, questions);
  }

  return questions;
}

async function saveDiscussionQuestionsToCache(
  bookTitle: string,
  bookAuthor: string,
  canonicalBookId: string,
  questions: DiscussionQuestion[]
): Promise<void> {
  try {
    const recordData = {
      canonical_book_id: canonicalBookId,
      book_title: bookTitle,
      book_author: bookAuthor,
      questions: questions,
      updated_at: new Date().toISOString(),
    };

    // Upsert based on canonical_book_id
    const { error } = await supabase
      .from('discussion_questions_cache')
      .upsert(recordData, { onConflict: 'canonical_book_id' });

    if (error) {
      console.error('[saveDiscussionQuestionsToCache] ❌ Error saving questions:', error);
    } else {
      console.log(`[saveDiscussionQuestionsToCache] ✅ Saved ${questions.length} questions to cache`);
    }
  } catch (err: any) {
    console.error('[saveDiscussionQuestionsToCache] ❌ Error:', err);
  }
}
