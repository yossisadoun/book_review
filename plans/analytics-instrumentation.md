# BI Instrumentation Plan

## Status

- **Table:** `analytics_events` — live in Supabase, has `env` column (`prod`/`dev`), indexes on `(user_id, created_at)`, `(feature, action, created_at)`, `(session_id)`
- **Service:** `app/services/analytics-service.ts` — built, queue-based batching (10 events / 5s flush), session management, fire-and-forget
- **Wired up:** NO — zero `trackEvent` calls exist in the codebase yet

---

## Architecture Decisions

### Client → Edge Function → Table (not client-direct)

The client should NOT insert directly into `analytics_events`. Instead:

```
Client (batch queue)  →  POST /functions/v1/track  →  analytics_events
                          (edge function)
                          - inserts with service_role key
                          - validates payload shape
                          - enriches: adds env, rejects garbage
                          - returns 204 immediately
```

**Why edge function over client-direct:**
- **Security:** RLS locked to service_role only — no INSERT policy for anon/authenticated, table surface not exposed
- **Validation:** Server rejects malformed events, enforces field constraints before insert
- **Enrichment:** `env` derived server-side (from request origin header), not trust-the-client
- **Web resilience:** Custom endpoint path is less likely to be blocked by ad blockers than `supabase.co/rest/v1/analytics_events`
- **Future-proof:** Can add server-side dedup, sampling, or routing without client changes

**Client service changes:**
- Replace `supabase.from('analytics_events').insert(batch)` with `fetch('/functions/v1/track', { method: 'POST', body: JSON.stringify(batch) })`
- Keep all batching/queue/session logic client-side (already built)
- Still fire-and-forget, no retries for v1

### Daily Partitioning + Summary Tables

Raw `analytics_events` is partitioned by day for query performance and data lifecycle:

```sql
-- Convert to partitioned table
CREATE TABLE analytics_events (
  ...existing columns...
) PARTITION BY RANGE (created_at);

-- Auto-create daily partitions (pg_partman or manual via pg_cron)
-- e.g. analytics_events_2026_03_17, analytics_events_2026_03_18, ...
```

**Indexes per partition:**
- `(feature, action, created_at)` — fast F/A lookups within a day
- `(user_id, created_at)` — retention/user queries
- `(session_id)` — session reconstruction

**Summary table** (populated nightly by pg_cron or edge function cron):

```sql
CREATE TABLE analytics_daily_summary (
  day date NOT NULL,
  feature text NOT NULL,
  action text NOT NULL,
  platform text NOT NULL,
  account_type text NOT NULL,
  event_count bigint NOT NULL,
  unique_users bigint NOT NULL,
  unique_sessions bigint NOT NULL,
  PRIMARY KEY (day, feature, action, platform, account_type)
);
```

**Nightly rollup job:**
```sql
-- Runs via pg_cron at 01:00 UTC, aggregates yesterday
INSERT INTO analytics_daily_summary (day, feature, action, platform, account_type, event_count, unique_users, unique_sessions)
SELECT
  created_at::date AS day,
  feature, action, platform, account_type,
  count(*) AS event_count,
  count(DISTINCT user_id) AS unique_users,
  count(DISTINCT session_id) AS unique_sessions
FROM analytics_events
WHERE created_at >= current_date - 1 AND created_at < current_date
GROUP BY 1, 2, 3, 4, 5
ON CONFLICT (day, feature, action, platform, account_type)
DO UPDATE SET
  event_count = EXCLUDED.event_count,
  unique_users = EXCLUDED.unique_users,
  unique_sessions = EXCLUDED.unique_sessions;
```

**Query pattern:**
- Dashboards query `analytics_daily_summary` (small, pre-aggregated)
- Drill-down / debugging queries hit raw `analytics_events` with date filter (hits single partition)
- Old partitions dropped after 90 days (summary retains indefinitely)

---

## Approach

