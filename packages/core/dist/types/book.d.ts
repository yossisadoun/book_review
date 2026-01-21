export type ReadingStatus = 'read_it' | 'reading' | 'want_to_read' | null;
export interface PodcastEpisode {
    title: string;
    length?: string;
    air_date?: string;
    url: string;
    audioUrl?: string;
    platform: string;
    podcast_name?: string;
    episode_summary: string;
    podcast_summary: string;
    thumbnail?: string;
}
export interface AnalysisArticle {
    title: string;
    snippet: string;
    url: string;
    authors?: string;
    year?: string;
}
export interface YouTubeVideo {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    channelTitle: string;
    publishedAt: string;
    videoId: string;
}
export interface RelatedBook {
    title: string;
    author: string;
    reason: string;
    thumbnail?: string;
    cover_url?: string;
    publish_year?: number;
    wikipedia_url?: string;
    google_books_url?: string;
    genre?: string;
}
export interface ResearchContentItem {
    source_url: string;
    trivia_fact: string;
    deep_insight: string;
}
export interface ResearchPillar {
    pillar_name: string;
    content_items: ResearchContentItem[];
}
export interface BookResearch {
    book_title: string;
    author: string;
    pillars: ResearchPillar[];
}
export interface DomainInsights {
    label: string;
    facts: string[];
}
export interface AuthorFactsResult {
    facts: string[];
    first_issue_year?: number | null;
}
export interface TriviaNote {
    bookTitle: string;
    author: string;
    fact: string;
}
export interface TriviaQuestion {
    question: string;
    correct_answer: string;
    wrong_answers: string[];
}
export interface Book {
    id: string;
    user_id: string;
    canonical_book_id?: string;
    title: string;
    author: string;
    publish_year?: number | null;
    first_issue_year?: number | null;
    genre?: string | null;
    isbn?: string | null;
    cover_url?: string | null;
    wikipedia_url?: string | null;
    google_books_url?: string | null;
    summary?: string | null;
    rating_writing?: number | null;
    rating_insights?: number | null;
    rating_flow?: number | null;
    rating_world?: number | null;
    rating_characters?: number | null;
    reading_status?: ReadingStatus;
    author_facts?: string[] | null;
    podcast_episodes?: PodcastEpisode[] | null;
    podcast_episodes_grok?: PodcastEpisode[] | null;
    podcast_episodes_apple?: PodcastEpisode[] | null;
    podcast_episodes_curated?: PodcastEpisode[] | null;
    notes?: string | null;
    created_at: string;
    updated_at: string;
}
export interface BookWithRatings extends Omit<Book, 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> {
    ratings: {
        writing: number | null;
        insights: number | null;
        flow: number | null;
        world: number | null;
        characters: number | null;
    };
    reading_status?: ReadingStatus;
    author_facts?: string[];
    podcast_episodes?: PodcastEpisode[];
    podcast_episodes_grok?: PodcastEpisode[];
    podcast_episodes_apple?: PodcastEpisode[];
    podcast_episodes_curated?: PodcastEpisode[];
    notes?: string | null;
}
export type BookInput = Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
