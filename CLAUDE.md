# Book Review App - Claude Context Guide

This file helps Claude quickly locate code for common tasks.

## Architecture Overview

```
/app/page.tsx        → 15k lines, contains ALL web UI (monolithic)
/packages/core/      → Shared business logic (well-organized)
/mobile_app/         → React Native app (separate, route-based)
```

## Feature Map: `/app/page.tsx`

### Types & Interfaces
| What | Lines |
|------|-------|
| Types & Constants | 80-245 |
| PodcastEpisode, YouTubeVideo, RelatedBook | 95-160 |
| FeedItem, PersonalizedFeedItem | 162-193 |
| Book, BookWithRatings | 198-245 |

### API & Data Functions
| What | Lines |
|------|-------|
| API Helpers (fetch wrappers) | 246-400 |
| Grok AI Functions | 402-1019 |
| Discussion Questions generation | 1020-1394 |
| Feed generation & scoring | 1395-1838 |
| Apple Podcasts API | 1839-2058 |
| Google Scholar API | 2059-2281 |
| Related Books (Grok) | 2282-2434 |
| Book Research (Grok) | 2435-2583 |
| YouTube Data API | 2584-3080 |
| Apple Books API | 3081-3192 |
| Grok Book Search | 3193-3298 |
| Wikipedia/Wikidata Pipeline | 3299-3496 |
| Utilities (colors, converters) | 3497-3649 |

### UI Components (Inline)
| Component | Lines | Purpose |
|-----------|-------|---------|
| InsightsCards | 3650-3850 | Book insights display |
| AuthorFactsTooltips | 3851-3861 | Author facts UI |
| PodcastEpisodes | 3862-4191 | Podcast player & list |
| YouTubeVideos | 4192-4372 | YouTube embeds |
| AnalysisArticles | 4373-4528 | Scholar articles |
| RelatedBooks | 4529-4764 | Related book cards |
| ResearchSection | 4765-4951 | Deep research display |
| RatingStars | 4952-5001 | Star rating input |
| AddBookSheet | 5002-5695 | Add book modal (search, results) |

### Trivia Game
| What | Lines |
|------|-------|
| TriviaNote interface | 5696-5705 |
| collectTriviaNotes() | 5706-5842 |
| Trivia refresh callback | 5843-6091 |
| Trivia Game UI (in main render) | 14353-14800 |

### Main App Component
| What | Lines |
|------|-------|
| App() function start | 6092 |
| State declarations | 6092-6500 |
| useEffect hooks | 6500-8200 |
| Event handlers | 8200-9800 |
| Main render return | 9800-end |

### View Renders (in main return)
| View | Lines | Trigger State |
|------|-------|---------------|
| Header (all views) | 10015-10150 | always |
| Account Page | 10151-10346 | showAccountPage |
| Following Page | 10347-10466 | showFollowingPage |
| Feed Page | 10467-11176 | showFeedPage |
| Sorting Results | 11177-11288 | showSortingResults |
| Notes View | 11289-11425 | showNotesView |
| Bookshelf Covers | 11426-11899 | showBookshelfCovers |
| Bookshelf Spines | 11900-12365 | showBookshelf |
| Book Details | 12366-13698 | default (single book) |
| Bottom Navigation | 13699-13900 | always |
| Trivia Game Modal | 14353-14800 | isPlayingTrivia |
| About Screen Modal | 15083-end | showAboutScreen |

## Quick Reference by Task

### "Change how books look on the bookshelf"
- Covers view: lines 11426-11899
- Spines view: lines 11900-12365
- Grouping logic: lines 7689-7951

### "Change the book details page"
- Main book view: lines 12366-13698
- Insights cards: lines 3650-3850
- Podcasts section: lines 3862-4191
- YouTube section: lines 4192-4372
- Related books: lines 4529-4764

### "Change the feed"
- Feed page UI: lines 10467-11176
- Feed filters UI: lines 10500-10570
- Feed filter state: `feedFilter` (read status), `feedTypeFilter` (item type) around line 6250
- Filter logic: `filteredFeedItems` useMemo around line 7533
- Feed generation logic: lines 1395-1838
- Feed scoring: lines 1678-1838

### "Change trivia game"
- Game UI/modal: lines 14353-14800
- Question collection: lines 5706-5842
- Trivia types: lines 5696-5705

### "Change how books are added"
- AddBookSheet component: lines 5002-5695
- Wikipedia lookup: lines 3299-3496
- Apple Books search: lines 3081-3192
- Grok search: lines 3193-3298

### "Change ratings"
- RatingStars component: lines 4952-5001
- Rating dimensions constant: line 81

### "Change the about screen"
- About modal: lines 15083-end

## Shared Core (`/packages/core/src/`)

```
types/book.ts       → All TypeScript types
api/wikipedia.ts    → Wikipedia lookup
api/apple-books.ts  → iTunes search
api/grok.ts         → AI integrations
api/related-books.ts→ Related book generation
supabase/queries.ts → Database CRUD
supabase/feed.ts    → Feed logic (573 lines)
utils/prompts.ts    → LLM prompt templates
```

## Building for iOS/Capacitor

**IMPORTANT:** When building for iOS, you MUST use the `CAPACITOR=1` flag:

```bash
# Build for iOS (Capacitor)
CAPACITOR=1 npm run build && npx cap sync ios

# Build for GitHub Pages (production web)
npm run build
```

Without `CAPACITOR=1`, the build uses `basePath: '/book_review'` which breaks iOS because Capacitor serves from `capacitor://localhost` (root path).

**Full iOS rebuild workflow:**
```bash
cd /Users/yossi/Cursor/book_review
rm -rf .next out
CAPACITOR=1 npm run build
rm -rf ios/App/App/public
npx cap sync ios
# Then in Xcode: Product → Clean Build Folder (Shift+Cmd+K) and rebuild
```

## Design Guidelines

See `DESIGN_GUIDELINES.md` for:
- Glassmorphic styling
- Color palette
- Animation patterns
- Component specifications
