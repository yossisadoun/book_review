// Typography system matching web app

export const typography = {
  // Font families (web app uses custom fonts, mobile uses system fonts with fallbacks)
  fontFamily: {
    // For titles/headings - try to match Bebas Neue, Oswald, Antonio, Archivo Narrow feel
    heading: 'System', // iOS: SF Pro Display, Android: Roboto
    body: 'System', // iOS: SF Pro Text, Android: Roboto
  },
  
  // Font sizes (matching web app's text-xs, text-sm, etc.)
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    // Web app uses text-[10px] for some labels
    '2xs': 10,
  },
  
  // Font weights
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Letter spacing (tracking)
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
    widest: 1,
  },
} as const;
