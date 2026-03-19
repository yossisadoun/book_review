import { supabase } from '@/lib/supabase';
import { isNativePlatform } from '@/lib/capacitor';
import { grokApiKey, fetchWithRetry, logGrokUsage, logImageGeneration } from './api-utils';
import { getCached, setCache, CACHE_KEYS } from './cache-service';
import type { CharacterAvatar } from '../types';

const REPLICATE_API_KEY = process.env.NEXT_PUBLIC_REPLICATE_API_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const REPLICATE_PROXY_URL = `${SUPABASE_URL}/functions/v1/replicate-proxy`;

// One-time cleanup: purge localStorage avatar caches with expired Replicate URLs
if (typeof window !== 'undefined' && !localStorage.getItem('_avatar_cache_cleaned_v1')) {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('avatars_')) {
        const val = localStorage.getItem(key);
        if (val && (val.includes('replicate.delivery') || val.includes('pbxt.replicate'))) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    if (keysToRemove.length > 0) console.log(`[avatars] Cleaned ${keysToRemove.length} stale avatar caches`);
    localStorage.setItem('_avatar_cache_cleaned_v1', '1');
  } catch {}
}

// --- Avatar Style Configuration ---
// Each style pairs a prompt style block with reference image URLs.
// Switch the active style by changing ACTIVE_AVATAR_STYLE.

interface AvatarStyle {
  id: string;
  name: string;
  styleBlock: string;
  referenceImages: string[];
}

const AVATAR_STYLES: AvatarStyle[] = [
  {
    id: 'flat-cartoon',
    name: 'Flat Cartoon Icons',
    styleBlock: `Style: Flat, minimalist cartoon icon illustration. Characters drawn with simple rounded shapes and smooth curves using medium-thick black outlines with consistent stroke weight. No perspective and no 3D shading. Faces extremely simplified with small dot eyes and a tiny curved mouth, minimal facial detail. Bodies stylized as head or small bust shapes.

Color treatment uses flat solid fills with bright saturated colors, no gradients, textures, or lighting effects. The entire background is a single bold solid color filling the whole frame, contrasting with the character colors.

Line style slightly imperfect and organic, giving a hand-drawn doodle feel rather than precise vector geometry.

Overall aesthetic: playful children's-book / sticker-pack icon style, similar to simple indie mobile game icons or Duolingo-like mascots.`,
    referenceImages: [
      `${SUPABASE_URL}/storage/v1/object/public/public-assets/reference/style1.jpg`,
    ],
  },
  {
    id: 'style_3',
    name: 'Three-Color Minimalist Avatars',
    styleBlock: `Style: Flat minimalist vector avatar illustration using a strict three-color palette. Characters are drawn with clean, smooth medium-weight outlines and simple geometric shapes. The outline color typically uses the darkest color of the palette.

Faces are extremely simplified: small oval or circular eyes, minimal curved nose, and a small curved smile. Expressions are calm and neutral.

Hair and accessories are rendered as solid flat shapes with no texture, gradients, or shading.

Color structure is strictly limited to three colors total:

Background color

Character base color

Dark detail color for outlines, hair, and facial features

Characters appear as side-angled head portraits (¾ view or profile) but eyes facing to the camera to the front.

The background fills the entire 1:1 square canvas with a solid color. There is no circular frame. The character sits centered in the square with generous negative space.

Overall aesthetic: clean, modern minimalist avatar icon style, similar to indie tech branding illustrations.

No gradients. No shadows. No textures. No extra colors beyond the three-color palette.`,
    referenceImages: [
      `${SUPABASE_URL}/storage/v1/object/public/public-assets/reference/style3_1.png`,
      `${SUPABASE_URL}/storage/v1/object/public/public-assets/reference/style_3_2.png`,
    ],
  },
];

const ACTIVE_AVATAR_STYLE = 'style_3';

function getActiveStyle(): AvatarStyle {
  return AVATAR_STYLES.find(s => s.id === ACTIVE_AVATAR_STYLE) || AVATAR_STYLES[0];
}

