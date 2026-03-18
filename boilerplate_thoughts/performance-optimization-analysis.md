# Performance & Load Optimization Analysis

*Last updated: 2026-03-18*

## Executive Summary

The app is a **~12.9k-line monolithic Next.js component** (`app/page.tsx`) with significant performance debt:

- **56 useEffect hooks** and **170 useState declarations** in a single component
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
- **AccountPage extracted** — removed ~540 lines, 7 useState, 2 useEffect, 3 refs from page.tsx (with 19 component + 8 wiring tests)
- **FollowingPage extracted** — removed ~160 lines, 3 useState, 1 useEffect from page.tsx (with 7 component + 6 wiring tests). Added back-navigation support ('following' ViewOrigin).
- **Pull-to-refresh refactored** — converted feedPullDistance/chatPullDistance from useState to useRef with direct DOM manipulation, eliminating ~60 re-renders/sec during touch drag
- **Audio unmount leak fixed** — PodcastEpisodes now fully releases Audio resources on unmount (pause, clear src, load, null handlers)
- **Fan menu close/reopen bug fixed** — removed portal overlays from MusicModal/WatchModal that caused double-fire with X button
- **TriviaGame extracted** — removed ~740 lines, 17 useState, 7 useEffect, 4 useRef from page.tsx to `app/components/TriviaGame.tsx` (with 18 guard tests). Uses `forwardRef`+`useImperativeHandle` for back button integration.
- **Book detail callback stabilization completed** — card handlers (`renderAction`, `onPin`, `isPinned`) moved from inline JSX lambdas to stable callbacks via `useBookDetailCardCallbacks`, improving memo hit rate and reducing avoidable card re-renders.
- **Header scroll regression fixed** — removed conflicting forced Framer opacity animations on scroll-managed headers; ref-attach callbacks now apply current scroll opacity immediately on mount/rerender.
- **Chunk-load resilience added** — lazy imports now use retry-once reload behavior for chunk mismatch errors; webpack `chunkLoadTimeout` increased in dev to reduce false timeout failures for large chunks.
- **Pinned sticky-note icon parity improved** — pinned state now uses `currentColor` for both fill and outline (same yellow), with style + runtime regression tests.
- **Regression test coverage expanded** — added `useBookDetailCardCallbacks` runtime identity tests, sticky-note style/wiring tests, and additional page wiring guards.

---

## 1. Monolithic Architecture (CRITICAL)

### Problem
All pages (bookshelf, feed, chat, account, following, book detail, trivia, notes) live in one `App()` component. Any `setState` triggers a full re-render of everything, even though only one page is visible at a time.

### Current Structure
```
App() [~9,354 lines — down from ~12,913]
├── ~138 useState declarations (down from 170; 32 moved to useBookDetailData hook)
├── ~42 useEffect hooks (down from 56; 14 moved to useBookDetailData hook)
├── 1 useMemo hooks (down from 8; 7 moved to useBookDetailData hook)
├── 0 useCallback hooks
├── ~32 useRef hooks (down from 47; 15 moved to useBookDetailData hook)
└── All UI rendering
    ├── Account page → EXTRACTED to app/components/AccountPage.tsx (~520 lines)
    ├── Following page → EXTRACTED to app/components/FollowingPage.tsx (~190 lines)
    ├── Trivia game → EXTRACTED to app/components/TriviaGame.tsx (~780 lines)
    ├── Feed page → EXTRACTED to app/components/FeedPage.tsx (~1,520 lines)
    ├── Chat page → EXTRACTED to app/components/ChatPage.tsx (~970 lines)
    ├── Book detail DATA → EXTRACTED to app/hooks/useBookDetailData.ts (~1,784 lines)
    ├── Sorting results (~110 lines)
    ├── Notes view (~175 lines)
    ├── Bookshelf covers (~630 lines)
    ├── Bookshelf spines (~420 lines)
    ├── Book detail RENDER (~1,500 lines — still in page.tsx)
    ├── Bottom navigation (~750 lines)
    └── About screen (~16 lines)
```

### Refactoring Strategy

