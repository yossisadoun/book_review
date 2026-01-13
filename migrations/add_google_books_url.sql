-- Add google_books_url column to books table
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS google_books_url text;

-- Add comment to document the column
COMMENT ON COLUMN public.books.google_books_url IS 'URL to the book on Google Books';
