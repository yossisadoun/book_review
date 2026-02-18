import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '8550242447:AAGBSit95duYJ4Thjus69CthB0Kqq0IZYV4'
// For supergroups, the chat_id needs -100 prefix
const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || '-1003738968283'
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Genre to emoji mapping for topic icons - supports Apple Books genre names
const genreToEmojiMap: Record<string, string[]> = {
  // ARTS & ENTERTAINMENT
  "Art & Architecture": ["5310039132297242441", "5350548830041415279"], // 🎨, 🏛
  "Arts & Entertainment": ["5310039132297242441", "5350658016700013471", "5368653135101310687"], // 🎨, 🎭, 🎬
  "Performing Arts": ["5357370526597653193", "5357298525765902091", "5350658016700013471"], // 💃, 🕺, 🎭
  "Theater": ["5350658016700013471", "5357504778685392027"], // 🎭, 🎩
  "Music": ["5310045076531978942", "5377317729109811382", "5382003830487523366"], // 🎵, 🎶, 🎤
  "Film": ["5368653135101310687", "5350513667144163474"], // 🎬, 📺

  // BUSINESS & FINANCE
  "Business & Personal Finance": ["5350452584119279096", "5350305691942788490", "5348227245599105972"], // 💰, 📈, 💼
  "Investing": ["5350452584119279096", "5350305691942788490", "5350713563512052787", "5377690785674175481", "5310107765874632305"], // 💰, 📈, 📉, 🪙, 💱
  "Marketing & Sales": ["5309984423003823246", "5418085807791545980"], // 📣, 🔝
  "Management & Leadership": ["5348227245599105972", "5386379624773066504"], // 💼, 🖨
  "Business Reference": ["5357315181649076022", "5418115271267197333", "5373251851074415873"], // 📁, 🪪, 📝

  // ROMANCE
  "Romance": ["5312138559556164615", "5310029292527164639"], // ❤️, 💘
  "Contemporary Romance": ["5312138559556164615", "5310029292527164639", "5368808634392257474"], // ❤️, 💘, 💅
  "Erotic Romance": ["5420331611830886484", "5357185426392096577", "5312138559556164615"], // 🔞, 🫦, ❤️
  "Paranormal Romance": ["5312138559556164615", "5350367161514732241", "5413625003218313783"], // ❤️, 🔮, 🦄
  "Historical Romance": ["5312138559556164615", "5357107601584693888", "5350548830041415279"], // ❤️, 👑, 🏛
  "Romantic Suspense": ["5312138559556164615", "5377498341074542641", "5309965701241379366"], // ❤️, ‼️, 🔎
  "Western Romance": ["5312138559556164615", "5418196338774907917"], // ❤️, 🏔
  "Military Romance": ["5312138559556164615", "5357188789351490453"], // ❤️, 🪖
  "New Adult Romance": ["5312138559556164615", "5310029292527164639", "5368808634392257474"], // ❤️, 💘, 💅
  "Romantic Comedies": ["5312138559556164615", "5238234236955148254", "5420216386448270341"], // ❤️, 🤡, 🆒

  // MYSTERY, THRILLER & CRIME
  "Mysteries & Thrillers": ["5309965701241379366", "5357121491508928442", "5377498341074542641"], // 🔎, 👀, ‼️
  "Police Procedural": ["5309965701241379366", "5377494501373780436", "5377498341074542641"], // 🔎, 👮‍♂️, ‼️
  "Women Sleuths": ["5309965701241379366", "5310262535021142850", "5377498341074542641"], // 🔎, 💄, ‼️
  "True Crime": ["5309965701241379366", "5377498341074542641", "5377494501373780436"], // 🔎, ‼️, 👮‍♂️

  // SCI-FI & FANTASY
  "Sci-Fi & Fantasy": ["5309832892262654231", "5413625003218313783", "5350367161514732241"], // 🤖, 🦄, 🔮
  "Science Fiction": ["5309832892262654231", "5350554349074391003"], // 🤖, 💻
  "Fantasy": ["5413625003218313783", "5350367161514732241", "5357107601584693888"], // 🦄, 🔮, 👑
  "Epic Fantasy": ["5357107601584693888", "5350548830041415279", "5350367161514732241"], // 👑, 🏛, 🔮
  "Adventure Sci-Fi": ["5309832892262654231", "5312016608254762256"], // 🤖, ⚡️

  // KIDS & YOUNG ADULT
  "Kids": ["5377675010259297233", "5413625003218313783", "5310228579009699834", "5235912661102773458"], // 👶, 🦄, 🎉, 🐈
  "Fiction for Kids": ["5350481781306958339", "5377675010259297233", "5413625003218313783"], // 📚, 👶, 🦄
  "Young Adult": ["5420216386448270341", "5350481781306958339"], // 🆒, 📚
  "Fiction for Young Adults": ["5350481781306958339", "5420216386448270341"], // 📚, 🆒
  "Humor for Young Adults": ["5238234236955148254", "5420216386448270341", "5310228579009699834"], // 🤡, 🆒, 🎉
  "Children & Teens": ["5377675010259297233", "5309950797704865693", "5238234236955148254", "5413625003218313783"], // 👶, 🎮, 🤡, 🦄

  // HISTORY & BIOGRAPHY
  "History": ["5350548830041415279", "5433614043006903194", "5350497316203668441"], // 🏛, 📆, 🚂
  "Military History": ["5357188789351490453", "5238027455754680851"], // 🪖, 🎖
  "Military & Warfare": ["5357188789351490453", "5238027455754680851"], // 🪖, 🎖
  "Biographies & Memoirs": ["5377544228505134960", "5370870893004203704", "5238156910363950406"], // 🎙, 🗣, ✍️
  "Women's Bios & Memoirs": ["5377544228505134960", "5310262535021142850", "5368741306484925109"], // 🎙, 💄, 👠

  // SCIENCE & NATURE
  "Science & Nature": ["5377580546748588396", "5368585403467048206", "5418196338774907917"], // 🔬, 🔭, 🏔
  "Biology": ["5377580546748588396", "5411138633765757782", "5312424913615723286"], // 🔬, 🧪, 🦠
  "Nature": ["5418196338774907917", "5350648297189023928", "5350424168615649565", "5384574037701696503", "5235912661102773458"], // 🏔, 🏕, ⛅️, 🐟, 🐈
  "Mathematics": ["5355127101970194557"], // 🧮
  "Psychology": ["5237889595894414384", "5312536423851630001"], // 🧠, 💡

  // HEALTH & LIFESTYLE
  "Health, Mind & Body": ["5350307998340226571", "5310094636159607472", "5237889595894414384"], // 🩺, 💊, 🧠
  "Lifestyle & Home": ["5312486108309757006", "5350699789551935589"], // 🏠, 🛍
  "Cookbooks, Food & Wine": ["5350344462612570293", "5350520238444126134", "5350406176997646350", "5350403544182694064", "5350444672789519765"], // 🍽, 🍹, 🍣, 🍔, 🍕
  "Sports & Outdoors": ["5375159220280762629", "5384327463629233871", "5312315739842026755", "5418196338774907917"], // ⚽️, 🏀, 🏆, 🏔
  "Basketball": ["5384327463629233871", "5312315739842026755"], // 🏀, 🏆

  // REFERENCE & EDUCATION
  "Reference": ["5357315181649076022", "5350481781306958339", "5237699328843200968"], // 📁, 📚, ✅
  "Education": ["5357419403325481346", "5350481781306958339"], // 🎓, 📚
  "Textbooks": ["5350481781306958339", "5357419403325481346"], // 📚, 🎓
  "Dictionaries & Thesauruses": ["5373251851074415873", "5350481781306958339"], // 📝, 📚

  // OTHER / GENERAL
  "Nonfiction": ["5350481781306958339", "5373251851074415873"], // 📚, 📝
  "Fiction & Literature": ["5350481781306958339", "5238156910363950406"], // 📚, ✍️
  "Action & Adventure": ["5312016608254762256", "5386395194029515402", "5312241539987020022"], // ⚡️, 🏴‍☠️, 🔥
  "Politics & Current Events": ["5434144690511290129", "5350387571199319521", "5309984423003823246"], // 📰, 🗳, 📣
  "Computers & Internet": ["5350554349074391003", "5409357944619802453", "5309832892262654231"], // 💻, 📱, 🤖
  "Travel & Adventure": ["5348436127038579546", "5357120306097956843", "5310303848311562896", "5418196338774907917", "5350648297189023928"], // ✈️, 🧳, 🏖, 🏔, 🏕
  "Parenting & Family": ["5386435923204382258", "5386609083400856174", "5377675010259297233"], // 👨‍👩‍👧‍👦, 🤰, 👶
  "Humor": ["5238234236955148254", "5420216386448270341"], // 🤡, 🆒
  "Self-Help": ["5312536423851630001", "5237889595894414384", "5235579393115438657"], // 💡, 🧠, ⭐️
  "Religion & Spirituality": ["5350367161514732241", "5235579393115438657"], // 🔮, ⭐️
}

