# 🎮 Last Letter - Multiplayer Word Game

A real-time multiplayer word-chain game where players take turns entering words that start with the last letter of the previous word.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Running the Game](#running-the-game)
- [How to Play](#how-to-play)
- [Word Validation](#word-validation)
- [Local Storage Profile](#local-storage-profile)
- [API Documentation](#api-documentation)
- [Socket Events](#socket-events)
- [Future Improvements](#future-improvements)

## ✨ Features

### Core Gameplay
- 🎯 Real-time multiplayer word-chain game
- ⏱️ Configurable turn timer (5-30 seconds)
- 👥 Support for 2-15 players per room
- 🏆 Automatic elimination and winner detection
- 📊 Post-game leaderboard with stats

### Room System
- 🏠 Create and join rooms with unique 6-character codes
- 👑 Admin controls (kick players, change settings)
- 🔄 Automatic admin transfer on disconnect
- 📋 Public room list in lobby

### Player Features
- 👤 Profile setup with name, age, and optional avatar
- 💾 Profile saved in browser localStorage
- ✅ Ready/unready system before game start
- 📱 Responsive design for mobile and desktop

### Technical Features
- 🔌 Real-time communication via Socket.IO
- ✅ Word validation using free dictionary API
- 💾 In-memory caching for validated words
- 🛡️ Graceful error handling and reconnection

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express** - Server framework
- **Socket.IO** - Real-time bidirectional communication
- **TypeScript** - Type safety
- **UUID** - Unique ID generation

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Socket.IO Client** - Real-time communication

### External APIs
- **Free Dictionary API** (dictionaryapi.dev) - Word validation

## 📁 Project Structure

```
last-letter-game/
├── backend/                    # Node.js + Express backend
│   ├── src/
│   │   ├── index.ts           # Main server entry point
│   │   ├── services/
│   │   │   └── WordValidationService.ts  # Word validation logic
│   │   ├── managers/
│   │   │   ├── RoomManager.ts # Room management
│   │   │   └── GameManager.ts # Game logic & timer
│   │   └── utils/             # Utility functions
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/               # Next.js app router pages
│   │   │   ├── setup/         # Player profile setup
│   │   │   ├── lobby/         # Game lobby
│   │   │   ├── room/[roomId]/ # Room waiting page
│   │   │   ├── game/[roomId]/ # In-game page
│   │   │   ├── leaderboard/[roomId]/ # Post-game leaderboard
│   │   │   ├── page.tsx       # Main menu
│   │   │   ├── layout.tsx     # Root layout
│   │   │   ├── globals.css    # Global styles
│   │   │   └── providers.tsx  # Context providers
│   │   ├── components/        # Reusable components
│   │   ├── contexts/
│   │   │   └── SocketContext.tsx  # Socket.IO context
│   │   └── utils/
│   │       └── localStorage.ts    # Profile management
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   └── tailwind.config.js
├── shared/                     # Shared types
│   └── types.ts               # TypeScript interfaces
└── README.md                  # This file
```

## 🚀 Installation

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Step 1: Clone and Navigate
```bash
cd last-letter-game
```

### Step 2: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 3: Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

## ▶️ Running the Game

### Option 1: Run Both (Recommended for Development)

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
The backend will start on http://localhost:3001

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
The frontend will start on http://localhost:3000

### Option 2: Production Build

**Build Backend:**
```bash
cd backend
npm run build
npm start
```

**Build Frontend:**
```bash
cd frontend
npm run build
npm start
```

### Environment Variables

The project now uses separate env files for frontend and backend.

Backend `backend/.env`
```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

Frontend `frontend/.env.local`
```env
BACKEND_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_SERVER_URL=http://localhost:3001
```

Notes:
- `BACKEND_SERVER_URL` is used by Next.js server-side rewrites for `/api/*`
- `NEXT_PUBLIC_SOCKET_SERVER_URL` is exposed to the browser for the Socket.IO connection
- `CORS_ORIGIN` can be a comma-separated list if you need multiple allowed frontend origins

## 🎮 How to Play

### 1. Setup
- Open http://localhost:3000 in your browser
- Enter your name and age (required)
- Optionally upload a profile picture or generate an avatar
- Click "Save Profile"

### 2. Main Menu
- **Play** - Go to the lobby
- **Edit Profile** - Update your profile
- **How to Play** - View game rules
- **Exit** - Clear profile and close

### 3. Lobby
- **Room List** - See available rooms to join
- **Join** - Enter a 6-character room code
- **Create** - Create a new room with a custom name

### 4. Room
- View room code (share with friends!)
- Toggle ready status (non-admin players)
- Admin can:
  - Change settings (max players, time limit)
  - Kick players
  - Start the game when everyone is ready

### 5. In-Game
- Watch the timer bar
- When it's your turn, enter a word that starts with the required letter
- First player can enter any word
- Be quick! Time out = elimination

### 6. Leaderboard
- View final rankings
- See stats (words submitted, longest word)
- Go back to lobby or main menu

## ✅ Word Validation

The game uses a multi-layer word validation system:

### Layer 1: Local Cache (Fastest)
- Pre-loaded with 200+ common English words
- Caches all validated words in memory
- Instant validation for known words

### Layer 2: Free Dictionary API
- Uses [dictionaryapi.dev](https://dictionaryapi.dev/) (completely free)
- Makes HTTPS request to validate unknown words
- Response time: ~100-500ms

### Layer 3: Fallback Heuristic
- If API fails, uses pattern matching
- Checks for reasonable word structure
- Prevents game from breaking during API downtime

### Validation Rules
1. Word must be at least 2 letters
2. Word must contain only alphabetic characters
3. Word must start with the required letter (after first turn)
4. Word cannot be reused in the same match
5. Word must be a valid English word

### Cache Statistics
Visit `http://localhost:3001/api/stats` to see:
- Total validated words in cache
- Total invalid words in cache
- Active rooms and players

## 💾 Local Storage Profile

Player profiles are stored in the browser's localStorage:

### Data Stored
```typescript
interface PlayerProfile {
  id: string;           // Unique player ID (UUID)
  name: string;         // Player name (2-20 characters)
  age: number;          // Player age (5-120)
  profileImage?: string; // Base64 encoded image (optional)
}
```

### Storage Key
```
last_letter_player_profile
```

### Behavior
- Profile persists across browser sessions
- Automatically loaded on app start
- If no profile exists, redirects to setup page
- Can be updated via "Edit Profile" in main menu

### Clearing Profile
- Click "Exit" in main menu
- Or manually clear localStorage in browser dev tools

## 📡 API Documentation

### REST Endpoints

#### Health Check
```
GET /api/health
Response: { "status": "ok", "timestamp": "..." }
```

#### List Available Rooms
```
GET /api/rooms
Response: { 
  "success": true, 
  "data": { 
    "rooms": [...] 
  } 
}
```

#### Get Room by Code
```
GET /api/rooms/:code
Response: { 
  "success": true, 
  "data": { 
    "room": {...} 
  } 
}
```

#### Server Stats
```
GET /api/stats
Response: {
  "success": true,
  "data": {
    "rooms": { "totalRooms": 5, "totalPlayers": 12 },
    "words": { "validated": 150, "invalid": 30 },
    "activeGames": 3
  }
}
```

## 🔌 Socket Events

### Client → Server Events

| Event | Data | Description |
|-------|------|-------------|
| `create_room` | `{ roomName, player }` | Create a new room |
| `join_room` | `{ roomCode, player }` | Join existing room |
| `leave_room` | `{ roomId }` | Leave current room |
| `kick_player` | `{ roomId, playerId }` | Kick player (admin only) |
| `update_room_settings` | `{ roomId, settings }` | Update room settings |
| `ready_toggle` | `{ roomId }` | Toggle ready status |
| `start_game` | `{ roomId }` | Start game (admin only) |
| `submit_word` | `{ roomId, word }` | Submit a word |

### Server → Client Events

| Event | Data | Description |
|-------|------|-------------|
| `room_updated` | `Room` | Room state updated |
| `player_joined` | `Player` | New player joined |
| `player_left` | `playerId` | Player left room |
| `player_kicked` | `playerId` | Player was kicked |
| `player_ready_changed` | `{ playerId, isReady }` | Ready status changed |
| `admin_transferred` | `{ newAdminId, newAdminName }` | Admin changed |
| `game_started` | `GameState` | Game started |
| `game_ended` | `MatchResult` | Game ended |
| `turn_changed` | `{ currentPlayerId, currentPlayerName, requiredLetter }` | Next player's turn |
| `word_submitted` | `{ playerId, playerName, word, nextLetter }` | Word accepted |
| `word_rejected` | `{ reason }` | Word rejected |
| `player_eliminated` | `{ playerId, playerName, reason }` | Player eliminated |
| `timer_update` | `timeRemaining` | Timer tick |
| `timer_expired` | `{ playerId, playerName }` | Turn timed out |
| `error` | `{ message }` | Error occurred |

## 🔮 Future Improvements

### High Priority
- [ ] **Persistent Storage** - Add MongoDB/PostgreSQL for room/player persistence
- [ ] **Reconnection Logic** - Allow players to reconnect to ongoing games
- [ ] **Spectator Mode** - Let eliminated players watch the game
- [ ] **Chat System** - In-room chat for players

### Medium Priority
- [ ] **Custom Word Lists** - Allow themed word categories
- [ ] **Difficulty Levels** - Minimum word length requirements
- [ ] **Power-ups** - Extra time, skip turn, etc.
- [ ] **Achievements** - Unlock badges for milestones

### Low Priority
- [ ] **Tournament Mode** - Multi-round bracket system
- [ ] **AI Opponents** - Play against computer players
- [ ] **Voice Chat** - Integrated voice communication
- [ ] **Mobile App** - React Native/Flutter version

### Technical Improvements
- [ ] **Rate Limiting** - Prevent spam and abuse
- [ ] **Input Validation** - Stricter validation on both ends
- [ ] **Logging** - Structured logging with Winston
- [ ] **Testing** - Unit and integration tests
- [ ] **Docker** - Containerize for easy deployment
- [ ] **CI/CD** - GitHub Actions for automated deployment

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Bug Reports

If you find a bug, please open an issue with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser and OS information

## 🙏 Acknowledgments

- [Free Dictionary API](https://dictionaryapi.dev/) for word validation
- [Socket.IO](https://socket.io/) for real-time communication
- [Next.js](https://nextjs.org/) for the frontend framework
- [Tailwind CSS](https://tailwindcss.com/) for styling

---

**Enjoy playing Last Letter! 🎮✨**
