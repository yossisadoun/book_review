// Book detail screen

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useState, useEffect } from 'react';
import { useBooks } from '../../hooks/useBooks';
import { BookWithRatings, ReadingStatus, updateReadingStatus, updateNotes, RelatedBook, getRelatedBooks, fetchRelatedBooks } from '@book-review/core';
import { RatingOverlay } from '../../components/RatingOverlay';
import { Star, BookOpen, BookMarked, BookCheck } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { colors, typography, componentStyles } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { books, refetch } = useBooks();
  const [showRatingOverlay, setShowRatingOverlay] = useState(false);
  const [editingDimension, setEditingDimension] = useState<string | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [relatedBooks, setRelatedBooks] = useState<RelatedBook[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const book = books.find(b => b.id === id);
  const grokApiKey = Constants.expoConfig?.extra?.grokApiKey || process.env.EXPO_PUBLIC_GROK_API_KEY || '';

  // Initialize notes text when book loads
  useEffect(() => {
    if (book) {
      setNotesText(book.notes || '');
    }
  }, [book]);

  // Load related books when book is available
  useEffect(() => {
    if (!book) return;

    async function loadRelated() {
      setLoadingRelated(true);
      try {
        // First check cache
        const cached = await fetchRelatedBooks(supabase, book!.title, book!.author);
        if (cached && cached.length > 0) {
          setRelatedBooks(cached);
          setLoadingRelated(false);
          return;
        }

        // If no cache and we have Grok API key, fetch from Grok
        if (grokApiKey) {
          const related = await getRelatedBooks(supabase, book!.title, book!.author, grokApiKey);
          setRelatedBooks(related);
        }
      } catch (error) {
        console.error('Error loading related books:', error);
      } finally {
        setLoadingRelated(false);
      }
    }

    loadRelated();
  }, [book, grokApiKey]);

  if (!book) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Book not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const avgRating = book.ratings.writing && book.ratings.insights && book.ratings.flow && 
                    book.ratings.world && book.ratings.characters
    ? ((book.ratings.writing + book.ratings.insights + book.ratings.flow + book.ratings.world + book.ratings.characters) / 5).toFixed(1)
    : null;

  const handleReadingStatusChange = async (status: ReadingStatus) => {
    if (!book) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateReadingStatus(supabase, book.id, status);
      refetch();
    } catch (error) {
      console.error('Error updating reading status:', error);
      Alert.alert('Error', 'Failed to update reading status');
    }
  };

  const handleSaveNotes = async () => {
    if (!book) return;
    
    setIsSavingNotes(true);
    try {
      await updateNotes(supabase, book.id, notesText);
      setIsEditingNotes(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
    } catch (error) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', 'Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.slate[50], colors.white]}
        style={styles.gradientBackground}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <BlurView intensity={20} tint="light" style={styles.headerBlur}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setEditingDimension(null);
                setShowRatingOverlay(true);
              }}
              style={styles.ratingButton}
            >
              {/* @ts-ignore - lucide-react-native supports these props at runtime */}
              <Star size={16} color={colors.star.filled} fill={colors.star.filled} />
              <Text style={styles.ratingButtonText}>
                {avgRating || 'Rate'}
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Cover Image */}
        {book.cover_url ? (
          <Image
            source={{ uri: book.cover_url }}
            style={styles.cover}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.coverPlaceholderText}>📚</Text>
          </View>
        )}

        {/* Book Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>{book.author}</Text>

          {book.summary && (
            <Text style={styles.summary}>{book.summary}</Text>
          )}

          {/* Metadata */}
          <View style={styles.metadata}>
            {book.publish_year && (
              <View style={styles.metaTag}>
                <Text style={styles.metaText}>{book.publish_year}</Text>
              </View>
            )}
            {book.first_issue_year && (
              <View style={styles.metaTag}>
                <Text style={styles.metaText}>First Issue: {book.first_issue_year}</Text>
              </View>
            )}
            {book.genre && (
              <View style={styles.metaTag}>
                <Text style={styles.metaText}>{book.genre}</Text>
              </View>
            )}
            {book.isbn && (
              <View style={styles.metaTag}>
                <Text style={styles.metaText}>ISBN: {book.isbn}</Text>
              </View>
            )}
          </View>

          {/* Ratings Summary */}
          <BlurView intensity={20} tint="light" style={styles.ratingsSection}>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Ratings</Text>
            {avgRating ? (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>Average:</Text>
                <Text style={styles.ratingValue}>{avgRating} / 5</Text>
              </View>
            ) : (
              <Text style={styles.noRatingsText}>No ratings yet</Text>
            )}
            <View style={styles.dimensionRatings}>
              {(['writing', 'insights', 'flow', 'world', 'characters'] as const).map((dim) => {
                const rating = book.ratings[dim];
                return (
                  <View key={dim} style={styles.dimensionRow}>
                    <Text style={styles.dimensionLabel}>{dim.charAt(0).toUpperCase() + dim.slice(1)}:</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        // @ts-ignore - lucide-react-native supports fill and color props at runtime
                        <Star
                          key={star}
                          size={14}
                          fill={rating && star <= rating ? colors.star.filled : 'transparent'}
                          color={rating && star <= rating ? colors.star.filled : colors.star.empty}
                        />
                      ))}
                      {rating && <Text style={styles.dimensionValue}>{rating}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
            </View>
          </BlurView>

          {/* Reading Status */}
          <BlurView intensity={20} tint="light" style={styles.section}>
            <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>Reading Status</Text>
            <View style={styles.statusButtons}>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  book.reading_status === 'read_it' && styles.statusButtonActive,
                ]}
                onPress={() => handleReadingStatusChange('read_it')}
              >
                {/* @ts-ignore - lucide-react-native supports color prop at runtime */}
                <BookCheck size={18} color={book.reading_status === 'read_it' ? colors.white : colors.slate[500]} />
                <Text
                  style={[
                    styles.statusButtonText,
                    book.reading_status === 'read_it' && styles.statusButtonTextActive,
                  ]}
                >
                  Read It
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  book.reading_status === 'reading' && styles.statusButtonActive,
                ]}
                onPress={() => handleReadingStatusChange('reading')}
              >
                {/* @ts-ignore - lucide-react-native supports color prop at runtime */}
                <BookOpen size={18} color={book.reading_status === 'reading' ? colors.white : colors.slate[500]} />
                <Text
                  style={[
                    styles.statusButtonText,
                    book.reading_status === 'reading' && styles.statusButtonTextActive,
                  ]}
                >
                  Reading
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  book.reading_status === 'want_to_read' && styles.statusButtonActive,
                ]}
                onPress={() => handleReadingStatusChange('want_to_read')}
              >
                {/* @ts-ignore - lucide-react-native supports color prop at runtime */}
                <BookMarked size={18} color={book.reading_status === 'want_to_read' ? colors.white : colors.slate[500]} />
                <Text
                  style={[
                    styles.statusButtonText,
                    book.reading_status === 'want_to_read' && styles.statusButtonTextActive,
                  ]}
                >
                  Want to Read
                </Text>
              </TouchableOpacity>
            </View>
            </View>
          </BlurView>

          {/* Notes */}
          <BlurView intensity={20} tint="light" style={styles.section}>
            <View style={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notes</Text>
              {!isEditingNotes && (
                <TouchableOpacity onPress={() => setIsEditingNotes(true)}>
                  <Text style={styles.editButton}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            {isEditingNotes ? (
              <View>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  numberOfLines={6}
                  value={notesText}
                  onChangeText={setNotesText}
                  placeholder="Add your thoughts about this book..."
                  placeholderTextColor="#94a3b8"
                />
                <View style={styles.notesActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setIsEditingNotes(false);
                      setNotesText(book.notes || '');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveNotes}
                    disabled={isSavingNotes}
                  >
                    <Text style={styles.saveButtonText}>
                      {isSavingNotes ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.notesText}>
                {book.notes || 'No notes yet. Tap Edit to add your thoughts.'}
              </Text>
            )}
            </View>
          </BlurView>

          {/* Related Books */}
          {relatedBooks.length > 0 && (
            <BlurView intensity={20} tint="light" style={styles.section}>
              <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Related Books</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relatedBooksScroll}>
                {relatedBooks.map((related, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.relatedBookCard}
                    onPress={() => {
                      // TODO: Navigate to add book screen with pre-filled search
                      Alert.alert('Add Book', `Would you like to add "${related.title}" by ${related.author}?`);
                    }}
                  >
                    {related.cover_url ? (
                      <Image
                        source={{ uri: related.cover_url }}
                        style={styles.relatedBookCover}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.relatedBookCover, styles.relatedBookPlaceholder]}>
                        <Text style={styles.relatedBookPlaceholderText}>📚</Text>
                      </View>
                    )}
                    <Text style={styles.relatedBookTitle} numberOfLines={2}>
                      {related.title}
                    </Text>
                    <Text style={styles.relatedBookAuthor} numberOfLines={1}>
                      {related.author}
                    </Text>
                    {related.reason && (
                      <Text style={styles.relatedBookReason} numberOfLines={2}>
                        {related.reason}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              </View>
            </BlurView>
          )}
          {loadingRelated && (
            <BlurView intensity={20} tint="light" style={styles.section}>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Related Books</Text>
                <ActivityIndicator size="small" color={colors.blue[600]} />
              </View>
            </BlurView>
          )}
        </View>
      </ScrollView>
      </LinearGradient>

      {/* Rating Overlay */}
      <RatingOverlay
        visible={showRatingOverlay}
        book={book}
        onClose={() => {
          setShowRatingOverlay(false);
          setEditingDimension(null);
          refetch(); // Refresh book list after rating
        }}
        editingDimension={editingDimension}
        onDimensionChange={setEditingDimension}
        onRatingChange={refetch}
      />
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  headerBlur: {
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: typography.fontSize.base,
    color: colors.blue[600],
    fontWeight: typography.fontWeight.semibold,
  },
  ratingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7', // Amber-100 equivalent
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  ratingButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: '#92400e', // Amber-800
  },
  cover: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#e2e8f0',
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#cbd5e1',
  },
  coverPlaceholderText: {
    fontSize: 80,
  },
  infoContainer: {
    padding: 16,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    marginBottom: 8,
  },
  author: {
    fontSize: typography.fontSize.lg,
    color: colors.slate[500],
    marginBottom: 16,
  },
  summary: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
    marginBottom: 16,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  metaTag: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  ratingsSection: {
    marginBottom: 16,
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
  section: {
    marginBottom: 16,
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
  sectionContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 16,
  },
  sectionHeader: {
    ...componentStyles.sectionHeader,
  },
  sectionTitle: {
    ...componentStyles.sectionTitle,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  noRatingsText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  dimensionRatings: {
    gap: 12,
  },
  dimensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dimensionLabel: {
    fontSize: 14,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dimensionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  editButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  notesActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  relatedBooksScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  relatedBookCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  relatedBookCover: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#e2e8f0',
  },
  relatedBookPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#cbd5e1',
  },
  relatedBookPlaceholderText: {
    fontSize: 32,
  },
  relatedBookTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 8,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  relatedBookAuthor: {
    fontSize: 11,
    color: '#64748b',
    marginHorizontal: 8,
    marginBottom: 4,
  },
  relatedBookReason: {
    fontSize: 10,
    color: '#94a3b8',
    marginHorizontal: 8,
    marginBottom: 8,
    lineHeight: 14,
  },
});
