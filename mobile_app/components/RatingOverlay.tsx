// Rating overlay component with 5 dimensions

import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { BookWithRatings } from '@book-review/core';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { updateRating } from '@book-review/core';
import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
import { colors, typography, componentStyles } from '../theme';
import { BlurView } from 'expo-blur';

const RATING_DIMENSIONS = ['writing', 'insights', 'flow', 'world', 'characters'] as const;

interface RatingOverlayProps {
  visible: boolean;
  book: BookWithRatings;
  onClose: () => void;
  editingDimension: string | null;
  onDimensionChange: (dimension: string | null) => void;
  onRatingChange?: () => void; // Callback to refresh book data after rating
}

export function RatingOverlay({ visible, book, onClose, editingDimension, onDimensionChange }: RatingOverlayProps) {
  const { user } = useAuth();
  const [localRatings, setLocalRatings] = useState<Record<string, number | null>>({});

  // Initialize local ratings from book
  useEffect(() => {
    if (visible && book) {
      const ratings: Record<string, number | null> = {};
      RATING_DIMENSIONS.forEach(dim => {
        ratings[dim] = book.ratings[dim] || null;
      });
      setLocalRatings(ratings);
    }
  }, [visible, book]);

  // Determine current dimension to edit
  const currentDimension = useMemo(() => {
    if (editingDimension) return editingDimension;
    // Find first unrated dimension
    const unrated = RATING_DIMENSIONS.find(dim => 
      localRatings[dim] === null || localRatings[dim] === undefined
    );
    return unrated || RATING_DIMENSIONS[0];
  }, [editingDimension, localRatings]);

  const handleRate = async (dimension: string, value: number | null) => {
    if (!user) return;

    // Update local state immediately (optimistic update)
    setLocalRatings(prev => ({ ...prev, [dimension]: value }));

    // Haptic feedback
    if (value !== null) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      await updateRating(supabase, book.id, dimension, value);
      
      // Refresh the book from parent component would be ideal, but for now we rely on optimistic update

      // Move to next dimension after rating
      const currentIndex = RATING_DIMENSIONS.indexOf(dimension as typeof RATING_DIMENSIONS[number]);
      const nextIndex = currentIndex + 1;

      if (nextIndex < RATING_DIMENSIONS.length) {
        onDimensionChange(RATING_DIMENSIONS[nextIndex]);
      } else {
        // All dimensions rated, close after delay
        setTimeout(() => {
          onClose();
        }, 500);
      }
    } catch (error) {
      console.error('Error updating rating:', error);
      // Revert on error
      const originalRating = book.ratings[dimension as keyof typeof book.ratings];
      setLocalRatings(prev => ({
        ...prev,
        [dimension]: originalRating,
      }));
    }
  };

  const handleSkip = async () => {
    const currentIndex = RATING_DIMENSIONS.indexOf(currentDimension as typeof RATING_DIMENSIONS[number]);
    const nextIndex = currentIndex + 1;

    if (nextIndex < RATING_DIMENSIONS.length) {
      onDimensionChange(RATING_DIMENSIONS[nextIndex]);
    } else {
      // All dimensions processed, close
      onClose();
    }
  };

  const currentValue = localRatings[currentDimension] || null;
  const currentIndex = RATING_DIMENSIONS.indexOf(currentDimension as typeof RATING_DIMENSIONS[number]);
  const progress = ((currentIndex + 1) / RATING_DIMENSIONS.length) * 100;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <BlurView intensity={20} tint="light" style={styles.contentBlur}>
          <View style={styles.content}>
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {currentIndex + 1} / {RATING_DIMENSIONS.length}
            </Text>
          </View>

          {/* Dimension label */}
          <Text style={styles.dimensionLabel}>
            {currentDimension.charAt(0).toUpperCase() + currentDimension.slice(1)}
          </Text>

          {/* Stars */}
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleRate(currentDimension, star)}
                activeOpacity={0.7}
                style={styles.starButton}
              >
                {/* @ts-ignore - lucide-react-native supports fill and color props at runtime */}
                <Star
                  size={48}
                  fill={star <= (currentValue || 0) ? colors.star.filled : 'transparent'}
                  color={star <= (currentValue || 0) ? colors.star.filled : colors.star.empty}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleSkip}
              style={styles.skipButton}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={styles.doneButton}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Dimension dots */}
          <View style={styles.dotsContainer}>
            {RATING_DIMENSIONS.map((dim, index) => (
              <View
                key={dim}
                style={[
                  styles.dot,
                  dim === currentDimension && styles.dotActive,
                  localRatings[dim] !== null && localRatings[dim] !== undefined && styles.dotRated,
                ]}
              />
            ))}
          </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  contentBlur: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 32,
    paddingBottom: 48,
    alignItems: 'center',
    minHeight: 400,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: colors.slate[200],
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.blue[600],
    borderRadius: 2,
  },
  progressText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    textAlign: 'center',
  },
  dimensionLabel: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    textTransform: 'capitalize',
    marginBottom: 32,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  starButton: {
    padding: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    marginBottom: 24,
  },
  skipButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
  },
  doneButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.blue[600],
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.slate[300],
  },
  dotActive: {
    backgroundColor: colors.blue[600],
    width: 24,
  },
  dotRated: {
    backgroundColor: colors.star.filled,
  },
});
