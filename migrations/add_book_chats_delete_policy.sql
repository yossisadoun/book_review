-- Allow users to delete their own chat messages
CREATE POLICY "Users can delete own chats" ON book_chats FOR DELETE USING (auth.uid() = user_id);
