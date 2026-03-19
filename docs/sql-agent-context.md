# Book.luv SQL Agent — Database Context

## Core System Prompt

You are a data analyst assistant with direct access to the Book.luv Supabase (PostgreSQL) database. Your job is to answer questions by writing and reasoning about SQL queries.

## Dialect

PostgreSQL 15 (Supabase)

## Rules

1. Always write a SQL query to answer the question — don't guess from memory.
2. Before writing SQL, briefly state your approach in 1–2 sentences.
3. If a question is ambiguous, state your assumption before querying.
4. Return the SQL in a clean code block, then explain the result in plain English.
5. If a query could be slow (large scans, no filters on big tables), warn the user and suggest optimizations.
6. **Read-only.** Never write destructive queries (INSERT, UPDATE, DELETE, DROP, TRUNCATE) unless explicitly asked and confirmed.
7. Prefer CTEs over nested subqueries for readability.
8. If the answer requires multiple queries, break them into clearly labeled steps.

---

## Database Schema

### Core Tables

#### books
The primary user-owned table. One row per book per user.

```sql
CREATE TABLE books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  canonical_book_id text NOT NULL, -- format: "lower(title)|lower(author)"
  title text,
  author text,
  genre text,
  publish_year int,
  first_issue_year int,
  isbn text,
  cover_url text,
  wikipedia_url text,
  google_books_url text,
  summary text,                    -- book synopsis
  reading_status text,             -- 'read_it' | 'reading' | 'want_to_read' | NULL
  rating_writing int,              -- 1–5
  rating_insights int,             -- 1–5
  rating_flow int,                 -- 1–5
  rating_world int,                -- 1–5
  rating_characters int,           -- 1–5
  author_facts jsonb,              -- legacy, prefer author_facts_cache
  notes text,                      -- user's personal notes
  lists text[],                    -- custom user-created list names
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, canonical_book_id)
);
```

#### users
Extends Supabase `auth.users` with app-specific profile data.

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  is_public boolean DEFAULT true,
  content_preferences jsonb        -- {fun_facts, podcasts, youtube, related_work, articles}
);
```

#### follows
Social graph. Users can follow each other to see friend activity in feed.

```sql
CREATE TABLE follows (
  follower_id uuid REFERENCES auth.users(id),
  following_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);
```

---

### Feed System

#### feed_items
Personalized content cards generated from cache tables. Central table for the feed experience.

```sql
CREATE TABLE feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_book_id uuid,
  source_book_title text,
  source_book_author text,
  source_book_cover_url text,
  source_book_created_at timestamptz,
  type text NOT NULL,              -- CHECK: fact|context|drilldown|influence|podcast|article|related_book|video|friend_book
  content jsonb,                   -- type-specific payload
  content_hash text,               -- djb2 hash for deduplication
  reading_status text,             -- synced from books table via trigger
  base_score float DEFAULT 1.0,
  times_shown int DEFAULT 0,
  last_shown_at timestamptz,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, type, content_hash)
);
-- Key indexes: (user_id), (user_id, type), (user_id, read), (created_at DESC)
```

**Feed item types explained:**
| type | source cache | content |
|------|-------------|---------|
| `fact` | author_facts_cache | Trivia facts about the author |
| `context` | book_context_cache | Historical/cultural context |
| `drilldown` | book_domain_cache | Subject matter deep dives |
| `influence` | book_influences_cache | Literary influences |
| `podcast` | podcast_episodes_cache | Podcast episode recommendations |
| `article` | google_scholar_articles | Academic/analysis articles |
| `related_book` | related_books | Book recommendations |
| `video` | youtube_videos | YouTube video suggestions |
| `friend_book` | (generated on book add) | A followed user added this book |

---

### Chat System

#### book_chats
Conversation history for the book reading companion (Book.luver AI).

```sql
CREATE TABLE book_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  book_id uuid,                    -- references books.id (no FK constraint)
  book_title text,
  book_author text,
  role text NOT NULL,              -- CHECK: 'user' | 'assistant'
  content text NOT NULL,
  is_proactive boolean DEFAULT false, -- AI-initiated message
  created_at timestamptz DEFAULT now()
);
-- Index: (user_id, book_id, created_at)
```

#### character_chats
Conversation history for fictional character roleplay chats.

```sql
CREATE TABLE character_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  book_title text NOT NULL,
  book_author text NOT NULL,
  character_name text NOT NULL,
  role text NOT NULL,              -- 'user' | 'assistant'
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
-- Index: (user_id, book_title, character_name, created_at)
```

#### chat_prompt_versions
Manages and A/B tests chat system prompts.

```sql
CREATE TABLE chat_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prompt_type text NOT NULL,       -- 'character_chat' | 'book_chat'
  template text NOT NULL,
  model text DEFAULT 'grok-3-fast',
  temperature float DEFAULT 0.8,
  notes text,
  is_active boolean DEFAULT false, -- only one active per prompt_type
  created_at timestamptz DEFAULT now()
);
-- Unique partial index: (prompt_type) WHERE is_active = true
```

#### proactive_message_log
Tracks AI-initiated messages to prevent spamming users.

```sql
CREATE TABLE proactive_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  chat_type text NOT NULL,         -- CHECK: 'book' | 'general'
  chat_key text NOT NULL,          -- book_id or 'general'
  sent_at timestamptz DEFAULT now(),
  was_replied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
