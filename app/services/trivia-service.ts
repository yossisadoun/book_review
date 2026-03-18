import { supabase } from '@/lib/supabase';
import type { BookWithRatings, TriviaNote } from '../types';
import { fetchWithRetry, grokApiKey, logGrokUsage, isCacheStale } from './api-utils';
import { loadPrompts, formatPrompt } from '@/lib/prompts';

// Collect random trivia notes from books
export function collectTriviaNotes(books: BookWithRatings[]): TriviaNote[] {
  console.log('[collectTriviaNotes] Collecting trivia notes from books...');

  // Filter books that are completed reading and have author_facts
  const booksWithFacts = books.filter(book =>
    book.reading_status === 'read_it' &&
    book.author_facts &&
    Array.isArray(book.author_facts) &&
    book.author_facts.length > 0
  );

  if (booksWithFacts.length < 10) {
    console.warn('[collectTriviaNotes] ⚠️ Need at least 10 books with facts, found:', booksWithFacts.length);
    return [];
  }

  // Shuffle and take at least 10 different books
  const shuffled = [...booksWithFacts].sort(() => Math.random() - 0.5);
  const selectedBooks = shuffled.slice(0, Math.max(10, Math.min(20, shuffled.length)));

  // Collect 20 trivia notes total, ensuring at least one from each selected book
  const triviaNotes: TriviaNote[] = [];
  const notesPerBook = Math.floor(20 / selectedBooks.length);
  const remainder = 20 % selectedBooks.length;

  for (let i = 0; i < selectedBooks.length; i++) {
    const book = selectedBooks[i];
    const facts = book.author_facts || [];
    const count = notesPerBook + (i < remainder ? 1 : 0);

    // Shuffle facts and take random ones
    const shuffledFacts = [...facts].sort(() => Math.random() - 0.5);
    const selectedFacts = shuffledFacts.slice(0, Math.min(count, shuffledFacts.length));

    for (const fact of selectedFacts) {
      triviaNotes.push({
        fact,
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author
      });
    }
  }

  // Shuffle all collected notes
  const finalNotes = triviaNotes.sort(() => Math.random() - 0.5).slice(0, 20);

  console.log(`[collectTriviaNotes] ✅ Collected ${finalNotes.length} trivia notes from ${selectedBooks.length} books`);
  return finalNotes;
}

// Generate trivia questions from trivia notes using Grok
// Generate trivia questions for a single book (facts are optional - Grok will use web search)
export async function generateTriviaQuestionsForBook(bookTitle: string, bookAuthor: string, facts?: string[]): Promise<Array<{
  question: string;
  correct_answer: string;
  wrong_answers: string[];
  source: string;
  source_detail?: string;
  url?: string;
}>> {
  console.log(`[generateTriviaQuestionsForBook] Generating trivia questions for "${bookTitle}" by ${bookAuthor}...`);

  if (!grokApiKey) {
    console.warn('[generateTriviaQuestionsForBook] API key is missing!');
    return [];
  }

  // Format facts as JSON array (empty if none provided)
  const factsJson = (facts && facts.length > 0) ? facts.map(fact => ({ author_facts: [fact] })) : [];

  // Load prompt from prompts.yaml
  const prompts = await loadPrompts();
  if (!prompts.trivia_questions || !prompts.trivia_questions.prompt) {
    console.error('[generateTriviaQuestionsForBook] ❌ trivia_questions prompt not found in prompts config');
    return [];
  }

  // Format the prompt with book title, author, and facts JSON
  const prompt = formatPrompt(prompts.trivia_questions.prompt, {
    book_title: bookTitle,
    author_name: bookAuthor,
    FACTS_JSON: JSON.stringify(factsJson, null, 2)
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';
  const payload = {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.8
  };

  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    });

    // Log usage
    if (data.usage) {
      logGrokUsage('generateTriviaQuestionsForBook', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{}';
    // Extract JSON from markdown if needed
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);

    const questions = parsed.questions || [];

    console.log(`[generateTriviaQuestionsForBook] ✅ Generated ${questions.length} trivia questions`);
    return questions;
  } catch (err: any) {
    console.error('[generateTriviaQuestionsForBook] ❌ Error:', err);
    return [];
  }
}

