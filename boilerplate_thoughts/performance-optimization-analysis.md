# Performance & Load Optimization Analysis

## Executive Summary

The app is a **~15k-line monolithic Next.js component** (`app/page.tsx`) with significant performance debt:

- **68 useEffect hooks** and **100+ useState declarations** in a single component
- **100+ Lucide icon imports** (~50-80KB uncompressed)
- **No code splitting** — entire component loaded for every "route"
- **Heavy libraries loaded upfront**: Framer Motion (~100KB), Lottie (~80KB), Supabase, AI SDK
- **No React.memo** on any card component — every state change re-renders everything
- **Image optimization disabled** (`unoptimized: true` in next.config.ts)
- **Touch handlers use setState** causing 60 re-renders/sec during scroll

---

## 1. Monolithic Architecture (CRITICAL)

### Problem
All pages (bookshelf, feed, chat, account, following, book detail, trivia) live in one `App()` component. Any `setState` triggers a full re-render of everything, even though only one page is visible at a time.

### Current Structure
```
App() [~15,000 lines]
├── 100+ useState declarations (lines 470-884)
├── 68 useEffect hooks
└── All UI rendering
    ├── Book detail page (~2,300 lines)
    ├── Bookshelf covers (~470 lines)
    ├── Bookshelf spines (~465 lines)
    ├── Feed page (~700 lines)
    ├── Chat page (~1,000 lines)
    ├── Account page (~200 lines)
    ├── Following page (~120 lines)
    └── Trivia modal (~450 lines)
```

### Refactoring Strategy

**Phase 1 — Extract page components:**
Each page becomes its own file with its own state. Only shared state (books, user, activeBook) stays in App.

| Target Component | Lines to Extract | State Variables to Move |
|-----------------|-----------------|----------------------|
| `AccountPage` | 10151-10346 | grokUsageLogs, isProfilePublic, showDeleteConfirm |
| `FollowingPage` | 10347-10466 | followingUsers, followersCount |
| `FeedPage` | 10467-11176 | personalizedFeedItems, feedTypeFilter, feedPullDistance |
| `ChatPage` | 7379-8080 | chatList, characterChatList, chatPullDistance |
| `BookshelfCovers` | 11426-11899 | bookshelfGrouping, showAddBookTooltip |
| `BookshelfSpines` | 11900-12365 | (same grouping state) |
| `BookDetail` | 12366-13698 | insights, podcasts, videos, articles, relatedBooks |
| `TriviaGame` | 14353-14800 | triviaQuestions, currentTriviaIndex, triviaScore |
| `AddBookSheet` | 5002-5695 | searchQuery, searchResults, isSearching |

**Phase 2 — State management:**
Use React Context or Zustand for shared state (books, user, auth). Page-specific state stays local.

**Phase 3 — Code splitting:**
```typescript
const FeedPage = lazy(() => import('./components/FeedPage'));
const ChatPage = lazy(() => import('./components/ChatPage'));
const TriviaGame = lazy(() => import('./components/TriviaGame'));
const AddBookSheet = lazy(() => import('./components/AddBookSheet'));
```

---

## 2. Re-render Performance (CRITICAL)

### Touch Handlers Using setState
**Lines 6252-6306, 7390-7433** — Pull-to-refresh updates state on every pixel moved:
```typescript
onTouchMove={(e) => {
  const dist = Math.min(dy * 0.3, 40);
  setFeedPullDistance(dist);  // ← 60 setState calls/sec during touch
}}
```
**Fix:** Use `useRef` for pull distance, update DOM directly via ref.

### State Variables That Should Be Refs
| Variable | Change Frequency | Current | Should Be |
|----------|-----------------|---------|-----------|
| `feedPullDistance` | 60x/sec (touch) | useState | useRef |
| `chatPullDistance` | 60x/sec (touch) | useState | useRef |
| `scrollY` | 30x/sec (scroll) | useState | useRef |
| `touchStart`/`touchEnd` | Per touch event | useState | useRef |

### Components Not Memoized
Every card component re-renders on any parent state change:

