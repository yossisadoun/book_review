# Book Review App - Function Reference

This document provides a logical categorization of all functions in the main `app/page.tsx` file.

## 🛠️ Utility Functions

### Asset & Path Handling
- `getAssetPath(path: string)` - Handles static asset paths for GitHub Pages compatibility

### Text Processing
- `first4DigitYear(text: string)` - Extracts first 4-digit year from text
- `isHebrew(text: string)` - Detects Hebrew characters in text

## 🌐 API Integration Functions

### AI/ML APIs (Grok)
- `fetchWithRetry(url, options, retries, delay)` - HTTP requests with automatic retry logic
- `getGrokSuggestions(query)` - Get book title suggestions from Grok AI
- `getGrokAuthorFacts(bookTitle, author)` - Fetch author facts from Grok AI
- `getGrokPodcastEpisodes(bookTitle, author)` - Get podcast episodes from Grok AI
- `getAISuggestions(query)` - Main entry point for AI suggestions
- `getAuthorFacts(bookTitle, author)` - Main entry point for author facts

### External APIs
- `getApplePodcastEpisodes(bookTitle, author)` - Fetch podcasts from Apple Podcasts API
- `getCuratedPodcastEpisodes(bookTitle, author)` - Fetch curated episodes from Supabase
- `getGoogleScholarAnalysis(bookTitle, author)` - Fetch academic articles from Google Scholar
- `getYouTubeVideos(bookTitle, author)` - Search YouTube for book-related videos
- `getRelatedBooks(bookTitle, author)` - Get book recommendations from Grok AI

## 💾 Database Operations

### Saving Functions
- `saveRelatedBooksToDatabase(bookTitle, bookAuthor, relatedBooks)` - Cache related books in Supabase
- `saveYouTubeVideosToDatabase(bookTitle, bookAuthor, videos)` - Cache YouTube videos in Supabase
- `saveArticlesToDatabase(bookTitle, bookAuthor, articles)` - Cache Google Scholar articles in Supabase

## 🎨 UI Component Functions

### Rating & Review
- `RatingStars` - Star rating component (inline component)
- `handleTap(star)` - Handle star rating selection
- `handleSkip()` - Skip rating for current dimension
- `handleRate(id, dimension, value)` - Update book rating in database

### Book Management
- `handleAddBook(meta)` - Add new book from search results
- `handleAddBookWithStatus(readingStatus, metaOverride)` - Add book with reading status
- `handleUpdateReadingStatus(id, readingStatus)` - Update existing book's reading status
- `handleDelete()` - Delete current book
- `handleSaveNote(text, bookId)` - Auto-save book notes
- `generateCanonicalBookId(title, author)` - Create unique book identifier

### Navigation & UI
- `handleSelectBook(book)` - Select book from search results
- `handleSuggestionClick(suggestion)` - Handle AI suggestion selection
- `handleSearch(titleToSearch)` - Execute book search
- `handleBookSwipe()` - Handle swipe gestures for book navigation

### Book View Navigation
- `handleNext()` - Navigate to next book
- `handlePrev()` - Navigate to previous book
- `handleSwipe()` - Handle swipe gestures (used in multiple components)

### Podcast Player
- `handlePlay(e, episode)` - Play/pause podcast episode

## 📊 Data Processing & Grouping

### Book Grouping Logic
- `getAlphabeticalRange(letter)` - Convert letter to alphabetical range (A-D, E-H, etc.)
- `groupedBooksForBookshelf` - Memoized grouping logic for bookshelf views

### Computed Values
- `currentEditingDimension` - Determine which rating dimension to show
- `showRatingOverlay` - Whether to show rating interface
- `showReadingStatusSelection` - Whether to show reading status selection
- `combinedPodcastEpisodes` - Merge curated and Apple podcast episodes

### Data Transformation
- `convertBookToApp(book)` - Transform database book to app format
- `convertBookToDb(book)` - Transform app book to database format

## 🔄 State Management & Effects

### Data Loading Effects
- Books loading and initial setup
- Author facts fetching
- Podcast episodes loading
- Analysis articles fetching
- YouTube videos fetching
- Related books fetching

### UI State Effects
- Header fade on scroll
- Book changes and data reloading
- Notes view management
- Gradient background updates
- Local storage synchronization

## 🎯 Search & Discovery

### Search Components
- `AddBookSheet` - Main search interface component
- Search state management (query, loading, results, suggestions)

### Discovery Features
- Wikipedia book lookup
- Apple Books integration
- Book deduplication logic
- Canonical ID generation

## 🎨 Visual & Animation

### Component-Specific State
- Rating component state (localValue, isLocked)
- Carousel state (currentIndex, isVisible, touch handling)
- Audio playback state (playingAudioUrl, audioRef)

### Animation & Interaction
- Swipe gesture handling across multiple components
- Book cover transitions
- Overlay animations

## 📱 Mobile & Touch Handling

### Touch Gestures
- Touch start/end tracking for swipe detection
- Book navigation swipes
- Podcast carousel swipes
- Analysis carousel swipes
- Videos carousel swipes

### Responsive Behavior
- iOS-specific scrolling behavior
- Touch event handling
- Mobile-optimized interactions

## 🔧 Configuration & Setup

### Local Storage
- Bookshelf grouping preferences
- Search source preferences
- User preferences persistence

### Error Handling
- API failure recovery
- Database error handling
- Network retry logic
- User feedback for errors

This function reference should help you navigate the codebase efficiently. Functions are grouped by their primary purpose, with related functionality clustered together.