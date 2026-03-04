import React from 'react';

export function getAssetPath(path: string): string {
  if (typeof window === 'undefined') {
    // SSR/build: use basePath for production non-Capacitor builds
    const isCapacitor = process.env.CAPACITOR === '1';
    const isProduction = process.env.NODE_ENV === 'production';
    return isProduction && !isCapacitor ? `/book_review${path}` : path;
  }
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
  if (isLocalhost || isCapacitor) return path;
  if (window.location.pathname.startsWith('/book_review')) {
    return `/book_review${path}`;
  }
  return path;
}

export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null;
  if (textarea) {
    textarea.innerHTML = text;
    return textarea.value;
  }
  // Fallback for SSR - decode common entities manually
  return text
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

export function isHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

// Consistent glassmorphism style (less transparent for book page info cards)
export const glassmorphicStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.45)',
  borderRadius: '16px',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
};
