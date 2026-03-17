# Performance & Load Optimization Analysis

*Last updated: 2026-03-17*

## Executive Summary

The app is a **~14.3k-line monolithic Next.js component** (`app/page.tsx`) with significant performance debt:

- **66 useEffect hooks** and **199 useState declarations** in a single component
- **~105 Lucide icon imports** in page.tsx alone (~50-80KB uncompressed)
- **No code splitting** — entire component loaded for every "route"
- **Heavy libraries loaded upfront**: Framer Motion (~100KB), Lottie (~80KB), Supabase, AI SDK
- **No React.memo** on card components — every state change re-renders everything
- **Zero useCallback** — all handler props (renderAction, onPin, isPinned) recreate every render
- **Image optimization disabled** (`unoptimized: true` in next.config.ts)
- **Touch handlers use useState** causing 60 re-renders/sec during scroll

### Progress Since Initial Analysis
- Card components extracted to separate files (InsightsCards, PodcastEpisodes, etc.)
- useMemo count improved from 1 → 8 (feed filtering, bookshelf grouping, spotlight, podcast combine, section headers)
- SpotlightSection wrapped in React.memo (still the only memoized component in page.tsx)
- Audio stops on episode/book change (partial fix — still no unmount cleanup)

---

## 1. Monolithic Architecture (CRITICAL)

### Problem
All pages (bookshelf, feed, chat, account, following, book detail, trivia, notes) live in one `App()` component. Any `setState` triggers a full re-render of everything, even though only one page is visible at a time.

### Current Structure
```
App() [~14,350 lines]
├── 199 useState declarations (lines 508-799)
├── 66 useEffect hooks
├── 8 useMemo hooks
├── 0 useCallback hooks
└── All UI rendering
    ├── Account page (~420 lines, 5902-6325)
    ├── Following page (~120 lines, 6326-6445)
    ├── Feed page (~1,960 lines, 6446-8411)
    ├── Chat page (~800 lines, 7610-8411)
    ├── Sorting results (~110 lines, 8544-8655)
    ├── Notes view (~175 lines, 8656-8831)
    ├── Bookshelf covers (~630 lines, 8832-9460)
    ├── Bookshelf spines (~420 lines, 9461-9879)
    ├── Book detail page (~1,720 lines, 9880-11597)
    ├── Bottom navigation (~750 lines, 11722-12471)
    ├── Trivia modal (~360 lines, 12472-12833)
    └── About screen (~16 lines, 13920-13936)
```

### Refactoring Strategy

**Phase 1 — Extract page components:**
Each page becomes its own file with its own state. Only shared state (books, user, activeBook) stays in App.

| Target Component | Lines to Extract | State Variables to Move |
|-----------------|-----------------|----------------------|
| `AccountPage` | 5902-6325 | grokUsageLogs, isProfilePublic, showDeleteConfirm |
| `FollowingPage` | 6326-6445 | followingUsers, followersCount |
| `FeedPage` | 6446-8411 | personalizedFeedItems, feedTypeFilter, feedPullDistance |
| `ChatPage` | 7610-8411 | chatList, characterChatList, chatPullDistance |
| `BookshelfCovers` | 8832-9460 | bookshelfGrouping, showAddBookTooltip |
| `BookshelfSpines` | 9461-9879 | (same grouping state) |
| `BookDetail` | 9880-11597 | insights, podcasts, videos, articles, relatedBooks |
| `TriviaGame` | 12472-12833 | triviaQuestions, currentTriviaIndex, triviaScore |

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
Pull-to-refresh updates state on every pixel moved:
```typescript
onTouchMove={(e) => {
  const dist = Math.min(dy * 0.3, 40);
  setFeedPullDistance(dist);  // ← 60 setState calls/sec during touch
}}
```
- `feedPullDistance` at line 749 — still useState
- `chatPullDistance` at line 746 — still useState

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
| BookSummary | app/components/BookSummary.tsx | No |
| NotesEditorOverlay | app/components/NotesEditorOverlay.tsx | No |
| SpotlightSection | app/page.tsx line 261 | **Yes** (only one) |

