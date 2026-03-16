# Chat Access After Book Deletion

## Problem
When a user deletes a book from their shelf, they can no longer enter the chat for that book — even though the chat history still exists in the database.

## Current State

### Database Behavior on Book Deletion
| Table | What happens | Why |
|-------|-------------|-----|
| `feed_items` | Deleted (CASCADE trigger) | Has FK to `books(id)` + explicit trigger |
| `book_chats` | **Survives as orphan** | `book_id` is a plain UUID, no FK constraint |
| `character_chats` | **Survives as orphan** | References by `book_title`/`book_author`, no FK |

### Why Chat Can't Open
1. `getChatList()` returns all chats (no filter on existing books) — orphaned chats **do appear** in the list
2. When tapped, the code tries `books.find(b => b.title.toLowerCase().trim() === chat.book_title.toLowerCase().trim())`
3. Book is gone from local `books` array → no `activeBook` → chat screen can't open

### What `book_chats` Already Stores
- `book_id` (UUID of deleted book)
- `book_title` (text)
- `book_author` (text)
- `content`, `role`, `created_at` (the actual messages)
- Does **NOT** store: `cover_url`, ratings, notes, reading status

## Key Decisions Needed

### 1. Read-only vs Full Chat
- **Read-only**: Just view old messages. Simplest.
- **Full chat**: Continue chatting with less context (no ratings/notes/reading status). More useful.

### 2. Character Chats Too?
Character chats for deleted books have the same problem. Should those stay accessible?

### 3. Cover Image for Deleted-Book Chats
`book_chats` doesn't store cover URLs. Options:
- Generic placeholder (simplest)
- Add `cover_url` column to `book_chats` (migration)
- Look it up from cache tables that might still have the cover

### 4. Re-adding the Same Book
If user adds the same book back later, should old chat history reconnect?
- Currently `book_chats` uses `book_id` (UUID) — a re-added book gets a new UUID, so they won't reconnect automatically
- Could match by normalized title+author instead

## Implementation Approach (When Ready)

### Minimal Fix
Construct a lightweight book-like object from `book_chats` data (`book_title`, `book_author`, `book_id`) when no matching book exists in the shelf. Use that to open the chat screen with full or limited functionality.

### Relevant Code Locations
| What | Where |
|------|-------|
| Book deletion | `app/page.tsx` ~line 5018, `packages/core/src/supabase/queries.ts` lines 119-126 |
| Chat list query | `app/services/chat-service.ts` lines 14-45 |
| Chat list rendering | `app/page.tsx` lines 7379-8080 |
| Book matching for chats | `app/page.tsx` ~line 7800 (`books.find(...)`) |
| Chat click handler | `app/page.tsx` ~lines 7902-7943 |
| Chat history loading | `app/components/BookChat.tsx` lines 86-108, `app/services/chat-service.ts` lines 151-169 |
| `book_chats` table schema | `migrations/add_book_chats.sql` |
| `character_chats` table schema | `migrations/add_character_chats.sql` |

### DB Schema Reference
```sql
-- book_chats: no FK on book_id
CREATE TABLE book_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id uuid NOT NULL,          -- plain UUID, no FK
  book_title text NOT NULL,
  book_author text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- character_chats: references by title/author, not book_id
CREATE TABLE character_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_title text NOT NULL,
  book_author text NOT NULL,
  character_name text NOT NULL,
  ...
);
```
