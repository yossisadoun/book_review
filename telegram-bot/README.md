# Bookluv Telegram Bot

A simple web service that creates Telegram forum topics for book discussions.

## Setup Instructions

### 1. Enable Forum/Topics in Your Telegram Group

1. Open your Telegram group
2. Go to Group Settings > Edit
3. Enable "Topics" (your group needs to be a supergroup)

### 2. Add the Bot to Your Group

1. In Telegram, search for `@bookluv_discussions_bot`
2. Add it to your group
3. **Important:** Make the bot an admin with "Manage Topics" permission

### 3. Get the Chat ID

1. Send any message in the group (after adding the bot)
2. Deploy this service to Render.com (or run locally)
3. Call `GET /get-updates` on the service
4. Look for `chat.id` in the response - it will look like `-1001234567890`

### 4. Deploy to Render.com

1. Push this code to a GitHub repository
2. Go to [Render.com](https://render.com) and create a new Web Service
3. Connect your GitHub repo and select the `telegram-bot` directory
4. Configure the build:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Add environment variables:
   - `TELEGRAM_BOT_TOKEN`: `8550242447:AAGBSit95duYJ4Thjus69CthB0Kqq0IZYV4`
   - `TELEGRAM_CHAT_ID`: (the chat ID from step 3)
6. Deploy!

### 5. Configure the App

Update your Next.js app's environment:

```env
NEXT_PUBLIC_TELEGRAM_BOT_API=https://your-service-name.onrender.com
```

## API Endpoints

### `GET /`
Health check - returns service status.

### `POST /create-topic`
Creates a new forum topic for a book.

**Request body:**
```json
{
  "bookTitle": "The Great Gatsby",
  "bookAuthor": "F. Scott Fitzgerald",
  "canonicalBookId": "the great gatsby|f. scott fitzgerald"
}
```

**Response:**
```json
{
  "success": true,
  "topicId": 123,
  "inviteLink": "https://t.me/c/1234567890/123",
  "topicName": "The Great Gatsby - F. Scott Fitzgerald"
}
```

### `GET /get-updates`
Returns recent messages the bot received. Useful for discovering the chat ID.

### `GET /chat-info`
Returns information about the configured chat.

### `GET /bot-info`
Returns information about the bot.

## Local Development

```bash
cd telegram-bot
npm install
npm run dev
```

The service runs on port 3001 by default.
