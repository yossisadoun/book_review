// Book spine component matching web app design

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BookWithRatings } from '@book-review/core';
import { Star } from 'lucide-react-native';
import { colors } from '../theme';

interface BookSpineProps {
  book: BookWithRatings;
  onPress: () => void;
}

// Color sets matching web app
const COLOR_SETS = [
  { main: '#5199fc', accent: '#afd7fb' },
  { main: '#ff9868', accent: '#d06061' },
  { main: '#ff5068', accent: '#d93368' },
  { main: '#A1D821', accent: '#7ca81a' },
  { main: '#FCCF47', accent: '#d4af3b' },
  { main: '#5856d6', accent: '#4543a8' },
  { main: '#1c1c1e', accent: '#48484a' },
];

function calculateScore(ratings: BookWithRatings['ratings']): number {
  const values = [
    ratings.writing,
    ratings.insights,
    ratings.flow,
    ratings.world,
    ratings.characters,
  ].filter((v): v is number => v !== null && v !== undefined);
  
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateAvg(ratings: BookWithRatings['ratings']): string | null {
  const values = [
    ratings.writing,
    ratings.insights,
    ratings.flow,
    ratings.world,
    ratings.characters,
  ].filter((v): v is number => v !== null && v !== undefined);
  
  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return avg.toFixed(1);
}

export function BookSpine({ book, onPress }: BookSpineProps) {
  // Generate consistent colors based on book ID (matching web app logic)
  const hash = book.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const styleSet = COLOR_SETS[hash % COLOR_SETS.length];
  
  // Calculate text color (50% darker or brighter based on background luminance)
  const r = parseInt(styleSet.main.slice(1, 3), 16);
  const g = parseInt(styleSet.main.slice(3, 5), 16);
  const b = parseInt(styleSet.main.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const factor = luminance > 0.5 ? -0.5 : 0.5;
  const textR = Math.max(0, Math.min(255, Math.round(r * (1 + factor))));
  const textG = Math.max(0, Math.min(255, Math.round(g * (1 + factor))));
  const textB = Math.max(0, Math.min(255, Math.round(b * (1 + factor))));
  const textColor = `rgb(${textR}, ${textG}, ${textB})`;
  
  // Height based on score (224-336px range, 20% smaller for mobile)
  const score = calculateScore(book.ratings);
  const height = score > 0 ? (280 + (score * 28)) * 0.8 : 280 * 0.8;
  // Width varies (44-68px, 20% smaller)
  const width = (55 + (hash % 30)) * 0.8;
  
  const avgScore = calculateAvg(book.ratings);
  
  return (
    <View style={styles.container}>
      {/* Rating - Above the book */}
      {avgScore && (
        <View style={styles.ratingContainer}>
          {/* @ts-ignore - lucide-react-native supports fill and color props */}
          <Star size={14} fill={colors.star.filled} color={colors.star.filled} />
          <Text style={styles.ratingText}>{avgScore}</Text>
        </View>
      )}
      
      {/* Book Spine */}
      <TouchableOpacity
        style={[
          styles.spine,
          {
            height,
            width,
            backgroundColor: styleSet.main,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* Decoration Stripes */}
        <View style={[styles.stripes, { width: '60%' }]}>
          <View style={[styles.stripe, { backgroundColor: styleSet.accent, opacity: 0.3 }]} />
          <View style={[styles.stripe, { backgroundColor: styleSet.accent, opacity: 0.3 }]} />
        </View>
        
        {/* Spine Content - Vertical Text */}
        <View style={styles.spineContent}>
          <View style={styles.verticalTextContainer}>
            {book.title.split('').map((char, idx) => (
              <Text
                key={idx}
                style={[
                  styles.spineText,
                  {
                    color: textColor,
                    fontSize: Math.max(16, Math.min(width * 0.7, 24)),
                  },
                ]}
              >
                {char.toUpperCase()}
              </Text>
            ))}
          </View>
        </View>
        
        {/* Bottom Shadow */}
        <View style={styles.bottomShadow} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.slate[950],
  },
  spine: {
    borderRadius: 4,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stripes: {
    position: 'absolute',
    top: 15,
    left: '50%',
    transform: [{ translateX: -50 }],
    gap: 4,
    zIndex: 10,
  },
  stripe: {
    height: 3,
    width: '100%',
    borderRadius: 2,
  },
  spineContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    zIndex: 0,
  },
  verticalTextContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  spineText: {
    fontWeight: '700',
    lineHeight: Math.max(16, 20), // Tight line height for vertical text
    letterSpacing: 1,
  },
  bottomShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    transform: [{ translateY: 12 }],
  },
});