**Phase 1 — Extract page components:**
Each page becomes its own file with its own state. Only shared state (books, user, activeBook) stays in App.

| Target Component | Lines to Extract | State Variables to Move |
|-----------------|-----------------|----------------------|
| `AccountPage` | ~~5902-6325~~ | **DONE** — extracted to `app/components/AccountPage.tsx` |
| `FollowingPage` | ~~6326-6445~~ | **DONE** — extracted to `app/components/FollowingPage.tsx` |
| `FeedPage` | 6446-8411 | personalizedFeedItems, feedTypeFilter, feedPullDistance |
| `ChatPage` | 7610-8411 | chatList, characterChatList, chatPullDistance |
| `BookshelfCovers` | 8832-9460 | bookshelfGrouping, showAddBookTooltip |
| `BookshelfSpines` | 9461-9879 | (same grouping state) |
| `BookDetail` | 9880-11597 | insights, podcasts, videos, articles, relatedBooks |
| `TriviaGame` | ~~12472-12833~~ | **DONE** — extracted to `app/components/TriviaGame.tsx` |

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

### Touch Handlers Using setState — FIXED
Pull-to-refresh converted from useState to useRef with direct DOM manipulation:
- `feedPullDistance` — **FIXED** (useRef + `updateFeedPullDOM` helper)
- `chatPullDistance` — **FIXED** (useRef + `updateChatPullDOM` helper)

### State Variables That Should Be Refs
| Variable | Change Frequency | Current | Should Be |
|----------|-----------------|---------|-----------|
| `feedPullDistance` | 60x/sec (touch) | ~~useState~~ **useRef** | **DONE** |
| `chatPullDistance` | 60x/sec (touch) | ~~useState~~ **useRef** | **DONE** |
| `scrollY` | 30x/sec (scroll) | ~~useState~~ **useRef** | **DONE** — converted to useRef + direct DOM manipulation for header opacity/pointerEvents |
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
| HeartButton | app/components/HeartButton.tsx | **Yes** (React.memo) |
| BookSummary | app/components/BookSummary.tsx | No |
| NotesEditorOverlay | app/components/NotesEditorOverlay.tsx | No |
| SpotlightSection | app/page.tsx line 261 | **Yes** (only one) |

**Fix:** Wrap all with `React.memo()`. Requires stabilizing props first (see below).

### Inline Callback Anti-patterns (Blocks React.memo)
**Status:** Mostly fixed in the book-detail card path.
- `renderAction`, `onPin`, and `isPinned` for Insights/Podcasts/YouTube/Articles/Related Books/Related Movies now use stable callback references (hook-based).
- Remaining audit target: any non-book-detail surfaces still passing inline lambdas into memoized children.

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

### Dynamic Imports — DONE
7 components now lazy-loaded via `React.lazy()` + `Suspense`:
- `AccountPage`, `FollowingPage`, `FeedPage`, `ChatPage` (page components)
- `AddBookSheet`, `ConnectAccountModal`, `NotesEditorOverlay` (modals/sheets)

Lazy-loading resilience hardening:
- `lazyWithChunkRetry` wrapper added for lazy imports (retry-once via reload on chunk mismatch).
- webpack dev `chunkLoadTimeout` increased to reduce transient timeout failures during heavy rebuilds.

Remaining candidates for lazy loading:
- `TriviaGame` — uses `forwardRef`/`useImperativeHandle`, needs wrapper for lazy
- `BookChat` — loaded inside ChatPage (could lazy there)
- `OnboardingScreen` — only shown once

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

**Account page:** Grok logs + privacy setting fetched sequentially (now in AccountPage.tsx, isolated from main render).

### No Request Deduplication
If multiple components request data for the same book simultaneously (e.g., podcasts + videos + articles all fire on book select), each makes independent API calls. No in-flight request deduplication.

### Redundant Refetches
| Data | Trigger | Cached? | Issue |
|------|---------|---------|-------|
| Grok usage logs | Every account page open | No | Fetches every time (now scoped to AccountPage) |
| Privacy setting | Every account page open | No | Fetches every time (now scoped to AccountPage) |
| Following users | Every following page open | No | No change detection |
| Book readers | Every book detail view | Unclear | May duplicate for same book |

