import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '8550242447:AAGBSit95duYJ4Thjus69CthB0Kqq0IZYV4'
// For supergroups, the chat_id needs -100 prefix
const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || '-1003738968283'
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    'themes': '🎭',
    'characters': '👤',
    'writing style': '✍️',
    'ethics': '⚖️',
    'personal reflection': '💭',
    'real world': '🌍',
  }
  return emojis[category.toLowerCase()] || '💡'
}

interface DiscussionQuestion {
  id: number
  question: string
  category: string
}

interface CreateTopicRequest {
  bookTitle: string
  bookAuthor: string
  canonicalBookId: string
  discussionQuestions?: DiscussionQuestion[]
  coverUrl?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookTitle, bookAuthor, canonicalBookId, discussionQuestions, coverUrl } = await req.json() as CreateTopicRequest

    if (!bookTitle || !bookAuthor) {
      return new Response(
        JSON.stringify({ error: 'bookTitle and bookAuthor are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the topic name (Telegram limits to 128 chars)
    const topicName = `${bookTitle} - ${bookAuthor}`.substring(0, 128)

    // Create forum topic using Telegram Bot API
    const createResponse = await fetch(`${TELEGRAM_API}/createForumTopic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        name: topicName,
        icon_color: 7322096, // Blue color
      }),
    })

    const createData = await createResponse.json()

    if (!createData.ok) {
      console.error('Telegram API error:', createData)
      return new Response(
        JSON.stringify({ error: createData.description || 'Failed to create topic' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const topicId = createData.result.message_thread_id

    // Generate the invite link to the specific topic
    // For private groups: https://t.me/c/CHAT_ID_WITHOUT_100/TOPIC_ID
    const chatIdForLink = CHAT_ID.replace('-100', '')
    const inviteLink = `https://t.me/c/${chatIdForLink}/${topicId}`

    // Send cover image if provided
    if (coverUrl) {
      await fetch(`${TELEGRAM_API}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          message_thread_id: topicId,
          photo: coverUrl,
          caption: `📖 <b>${bookTitle}</b>\nby ${bookAuthor}`,
          parse_mode: 'HTML',
        }),
      })
    }

    // Send a welcome message to the topic
    let welcomeText = `📚 <b>Welcome to the discussion for "${bookTitle}" by ${bookAuthor}!</b>\n\nShare your thoughts, questions, and insights about this book.`

    // Add discussion questions if provided
    if (discussionQuestions && discussionQuestions.length > 0) {
      welcomeText += '\n\n💬 <b>Discussion Starters:</b>\n'
      discussionQuestions.forEach((q, idx) => {
        const categoryEmoji = getCategoryEmoji(q.category)
        welcomeText += `\n${idx + 1}. ${categoryEmoji} ${q.question}`
      })
    }

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        message_thread_id: topicId,
        text: welcomeText,
        parse_mode: 'HTML',
      }),
    })

    return new Response(
      JSON.stringify({
        success: true,
        topicId,
        inviteLink,
        topicName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
