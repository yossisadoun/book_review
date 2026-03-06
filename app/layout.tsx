import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import Script from "next/script";

// Get basePath for metadata (handles GitHub Pages basePath)
const isCapacitor = process.env.CAPACITOR === '1';
const isProduction = process.env.NODE_ENV === 'production';
const basePath = isProduction && !isCapacitor ? '/book_review' : '';

export const metadata: Metadata = {
  title: "Book.luv",
  description: "A mobile-first book review app powered by Wikipedia",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  icons: {
    icon: [
      { url: `${basePath}/icon.png`, sizes: 'any' },
      { url: `${basePath}/icon.png`, type: 'image/png' },
    ],
    apple: [
      { url: `${basePath}/icon.png`, sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Book.luv',
  },
  manifest: `${basePath}/manifest.json`,
  other: {
    'apple-touch-icon': `${basePath}/icon.png`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: 'light' }}>
      <body>
        <Script id="set-viewport" strategy="beforeInteractive">
          {`
            (function() {
              // Prevent zooming on mobile and enable full-bleed safe areas
              let viewport = document.querySelector('meta[name="viewport"]');
              if (viewport) {
                viewport.setAttribute(
                  'content',
                  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
                );
              } else {
                viewport = document.createElement('meta');
                viewport.setAttribute('name', 'viewport');
                viewport.setAttribute(
                  'content',
                  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
                );
                document.head.appendChild(viewport);
              }
            })();

            // Prevent triple-tap zoom on iOS
            var lastTouchEnd = 0;
            document.addEventListener('touchend', function(e) {
              var now = Date.now();
              if (now - lastTouchEnd <= 500) {
                e.preventDefault();
              }
              lastTouchEnd = now;
            }, { passive: false });
          `}
        </Script>
        <Script id="fix-favicon-paths" strategy="afterInteractive">
          {`
            (function() {
              const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
              const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
              const basePath = isLocalhost || isCapacitor ? '' : '/book_review';
              
              // Update favicon links
              const updateLink = (rel, href) => {
                let link = document.querySelector('link[rel="' + rel + '"]');
                if (link) {
                  link.setAttribute('href', href);
                } else {
                  link = document.createElement('link');
                  link.setAttribute('rel', rel);
                  link.setAttribute('href', href);
                  document.head.appendChild(link);
                }
              };
              
              // Update icon links
              updateLink('icon', basePath + '/icon.png');
              updateLink('apple-touch-icon', basePath + '/icon.png');
              
              // Update manifest
              let manifestLink = document.querySelector('link[rel="manifest"]');
              if (manifestLink) {
                manifestLink.setAttribute('href', basePath + '/manifest.json');
              }
            })();
          `}
        </Script>
        <Script
          src="https://cdn.jsdelivr.net/npm/@tsparticles/confetti@3.0.3/tsparticles.confetti.bundle.min.js"
          strategy="afterInteractive"
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
