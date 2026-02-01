import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '8550242447:AAGBSit95duYJ4Thjus69CthB0Kqq0IZYV4'
// For supergroups, the chat_id needs -100 prefix
const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || '-1003738968283'
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Genre to emoji mapping for topic icons
const genreToEmojiMap: Record<string, string[]> = {
  "Business & Personal Finance": ["5350452584119279096", "5350305691942788490", "5350713563512052787", "5309929258443874898", "5377690785674175481", "5348227245599105972"], // 💰, 📈, 📉, 💸, 🪙, 💼
  "Computers & Internet": ["5350554349074391003", "5409357944619802453", "5309832892262654231", "5386379624773066504"], // 💻, 📱, 🤖, 🖨
  "Sci-Fi & Fantasy": ["5309832892262654231", "5413625003218313783", "5350367161514732241", "5357107601584693888"], // 🤖, 🦄, 🔮, 👑
  "Mysteries & Thrillers": ["5309965701241379366", "5357121491508928442", "5386395194029515402", "5377494501373780436"], // 🔎, 👀, 🏴‍☠️, 👮‍♂️
  "Romance": ["5312138559556164615", "5310029292527164639", "5357185426392096577", "5368808634392257474"], // ❤️, 💘, 🫦, 💅
  "Cookbooks, Food & Wine": ["5350344462612570293", "5350406176997646350", "5350403544182694064", "5350444672789519765", "5350392020785437399"], // 🍽, 🍣, 🍔, 🍕, ☕️
  "Arts & Entertainment": ["5310039132297242441", "5350658016700013471", "5368653135101310687", "5310045076531978942", "5382003830487523366"], // 🎨, 🎭, 🎬, 🎵, 🎤
  "Science & Nature": ["5368585403467048206", "5377580546748588396", "5411138633765757782", "5237889595894414384", "5312424913615723286"], // 🔭, 🔬, 🧪, 🧠, 🦠
  "Health, Mind & Body": ["5350307998340226571", "5310094636159607472", "5310139157790596888", "5377468357907849200"], // 🩺, 💊, 💉, 🧼
  "Travel & Adventure": ["5348436127038579546", "5357120306097956843", "5310303848311562896", "5418196338774907917", "5350648297189023928"], // ✈️, 🧳, 🏖, 🏔, 🏕
  "Sports & Outdoors": ["5375159220280762629", "5384327463629233871", "5312315739842026755", "5408906741125490282"], // ⚽️, 🏀, 🏆, 🏁
  "Biographies & Memoirs": ["5377544228505134960", "5370870893004203704", "5238156910363950406", "5238027455754680851"], // 🎙, 🗣, ✍️, 🎖
  "Children & Teens": ["5377675010259297233", "5309950797704865693", "5238234236955148254", "5413625003218313783"], // 👶, 🎮, 🤡, 🦄
  "History": ["5350548830041415279", "5357188789351490453", "5357419403325481346"], // 🏛, 🪖, 🎓
  "Politics & Current Events": ["5434144690511290129", "5350387571199319521", "5309984423003823246"], // 📰, 🗳, 📣
  "Parenting & Family": ["5386435923204382258", "5386609083400856174", "5377675010259297233"], // 👨‍👩‍👧‍👦, 🤰, 👶
  "Humor": ["5238234236955148254", "5420216386448270341"], // 🤡, 🆒
  "Self-Help": ["5312536423851630001", "5237889595894414384", "5235579393115438657"], // 💡, 🧠, ⭐️
  "Religion & Spirituality": ["5350367161514732241", "5235579393115438657"], // 🔮, ⭐️
  "Education": ["5357419403325481346", "5373251851074415873", "5355127101970194557"], // 🎓, 📝, 🧮
}

const DEFAULT_BOOK_EMOJI = "5350481781306958339" // 📚

function getRandomEmojiByGenre(genre?: string): string {
  if (!genre) return DEFAULT_BOOK_EMOJI

  const ids = genreToEmojiMap[genre]
  if (!ids || ids.length === 0) return DEFAULT_BOOK_EMOJI

  const randomIndex = Math.floor(Math.random() * ids.length)
  return ids[randomIndex]
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
  genre?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookTitle, bookAuthor, discussionQuestions, coverUrl, genre } = await req.json() as CreateTopicRequest

    if (!bookTitle || !bookAuthor) {
      return new Response(
        JSON.stringify({ error: 'bookTitle and bookAuthor are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the topic name (Telegram limits to 128 chars)
    const topicName = `${bookTitle} - ${bookAuthor}`.substring(0, 128)

    // Get a random emoji based on the book's genre
    const topicEmoji = getRandomEmojiByGenre(genre)

    // Create forum topic using Telegram Bot API
    const createResponse = await fetch(`${TELEGRAM_API}/createForumTopic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        name: topicName,
        icon_custom_emoji_id: topicEmoji,
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