### Phase 1: Wire Up Foundation — DONE
1. ~~Create edge function `supabase/functions/track/index.ts`~~ — validates payload, enriches `env` from origin, inserts with service_role
2. ~~Update `analytics-service.ts`~~ — POSTs to edge function (with `keepalive: true`), Capacitor `pause` listener, `session_end` on visibility hidden / native pause
3. ~~Call `analytics.initSession()` on app mount~~ — done in `AuthContext.tsx` on initial mount
4. ~~Call `setAnalyticsUser(id, type)` when auth state resolves~~ — done in `AuthContext.tsx` (initial session + onAuthStateChange)
5. ~~P0 events~~ — `app.session_start`, `app.session_end`, `auth.sign_in`, `auth.sign_out`, `nav.tap` (bookshelf/chat/feed), `bookshelf.view`, `book.view`, `feed.view`

**Still needed to go live:**
- Deploy the `track` edge function to Supabase (`supabase functions deploy track`)
- Add RLS insert policy for service_role on `analytics_events` (if not already present)
- Verify events flow in dev → check Supabase table editor

### Phase 2: Instrument Remaining Actions
Add `analytics.trackEvent(F, A, metadata)` calls for P1–P3 events from the catalog below. Place calls in event handlers closest to the user action, not deep in services.

**P1 — Key actions — DONE:**
- ~~`add_book.confirm`~~ — in `handleAddBookWithStatus` in `page.tsx` (both success paths)
- ~~`chat.send_message`~~ — in `BookChat.tsx` `handleSend` (with `chat_type`, `message_length`)
- ~~`rating.rate`~~ — in `handleRate` in `page.tsx` (with `book_title`, `dimension`, `value`)
- ~~`trivia.start`~~ — in trivia button onClick in `page.tsx` (with `question_count`)
- ~~`trivia.complete`~~ — in trivia completion useEffect in `page.tsx` (with `score`, `total`)
- ~~`feed.heart`~~ — in `handleToggleHeart` in `page.tsx` (with `is_hearted`)
- `feed.tap_card` — deferred to P3 (no single handler; dozens of card-type-specific onClicks)

**P2 — Content discovery — DONE:**
- ~~`podcasts.play`~~ — in `PodcastEpisodes.tsx` (with `podcast_name`, `episode_title`, `platform`)
- ~~`podcasts.pause`~~ — in `PodcastEpisodes.tsx`
- ~~`podcasts.open_external`~~ — in `PodcastEpisodes.tsx`
- ~~`youtube.play`~~ — in `YouTubeVideos.tsx` (with `video_title`, `channel`)
- ~~`related_books.add`~~ — in `RelatedBooks.tsx` (with `related_title`, `related_author`)
- ~~`articles.tap`~~ — in `AnalysisArticles.tsx` (with `article_title`)
- ~~`insights.view`~~ — in `page.tsx` category selector (with `category`, `book_title`)
- ~~`discussion.view`~~ — in `page.tsx` useEffect on `showBookDiscussion` (with `book_title`)
- ~~`summary.view`~~ — in `BookSummary.tsx` on bookId change (with `book_id`)

**P3 — Granular:**
- `add_book.search`, `add_book.open` — in `AddBookSheet.tsx`
- `feed.scroll_depth`, `feed.refresh`, `feed.change_filter`, `feed.tap_card` — in feed section of `page.tsx`
- `bookshelf.change_grouping`, `bookshelf.change_view` — in bookshelf handlers
- `chat.tap_starter`, `chat.send_gif`, `chat.open`, `chat.delete_chat` — in `BookChat.tsx`
- `sorting.*` — in sorting game handlers
- `account.*` — in account page section
- `social.*` — in following/profile handlers
- `auth.link_account`, `auth.link_error`, `auth.delete_account` — in `AuthContext.tsx`

### Phase 3: Partitioning & Summary Tables
Once event volume warrants it (thousands of events/day):
1. Convert `analytics_events` to daily-partitioned table (requires new table + data migration + swap)
2. Create `analytics_daily_summary` table
3. Set up pg_cron nightly rollup job
4. Update queries to use summary table for dashboards

### Phase 4: Dashboards
Build SQL queries against `analytics_daily_summary` for dashboards. Use raw table for drill-down only.

---

## Event Catalog

Convention: `F` = feature, `A` = action. Metadata fields shown in parentheses.

### App Lifecycle

| F | A | When | Metadata |
|---|---|------|----------|
| app | session_start | App opens or resumes after 30min inactivity | — |
| app | session_end | App backgrounds | `{ duration_ms }` |
| app | onboarding_complete | User finishes onboarding flow | — |

### Auth

