-- Add lists column to books table for organizing books into custom lists
ALTER TABLE books ADD COLUMN IF NOT EXISTS lists TEXT[] DEFAULT '{}';

-- GIN index for efficient array queries (e.g., finding all books in a specific list)
CREATE INDEX IF NOT EXISTS books_lists_idx ON books USING GIN (lists);
