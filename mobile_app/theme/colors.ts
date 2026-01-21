// Color palette matching the web app design system

export const colors = {
  // Slate colors (primary grays)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  
  // Blue (primary brand color)
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  
  // Purple (accent color)
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  
  // Rose/Pink (gradient colors)
  rose: {
    500: '#f43f5e',
    600: '#e11d48',
  },
  
  pink: {
    500: '#ec4899',
    600: '#db2777',
  },
  
  // Indigo (gradient colors)
  indigo: {
    600: '#4f46e5',
    700: '#4338ca',
  },
  
  // Emerald/Teal (gradient colors)
  emerald: {
    500: '#10b981',
    600: '#059669',
  },
  
  teal: {
    500: '#14b8a6',
    600: '#0d9488',
  },
  
  // Amber/Orange (gradient colors)
  amber: {
    500: '#f59e0b',
    600: '#d97706',
  },
  
  orange: {
    500: '#f97316',
    600: '#ea580c',
  },
  
  // Cyan (gradient colors)
  cyan: {
    500: '#06b6d4',
    600: '#0891b2',
  },
  
  // Fuchsia (gradient colors)
  fuchsia: {
    500: '#d946ef',
    600: '#c026d3',
  },
  
  // Functional colors
  white: '#ffffff',
  black: '#000000',
  
  // Status colors
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  
  // Star rating
  star: {
    filled: '#fbbf24',
    empty: '#cbd5e1',
  },
} as const;

// Gradient combinations from web app
export const gradients = {
  rosePink: ['#f43f5e', '#ec4899'],
  indigoBlue: ['#4f46e5', '#2563eb'],
  emeraldTeal: ['#10b981', '#14b8a6'],
  amberOrange: ['#f59e0b', '#f97316'],
  purpleFuchsia: ['#9333ea', '#d946ef'],
  cyanBlue: ['#06b6d4', '#3b82f6'],
} as const;