### Cache Key Mismatch
Services cache by `book_title + book_author` (normalized lowercase). If title/author has any variation, cache misses occur. Should use `canonical_book_id`.

### Proactive Messages on Resume
Proactive chat message generation now runs on app mount + resume (visibilitychange / Capacitor resume). This adds async work on every foreground event. Has dedup guards (`proactiveRunningRef`, `proactiveCheckedRef`) but still fires a Supabase query on every resume to check candidates.

---

## 5. Memory Leaks (MEDIUM)

### Audio Leak in PodcastEpisodes (Partially Fixed)
`PodcastEpisodes.tsx` calls `stopAudio()` when episode/book changes (via useEffect on `episodesKey`). ✅ FIXED — useEffect now has `return () => { stopAudio(); }` cleanup that runs on both dependency change and unmount. `stopAudio()` nullifies onended/onerror, pauses, clears src, and sets audioRef to null.

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
2. Hydrate — initialize 189 useState hooks, read localStorage ~10-50ms
3. Auth check — 100-500ms network
4. Load books from Supabase — 100-300ms network
5. Fire 63 useEffect hooks (most are conditional, but all evaluated)
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
- Audio cleanup on unmount is fixed (cleanup return calls `stopAudio()`).
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
- Wrapped in `React.memo`
- Book-detail path now passes stable `renderAction`, `onPin`, and `isPinned` callbacks
- Each has internal `touchStart`/`touchEnd` as useState (should be useRef)

### LoginScreen
- Three identical FastHeartAnimation Lottie components rendered (could use one + CSS positioning)

---

## Priority Roadmap

### Immediate (High Impact, Low Risk)
1. ~~**Wrap all card components in React.memo**~~ ✅ DONE — HeartButton, InsightsCards, PodcastEpisodes, YouTubeVideos, AnalysisArticles, RelatedMovies, RelatedBooks, RatingStars all wrapped in React.memo
2. ~~**Add `useCallback` for handleToggleHeart**~~ ✅ DONE — stable via useCallback + userHeartedRef pattern. HeartButton memo is the biggest win (each card renders multiple HeartButtons; only the affected one re-renders on heart change)
3. ~~**Fix `|| []` anti-pattern**~~ ✅ DONE — EMPTY_ARRAY constant for RelatedMovies/RelatedBooks props
4. ~~**Stabilize remaining inline callbacks**~~ ✅ DONE for book-detail sections via `useBookDetailCardCallbacks` + runtime identity tests. Follow-up: audit any remaining non-book-detail inline handler props.
5. ~~**Fix audio unmount leak**~~ ✅ ALREADY FIXED — useEffect cleanup calls stopAudio() on unmount
6. **Move pull-to-refresh to useRef** — eliminates 60 re-renders/sec ✅ FIXED
6. ~~**Cache useImageBrightness by URL**~~ ✅ DONE — module-level `brightnessCache` Map in utils.ts; skips canvas work for previously seen URLs, initializes state from cache
7. ~~**Reduce API call debounce delays**~~ ✅ DONE — Reduced staggered timeouts from 500-5000ms to 3-tier system: 300ms (above-fold: summary, facts, did-you-know), 600ms (mid-page: podcasts, articles, videos), 1000ms (below-fold: related books/movies, influences, context). Services already check Supabase cache first (~50ms), so long delays were unnecessary. Saves 1.5-4s on book page load.

### Short-term (Refactoring Required)
8. **Extract page components** — ~~AccountPage~~ ✓, ~~FollowingPage~~ ✓, ~~FeedPage~~ ✓, ~~ChatPage~~ ✓ as separate files with own state. ChatPage extraction removed ~800 lines. Remaining: BookshelfCovers, BookshelfSpines, BookDetail.
9. ~~**Add code splitting**~~ ✅ DONE — 7 components lazy-loaded via `React.lazy()` + `Suspense` (AccountPage, FollowingPage, FeedPage, ChatPage, AddBookSheet, ConnectAccountModal, NotesEditorOverlay)
10. **Memoize chat context building** — sorts entire bookshelf on every render
11. **Implement request deduplication** — prevent simultaneous identical API calls
12. **Extract frosted glass styles** — many already module-level constants, finish the rest

