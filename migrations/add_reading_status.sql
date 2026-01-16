-- Add reading_status column to books table
-- This column stores the reading status: 'read_it', 'reading', 'want_to_read', or NULL

ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS reading_status TEXT 
CHECK (reading_status IN ('read_it', 'reading', 'want_to_read') OR reading_status IS NULL);

-- Add index for faster queries when filtering by reading status
CREATE INDEX IF NOT EXISTS books_reading_status_idx ON public.books(reading_status);

-- Add comment to document the column
COMMENT ON COLUMN public.books.reading_status IS 'Reading status: read_it, reading, want_to_read, or NULL';
