# Klipy GIF Integration for Chat

## What is Klipy?

Free GIF/sticker/clip search API, positioned as a Tenor replacement (Tenor shutting down June 30, 2026). Used by Canva, Figma, Miro, Discord. Led by ex-Tenor employees.

- **Business model**: Ad-based revenue sharing, not subscription
- **Content library**: 10M+ GIFs, stickers, memes, clips, AI-generated content
- **Products**: GIF API, Sticker API, Clip API, Memes API, Ads API

## API Details

**Base URL:** `https://api.klipy.com/api/v1/{API_KEY}`

**Authentication:** API key embedded in URL path. Get key from https://partner.klipy.com/

### Endpoints

| Endpoint | URL | Purpose |
|----------|-----|---------|
| Search | `GET /api/v1/{API_KEY}/gifs/search?q={query}` | Search GIFs by keyword |
| Trending | `GET /api/v1/{API_KEY}/gifs/trending` | Trending GIFs |
| Get by ID | `GET /api/v1/{API_KEY}/gifs/{SLUG}` | Single GIF by slug |
| Recent | `GET /api/v1/{API_KEY}/gifs/recent/{CUSTOMER_ID}` | Recent with ads |

### Query Parameters

| Parameter | Details |
|-----------|---------|
| `q` | Search query |
| `per_page` | Results per page (default: 24, min: 8, max: 50) |
| `page` | Pagination |
| `rating` | Content filter: `g`, `pg`, `pg-13`, `r` |
| `locale` | ISO 3166 Alpha-2 (e.g., `us_US`) |

### Response Format

```json
{
  "result": true,
  "data": {
    "data": [
      {
        "type": "gif",  // or "ad" for advertisement insertions
        "files": { /* different renditions/sizes with URLs */ },
        ...
      }
    ],
    "current_page": 1,
    "per_page": 24,
    "has_next": true
  }
}
```

Each item has a `files` object with multiple renditions (thumbnail, preview, full). Structure is similar to Tenor's format.

### Attribution Requirements

- Display **"Powered by KLIPY"** near content
- Use **"Search KLIPY"** as placeholder text in search input
- Use official KLIPY logo assets
- Required before production access is granted

### Rate Limits & Pricing

- **Free forever** (ad-based model)
- Rate limits not publicly documented — request production access via Partner Panel for unlimited calls
- Also available on RapidAPI marketplace

### No SDK

No npm package. Simple REST GET requests — use fetch directly.

---

## Current Chat Architecture

### Input Bar (BookChat.tsx lines 777-829)

```
┌──────────────────────────────────────────────┐
│ {} │ [textarea "Message"]           │ [Send→] │
└──────────────────────────────────────────────┘
```

- Left: Debug toggle `{}` (dev only)
- Center: Single-line textarea (rows=1, max-height 36px)
- Right: Round blue send button
- Glassmorphic pill: `rgba(255,255,255,0.55)`, `blur(12px)`, `border-radius: 24px`

### Message Storage

**Database (book_chats table):**
```sql
content text NOT NULL  -- plain TEXT, not JSONB
role text CHECK (role IN ('user', 'assistant'))
```

**TypeScript (chat-service.ts):**
```typescript
interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;  // plain text only
  created_at?: string;
}
```

### Message Rendering (BookChat.tsx lines 440-527)

- **User messages**: White text on blue background, text only
- **Assistant messages**: Split into segments via `splitAssistantMessage()`:
  - Text segments: White bubbles with markdown
  - Card segments: Embedded inline cards (podcasts, videos, books, albums, articles)
- Rich content for assistant messages already exists — parsed from text markers `[[type:index]]`
- **User messages have no rich content support yet**

### Message Send Flow (BookChat.tsx lines 163-283)

1. Validate non-empty text
2. Create `ChatMessage { role: 'user', content: messageText }`
3. Send to Supabase Edge Function
4. Get response string back
5. Parse `|||SUGGESTIONS|||` delimiter for follow-up chips
6. Fake-stream response word-by-word

