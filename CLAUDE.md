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

## Feature Flags

Feature flags are configured in `/lib/feature-flags.ts`.

| Flag | Default | Description |
|------|---------|-------------|
| `hand_drawn_icons` | `false` | When `true`, uses hand-drawn SVG icons from `/public/`. When `false`, uses Lucide icons. |
| `info_page_variant` | `'c'` | Info page variant: 'a' = animated icons, 'b' = rotating tooltips, 'c' = 3-page stepper |

### Insights Feature Flags

Controls which insight types are fetched, displayed on book page, and added to feed.

| Flag | Default | Description |
|------|---------|-------------|
| `insights.author_facts` | `false` | Author trivia facts (appears as "Trivia" category) |
| `insights.book_influences` | `false` | Literary influences on the book |
| `insights.book_domain` | `false` | Domain/subject matter insights (appears as "Insights" in feed) |
| `insights.book_context` | `false` | Historical/cultural context |
| `insights.did_you_know` | `true` | "Did you know?" insights |

When an insight flag is `false`:
- The API call to fetch that insight type is skipped
- The insight category doesn't appear in the book page UI
- Feed items of that type are not generated
- The feed filter dropdown hides that type

### Book Page Section Headers

Controls visibility of section header menus on the book details page. When `true`, the header is hidden.

| Flag | Default | Description |
|------|---------|-------------|
| `bookPageSectionHeaders.insights` | `true` | Hide the "INSIGHTS: / category" header menu |
| `bookPageSectionHeaders.podcasts` | `false` | Hide the "PODCASTS:" header |
| `bookPageSectionHeaders.youtube` | `false` | Hide the YouTube videos header |
| `bookPageSectionHeaders.articles` | `false` | Hide the articles header |
| `bookPageSectionHeaders.relatedBooks` | `false` | Hide the related books header |

### Icon Mapping (hand_drawn_icons)

| Hand-drawn SVG | Lucide Icon | Used in |
|----------------|-------------|---------|
| `/public/library.svg` | `Library` | Header, bottom nav (bookshelf) |
| `/public/Trophy.svg` | `Trophy` | Bottom nav (trivia) |
| `/public/shield.svg` | `ShieldUser` | Bottom nav (clubs) |
| `/public/feed.svg` | `Rss` | Header, bottom nav (feed) |
| `/public/search.svg` | `Search` | AddBookSheet, feed drilldown, bottom nav |

## Database Migrations

**Location:** `/migrations/` (root level, NOT in `/supabase/migrations/`)

Migrations are SQL files run manually in Supabase SQL Editor. Naming convention: `add_<feature>.sql`

## Adding/Modifying Feed Items

The feed system generates content cards from cached book data. Here's how to add a new feed item type:

### Architecture Overview

```
Cache Tables (Supabase)          →  generateFeedItemsForBook()  →  feed_items table  →  Feed UI
- author_facts_cache                 Reads from cache tables        Stores items         Renders cards
- book_context_cache                 Creates feed items             with type, content   based on type
- did_you_know_cache                 Upserts to feed_items
- etc.
```

### Steps to Add a New Feed Item Type

**1. Update TypeScript types** (`app/page.tsx`):
```typescript
// Add to FeedItemType union (~line 1602)
type FeedItemType = '...' | 'your_new_type';

// Add to PersonalizedFeedItem interface (~line 225)
type: '...' | 'your_new_type';

// Add to feedTypeFilter state type (~line 6708)
const [feedTypeFilter, setFeedTypeFilter] = useState<'all' | '...' | 'your_new_type'>('all');
```

**2. Add cache table query** in `generateFeedItemsForBook()` (~line 1730):
```typescript
const [
  // ... existing queries
  yourNewData,
] = await Promise.all([
  // ... existing queries
  supabase.from('your_cache_table').select('data').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
]);
```

**3. Process and insert feed items** (~line 1815):
```typescript
const yourItems = yourNewData.data?.items;
if (yourItems && Array.isArray(yourItems)) {
  for (const item of yourItems) {
    if (await insertFeedItem('your_new_type', { item })) created++;
  }
}
```

**4. Add query in `getPersonalizedFeed()`** (~line 1840):
```typescript
supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'your_new_type').order('created_at', { ascending: false }).limit(POOL_SIZE),
```

**5. Add to filter dropdown** (~line 11280):
```typescript
{ value: 'your_new_type', label: 'Your Label' },
```

**6. Add UI rendering** in the feed switch statement (~line 11428):
```typescript
case 'your_new_type':
  return (
    <motion.div key={item.id} ...>
      {/* Your card UI */}
    </motion.div>
  );
```

**7. Create Supabase migration** (`/migrations/add_your_type.sql`):
- Create cache table if needed
- Add RLS policies
- If `feed_items.type` is an enum, add the new value

### Common Pitfalls

1. **Title/Author Mismatch**: Cache tables store normalized titles (`toLowerCase().trim()`). Ensure consistency between save and query operations.

2. **Duplicate Prevention**: The `insertFeedItem()` uses `upsert` with `onConflict: 'user_id,type,content_hash'` and `ignoreDuplicates: true`. Don't add skip logic that prevents new types from being added to existing books.

3. **CHECK Constraint on type column**: The `feed_items.type` column has a CHECK constraint limiting allowed values. You MUST update it when adding new types:
   ```sql
   -- Check existing constraint
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'feed_items'::regclass AND contype = 'c';

   -- Drop and recreate with new type
   ALTER TABLE feed_items DROP CONSTRAINT feed_items_type_check;
   ALTER TABLE feed_items ADD CONSTRAINT feed_items_type_check
   CHECK (type = ANY (ARRAY['fact'::text, 'context'::text, 'drilldown'::text, 'influence'::text, 'podcast'::text, 'article'::text, 'related_book'::text, 'video'::text, 'friend_book'::text, 'your_new_type'::text]));
   ```

4. **State for Interactive Cards**: If your card needs local state (like pagination), add a Map at component level:
   ```typescript
   const [yourStateMap, setYourStateMap] = useState<Map<string, number>>(new Map());
   ```
   Don't use `useState` inside the switch case.

5. **RLS Policies**: New cache tables need Row Level Security policies for read/insert/update.

### Key Files & Locations

| What | Location |
|------|----------|
| FeedItemType union | `app/page.tsx` ~line 1602 |
| PersonalizedFeedItem interface | `app/page.tsx` ~line 218 |
| generateFeedItemsForBook() | `app/page.tsx` ~line 1666 |
| getPersonalizedFeed() | `app/page.tsx` ~line 1840 |
| Feed filter dropdown | `app/page.tsx` ~line 11269 |
| Feed card rendering (switch) | `app/page.tsx` ~line 11428 |
| feedTypeFilter state | `app/page.tsx` ~line 6708 |

## Deployment & Store Listings

### Web (GitHub Pages)
- **URL:** https://yossisadoun.github.io/book_review/
- **Privacy Policy:** https://yossisadoun.github.io/book_review/privacy/
- **Support Email:** yossi.sadoun@gmail.com

### iOS (App Store)
- **Bundle ID:** `com.bookreview.app`
- **App Name:** BOOK

### Android (Google Play)
- **Application ID:** `com.bookreview.app`
- **Keystore:** `android/book-review-release.keystore`
- **Keystore Properties:** `android/keystore.properties`
- **Build AAB:** `cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew bundleRelease`
- **Output:** `android/app/build/outputs/bundle/release/app-release.aab`

## Design Guidelines

See `DESIGN_GUIDELINES.md` for:
- Glassmorphic styling
- Color palette
- Animation patterns
- Component specifications