function buildGrokPrompt(): string {
  const style = getActiveStyle();
  return `You are generating **image-generation prompts for literary characters**.

Input will contain only:

* **Book:** {BOOK_TITLE}
* **Author:** {AUTHOR_NAME}

Your task:

1. Identify **up to 8 key characters** from the book.
2. For each character, generate a **single image-generation prompt** describing a close-up icon portrait of that character.
3. Base the character description on **recognizable traits from the book** (hair, face shape, distinctive features, accessories, clothing hints).
4. The prompt should clearly reference the **character name, book title, and author**.
5. The character portrait must be **tight close-up head or small bust**, centered and filling most of the frame.
6. The prompt must explicitly say **no text or character name should appear in the image**.
7. The **style block must remain exactly the same for every prompt**.
8. Output **valid JSON only**, no commentary.

---

**Output JSON schema**

\`\`\`json
{
  "book": "string",
  "author": "string",
  "characters": [
    {
      "character": "string",
      "prompt": "string"
    }
  ]
}
\`\`\`

Rules:

* Return **1–8 characters maximum**.
* **Order characters by importance** — protagonist first, then major characters, then supporting characters.
* Keep prompts **concise but descriptive**.
* Ensure the **style block appears unchanged inside every prompt**.

---

**Style block (must remain unchanged and appended to every prompt)**

${style.styleBlock}`;
}

interface GrokCharacterResponse {
  book: string;
  author: string;
  characters: Array<{ character: string; prompt: string }>;
}

