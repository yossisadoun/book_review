"use strict";
// Related books API functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRelatedBooks = getRelatedBooks;
const fetch_retry_1 = require("../utils/fetch-retry");
const prompts_1 = require("../utils/prompts");
const grok_usage_1 = require("../utils/grok-usage");
const apple_books_1 = require("./apple-books");
const queries_1 = require("../supabase/queries");
async function getRelatedBooks(client, bookTitle, author, grokApiKey, storage) {
    console.log(`[getRelatedBooks] 🔄 Fetching related books for "${bookTitle}" by ${author}`);
    // Check database cache first
    try {
        const normalizedTitle = bookTitle.toLowerCase().trim();
        const normalizedAuthor = author.toLowerCase().trim();
        const { data: cachedData, error: cacheError } = await client
            .from('related_books')
            .select('related_books')
            .eq('book_title', normalizedTitle)
            .eq('book_author', normalizedAuthor)
            .maybeSingle();
        if (!cacheError && cachedData && cachedData.related_books && Array.isArray(cachedData.related_books)) {
            if (cachedData.related_books.length > 0) {
                console.log(`[getRelatedBooks] ✅ Found ${cachedData.related_books.length} cached related books in database`);
                return cachedData.related_books;
            }
            else {
                console.log(`[getRelatedBooks] ✅ Found cached "no results" - skipping Grok API call`);
                return [];
            }
        }
        else if (cacheError && cacheError.code !== 'PGRST116') {
            console.warn('[getRelatedBooks] ⚠️ Error checking cache:', cacheError);
        }
    }
    catch (err) {
        console.warn('[getRelatedBooks] ⚠️ Error checking cache:', err);
    }
    if (!grokApiKey || grokApiKey.trim() === '') {
        console.warn('[getRelatedBooks] ⚠️ Grok API key not found');
        return [];
    }
    if (grokApiKey.length < 20) {
        console.warn('[getRelatedBooks] ⚠️ Grok API key appears to be invalid');
        return [];
    }
    try {
        const prompts = await (0, prompts_1.loadPrompts)();
        if (!prompts.related_books || !prompts.related_books.prompt) {
            console.error('[getRelatedBooks] ❌ related_books prompt not found');
            return [];
        }
        const prompt = (0, prompts_1.formatPrompt)(prompts.related_books.prompt, { bookTitle, author });
        const payload = {
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            model: 'grok-4-1-fast-non-reasoning',
            stream: false,
            temperature: 0.7,
        };
        const data = await (0, fetch_retry_1.fetchWithRetry)('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${grokApiKey}`,
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        }, 2, 3000);
        // Log usage
        if (data.usage && storage) {
            (0, grok_usage_1.logGrokUsage)('getRelatedBooks', data.usage, storage);
        }
        const content = data.choices?.[0]?.message?.content || '[]';
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        const result = JSON.parse(jsonStr);
        const relatedBooks = Array.isArray(result) ? result : [];
        console.log('[getRelatedBooks] ✅ Received', relatedBooks.length, 'related books from Grok');
        // Enrich each book with Apple Books data
        const enrichedBooks = await Promise.all(relatedBooks.map(async (book) => {
            try {
                const searchQuery = `${book.title} ${book.author}`;
                const appleBooks = await (0, apple_books_1.lookupBooksOnAppleBooks)(searchQuery);
                if (appleBooks.length > 0) {
                    const bookTitleLower = book.title.toLowerCase();
                    let bestMatch = appleBooks[0];
                    for (const appleBook of appleBooks) {
                        const appleTitleLower = (appleBook.title || '').toLowerCase();
                        if (appleTitleLower === bookTitleLower) {
                            bestMatch = appleBook;
                            break;
                        }
                    }
                    return {
                        ...book,
                        thumbnail: bestMatch.cover_url || undefined,
                        cover_url: bestMatch.cover_url || undefined,
                        publish_year: bestMatch.publish_year ?? undefined,
                        google_books_url: bestMatch.google_books_url || undefined,
                        genre: bestMatch.genre || undefined,
                    };
                }
                return book;
            }
            catch (err) {
                console.error(`[getRelatedBooks] ⚠️ Error enriching book "${book.title}":`, err);
                return book;
            }
        }));
        console.log('[getRelatedBooks] ✅ Enriched', enrichedBooks.length, 'related books');
        // Save to database cache
        await (0, queries_1.saveRelatedBooks)(client, bookTitle, author, enrichedBooks);
        return enrichedBooks;
    }
    catch (err) {
        console.error('[getRelatedBooks] ❌ Error:', err);
        return [];
    }
}
