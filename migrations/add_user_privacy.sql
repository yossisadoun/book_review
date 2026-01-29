-- Add privacy setting for user profiles
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Allow users to update their own privacy setting (if RLS is enabled)
CREATE POLICY "Users can update their own privacy"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMENT ON COLUMN public.users.is_public IS 'Whether the user profile is publicly visible';
