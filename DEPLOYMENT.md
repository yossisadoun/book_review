# Deployment Guide

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `book_review` (or any name you prefer)
3. Description: "BOOK - A mobile-first book review app"
4. Choose **Public** or **Private**
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 2: Push Code to GitHub

After creating the repository, run these commands:

```bash
git remote set-url origin https://github.com/yossisadoun/book_review.git
# Or if you used a different name:
# git remote set-url origin https://github.com/yossisadoun/YOUR_REPO_NAME.git

git push -u origin main
```

## Step 3: Set Up GitHub Pages

### Option A: GitHub Pages (Static Export)

**Important Note:** GitHub Pages only serves static files. This Next.js app is configured for static export, but you'll need to:

1. **Enable GitHub Pages:**
   - Go to your repository → Settings → Pages
   - Source: Select "GitHub Actions"
   - Save

2. **Add Secrets:**
   - Go to Settings → Secrets and variables → Actions
   - Add these secrets:
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://nuhpfsbjjqoikwszlphr.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your anon key)
     - `NEXT_PUBLIC_GEMINI_API_KEY` = `AIzaSyDAB1z9JbotuMLPE5rRU6wlD-vfgcoSolo`

3. **Update Supabase Redirect URLs:**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add your GitHub Pages URL to Redirect URLs:
     - `https://yossisadoun.github.io/book_review/auth/callback`
   - Update Site URL to your GitHub Pages URL

4. **Trigger Deployment:**
   - The workflow will run automatically on push
   - Or go to Actions tab and run it manually

### Option B: Vercel (Recommended for Next.js)

Vercel is the recommended platform for Next.js apps and supports all Next.js features:

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "Add New Project"
4. Import your `book_review` repository
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_GEMINI_API_KEY`
6. Click "Deploy"
7. Update Supabase redirect URLs to your Vercel URL

### Option C: Netlify

1. Go to https://netlify.com
2. Sign in with GitHub
3. Click "Add new site" → "Import an existing project"
4. Select your repository
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `out`
6. Add environment variables
7. Deploy

## Step 4: Update Supabase Auth URLs

After deployment, update Supabase:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. **Site URL:** Your deployed URL (e.g., `https://yossisadoun.github.io/book_review`)
3. **Redirect URLs:** Add:
   - `https://yossisadoun.github.io/book_review/**`
   - `https://yossisadoun.github.io/book_review/auth/callback`

## Troubleshooting

- **403 Errors:** Make sure RLS policies are set up correctly in Supabase
- **Auth not working:** Check redirect URLs in Supabase match your deployment URL
- **Build fails:** Check that all environment variables are set in GitHub Secrets
