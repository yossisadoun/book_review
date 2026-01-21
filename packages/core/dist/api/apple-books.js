"use strict";
// Apple Books API (iTunes Search) functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupBooksOnAppleBooks = lookupBooksOnAppleBooks;
exports.lookupBookOnAppleBooks = lookupBookOnAppleBooks;
const fetch_retry_1 = require("../utils/fetch-retry");
const hebrew_detector_1 = require("../utils/hebrew-detector");
async function lookupBooksOnAppleBooks(query) {
    try {
        const country = (0, hebrew_detector_1.isHebrew)(query) ? 'il' : 'us';
        const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=${country}&media=ebook&limit=10`;
        const data = await (0, fetch_retry_1.fetchWithRetry)(searchUrl);
        if (!data.results || data.results.length === 0) {
            console.log(`[lookupBooksOnAppleBooks] No results found for: "${query}"`);
            return [];
        }
        // Sort results: exact matches first
        const queryLower = query.toLowerCase();
        const sortedResults = [...data.results].sort((a, b) => {
            const aTitle = a.trackName?.toLowerCase() || '';
            const bTitle = b.trackName?.toLowerCase() || '';
            const aExact = aTitle === queryLower ? 3 : aTitle.includes(queryLower) || queryLower.includes(aTitle) ? 2 : 1;
            const bExact = bTitle === queryLower ? 3 : bTitle.includes(queryLower) || queryLower.includes(bTitle) ? 2 : 1;
            return bExact - aExact;
        });
        // Take top 7 results
        const topResults = sortedResults.slice(0, 7);
        const books = topResults.map((item) => {
            const title = item.trackName || query;
            const author = item.artistName || 'Unknown Author';
            // Extract publish year from releaseDate
            let publishYear = undefined;
            if (item.releaseDate) {
                const yearMatch = item.releaseDate.match(/\d{4}/);
                if (yearMatch) {
                    publishYear = parseInt(yearMatch[0]);
                }
            }
            // Extract genre
            let genre = undefined;
            if (item.primaryGenreName) {
                genre = item.primaryGenreName.split(' ')[0];
            }
            else if (item.genres && Array.isArray(item.genres) && item.genres.length > 0) {
                genre = item.genres[0].split(' ')[0];
            }
            // Get cover image
            const coverUrl = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : item.artworkUrl512 || null;
            // Get Apple Books URL
            const appleBooksUrl = item.trackViewUrl || null;
            // Extract summary/description
            let summary = undefined;
            if (item.description) {
                summary = item.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            }
            // Extract ISBN
            let isbn = undefined;
            if (item.isbn) {
                isbn = String(item.isbn).replace(/-/g, '');
            }
            else if (item.isbn13) {
                isbn = String(item.isbn13).replace(/-/g, '');
            }
            else if (item.isbn10) {
                isbn = String(item.isbn10).replace(/-/g, '');
            }
            else if (item.description) {
                const isbnMatch = item.description.match(/isbn[:\s-]*([0-9X-]{10,17})/i);
                if (isbnMatch) {
                    isbn = isbnMatch[1].replace(/-/g, '');
                }
            }
            return {
                title: title,
                author: author,
                publish_year: publishYear,
                genre: genre,
                cover_url: coverUrl,
                wikipedia_url: null,
                google_books_url: appleBooksUrl,
                summary: summary || null,
                isbn: isbn || undefined,
            };
        });
        console.log(`[lookupBooksOnAppleBooks] ✅ Found ${books.length} books`);
        return books;
    }
    catch (err) {
        console.error('[lookupBooksOnAppleBooks] ❌ Error searching Apple Books:', err);
        return [];
    }
}
async function lookupBookOnAppleBooks(query) {
    const books = await lookupBooksOnAppleBooks(query);
    return books.length > 0 ? books[0] : null;
}