// Step 1: Get character prompts from Grok
async function getCharacterPrompts(bookTitle: string, author: string, signal?: AbortSignal): Promise<GrokCharacterResponse | null> {
  if (!grokApiKey || grokApiKey.length < 20) {
    console.warn('[getCharacterPrompts] Grok API key not found');
    return null;
  }

  const userMessage = `Book: ${bookTitle}\nAuthor: ${author}`;

  const payload = {
    messages: [
      { role: "system", content: buildGrokPrompt() },
      { role: "user", content: userMessage },
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.5,
    response_format: { type: "json_object" },
  };

  const data = await fetchWithRetry('https://api.x.ai/v1/chat/completions', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${grokApiKey}`,
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  }, 2, 3000);

  if (data.usage) {
    logGrokUsage('getCharacterAvatars', data.usage);
  }

  const content = data.choices?.[0]?.message?.content || '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : content;

  const result = JSON.parse(jsonStr) as GrokCharacterResponse;

  if (!result.characters?.length) {
    console.warn('[getCharacterPrompts] No characters returned');
    return null;
  }

  return result;
}

// Step 2: Generate image via Replicate (proxy on web, direct on native)
async function generateCharacterImage(prompt: string, signal?: AbortSignal): Promise<string | null> {
  const style = getActiveStyle();

  const imageInput = {
    prompt,
    images: style.referenceImages,
    aspect_ratio: '1:1',
    go_fast: false,
    output_format: 'webp',
    output_megapixels: '0.25',
    output_quality: 90,
  };

  try {
    let prediction: any;

    if (isNativePlatform) {
      // Native: call Replicate directly
      if (!REPLICATE_API_KEY) {
        console.warn('[generateCharacterImage] Replicate API key not found');
        return null;
      }
      const createRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-2-klein-4b/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        },
        body: JSON.stringify({ input: imageInput }),
        signal,
      });
      if (!createRes.ok) {
        console.error('[generateCharacterImage] Create failed:', await createRes.text());
        return null;
      }
      prediction = await createRes.json();
    } else {
      // Web: route through Supabase Edge Function proxy
      const createRes = await fetch(REPLICATE_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'create', input: imageInput }),
        signal,
      });
      if (!createRes.ok) {
        console.error('[generateCharacterImage] Proxy create failed:', await createRes.text());
        return null;
      }
      prediction = await createRes.json();
    }

    // Poll for completion (max 30s)
    for (let i = 0; i < 30; i++) {
      if (prediction.status === 'succeeded') {
        return prediction.output?.[0] || null;
      }
      if (prediction.status === 'failed' || prediction.status === 'canceled') {
        console.error('[generateCharacterImage] Prediction failed:', prediction.error);
        return null;
      }

      await new Promise(r => setTimeout(r, 1000));
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      if (isNativePlatform) {
        const pollRes = await fetch(prediction.urls.get, {
          headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
          signal,
        });
        prediction = await pollRes.json();
      } else {
        const pollRes = await fetch(REPLICATE_PROXY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ action: 'poll', prediction_url: prediction.urls.get }),
          signal,
        });
        prediction = await pollRes.json();
      }
    }

    console.error('[generateCharacterImage] Prediction timed out');
    return null;
  } catch (err) {
    console.error('[generateCharacterImage] Error:', err);
    return null;
  }
}

// Step 3: Upload image to Supabase Storage and return public URL
async function uploadToStorage(imageUrl: string, bookTitle: string, characterName: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();

    const safeName = `${bookTitle}_${characterName}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const path = `character-avatars/${safeName}.webp`;

    const { error } = await supabase.storage
      .from('public-assets')
      .upload(path, blob, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (error) {
      console.error('[uploadToStorage] Upload error:', error);
      // Return the Replicate URL as fallback
      return imageUrl;
    }

    const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(path);
    return urlData.publicUrl;
  } catch (err) {
    console.error('[uploadToStorage] Error:', err);
    // Return the Replicate URL as fallback
    return imageUrl;
  }
}

// Main function: Get character avatars (with caching)
export async function getCharacterAvatars(bookTitle: string, author: string, signal?: AbortSignal): Promise<CharacterAvatar[]> {
  console.log(`[getCharacterAvatars] Fetching for "${bookTitle}" by ${author}`);

  const normalizedTitle = bookTitle.toLowerCase().trim();
  const normalizedAuthor = author.toLowerCase().trim();
  const localCacheKey = CACHE_KEYS.avatars(bookTitle, author);

  // 0. Check localStorage first (instant)
  const localCached = getCached<CharacterAvatar[]>(localCacheKey);
  if (localCached && localCached.length > 0) {
    const validLocal = localCached.filter(a =>
      a.image_url && !a.image_url.includes('replicate.delivery') && !a.image_url.includes('pbxt.replicate')
    );
    if (validLocal.length > 0) {
      console.log('[getCharacterAvatars] Found in localStorage');
      return validLocal;
    }
  }

  // 1. Check Supabase cache
  try {
    const { data: cached, error } = await supabase
      .from('character_avatars_cache')
      .select('avatars')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!error && cached?.avatars) {
      const avatars = (cached.avatars as CharacterAvatar[]).filter(a =>
        a.image_url && !a.image_url.includes('replicate.delivery') && !a.image_url.includes('pbxt.replicate')
      );
      if (avatars.length > 0) {
        console.log('[getCharacterAvatars] Found in Supabase cache');
        setCache(localCacheKey, avatars);
        return avatars;
      }
      console.log('[getCharacterAvatars] Cached avatars have expired Replicate URLs, regenerating...');
    }
  } catch (err) {
    console.warn('[getCharacterAvatars] Cache check error:', err);
  }

  // Check if already aborted before starting expensive operations
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // 2. Get character descriptions from Grok
  const grokResult = await getCharacterPrompts(bookTitle, author, signal);
  if (!grokResult) return [];

  // 3. Generate images for each character (in parallel)
  const avatars: CharacterAvatar[] = [];

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const imageResults = await Promise.all(
    grokResult.characters.slice(0, 8).map(async (char) => {
      const imageUrl = await generateCharacterImage(char.prompt, signal);
      if (!imageUrl) return null;

      // Upload to Supabase Storage for permanent URL
      const permanentUrl = await uploadToStorage(imageUrl, bookTitle, char.character);
      if (!permanentUrl) return null;

      return {
        character: char.character,
        prompt: char.prompt,
        image_url: permanentUrl,
      } as CharacterAvatar;
    })
  );

  let generatedImageCount = 0;
  for (const result of imageResults) {
    if (result) {
      avatars.push(result);
      generatedImageCount++;
    }
  }

  // Log image generation costs
  if (generatedImageCount > 0) {
    logImageGeneration('character_avatar_generation', generatedImageCount);
  }

  // 4. Save to cache
  if (avatars.length > 0) {
    try {
      await supabase
        .from('character_avatars_cache')
        .upsert({
          book_title: normalizedTitle,
          book_author: normalizedAuthor,
          avatars,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'book_title,book_author' });
      console.log('[getCharacterAvatars] Saved to Supabase cache');
    } catch (err) {
      console.warn('[getCharacterAvatars] Error saving to cache:', err);
    }
    setCache(localCacheKey, avatars);
  }

  return avatars;
}

// Generate avatar for a single character that's missing one (e.g. after cache regeneration dropped it)
export async function generateSingleCharacterAvatar(
  characterName: string,
  bookTitle: string,
  author: string
): Promise<string | null> {
  console.log(`[generateSingleCharacterAvatar] Generating for "${characterName}" in "${bookTitle}"`);

  if (!grokApiKey || grokApiKey.length < 20) return null;

  const style = getActiveStyle();

  // Build a targeted prompt for just this one character
  const payload = {
    messages: [
      {
        role: "system",
        content: `You are generating an image-generation prompt for a specific literary character.

Given a character name, book title, and author, generate a single image-generation prompt describing a close-up icon portrait of that character.

Base the description on recognizable traits from the book (hair, face shape, distinctive features, accessories, clothing hints).

The prompt must clearly reference the character name, book title, and author.
The portrait must be a tight close-up head or small bust, centered and filling most of the frame.
The prompt must explicitly say no text or character name should appear in the image.

Output valid JSON only: { "character": "string", "prompt": "string" }

Style block (must be appended unchanged to the prompt):

${style.styleBlock}`,
      },
      {
        role: "user",
        content: `Character: ${characterName}\nBook: ${bookTitle}\nAuthor: ${author}`,
      },
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.5,
    response_format: { type: "json_object" },
  };

  try {
    const data = await fetchWithRetry('https://api.x.ai/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    }, 2, 3000);

    if (data.usage) logGrokUsage('generateSingleCharacterAvatar', data.usage);

    const content = data.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);

    if (!result.prompt) {
      console.warn('[generateSingleCharacterAvatar] No prompt in response');
      return null;
    }

    // Generate image
    const imageUrl = await generateCharacterImage(result.prompt);
    if (!imageUrl) return null;

    // Upload to permanent storage
    const permanentUrl = await uploadToStorage(imageUrl, bookTitle, characterName);
    if (!permanentUrl) return null;

    logImageGeneration('character_avatar_generation', 1);

    // Merge into existing avatars cache
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();

    try {
      const { data: existing } = await supabase
        .from('character_avatars_cache')
        .select('avatars')
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor)
        .maybeSingle();

      const existingAvatars = (existing?.avatars as CharacterAvatar[]) || [];
      // Don't duplicate — replace if exists, otherwise append
      const filtered = existingAvatars.filter(a => a.character !== characterName);
      const newAvatar: CharacterAvatar = { character: characterName, prompt: result.prompt, image_url: permanentUrl };
      const updatedAvatars = [...filtered, newAvatar];

      await supabase
        .from('character_avatars_cache')
        .upsert({
          book_title: normalizedTitle,
          book_author: normalizedAuthor,
          avatars: updatedAvatars,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'book_title,book_author' });

      // Update localStorage cache too
      const localCacheKey = CACHE_KEYS.avatars(bookTitle, author);
      setCache(localCacheKey, updatedAvatars);

      console.log(`[generateSingleCharacterAvatar] ✅ Generated and saved avatar for "${characterName}"`);
    } catch (err) {
      console.warn('[generateSingleCharacterAvatar] Error saving to cache:', err);
    }

    return permanentUrl;
  } catch (err) {
    console.error('[generateSingleCharacterAvatar] Error:', err);
    return null;
  }
}

// --- Character Context for Chat ---

const CHARACTER_CONTEXT_PROMPT = `You are a literary research expert building an evidence-based character profile for a role-playing chatbot.

Your job is to perform careful research about a fictional character and produce a structured profile that lets a chatbot convincingly inhabit that character in casual text conversation.

You will be given: Character name, Book title, Author.

EVIDENCE HIERARCHY — prioritize sources in this order:
Tier 1 (highest confidence): Direct events, dialogue, narrator descriptions, explicit statements from the book
Tier 2: Repeated behavioral patterns, relationship dynamics, consistent attitudes
Tier 3 (use cautiously): Well-established literary analysis, canonical series information

Do NOT invent facts. If something is not clearly established in the text, mark it as UNCERTAIN or omit it.

OUTPUT FORMAT: Return valid structured JSON only. No commentary outside the JSON.

{
  "BOOK_SUMMARY": "",
  "BOOK_SETTING": "",
  "CHARACTER_ROLE": "",
  "CHARACTER_BACKGROUND": "",
  "TIMELINE_POSITION": "",
  "VERIFIED_EVENT_1": "",
  "VERIFIED_EVENT_2": "",
  "VERIFIED_EVENT_3": "",
  "VERIFIED_EVENT_4": "",
  "VERIFIED_EVENT_5": "",
  "WORLD_KNOWLEDGE": "",
  "CULTURAL_KNOWLEDGE": "",
  "SKILLS_AND_ABILITIES": "",
  "SPECIAL_KNOWLEDGE": "",
  "PERSONALITY_TRAIT_1": "",
  "PERSONALITY_TRAIT_2": "",
  "PERSONALITY_TRAIT_3": "",
  "PERSONALITY_TRAIT_4": "",
  "PERSONALITY_TRAIT_5": "",
  "EMOTIONAL_TENDENCIES": "",
  "RECURRING_THEME_1": "",
  "RECURRING_THEME_2": "",
  "RECURRING_THEME_3": "",
  "RELATIONSHIP_1": "",
  "RELATIONSHIP_2": "",
  "RELATIONSHIP_3": "",
  "RELATIONSHIP_4": "",
  "COMMON_REFERENCE_1": "",
  "COMMON_REFERENCE_2": "",
  "COMMON_REFERENCE_3": "",
  "COMMON_REFERENCE_4": "",
  "KNOWLEDGE_BOUNDARIES": "",
  "DOES_NOT_KNOW": "",
  "VOICE_DESCRIPTION": "",
  "MAX_WORDS_PER_MESSAGE": "",
  "SOURCE_QUOTE_1": "",
  "SOURCE_QUOTE_2": "",
  "SOURCE_QUOTE_3": "",
  "DIALOGUE_ANCHOR_1": "",
  "DIALOGUE_ANCHOR_2": "",
  "DIALOGUE_ANCHOR_3": "",
  "DIALOGUE_ANCHOR_4": "",
  "DIALOGUE_ANCHOR_5": "",
  "ROLEPLAY_CONSTRAINTS": "",
  "UNCERTAINTIES": ""
}

FIELD GUIDELINES:

BOOK & CHARACTER CONTEXT:
- BOOK_SUMMARY: 2-3 sentence summary of the book's plot and themes.
- BOOK_SETTING: Where and when the story takes place. Physical, social, and cultural world.
- CHARACTER_ROLE: Who is this character in the story? What is their arc?
- CHARACTER_BACKGROUND: 3-4 sentences covering backstory, upbringing, formative experiences, and drives. Paint a full picture of who they are.
- TIMELINE_POSITION: Where in their life this character is speaking from. Include age (if known), social position, current situation. Choose the most dramatically rich moment (usually near or after climax).

VERIFIED EVENTS (evidence-based):
- VERIFIED_EVENT fields: Specific experiences that shaped them. For each, include what happened AND a brief note on the evidence (e.g. scene reference, quote fragment). These are moments they'd remember and reference. Things that left a mark.

KNOWLEDGE (categorized):
- WORLD_KNOWLEDGE: What they understand about the physical world, geography, how things work.
- CULTURAL_KNOWLEDGE: Social norms, customs, politics, class structures they navigate.
- SKILLS_AND_ABILITIES: What they can actually do — practical skills, talents, training.
- SPECIAL_KNOWLEDGE: Magic systems, technology, secret information, domain expertise (if relevant). Return "N/A" if not applicable.

PERSONALITY:
- PERSONALITY_TRAIT fields: Not just adjectives — describe HOW the trait manifests with evidence. e.g. "Brave but often unsure — acts on instinct then second-guesses. Evidence: charges into the forest alone but immediately regrets it (Ch. 7)".
- EMOTIONAL_TENDENCIES: How do they handle strong emotions? Bottle up, lash out, deflect with humor, go quiet? What triggers anger, sadness, joy?

RECURRING THEMES:
- RECURRING_THEME fields: Things the character often thinks or talks about — loyalty, justice, survival, belonging, etc. Each must include supporting evidence from the text.

RELATIONSHIPS:
- RELATIONSHIP fields: Important people in the character's life. Include: person name, nature of relationship, dynamics, and textual evidence. e.g. "Ron Weasley — best friend and anchor to normalcy. Harry trusts Ron's instincts about people. Evidence: defers to Ron's judgment about Lockhart, relies on Ron during the chess game."

REFERENCES:
- COMMON_REFERENCE fields: Things they naturally bring up — hobbies, interests, recurring worries, favorite places.

KNOWLEDGE BOUNDARIES & VOICE:
- KNOWLEDGE_BOUNDARIES: What this character definitively knows at their timeline position.
- DOES_NOT_KNOW: Equally important — what is beyond their timeline, experience, or awareness? How would they react to being asked about something they don't know? This prevents the chatbot from hallucinating knowledge.
- VOICE_DESCRIPTION: Speaking style in plain terms. Vocabulary level, tone, emotional expression patterns, humor style, sentence length. Any verbal tics, catchphrases, or patterns.
- MAX_WORDS_PER_MESSAGE: Number between 60-120 reflecting how verbose/terse the character naturally is.

DIALOGUE EVIDENCE:
- SOURCE_QUOTE fields: 3 authentic quotes or close paraphrases from the actual text that capture the character's voice. These ground the chatbot in real speech patterns.
- DIALOGUE_ANCHOR fields: 5 example lines of how the character would sound texting someone casually. Mix tones — playful, serious, emotional, witty. These should feel natural and alive, not like summaries.

GUARDRAILS:
- ROLEPLAY_CONSTRAINTS: Explicit rules for staying in character. Include: things this character would NEVER say or do, topics they'd avoid, how far their knowledge extends, personality lines they wouldn't cross.
- UNCERTAINTIES: Elements where the text doesn't provide clear answers — unknown motivations, unclear background details, contradictory interpretations. Mark them clearly so the chatbot avoids fabricating answers to these.

WRITING RULES:
- Prefer evidence over interpretation. Cite scenes or quotes when possible.
- Do not invent missing details — if unsure, say UNCERTAIN.
- CHARACTER_BACKGROUND, EMOTIONAL_TENDENCIES, DOES_NOT_KNOW, and ROLEPLAY_CONSTRAINTS are the most critical fields. Be thorough.
- For series characters, draw from the full arc but anchor the timeline at the most dramatically rich moment.
- Write with depth. This profile powers the entire chat experience.`;

export interface CharacterContext {
  [key: string]: string;
}

// Get or generate character context for chat
export async function getCharacterContext(
  characterName: string,
  bookTitle: string,
  author: string
): Promise<CharacterContext | null> {
  console.log(`[getCharacterContext] Fetching for "${characterName}" in "${bookTitle}"`);

  const normalizedTitle = bookTitle.toLowerCase().trim();
  const normalizedAuthor = author.toLowerCase().trim();
  const localKey = `char_context_${normalizedTitle}_${normalizedAuthor}_${characterName.toLowerCase().trim()}`;

  // 0. Check localStorage
  const localCached = getCached<CharacterContext>(localKey);
  if (localCached) {
    console.log('[getCharacterContext] Found in localStorage');
    return localCached;
  }

  // 1. Check Supabase cache (contexts column on character_avatars_cache)
  try {
    const { data: cached } = await supabase
      .from('character_avatars_cache')
      .select('contexts')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    const contexts = cached?.contexts as Record<string, CharacterContext> | null;
    if (contexts?.[characterName]) {
      console.log('[getCharacterContext] Found in Supabase cache');
      setCache(localKey, contexts[characterName]);
      return contexts[characterName];
    }
  } catch (err) {
    console.warn('[getCharacterContext] Cache check error:', err);
  }

  // 2. Generate via Grok
  if (!grokApiKey || grokApiKey.length < 20) return null;

  try {
    const payload = {
      messages: [
        { role: "system", content: CHARACTER_CONTEXT_PROMPT },
        { role: "user", content: `Character: ${characterName}\nBook: ${bookTitle}\nAuthor: ${author}` },
      ],
      model: "grok-4.20-beta-latest-reasoning",
      stream: false,
      temperature: 0.5,
      response_format: { type: "json_object" },
    };

    const data = await fetchWithRetry('https://api.x.ai/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);

    if (data.usage) logGrokUsage('getCharacterContext', data.usage);

    const content = data.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const context = JSON.parse(jsonMatch ? jsonMatch[0] : content) as CharacterContext;

    // 3. Save to cache (merge into existing contexts)
    try {
      const { data: existing } = await supabase
        .from('character_avatars_cache')
        .select('contexts')
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor)
        .maybeSingle();

      const existingContexts = (existing?.contexts as Record<string, CharacterContext>) || {};
      existingContexts[characterName] = context;

      await supabase
        .from('character_avatars_cache')
        .update({ contexts: existingContexts, updated_at: new Date().toISOString() })
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } catch (err) {
      console.warn('[getCharacterContext] Error saving to cache:', err);
    }

    setCache(localKey, context);
    return context;
  } catch (err) {
    console.error('[getCharacterContext] Error:', err);
    return null;
  }
}
