// Supabase database queries

import { SupabaseClient } from '@supabase/supabase-js';
import { Book, BookWithRatings, BookInput, ReadingStatus, PodcastEpisode, RelatedBook } from '../types/book';
import { convertBookToApp, convertBookToDb } from '../utils/book-converter';
import { generateCanonicalBookId } from '../utils/book-id';

export async function fetchBooks(client: SupabaseClient, userId: string): Promise<BookWithRatings[]> {
  const { data, error } = await client
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error loading books:', error);
    throw error;
  }

  return (data || []).map(convertBookToApp);
}

export async function insertBook(
  client: SupabaseClient,
  userId: string,
  bookData: Omit<BookInput, 'user_id' | 'canonical_book_id'>
): Promise<BookWithRatings> {
  // Generate canonical book ID
  const canonical_book_id = generateCanonicalBookId(bookData.title, bookData.author || '');

  // Check for existing book with same canonical ID
  const { data: existing } = await client
    .from('books')
    .select('id')
    .eq('user_id', userId)
    .eq('canonical_book_id', canonical_book_id)
    .maybeSingle();

  if (existing) {
    throw new Error('Book already exists in your library');
  }

  const fullBookData: BookInput & { user_id: string } = {
    ...bookData,
    user_id: userId,
    canonical_book_id,
  };

  const { data, error } = await client
    .from('books')
    .insert(fullBookData)
    .select()
    .single();

  if (error) {
    console.error('Supabase error inserting book:', error);
    throw error;
  }

  return convertBookToApp(data);
}

export async function updateRating(
  client: SupabaseClient,
  bookId: string,
  dimension: string,
  value: number | null
): Promise<void> {
  const ratingField = `rating_${dimension}` as
    | 'rating_writing'
    | 'rating_insights'
    | 'rating_flow'
    | 'rating_world'
    | 'rating_characters';

  const { error } = await client
    .from('books')
    .update({ [ratingField]: value, updated_at: new Date().toISOString() })
    .eq('id', bookId);

  if (error) {
    console.error('Supabase error updating rating:', error);
    throw error;
  }
}

export async function updateReadingStatus(
  client: SupabaseClient,
  bookId: string,
  status: ReadingStatus
): Promise<void> {
  const { error } = await client
    .from('books')
    .update({ reading_status: status, updated_at: new Date().toISOString() })
    .eq('id', bookId);

  if (error) {
    console.error('Supabase error updating reading status:', error);
    throw error;
  }
}

export async function updateNotes(
  client: SupabaseClient,
  bookId: string,
  notes: string
): Promise<void> {
  const { error } = await client
    .from('books')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', bookId);

  if (error) {
    console.error('Supabase error updating notes:', error);
    throw error;
  }
}

export async function deleteBook(client: SupabaseClient, bookId: string): Promise<void> {
  const { error } = await client.from('books').delete().eq('id', bookId);

  if (error) {
    console.error('Supabase error deleting book:', error);
    throw error;
  }
}

export async function updateAuthorFacts(
  client: SupabaseClient,
  bookId: string,
  facts: string[],
  firstIssueYear?: number | null
): Promise<void> {
  const updateData: any = {
    author_facts: facts,
    updated_at: new Date().toISOString(),
  };

  if (firstIssueYear !== undefined) {
    updateData.first_issue_year = firstIssueYear;
  }

  const { error } = await client.from('books').update(updateData).eq('id', bookId);

  if (error) {
    console.error('Supabase error updating author facts:', error);
    throw error;
  }
}

export async function updatePodcastEpisodes(
  client: SupabaseClient,
  bookId: string,
  source: 'grok' | 'apple' | 'curated',
  episodes: PodcastEpisode[]
): Promise<void> {
  const updateField =
    source === 'curated'
      ? 'podcast_episodes_curated'
      : source === 'apple'
      ? 'podcast_episodes_apple'
      : 'podcast_episodes_grok';

  const { error } = await client
    .from('books')
    .update({ [updateField]: episodes, updated_at: new Date().toISOString() })
    .eq('id', bookId);

  if (error) {
    console.error('Supabase error updating podcast episodes:', error);
    throw error;
  }
}

export async function fetchRelatedBooks(
  client: SupabaseClient,
  bookTitle: string,
  bookAuthor: string
): Promise<RelatedBook[] | null> {
  const normalizedTitle = bookTitle.toLowerCase().trim();
  const normalizedAuthor = bookAuthor.toLowerCase().trim();

  const { data, error } = await client
    .from('related_books')
    .select('related_books')
    .eq('book_title', normalizedTitle)
    .eq('book_author', normalizedAuthor)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.warn('Error fetching related books cache:', error);
    return null;
  }

  if (data && data.related_books && Array.isArray(data.related_books)) {
    return data.related_books as RelatedBook[];
  }

  return null;
}

export async function saveRelatedBooks(
  client: SupabaseClient,
  bookTitle: string,
  bookAuthor: string,
  relatedBooks: RelatedBook[]
): Promise<void> {
  const normalizedTitle = bookTitle.toLowerCase().trim();
  const normalizedAuthor = bookAuthor.toLowerCase().trim();

  const { data: existing } = await client
    .from('related_books')
    .select('id')
    .eq('book_title', normalizedTitle)
    .eq('book_author', normalizedAuthor)
    .maybeSingle();

  const recordData = {
    book_title: normalizedTitle,
    book_author: normalizedAuthor,
    related_books: relatedBooks,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await client
      .from('related_books')
      .update(recordData)
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor);

    if (error) {
      console.error('Error updating related books cache:', error);
      throw error;
    }
  } else {
    const { error } = await client.from('related_books').insert(recordData);

    if (error) {
      console.error('Error inserting related books cache:', error);
      throw error;
    }
  }
}
