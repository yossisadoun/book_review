// Book type conversion utilities

import { Book, BookWithRatings } from '../types/book';

export function convertBookToApp(book: Book): BookWithRatings {
  return {
    ...book,
    ratings: {
      writing: book.rating_writing ?? null,
      insights: book.rating_insights ?? null,
      flow: book.rating_flow ?? null,
      world: book.rating_world ?? null,
      characters: book.rating_characters ?? null,
    },
    author_facts: book.author_facts || undefined,
    podcast_episodes: book.podcast_episodes || undefined,
    podcast_episodes_grok: book.podcast_episodes_grok || undefined,
    podcast_episodes_apple: book.podcast_episodes_apple || undefined,
    podcast_episodes_curated: book.podcast_episodes_curated || undefined,
  };
}

export function convertBookToDb(book: BookWithRatings): Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  return {
    title: book.title,
    author: book.author,
    canonical_book_id: book.canonical_book_id,
    publish_year: book.publish_year,
    first_issue_year: book.first_issue_year,
    genre: book.genre,
    isbn: book.isbn,
    cover_url: book.cover_url,
    wikipedia_url: book.wikipedia_url,
    google_books_url: book.google_books_url,
    summary: book.summary,
    rating_writing: book.ratings.writing,
    rating_insights: book.ratings.insights,
    rating_flow: book.ratings.flow,
    rating_world: book.ratings.world,
    rating_characters: book.ratings.characters,
    reading_status: book.reading_status,
    author_facts: book.author_facts || null,
    podcast_episodes: book.podcast_episodes || null,
    podcast_episodes_grok: book.podcast_episodes_grok || null,
    podcast_episodes_apple: book.podcast_episodes_apple || null,
    podcast_episodes_curated: book.podcast_episodes_curated || null,
    notes: book.notes || null,
  };
}

export function calculateAvg(ratings: BookWithRatings['ratings']): string | null {
  const values = Object.values(ratings).filter((v) => v != null) as number[];
  if (values.length === 0) return null;
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}
