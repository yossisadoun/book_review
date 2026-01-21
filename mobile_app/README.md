# BOOK - Mobile App

Native iOS + Android app for the book review platform, built with Expo and React Native.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file in the root directory:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GROK_API_KEY=your_grok_api_key
EXPO_PUBLIC_YOUTUBE_API_KEY=your_youtube_api_key
```

3. Build the core package:
```bash
cd ../packages/core && npm run build
```

4. Start the development server:
```bash
npm start
```

## Project Structure

- `app/` - Expo Router file-based routing
  - `(auth)/` - Authentication screens
  - `(tabs)/` - Main app screens (home, add book)
- `components/` - Reusable React Native components
- `contexts/` - React context providers (Auth)
- `hooks/` - Custom React hooks
- `lib/` - Utility functions and configuration

## Current Status

✅ Phase 1 Complete:
- Expo app structure with TypeScript
- Core dependencies installed
- Basic navigation with expo-router
- Auth context and login screen setup
- Supabase client configuration

✅ Phase 2 Partial:
- Core package structure created
- Types extracted
- Basic utilities extracted (book converter, hebrew detector, etc.)
- Supabase client factory and queries

🚧 Next Steps:
- Extract API logic (Wikipedia, Apple Books, Grok) to core package
- Implement home screen with book carousel
- Implement book search and add flow
- Implement rating system
- Add related books, insights, and trivia features
- Add native feel (gestures, animations, haptics)

## Development

The app uses the shared `@book-review/core` package located in `../packages/core`. After making changes to the core package, rebuild it:

```bash
cd ../packages/core && npm run build
```

## Notes

- The app shares the same Supabase backend as the web app
- All business logic is in the `@book-review/core` package for reuse
- The app follows the same data contracts and schema as the web app