**Fix:** Wrap all with `React.memo()`. Requires stabilizing props first (see below).

### Inline Callback Anti-patterns (Blocks React.memo)
Every card receives unstable props that change identity every render:
- `renderAction={() => <HeartButton ... />}` — new function every render
- `onPin={(idx) => { handlePinForLater(...) }}` — new function every render
- `isPinned={(idx) => { isContentPinned(...) }}` — new function every render

Even if components were wrapped in React.memo, these would defeat it. Must add `useCallback` for all handler props first.

### Inline Object Anti-patterns
- `stackedCardStyle()` in RelatedBooks/RelatedMovies returns new objects per render
- `frostedGlassStyle` defined inline in JSX across multiple components (already module-level constants in some)
- `glassmorphicStyle` computed in render at lines 5543-5590

**Fix:** Extract styles to module-level constants, use `useCallback` for handlers.

### useMemo Status (Improved)
Now 8 useMemo hooks (up from 1):
- Feed filtering (`filteredFeedItems`, line 2395)
- Podcast combining (`combinedPodcastEpisodes`, line 2419)
- Book page sections (`bookPageSectionsResolved`, line 2440)
- Spotlight recommendation (`spotlightRecommendation`, line 2507)
- List names (`allListNames`, line 2674)
- Bookshelf grouping (`groupedBooksForBookshelf`, line 2686)
- Current editing dimension (`currentEditingDimension`, line 2987)

Still missing for:
- Chat context building (sorts entire bookshelf every render)
- Various computed/filtered arrays

---

## 3. Bundle Size & Code Splitting (HIGH)

