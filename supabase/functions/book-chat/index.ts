import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GROK_API_KEY = Deno.env.get('GROK_API_KEY') || ''
const GROK_CHAT_URL = 'https://api.x.ai/v1/chat/completions'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildSystemPrompt(bookContext: any): string {
  const { title, author, readingStatus, userNotes, userRatings } = bookContext

  // --- CONTEXT: book data ---

  let statusLine = ''
  if (readingStatus === 'reading') {
    statusLine = 'Currently reading. Avoid spoilers beyond where they might be.'
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
${resourceParts.map(r => `- ${r}`).join('\n')}` : ''}`
}

function buildGreetingPrompt(bookContext: any, lastMessageAt?: string | null): string {
  const { title, author, readingStatus } = bookContext

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
    const { messages, bookContext, mode, lastMessageAt } = await req.json()

    if (!bookContext?.title) {
      return new Response(
        JSON.stringify({ error: 'bookContext with title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let grokMessages: any[]

    if (mode === 'greeting') {
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
