# Wiki Shelf - Book Review App

A mobile-first, clean and simple book review app powered by Wikipedia and AI.

## Features

- Search books via Wikipedia
- Rate books across three dimensions: writing, insight, and flow
- Beautiful card-based UI with smooth animations
- Local storage persistence
- Support for both English and Hebrew books
- AI-powered book title suggestions

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up your Gemini API key (optional, for AI suggestions):
   - Copy `.env.local.example` to `.env.local`
   - Add your Gemini API key: `NEXT_PUBLIC_GEMINI_API_KEY=your_key_here`
   - Get your API key from: https://makersuite.google.com/app/apikey

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- Next.js 15 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React Icons