### Current Bundle Composition (Estimated)
| Library | Size (gzip) | Used Where | Lazy-loadable? |
|---------|------------|-----------|----------------|
| lucide-react (~105 icons in page.tsx) | 50-80KB | Everywhere | Partially |
| framer-motion | ~100KB | Animations | Yes (per page) |
| lottie-react | ~80KB | 4 animations | Yes |
| @supabase/supabase-js | ~40KB | Core | No |
| ai (Vercel AI SDK) | ~30KB | Chat only | Yes |
| html-to-image | ~30KB | Screenshot only | Yes |
| html2canvas | ~40KB | Screenshot only | Yes |
| @capacitor/* | ~50KB | Mobile only | Platform-conditional |

### No Dynamic Imports
Zero `lazy()` calls in the entire codebase. Everything is statically imported:
```typescript
// Current — all loaded upfront
import AddBookSheet from './components/AddBookSheet';
import BookChat from './components/BookChat';
import NotesEditorOverlay from './components/NotesEditorOverlay';

// Should be
const AddBookSheet = lazy(() => import('./components/AddBookSheet'));
const BookChat = lazy(() => import('./components/BookChat'));
const NotesEditorOverlay = lazy(() => import('./components/NotesEditorOverlay'));
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
**Following page:** Two sequential API calls that could be parallel:
```typescript
// Step 1: Get follow IDs
const { data: followsData } = await supabase.from('follows')...
// Step 2: Wait for step 1, then fetch users
const { data: usersData } = await supabase.from('users').in('id', followingIds)...
```

**Account page:** Grok logs + privacy setting fetched sequentially.

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

### Proactive Messages on Resume
Proactive chat message generation now runs on app mount + resume (visibilitychange / Capacitor resume). This adds async work on every foreground event. Has dedup guards (`proactiveRunningRef`, `proactiveCheckedRef`) but still fires a Supabase query on every resume to check candidates.

---

## 5. Memory Leaks (MEDIUM)

### Audio Leak in PodcastEpisodes (Partially Fixed)
`PodcastEpisodes.tsx` calls `stopAudio()` when episode/book changes (via useEffect on `episodesKey`). However, there is **no cleanup return** in the useEffect — if the component unmounts entirely (e.g., navigating away from book detail), the Audio object is not cleaned up. Audio may continue playing.

### Unbounded Map Growth
State Maps grow without bound:
- `podcastEpisodes`, `didYouKnow`, `youtubeVideos`, `relatedBooks`, `relatedMovies`, `analysisArticles` — all accumulate entries
- `heartCounts`, `userHearted` — grow with each book viewed
- No cleanup when a book is deleted
- User switching between 50 books = 50 entries per Map, never garbage collected

### localStorage Bloat
- `bookComparisonResults`: accumulates forever
- `bookMergeSortState`: never cleared
- No size management, no TTL
- Risk of hitting 5MB limit

### useImageBrightness Hook
`app/components/utils.ts` line 46:
- Creates Image() + canvas for every image URL change
- Loops through pixel data calculating luminance
- Called in 4 components (PodcastEpisodes, YouTubeVideos, RelatedBooks, RelatedMovies)
- **No caching** — recalculates on every mount for the same URL

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
2. Hydrate — initialize 199 useState hooks, read localStorage ~10-50ms
3. Auth check — 100-500ms network
4. Load books from Supabase — 100-300ms network
5. Fire 66 useEffect hooks (most are conditional, but all evaluated)
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
- Audio stops on episode change but **not on component unmount** (no cleanup return in useEffect)
- `useImageBrightness` recalculates on every mount — no URL cache
- 300ms setTimeout for navigation animation (could use AnimatePresence)

### RelatedMovies
- Vinyl spin animation runs indefinitely without `will-change`
- `dangerouslySetInnerHTML` with keyframe styles created on every render
- Multiple frosted glass blur layers per card

### BookChat
- Chat context builds entire bookshelf list on every render — sorts all books, maps notes, ratings
- No memoization of context object
- Keyboard listeners potentially leak

### All Card Components (InsightsCards, PodcastEpisodes, YouTubeVideos, AnalysisArticles, RelatedBooks, RelatedMovies)
- Receive `renderAction`, `onPin`, `isPinned` as inline arrow functions from page.tsx — new references every render
- None wrapped in React.memo
- Each has internal `touchStart`/`touchEnd` as useState (should be useRef)

### LoginScreen
- Three identical FastHeartAnimation Lottie components rendered (could use one + CSS positioning)

---

## Priority Roadmap

### Immediate (High Impact, Low Risk)
1. ~~**Wrap all card components in React.memo**~~ → Blocked by #2
2. **Add `useCallback` for all handler props** (renderAction, onPin, isPinned) — prerequisite for React.memo to be effective
3. **Then wrap card components in React.memo** — prevents cascading re-renders
4. **Fix audio unmount leak** — add cleanup return in PodcastEpisodes useEffect
5. **Move pull-to-refresh to useRef** — eliminates 60 re-renders/sec
6. **Cache useImageBrightness by URL** — eliminate redundant canvas operations (module-level Map cache)
7. **Parallelize waterfall API calls** — save 200-500ms per page

### Short-term (Refactoring Required)
8. **Extract page components** — AccountPage, FeedPage, ChatPage as separate files with own state
9. **Add code splitting** — lazy-load modals, sheets, chat, trivia
10. **Memoize chat context building** — sorts entire bookshelf on every render
11. **Implement request deduplication** — prevent simultaneous identical API calls
12. **Extract frosted glass styles** — many already module-level constants, finish the rest

### Medium-term (Architecture Changes)
13. **State management** — Context API or Zustand for shared state, local state per page
14. **Enable Next.js image optimization** — responsive images, lazy loading, AVIF/WebP
15. **Cache invalidation with TTL** — replace naive localStorage caching
16. **Reduce useEffect count** — consolidate into service hooks, from 66 to ~15
17. **Audit Lottie/framer-motion usage** — lazy-load animation libraries per page

### Metrics to Track
- **Bundle size** (target: <200KB gzip initial)
- **Time to Interactive** (target: <2s on 4G)
- **Re-renders per interaction** (use React DevTools Profiler)
- **Memory growth** (Chrome DevTools heap snapshots over 10-min session)
- **Frame rate during scroll** (target: 60fps, measure on low-end device)
