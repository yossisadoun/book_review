import yaml from 'js-yaml';

interface PromptsConfig {
  book_suggestions: {
    prompt: string;
  };
  book_search: {
    prompt: string;
  };
  author_facts: {
    prompt: string;
  };
  podcast_episodes: {
    prompt: string;
  };
  related_books: {
    prompt: string;
  };
}

let promptsCache: PromptsConfig | null = null;

export function clearPromptsCache() {
  promptsCache = null;
}

export async function loadPrompts(forceReload = false): Promise<PromptsConfig> {
  // In development, always reload to pick up changes to prompts.yaml
  const isDevelopment = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // Skip cache in development mode or if forcing reload
  if (!isDevelopment && !forceReload && promptsCache) {
    return promptsCache;
  }
  
  // Clear cache if forcing reload or in development
  if (forceReload || isDevelopment) {
    promptsCache = null;
  }

  try {
    // Handle basePath for GitHub Pages
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const basePath = isLocalhost ? '' : (typeof window !== 'undefined' ? window.location.pathname.split('/').slice(0, 2).join('/') : '');
    // Add cache-busting query parameter in development to ensure fresh loads
    const cacheBuster = isDevelopment ? `?t=${Date.now()}` : '';
    const promptsUrl = `${basePath}/prompts.yaml${cacheBuster}`;
    
    console.log('[loadPrompts] Loading prompts from:', promptsUrl);
    const response = await fetch(promptsUrl);
    if (!response.ok) throw new Error(`Failed to load prompts: ${response.status}`);
    
    const yamlText = await response.text();
    console.log('[loadPrompts] Loaded YAML text (first 200 chars):', yamlText.substring(0, 200));
    promptsCache = yaml.load(yamlText) as PromptsConfig;
    console.log('[loadPrompts] Parsed prompts config:', promptsCache);
    return promptsCache!;
  } catch (error) {
    console.error('Error loading prompts.yaml, using defaults:', error);
    // Return default prompts if file can't be loaded
    return {
      book_suggestions: {
        prompt: `You are a book title expert. The user is searching for a book with a potentially misspelled or partial title.
Analyze the query: "{query}"
Return a JSON object with a "suggestions" array containing the top 3 most likely real book titles with their authors.
Format each suggestion as "Book Title/Author Name" (use forward slash as separator).
Keep the titles exact so they work well in a Wikipedia search.
If the input is Hebrew, suggest Hebrew titles.
Return ONLY valid JSON in this format: { "suggestions": ["Title 1/Author 1", "Title 2/Author 2", "Title 3/Author 3"] }`
      },
      book_search: {
        prompt: `You are a book search expert. The user is searching for a book with the query: "{query}"

Find the most likely book match and return detailed information about it.

Return ONLY valid JSON in this format:
{
  "title": "Exact Book Title",
  "author": "Author Name (full name)",
  "publish_year": 1999,
  "cover_url": "https://complete-url-to-book-cover-image.jpg",
  "wikipedia_url": "https://en.wikipedia.org/wiki/Book_Title",
  "google_books_url": "https://books.google.com/books?id=..."
}

Requirements:
- Use the exact, canonical title of the book
- Include the full author name (first and last)
- Extract the publication year if available
- Provide a high-quality cover image URL if available (prefer official book covers)
- Include Wikipedia URL if the book has a Wikipedia page
- Include Google Books URL if available
- If any field is not available, use null
- If the book cannot be found, return null
- If the input is Hebrew, search for Hebrew books and return Hebrew titles/authors`
      },
      author_facts: {
        prompt: `You are a literary expert. Generate exactly 10 interesting, fun facts about the author "{author}" specifically in the context of their book "{bookTitle}".

Requirements:
- Return exactly 10 facts
- Each fact should be concise (1-2 sentences max)
- Focus on interesting, lesser-known details
- Connect facts to the book when possible
- Make facts engaging and fun
- Return ONLY valid JSON in this format: { "facts": ["Fact 1", "Fact 2", ..., "Fact 10"] }`
      },
      podcast_episodes: {
        prompt: `Find me podcast episodes for the book "{bookTitle}" by {author}.
I want the response to be only the list of results in JSON format.
Very very concise with minimal description. Include: title, length, air_date, url, platform, episode_summary (short summary of the podcast episode), podcast_summary (short summary of the podcast itself).
Prioritize podcasts that specialize on book reviews / book club type analysis or discussion / deep interviews with author on the book in question.
Return ONLY valid JSON in this format: { "episodes": [{"title": "...", "length": "...", "air_date": "...", "url": "...", "platform": "...", "episode_summary": "...", "podcast_summary": "..."}, ...] }`
      },
      related_books: {
        prompt: `Act as a literary expert and book curator. I need recommendations for books that connect to "{bookTitle}" by {author} from unique and interesting angles.

Criteria:

Interesting Angles: Do not just look for "books like this." Look for retellings, shifts in perspective (e.g., the villain's POV), thematic deconstructions, genre-swaps (e.g., a sci-fi version), or meta-fictional responses to the original text.

Real Books Only: Verify that these books actually exist and are published. Do not hallucinate titles.

Quality: The books must be highly regarded or interesting on their own merits.

Return exactly 10 recommendations.

Return ONLY valid JSON in this format (no markdown code blocks, no conversational filler, just raw JSON): [{"title": "Book Title", "author": "Author Name", "reason": "A concise explanation of the specific angle and connection to the source material."}]`
      }
    };
  }
}

export function formatPrompt(template: string, variables: Record<string, string>): string {
  let formatted = template;
  for (const [key, value] of Object.entries(variables)) {
    formatted = formatted.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return formatted;
}
