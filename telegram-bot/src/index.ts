import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8550242447:AAGBSit95duYJ4Thjus69CthB0Kqq0IZYV4';
// Chat ID for supergroups starts with -100
// You can find this by:
// 1. Adding the bot to your group
// 2. Making the bot admin with "Manage Topics" permission
// 3. Sending a message in the group
// 4. Calling GET /get-updates to see the chat_id
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface CreateTopicRequest {
  bookTitle: string;
  bookAuthor: string;
  canonicalBookId: string;
}

interface TelegramResponse {
  ok: boolean;
  result?: {
    message_thread_id: number;
    name: string;
    icon_color?: number;
  };
  description?: string;
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'bookluv-telegram-bot' });
});

// Create a new forum topic for a book
app.post('/create-topic', async (req, res) => {
  try {
    if (!CHAT_ID) {
      return res.status(500).json({
        error: 'TELEGRAM_CHAT_ID not configured. Add bot to group, send a message, then call GET /get-updates to find the chat_id.'
      });
    }

    const { bookTitle, bookAuthor, canonicalBookId } = req.body as CreateTopicRequest;

    if (!bookTitle || !bookAuthor) {
      return res.status(400).json({ error: 'bookTitle and bookAuthor are required' });
    }

    // Create the topic name (Telegram limits to 128 chars)
    const topicName = `${bookTitle} - ${bookAuthor}`.substring(0, 128);

    // Create forum topic using Telegram Bot API
    const response = await fetch(`${TELEGRAM_API}/createForumTopic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        name: topicName,
        icon_color: 7322096, // Blue color
      }),
    });

    const data = await response.json() as TelegramResponse;

    if (!data.ok) {
      console.error('Telegram API error:', data);
      return res.status(500).json({ error: data.description || 'Failed to create topic' });
    }

    const topicId = data.result!.message_thread_id;

    // Generate the invite link to the specific topic
    // Format: https://t.me/c/CHAT_ID/TOPIC_ID (for private groups)
    // The chat_id for invite links needs to be without the -100 prefix
    const chatIdForLink = CHAT_ID.replace('-100', '');
    const inviteLink = `https://t.me/c/${chatIdForLink}/${topicId}`;

    // Send a welcome message to the topic
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        message_thread_id: topicId,
        text: `Welcome to the discussion for "${bookTitle}" by ${bookAuthor}!\n\nShare your thoughts, questions, and insights about this book.`,
        parse_mode: 'HTML',
      }),
    });

    res.json({
      success: true,
      topicId,
      inviteLink,
      topicName,
    });
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get chat info (useful for debugging)
app.get('/chat-info', async (req, res) => {
  try {
    const response = await fetch(`${TELEGRAM_API}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error getting chat info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent updates - useful to discover the chat_id
// 1. Add bot to group as admin with "Manage Topics" permission
// 2. Send any message in the group
// 3. Call this endpoint to see the chat_id in the response
app.get('/get-updates', async (req, res) => {
  try {
    const response = await fetch(`${TELEGRAM_API}/getUpdates`, {
      method: 'GET',
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error getting updates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get bot info
app.get('/bot-info', async (req, res) => {
  try {
    const response = await fetch(`${TELEGRAM_API}/getMe`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error getting bot info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Bookluv Telegram Bot running on port ${PORT}`);
});
