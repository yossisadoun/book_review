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

            // Prevent double/triple-tap zoom on iOS (without blocking fast button taps)
            // touch-action: manipulation in CSS handles this now

            // Fix iOS missed clicks: when touchend fires on a button but the DOM
            // re-renders before iOS synthesizes the click, dispatch one manually.
            (function() {
              var pendingTouchEnd = null;

              document.addEventListener('touchstart', function(e) {
                // Only track single-finger taps (not pinch/scroll)
                if (e.touches.length === 1) {
                  pendingTouchEnd = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                } else {
                  pendingTouchEnd = null;
                }
              }, true);

              document.addEventListener('touchmove', function(e) {
                // If finger moved significantly, it's a scroll not a tap
                if (pendingTouchEnd && e.touches.length === 1) {
                  var dx = e.touches[0].clientX - pendingTouchEnd.x;
                  var dy = e.touches[0].clientY - pendingTouchEnd.y;
                  if (dx * dx + dy * dy > 100) { // >10px movement
                    pendingTouchEnd = null;
                  }
                }
              }, true);

              document.addEventListener('touchend', function(e) {
                if (!pendingTouchEnd || e.changedTouches.length !== 1) {
                  pendingTouchEnd = null;
                  return;
                }
                var touch = e.changedTouches[0];
                var target = document.elementFromPoint(touch.clientX, touch.clientY);
                if (!target) { pendingTouchEnd = null; return; }

                // Find the nearest clickable ancestor
                var clickable = target.closest('button, a, [role="button"], [onclick], .cursor-pointer');
                if (!clickable) { pendingTouchEnd = null; return; }

                // Wait briefly — if a real click fires, do nothing
                var touchTarget = clickable;
                var clickFired = false;

                function onRealClick() { clickFired = true; }
                touchTarget.addEventListener('click', onRealClick, { once: true, capture: true });

                setTimeout(function() {
                  touchTarget.removeEventListener('click', onRealClick, { capture: true });
                  if (!clickFired) {
                    // Dispatch synthetic click at the touch point
                    var syntheticClick = new MouseEvent('click', {
                      bubbles: true, cancelable: true, view: window,
                      clientX: touch.clientX, clientY: touch.clientY
                    });
                    syntheticClick.__synthetic = true;
                    touchTarget.dispatchEvent(syntheticClick);
                  }
                }, 50);

                pendingTouchEnd = null;
              }, true);
            })();
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
