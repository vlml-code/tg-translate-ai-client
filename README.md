# Telegram Web Client

A modern web-based Telegram client built with React, TypeScript, and the Telegram MTProto API.

## Features

- **Full Authentication Flow**
  - Phone number verification
  - SMS code input
  - Two-factor authentication (2FA) password support
  - Session persistence (no need to re-login)

- **Chat Management**
  - View all your chats (users, groups, channels)
  - Real-time chat list with unread count
  - Last message preview
  - Beautiful, modern UI

- **Message Viewing**
  - Scroll through message history
  - Infinite scroll - automatically loads previous messages as you scroll up
  - Starts with latest messages
  - Date separators for easy navigation
  - Distinguishes between incoming and outgoing messages

## Prerequisites

- Node.js 18+ and npm
- Telegram API credentials (API ID and API Hash)

## Getting Your Telegram API Credentials

1. Go to https://my.telegram.org/apps
2. Log in with your phone number
3. Click on "API development tools"
4. Create a new application (if you haven't already)
5. Copy your `API ID` and `API Hash`

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tg-translate-ai-client
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Edit `.env` and add your Telegram API credentials:
```env
VITE_API_ID=your_api_id_here
VITE_API_HASH=your_api_hash_here
```

## Usage

### Development Mode

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

Build the application for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## How to Use

### First Time Login

1. Open the application in your browser
2. Enter your phone number with country code (e.g., +1234567890)
3. Click "Send Code"
4. Enter the verification code sent to your Telegram app
5. If you have 2FA enabled, enter your password
6. You're logged in!

### Using the Application

1. **View Chats**: All your chats are displayed in the left sidebar
2. **Select a Chat**: Click on any chat to view its messages
3. **Scroll Messages**:
   - Messages start from the most recent
   - Scroll up to load older messages automatically
   - Date separators help you navigate through time
4. **Logout**: Click the "Logout" button in the chat list header

### Session Persistence

Your session is saved in the browser's local storage. This means:
- You don't need to re-login every time you open the app
- Your session persists across browser refreshes
- To logout, click the "Logout" button

## Project Structure

```
tg-translate-ai-client/
├── src/
│   ├── components/
│   │   ├── AuthForm.tsx        # Authentication UI
│   │   ├── AuthForm.css
│   │   ├── ChatList.tsx        # List of all chats
│   │   ├── ChatList.css
│   │   ├── ChatView.tsx        # Individual chat messages
│   │   └── ChatView.css
│   ├── services/
│   │   ├── telegramClient.ts   # Telegram API integration
│   │   └── sessionManager.ts   # Session storage management
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   ├── App.tsx                 # Main application component
│   ├── App.css
│   ├── main.tsx                # Application entry point
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── README.md
```

## Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **telegram** (GramJS) - Telegram MTProto API client
- **CSS3** - Styling

## Security Notes

- Never commit your `.env` file or share your API credentials
- The session is stored in browser's local storage (cleared on logout)
- All communication with Telegram is encrypted via MTProto

## Troubleshooting

### "Failed to initialize Telegram client"
- Make sure your API ID and API Hash are correct in `.env`
- Check your internet connection
- Ensure you're using Node.js 18+
- If you see `AUTH_KEY_DUPLICATED`, Telegram rejected the cached session because the same account is logged in elsewhere. The web client clears the cached key automatically so you can request a fresh login code, but you may need to terminate other sessions from Telegram → Settings → Devices before new codes arrive.

### "Failed to send code"
- Verify your phone number is in international format (+1234567890)
- Make sure you have access to your Telegram account

### Messages not loading
- Check browser console for errors
- Try logging out and logging back in
- Clear browser cache and local storage

## Future Enhancements

This is the basic functionality. Planned features include:
- Sending messages
- Media support (images, videos, documents)
- Search functionality
- AI-powered translation
- Voice/video calls support
- Group management

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.