| Component | File | Memoized? |
|-----------|------|-----------|
| InsightsCards | app/components/InsightsCards.tsx | No |
| PodcastEpisodes | app/components/PodcastEpisodes.tsx | No |
| YouTubeVideos | app/components/YouTubeVideos.tsx | No |
| AnalysisArticles | app/components/AnalysisArticles.tsx | No |
| RelatedBooks | app/components/RelatedBooks.tsx | No |
| RelatedMovies | app/components/RelatedMovies.tsx | No |
| RatingStars | app/components/RatingStars.tsx | No |
| HeartButton | app/components/HeartButton.tsx | No |
| SpotlightSection | app/page.tsx line 257 | **Yes** (only one) |

**Fix:** Wrap all with `React.memo()`. Also requires stabilizing props — currently `renderAction={() => {...}}` creates new function references every render, defeating memo.

### Inline Object/Callback Anti-patterns
Every card component has:
- `stackedCardStyle()` returning new objects per render
- `frostedGlassStyle` inline in JSX (should be module-level constant)
- `renderAction` callback recreated every render

**Fix:** Extract styles to constants, use `useCallback` for handlers.

### Missing useMemo
Only 1 `useMemo` found (feed filtering at line 7533). Missing for:
- Book grouping/sorting for bookshelf
- Chat context building (line 7446-7504 — sorts entire bookshelf every render)
- Computed book lists, filtered arrays

---

## 3. Bundle Size & Code Splitting (HIGH)