---

## Decisions Needed

### 1. Message Storage Strategy

**No migration needed.** Assistant messages already embed rich media (albums, podcasts, videos, books) in the plain TEXT column using markers like `[[type:index]]`. The renderer in `splitAssistantMessage()` parses these markers and renders inline cards.

**Approach:** Follow the same convention for user-sent GIFs:
- Store as `[[gif:url|alt_text]]` in the `content` column
- Extend the user message renderer to detect and render GIF markers
- GIF-only messages: content = `[[gif:url|alt]]`
- GIF + text messages: content = `some text [[gif:url|alt]] more text`

This is consistent with the existing architecture and requires zero schema changes.

### 2. GIF Picker UX — DECIDED

**Button location:** Inside the chat input bar, right corner (left of send button).

**Picker behavior:**
- Tapping GIF button opens a picker overlay with search already available
- Search bar at top with "Search KLIPY" placeholder
- Trending grid below (2-3 columns of GIF thumbnails)
- Infinite scroll or load-more pagination
- "Powered by KLIPY" attribution at bottom

**Selection flow:**
- Tap a GIF → shows send button + X (cancel)
- Send → sends the GIF immediately
- X → dismisses selection, returns to grid

### 3. GIF + Text — DECIDED

**GIF only.** No mixed text+GIF messages. Selecting and sending a GIF is its own message.

### 4. AI Context — DECIDED

**Send description + URL to LLM.** When user sends a GIF, the LLM receives something like:
`[User sent a GIF: "celebration dance" — https://media.klipy.com/...]`
This allows the AI to respond contextually to the GIF's content.

### 5. GIF Rendering in Chat — DECIDED

**Full-width rendering.** GIF displays full-width inside the user message bubble area:
- Autoplay loop
- Rounded corners matching bubble style
- No padding/background crop — the GIF itself is the message

---

## Implementation Plan (When Ready)

### Step 1: API Service
Create `app/services/klipy-service.ts`:
- `searchGifs(query: string, page?: number): Promise<KlipyGif[]>`
- `getTrendingGifs(page?: number): Promise<KlipyGif[]>`
- API key stored in environment variable

### Step 2: GIF Picker Component
Create `app/components/GifPicker.tsx`:
- Bottom sheet with search + grid
- Debounced search input
- Masonry or fixed-height grid layout
- Loading states, pagination
- "Powered by KLIPY" attribution

### Step 3: Chat Input Modification
In `BookChat.tsx`:
- Add GIF button to input bar
- Toggle GIF picker open/close
- Handle GIF selection → create message

### Step 4: Message Format
- Add `metadata` column to `book_chats` (migration)
- Update `ChatMessage` interface
- Update `sendChatMessage()` to handle GIF payloads

### Step 5: Message Rendering
- Detect GIF messages in user bubble renderer
- Render as auto-playing image with rounded corners
- Handle loading/error states for GIF images

### Step 6: Backend
- Update Edge Function to accept GIF messages
- Optionally pass GIF context to LLM

### Relevant Files
| What | Where |
|------|-------|
| Chat input bar | `app/components/BookChat.tsx` lines 777-829 |
| Message rendering | `app/components/BookChat.tsx` lines 440-527 |
| Message send logic | `app/components/BookChat.tsx` lines 163-283 |
| Chat service | `app/services/chat-service.ts` |
| ChatMessage type | `app/services/chat-service.ts` lines 58-63 |
| DB schema | `migrations/add_book_chats.sql` |
| Edge Function | `supabase/functions/quick-processor/index.ts` |

### Sources
- [Klipy API Docs](https://docs.klipy.com/)
- [Klipy Partner Panel](https://partner.klipy.com/)
- [Klipy GitHub](https://github.com/KLIPY-com/Klipy-GIF-API)
- [Tenor → Klipy Migration Guide](https://dev.to/giorgi_khachidze_ab9ac4ad/migrate-your-gifsticker-api-from-tenor-to-klipy-in-seconds-4ph0)