// Global ref to store refresh callback (set by component)
let triviaQuestionsCountRefreshCallback: (() => void) | null = null;

export function setTriviaQuestionsCountRefreshCallback(callback: (() => void) | null) {
  triviaQuestionsCountRefreshCallback = callback;
}

// Save trivia questions to cache table
export async function saveTriviaQuestionsToCache(bookTitle: string, bookAuthor: string, questions: Array<{
  question: string;
  correct_answer: string;
  wrong_answers: string[];
  source: string;
  source_detail?: string;
  url?: string;
}>): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();

    if (questions.length === 0) {
      console.warn('[saveTriviaQuestionsToCache] No questions to save');
      return;
    }

    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      questions: questions,
      updated_at: new Date().toISOString(),
    };

    // Upsert based on book_title + book_author (consistent with all other caches)
    const result = await supabase
      .from('trivia_questions_cache')
      .upsert(recordData, { onConflict: 'book_title,book_author' });

    if (result.error) {
      console.error('[saveTriviaQuestionsToCache] ❌ Error saving trivia questions:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
      });

      // Check if table doesn't exist
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        console.error('[saveTriviaQuestionsToCache] ⚠️ Table "trivia_questions_cache" does not exist. Please run the migration in Supabase SQL Editor.');
      }
    } else {
      console.log(`[saveTriviaQuestionsToCache] ✅ Saved ${questions.length} trivia questions to cache`);
      // Trigger refresh callback if available
      if (triviaQuestionsCountRefreshCallback) {
        triviaQuestionsCountRefreshCallback();
      }
    }
  } catch (err: any) {
    console.error('[saveTriviaQuestionsToCache] ❌ Error:', err);
  }
}

// Check if a book has trivia questions cached, if not generate them (fire-and-forget)
export async function ensureTriviaQuestionsForBook(bookTitle: string, bookAuthor: string): Promise<void> {
  const normalizedTitle = bookTitle.toLowerCase().trim();
  const normalizedAuthor = bookAuthor.toLowerCase().trim();

  try {
    const { data: existing } = await supabase
      .from('trivia_questions_cache')
      .select('id, updated_at')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (existing && !isCacheStale(existing.updated_at)) {
      console.log(`[ensureTriviaQuestionsForBook] ✅ Trivia already cached for "${bookTitle}"`);
      return;
    }

    console.log(`[ensureTriviaQuestionsForBook] 🎲 No trivia cached for "${bookTitle}", generating...`);
    const questions = await generateTriviaQuestionsForBook(bookTitle, bookAuthor);
    if (questions.length > 0) {
      await saveTriviaQuestionsToCache(bookTitle, bookAuthor, questions);
    }
  } catch (err: any) {
    console.error('[ensureTriviaQuestionsForBook] ❌ Error:', err);
  }
}

// Count books with trivia questions in cache (only from user's "read" books)
export async function countBooksWithTriviaQuestions(readBooks: Array<{ title: string; author: string }>): Promise<number> {
  try {
    if (readBooks.length === 0) return 0;

    const { data, error } = await supabase
      .from('trivia_questions_cache')
      .select('book_title, book_author');

    if (error) {
      console.error('[countBooksWithTriviaQuestions] ❌ Error counting books:', error);
      return 0;
    }

    if (!data) return 0;

    // Match cache entries against user's read books
    const readSet = new Set(readBooks.map(b => `${b.title.toLowerCase().trim()}|||${b.author.toLowerCase().trim()}`));
    const matchCount = data.filter(row => readSet.has(`${row.book_title}|||${row.book_author}`)).length;
    return matchCount;
  } catch (err: any) {
    console.error('[countBooksWithTriviaQuestions] ❌ Error:', err);
    return 0;
  }
}