| F | A | When | Metadata |
|---|---|------|----------|
| auth | sign_in | Successful sign-in | `{ method: 'guest' \| 'apple' \| 'google' }` |
| auth | sign_out | User signs out | — |
| auth | link_account | Guest links to Apple/Google | `{ method, migrated_books_count }` |
| auth | link_error | Account linking fails | `{ error_code }` |
| auth | delete_account | Account deletion confirmed | — |

### Navigation

| F | A | When | Metadata |
|---|---|------|----------|
| nav | tap | User taps a bottom nav or header icon | `{ destination: 'bookshelf' \| 'feed' \| 'trivia' \| 'account' \| 'following' \| 'notes' \| 'chat_list' \| 'about' }` |

### Bookshelf

| F | A | When | Metadata |
|---|---|------|----------|
| bookshelf | view | Bookshelf screen shown | `{ view_type: 'spines' \| 'covers', book_count }` |
| bookshelf | change_grouping | User changes grouping dropdown | `{ grouping }` |
| bookshelf | change_view | Toggle spines ↔ covers | `{ view_type }` |
| bookshelf | tap_book | User taps a book | `{ book_title, book_author }` |
| bookshelf | enter_select_mode | User enters multi-select | — |
| bookshelf | bulk_action | Multi-select action executed | `{ action, count }` |

### Add Book

| F | A | When | Metadata |
|---|---|------|----------|
| add_book | open | Add book sheet opened | `{ mode: 'normal' \| 'chat_picker' }` |
| add_book | search | User submits a search query | `{ query, source: 'apple_books' \| 'wikipedia' \| 'grok' \| 'database' }` |
| add_book | search_results | Results returned | `{ query, source, result_count }` |
| add_book | select_result | User picks a book from results | `{ book_title, book_author, source }` |
| add_book | confirm | Book added to bookshelf | `{ book_title, book_author, reading_status }` |

### Book Details

| F | A | When | Metadata |
|---|---|------|----------|
| book | view | Book details page shown | `{ book_title, book_author }` |
| book | change_reading_status | Status changed | `{ book_title, old_status, new_status }` |
| book | delete | Book deleted | `{ book_title }` |
| book | share | Book shared | `{ book_title, share_method: 'native' \| 'clipboard' }` |

### Ratings

| F | A | When | Metadata |
|---|---|------|----------|
| rating | rate | User rates a dimension | `{ book_title, dimension, value }` |
| rating | skip | User skips a dimension | `{ book_title, dimension }` |
| rating | complete | All dimensions rated | `{ book_title }` |

### Notes

| F | A | When | Metadata |
|---|---|------|----------|
| notes | view | Notes list opened | `{ note_count }` |
| notes | edit | User saves a note | `{ book_title, char_count }` |
| notes | delete | User deletes a note | `{ book_title }` |

### Content Sections (Book Details)

| F | A | When | Metadata |
|---|---|------|----------|
| insights | view | Insights section scrolled into view / tapped | `{ book_title, category: 'did_you_know' \| 'author_facts' \| 'influences' \| 'domain' \| 'context' }` |
| insights | load | Insight data fetched | `{ book_title, category, item_count }` |
| summary | view | Summary expanded | `{ book_title }` |
| podcasts | view | Podcasts section visible | `{ book_title, episode_count }` |
| podcasts | play | User plays a podcast episode | `{ book_title, podcast_name, episode_title }` |
| podcasts | pause | User pauses playback | `{ book_title }` |
| youtube | view | YouTube section visible | `{ book_title, video_count }` |
| youtube | play | User plays a video | `{ book_title, video_title }` |
| articles | view | Articles section visible | `{ book_title, article_count }` |
| articles | tap | User taps an article link | `{ book_title, article_title }` |
| related_books | view | Related books section visible | `{ book_title, related_count }` |
| related_books | tap | User taps a related book | `{ book_title, related_title }` |
| related_books | add | User adds a related book to shelf | `{ book_title, related_title }` |
| discussion | view | Discussion questions loaded | `{ book_title, question_count }` |
| music | view | Music modal opened | `{ book_title }` |
| watch | view | Watch modal opened | `{ book_title }` |
| infographic | view | Infographic modal opened | `{ book_title, section }` |

### Chat

