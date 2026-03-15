'use client';

import React from 'react';

// Helper function to get the correct path for static assets (handles basePath)
function getAssetPath(path: string): string {
  if (typeof window === 'undefined') return path;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalhost) return path;
  const pathname = window.location.pathname;
  if (pathname.startsWith('/book_review')) {
    return `/book_review${path}`;
  }
  return path;
}

export function BookLoading() {
  return (
    <>
      <style>{`
        :root {
          --hue: 25;
          --sat: 100%;
          --speed: 7s;
          --line-opacity: 0;
          
          --bg: hsl(var(--hue), 10%, 90%);
          --fg: hsl(var(--hue), 10%, 10%);
          --primary: hsl(var(--hue), var(--sat), 55%);
          --primary-l: hsl(var(--hue), var(--sat), 65%);
          --primary-d: hsl(var(--hue), var(--sat), 45%);
          --white: hsl(var(--hue), 10%, 100%);
          --white-d: hsl(var(--hue), 10%, 45%);
        }
        
        .book-loading {
          font-size: 6px;
        }
        
        .book-loading .book,
        .book-loading .book__pg-shadow,
        .book-loading .book__pg {
          animation: cover var(--speed) ease-in-out infinite;
        }
        
        .book-loading .book {
          background-color: var(--primary-l);
          border-radius: 0.25em;
          box-shadow: 0 0.25em 0.5em hsla(0,0%,0%,0.3),
                      0 0 0 0.25em var(--primary) inset;
          padding: 0.25em;
          perspective: 37.5em;
          position: relative;
          width: 8em;
          height: 6em;
          transform: translate3d(0px, 0px, 0px);
          transform-style: preserve-3d;
        }
        
        .book-loading .book__pg-shadow,
        .book-loading .book__pg {
          position: absolute;
          left: 0.25em;
          width: calc(50% - 0.25em);
        }
        
        .book-loading .book__pg-shadow {
          animation-name: shadow;
          background-image: linear-gradient(-45deg, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.3) 50%);
          filter: blur(0.25em);
          top: calc(100% - 0.25em);
          height: 3.75em;
          transform: scaleY(0);
          transform-origin: 100% 0%;
        }
        
        .book-loading .book__pg {
          animation-name: pg1;
          background-color: var(--white);
          background-image: linear-gradient(90deg, hsla(var(--hue), 10%, 90%, 0) 87.5%, hsl(var(--hue), 10%, 90%));
          height: calc(100% - 0.5em);
          transform-origin: 100% 50%;
        }
        
        .book-loading .book__pg--2,
        .book-loading .book__pg--3,
        .book-loading .book__pg--4 {
          background-image: repeating-linear-gradient(hsla(var(--hue), 10%, 10%, var(--line-opacity)) 0 0.125em, hsla(var(--hue), 10%, 10%, 0) 0.125em 0.5em),
                          linear-gradient(90deg, hsla(var(--hue), 10%, 90%, 0) 87.5%, hsl(var(--hue), 10%, 90%));
          background-repeat: no-repeat;
          background-position: center center;
          background-size: 2.5em 4.125em, 100% 100%;
        }
        
        .book-loading .book__pg--2 {
          animation-name: pg2;
        }
        
        .book-loading .book__pg--3 {
          animation-name: pg3;
        }
        
        .book-loading .book__pg--4 {
          animation-name: pg4;
        }
        
        .book-loading .book__pg--5 {
          animation-name: pg5;
        }
        
        @keyframes cover { 
          0%, 5%, 45%, 55%, 95%, 100% { 
            animation-timing-function: ease-out; 
            background-color: var(--primary-l); 
          }
          10%, 40%, 60%, 90% { 
            animation-timing-function: ease-in; 
            background-color: var(--primary-d); 
          }
        }
        
        @keyframes shadow { 
          0%, 10.01%, 20.01%, 30.01%, 40.01% { 
            transform: translate3d(0px, 0px, 1px) scaleY(0) rotateY(0deg); 
          }
          5%, 15%, 25%, 35%, 45%, 55%, 65%, 75%, 85%, 95% { 
            transform: translate3d(0px, 0px, 1px) scaleY(0.2) rotateY(90deg); 
          }
          10%, 20%, 30%, 40%, 50%, 100% { 
            transform: translate3d(0px, 0px, 1px) scaleY(0) rotateY(180deg); 
          }
          50.01%, 60.01%, 70.01%, 80.01%, 90.01% { 
            transform: translate3d(0px, 0px, 1px) scaleY(0) rotateY(180deg); 
          }
          60%, 70%, 80%, 90%, 100% { 
            transform: translate3d(0px, 0px, 1px) scaleY(0) rotateY(0deg); 
          }
        }
        
        @keyframes pg1 { 
          0%, 100% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0.4deg); 
          }
          10%, 15% { 
            transform: translate3d(0px, 0px, 1px) rotateY(180deg); 
          }
          20%, 80% { 
            transform: translate3d(0px, 0px, 1px) rotateY(180deg); 
            background-color: var(--white-d); 
          }
          85%, 90% { 
            transform: translate3d(0px, 0px, 1px) rotateY(180deg); 
          }
        }
        
        @keyframes pg2 { 
          0%, 100% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0.3deg); 
            background-color: var(--white-d); 
          }
          5%, 10% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0.3deg); 
            background-color: var(--white); 
          }
          20%, 25% { 
            transform: translate3d(0px, 0px, 1px) rotateY(179.9deg); 
            background-color: var(--white); 
          }
          30%, 70% { 
            transform: translate3d(0px, 0px, 1px) rotateY(179.9deg); 
            background-color: var(--white-d); 
          }
          75%, 80% { 
            transform: translate3d(0px, 0px, 1px) rotateY(179.9deg); 
            background-color: var(--white); 
          }
          90%, 95% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0.3deg); 
            background-color: var(--white); 
          }
        }
        
        @keyframes pg3 { 
          0%, 10%, 90%, 100% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0.2deg); 
            background-color: var(--white-d); 
          }
          15%, 20% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0.2deg); 
            background-color: var(--white); 
          }
          30%, 35% { 
            transform: translate3d(0px, 0px, 1px) rotateY(179.8deg); 
            background-color: var(--white); 
          }
          40%, 60% { 
            transform: translate3d(0px, 0px, 1px) rotateY(179.8deg); 
            background-color: var(--white-d); 
          }
          65%, 70% { 
            transform: translate3d(0px, 0px, 1px) rotateY(179.8deg); 
            background-color: var(--white); 
          }
          80%, 85% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0.2deg); 
            background-color: var(--white); 
          }
        }
        
        @keyframes pg4 { 
          0%, 20%, 80%, 100% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0.1deg); 
            background-color: var(--white-d); 
          }
          25%, 30% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0.1deg); 
            background-color: var(--white); 
          }
          40%, 45% { 
            transform: translate3d(0px, 0px, 1px) rotateY(179.7deg); 
            background-color: var(--white); 
          }
          50% { 
            transform: translate3d(0px, 0px, 1px) rotateY(179.7deg); 
            background-color: var(--white-d); 
          }
          55%, 60% { 
            transform: translate3d(0px, 0px, 1px) rotateY(179.7deg); 
            background-color: var(--white); 
          }
          70%, 75% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0.1deg); 
            background-color: var(--white); 
          }
        }
        
        @keyframes pg5 { 
          0%, 30%, 70%, 100% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0deg); 
            background-color: var(--white-d); 
          }
          35%, 40% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0deg); 
            background-color: var(--white); 
          }
          50% { 
            transform: translate3d(0px, 0px, 1px) rotateY(179.6deg); 
            background-color: var(--white); 
          }
          60%, 65% { 
            transform: translate3d(0px, 0px, 1px) rotateY(0deg); 
            background-color: var(--white); 
          }
        }
      `}</style>
      <div
        className="fixed inset-0 flex items-center justify-center z-50"
        style={{
          backgroundImage: `url(${getAssetPath('/bg.webp')})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="book-loading">
          <div className="book">
            <div className="book__pg-shadow"></div>
            <div className="book__pg"></div>
            <div className="book__pg book__pg--2"></div>
            <div className="book__pg book__pg--3"></div>
            <div className="book__pg book__pg--4"></div>
            <div className="book__pg book__pg--5"></div>
          </div>
        </div>
      </div>
    </>
  );
}
