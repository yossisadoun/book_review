-- Check if an identity (Apple/Google) already exists in the system
-- Used by guest account connect flow to determine new vs existing account
CREATE OR REPLACE FUNCTION check_identity_exists(provider_name TEXT, provider_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.identities
    WHERE provider = provider_name AND provider_id = provider_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate books from anonymous user to a real user
-- Skips books that already exist in the target account (by canonical_book_id)
CREATE OR REPLACE FUNCTION migrate_anonymous_books(old_user_id UUID, new_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  migrated_count INTEGER;
BEGIN
  -- Move books that don't already exist in the target account
  UPDATE books SET user_id = new_user_id
  WHERE user_id = old_user_id
    AND canonical_book_id NOT IN (
      SELECT canonical_book_id FROM books WHERE user_id = new_user_id
    );
  GET DIAGNOSTICS migrated_count = ROW_COUNT;

  -- Also migrate feed items
  UPDATE feed_items SET user_id = new_user_id WHERE user_id = old_user_id;

  RETURN migrated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
