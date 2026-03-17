# Proactive Chat Messages

## Overview
Chats send unsolicited messages to users to drive engagement. Must feel natural, like a friend texting — not marketing spam.

## Chat Types (Phase 1)

### Book.luver (General Chat)
- Daily music rec based on shelf ("Morning playlist for someone who loves Murakami")
- "You haven't picked up anything new — want a recommendation?"
- Surface fun facts from books on shelf
- Most content to work with, lowest risk of feeling weird

### Currently Reading Books
- Check-in: "How's it going with [book]?"
- Suggest related content the user hasn't seen: podcasts, videos, music, articles from the book's cached data
- "Found this podcast episode about [book] you might like"
- Open-ended, never assume where user is in the book
- Has access to: videos, podcasts, music, articles (from book page cache)

### Characters (Phase 2 — not now)
- Character "reaching out" in-character
- Only after 5+ message conversations
- "Been thinking about what you said..."
- Trickiest to get right — save for later

## Delivery Mechanism
- **Unread badge** on chat tab — no push notifications (initially)
- Message appears in chat history when user opens it, as if sent while away
- Subtle "arriving" feel, not intrusive

## Frequency & Back-off
- Max 1 unsolicited message per chat per week
- If user doesn't reply to last proactive message → stop until they initiate
- Global cap: 2-3 proactive messages across all chats per day
- Time-of-day awareness: don't "send" at 3am (use local time)

## Generation Strategy: On App Open (Option B)
- When user opens app, check if any chat qualifies for a proactive message
- Generate message on the spot, backdate timestamp slightly (e.g. 5-30 min ago) so it looks like it arrived while away
- Saves API credits — no generation if user never opens app
- Can show brief typing animation if generating live

### Qualification Logic
A chat qualifies if ALL are true:
1. Last proactive message (if any) was replied to by user, OR no proactive message sent yet
2. Last proactive message was > 7 days ago (or never)
3. Global daily proactive count < 3
4. User has been active in app within last 7 days (don't message dormant users)
5. For "currently reading" — book status is still "reading"

## Message Style
- Short: 1-2 sentences max
- Vary format: sometimes question, sometimes share, sometimes suggestion
- Reference time naturally ("It's been a few days...", "Just remembered...")
- Never repeat patterns back-to-back
- For content suggestions: include the actual content card (podcast/video/music) inline

## Technical Implementation

### Database
- Add `is_proactive` boolean column to `book_chats` (default false)
- Or use a separate `proactive_messages` table tracking: chat_id, sent_at, replied (boolean)
- Need to track: when last proactive was sent, whether user replied after it

### Generation Flow
1. App opens → check qualification for each active chat
2. Pick top 1-2 candidates (prioritize currently-reading over general)
3. Call edge function with `mode: 'proactive'` + book context
4. Insert message into `book_chats` with `is_proactive: true`, backdated timestamp
5. Update unread badge count

### Edge Function Changes
- New mode `'proactive'` in `quick-processor`
- System prompt instructs: short, casual, one specific thing (not generic)
- For currently-reading: include available content (podcasts/videos/music titles) so AI can recommend specific items
- For bookluver: include shelf summary so AI can reference specific books

### Content Suggestion Messages
- For currently-reading books, the proactive message can reference specific cached content
- Example: "There's a great podcast episode about [book] — [podcast title]. Want me to play it?"
- Render as a regular assistant message with an inline content card
- Use existing `[[podcast:0]]` / `[[video:0]]` markers

### Relevant Files
| What | Where |
|------|-------|
| Chat history load | `app/services/chat-service.ts` `loadChatHistory()` |
| Chat save | `app/services/chat-service.ts` `saveChatMessages()` |
| Edge function | `supabase/functions/quick-processor/index.ts` |
| BookChat component | `app/components/BookChat.tsx` |
| App open / mount | `app/page.tsx` main useEffect hooks |
| Book context with content | `BookChatContext` in `chat-service.ts` |

### Migration
```sql
-- Track proactive messages
ALTER TABLE book_chats ADD COLUMN is_proactive boolean DEFAULT false;

-- Or separate tracking table
CREATE TABLE proactive_message_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  chat_type text NOT NULL, -- 'book', 'general', 'character'
  chat_key text NOT NULL,  -- book_id or 'general' or 'character::book'
  sent_at timestamptz DEFAULT now(),
  was_replied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE proactive_message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own proactive logs" ON proactive_message_log
  FOR ALL USING (auth.uid() = user_id);
```
