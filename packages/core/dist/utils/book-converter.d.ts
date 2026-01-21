import { Book, BookWithRatings } from '../types/book';
export declare function convertBookToApp(book: Book): BookWithRatings;
export declare function convertBookToDb(book: BookWithRatings): Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export declare function calculateAvg(ratings: BookWithRatings['ratings']): string | null;
