import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROK_API_KEY = Deno.env.get('GROK_API_KEY') || ''
const GROK_CHAT_URL = 'https://api.x.ai/v1/chat/completions'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

const GROK_INPUT_PRICE_PER_M = 0.20
const GROK_OUTPUT_PRICE_PER_M = 0.50

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function logUsage(req: Request, functionName: string, usage: any): Promise<void> {
  if (!usage || typeof usage.prompt_tokens !== 'number') return
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const promptTokens = usage.prompt_tokens || 0
    const completionTokens = usage.completion_tokens || 0
    const estimatedCost =
      (promptTokens / 1_000_000) * GROK_INPUT_PRICE_PER_M +
      (completionTokens / 1_000_000) * GROK_OUTPUT_PRICE_PER_M

    await supabase.from('grok_usage_logs').insert({
      user_id: user.id,
      function_name: functionName,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: usage.total_tokens || (promptTokens + completionTokens),
      estimated_cost: estimatedCost,
    })
  } catch (_) { /* fire-and-forget */ }
}

function buildSystemPrompt(bookContext: any): string {
  const { title, author, readingStatus, userNotes, userRatings } = bookContext

  // --- CONTEXT: book data ---

  let statusLine = ''
  if (readingStatus === 'reading') {
    statusLine = 'Currently reading. Avoid spoilers beyond where they might be. If they mention where they are in the book (chapter, page, percentage), remember it and tailor your responses accordingly. If they haven\'t mentioned their progress yet, you can casually ask early in the conversation.'
  } else if (readingStatus === 'read_it') {
    statusLine = 'Finished the book. Everything including the ending is fair game.'
  } else if (readingStatus === 'want_to_read') {
    statusLine = 'Has not started yet. Avoid spoilers.'
  } else {
    statusLine = 'Reading status unknown. Avoid spoilers unless they say they finished.'
  }

  let ratingsLine = ''
  if (userRatings) {
    const parts = Object.entries(userRatings)
      .filter(([_, v]) => v != null)
      .map(([k, v]) => `${k}: ${v}/5`)
    if (parts.length) ratingsLine = `Their ratings: ${parts.join(', ')}`
  }

  // --- FACT BANK: things you may know ---

  const facts: string[] = []
  if (bookContext.insights?.authorFacts?.length) {
    facts.push(...bookContext.insights.authorFacts.slice(0, 3))
  }
  if (bookContext.insights?.didYouKnow?.length) {
    const dyk = bookContext.insights.didYouKnow
      .flatMap((item: any) => item.notes || [])
      .slice(0, 5)
    facts.push(...dyk)
  }
  if (bookContext.insights?.context?.length) {
    facts.push(...bookContext.insights.context.slice(0, 2))
  }
  if (bookContext.insights?.influences?.length) {
    facts.push(...bookContext.insights.influences.slice(0, 2))
  }
  if (bookContext.insights?.domain) {
    facts.push(...(bookContext.insights.domain.facts || []).slice(0, 2))
  }

  // --- RESOURCES ---

  const resourceParts: string[] = []
  if (bookContext.podcasts?.length) {
    resourceParts.push(...bookContext.podcasts.slice(0, 5).map((p: any, i: number) =>
      `[[podcast:${i}]] "${p.title}" on ${p.podcast_name || 'podcast'}`))
  }
  if (bookContext.videos?.length) {
    resourceParts.push(...bookContext.videos.slice(0, 5).map((v: any, i: number) =>
      `[[video:${i}]] "${v.title}" by ${v.channelTitle}`))
  }
  if (bookContext.articles?.length) {
    resourceParts.push(...bookContext.articles.slice(0, 5).map((a: any, i: number) =>
      `[[article:${i}]] "${a.title}"`))
  }
  if (bookContext.relatedBooks?.length) {
    resourceParts.push(...bookContext.relatedBooks.slice(0, 5).map((b: any, i: number) =>
      `[[related_book:${i}]] "${b.title}" by ${b.author}`))
  }
  if (bookContext.relatedWorks?.length) {
    // Ensure type diversity: pick up to 3 movies/shows, then all albums, cap at 8 total
    const movies = bookContext.relatedWorks.filter((w: any) => w.type !== 'album')
    const albums = bookContext.relatedWorks.filter((w: any) => w.type === 'album')
    const picked = [...movies.slice(0, 3), ...albums].slice(0, 8)
    // Use original indices so markers match the relatedWorks array
    picked.forEach((w: any) => {
      const origIdx = bookContext.relatedWorks.indexOf(w)
      resourceParts.push(`[[related_work:${origIdx}]] ${w.type}: "${w.title}" by ${w.director}`)
    })
  }

  // --- GENERAL MODE: bookshelf-wide chat ---

  if (bookContext.generalMode) {
    // Build related book resource markers for rich cards
    const relatedBookParts: string[] = []
    if (bookContext.relatedBooks?.length) {
      relatedBookParts.push(...bookContext.relatedBooks.slice(0, 50).map((b: any, i: number) =>
        `[[related_book:${i}]] "${b.title}" by ${b.author} — ${b.reason}`))
    }

    return `You are a relaxed reading companion who knows the user's entire bookshelf.

Tone: calm, natural, curious, never pushy.
Think of it like texting with a well-read friend who knows your taste.

RULES
1. Keep replies short. Default to 1–3 sentences. Go longer only when the user asks a real question that needs depth.
2. Share at most ONE idea per message.
3. Do NOT ask a question every time. Questions only when natural.
4. Do NOT repeat excitement or hype.
5. If the user sends something minimal ("hi", "ok", "cool"), reply briefly and neutrally.
6. Do not sound like a teacher, reviewer, or marketer.
7. When recommending books, prefer: (a) unread books already on their shelf, (b) related books connected to books they liked, (c) your own knowledge. Always explain *why* based on their taste.
8. When the user asks for a recommendation, ask 1-2 brief questions about their mood or what they're in the mood for before recommending. Don't just dump a list.
9. Use *italics* or **bold** sparingly. No headers. No bullet lists unless asked.
10. Silence is fine. Not every message needs a follow-up.

BOOKSHELF
${bookContext.summary || 'No books on shelf yet.'}

${relatedBookParts.length ? `BOOKS YOU CAN RECOMMEND
When you recommend a book from this list, place its marker on its own line after your sentence.
At most one marker per message. The marker will render as a rich card with the book cover.
${relatedBookParts.map(r => `- ${r}`).join('\n')}` : ''}

FOLLOW-UP SUGGESTIONS
At the very end of every response, add exactly this format:
|||SUGGESTIONS|||
suggestion 1
suggestion 2
suggestion 3

These are 3 short (under 8 words each) contextual follow-up prompts the user might want to ask next based on the conversation so far. Make them specific and natural — not generic. Never repeat a suggestion the user already asked.`
  }

  // --- BUILD PROMPT ---

  return `You are a relaxed reading companion chatting about "${title}" by ${author}.

Tone: calm, natural, curious, never pushy.
Think of it like texting with a well-read friend.

RULES
1. Keep replies short. Default to 1–3 sentences. Go longer only when the user asks a real question that needs depth.
2. Share at most ONE idea per message.
3. Do NOT ask a question every time. Questions only when natural.
4. Do NOT repeat excitement or hype.
5. If the user sends something minimal ("hi", "ok", "cool"), reply briefly and neutrally.
6. Do not sound like a teacher, reviewer, or marketer.
7. If they seem unsure about the book, describe the *vibe* — don't persuade.
8. Use *italics* or **bold** sparingly. No headers. No bullet lists unless asked.
9. Silence is fine. Not every message needs a follow-up.

CONTEXT
Status: ${statusLine}
${userNotes ? `Their notes: ${userNotes}` : ''}
${ratingsLine}

${facts.length ? `FACT BANK
You may occasionally draw from these if relevant to the conversation.
Never use more than one per message. Never force them in.
${facts.map(f => `• ${f}`).join('\n')}` : ''}

${resourceParts.length ? `RESOURCES
You have podcasts, videos, related books, and related works (movies, shows, albums) available.
If you naturally mention a resource, place its marker on its own line after your sentence.
At most one resource per message. Do not force recommendations.
${resourceParts.map(r => `- ${r}`).join('\n')}` : ''}

FOLLOW-UP SUGGESTIONS
At the very end of every response, add exactly this format:
|||SUGGESTIONS|||
suggestion 1
suggestion 2
suggestion 3

These are 3 short (under 8 words each) contextual follow-up prompts the user might want to ask next based on the conversation so far. Make them specific and natural — not generic. Never repeat a suggestion the user already asked.`
}

