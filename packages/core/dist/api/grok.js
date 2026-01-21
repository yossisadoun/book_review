"use strict";
// Grok API functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGrokSuggestions = getGrokSuggestions;
exports.getGrokAuthorFacts = getGrokAuthorFacts;
exports.lookupBookOnGrok = lookupBookOnGrok;
exports.lookupBooksOnGrok = lookupBooksOnGrok;
const fetch_retry_1 = require("../utils/fetch-retry");
const prompts_1 = require("../utils/prompts");
const grok_usage_1 = require("../utils/grok-usage");
async function getGrokSuggestions(query, grokApiKey, storage) {
    if (!grokApiKey)
        return [];
    await new Promise((resolve) => setTimeout(resolve, 500));
    const url = 'https://api.x.ai/v1/chat/completions';
    const prompts = await (0, prompts_1.loadPrompts)();
    const prompt = (0, prompts_1.formatPrompt)(prompts.book_suggestions.prompt, { query });
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
    try {
        const data = await (0, fetch_retry_1.fetchWithRetry)(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${grokApiKey}`,
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        }, 3, 2000);
        // Log usage
        if (data.usage && storage) {
            (0, grok_usage_1.logGrokUsage)('getGrokSuggestions', data.usage, storage);
        }
        const content = data.choices?.[0]?.message?.content || '{"suggestions":[]}';
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        const parsed = JSON.parse(jsonStr);
        return parsed.suggestions || [];
    }
    catch (err) {
        console.error('Grok suggestions error:', err);
        if (err.message?.includes('403')) {
            console.error('Grok API returned 403 - check your API key permissions');
        }
        return [];
    }
}
async function getGrokAuthorFacts(bookTitle, author, grokApiKey, storage) {
    if (!grokApiKey) {
        console.warn('[getGrokAuthorFacts] API key is missing!');
        return { facts: [] };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const url = 'https://api.x.ai/v1/chat/completions';
    const prompts = await (0, prompts_1.loadPrompts)();
    const prompt = (0, prompts_1.formatPrompt)(prompts.author_facts.prompt, { author, bookTitle });
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
    try {
        const data = await (0, fetch_retry_1.fetchWithRetry)(url, {
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
            (0, grok_usage_1.logGrokUsage)('getGrokAuthorFacts', data.usage, storage);
        }
        const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        const result = JSON.parse(jsonStr);
        return {
            facts: result.facts || [],
            first_issue_year: result.first_issue_year || null,
        };
    }
    catch (err) {
        console.error('[getGrokAuthorFacts] Error:', err);
        if (err.message?.includes('403')) {
            console.error('Grok API returned 403 - check your API key permissions');
        }
        return { facts: [] };
    }
}
async function lookupBookOnGrok(query, grokApiKey, storage) {
    if (!grokApiKey) {
        console.warn('[lookupBookOnGrok] API key is missing!');
        return null;
    }
    try {
        const url = 'https://api.x.ai/v1/chat/completions';
        const prompts = await (0, prompts_1.loadPrompts)();
        if (!prompts.book_search || !prompts.book_search.prompt) {
            console.error('[lookupBookOnGrok] ❌ book_search prompt not found');
            return null;
        }
        const prompt = (0, prompts_1.formatPrompt)(prompts.book_search.prompt, { query });
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
        const data = await (0, fetch_retry_1.fetchWithRetry)(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${grokApiKey}`,
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        }, 3, 2000);
        // Log usage
        if (data.usage && storage) {
            (0, grok_usage_1.logGrokUsage)('lookupBookOnGrok', data.usage, storage);
        }
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            console.warn('[lookupBookOnGrok] ⚠️ No content in response');
            return null;
        }
        // Parse JSON from response
        let result;
        try {
            const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[1]);
            }
            else {
                result = JSON.parse(content);
            }
        }
        catch (parseErr) {
            console.error('[lookupBookOnGrok] ❌ Failed to parse JSON:', parseErr);
            return null;
        }
        // Check if result is null (book not found)
        if (result === null || !result.title) {
            console.log(`[lookupBookOnGrok] ⚠️ Book not found for query: "${query}"`);
            return null;
        }
        // Validate and return the book data
        const bookData = {
            title: result.title || query,
            author: result.author || 'Unknown Author',
            publish_year: result.publish_year || undefined,
            genre: result.genre || undefined,
            cover_url: result.cover_url || null,
            wikipedia_url: result.wikipedia_url || null,
            google_books_url: result.google_books_url || null,
        };
        console.log(`[lookupBookOnGrok] ✅ Found book: "${bookData.title}" by ${bookData.author}`);
        return bookData;
    }
    catch (err) {
        console.error('[lookupBookOnGrok] ❌ Error:', err);
        if (err.message?.includes('403')) {
            console.error('Grok API returned 403 - check your API key permissions');
        }
        return null;
    }
}
async function lookupBooksOnGrok(query, grokApiKey, storage) {
    // For now, Grok returns a single result, so we'll wrap it in an array
    const result = await lookupBookOnGrok(query, grokApiKey, storage);
    return result ? [result] : [];
}