### Suggested Next Step (Highest ROI)
**Extract `BookDetailView` component** — the data layer is done (in `useBookDetailData` hook). Next: move the ~1,500-line render section + ~15 UI-only state variables (isEditing, showShareDialog, showBookMenu, notes, discussion, infographic, etc.) into `app/components/BookDetailView.tsx`. The hook is called inside the component. Props surface: ~20-25 items (shared state, navigation callbacks, heart/pin system, styles).

### Medium-term (Architecture Changes)
13. **State management** — Context API or Zustand for shared state, local state per page
14. **Enable Next.js image optimization** — responsive images, lazy loading, AVIF/WebP
15. **Cache invalidation with TTL** — replace naive localStorage caching
16. **Reduce useEffect count** — consolidate into service hooks, from 63 to ~15
17. **Audit Lottie/framer-motion usage** — lazy-load animation libraries per page

### Caching & Data Loading (NEW)

**Current state:** Only the books list uses client-side caching (localStorage stale-while-revalidate). Everything else hits Supabase on every load. Server-side DB cache tables never expire.

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 18 | **Cache feed items in localStorage** — same stale-while-revalidate pattern as books. Feed appears instantly, fresh data loads in background. | High | Low |
| 19 | **Cache chat list in localStorage** — every chat page open currently hits Supabase. Cache list, refresh on pull-to-refresh. | Medium | Low |
| 20 | **Add cache expiration to DB tables** — add `updated_at` column to all `*_cache` tables + TTL check (re-fetch if > 60-90 days). Prevents permanently stale podcast/article/insight data. | Medium | Medium |
| 21 | **Track feed generation completion** — add a `feed_generated_at` column to books or a separate tracking table. Skip `generateFeedItemsForBook()` (which queries ~10 cache tables) if feed was already generated for that book. | High | Medium |
| 22 | ~~**Request deduplication**~~ ✅ DONE — AbortController + `fetchingXxxForBooksRef` Sets + request tokens across all 9 book-detail effects. | Medium | Low |
| 23 | **Persist in-session Maps to localStorage** — podcasts, YouTube, articles, related books Maps are lost on refresh. Cache them keyed by book title+author for instant re-display. | Medium | Medium |

### Metrics to Track
- **Bundle size** (target: <200KB gzip initial)
- **Time to Interactive** (target: <2s on 4G)
- **Re-renders per interaction** (use React DevTools Profiler)
- **Memory growth** (Chrome DevTools heap snapshots over 10-min session)
- **Frame rate during scroll** (target: 60fps, measure on low-end device)

---

## 9. Component Extraction Process

*Lessons learned from AccountPage extraction (2026-03-17). Follow this checklist for every future extraction.*

### Extraction Checklist

#### Before Starting
1. **Inventory all symbols** — grep for every useState, useEffect, useRef, handler function, and JSX block that belongs to the target component. Include things that aren't in the main render block:
   - Modals/dialogs rendered elsewhere (e.g., delete confirmation dialog was at line 13098, far from the account page render at 5902)
   - Profile menu buttons or nav items that trigger the component's state
   - Other useEffects that read/write the component's state
2. **Map callback semantics** — for each callback prop the parent will pass, document what value/behavior the parent should provide. Don't assume the obvious (e.g., "connect account" should use `reason: 'account'`, not `'book_limit'`)
3. **Check for scroll/touch interactions** — if the component has touch handlers (drag, pull-to-refresh), verify they won't block parent scrolling after extraction
4. **Check filter parity** — if a child component filters its input (e.g., `movies.filter(m => m.type !== 'album' || m.itunes_url)`), any upstream code that pre-selects items from that data must apply the same filter. Otherwise items pass selection but render empty. Add a guard test for each such filter.