| F | A | When | Metadata |
|---|---|------|----------|
| chat | open | Chat opened | `{ chat_type: 'book' \| 'character', book_title, character_name? }` |
| chat | send_message | User sends a message | `{ chat_type, book_title, message_length }` |
| chat | receive_response | AI response received | `{ chat_type, book_title, response_length, latency_ms }` |
| chat | tap_starter | User taps a suggested prompt | `{ book_title, prompt_text }` |
| chat | send_gif | User sends a GIF | `{ book_title }` |
| chat | reply | User replies to a message | `{ book_title }` |
| chat | delete_message | User deletes a message | `{ book_title }` |
| chat | list_view | Chat list screen shown | `{ chat_count }` |
| chat | delete_chat | User deletes entire chat | `{ book_title }` |

### Feed

| F | A | When | Metadata |
|---|---|------|----------|
| feed | view | Feed page shown | `{ item_count, filter }` |
| feed | refresh | Pull-to-refresh | `{ new_item_count }` |
| feed | change_filter | Filter dropdown changed | `{ filter_type }` |
| feed | tap_card | User taps a feed card | `{ item_type, book_title }` |
| feed | play_audio | Play podcast from feed | `{ book_title, podcast_name }` |
| feed | play_video | Play video from feed | `{ book_title, video_title }` |
| feed | heart | User hearts a feed item | `{ item_type, book_title, is_hearted }` |
| feed | reveal_spoiler | User reveals spoiler content | `{ item_type, book_title }` |
| feed | scroll_depth | User scrolls past thresholds | `{ items_seen }` |

### Social

| F | A | When | Metadata |
|---|---|------|----------|
| social | follow | User follows someone | `{ followed_user_id }` |
| social | unfollow | User unfollows someone | `{ unfollowed_user_id }` |
| social | view_profile | User views another user's bookshelf | `{ viewed_user_id, book_count }` |
| social | create_post | User creates a post | `{ book_title }` |
| social | search_users | User searches for users | `{ query, result_count }` |

### Trivia

| F | A | When | Metadata |
|---|---|------|----------|
| trivia | start | Game started | `{ question_count }` |
| trivia | answer | User answers a question | `{ question_index, is_correct }` |
| trivia | complete | Game finished | `{ score, total, duration_ms }` |
| trivia | quit | User exits mid-game | `{ score, total, question_index }` |

### Sorting Game

| F | A | When | Metadata |
|---|---|------|----------|
| sorting | start | Sorting game started | `{ book_count }` |
| sorting | compare | User picks a preference | `{ round }` |
| sorting | complete | Game finished | `{ rounds_played }` |

### Account / Settings

| F | A | When | Metadata |
|---|---|------|----------|
| account | view | Account page shown | — |
| account | toggle_privacy | User toggles public/private | `{ is_public }` |
| account | reorder_preferences | User reorders content sections | `{ new_order[] }` |
| account | toggle_preference | User enables/disables a content type | `{ preference, enabled }` |

---

## Implementation Notes

### Where to place calls

| Location | Events |
|----------|--------|
| `app/page.tsx` — main `useEffect` | `app.session_start`, `setAnalyticsUser` |
| `app/page.tsx` — navigation handlers | `nav.tap`, all `*.view` events |
| `app/page.tsx` — book handlers | `bookshelf.*`, `book.*`, `rating.*`, `notes.*` |
| `app/page.tsx` — feed section | `feed.*` |
| `app/page.tsx` — trivia section | `trivia.*`, `sorting.*` |
| `app/page.tsx` — social handlers | `social.*` |
| `app/page.tsx` — account section | `account.*` |
| `app/components/BookChat.tsx` | `chat.*` |
| `app/components/AddBookSheet.tsx` | `add_book.*` |
| `app/components/PodcastEpisodes.tsx` | `podcasts.play`, `podcasts.pause` |
| `app/components/YouTubeVideos.tsx` | `youtube.play` |
| `app/components/RelatedBooks.tsx` | `related_books.tap`, `related_books.add` |
| `app/components/BookSummary.tsx` | `summary.view` |
| `contexts/AuthContext.tsx` | `auth.*` |

### Service changes needed

1. **Add `env` field** to `AnalyticsEvent` interface and `enqueue()` — derive from hostname
2. **Add Capacitor `pause` listener** in `initSession()` to flush on native app background
3. **No other service changes needed** — the existing API (`trackEvent`, `trackView`, `trackTap`) covers everything

