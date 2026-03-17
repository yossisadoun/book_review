# Apple Books Search in Bookshelf Chat (Book.luver)

## Overview

Allow Book.luver (general/bookshelf chat) to search for books via the Apple Books/iTunes API when recommending or discussing books the user doesn't have on their shelf. The bot surfaces real book results with covers, links, and metadata inline in the conversation.

## How It Works

### Trigger
- User asks "what should I read next?" or "know any good sci-fi?"
- Book.luver recommends a title → instead of just text, it searches Apple Books and returns a real result card
- Or user explicitly asks: "can you find [book title]?"

### Flow
1. LLM generates a recommendation with a special marker: `[[search_book:query]]`
2. Client detects the marker, calls Apple Books API with the query
3. Replaces the marker with an inline book card (cover, title, author, link)
4. Card has an "Add to Shelf" button (reuses existing `onAddBook` flow)

## Apple Books API (Already Exists)

The app already has Apple Books search at `app/page.tsx` ~lines 3081-3192 using the iTunes Search API:
- `https://itunes.apple.com/search?term={query}&media=ebook&limit=5`
- Returns: title, author, cover art, iTunes URL, description, price
- No API key needed — it's public

## Message Format

Follow existing marker convention:
- `[[search_book:the great gatsby]]` → triggers search, renders result card
- Multiple results: `[[search_book:query|index]]` to pick specific result

## Edge Function Changes

- In regular book chat with `generalMode: true` and in `mode: 'proactive'`
- Add to system prompt: "When recommending a specific book the user might want to add, include `[[search_book:exact title by author]]` so we can show them the real book. Only use this for specific recommendations, not general discussion."
- LLM naturally includes it when suggesting titles

## Client-Side Rendering

- Detect `[[search_book:query]]` in `splitAssistantMessage()` — new segment type
- On render, call iTunes search API client-side
- Show inline card: cover thumbnail, title, author, star rating if available
- "Add to Shelf" button triggers existing `onAddBook` handler
- Loading state while searching (small spinner in card)

## Key Considerations

- **Cache results**: Same query in same session shouldn't hit API twice
- **Fallback**: If Apple search returns nothing, render as plain text recommendation
- **Rate limiting**: iTunes API is generous but add a small debounce
- **Existing code reuse**: The Apple Books search logic already exists in page.tsx — extract it into a service (`app/services/apple-books-service.ts`) or reuse directly

## Implementation Steps

1. Extract Apple Books search into `app/services/apple-books-service.ts` (from page.tsx lines 3081-3192)
2. Add `search_book` segment type to `splitAssistantMessage()` in BookChat.tsx
3. Create inline book result card component (cover + title + author + "Add" button)
4. Update edge function system prompt for general mode to allow `[[search_book:]]` markers
5. Wire "Add to Shelf" to existing `onAddBook` prop

## Relevant Files

| What | Where |
|------|-------|
| Existing Apple Books search | `app/page.tsx` ~lines 3081-3192 |
| InlineChatCard | `app/components/BookChat.tsx` |
| General mode context | `app/page.tsx` ~lines 7509-7526 |
| Edge function system prompt | `supabase/functions/quick-processor/index.ts` |
| onAddBook handler | `app/components/BookChat.tsx` props |
