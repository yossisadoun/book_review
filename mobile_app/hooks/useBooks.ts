// Hook for managing books

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchBooks, BookWithRatings } from '@book-review/core';

export function useBooks() {
  const { user } = useAuth();
  const [books, setBooks] = useState<BookWithRatings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setBooks([]);
      setLoading(false);
      return;
    }

    async function loadBooks() {
      try {
        setLoading(true);
        if (!user) return; // Double check user is still available
        const userBooks = await fetchBooks(supabase, user.id);
        setBooks(userBooks);
        setError(null);
      } catch (err) {
        console.error('Error loading books:', err);
        setError(err instanceof Error ? err : new Error('Failed to load books'));
      } finally {
        setLoading(false);
      }
    }

    loadBooks();
  }, [user]);

  return { books, loading, error, refetch: () => {
    if (user) {
      fetchBooks(supabase, user.id).then(setBooks).catch(console.error);
    }
  } };
}
