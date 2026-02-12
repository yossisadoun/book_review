import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || '-1003738968283'
const GROK_API_KEY = Deno.env.get('GROK_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
const GROK_API = 'https://api.x.ai/v1/chat/completions'

// Initialize Supabase client with service role for server-side operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TelegramMessage {
  message_id: number
  from?: {
    id: number
    username?: string
    first_name?: string
  }
  chat: {
    id: number
    type: string
  }
  message_thread_id?: number
  text?: string
  entities?: Array<{
    type: string
    offset: number
    length: number
    user?: {
      id: number
      username?: string
    }
  }>
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

/**
 * Check if the bot is mentioned in the message
 */
function isBotMentioned(message: TelegramMessage, botUsername: string): boolean {
  if (!message.entities || !message.text) return false

  return message.entities.some(entity => {
    if (entity.type === 'mention') {
      const mentionText = message.text!.substring(entity.offset, entity.offset + entity.length)
      return mentionText.toLowerCase() === `@${botUsername.toLowerCase()}`
    }
    return false
  })
}

/**
 * Extract the user's question (removing the @mention)
 */
function extractQuestion(message: TelegramMessage, botUsername: string): string {
  if (!message.text) return ''

  // Remove the @botname mention
  const cleanedText = message.text
    .replace(new RegExp(`@${botUsername}\\s*`, 'gi'), '')
    .trim()

  return cleanedText
}

/**
 * Look up book info from telegram_topics table using message_thread_id
 */
async function getBookFromTopic(threadId: number): Promise<{ bookTitle: string; bookAuthor: string } | null> {
  const { data, error } = await supabase
    .from('telegram_topics')
    .select('book_title, book_author')
    .eq('telegram_topic_id', threadId)
    .maybeSingle()

  if (error || !data) {
    console.error('Error fetching book from topic:', error)
    return null
  }

  return {
    bookTitle: data.book_title,
    bookAuthor: data.book_author,
  }
}

/**
 * Call Grok API to generate a response as a book expert
 */
async function getBookExpertResponse(
  bookTitle: string,
  bookAuthor: string,
  userQuestion: string
): Promise<string> {
  if (!GROK_API_KEY) {
    console.error('GROK_API_KEY is not configured')
    return "I apologize, but I'm currently unable to respond. Please try again later."
  }

  const systemPrompt = `You are an expert on the book "${bookTitle}" by ${bookAuthor}. You have deep knowledge of the book's themes, characters, plot, writing style, historical context, and literary significance.

Respond to questions about this book in a helpful, engaging, and insightful way. Keep responses concise but informative - aim for 2-3 paragraphs max unless the question requires more detail.

If asked about something unrelated to the book or literature in general, politely redirect the conversation back to the book.

Format your response for Telegram (use simple text, avoid markdown that Telegram doesn't support well).`

  const payload = {
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userQuestion,
      },
    ],
    model: 'grok-4-1-fast-non-reasoning',
    stream: false,
    temperature: 0.7,
    max_tokens: 1000,
  }

  try {
    const response = await fetch(GROK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Grok API error:', response.status, errorText)
      return "I'm having trouble thinking right now. Please try again in a moment."
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return "I couldn't formulate a response. Please try rephrasing your question."
    }

    return content
  } catch (error) {
    console.error('Error calling Grok API:', error)
    return "Something went wrong while processing your question. Please try again."
  }
}

/**
 * Send a reply message to Telegram
 */
async function sendTelegramReply(
  chatId: number,
  threadId: number,
  replyToMessageId: number,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_thread_id: threadId,
        reply_to_message_id: replyToMessageId,
        text: text,
        parse_mode: 'HTML',
      }),
    })

    const data = await response.json()
    if (!data.ok) {
      console.error('Telegram send error:', data)
      return false
    }
    return true
  } catch (error) {
    console.error('Error sending Telegram message:', error)
    return false
  }
}

/**
 * Get bot info to determine username
 */
async function getBotUsername(): Promise<string | null> {
  try {
    const response = await fetch(`${TELEGRAM_API}/getMe`)
    const data = await response.json()
    if (data.ok && data.result?.username) {
      return data.result.username
    }
    return null
  } catch (error) {
    console.error('Error getting bot info:', error)
    return null
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST requests (Telegram webhook)
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const update: TelegramUpdate = await req.json()
    console.log('Received update:', JSON.stringify(update, null, 2))

    // Only process messages (not edited_message, channel_post, etc.)
    if (!update.message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const message = update.message

    // Only process messages in forum topics (has message_thread_id)
    if (!message.message_thread_id) {
      console.log('Message not in a forum topic, ignoring')
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get bot username to check for mentions
    const botUsername = await getBotUsername()
    if (!botUsername) {
      console.error('Could not get bot username')
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if bot is mentioned
    if (!isBotMentioned(message, botUsername)) {
      console.log('Bot not mentioned, ignoring message')
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Bot mentioned by ${message.from?.username || 'unknown'} in thread ${message.message_thread_id}`)

    // Look up the book from the topic
    const bookInfo = await getBookFromTopic(message.message_thread_id)
    if (!bookInfo) {
      console.log('Could not find book for this topic')
      await sendTelegramReply(
        message.chat.id,
        message.message_thread_id,
        message.message_id,
        "I don't recognize this book discussion topic. I can only help in topics created for specific books."
      )
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found book: "${bookInfo.bookTitle}" by ${bookInfo.bookAuthor}`)

    // Extract the user's question
    const question = extractQuestion(message, botUsername)
    if (!question) {
      await sendTelegramReply(
        message.chat.id,
        message.message_thread_id,
        message.message_id,
        `Hello! I'm here to discuss "${bookInfo.bookTitle}" by ${bookInfo.bookAuthor}. Ask me anything about the book!`
      )
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get AI response
    const aiResponse = await getBookExpertResponse(
      bookInfo.bookTitle,
      bookInfo.bookAuthor,
      question
    )

    // Send reply
    await sendTelegramReply(
      message.chat.id,
      message.message_thread_id,
      message.message_id,
      aiResponse
    )

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    // Always return 200 to Telegram to prevent retries
    return new Response(JSON.stringify({ ok: true, error: 'Internal error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