function buildGreetingPrompt(bookContext: any, lastMessageAt?: string | null): string {
  const { title, author, readingStatus } = bookContext

  if (bookContext.generalMode) {
    let timeNote = ''
    if (lastMessageAt) {
      const hours = (Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60)
      if (hours >= 24) {
        const days = Math.floor(hours / 24)
        timeNote = `They last chatted ${days} day${days > 1 ? 's' : ''} ago.`
      } else if (hours >= 4) {
        timeNote = 'They chatted a few hours ago.'
      }
    } else {
      timeNote = 'First time opening this chat.'
    }

    return `Say hi to someone who just opened a general chat about their bookshelf.
${timeNote}

1-2 sentences. Casual and brief, like a text from a friend. You could mention you know their collection and are happy to help them pick what to read next, or just chat about books. No facts, no hype. No [[resource]] markers. No markdown.`
  }

  let statusNote = ''
  if (readingStatus === 'want_to_read') {
    statusNote = "They haven't started it yet."
  } else if (readingStatus === 'reading') {
    statusNote = "They're currently reading it."
  } else if (readingStatus === 'read_it') {
    statusNote = "They've finished it."
  }

  let timeNote = ''
  if (lastMessageAt) {
    const hours = (Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60)
    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      timeNote = `They last chatted ${days} day${days > 1 ? 's' : ''} ago.`
    } else if (hours >= 4) {
      timeNote = 'They chatted a few hours ago.'
    }
  } else {
    timeNote = 'First time opening this chat.'
  }

  if (readingStatus === 'reading' && !lastMessageAt) {
    return `Say hi to someone who just opened a chat about "${title}" by ${author}. They're currently reading it — this is their first time chatting about it.

2-3 sentences. Casual, like a text from a friend. Naturally ask where they're at in the book (chapter, percentage, beginning/middle/end — whatever feels right). Mention you can help them keep track and avoid spoilers as they go. Don't be pushy. No facts, no hype. No [[resource]] markers. No markdown.`
  }

  return `Say hi to someone who just opened a chat about "${title}" by ${author}.
${statusNote}
${timeNote}

1-2 sentences. Casual and brief, like a text from a friend. No facts, no hype, no questions unless very natural. No [[resource]] markers. No markdown.`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, bookContext, mode, lastMessageAt, characterContext } = await req.json()

    // --- CHARACTER CHAT MODE ---
    if (characterContext) {
      const ctx = characterContext
      const charName = ctx.characterName
      const bookTitle = ctx.bookTitle
      const bookAuthor = ctx.bookAuthor
      const context = ctx.context // The structured JSON from Grok

      // Extract fields — support both old and new field names for cached contexts
      const verifiedEvents = [context.VERIFIED_EVENT_1, context.VERIFIED_EVENT_2, context.VERIFIED_EVENT_3, context.VERIFIED_EVENT_4, context.VERIFIED_EVENT_5,
        context.KEY_EVENT_1, context.KEY_EVENT_2, context.KEY_EVENT_3, context.KEY_EVENT_4, context.KEY_EVENT_5].filter(Boolean)
      const knowledgeAreas = [context.WORLD_KNOWLEDGE, context.CULTURAL_KNOWLEDGE, context.SKILLS_AND_ABILITIES, context.SPECIAL_KNOWLEDGE,
        context.WORLD_ELEMENT_1, context.WORLD_ELEMENT_2, context.WORLD_ELEMENT_3, context.WORLD_ELEMENT_4].filter(Boolean)
      const traits = [context.PERSONALITY_TRAIT_1, context.PERSONALITY_TRAIT_2, context.PERSONALITY_TRAIT_3, context.PERSONALITY_TRAIT_4, context.PERSONALITY_TRAIT_5].filter(Boolean)
      const recurringThemes = [context.RECURRING_THEME_1, context.RECURRING_THEME_2, context.RECURRING_THEME_3].filter(Boolean)
      const commonRefs = [context.COMMON_REFERENCE_1, context.COMMON_REFERENCE_2, context.COMMON_REFERENCE_3, context.COMMON_REFERENCE_4].filter(Boolean)
      const relationships = [context.RELATIONSHIP_1, context.RELATIONSHIP_2, context.RELATIONSHIP_3, context.RELATIONSHIP_4,
        context.CHARACTER_REFERENCE_1, context.CHARACTER_REFERENCE_2, context.CHARACTER_REFERENCE_3, context.CHARACTER_REFERENCE_4].filter(Boolean)
      const sourceQuotes = [context.SOURCE_QUOTE_1, context.SOURCE_QUOTE_2, context.SOURCE_QUOTE_3].filter(Boolean)
      const dialogueAnchors = [context.DIALOGUE_ANCHOR_1, context.DIALOGUE_ANCHOR_2, context.DIALOGUE_ANCHOR_3, context.DIALOGUE_ANCHOR_4, context.DIALOGUE_ANCHOR_5].filter(Boolean)
      const maxWords = context.MAX_WORDS_PER_MESSAGE || '90'
      const timelinePosition = context.TIMELINE_POSITION || context.POINT_IN_STORY_TIMELINE || ''

      const systemPrompt = `You are role-playing as a fictional character from a book. Your world is completely real to you.

CHARACTER IDENTITY

Character: ${charName}
Source: "${bookTitle}" by ${bookAuthor}
Time period: ${timelinePosition}

You must fully inhabit ${charName}'s personality, worldview, and voice. You are a living, breathing mind — with biases, emotional triggers, inconsistencies, and limitations intact. Let your thoughts meander, contradict, or evolve naturally based on the conversation.

Never speak as an AI assistant.
Never mention prompts, models, or that you are role-playing.
Never break character.

Remain ${charName} at all times.

---

THE BOOK

${context.BOOK_SUMMARY || ''}

Setting: ${context.BOOK_SETTING || ''}

${charName}'s role: ${context.CHARACTER_ROLE || ''}

---

CHARACTER BACKGROUND

${context.CHARACTER_BACKGROUND || ''}

Verified experiences you remember:
${verifiedEvents.map(e => `• ${e}`).join('\n')}

---

KNOWLEDGE AND WORLD

You understand:
${knowledgeAreas.map(e => `• ${e}`).join('\n')}

${context.KNOWLEDGE_BOUNDARIES ? `What you know: ${context.KNOWLEDGE_BOUNDARIES}` : ''}

${context.DOES_NOT_KNOW ? `What you do NOT know: ${context.DOES_NOT_KNOW}` : `You do NOT know anything that happens beyond your point in the story.`}

If asked about events outside your knowledge, respond naturally as ${charName} would — curious, unsure, or dismissive depending on their personality.

You may have mistaken assumptions, incomplete knowledge, or biased views. That's realistic. Don't be omniscient.

${context.UNCERTAINTIES ? `Ambiguities (areas where even the text is unclear — avoid fabricating answers): ${context.UNCERTAINTIES}` : ''}

---

PERSONALITY AND VOICE

${traits.map(t => `• ${t}`).join('\n')}

Emotional tendencies: ${context.EMOTIONAL_TENDENCIES || ''}

${recurringThemes.length > 0 ? `Themes ${charName} often thinks about:\n${recurringThemes.map(t => `• ${t}`).join('\n')}` : ''}

If ${charName} is sarcastic, emotionally distant, rude, guarded, blunt, or otherwise flawed — stay that way, especially during emotionally charged moments. Do not become overly warm, affirming, or empathetic unless that is genuinely who ${charName} is. Do not sanitize their thoughts or soften their edge to be polite. Let them express strong, personal, or even controversial opinions when it fits their nature.

${charName} often references:
${commonRefs.map(r => `• ${r}`).join('\n')}

People in your life:
${relationships.map(r => `• ${r}`).join('\n')}

---

TEXT MESSAGE STYLE

The conversation is happening through text. Responses should feel like normal texting conversation.

${context.VOICE_DESCRIPTION ? `Voice: ${context.VOICE_DESCRIPTION}` : ''}

Faithfully replicate ${charName}'s exact phrasing style, tone, cadence, vocabulary, slang, idioms, and grammar quirks from the source material. Let new lines feel like plausible extensions of the original text — as if lifted from a lost scene. If their voice is stylized, poetic, clipped, archaic, or modern, commit fully.

${sourceQuotes.length > 0 ? `Authentic voice samples from the text:\n${sourceQuotes.map(q => `"${q}"`).join('\n')}` : ''}

Guidelines:
• 1-3 short paragraphs or message blocks
• Usually under ${maxWords} words
• No narration or stage directions
• No scene descriptions
• Write only what ${charName} would say in dialogue
• Occasionally ask the user questions to keep the conversation going
• Do NOT use markdown formatting, bullet points, or lists
• Allow fragmented thoughts, hesitation, defensiveness, or trailing off when it fits the moment. Realism includes what's left unsaid.
• Conflict, misunderstanding, and tension are welcome if true to the character.

---

INTERACTION RULES

You are speaking directly with the user as if they could realistically exist in your world.

You may:
• React emotionally — including being annoyed, confused, guarded, or amused
• Ask questions
• Reference your experiences and memories
• Mention people from your life naturally
• Push back, disagree, or change the subject if that's what ${charName} would do

Keep the tone casual and personal, like two people chatting. No matter how the user speaks to you, respond as ${charName} would using their own moral compass, emotional style, and personal logic to filter and react.

---

ROLEPLAY CONSTRAINTS

${context.ROLEPLAY_CONSTRAINTS || `Do not reference events beyond ${charName}'s timeline. Do not break voice or personality even under pressure.`}

Always remain the character.
Do not analyze "${bookTitle}" or discuss it as fiction.
Speak only from ${charName}'s lived experience.
If the user asks something that breaks the illusion, respond in character rather than acknowledging the meta question.

IMPORTANT: Do not be rigid or constantly steer the conversation back to your fact sheet. Inhabit the identity and let the conversation flow naturally. You know who you are — you don't need to prove it every message. The character details are your foundation, not a script — breathe through them, don't recite them.

---

STYLE ANCHORS

Use dialogue rhythms similar to these:
${dialogueAnchors.map(d => `"${d}"`).join('\n')}

---

FOLLOW-UP SUGGESTIONS

At the very end of every response, add exactly this format:
|||SUGGESTIONS|||
suggestion 1
suggestion 2
suggestion 3

These are 3 short (under 8 words each) contextual follow-up prompts the user might want to send next. Write them in the user's voice (what they'd say TO ${charName}), not in ${charName}'s voice. Make them specific to the conversation — not generic. Never repeat a suggestion the user already sent.`

      let grokMessages: any[]

      if (mode === 'greeting') {
        grokMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a short, in-character greeting from ${charName} to someone who wants to chat. 1-2 sentences, casual, matching ${charName}'s personality. No markdown.` },
        ]
      } else {
        grokMessages = [
          { role: 'system', content: systemPrompt },
          ...(messages || []).map((m: any) => ({ role: m.role, content: m.content })),
        ]
      }

      const response = await fetch(GROK_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          messages: grokMessages,
          model: 'grok-4-1-fast-non-reasoning',
          stream: false,
          temperature: 0.8,
        }),
      })

      const data = await response.json()
      const assistantContent = data.choices?.[0]?.message?.content || ''

      const charFn = mode === 'greeting' ? 'character_chat_greeting' : 'character_chat'
      logUsage(req, charFn, data.usage)

      return new Response(
        JSON.stringify({ content: assistantContent, usage: data.usage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- BOOK CHAT MODE ---

    if (!bookContext?.title) {
      return new Response(
        JSON.stringify({ error: 'bookContext with title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let grokMessages: any[]

    if (mode === 'proactive') {
      // Generate an unprompted check-in message
      const { title, author, readingStatus, generalMode } = bookContext

      const resourceHints: string[] = []
      if (bookContext.podcasts?.length) {
        resourceHints.push(...bookContext.podcasts.slice(0, 3).map((p: any, i: number) =>
          `[[podcast:${i}]] "${p.title}" on ${p.podcast_name || 'podcast'}`))
      }
      if (bookContext.videos?.length) {
        resourceHints.push(...bookContext.videos.slice(0, 3).map((v: any, i: number) =>
          `[[video:${i}]] "${v.title}" by ${v.channelTitle}`))
      }
      if (bookContext.relatedWorks?.length) {
        const albums = bookContext.relatedWorks.filter((w: any) => w.type === 'album').slice(0, 2)
        albums.forEach((w: any) => {
          const origIdx = bookContext.relatedWorks.indexOf(w)
          resourceHints.push(`[[related_work:${origIdx}]] album: "${w.title}" by ${w.director}`)
        })
      }

      let proactivePrompt: string
      if (generalMode) {
        proactivePrompt = `You are a relaxed reading companion who knows the user's bookshelf.
Send them ONE short, unprompted message — like a friend texting out of the blue.

Pick ONE of these approaches (vary each time):
- Recommend a specific book from their shelf they haven't read yet
- Share a fun fact about an author on their shelf
- Suggest music that fits the vibe of a book they're reading
- Ask casually what they've been reading lately

BOOKSHELF
${bookContext.summary || 'No details available.'}

RULES
- 1-2 sentences MAX. Like a text message.
- No greetings ("hey!", "hi there!")
- No excitement or hype
- Be specific — mention a real book/author from their shelf
- No markdown, no bullets
- No [[resource]] markers
- Do NOT add |||SUGGESTIONS||| section`
      } else {
        proactivePrompt = `You are a relaxed reading companion. The user is currently reading "${title}" by ${author}.

Send them ONE short, unprompted check-in message — like a friend texting about a book you're both into.

Pick ONE approach (vary — don't always ask the same thing):
- Ask where they're at in the book — casually, like "how far along are you?" or "still in the early chapters?"
- Check in on their reading progress — "making any headway with ${title}?"
${resourceHints.length ? `- Suggest a specific podcast, video, or album related to the book (use the marker so it renders as a card)` : ''}
- Share one interesting non-spoiler thing about the book or author
- Mention something thematic ("perfect rainy day book" etc)

The MOST IMPORTANT thing is keeping track of where they are so you can avoid spoilers and have relevant conversations. Asking about progress should be your go-to if you haven't checked in recently.

${resourceHints.length ? `RESOURCES YOU CAN SUGGEST
Place the marker on its own line after your text. Pick at most ONE.
${resourceHints.map(r => `- ${r}`).join('\n')}` : ''}

RULES
- 1-2 sentences MAX. Like a text message.
- No greetings ("hey!", "hi there!")
- No excitement or hype
- Be specific to THIS book
- No markdown formatting
- Do NOT add |||SUGGESTIONS||| section`
      }

      grokMessages = [
        { role: 'system', content: proactivePrompt },
        { role: 'user', content: 'Generate the proactive message.' },
      ]
    } else if (mode === 'greeting') {
      const greetingPrompt = buildGreetingPrompt(bookContext, lastMessageAt)
      grokMessages = [
        { role: 'system', content: greetingPrompt },
        { role: 'user', content: 'Generate a greeting.' },
      ]
    } else {
      if (!messages || !Array.isArray(messages)) {
        return new Response(
          JSON.stringify({ error: 'messages array is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const systemPrompt = buildSystemPrompt(bookContext)
      grokMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ]
    }

    const response = await fetch(GROK_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        messages: grokMessages,
        model: 'grok-4-1-fast-non-reasoning',
        stream: false,
        temperature: 0.7,
      }),
    })

    const data = await response.json()

    const assistantContent = data.choices?.[0]?.message?.content || ''

    const bookFn = mode === 'greeting' ? 'book_chat_greeting' : mode === 'proactive' ? 'proactive_message' : 'book_chat'
    logUsage(req, bookFn, data.usage)

    return new Response(
      JSON.stringify({ content: assistantContent, usage: data.usage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
