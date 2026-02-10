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
  book_influences: {
    prompt: string;
  };
  book_domain: {
    prompt: string;
  };
  book_context: {
    prompt: string;
  };
  podcast_episodes: {
    prompt: string;
  };
  related_books: {
    prompt: string;
  };
  book_research: {
    prompt: string;
  };
  trivia_questions: {
    prompt: string;
  };
  did_you_know: {
    prompt: string;
  };
  discussion_questions: {
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
      book_influences: {
        prompt: `Role: You are a specialist in comparative literature, philology, and the history of ideas.
Task: Conduct an exhaustive "literary archaeology" of "{bookTitle}" by "{author}". Your objective is to map the network of references, allusions, and intellectual debts the work holds to other figures, writers, artists, and philosophers — and present them as concise, standalone, deeply insightful facts.
Output Format:
Return ONLY valid JSON in this exact format (no additional text outside the JSON):
{
  "facts": [
    "Fact 1",
    "Fact 2",
    "..."
  ]
}
Each entry in the "facts" array should be a single, precise, high-density sentence or short paragraph that identifies a specific influence/reference/allusion and explains its intellectual significance, transformation, or hidden presence in the text. Aim for 15–25 facts total. Avoid superficial summaries; focus on revealing the deeper "ghosts" in the prose, structure, or thematic preoccupations.
Instructions for Depth:

Do not provide surface-level summaries.
Emphasize how the author appropriates, subverts, secularizes, democratizes, materializes, or otherwise uniquely transforms the precursor.
Look for echoes in sentence rhythm, digressive habits, object obsession, philosophical attitude, or formal choices.
Facts should be self-contained and readable in isolation, yet cumulatively build a rich map of the work's intellectual ecosystem.

Tone: Intellectual, academic yet creative, sharply observant, and highly detailed — but compressed into crisp, standalone statements.`
      },
      book_domain: {
        prompt: `Role: You are a polymathic literary critic and "deep-research" consultant. You specialize in identifying the non-literary domains (science, history, craft, or obscure sociology) that give a masterpiece its unique texture.
Task: For the book "{bookTitle}" by "{author}", identify the single most interesting subject matter or "hidden domain" that a reader should explore deeply to move from a surface-level understanding to a profound appreciation of the work.
Requirements for the Selection:
1. Avoid the Obvious: Do not pick the central plot theme (e.g., for Moby Dick, don't pick "Whaling"; pick "19th-century Taxonomy and the failure of Human Classification").
2. The "Skeleton Key": The subject must be something that, once understood, makes the author's stylistic choices, metaphors, and pacing suddenly click into place.
Output Structure:

The Subject: Identify the specific field, era, or technical discipline.
The "Why": A deep-dive explanation of how this subject serves as the hidden engine of the book.
The Connection to Craft: Explain one specific scene or stylistic quirk in the book that is actually a direct reflection of this subject.
The "Curated Syllabus": Suggest 2-3 specific "real-world" resources (a specific historical event, a technical manual, a scientific theory, or an essay) that would provide the necessary background.
Tone: Insightful, revelatory, and intellectually curious.
Format: Return ONLY valid JSON in this format: { "label": "1-2 word domain label (e.g., 'Taxonomy', 'Maritime Law', 'Victorian Botany')", "facts": ["Fact 1", "Fact 2", ..., "Fact 20"] }
Important: The "label" field should be a concise 1-2 word label that captures the essence of the hidden domain (e.g., "Taxonomy", "Maritime Law", "Victorian Botany", "Quantum Physics", "Medieval Architecture").`
      },
      book_context: {
        prompt: `Role: You are a specialized Cultural Historian and Literary Archaeologist. Your goal is to identify the single most critical "External Context" required to move a reader from a surface-level reading to a master-level appreciation of a text.
Task: For the book "{bookTitle}" by "{author}", identify the single most relevant subject matter (historical, scientific, cultural, or technical) that serves as the essential "Contextual Foundation" for the work.
Output Format: You must respond strictly in JSON format. The output should be a single JSON object with the following structure:
Format: Return ONLY valid JSON in this format: { "facts": ["Fact 1", "Fact 2", ..., "Fact 20"] }

Instructions:

Prioritize the 'Why' over the 'What': Don't just pick a time period; pick the specific tension within that time period (e.g., instead of 'Victorian England,' pick 'The Crisis of Faith post-Darwin').
Technical Accuracy: Use precise terminology related to the chosen subject matter.

Tone: Authoritative, insightful, and academically rigorous.`
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
      },
      book_research: {
        prompt: `Task: Conduct a deep-dive research into the book "{bookTitle}" by "{authorName}".

Methodology: Act as a panel of experts (Scholar, Fact-Checker, Psychologist, and Historian). For each relevant pillar, synthesize perspectives into validated, multi-point data. Choose only pillars that make sense for the Book in question.

Research Pillar Definitions & Enhancements:

1. Memorable Quotes: Identify the most popular and culturally significant quotes sourced from reputable quote repositories (e.g., Goodreads, Wikiquote).

2. About the Author: Focus on the author's background, education, and personal experiences that directly informed this specific book.

3. Story Behind the Story: Uncover the "spark of life"—the specific events, inspirations, or research that brought this story into existence.

4. Reception: Analyze critical reviews, awards, and the public's initial versus long-term reaction.

5. Time of Writing: Contextualize the book within its specific era (political, social, or technological climate when the author wrote it).

6. World & Setting: Provide factual historical and geographical context for the story's setting. If set in a specific era (e.g., Medieval Russia, Depression-era South), provide the real-world historical data necessary to understand the characters' constraints and environment.

7. References & Easter Eggs: Identify intertextual references, subtle nods to other works, "Easter egg" phrases, or stylistic homages.

8. Legacy & Influence: Document how this work affected culture and identify specific later works (books, films, art) that were inspired by it.

9. Meaning & Insights: Decode the central themes, hidden allegories, and philosophical arguments.

10. The Ending: Analyze the resolution's impact, whether it is definitive or ambiguous, and its thematic resonance.

11. Main Characters: Profile key figures, focusing on their internal motivations, primary conflicts, and character arcs.

12. Psychological Perspective: Apply psychological theories (e.g., CBT, trauma-informed, Jungian) to the characters' behaviors or the author's intent.

13. Factual Soundness: Verify the accuracy of historical events, scientific claims, or technical details within the text.

14. Criticism: Identify significant negative critiques, controversies, or points of contention among scholars.

Output Format: Provide a single JSON object. Each pillar can contain up to 8 distinct items.

* pillar_name: The name of the subject.

* content_items: An array of objects (Max 8), each containing:

  * source_url: A valid, reputable URL.

  * trivia_fact: A one-sentence, high-impact "quick grok" fact.

  * deep_insight: A detailed paragraph of context or expert analysis.

JSON Structure: { "book_title": "", "author": "", "pillars": [ { "pillar_name": "", "content_items": [ { "source_url": "", "trivia_fact": "", "deep_insight": "" } ] } ] }`
      },
      trivia_questions: {
        prompt: `You are an expert creator of The Guardian Thursday Quiz-style questions: short (1-2 lines max), witty, punchy, slightly irreverent trivia that mixes quirky behind-the-scenes author facts, odd inspirations, personal anecdotes, research rabbit holes, and literary details. Questions are phrased openly but designed for multiple-choice reveal.

IMPORTANT RULES FOR ANSWERS:
- The correct_answer MUST be a specific, extractable detail FROM the facts — NOT the author's name, NOT "who wrote the book", NOT just the book title.
- Focus on quirky elements: real people who inspired characters, objects/symbols (e.g. hat, cat collar, typewriter), locations, numbers (e.g. notebooks, months, rejections), phrases/slogans, research finds, personal mishaps, hidden gems, inspirations from real life, etc.
- Avoid questions where the answer is simply the author. If a fact is about the author, reframe the question around the DETAIL (e.g. not "who wrote X?", but "what red hunting hat symbol came from sightings of Manhattan eccentrics?").
- Vary answer types heavily across the 11 questions: people, objects, places, numbers, events, phrases, animals, recipes, etc.
- Make wrong_answers plausible "close" distractors: similar details from other facts in the list, common literary mix-ups, near-miss inspirations, or logical red herrings.

Task: From the provided JSON array (each object has "author_facts": array of fact strings about books/authors), generate exactly 11 quiz questions.

For each question:
- Keep very concise (under 25 words preferred, max 30).
- Use playful, cheeky, mildly sarcastic tone where fitting.
- Include book titles in quotes when relevant.
- Optionally add "(pictured)" if a visual fits naturally.
- Draw from varied facts across the entire list (avoid clustering on one book/author).
- Output ONLY valid JSON—no extra text, explanations, or markdown.

Output schema (exact structure):
{
  "questions": [
    {
      "question": "Holden Caulfield's iconic red hunting hat was inspired by sightings of what during lonely Manhattan walks?",
      "correct_answer": "eccentric characters",
      "wrong_answers": [
        "prep school bullies",
        "Central Park ducks",
        "Greenwich Village poets"
      ]
    },
    ...
  ]
}

Input facts:
{FACTS_JSON}`
      },
      did_you_know: {
        prompt: `You are a literary research and trivia assistant inside a book companion app.

Your task: generate the TOP 10 most impressive, surprising, or highly interesting
"Did you know?" insights about a given book.

These are not general themes or summaries. They must be facts, backstories,
hidden details, unusual influences, author decisions, cultural impact,
or strange connections that make readers say "I didn't know that."

Each insight has exactly 3 notes:
1. The core fact (short, punchy)
2. Background or context
3. Why it matters or a surprising implication

Book: "{book_title}"
Author: "{author_name}"

Return ONLY valid JSON in this format:
{
  "book": "{book_title}",
  "author": "{author_name}",
  "did_you_know_top10": [
    {
      "rank": 1,
      "notes": [
        "Core fact here",
        "Background context here",
        "Why it matters here"
      ]
    }
  ]
}`
      },
      discussion_questions: {
        prompt: `You are a professional book club facilitator.

Generate 10 discussion topics for the book:

**"{book_title}"** by **"{author_name}"**.

Return the result as a JSON array.

Each item should have:
- id
- question
- category (one of: "themes", "characters", "writing style", "ethics", "personal reflection", "real world")

Guidelines:
- Questions must be open-ended and spark conversation
- No trivia or yes/no questions
- Avoid major spoilers
- Start easy and get progressively deeper
- Include at least:
  - 2 about characters
  - 2 about major themes
  - 2 that connect the book to modern life
  - 2 that invite personal reflection
- Questions should feel natural when read aloud in a group.

Example output format:
[
  {
    "id": 1,
    "question": "...",
    "category": "themes"
  }
]`
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
