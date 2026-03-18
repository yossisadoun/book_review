# Debounced Book Search with Parallel APIs

## Overview

Replace the current search implementation in AddBookSheet with a cleaner debounced-input pattern. The user types, and after 300ms of inactivity a single pair of API requests fires in parallel: iTunes Search + Supabase community books. Results are deduplicated and merged client-side.

## Current State

**File:** `app/components/AddBookSheet.tsx`

Current implementation uses two separate 200ms `setTimeout` debounces (lines 150-178) for community/user search, plus a manual `handleSearch()` triggered on form submit for Apple Books + Wikipedia. This means:
- Community results trickle in via debounce, but Apple Books only fires on explicit submit
- Wikipedia is searched as a second source (could be replaced or supplemented)
- No unified debounce — partial results appear at different times

## Proposed Flow

```
User types → query state updates → debouncedSearch() fires
  ↓
Cancel any in-flight search (AbortController)
  ↓
If query < 2 chars → clear results, done
  ↓
Wait 300ms (debounce window)
  ↓
If user typed again during 300ms → cancel, restart
  ↓
Fire two requests in parallel:
  ├── iTunes Search API (ebook, limit 15)
  └── Supabase community books (ilike title/author, limit 10)
  ↓
Deduplicate by normalized title|author key
  ↓
Display merged results
```

## API Details

### iTunes Search API
- **Endpoint:** `https://itunes.apple.com/search?term={query}&media=ebook&limit=15`
- **No API key required** — public endpoint
- Already implemented in `app/services/apple-books-service.ts`
- Returns: title, author, genre, publish year, cover (600x600), description, ISBN
- Current implementation includes Hebrew language detection and exact-match-first sorting

### Supabase Community Books
- **Table:** `books` (via Supabase client)
- **Query:** `ilike` on `title` and `author` columns
- **Filters:** Exclude current user's books, limit 10
- Already partially implemented in `AddBookSheet.tsx` lines 228-274 (`searchBooksFromDB`)

## Deduplication

Results are merged client-side with a normalized key:

```typescript
// Key: lowercase, whitespace-collapsed title + author
const normalizeKey = (title: string, author: string) =>
  `${title.toLowerCase().replace(/\s+/g, ' ').trim()}|${author.toLowerCase().replace(/\s+/g, ' ').trim()}`;
```

**Merge rules:**
1. iTunes results appear first (richer metadata, cover images)
2. Community-only entries (not in iTunes results) appear after
3. When duplicates exist, prefer the entry with a cover image
4. If both have covers, prefer iTunes (higher quality artwork)

## Implementation Plan

### 1. Unified Debounce Hook

Replace the two separate `setTimeout` debounces + manual submit with a single `useEffect` on `query`:

```typescript
const abortRef = useRef<AbortController | null>(null);

useEffect(() => {
  // Cancel previous search
  abortRef.current?.abort();

  if (query.length < 2) {
    setSearchResults([]);
    setDbBookResults([]);
    setIsSearching(false);
    return;
  }

  setIsSearching(true);
  const controller = new AbortController();
  abortRef.current = controller;

  const timeoutId = setTimeout(async () => {
    if (controller.signal.aborted) return;

    try {
      const [itunesResults, communityResults] = await Promise.all([
        searchAppleBooks(query, controller.signal),
        searchBooksFromDB(query, controller.signal),
      ]);

      if (controller.signal.aborted) return;

      const merged = deduplicateResults(itunesResults, communityResults);
      setSearchResults(merged);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[Search] Error:', err);
    } finally {
      if (!controller.signal.aborted) setIsSearching(false);
    }
  }, 300);

  return () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
}, [query]);
```

### 2. Pass AbortSignal to API Calls

Update `searchAppleBooks()` and `searchBooksFromDB()` to accept an `AbortSignal`:

```typescript
// apple-books-service.ts
export async function searchAppleBooks(query: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  // ...
}

// AddBookSheet.tsx — searchBooksFromDB
const { data } = await supabase.from('books')
  .select('title, author, cover_url, canonical_book_id')
  .or(`title.ilike.%${query}%,author.ilike.%${query}%`)
  .neq('user_id', userId)
  .limit(10)
  .abortSignal(signal);
```

### 3. Remove Manual Submit

- Remove the form `onSubmit` → `handleSearch()` path
- Search fires automatically as user types (after 300ms debounce)
- Keep the search input but remove the submit button / enter-to-search behavior
- Optionally keep a "Search" button as a way to force-fire immediately (cancels debounce timer)

### 4. User Search (Separate Debounce)

The user search (`searchUsers`) currently has its own 200ms debounce. Keep this as a separate concern since it queries a different table and displays in a different section. Could unify into the same parallel request if desired.

## Files to Modify

| File | Change |
|------|--------|
| `app/components/AddBookSheet.tsx` | Replace dual debounce + manual submit with unified 300ms debounce |
| `app/services/apple-books-service.ts` | Add `AbortSignal` parameter to search function |
| `app/services/wikipedia-service.ts` | Add `AbortSignal` parameter (if keeping Wikipedia search) |

## Behavior Summary

- User types "harry potter" quickly → only one request pair fires ~300ms after they stop typing
- Backspacing below 2 characters instantly clears results (no request)
- Navigating away or closing the sheet aborts any in-flight search
- Results appear in a single batch (no partial trickle)
- Community books that match iTunes results are deduplicated, not shown twice
