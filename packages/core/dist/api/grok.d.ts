import { Book, AuthorFactsResult } from '../types/book';
export declare function getGrokSuggestions(query: string, grokApiKey: string, storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
}): Promise<string[]>;
export declare function getGrokAuthorFacts(bookTitle: string, author: string, grokApiKey: string, storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
}): Promise<AuthorFactsResult>;
export declare function lookupBookOnGrok(query: string, grokApiKey: string, storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
}): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> | null>;
export declare function lookupBooksOnGrok(query: string, grokApiKey: string, storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
}): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>[]>;
