# BOOK - Book Review App

A mobile-first, clean and simple book review app powered by Wikipedia, AI, and Supabase.

## Features

- **Google Sign-In** via Supabase Auth
- Search books via Wikipedia
- Rate books across three dimensions: writing, insight, and flow
- Beautiful card-based UI with smooth animations
- Cloud database persistence with Supabase
- Row-level security (RLS) - each user only sees their own books
- Support for both English and Hebrew books
- AI-powered book title suggestions (Gemini)

## Getting Started

### 1. Install dependencies:
```bash
npm install
```

### 2. Set up Supabase:

1. Create a Supabase project at https://supabase.com
2. Enable Google OAuth provider:
   - Go to Authentication → Providers → Google
   - Enable Google provider
   - Add your Google OAuth credentials (Client ID & Secret)
   - Add redirect URI: `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
3. Create the database table:
   - Go to SQL Editor in Supabase
   - Run this SQL:

```sql
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  author text,
  publish_year int,
  cover_url text,
  wikipedia_url text,

  rating_writing int check (rating_writing between 1 and 5),
  rating_insight int check (rating_insight between 1 and 5),
  rating_flow int check (rating_flow between 1 and 5),
  author_facts jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index books_user_id_created_at_idx on public.books (user_id, created_at);

alter table public.books enable row level security;

-- Read only your rows
create policy "books_select_own"
on public.books for select
using (auth.uid() = user_id);

-- Insert only for yourself
create policy "books_insert_own"
on public.books for insert
with check (auth.uid() = user_id);

-- Update only your rows
create policy "books_update_own"
on public.books for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Delete only your rows
create policy "books_delete_own"
on public.books for delete
using (auth.uid() = user_id);
```

**Migration for existing tables:** If you already have the `books` table, run this to add the `author_facts` column:

```sql
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS author_facts jsonb;
```

4. Get your Supabase credentials:
   - Go to Project Settings → API
   - Copy your Project URL and anon/public key

### 3. Set up environment variables:

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

- Get Supabase credentials from: https://supabase.com/dashboard/project/_/settings/api
- Get Gemini API key from: https://makersuite.google.com/app/apikey (optional, for AI suggestions)

### 4. Configure Supabase Auth URLs:

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `http://localhost:3000` (for development)
- **Redirect URLs**: Add `http://localhost:3000/**`

For production, update these to your production URL.

### 5. Run the development server:
```bash
npm run dev
```

### 6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- Next.js 15 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React Icons
- Supabase (Auth + Database)
- Google Gemini API (for book suggestions)