### Priority order for instrumentation

1. **P0 — Core engagement:** `app.session_*`, `auth.*`, `nav.tap`, `bookshelf.view`, `book.view`, `feed.view`
2. **P1 — Key actions:** `add_book.confirm`, `chat.send_message`, `rating.rate`, `trivia.start`, `trivia.complete`, `feed.tap_card`, `feed.heart`
3. **P2 — Content discovery:** `podcasts.play`, `youtube.play`, `related_books.tap`, `articles.tap`, `insights.view`, `discussion.view`
4. **P3 — Granular:** `add_book.search`, `feed.scroll_depth`, `bookshelf.change_grouping`, `chat.tap_starter`, `sorting.*`, `account.*`

---

## Key SQL Queries (post-instrumentation)

### Dashboard queries (against summary table — fast)

```sql
-- DAU / WAU / MAU
SELECT day, sum(unique_users) AS dau
FROM analytics_daily_summary
WHERE day > current_date - 30
GROUP BY 1 ORDER BY 1;

-- WAU
SELECT date_trunc('week', day)::date AS week, max(unique_users) AS wau_peak
FROM analytics_daily_summary
GROUP BY 1 ORDER BY 1;

-- Feature usage ranking
SELECT feature, action, sum(event_count) AS events, sum(unique_users) AS users
FROM analytics_daily_summary
GROUP BY 1, 2 ORDER BY 3 DESC;

-- Feature usage by platform
SELECT feature, platform, sum(event_count) AS events
FROM analytics_daily_summary
WHERE day > current_date - 7
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

-- Guest vs signed-in usage
SELECT account_type, sum(event_count) AS events, sum(unique_users) AS users
FROM analytics_daily_summary
WHERE day > current_date - 30
GROUP BY 1;
```

### Drill-down queries (against raw partitioned table — use date filters)

```sql
-- Session duration
SELECT avg((metadata->>'duration_ms')::int) / 1000.0 AS avg_session_seconds
FROM analytics_events
WHERE action = 'session_end' AND env = 'prod'
  AND created_at >= current_date - 7;

-- Conversion: book added after search (within last 7 days)
WITH searches AS (
  SELECT session_id FROM analytics_events
  WHERE feature = 'add_book' AND action = 'search'
    AND created_at >= current_date - 7
),
adds AS (
  SELECT session_id FROM analytics_events
  WHERE feature = 'add_book' AND action = 'confirm'
    AND created_at >= current_date - 7
)
SELECT
  count(DISTINCT s.session_id) AS search_sessions,
  count(DISTINCT a.session_id) AS converted_sessions,
  round(100.0 * count(DISTINCT a.session_id) / nullif(count(DISTINCT s.session_id), 0), 1) AS conversion_pct
FROM searches s LEFT JOIN adds a USING (session_id);

-- Chat engagement by type
SELECT
  metadata->>'chat_type' AS chat_type,
  count(*) AS messages,
  count(DISTINCT user_id) AS users
FROM analytics_events
WHERE feature = 'chat' AND action = 'send_message' AND env = 'prod'
  AND created_at >= current_date - 30
GROUP BY 1;

-- D1 retention
WITH first_seen AS (
  SELECT user_id, min(created_at)::date AS d0
  FROM analytics_events
  WHERE user_id IS NOT NULL AND env = 'prod'
    AND created_at >= current_date - 30
  GROUP BY 1
)
SELECT d0, count(*) AS cohort,
  count(DISTINCT CASE WHEN e.created_at::date = d0 + 1 THEN f.user_id END) AS returned_d1,
  round(100.0 * count(DISTINCT CASE WHEN e.created_at::date = d0 + 1 THEN f.user_id END) / count(*), 1) AS d1_pct
FROM first_seen f
LEFT JOIN analytics_events e ON e.user_id = f.user_id AND e.env = 'prod'
  AND e.created_at >= current_date - 31
GROUP BY 1 ORDER BY 1;

-- Session replay (single user debugging)
SELECT feature, action, metadata, created_at
FROM analytics_events
WHERE session_id = '<uuid>' AND created_at >= '<date>'
ORDER BY created_at;
```
