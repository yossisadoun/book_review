"use strict";
// Supabase database queries
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchBooks = fetchBooks;
exports.insertBook = insertBook;
exports.updateRating = updateRating;
exports.updateReadingStatus = updateReadingStatus;
exports.updateNotes = updateNotes;
exports.deleteBook = deleteBook;
exports.updateAuthorFacts = updateAuthorFacts;
exports.updatePodcastEpisodes = updatePodcastEpisodes;
exports.fetchRelatedBooks = fetchRelatedBooks;
exports.saveRelatedBooks = saveRelatedBooks;
const book_converter_1 = require("../utils/book-converter");
const book_id_1 = require("../utils/book-id");
async function fetchBooks(client, userId) {
    const { data, error } = await client
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Supabase error loading books:', error);
        throw error;
    }
    return (data || []).map(book_converter_1.convertBookToApp);
}
async function insertBook(client, userId, bookData) {
    // Generate canonical book ID
    const canonical_book_id = (0, book_id_1.generateCanonicalBookId)(bookData.title, bookData.author || '');
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
    const fullBookData = {
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
    return (0, book_converter_1.convertBookToApp)(data);
}
async function updateRating(client, bookId, dimension, value) {
    const ratingField = `rating_${dimension}`;
    const { error } = await client
        .from('books')
        .update({ [ratingField]: value, updated_at: new Date().toISOString() })
        .eq('id', bookId);
    if (error) {
        console.error('Supabase error updating rating:', error);
        throw error;
    }
}
async function updateReadingStatus(client, bookId, status) {
    const { error } = await client
        .from('books')
        .update({ reading_status: status, updated_at: new Date().toISOString() })
        .eq('id', bookId);
    if (error) {
        console.error('Supabase error updating reading status:', error);
        throw error;
    }
}
async function updateNotes(client, bookId, notes) {
    const { error } = await client
        .from('books')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', bookId);
    if (error) {
        console.error('Supabase error updating notes:', error);
        throw error;
    }
}
async function deleteBook(client, bookId) {
    const { error } = await client.from('books').delete().eq('id', bookId);
    if (error) {
        console.error('Supabase error deleting book:', error);
        throw error;
    }
}
async function updateAuthorFacts(client, bookId, facts, firstIssueYear) {
    const updateData = {
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
async function updatePodcastEpisodes(client, bookId, source, episodes) {
    const updateField = source === 'curated'
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
async function fetchRelatedBooks(client, bookTitle, bookAuthor) {
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
        return data.related_books;
    }
    return null;
}
async function saveRelatedBooks(client, bookTitle, bookAuthor, relatedBooks) {
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
    }
    else {
        const { error } = await client.from('related_books').insert(recordData);
        if (error) {
            console.error('Error inserting related books cache:', error);
            throw error;
        }
    }
}