-- Index: (user_id, chat_key)
```

---

### Shared Content Cache Tables

All cache tables are **shared across users** (keyed by normalized book_title + book_author). One row per book globally.

| Table | Key columns | Data column(s) |
|-------|------------|----------------|
| `author_facts_cache` | book_title, book_author | `author_facts` (jsonb[]) |
| `book_context_cache` | book_title, book_author | `context_insights` (jsonb[]) |
| `book_domain_cache` | book_title, book_author | `domain_label` (text), `domain_insights` (jsonb[]) |
| `book_influences_cache` | book_title, book_author | `influences` (jsonb[]) |
| `podcast_episodes_cache` | book_title, book_author | `podcast_episodes_curated`, `podcast_episodes_apple` (jsonb[]) |
| `google_scholar_articles` | book_title, book_author | `articles` (jsonb[]) |
| `youtube_videos` | book_title, book_author | `videos` (jsonb[]) |
| `related_books` | book_title, book_author | `related_books` (jsonb[]) |
| `related_movies` | book_title, book_author | `related_movies` (jsonb[]) |
| `trivia_questions_cache` | book_title, book_author | `questions` (jsonb[]) |
| `discussion_questions_cache` | canonical_book_id | `questions` (jsonb[]) |
| `did_you_know_cache` | book_title, book_author | `insights` (jsonb[]) |
| `book_summary_cache` | book_title, book_author | `summary_data` (jsonb) |
| `character_avatars_cache` | book_title, book_author | `avatars` (jsonb[]), `contexts` (jsonb) |

All have: `id` (uuid PK), `created_at`, `updated_at`, `UNIQUE(book_title, book_author)`.

**Important:** Cache tables store `book_title` and `book_author` normalized to `lower(trim(...))`. When joining to `books`, always normalize: `lower(trim(books.title)) = cache.book_title`.

---

### Engagement

#### content_hearts
Tracks likes/favorites on any content item.

```sql
CREATE TABLE content_hearts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  content_hash text NOT NULL,      -- hash of the content item
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, content_hash)
);
-- Indexes: (content_hash), (user_id)
```

---

### External Integrations

#### telegram_topics
Telegram forum topics for book discussion groups.

```sql
CREATE TABLE telegram_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_book_id text UNIQUE,
  book_title text,
  book_author text,
  telegram_topic_id bigint,
  invite_link text,
  created_at timestamptz DEFAULT now()
);
```

---

### Analytics

#### analytics_events
User interaction tracking across all platforms.

```sql
CREATE TABLE analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,                    -- nullable (pre-auth events)
  feature text NOT NULL,           -- e.g. 'bookshelf', 'feed', 'chat', 'trivia'
  action text NOT NULL,            -- e.g. 'view', 'tap_play', 'send_message'
  platform text NOT NULL,          -- CHECK: 'ios' | 'android' | 'web'
  account_type text NOT NULL,      -- CHECK: 'guest' | 'apple' | 'google'
  metadata jsonb,                  -- extra context (book_title, duration_ms, etc.)
  session_id uuid,                 -- groups events into sessions
  created_at timestamptz DEFAULT now()
);
-- Indexes: (user_id, created_at), (feature, action, created_at), (session_id)
```

#### grok_usage_logs
Tracks AI API calls and estimated costs.

```sql
CREATE TABLE grok_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  function_name text,              -- e.g. 'character-chat', 'book-chat', 'generate-avatars'
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  estimated_cost numeric,
  source text,                     -- 'edge' | 'client'
  model text,                      -- e.g. 'grok-3-fast', 'grok-3-mini'
  duration_ms int,
  web_search_calls int,
  created_at timestamptz DEFAULT now()
);
```

---

### Feature Flags

#### feature_flags
App-wide feature toggles (key-value).

```sql
CREATE TABLE feature_flags (
  key text PRIMARY KEY,
  enabled boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
```

#### remote_feature_flags
Legacy single-row feature flags (deprecated, use feature_flags).

```sql
CREATE TABLE remote_feature_flags (
  id int PRIMARY KEY CHECK (id = 1),
  chat_enabled boolean DEFAULT true,
  create_post_enabled boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
```

---

## Join Relationships

```
books.user_id                     → auth.users.id
feed_items.user_id                → auth.users.id
feed_items.source_book_id         → books.id
book_chats.user_id                → auth.users.id
book_chats.book_id                → books.id (no FK, soft reference)
character_chats.user_id           → auth.users.id
content_hearts.user_id            → auth.users.id
follows.follower_id               → auth.users.id
follows.following_id              → auth.users.id
analytics_events.user_id          → auth.users.id (nullable)
grok_usage_logs.user_id           → auth.users.id
telegram_topics.canonical_book_id → books.canonical_book_id
proactive_message_log.user_id     → auth.users.id
users.id                          → auth.users.id

-- Cache tables join to books via normalized title/author:
lower(trim(books.title))  = cache_table.book_title
lower(trim(books.author)) = cache_table.book_author
```

---

## Business Logic & Definitions

### Reading Status
- `'read_it'` — user finished the book
- `'reading'` — currently reading
- `'want_to_read'` — on the wishlist
- `NULL` — no status set (default on add)

### Ratings
Five dimensions, each 1–5 scale (nullable):
- `rating_writing` — prose quality
- `rating_insights` — depth of ideas
- `rating_flow` — pacing and readability
- `rating_world` — world-building / setting
- `rating_characters` — character development

**Average rating** = `(rating_writing + rating_insights + rating_flow + rating_world + rating_characters) / 5.0` (only count non-null)

### Canonical Book ID
Format: `lower(title) || '|' || lower(author)` — used to deduplicate books across users and link to shared resources (discussion questions, telegram topics).

### Account Types
- **Guest** — anonymous Supabase auth, data at risk if app is deleted
- **Apple** — Sign in with Apple
- **Google** — Sign in with Google
- Guest accounts can migrate to Apple/Google via `migrate_anonymous_books()` RPC

### Feed Scoring
Items are scored by:
- **Recency**: newer source books score higher
- **Engagement**: `times_shown` (penalizes over-shown items)
- **Staleness**: `last_shown_at` (resurfaces old unseen items)
- **Type diversity**: greedy algorithm ensures mix of content types

### Content Hash
Uses browser-compatible djb2 algorithm (not SHA-256). Two feed items with the same `(user_id, type, content_hash)` are considered duplicates.

### Cache Table Normalization
Cache tables are **shared globally** — all users see the same cached content for a book. They're keyed on `lower(trim(title))` + `lower(trim(author))`. When querying cache data for a specific book, always normalize.

### AI Models Used
- **Grok** (xAI) — chat responses, content generation, book search
- **Replicate** — character avatar image generation
- Models tracked in `grok_usage_logs.model` column

---

## Common Query Patterns

### "How many books does each user have?"
```sql
SELECT user_id, count(*) as book_count
FROM books
GROUP BY user_id
ORDER BY book_count DESC;
```

### "What are the most popular books across all users?"
```sql
SELECT canonical_book_id, title, author, count(DISTINCT user_id) as user_count
FROM books
GROUP BY canonical_book_id, title, author
ORDER BY user_count DESC
LIMIT 20;
```

### "Average rating by book (across all users who rated)"
```sql
SELECT canonical_book_id, title, author,
  round(avg(
    (coalesce(rating_writing,0) + coalesce(rating_insights,0) + coalesce(rating_flow,0) +
     coalesce(rating_world,0) + coalesce(rating_characters,0))::numeric /
    nullif(
      (CASE WHEN rating_writing IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN rating_insights IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN rating_flow IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN rating_world IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN rating_characters IS NOT NULL THEN 1 ELSE 0 END), 0)
  ), 2) as avg_rating,
  count(*) as ratings_count
FROM books
WHERE rating_writing IS NOT NULL OR rating_insights IS NOT NULL
GROUP BY canonical_book_id, title, author
ORDER BY avg_rating DESC;
```

### "Daily active users (by analytics)"
```sql
SELECT date_trunc('day', created_at) as day,
  count(DISTINCT user_id) as dau,
  count(DISTINCT session_id) as sessions
FROM analytics_events
WHERE created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1;
```

### "AI API costs by function"
```sql
SELECT function_name, model,
  count(*) as calls,
  sum(total_tokens) as total_tokens,
  round(sum(estimated_cost)::numeric, 4) as total_cost
FROM grok_usage_logs
WHERE created_at >= now() - interval '7 days'
GROUP BY function_name, model
ORDER BY total_cost DESC;
```

### "Chat engagement by user"
```sql
WITH book_msgs AS (
  SELECT user_id, count(*) as msgs FROM book_chats WHERE role = 'user' GROUP BY 1
),
char_msgs AS (
  SELECT user_id, count(*) as msgs FROM character_chats WHERE role = 'user' GROUP BY 1
)
SELECT coalesce(b.user_id, c.user_id) as user_id,
  coalesce(b.msgs, 0) as book_chat_msgs,
  coalesce(c.msgs, 0) as character_chat_msgs,
  coalesce(b.msgs, 0) + coalesce(c.msgs, 0) as total_msgs
FROM book_msgs b
FULL OUTER JOIN char_msgs c ON b.user_id = c.user_id
ORDER BY total_msgs DESC;
```

### "Join books to cache data"
```sql
SELECT b.title, b.author, c.summary_data
FROM books b
JOIN book_summary_cache c
  ON lower(trim(b.title)) = c.book_title
  AND lower(trim(b.author)) = c.book_author
WHERE b.user_id = '<user_id>';
```
