'use client';

import React, { useEffect, useState, useRef } from 'react';

const CACHE_NAME = 'book-covers-cache-v1';

// In-memory cache for blob URLs to avoid recreating them
const blobUrlCache = new Map<string, string>();

interface CachedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  fallback?: React.ReactNode;
}

export function CachedImage({ src, alt, className, style, onClick, referrerPolicy, fallback }: CachedImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(() => {
    // Check in-memory cache first for instant display
    if (src && blobUrlCache.has(src)) {
      return blobUrlCache.get(src)!;
    }
    return null;
  });
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!src) {
      setImageSrc(null);
      return;
    }

    // Already have it in memory
    if (blobUrlCache.has(src)) {
      setImageSrc(blobUrlCache.get(src)!);
      return;
    }

    async function loadImage() {
      try {
        // Check if Cache API is available
        if ('caches' in window) {
          const cache = await caches.open(CACHE_NAME);

          // Try to get from cache first
          const cachedResponse = await cache.match(src!);

          if (cachedResponse) {
            const blob = await cachedResponse.blob();
            const objectUrl = URL.createObjectURL(blob);
            blobUrlCache.set(src!, objectUrl);
            if (mountedRef.current) {
              setImageSrc(objectUrl);
            }
            return;
          }

          // Not in cache, try to fetch and cache it
          try {
            const response = await fetch(src!, { mode: 'cors' });
            if (response.ok) {
              const responseClone = response.clone();
              await cache.put(src!, responseClone);
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);
              blobUrlCache.set(src!, objectUrl);
              if (mountedRef.current) {
                setImageSrc(objectUrl);
              }
              return;
            }
          } catch {
            // CORS error - fall back to direct src
          }
        }

        // Fallback: use src directly
        if (mountedRef.current) {
          setImageSrc(src!);
        }
      } catch {
        if (mountedRef.current) {
          setImageSrc(src!);
        }
      }
    }

    loadImage();
  }, [src]);

  if (!src) {
    return fallback ? <>{fallback}</> : null;
  }

  if (error && fallback) {
    return <>{fallback}</>;
  }

  if (!imageSrc) {
    // Show nothing while loading, or fallback if provided
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      referrerPolicy={referrerPolicy}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

// Utility function to clear the image cache
export async function clearImageCache() {
  if ('caches' in window) {
    await caches.delete(CACHE_NAME);
  }
}

// Utility function to preload images into cache
export async function preloadImages(urls: string[]) {
  if (!('caches' in window)) return;

  const cache = await caches.open(CACHE_NAME);

  await Promise.all(
    urls.filter(Boolean).map(async (url) => {
      try {
        const existing = await cache.match(url);
        if (!existing) {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            await cache.put(url, response);
          }
        }
      } catch {
        // Ignore errors for individual images
      }
    })
  );
}
