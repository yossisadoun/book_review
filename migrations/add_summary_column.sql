-- Add summary column to books table
-- This column stores a short synopsis/summary of the book from Apple Books or Wikipedia

ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add comment to document the column
COMMENT ON COLUMN public.books.summary IS 'Short synopsis/summary of the book extracted from Apple Books or Wikipedia';