### Current Bundle Composition (Estimated)
| Library | Size (gzip) | Used Where | Lazy-loadable? |
|---------|------------|-----------|----------------|
| lucide-react (100+ icons) | 50-80KB | Everywhere | Partially |
| framer-motion | ~100KB | Animations | Yes (per page) |
| lottie-react | ~80KB | 4 animations | Yes |
| @supabase/supabase-js | ~40KB | Core | No |
| ai (Vercel AI SDK) | ~30KB | Chat only | Yes |
| html-to-image | ~30KB | Screenshot only | Yes |
| html2canvas | ~40KB | Screenshot only | Yes |
| @capacitor/* | ~50KB | Mobile only | Platform-conditional |

### No Dynamic Imports
Everything is statically imported. Modals, sheets, and page-specific components should be lazy-loaded:
```typescript
// Current
import AddBookSheet from './components/AddBookSheet';
import BookChat from './components/BookChat';

// Should be
const AddBookSheet = lazy(() => import('./components/AddBookSheet'));
const BookChat = lazy(() => import('./components/BookChat'));
```

### Image Optimization Disabled
`next.config.ts` line 17: `images: { unoptimized: true }`
- No responsive variants
- No lazy loading
- No AVIF/WebP conversion
- Full-res covers loaded immediately
- Bookshelf can have 50-100+ cover images loaded at once

---

## 4. API Call Patterns (MEDIUM-HIGH)

### Waterfall Requests
**Following page (lines 2014-2070):** Two sequential API calls that could be parallel:
```typescript
// Step 1: Get follow IDs
const { data: followsData } = await supabase.from('follows')...
// Step 2: Wait for step 1, then fetch users
const { data: usersData } = await supabase.from('users').in('id', followingIds)...
```

**Account page (lines 1957-2012):** Grok logs + privacy setting fetched sequentially.

### No Request Deduplication
If multiple components request data for the same book simultaneously (e.g., podcasts + videos + articles all fire on book select), each makes independent API calls. No in-flight request deduplication.

### Redundant Refetches
| Data | Trigger | Cached? | Issue |
|------|---------|---------|-------|
| Grok usage logs | Every account page open | No | Fetches every time |
| Privacy setting | Every account page open | No | Fetches every time |
| Following users | Every following page open | No | No change detection |
| Book readers | Every book detail view | Unclear | May duplicate for same book |

### Cache Key Mismatch
Services cache by `book_title + book_author` (normalized lowercase). If title/author has any variation, cache misses occur. Should use `canonical_book_id`.

### Hardcoded Delays
`podcast-service.ts` line 13: 2-second delay before every API call (purpose unclear, possibly rate limiting).

---

## 5. Memory Leaks (MEDIUM)

### Audio Leak in PodcastEpisodes
`PodcastEpisodes.tsx` creates `new Audio()` objects but never calls `stopAudio()` on unmount. Audio continues playing when navigating away.

### Unbounded Map Growth
State Maps grow without bound:
- `bookInfluences`, `didYouKnow`, `youtubeVideos`, `relatedBooks` — all accumulate entries
- No cleanup when a book is deleted
- User switching between 50 books = 50 entries per Map, never garbage collected

### localStorage Bloat
- `bookComparisonResults`: accumulates forever
- `bookMergeSortState`: never cleared
- No size management, no TTL
- Risk of hitting 5MB limit

### useImageBrightness Hook
`app/components/utils.ts` lines 46-88:
- Creates Image() + canvas for every image URL change
- Loops through pixel data calculating luminance
- Called in 4 components (PodcastEpisodes, YouTubeVideos, RelatedBooks, RelatedMovies)
- **No caching** — recalculates on every mount/re-render for the same URL

---

## 6. CSS Performance (MEDIUM)

### Backdrop Filter Overuse
Every frosted glass card uses `backdrop-filter: blur(9.4px)`. On a book detail page, there can be 5-10+ blurred elements visible simultaneously. On low-end mobile devices, this causes frame drops.

### Missing will-change
Animated elements (vinyl spin, book bounce, card transitions) lack `will-change: transform`, forcing CPU composition instead of GPU.

### Framer Motion During Scroll
AnimatePresence + motion.div used inside scrollable lists. During scroll, animation calculations add to main thread work.

---

## 7. Initial Load Critical Path

### Sequence
1. Load JS bundle (~300-500KB gzip estimated)
2. Hydrate — initialize 100+ useState hooks, read localStorage ~10-50ms
3. Auth check — 100-500ms network
4. Load books from Supabase — 100-300ms network
5. Fire 68 useEffect hooks (most are conditional, but all evaluated)
6. First render of bookshelf

**Estimated time to interactive:** 2-4 seconds on 4G

### Improvements
- Lazy-load non-critical pages (feed, chat, account, trivia)
- Defer non-essential useEffects
- Reduce initial useState count by extracting page state
- Use `startTransition` for non-urgent state updates

---

## 8. Specific Component Issues

### PodcastEpisodes
- Audio object not cleaned up on unmount (memory/battery leak)
- `useImageBrightness` recalculates on every mount
- 300ms setTimeout for navigation animation (could use AnimatePresence)

### RelatedMovies
- Vinyl spin animation runs indefinitely without `will-change`
- `dangerouslySetInnerHTML` with keyframe styles created on every render (line 420-425)
- Multiple frosted glass blur layers per card

### BookChat
- Chat context builds entire bookshelf list on every render (lines 7446-7504) — sorts all books, maps notes, ratings
- No memoization of context object
- Keyboard listeners potentially leak

### LoginScreen
- Three identical FastHeartAnimation Lottie components rendered (could use one + CSS positioning)

---

## Priority Roadmap

### Immediate (High Impact, Low Risk)
1. **Wrap all card components in React.memo** — prevents cascading re-renders
2. **Fix audio leak** — add cleanup in PodcastEpisodes useEffect
3. **Move pull-to-refresh to useRef** — eliminates 60 re-renders/sec
4. **Extract frosted glass styles to constants** — reduces object allocation
5. **Cache useImageBrightness by URL** — eliminate redundant canvas operations
6. **Parallelize waterfall API calls** — save 200-500ms per page

### Short-term (Refactoring Required)
7. **Extract page components** — AccountPage, FeedPage, ChatPage as separate files with own state
8. **Add code splitting** — lazy-load modals, sheets, chat, trivia
9. **Memoize expensive computations** — bookshelf grouping, chat context, feed filtering
10. **Implement request deduplication** — prevent simultaneous identical API calls
11. **Add `useCallback` for all handler props** — make React.memo effective

### Medium-term (Architecture Changes)
12. **State management** — Context API or Zustand for shared state, local state per page
13. **Enable Next.js image optimization** — responsive images, lazy loading, AVIF/WebP
14. **Cache invalidation with TTL** — replace naive localStorage caching
15. **Reduce useEffect count** — consolidate into service hooks, from 68 to ~15
16. **Audit Lottie/framer-motion usage** — lazy-load animation libraries per page

### Metrics to Track
- **Bundle size** (target: <200KB gzip initial)
- **Time to Interactive** (target: <2s on 4G)
- **Re-renders per interaction** (use React DevTools Profiler)
- **Memory growth** (Chrome DevTools heap snapshots over 10-min session)
- **Frame rate during scroll** (target: 60fps, measure on low-end device)
