// Add book screen with search

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { insertBook, BookInput } from '@book-review/core';
import { lookupBooksOnWikipedia, lookupBooksOnAppleBooks, lookupBooksOnGrok } from '@book-review/core';
import Constants from 'expo-constants';
import { colors, typography, componentStyles } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface SearchResult {
  title: string;
  author: string;
  publish_year?: number | null;
  genre?: string | null;
  cover_url?: string | null;
  wikipedia_url?: string | null;
  google_books_url?: string | null;
  summary?: string | null;
  isbn?: string | null;
}

export default function AddBookScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchSource, setSearchSource] = useState<'wikipedia' | 'apple' | 'grok'>('wikipedia');

  const grokApiKey = Constants.expoConfig?.extra?.grokApiKey || process.env.EXPO_PUBLIC_GROK_API_KEY || '';

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      let searchResults: SearchResult[] = [];

      if (searchSource === 'wikipedia') {
        searchResults = await lookupBooksOnWikipedia(searchQuery);
      } else if (searchSource === 'apple') {
        searchResults = await lookupBooksOnAppleBooks(searchQuery);
      } else if (searchSource === 'grok' && grokApiKey) {
        searchResults = await lookupBooksOnGrok(searchQuery, grokApiKey);
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Failed to search for books. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchSource, grokApiKey]);

  const handleAddBook = async (book: SearchResult) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to add books');
      return;
    }

    try {
      const bookData: Omit<BookInput, 'user_id' | 'canonical_book_id'> = {
        title: book.title,
        author: book.author || 'Unknown Author',
        publish_year: book.publish_year || null,
        genre: book.genre || null,
        cover_url: book.cover_url || null,
        wikipedia_url: book.wikipedia_url || null,
        google_books_url: book.google_books_url || null,
        summary: book.summary || null,
        isbn: book.isbn || null,
        rating_writing: null,
        rating_insights: null,
        rating_flow: null,
        rating_world: null,
        rating_characters: null,
        reading_status: null,
        notes: null,
        author_facts: null,
        podcast_episodes: null,
        podcast_episodes_grok: null,
        podcast_episodes_apple: null,
        podcast_episodes_curated: null,
      };

      await insertBook(supabase, user.id, bookData);
      Alert.alert('Success', 'Book added!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error: any) {
      console.error('Error adding book:', error);
      Alert.alert('Error', error.message || 'Failed to add book. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.slate[50], colors.white]}
        style={styles.gradientBackground}
      >
        <BlurView intensity={20} tint="light" style={styles.headerBlur}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Book</Text>
          </View>
        </BlurView>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a book..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => handleSearch(query)}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => handleSearch(query)}
          disabled={loading || !query.trim()}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sourceSelector}>
        <TouchableOpacity
          style={[styles.sourceButton, searchSource === 'wikipedia' && styles.sourceButtonActive]}
          onPress={() => setSearchSource('wikipedia')}
        >
          <Text style={[styles.sourceButtonText, searchSource === 'wikipedia' && styles.sourceButtonTextActive]}>
            Wikipedia
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sourceButton, searchSource === 'apple' && styles.sourceButtonActive]}
          onPress={() => setSearchSource('apple')}
        >
          <Text style={[styles.sourceButtonText, searchSource === 'apple' && styles.sourceButtonTextActive]}>
            Apple Books
          </Text>
        </TouchableOpacity>
        {grokApiKey && (
          <TouchableOpacity
            style={[styles.sourceButton, searchSource === 'grok' && styles.sourceButtonActive]}
            onPress={() => setSearchSource('grok')}
          >
            <Text style={[styles.sourceButtonText, searchSource === 'grok' && styles.sourceButtonTextActive]}>
              Grok AI
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.title}-${item.author}-${index}`}
          renderItem={({ item }) => (
            <BlurView intensity={20} tint="light" style={styles.resultCard}>
              <TouchableOpacity
                style={styles.resultCardContent}
                onPress={() => handleAddBook(item)}
                activeOpacity={0.7}
              >
              {item.cover_url ? (
                <Image
                  source={{ uri: item.cover_url }}
                  style={styles.resultCover}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.resultCover, styles.resultPlaceholder]}>
                  <Text style={styles.resultPlaceholderText}>📚</Text>
                </View>
              )}
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.resultAuthor} numberOfLines={1}>{item.author}</Text>
                {item.publish_year && (
                  <Text style={styles.resultYear}>{item.publish_year}</Text>
                )}
              </View>
              </TouchableOpacity>
            </BlurView>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {!loading && query && results.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  headerBlur: {
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    letterSpacing: typography.letterSpacing.tight,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  searchInput: {
    ...componentStyles.input,
    flex: 1,
  },
  searchButton: {
    ...componentStyles.button,
    ...componentStyles.buttonPrimary,
    paddingHorizontal: 20,
    minWidth: 80,
  },
  searchButtonText: {
    ...componentStyles.buttonText,
  },
  sourceSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  sourceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  sourceButtonActive: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  sourceButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[500],
  },
  sourceButtonTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: 16,
  },
  resultCard: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  resultCardContent: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
  },
  resultCover: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: colors.slate[200],
  },
  resultPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate[300],
  },
  resultPlaceholderText: {
    fontSize: 24,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
    marginBottom: 4,
  },
  resultAuthor: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginBottom: 4,
  },
  resultYear: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
});
