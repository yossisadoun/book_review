import { SupabaseClient } from '@supabase/supabase-js';
import { RelatedBook } from '../types/book';
export declare function getRelatedBooks(client: SupabaseClient, bookTitle: string, author: string, grokApiKey: string, storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
}): Promise<RelatedBook[]>;