const FALLBACK_EMOJI = "5350481781306958339" // 📚

/**
 * Returns a random emoji ID based on the Apple Books genre name.
 * Uses fuzzy matching as fallback for sub-genres.
 */
function getEmojiByGenre(genreName?: string): string {
  if (!genreName) return FALLBACK_EMOJI

  const ids = genreToEmojiMap[genreName]

  // If we have an exact match, return a random emoji from that genre
  if (ids && ids.length > 0) {
    return ids[Math.floor(Math.random() * ids.length)]
  }

  // If no exact match, look for a keyword match as fallback
  for (const key in genreToEmojiMap) {
    if (genreName.includes(key) || key.includes(genreName)) {
      const fuzzyIds = genreToEmojiMap[key]
      return fuzzyIds[Math.floor(Math.random() * fuzzyIds.length)]
    }
  }

  return FALLBACK_EMOJI
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
    const topicEmoji = getEmojiByGenre(genre)

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

    // Send bot tip message and pin it
    const botTipText = `🤖 <b>Tip:</b> To chat with the Book.luv bot, @mention it or reply to one of its messages.`
    const botTipResponse = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        message_thread_id: topicId,
        text: botTipText,
        parse_mode: 'HTML',
      }),
    })

    const botTipData = await botTipResponse.json()
    if (botTipData.ok && botTipData.result?.message_id) {
      await fetch(`${TELEGRAM_API}/pinChatMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          message_id: botTipData.result.message_id,
          disable_notification: true,
        }),
      })
    }

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
