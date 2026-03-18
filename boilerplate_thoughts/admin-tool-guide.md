# BOOK Admin Tool — Scaffolding & Integration Guide

This document provides everything needed to build an admin tool for the BOOK app as a separate project. It covers the database schema, API patterns, service architecture, and step-by-step instructions for reusing the existing infrastructure.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Supabase Connection](#2-supabase-connection)
3. [Books Table Schema](#3-books-table-schema)
4. [Cache Tables — Complete Reference](#4-cache-tables--complete-reference)
5. [Feed Items Table & Generation Pipeline](#5-feed-items-table--generation-pipeline)
6. [External APIs — Complete Reference](#6-external-apis--complete-reference)
7. [Prompt System](#7-prompt-system)
8. [Service Architecture — What to Reuse](#8-service-architecture--what-to-reuse)
9. [Environment Variables](#9-environment-variables)
10. [Bulk Add Books via CSV — Implementation Guide](#10-bulk-add-books-via-csv--implementation-guide)
11. [Selective Cache Population — Implementation Guide](#11-selective-cache-population--implementation-guide)
12. [Scaffolding Steps](#12-scaffolding-steps)
13. [Key Patterns & Gotchas](#13-key-patterns--gotchas)

---

## 1. Project Overview

The BOOK app is a Next.js + Capacitor book tracking app backed by Supabase. Content enrichment (insights, podcasts, videos, summaries, etc.) is fetched from external APIs (primarily Grok/xAI) and cached in Supabase tables. A feed system generates personalized content cards from these caches.

**Admin tool goals:**
- Bulk add books (CSV upload) for any user
- Selectively populate cache tables (choose which content types to generate)
- Monitor cache coverage and API usage
- Manage prompt versions for AI-generated content

**Recommended stack:** Node.js CLI tool (with `tsx` for TypeScript) or a lightweight web app (Next.js or Vite). CLI is simpler and sufficient for admin operations.

---

## 2. Supabase Connection

```typescript
import { createClient } from '@supabase/supabase-js';

// Use the SERVICE ROLE key for admin operations (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

The main app uses the anon key with RLS. The admin tool should use the **service role key** to bypass row-level security for bulk operations.

**Supabase project:** Same project as the main app. No separate database needed.

---

## 3. Books Table Schema

```sql
books
├── id                    uuid (PK, auto-generated)
├── user_id               uuid (FK → auth.users)
├── canonical_book_id     text        -- "title|author" normalized (lowercase, trimmed)
├── title                 text
├── author                text
├── cover_url             text
├── wikipedia_url         text
├── google_books_url      text
├── summary               text        -- short description from search
├── publish_year          int
├── first_issue_year      int
├── genre                 text
├── isbn                  text
├── apple_rating          float
├── apple_rating_count    int
├── reading_status        text        -- 'read_it' | 'reading' | 'want_to_read' | null
├── rating_writing        int         -- 1-5, nullable
├── rating_insights       int
├── rating_flow           int
├── rating_world          int
├── rating_characters     int
├── author_facts          jsonb       -- legacy, now in cache table
├── podcast_episodes_grok jsonb       -- legacy, now in cache table
├── podcast_episodes_apple jsonb      -- legacy, now in cache table
├── podcast_episodes_curated jsonb    -- legacy, now in cache table
├── notes                 text
├── lists                 text[]      -- custom user-defined lists
├── created_at            timestamptz
├── updated_at            timestamptz
```

**Canonical Book ID format:** `"the great gatsby|f. scott fitzgerald"` (both sides lowercased and trimmed, joined by `|`).

**Important:** The `canonical_book_id` is the cross-user deduplication key. Cache tables use `book_title + book_author` (normalized separately) instead.

---

## 4. Cache Tables — Complete Reference

All cache tables are **shared across all users** (not user-specific). They're keyed by normalized `book_title` + `book_author` (both `toLowerCase().trim()`).

### 4.1 book_summary_cache

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| book_title | text | Normalized |
| book_author | text | Normalized |
| summary_data | jsonb | Full summary object |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Unique constraint:** `(book_title, book_author)`

**summary_data structure:**
```json
{
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "readTime": "5 min",
  "category": "Fiction",
  "gradient": "from-indigo-500 to-purple-500",
  "quote": "So we beat on...",
  "summary": "Full summary text...",
  "cardsTitle": "Key Ideas",
  "cards": [
    { "step": "1", "name": "The American Dream", "iconName": "Lightbulb", "desc": "..." }
  ],
  "actionTitle": "Action Plan",
  "tasks": [{ "text": "..." }],
  "glossaryTitle": "Glossary",
  "glossary": [{ "term": "Green Light", "def": "..." }]
}
```

**Service:** `app/services/book-summary-service.ts` → `getBookSummary(title, author)`
**API:** Grok (`grok-4-1-fast-non-reasoning`, JSON mode, temperature 0.7)

---

### 4.2 author_facts_cache

| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| author_facts | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Unique constraint:** `(book_title, book_author)`

**author_facts structure:** Array of fact strings or objects

**Service:** `app/services/insights-service.ts` → `getAuthorFacts(title, author)`
**API:** Grok
**Feed type:** `'fact'`

---

### 4.3 book_context_cache

| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| context_insights | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Unique constraint:** `(book_title, book_author)`
**Service:** `app/services/insights-service.ts` → `getBookContext(title, author)`
**API:** Grok
**Feed type:** `'context'`

---

### 4.4 book_domain_cache

| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| domain_label | text |
| domain_insights | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Unique constraint:** `(book_title, book_author)`
**Service:** `app/services/insights-service.ts` → `getBookDomain(title, author)`
**API:** Grok
**Feed type:** `'drilldown'`

---

### 4.5 book_influences_cache

| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| influences | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Unique constraint:** `(book_title, book_author)`
**Service:** `app/services/insights-service.ts` → `getBookInfluences(title, author)`
**API:** Grok
**Feed type:** `'influence'`

---

### 4.6 did_you_know_cache

| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| insights | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Unique constraint:** `(book_title, book_author)`

**insights structure:** Array of `{ rank: number, notes: [string, string, string] }`

**Service:** `app/services/insights-service.ts` → `getDidYouKnow(title, author)`
**API:** Grok
**Feed type:** `'did_you_know'`

---

### 4.7 podcast_episodes_cache

| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| podcast_episodes_curated | jsonb |
| podcast_episodes_apple | jsonb |
| podcast_episodes_spotify | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Unique constraint:** `(book_title, book_author)`
**Service:** `app/services/podcast-service.ts` → `getPodcastEpisodes(title, author)`
**APIs:** iTunes Search API (Apple Podcasts), Grok (curated), Spotify (via Odesli)
**Feed type:** `'podcast'`

---

### 4.8 trivia_questions_cache

| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| questions | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Index (not unique):** `(book_title, book_author)` — allows multiple rows per book (question sets)

**questions structure:** Array of `{ question, correct_answer, wrong_answers: string[], source, source_detail }`

**Service:** `app/services/trivia-service.ts`
**API:** Grok

---

### 4.9 discussion_questions_cache

| Column | Type |
|--------|------|
| id | uuid |
| canonical_book_id | text |
| book_title | text |
| book_author | text |
| questions | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Unique constraint:** `canonical_book_id` (note: uses canonical ID, not title+author)

**questions structure:** Array of `{ id, question, category }`

**Service:** `app/services/discussion-service.ts`
**API:** Grok

---

### 4.10 character_avatars_cache

| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| avatars | jsonb |
| contexts | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Unique constraint:** `(book_title, book_author)`

**avatars structure:** Array of character avatar objects with Replicate image URLs
**contexts structure:** `{ [characterName]: { role, personality, relationships, ... } }`

**Service:** `app/services/character-avatars-service.ts`
**APIs:** Grok (character prompts) + Replicate (image generation via flux-2-klein-4b)

---

### 4.11 Content Tables (non-cache naming)

These follow the same pattern but aren't named `*_cache`:

#### youtube_videos
| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| videos | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Service:** `app/services/youtube-service.ts`
**API:** YouTube Data API v3
**Feed type:** `'video'`

#### related_books
| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| related_books | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Service:** `app/services/related-books-service.ts`
**API:** Grok
**Feed type:** `'related_book'`

#### google_scholar_articles
| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| articles | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Service:** `app/services/articles-service.ts`
**API:** Google Scholar (via CORS proxies on web)
**Feed type:** `'article'`

#### related_movies
| Column | Type |
|--------|------|
| id | uuid |
| book_title | text |
| book_author | text |
| related_movies | jsonb |
| created_at | timestamptz |
| updated_at | timestamptz |

**Service:** `app/services/related-movies-service.ts`
**API:** TMDB + Odesli
**Feed type:** `'related_work'`

---

## 5. Feed Items Table & Generation Pipeline

### feed_items table

```sql
feed_items
├── id                      uuid (PK)
├── user_id                 uuid (FK → auth.users, CASCADE delete)
├── source_book_id          uuid (FK → books, CASCADE delete)
├── source_book_title       text    -- denormalized
├── source_book_author      text    -- denormalized
├── source_book_cover_url   text    -- denormalized
├── type                    text    -- CHECK constraint (see below)
├── content                 jsonb   -- type-specific payload
├── content_hash            text    -- djb2 hash for deduplication
├── reading_status          text    -- synced from books table via trigger
├── base_score              float   -- default 1.0
├── times_shown             int     -- default 0
├── last_shown_at           timestamptz
├── created_at              timestamptz
├── source_book_created_at  timestamptz
```

**Unique index:** `(user_id, type, content_hash)` — prevents duplicate content per user

**Type CHECK constraint values:**
`'fact'`, `'context'`, `'drilldown'`, `'influence'`, `'podcast'`, `'article'`, `'related_book'`, `'video'`, `'friend_book'`, `'did_you_know'`, `'related_work'`

**Triggers:**
1. `sync_feed_items_on_book_update` — auto-syncs `reading_status` when book status changes
2. `delete_feed_items_on_book_delete` — auto-deletes feed items when book is deleted

### Content Hash Algorithm (djb2)

```typescript
function generateFeedContentHash(type: string, content: any): string {
  const str = JSON.stringify({ type, content });
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
```

### Feed Generation Flow

`generateFeedItemsForBook(userId, bookId, bookTitle, bookAuthor, coverUrl, readingStatus, createdAt)`:

1. Verify book still exists in DB
2. Fetch all 10 cache tables in parallel (using normalized title/author)
3. For each cached content item, build a feed_item with computed content_hash
4. Upsert with `onConflict: 'user_id,type,content_hash'` and `ignoreDuplicates: true`

**Service:** `app/services/feed-service.ts`

---

## 6. External APIs — Complete Reference

### 6.1 Grok (xAI) — Primary AI

**Endpoint:** `https://api.x.ai/v1/chat/completions`
**Auth:** `Authorization: Bearer ${GROK_API_KEY}`
**Method:** POST

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "model": "grok-4-1-fast-non-reasoning",
  "stream": false,
  "temperature": 0.5-0.7,
  "response_format": { "type": "json_object" }
}
```

**Response:** `data.choices[0].message.content` (JSON string to parse)

**Used by:** Summaries, insights (5 types), related books, podcasts (curated), trivia, discussion questions, character prompts, research

**Web routing:** On web browsers, Grok calls route through a Supabase Edge Function proxy at `${SUPABASE_URL}/functions/v1/grok-proxy` to avoid CORS. The admin tool (Node.js) calls xAI directly — no proxy needed.

**Responses endpoint** (web search): `https://api.x.ai/v1/responses` — same auth, adds `tools: [{ type: "web_search", enabled: true }]`

### 6.2 YouTube Data API v3

**Search:** `GET https://www.googleapis.com/youtube/v3/search?part=snippet&q={query}&type=video&maxResults=5&key={key}`
**Duration:** `GET https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id={ids}&key={key}`
**Auth:** API key in query param

### 6.3 iTunes Search API (Apple)

**Endpoint:** `GET https://itunes.apple.com/search?term={query}&country=us&media=ebook&limit=10`
**Auth:** None (public)
**Used for:** Book search, Apple Podcasts lookup

**Podcast search:** `GET https://itunes.apple.com/search?term={query}&country=us&media=podcast&limit=5`

### 6.4 Wikipedia / Wikidata

**Search:** `GET https://{lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srsearch={query}`
**Summary:** `GET https://{lang}.wikipedia.org/api/rest_v1/page/summary/{pageTitle}`
**Wikidata:** `GET https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids={qid}&props=claims|labels`
**Auth:** None (public)
**Used for:** Book metadata enrichment (author, year, genre, ISBN)

### 6.5 TMDB (Movies/TV)

**Search:** `GET https://api.themoviedb.org/3/search/{movie|tv}?query={query}&language=en-US`
**Providers:** `GET https://api.themoviedb.org/3/{movie|tv}/{id}/watch/providers`
**Auth:** `Authorization: Bearer ${TMDB_ACCESS_TOKEN}`

### 6.6 Replicate (Image Generation)

**Create:** `POST https://api.replicate.com/v1/models/black-forest-labs/flux-2-klein-4b/predictions`
**Poll:** `GET https://api.replicate.com/v1/predictions/{id}`
**Auth:** `Authorization: Bearer ${REPLICATE_API_KEY}`
**Used for:** Character avatar image generation

**Web routing:** Routes through `${SUPABASE_URL}/functions/v1/replicate-proxy` on web. Admin tool calls directly.

### 6.7 Odesli (song.link)

**Endpoint:** `GET https://api.song.link/v1-alpha.1/links?url={itunesUrl}&userCountry=US`
**Auth:** None (public)
**Used for:** Converting iTunes URLs to universal streaming links (Spotify, Apple Music, etc.)

---

## 7. Prompt System

Prompts are stored in `/public/prompts.yaml` and loaded at runtime.

**Loading:** `loadPrompts()` from `lib/prompts.ts` — fetches the YAML file, parses it, caches in memory.

**Format:** Each prompt has a key and a template string with `{bookTitle}` and `{author}` placeholders:
```yaml
book_summary:
  prompt: |
    Generate a comprehensive summary for "{bookTitle}" by {author}...
```

**Available prompt keys:**
`book_suggestions`, `book_search`, `author_facts`, `book_influences`, `book_domain`, `book_context`, `podcast_episodes`, `related_books`, `related_movies`, `book_research`, `first_issue_year`, `trivia_questions`, `did_you_know`, `discussion_questions`, `book_infographic`, `book_summary`

**For the admin tool:** Copy `prompts.yaml` to your project or load it from the main app's public directory. Use `formatPrompt(template, { bookTitle, author })` to substitute placeholders.

```typescript
function formatPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || '');
}
```

---

## 8. Service Architecture — What to Reuse

The main app's services live in `app/services/*.ts`. They have browser dependencies (`localStorage`, `DOMParser`, `navigator`) and Next.js imports (`@/lib/*`). They **cannot be imported directly** into a Node.js admin tool.

### Strategy: Extract the API logic, skip the browser plumbing

Each service follows this pattern:
1. Check Supabase cache → return if found
2. Call external API (Grok, YouTube, etc.)
3. Parse response
4. Save to Supabase cache
5. Return result

**For the admin tool, you need:**
- The Supabase queries (table names, column names, key columns)
- The API call logic (endpoint, auth, request body, response parsing)
- The prompt templates

**You do NOT need:**
- localStorage caching
- AbortController/signal handling
- CORS proxy routing (Node.js has no CORS)
- React state management
- Platform detection (always "server")

### Services to port (by priority)

| Service | Cache Table | External API | Complexity |
|---------|-------------|-------------|------------|
| `book-summary-service.ts` | book_summary_cache | Grok | Low |
| `insights-service.ts` | 5 cache tables | Grok | Medium (5 prompts) |
| `podcast-service.ts` | podcast_episodes_cache | Grok + iTunes | Medium |
| `youtube-service.ts` | youtube_videos | YouTube API | Low |
| `related-books-service.ts` | related_books | Grok | Low |
| `related-movies-service.ts` | related_movies | TMDB + Odesli | Medium |
| `articles-service.ts` | google_scholar_articles | Google Scholar | Low (CORS-free in Node) |
| `trivia-service.ts` | trivia_questions_cache | Grok | Low |
| `discussion-service.ts` | discussion_questions_cache | Grok | Low |
| `character-avatars-service.ts` | character_avatars_cache | Grok + Replicate | High (image gen + polling) |
| `feed-service.ts` | feed_items | Reads from caches | Medium |

---

## 9. Environment Variables

```env
# Supabase (REQUIRED)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # Service role, not anon key

# APIs (REQUIRED for content generation)
GROK_API_KEY=xai-...                 # xAI Grok
YOUTUBE_API_KEY=AIza...              # Google YouTube Data API v3
TMDB_ACCESS_TOKEN=eyJ...            # TMDB (movies/TV)

# APIs (OPTIONAL)
REPLICATE_API_KEY=r8_...            # Replicate (character avatar images)
```

Note: The main app uses `NEXT_PUBLIC_` prefixed versions. The admin tool should use unprefixed versions since there's no browser exposure concern.

---

## 10. Bulk Add Books via CSV — Implementation Guide

### CSV Format

```csv
title,author,reading_status,cover_url,publish_year,genre,isbn
"The Great Gatsby","F. Scott Fitzgerald","read_it","","1925","Fiction","9780743273565"
"1984","George Orwell","want_to_read","","1949","Dystopian",""
```

Required columns: `title`, `author`
Optional columns: `reading_status`, `cover_url`, `publish_year`, `genre`, `isbn`, `first_issue_year`, `summary`

### Processing Flow per Book

```
1. Parse CSV row
2. Generate canonical_book_id: `title.toLowerCase().trim() + "|" + author.toLowerCase().trim()`
3. Check if book already exists for target user: books.select('id').eq('user_id', userId).eq('canonical_book_id', canonicalId)
4. If exists → skip (or update if flag set)
5. Enrich metadata (optional):
   a. Search Wikipedia → get cover_url, publish_year, genre, isbn
   b. Search iTunes → get apple_rating, apple_rating_count, cover_url
6. Insert into books table
7. (Optional) Populate selected cache tables
8. (Optional) Generate feed items
```

### Book Insert Shape

```typescript
const bookData = {
  user_id: targetUserId,
  canonical_book_id: `${title.toLowerCase().trim()}|${author.toLowerCase().trim()}`,
  title,
  author,
  cover_url: coverUrl || null,
  wikipedia_url: wikipediaUrl || null,
  google_books_url: null,
  summary: summary || null,
  publish_year: publishYear || null,
  first_issue_year: firstIssueYear || null,
  genre: genre || null,
  isbn: isbn || null,
  apple_rating: appleRating || null,
  apple_rating_count: appleRatingCount || null,
  reading_status: readingStatus || null,
  rating_writing: null,
  rating_insights: null,
  rating_flow: null,
  rating_world: null,
  rating_characters: null,
};

const { data, error } = await supabase
  .from('books')
  .insert(bookData)
  .select()
  .single();
```

### Rate Limiting

- Grok API: Respect 429 responses, use exponential backoff (2s base, 2x multiplier)
- YouTube API: Daily quota of 10,000 units (search = 100 units each)
- iTunes: No documented rate limit, but throttle to ~2 req/sec
- Wikipedia: Throttle to ~1 req/sec
- TMDB: ~40 req/10sec

**Recommendation:** Process books sequentially with 2-3 second delays between API calls. For bulk operations (50+ books), add configurable concurrency (default: 1).

---

## 11. Selective Cache Population — Implementation Guide

The admin tool should let the operator choose which cache tables to populate per book or batch.

### Cache Population Functions

Each function follows this pattern:

```typescript
async function populateBookSummary(title: string, author: string): Promise<boolean> {
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedAuthor = author.toLowerCase().trim();

  // 1. Check if already cached
  const { data: existing } = await supabase
    .from('book_summary_cache')
    .select('id')
    .eq('book_title', normalizedTitle)
    .eq('book_author', normalizedAuthor)
    .maybeSingle();

  if (existing) {
    console.log(`[skip] Summary already cached for "${title}"`);
    return false; // Already cached
  }

  // 2. Load prompt and call Grok
  const prompt = formatPrompt(prompts.book_summary.prompt, { bookTitle: title, author });
  const response = await callGrok(prompt, { temperature: 0.7, jsonMode: true });

  // 3. Parse response
  const content = response.choices[0].message.content;
  const parsed = JSON.parse(content);
  const summary = normalizeSummary(parsed, title, author);
  if (!summary) throw new Error('Invalid summary response');

  // 4. Save to cache
  await supabase.from('book_summary_cache').upsert({
    book_title: normalizedTitle,
    book_author: normalizedAuthor,
    summary_data: summary,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'book_title,book_author' });

  return true;
}
```

### Cache Type → Function Mapping

```typescript
const CACHE_POPULATORS: Record<string, (title: string, author: string) => Promise<boolean>> = {
  summary: populateBookSummary,
  author_facts: populateAuthorFacts,
  book_context: populateBookContext,
  book_domain: populateBookDomain,
  book_influences: populateBookInfluences,
  did_you_know: populateDidYouKnow,
  podcasts: populatePodcasts,
  youtube: populateYouTubeVideos,
  related_books: populateRelatedBooks,
  related_movies: populateRelatedMovies,
  articles: populateArticles,
  trivia: populateTrivia,
  discussion: populateDiscussion,
  character_avatars: populateCharacterAvatars,
};
```

### CLI Interface Example

```bash
# Add books from CSV, populate summaries and insights only
npx tsx admin.ts add-books --csv books.csv --user-id abc123 --populate summary,author_facts,did_you_know

# Populate caches for existing books
npx tsx admin.ts populate --user-id abc123 --types summary,podcasts,youtube

# Populate specific book
npx tsx admin.ts populate --title "The Great Gatsby" --author "F. Scott Fitzgerald" --types all

# Generate feed items for all books of a user
npx tsx admin.ts generate-feed --user-id abc123

# Check cache coverage
npx tsx admin.ts coverage --user-id abc123
```

---

## 12. Scaffolding Steps

### Step 1: Initialize project

```bash
mkdir book-admin && cd book-admin
npm init -y
npm install @supabase/supabase-js typescript tsx yaml csv-parse commander
npm install -D @types/node
```

### Step 2: Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### Step 3: Project structure

```
book-admin/
├── src/
│   ├── index.ts              # CLI entry point (commander)
│   ├── config.ts             # Env vars, Supabase client
│   ├── commands/
│   │   ├── add-books.ts      # CSV import command
│   │   ├── populate.ts       # Cache population command
│   │   ├── generate-feed.ts  # Feed generation command
│   │   └── coverage.ts       # Cache coverage report
│   ├── services/
│   │   ├── grok.ts           # Grok API wrapper
│   │   ├── youtube.ts        # YouTube API wrapper
│   │   ├── tmdb.ts           # TMDB API wrapper
│   │   ├── wikipedia.ts      # Wikipedia/Wikidata API wrapper
│   │   ├── itunes.ts         # iTunes Search API wrapper
│   │   ├── replicate.ts      # Replicate image generation
│   │   └── feed.ts           # Feed item generation
│   ├── populators/
│   │   ├── summary.ts
│   │   ├── insights.ts       # author_facts, context, domain, influences, did_you_know
│   │   ├── podcasts.ts
│   │   ├── youtube.ts
│   │   ├── related-books.ts
│   │   ├── related-movies.ts
│   │   ├── articles.ts
│   │   ├── trivia.ts
│   │   ├── discussion.ts
│   │   └── character-avatars.ts
│   └── utils/
│       ├── prompts.ts        # Prompt loading (copy from main app, remove browser deps)
│       └── hash.ts           # djb2 content hash (copy from feed-service.ts)
├── prompts.yaml              # Copy from main app's public/prompts.yaml
├── .env                      # Environment variables
├── package.json
└── tsconfig.json
```

### Step 4: Core utilities to copy from main app

1. **Prompt loader** — Adapt `lib/prompts.ts`: replace `fetch()` with `fs.readFileSync()`, remove browser URL logic
2. **Content hash** — Copy `generateFeedContentHash()` from `app/services/feed-service.ts`
3. **Summary normalizer** — Copy `normalizeSummary()` and `parseSummaryJson()` from `app/services/book-summary-service.ts`
4. **Grok wrapper** — Simplify `fetchWithRetry()` from `app/services/api-utils.ts`: remove CORS proxy routing, keep retry logic

### Step 5: Implement Grok service

```typescript
// src/services/grok.ts
const GROK_API_KEY = process.env.GROK_API_KEY!;

export async function callGrok(prompt: string, opts: {
  model?: string;
  temperature?: number;
  jsonMode?: boolean;
} = {}): Promise<any> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      model: opts.model || 'grok-4-1-fast-non-reasoning',
      stream: false,
      temperature: opts.temperature ?? 0.7,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Grok API error ${response.status}: ${body}`);
  }

  return response.json();
}
```

### Step 6: Implement populators

Port each service's core logic. For each:
1. Read the corresponding `app/services/*.ts` file
2. Extract the Supabase query pattern (table name, columns, key columns)
3. Extract the API call + response parsing logic
4. Remove browser-specific code (localStorage, DOMParser, AbortController, CORS proxy)

### Step 7: Wire up CLI

```typescript
// src/index.ts
import { Command } from 'commander';
import { addBooks } from './commands/add-books';
import { populate } from './commands/populate';
import { generateFeed } from './commands/generate-feed';
import { coverage } from './commands/coverage';

const program = new Command();
program.name('book-admin').description('BOOK app admin tool');

program.command('add-books')
  .requiredOption('--csv <path>', 'CSV file path')
  .requiredOption('--user-id <id>', 'Target user ID')
  .option('--populate <types>', 'Comma-separated cache types to populate')
  .option('--dry-run', 'Preview without inserting')
  .action(addBooks);

program.command('populate')
  .requiredOption('--types <types>', 'Comma-separated: summary,podcasts,youtube,all')
  .option('--user-id <id>', 'Populate for all books of this user')
  .option('--title <title>', 'Single book title')
  .option('--author <author>', 'Single book author')
  .option('--force', 'Overwrite existing cache entries')
  .action(populate);

program.command('generate-feed')
  .requiredOption('--user-id <id>', 'Target user ID')
  .action(generateFeed);

program.command('coverage')
  .option('--user-id <id>', 'Check for specific user\'s books')
  .action(coverage);

program.parse();
```

---

## 13. Key Patterns & Gotchas

### Normalization

**Always normalize before querying cache tables:**
```typescript
const normalizedTitle = title.toLowerCase().trim();
const normalizedAuthor = author.toLowerCase().trim();
```

**Canonical book ID** (for books table dedup):
```typescript
const canonicalBookId = `${title.toLowerCase().trim()}|${author.toLowerCase().trim()}`;
```

### Grok JSON Parsing

Grok sometimes returns malformed JSON. The main app has a robust `safeJsonParse()` in `book-summary-service.ts` that handles:
- Trailing commas
- Smart quotes (curly quotes → straight quotes)
- Stray inner quotes in string values
- Control characters

**Copy this function.** It prevents ~10% of Grok responses from being lost.

### Empty Cache = Negative Cache

When a service finds no results (e.g., no YouTube videos for a book), it stores an **empty array** in the cache. This prevents re-fetching. Respect this: if a cache entry exists with empty data, don't re-fetch unless `--force` is specified.

### Feed Item Deduplication

The `content_hash` + unique index prevents duplicates. When regenerating feed items, use `ignoreDuplicates: true` on upsert — existing items are silently skipped.

### Foreign Key Cascades

- Deleting a book auto-deletes its feed_items (FK cascade)
- Cache tables have no FK to books — they're shared and persist independently

### Rate Limits by API

| API | Limit | Strategy |
|-----|-------|----------|
| Grok | 429 → exponential backoff | 2s base, 2x multiplier, max 3 retries |
| YouTube | 10,000 units/day (search=100 each) | Track usage, stop at 80% |
| iTunes | ~2 req/sec | Simple delay |
| Wikipedia | ~1 req/sec | Simple delay |
| TMDB | ~40 req/10sec | Simple delay |
| Replicate | Concurrent limit | Sequential processing |

### Cost Awareness

The main app logs Grok usage to `grok_usage_logs` table. The admin tool should do the same for bulk operations:

```typescript
// After each Grok call
await supabase.from('grok_usage_logs').insert({
  user_id: adminUserId, // or 'admin-tool' identifier
  function_name: `admin:${functionName}`,
  prompt_tokens: usage.prompt_tokens,
  completion_tokens: usage.completion_tokens,
  total_tokens: usage.total_tokens,
  estimated_cost: calculateCost(usage),
});
```

**Grok pricing (approximate):**
- Input: $0.20 / million tokens
- Output: $0.50 / million tokens
- Web search: $0.005 / call

### Platform-Specific API Routing

The main app routes certain APIs through Supabase Edge Functions on web to avoid CORS:
- Grok → `grok-proxy`
- Replicate → `replicate-proxy`

**The admin tool (Node.js) does NOT need proxies.** Call APIs directly.
