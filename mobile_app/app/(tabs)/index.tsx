// Home screen with book list

import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBooks } from '../../hooks/useBooks';
import { BookWithRatings, deleteBook } from '@book-review/core';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';
import { colors, typography, componentStyles } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { BookSpine } from '../../components/BookSpine';

function BookCard({ 
  book, 
  onPress, 
  onDelete 
}: { 
  book: BookWithRatings; 
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.bookCard}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
        <View style={styles.cardBlurContent}>
        <TouchableOpacity 
          onPress={onPress} 
          activeOpacity={0.7}
          style={styles.cardContent}
        >
        {book.cover_url ? (
          <Image
            source={{ uri: book.cover_url }}
            style={styles.bookCover}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.bookCover, styles.bookPlaceholder]}>
            <Text style={styles.bookPlaceholderText}>📚</Text>
          </View>
        )}
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onDelete();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {/* @ts-ignore - lucide-react-native supports color prop at runtime */}
        <Trash2 size={16} color={colors.error} />
        </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const { books, loading: booksLoading, refetch } = useBooks();
  const router = useRouter();

  const handleDeleteBook = async (book: BookWithRatings) => {
    Alert.alert(
      'Delete Book',
      `Are you sure you want to delete "${book.title}"?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => {
            // Reset any swiped cards
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await deleteBook(supabase, book.id);
              refetch();
            } catch (error) {
              console.error('Error deleting book:', error);
              Alert.alert('Error', 'Failed to delete book');
            }
          },
        },
      ]
    );
  };

  if (authLoading || booksLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[colors.slate[50], colors.white]}
          style={styles.gradientBackground}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.blue[600]} />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.slate[50], colors.white]}
        style={styles.gradientBackground}
      >
        <View style={styles.headerContainer}>
          <BlurView intensity={40} tint="light" style={styles.headerBlur}>
            <View style={styles.header}>
              <Text style={styles.title}>BOOKS</Text>
              {user && (
                <TouchableOpacity onPress={() => router.push('/(tabs)/add')}>
                  <Text style={styles.addButton}>+ Add</Text>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </View>

      {books.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.emptyTitle}>No books yet</Text>
          <Text style={styles.emptySubtitle}>Tap "+ Add" to add your first book</Text>
        </View>
      ) : (
        <View style={styles.bookshelfContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bookshelfContent}
            style={styles.bookshelfScroll}
          >
            {books.map((book) => (
              <View key={book.id} style={styles.bookSpineWrapper}>
                <BookSpine
                  book={book}
                  onPress={() => {
                    router.push(`/(tabs)/${book.id}`);
                  }}
                />
                {/* Delete button for spine */}
                <TouchableOpacity
                  style={styles.spineDeleteButton}
                  onPress={() => handleDeleteBook(book)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {/* @ts-ignore - lucide-react-native supports color prop */}
                  <Trash2 size={12} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
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
  headerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  headerBlur: {
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    letterSpacing: typography.letterSpacing.tight,
  },
  addButton: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.blue[600],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bookshelfContainer: {
    flex: 1,
    paddingVertical: 20,
  },
  bookshelfScroll: {
    flex: 1,
  },
  bookshelfContent: {
    paddingHorizontal: 40,
    paddingBottom: 20,
    alignItems: 'flex-end',
    minHeight: 400,
  },
  bookSpineWrapper: {
    marginRight: 4,
    position: 'relative',
  },
  spineDeleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  bookCard: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: 'transparent',
  },
  cardBlurContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
    position: 'relative',
    padding: 0,
  },
  cardContent: {
    flex: 1,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  bookCover: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: colors.slate[200],
  },
  bookPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.slate[300],
  },
  bookPlaceholderText: {
    fontSize: 40,
  },
  bookInfo: {
    padding: 12,
  },
  bookTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
  },
});
