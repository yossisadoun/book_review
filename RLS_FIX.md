# Fix for Row Level Security (RLS) Issue

The populate script needs the **Service Role Key** to insert into the `curated_podcast_episodes` table because it has RLS enabled.

## Option 1: Add Service Role Key (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **service_role** key (⚠️ Keep this secret! It bypasses RLS)
5. Add it to your `.env.local` file:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

6. Run the script again: `npm run populate-curated`

## Option 2: Update RLS Policy (Less Secure)

If you want to allow inserts from the anon key, update the RLS policy in Supabase SQL Editor:

```sql
-- Allow anon key to insert (less secure, but works for this use case)
DROP POLICY IF EXISTS "curated_episodes_service_role_only" ON public.curated_podcast_episodes;

CREATE POLICY "curated_episodes_anon_insert"
ON public.curated_podcast_episodes FOR INSERT
WITH CHECK (true);

CREATE POLICY "curated_episodes_anon_update"
ON public.curated_podcast_episodes FOR UPDATE
USING (true)
WITH CHECK (true);
```

**Note:** Option 1 (Service Role Key) is more secure and recommended.
