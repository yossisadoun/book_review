import { Book } from '../types/book';
export declare function getWikidataItemForTitle(pageTitle: string, lang?: string): Promise<string | null>;
export declare function getAuthorAndYearFromWikidata(qid: string, lang?: string): Promise<{
    author: string;
    publishYear?: number;
    genre?: string;
    isbn?: string;
}>;
export declare function lookupBooksOnWikipedia(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>[]>;
export declare function lookupBookOnWikipedia(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> | null>;
