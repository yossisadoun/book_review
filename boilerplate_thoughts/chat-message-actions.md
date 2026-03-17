# Chat Message Actions (Long Press Menu)

## Feature
Long press on any chat message to show a context menu with: **Copy**, **Reply**, **Delete**.

## Complexity Assessment
**Medium** — touches UI, state, and database.

## Architecture

### Long Press Detection
- `onTouchStart` / `onTouchEnd` with 500ms timeout on each message bubble
- Or use a lightweight long-press hook
- Show a context menu (floating popup) near the pressed message
- Dismiss on tap outside

### Context Menu UI
- Glassmorphic popup (matches app style)
- 3 options: Copy | Reply | Delete
- Positioned above or below the message depending on viewport space
- Animate in with scale+opacity

### Actions

#### Copy
- `navigator.clipboard.writeText(msg.content)`
- For GIF messages (`[[gif:url|alt]]`), copy the GIF URL
- Brief toast/haptic feedback

#### Reply
- Sets a "replying to" state showing a preview bar above the input
- Reply bar: small quote of original message + X to cancel
- When sent, message content prefixed with reply context (or stored as metadata)
- **Decision needed**: How to store reply references?
  - Option A: Prefix content with `> quoted text\n\nreply` (simple, no schema change)
  - Option B: Add `reply_to_id` column to `book_chats` (cleaner, needs migration)

#### Delete
- Confirm with subtle animation (message fades/shrinks out)
- Delete from Supabase: `supabase.from('book_chats').delete().eq('id', msg.id)`
- Remove from local state
- **Important**: Only delete user's own messages (RLS already handles this via `auth.uid() = user_id`)
- Messages loaded from history have `id` from DB; messages just sent may not have `id` yet (inserted async)
  - Need to ensure `saveChatMessages` returns the inserted IDs, or reload after save

### Database Changes

#### For Delete
- No migration needed — existing RLS DELETE policy already allows users to delete own rows
- Verify: `SELECT * FROM pg_policies WHERE tablename = 'book_chats' AND cmd = 'DELETE'`
- If no delete policy exists, need: `CREATE POLICY "Users can delete own chats" ON book_chats FOR DELETE USING (auth.uid() = user_id);`

#### For Reply (Option B)
```sql
ALTER TABLE book_chats ADD COLUMN reply_to_id uuid REFERENCES book_chats(id) ON DELETE SET NULL;
```

### State Changes (BookChat.tsx)
- `selectedMessage: ChatMessage | null` — which message is long-pressed
- `menuPosition: { x: number, y: number }` — where to show the menu
- `replyingTo: ChatMessage | null` — reply preview state
- Long press handler on each message bubble
- Menu component (inline or portaled)

### Key Considerations
1. **Message IDs**: Currently `saveChatMessages` does a bulk insert without returning IDs. Need to either:
   - Return inserted rows with `select('id')` after insert
   - Or assign UUIDs client-side before insert
2. **Optimistic deletion**: Remove from local state immediately, then delete from DB
3. **Assistant messages**: Can also be deleted (user owns the row since `user_id` is set)
4. **Cache invalidation**: After delete, update the chat cache (`setCache`)
5. **Haptic feedback**: On native, trigger haptic on long press detection

### Relevant Files
| What | Where |
|------|-------|
| Message rendering | `app/components/BookChat.tsx` lines ~486-567 |
| Message send/save | `app/components/BookChat.tsx` lines ~167-287 |
| Save to DB | `app/services/chat-service.ts` `saveChatMessages()` |
| Load from DB | `app/services/chat-service.ts` `loadChatHistory()` |
| Chat cache | `app/services/cache-service.ts` |
| DB schema | `migrations/add_book_chats.sql` |

### Implementation Steps
1. Add long-press handler to message bubbles
2. Create context menu component (Copy, Reply, Delete)
3. Implement Copy action
4. Implement Delete action (+ update `saveChatMessages` to return IDs)
5. Implement Reply action (reply bar UI + message format)
6. Add delete RLS policy if missing
