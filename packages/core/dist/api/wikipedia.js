"use strict";
// Wikipedia and Wikidata API functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWikidataItemForTitle = getWikidataItemForTitle;
exports.getAuthorAndYearFromWikidata = getAuthorAndYearFromWikidata;
exports.lookupBooksOnWikipedia = lookupBooksOnWikipedia;
exports.lookupBookOnWikipedia = lookupBookOnWikipedia;
const fetch_retry_1 = require("../utils/fetch-retry");
const hebrew_detector_1 = require("../utils/hebrew-detector");
async function getWikidataItemForTitle(pageTitle, lang = 'en') {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(pageTitle)}&prop=pageprops&ppprop=wikibase_item`;
    const data = await (0, fetch_retry_1.fetchWithRetry)(url);
    const pages = data?.query?.pages;
    if (!pages)
        return null;
    const page = Object.values(pages)[0];
    return page?.pageprops?.wikibase_item ?? null;
}
async function getAuthorAndYearFromWikidata(qid, lang = 'en') {
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${encodeURIComponent(qid)}&props=claims`;
    const entityData = await (0, fetch_retry_1.fetchWithRetry)(entityUrl);
    const ent = entityData?.entities?.[qid];
    const claims = ent?.claims ?? {};
    const authorClaims = claims?.P50 ?? [];
    const authorIds = authorClaims.map((c) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean);
    const dateClaim = claims?.P577?.[0] ?? claims?.P571?.[0];
    const timeStr = dateClaim?.mainsnak?.datavalue?.value?.time;
    const publishYear = (0, fetch_retry_1.first4DigitYear)(timeStr);
    // Extract genre from P136 (genre property)
    let genre = undefined;
    const genreClaims = claims?.P136 ?? [];
    if (genreClaims.length > 0) {
        const genreId = genreClaims[0]?.mainsnak?.datavalue?.value?.id;
        if (genreId) {
            const genreUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${encodeURIComponent(genreId)}&props=labels&languages=${lang}|en`;
            const genreData = await (0, fetch_retry_1.fetchWithRetry)(genreUrl);
            const genreEntity = genreData?.entities?.[genreId];
            const genreLabel = genreEntity?.labels?.[lang]?.value || genreEntity?.labels?.en?.value;
            if (genreLabel) {
                genre = genreLabel.split(' ')[0];
            }
        }
    }
    // Extract ISBN from P212 (ISBN-13) or P957 (ISBN-10) properties
    let isbn = undefined;
    const isbn13Claims = claims?.P212 ?? [];
    const isbn10Claims = claims?.P957 ?? [];
    if (isbn13Claims.length > 0) {
        const isbnValue = isbn13Claims[0]?.mainsnak?.datavalue?.value;
        if (typeof isbnValue === 'string') {
            isbn = isbnValue.replace(/-/g, '');
        }
        else if (typeof isbnValue === 'number') {
            isbn = String(isbnValue);
        }
    }
    else if (isbn10Claims.length > 0) {
        const isbnValue = isbn10Claims[0]?.mainsnak?.datavalue?.value;
        if (typeof isbnValue === 'string') {
            isbn = isbnValue.replace(/-/g, '');
        }
        else if (typeof isbnValue === 'number') {
            isbn = String(isbnValue);
        }
    }
    let author = lang === 'he' ? 'מחבר לא ידוע' : 'Unknown Author';
    if (authorIds.length > 0) {
        const authorsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${encodeURIComponent(authorIds.join('|'))}&props=labels&languages=${lang}|en`;
        const authorsData = await (0, fetch_retry_1.fetchWithRetry)(authorsUrl);
        const labels = authorIds
            .map((id) => {
            const entity = authorsData?.entities?.[id];
            return entity?.labels?.[lang]?.value || entity?.labels?.en?.value;
        })
            .filter(Boolean);
        if (labels.length > 0)
            author = labels.join(', ');
    }
    return { author, publishYear, genre, isbn };
}
async function lookupBooksOnWikipedia(query) {
    const lang = (0, hebrew_detector_1.isHebrew)(query) ? 'he' : 'en';
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=7`;
    const searchData = await (0, fetch_retry_1.fetchWithRetry)(searchUrl);
    const results = searchData.query?.search || [];
    if (results.length === 0) {
        return [];
    }
    // Process top 7 results
    const books = await Promise.all(results.slice(0, 7).map(async (result) => {
        const pageTitle = result.title;
        const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
        const summaryData = await (0, fetch_retry_1.fetchWithRetry)(summaryUrl);
        const qid = await getWikidataItemForTitle(pageTitle, lang);
        const { author, publishYear, genre, isbn: isbnFromWikidata } = qid
            ? await getAuthorAndYearFromWikidata(qid, lang)
            : {
                author: summaryData.extract?.split('(')[0]?.trim() || 'Unknown Author',
                publishYear: undefined,
                genre: undefined,
                isbn: undefined,
            };
        // Extract summary from Wikipedia extract
        let summary = undefined;
        if (summaryData.extract) {
            summary = summaryData.extract.trim();
        }
        // Extract ISBN from Wikipedia extract if not found in Wikidata
        let isbn = isbnFromWikidata;
        if (!isbn && summaryData.extract) {
            const isbnMatch = summaryData.extract.match(/isbn[:\s-]*([0-9X-]{10,17})/i);
            if (isbnMatch) {
                isbn = isbnMatch[1].replace(/-/g, '');
            }
        }
        return {
            title: summaryData.title || pageTitle,
            author: author,
            publish_year: publishYear,
            genre: genre,
            cover_url: summaryData.thumbnail?.source?.replace('http://', 'https://') || null,
            wikipedia_url: summaryData.content_urls?.desktop?.page || null,
            google_books_url: null,
            summary: summary || null,
            isbn: isbn || undefined,
        };
    }));
    return books;
}
async function lookupBookOnWikipedia(query) {
    const lang = (0, hebrew_detector_1.isHebrew)(query) ? 'he' : 'en';
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const searchData = await (0, fetch_retry_1.fetchWithRetry)(searchUrl);
    const results = searchData.query?.search || [];
    if (results.length === 0)
        return null;
    const keywords = lang === 'he'
        ? ['ספר', 'רומן', 'נובלה', 'ביוגרפיה', 'סיפור']
        : ['novel', 'memoir', 'non-fiction', 'book', 'biography', 'fiction'];
    let bestCandidate = results.find((r) => r.title.toLowerCase().includes(lang === 'he' ? '(ספר)' : '(book)') ||
        r.title.toLowerCase().includes(lang === 'he' ? '(רומן)' : '(novel)'));
    if (!bestCandidate) {
        bestCandidate = results.find((r) => keywords.some((kw) => r.snippet.toLowerCase().includes(kw)));
    }
    if (!bestCandidate)
        bestCandidate = results[0];
    const pageTitle = bestCandidate.title;
    const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
    const summaryData = await (0, fetch_retry_1.fetchWithRetry)(summaryUrl);
    const qid = await getWikidataItemForTitle(pageTitle, lang);
    let author = lang === 'he' ? 'מחבר לא ידוע' : 'Unknown Author';
    let publishYear = undefined;
    let genre = undefined;
    let isbn = undefined;
    if (qid) {
        const wdData = await getAuthorAndYearFromWikidata(qid, lang);
        author = wdData.author || author;
        publishYear = wdData.publishYear;
        genre = wdData.genre;
        isbn = wdData.isbn;
    }
    // Extract summary from Wikipedia extract
    let summary = undefined;
    if (summaryData.extract) {
        summary = summaryData.extract.trim();
        // Extract ISBN from extract if not found in Wikidata
        if (!isbn) {
            const isbnMatch = summaryData.extract.match(/isbn[:\s-]*([0-9X-]{10,17})/i);
            if (isbnMatch) {
                isbn = isbnMatch[1].replace(/-/g, '');
            }
        }
    }
    return {
        title: summaryData.title || pageTitle,
        author: author,
        publish_year: publishYear,
        genre: genre,
        cover_url: summaryData.thumbnail?.source || summaryData.originalimage?.source || null,
        wikipedia_url: summaryData.content_urls?.desktop?.page || null,
        summary: summary || null,
        isbn: isbn || undefined,
    };
}
