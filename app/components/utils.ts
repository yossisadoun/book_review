import React, { useState, useEffect } from 'react';

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

/**
 * Samples the bottom portion of an image to determine if it's light or dark.
 * Returns 'light' when the overlay area has a bright background (needs dark glass),
 * or 'dark' (default, keeps current white glass).
 */
export function useImageBrightness(imageUrl: string | undefined): 'light' | 'dark' {
  const [brightness, setBrightness] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (!imageUrl) {
      setBrightness('dark');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 64; // small sample for performance
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, size, size);

        // Sample bottom 40% where the overlay sits
        const startY = Math.floor(size * 0.6);
        const data = ctx.getImageData(0, startY, size, size - startY).data;

        let totalLuminance = 0;
        const pixelCount = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          totalLuminance += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        const avgBrightness = totalLuminance / pixelCount;
        setBrightness(avgBrightness > 150 ? 'light' : 'dark');
      } catch {
        // CORS or other error — keep default
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  return brightness;
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
