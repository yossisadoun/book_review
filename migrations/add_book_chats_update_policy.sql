-- Allow users to update their own book_chats (needed for reassigning orphaned chats to re-added books)
CREATE POLICY "Users can update own chats" ON book_chats
  FOR UPDATE USING (auth.uid() = user_id);
