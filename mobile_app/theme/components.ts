// Reusable component styles matching web app design

import { StyleSheet, ViewStyle } from 'react-native';
import { colors } from './colors';
import { typography } from './typography';

export const componentStyles = StyleSheet.create({
  // Glassmorphism card (matching bg-white/80 backdrop-blur-md rounded-xl shadow-xl border border-white/30)
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)', // bg-white/80
    borderRadius: 12, // rounded-xl
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)', // border-white/30
  },
  
  // Standard card
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  
  // Section container
  section: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  
  // Section title
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
  },
  
  // Label badge (matching web app's label badges)
  labelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: typography.fontSize['2xs'],
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  
  // Blue label badge
  labelBadgeBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // bg-blue-100/90
    color: colors.blue[800],
  },
  
  // Purple label badge
  labelBadgePurple: {
    backgroundColor: 'rgba(147, 51, 234, 0.1)', // bg-purple-100/90
    color: colors.purple[800],
  },
  
  // Button styles
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonPrimary: {
    backgroundColor: colors.blue[600],
  },
  
  buttonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  
  // Input styles
  input: {
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 8,
    padding: 12,
    fontSize: typography.fontSize.base,
    color: colors.slate[900],
  },
  
  // Text styles
  text: {
    fontSize: typography.fontSize.base,
    color: colors.slate[900],
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  
  textSecondary: {
    color: colors.slate[600],
  },
  
  textMuted: {
    color: colors.slate[500],
  },
  
  textSmall: {
    fontSize: typography.fontSize.sm,
  },
  
  textXSmall: {
    fontSize: typography.fontSize.xs,
  },
  
  textTiny: {
    fontSize: typography.fontSize['2xs'],
  },
  
  // Heading styles
  heading1: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
  },
  
  heading2: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
  },
  
  heading3: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
  },
});
