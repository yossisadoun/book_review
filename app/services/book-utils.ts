import type { Book, BookWithRatings, PodcastEpisode } from '../types';
import { GRADIENTS } from '../types';

export function convertBookToApp(book: Book): BookWithRatings {
  // Parse author_facts if it's a string (shouldn't happen with JSONB, but be safe)
  let authorFacts: string[] | undefined = undefined;
  if (book.author_facts) {
    if (typeof book.author_facts === 'string') {
      try {
        authorFacts = JSON.parse(book.author_facts);
      } catch (e) {
        console.warn('[convertBookToApp] Failed to parse author_facts as JSON:', e);
        authorFacts = undefined;
      }
    } else if (Array.isArray(book.author_facts)) {
      authorFacts = book.author_facts;
    }
  }

  return {
    ...book,
    ratings: {
      writing: book.rating_writing ?? null,
      insights: book.rating_insights ?? null,
      flow: book.rating_flow ?? null,
      world: book.rating_world ?? null,
      characters: book.rating_characters ?? null,
    },
    reading_status: book.reading_status || null, // Load reading status from database
    author_facts: authorFacts, // Load from database (properly parsed)
    podcast_episodes: book.podcast_episodes || undefined, // Load from database (legacy)
    podcast_episodes_grok: book.podcast_episodes_grok || undefined, // Load from database
    podcast_episodes_apple: book.podcast_episodes_apple || undefined, // Load from database
    podcast_episodes_curated: book.podcast_episodes_curated || undefined, // Load from database
    notes: book.notes || null, // Load notes from database
  };
}

export function convertBookToDb(book: BookWithRatings): Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  return {
    title: book.title,
    author: book.author,
    publish_year: book.publish_year,
    first_issue_year: book.first_issue_year,
    genre: book.genre,
    isbn: book.isbn,
    cover_url: book.cover_url,
    wikipedia_url: book.wikipedia_url,
    google_books_url: book.google_books_url,
    summary: book.summary || null,
    rating_writing: book.ratings.writing,
    rating_insights: book.ratings.insights,
    rating_flow: book.ratings.flow,
    rating_world: book.ratings.world,
    rating_characters: book.ratings.characters,
    reading_status: book.reading_status || null,
  };
}

export function calculateAvg(ratings: BookWithRatings['ratings']): string | null {
  // Use only the 'writing' rating (single rating system)
  if (ratings.writing == null) return null;
  return ratings.writing.toFixed(1);
}

export function calculateScore(ratings: BookWithRatings['ratings']): number {
  // Use only the 'writing' rating (single rating system)
  return ratings.writing ?? 0;
}

export function getGradient(id: string): string {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}