#### During Extraction
4. **Create component file** with own state, effects, refs
5. **Replace render block** in page.tsx with `<ComponentName ... />`
6. **Grep for every moved symbol** in page.tsx — do this BEFORE deleting anything:
   ```bash
   grep -n 'symbolName' app/page.tsx
   ```
   Every hit must be either removed (if moved to component) or updated (if it's a callsite that now uses a different API)
7. **Delete moved state/effects/refs** from page.tsx
8. **Clean up imports** — remove types and functions that are no longer used in page.tsx

#### After Extraction
9. **Type-check** — `npx tsc --noEmit`
10. **Run existing tests** — `npx vitest run`
11. **Manual smoke test** — open the app and test the happy path on the extracted page. This catches wiring bugs that unit tests miss (wrong callback args, scroll blocking, missing dialogs). ~30 seconds, catches the majority of extraction bugs.
12. **Write two layers of tests:**
    - **Component tests** (`tests/ComponentName.test.tsx`) — render in isolation, verify UI states, callback invocations, and regression guards
    - **Wiring tests** (`tests/page-wiring.test.ts`) — source-level checks that page.tsx doesn't contain orphaned state, passes correct prop values, and doesn't duplicate moved code

### Wiring Test Pattern

Wiring tests read page.tsx as a string and assert on patterns. They catch:
- Orphaned useState/useRef declarations (state moved to component but declaration left behind)
- Wrong callback argument values (e.g., `'book_limit'` instead of `'account'`)
- Orphaned imports (types/functions no longer used)
- Duplicated UI (dialog exists in both page.tsx and component)

```typescript
// Example: verify moved state is gone
const movedState = ['grokUsageLogs', 'isLoadingGrokLogs', ...];
for (const name of movedState) {
  expect(pageSource).not.toMatch(new RegExp(`\\[${name},\\s*set`));
}

// Example: verify correct prop value
const block = pageSource.slice(pageSource.indexOf('<AccountPage'), ...);
expect(block).toContain("'account'");
```

### Regression Guards

For each bug found during extraction, add a targeted test:

| Bug | Test |
|-----|------|
| Touch handlers blocked scroll | Assert no `touchAction: none` or `.cursor-grab` in rendered output |
| Wrong connect reason | Assert `<AccountPage` block contains `'account'`, not `'book_limit'` |
| Orphaned delete dialog | Assert page.tsx has zero occurrences of `"Delete Account?"` |
| Orphaned state | Assert page.tsx has no `useState` for moved variable names |
| Filter parity (spotlight empty item) | Assert spotlight candidate filters match child component filters (e.g., albums without `itunes_url` skipped in both useMemo and RelatedMovies) |
| Unstable shuffle order | Assert spotlight uses hash-based `.sort()` not Fisher-Yates (order must be stable when candidate count changes from background fetches) |
| Wiring tests read wrong file after hook extraction | When useMemos/effects move from page.tsx to a hook, update wiring tests to read the hook file. Pattern: add `bookDetailDataHookSource` alongside `pageSource` and update assertions. |
| EMPTY_ARRAY guard becomes redundant with memos | useMemo returning `[]` is already stable — `|| EMPTY_ARRAY` is redundant. Update tests when removing it. |

### Completed Extractions

| Component | Lines Removed | State Moved | Tests |
|-----------|--------------|-------------|-------|
| AccountPage | ~540 | 7 useState, 2 useEffect, 3 refs | 19 component + 8 wiring |
| FollowingPage | ~160 | 3 useState, 1 useEffect | 7 component + 6 wiring |
| TriviaGame | ~740 | 17 useState, 7 useEffect, 4 refs | 18 guard tests |
| FeedPage | ~1,400 | 20+ useState, 10+ useRef, modals, filters, pull-to-refresh | feed-bugs + pull-to-refresh tests |
| ChatPage | ~970 | orphanedChatBook, swipe/delete, pull-to-refresh, chat list rendering | chat-page-extraction tests |
| useBookDetailData (hook) | ~1,600 | 32 useState, 14 useEffect, 7 useMemo, 15 useRef | 7 wiring guard tests |

### Next Targets

| Component | Est. Lines | Key Risk |
|-----------|-----------|----------|
| BookDetail RENDER | ~1,500 | Data layer extracted to `useBookDetailData` hook. Remaining: move render JSX + book-detail-only UI state (isEditing, showShareDialog, notes, discussion, infographic, etc.) into `BookDetailView.tsx`. Props surface is ~20-25 items. |
| BookshelfCovers | ~630 | bookshelf grouping state shared with spines |
| BookshelfSpines | ~420 | same grouping state |

---

## 10. Progress Tracker

### Done
- [x] Extracted `AccountPage`, `FollowingPage`, `TriviaGame`, `FeedPage`, `ChatPage` from `app/page.tsx`
- [x] Added extraction wiring tests and regression guards in `tests/page-wiring.test.ts`
- [x] Converted pull-to-refresh high-frequency touch state to refs (feed + chat)
- [x] Stabilized book-detail card callbacks (`renderAction` / `onPin` / `isPinned`) via `useBookDetailCardCallbacks`
- [x] Added runtime callback identity tests (`tests/useBookDetailCardCallbacks.test.tsx`)
- [x] Fixed header reappearing regression by removing conflicting forced opacity animation on scroll-managed headers
- [x] Hardened lazy chunk loading with retry-once reload guard for lazy imports
- [x] Increased webpack client chunk load timeout in dev (`next.config.ts`)
- [x] Fixed sticky-note pinned icon styling to use same yellow for fill + outline across all card components
- [x] Added sticky-note style and click-contract tests (`tests/sticky-note-pin-style.test.tsx`)
- [x] Fixed `PodcastEpisodes` audio unmount cleanup and validated with focused tests
- [x] Cached `useImageBrightness` by URL
- [x] Reduced staged book-detail fetch delays (300ms / 600ms / 1000ms tiers)
- [x] **Request deduplication + cancellation for book-detail fetches** — all 9 effects have AbortController (cancel stale), `fetchingXxxForBooksRef` Set (prevent concurrent), and `beginBookRequest`/`isActiveBookRequest` token system (reject stale responses). Also added `signal` passthrough to podcast, avatar, summary, youtube, articles, related-books, and related-movies services.
- [x] **Extracted `useBookDetailData` hook** — moved 32 useState, 14 useEffect, 7 useMemo, 15 useRef from page.tsx into `app/hooks/useBookDetailData.ts` (1,784 lines). page.tsx reduced from 10,954 → 9,354 lines (-1,600). All data Maps, loading states, fetching effects, request token system, loading timeout safety net, spotlight memo, and feed generation trigger now live in the hook. Added 7 wiring guard tests.
- [x] **Fixed related books JSON parse error** — `related-books-service.ts` now handles malformed Grok JSON (trailing commas, smart quotes) instead of throwing. Returns `[]` on unrecoverable parse failure.
- [x] **Removed passive event listener warnings** — BookChat send button no longer calls `preventDefault()` inside passive touch listeners; `onClick` is sufficient.

### In Progress
- [ ] Keep monitoring chunk-load reliability after lazy retry + timeout hardening (especially during active dev rebuilds)
- [ ] Keep extraction guardrails/tests in lockstep as remaining monolith sections are split

### Next (priority order)
- [ ] **Extract `BookDetailView` component** — move the ~1,500-line render section + book-detail-only UI state into `app/components/BookDetailView.tsx`. Data layer is already in the hook.
- [ ] Extract `BookshelfCovers` and `BookshelfSpines` with shared grouping state strategy
- [ ] Memoize/optimize chat context building to avoid full bookshelf sorts each render
- [ ] Add feed local cache (stale-while-revalidate) similar to books cache
- [ ] Add chat list local cache + refresh strategy
- [ ] Add cache TTL/invalidation policy for DB cache tables
- [ ] Track feed generation completion (`feed_generated_at` or equivalent) to skip redundant generation
- [ ] Persist selected in-session maps where beneficial (podcasts/videos/articles/related data)
- [ ] Resolve metadata viewport warning by moving to dedicated viewport export in layout