// Load random trivia questions from cache (11 questions, only from user's "read" books)
export async function loadRandomTriviaQuestions(readBooks: Array<{ title: string; author: string }>): Promise<Array<{
  question: string;
  correct_answer: string;
  wrong_answers: string[];
  book_title?: string;
  book_author?: string;
}>> {
  console.log('[loadRandomTriviaQuestions] Loading random trivia questions from cache (read books only)...');

  try {
    if (readBooks.length === 0) {
      console.warn('[loadRandomTriviaQuestions] ⚠️ No read books provided');
      return [];
    }

    // Get all trivia questions from cache
    const { data: allQuestions, error } = await supabase
      .from('trivia_questions_cache')
      .select('questions, book_title, book_author');

    if (error) {
      console.error('[loadRandomTriviaQuestions] ❌ Error loading questions:', error);
      return [];
    }

    if (!allQuestions || allQuestions.length === 0) {
      console.warn('[loadRandomTriviaQuestions] ⚠️ No trivia questions found in cache');
      return [];
    }

    // Filter to only the user's read books
    const readSet = new Set(readBooks.map(b => `${b.title.toLowerCase().trim()}|||${b.author.toLowerCase().trim()}`));
    const matchedQuestions = allQuestions.filter(row => readSet.has(`${row.book_title}|||${row.book_author}`));

    if (matchedQuestions.length === 0) {
      console.warn('[loadRandomTriviaQuestions] ⚠️ No trivia questions found for read books');
      return [];
    }

    // Flatten all questions from matched books
    const allQuestionsFlat: Array<{
      question: string;
      correct_answer: string;
      wrong_answers: string[];
      book_title?: string;
      book_author?: string;
    }> = [];

    for (const record of matchedQuestions) {
      if (record.questions && Array.isArray(record.questions)) {
        for (const q of record.questions) {
          allQuestionsFlat.push({
            question: q.question,
            correct_answer: q.correct_answer,
            wrong_answers: q.wrong_answers || [],
            book_title: record.book_title,
            book_author: record.book_author,
          });
        }
      }
    }

    if (allQuestionsFlat.length === 0) {
      console.warn('[loadRandomTriviaQuestions] ⚠️ No questions found after flattening');
      return [];
    }

    // Shuffle and take 11 random questions
    const shuffled = [...allQuestionsFlat].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(11, shuffled.length));

    console.log(`[loadRandomTriviaQuestions] ✅ Loaded ${selected.length} random trivia questions from ${matchedQuestions.length} read books`);
    return selected;
  } catch (err: any) {
    console.error('[loadRandomTriviaQuestions] ❌ Error:', err);
    return [];
  }
}

// Legacy function for backward compatibility (used by old trivia game flow)
export async function generateTriviaQuestions(triviaNotes: TriviaNote[]): Promise<Array<{
  question: string;
  correct_answer: string;
  wrong_answers: string[];
}>> {
  console.log('[generateTriviaQuestions] Generating trivia questions via Grok...');

  if (!grokApiKey) {
    console.warn('[generateTriviaQuestions] API key is missing!');
    return [];
  }

  // Compile trivia notes into JSON format for the prompt
  const factsJson = triviaNotes.map((note, idx) => ({
    author_facts: [note.fact]
  }));

  // Load prompt from prompts.yaml
  const prompts = await loadPrompts();
  if (!prompts.trivia_questions || !prompts.trivia_questions.prompt) {
    console.error('[generateTriviaQuestions] ❌ trivia_questions prompt not found in prompts config');
    return [];
  }

  // Format the prompt with the facts JSON
  const prompt = formatPrompt(prompts.trivia_questions.prompt, {
    FACTS_JSON: JSON.stringify(factsJson, null, 2)
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';
  const payload = {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.8
  };

  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    });

    // Log usage
    if (data.usage) {
      logGrokUsage('generateTriviaQuestions', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{}';
    // Extract JSON from markdown if needed
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);

    const questions = parsed.questions || [];

    // Shuffle questions
    const shuffledQuestions = questions.sort(() => Math.random() - 0.5);

    console.log(`[generateTriviaQuestions] ✅ Generated ${shuffledQuestions.length} trivia questions`);
    return shuffledQuestions;
  } catch (err: any) {
    console.error('[generateTriviaQuestions] ❌ Error:', err);
    return [];
  }
}
