-- Add Apple Books rating columns to books table
-- averageUserRating (0-5 scale) and userRatingCount from iTunes API

ALTER TABLE books
ADD COLUMN IF NOT EXISTS apple_rating numeric(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS apple_rating_count integer DEFAULT NULL;
