/**
 * Last Letter Game - Backend Server
 * 
 * Express + Socket.IO server handling:
 * - REST API for room listing
 * - Socket.IO events for real-time gameplay
 * - Room management
 * - Game logic
 * - Word validation
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { env } from './config/env';
import { roomManager } from './managers/RoomManager';
import { gameManager } from './managers/GameManager';
import { wordValidationService } from './services/WordValidationService';
import type { 
  AuthProvider,
  MatchReactionPayload,
  QuickMessagePayload,
  RematchStatusPayload,
  ClientToServerEvents, 
  ServerToClientEvents,
  PlayerProfile,
  AuthResponse,
  LinkOAuthRequest,
  OAuthAuthRequest,
  UpdatePasswordRequest,
  UpdateProfileRequest,
  Rank
} from '../../shared/types';

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const allowedOrigins = env.corsOrigins;
const allowAllOrigins = allowedOrigins.includes('*');
const corsOriginOption = allowAllOrigins ? true : allowedOrigins;

// Middleware
app.use(cors({
  origin: corsOriginOption,
}));
app.use(express.json());

// ==================== USER AUTHENTICATION STORE ====================

// Simple in-memory user store (in production, use a database)
type StoredUser = {
  passwordHash?: string;
  profile: PlayerProfile;
  oauthLinks: Array<{
    provider: OAuthAuthRequest['provider'];
    providerUserId: string;
    email?: string;
  }>;
};

const userStore: Map<string, StoredUser> = new Map();

function sanitizeUserId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'player';
}

function createProfile(params: {
  userId: string;
  name: string;
  age: number;
  profileImage?: string;
  authProviders: AuthProvider[];
}): PlayerProfile {
  const now = Date.now();

  return {
    id: uuidv4(),
    userId: params.userId,
    name: params.name.trim(),
    age: params.age,
    profileImage: params.profileImage,
    authProviders: params.authProviders,
    rank: 'Plastic' as Rank,
    rankPoints: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesDrawn: 0,
    winStreak: 0,
    bestWinStreak: 0,
    protectedRank: null,
    rankProtectionMatches: 0,
    createdAt: now,
    lastLoginAt: now,
  };
}

function buildOAuthStoreKey(provider: OAuthAuthRequest['provider'], providerUserId: string): string {
  return `oauth:${provider}:${providerUserId}`;
}

function addAuthProvider(profile: PlayerProfile, provider: AuthProvider) {
  if (!profile.authProviders.includes(provider)) {
    profile.authProviders.push(provider);
  }
}

function isUserIdTaken(userId: string): boolean {
  for (const user of userStore.values()) {
    if (user.profile.userId === userId) {
      return true;
    }
  }

  return false;
}

function generateUniqueUserId(baseValue: string): string {
  const baseUserId = sanitizeUserId(baseValue).slice(0, 20);
  let candidate = baseUserId;
  let suffix = 1;

  while (isUserIdTaken(candidate)) {
    const suffixText = `${suffix}`;
    const trimmedBase = baseUserId.slice(0, Math.max(3, 20 - suffixText.length));
    candidate = `${trimmedBase}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}

function getUserByUserId(userId: string): StoredUser | undefined {
  return userStore.get(userId.toLowerCase());
}

function validateProfileFields(name: string, age: number): string | null {
  if (name.trim().length < 2 || name.trim().length > 20) {
    return 'Name must be between 2 and 20 characters';
  }

  if (age < 5 || age > 120) {
    return 'Age must be between 5 and 120';
  }

  return null;
}

function linkOAuthProvider(
  userData: StoredUser,
  provider: OAuthAuthRequest['provider'],
  providerUserId: string,
  email?: string
) {
  const storeKey = buildOAuthStoreKey(provider, providerUserId);
  const linkedUser = userStore.get(storeKey);

  if (linkedUser && linkedUser !== userData) {
    throw new Error(`This ${provider} account is already linked to another player.`);
  }

  if (!userData.oauthLinks.some((link) => link.provider === provider && link.providerUserId === providerUserId)) {
    userData.oauthLinks.push({ provider, providerUserId, email });
  }

  addAuthProvider(userData.profile, provider);
  userStore.set(storeKey, userData);
}

// ==================== AUTHENTICATION API ROUTES ====================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { userId, password, name, age, profileImage } = req.body;

    // Validate input
    if (!userId || !password || !name || !age) {
      return res.status(400).json({
        success: false,
        error: 'userId, password, name, and age are required'
      } as AuthResponse);
    }

    if (userId.length < 3 || userId.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'userId must be between 3 and 20 characters'
      } as AuthResponse);
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      } as AuthResponse);
    }

    if (name.length < 2 || name.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Name must be between 2 and 20 characters'
      } as AuthResponse);
    }

    if (age < 5 || age > 120) {
      return res.status(400).json({
        success: false,
        error: 'Age must be between 5 and 120'
      } as AuthResponse);
    }

    // Check if user already exists
    if (userStore.has(userId.toLowerCase())) {
      return res.status(409).json({
        success: false,
        error: 'User ID already exists'
      } as AuthResponse);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create player profile
    const profile = createProfile({
      userId: userId.toLowerCase(),
      name: name.trim(),
      age: parseInt(age),
      profileImage,
      authProviders: ['password'],
    });

    // Store user
    userStore.set(userId.toLowerCase(), { passwordHash, profile, oauthLinks: [] });

    console.log(`[AUTH] User registered: ${userId}`);

    res.json({
      success: true,
      player: profile
    } as AuthResponse);

  } catch (error) {
    console.error('[AUTH] Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    } as AuthResponse);
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        error: 'userId and password are required'
      } as AuthResponse);
    }

    const userData = userStore.get(userId.toLowerCase());
    if (!userData || !userData.passwordHash) {
      return res.status(401).json({
        success: false,
        error: 'Invalid user ID or password'
      } as AuthResponse);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userData.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid user ID or password'
      } as AuthResponse);
    }

    // Update last login
    userData.profile.lastLoginAt = Date.now();

    console.log(`[AUTH] User logged in: ${userId}`);

    res.json({
      success: true,
      player: userData.profile
    } as AuthResponse);

  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    } as AuthResponse);
  }
});

// Login or register user with OAuth provider
app.post('/api/auth/oauth', async (req, res) => {
  try {
    const { provider, providerUserId, email, name, age, profileImage } = req.body as OAuthAuthRequest;

    if (!provider || !providerUserId) {
      return res.status(400).json({
        success: false,
        error: 'provider and providerUserId are required'
      } as AuthResponse);
    }

    if (provider !== 'google' && provider !== 'facebook') {
      return res.status(400).json({
        success: false,
        error: 'Unsupported OAuth provider'
      } as AuthResponse);
    }

    const storeKey = buildOAuthStoreKey(provider, providerUserId);
    const existingUser = userStore.get(storeKey);

    if (existingUser) {
      existingUser.profile.lastLoginAt = Date.now();
      addAuthProvider(existingUser.profile, provider);

      if (name?.trim()) {
        existingUser.profile.name = name.trim();
      }

      if (profileImage) {
        existingUser.profile.profileImage = profileImage;
      }

      console.log(`[AUTH] OAuth user logged in: ${provider}:${providerUserId}`);

      return res.json({
        success: true,
        player: existingUser.profile
      } as AuthResponse);
    }

    if (!name?.trim() || !age) {
      return res.status(404).json({
        success: false,
        error: 'OAuth profile not found. Complete sign up to create your account.'
      } as AuthResponse);
    }

    if (name.trim().length < 2 || name.trim().length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Name must be between 2 and 20 characters'
      } as AuthResponse);
    }

    if (age < 5 || age > 120) {
      return res.status(400).json({
        success: false,
        error: 'Age must be between 5 and 120'
      } as AuthResponse);
    }

    const userIdSeed = email?.split('@')[0] || name || `${provider}_player`;
    const generatedUserId = generateUniqueUserId(userIdSeed);
    const profile = createProfile({
      userId: generatedUserId,
      name: name.trim(),
      age,
      profileImage,
      authProviders: [provider],
    });
    const userData: StoredUser = {
      profile,
      oauthLinks: [],
    };

    userStore.set(generatedUserId, userData);
    linkOAuthProvider(userData, provider, providerUserId, email);

    console.log(`[AUTH] OAuth user registered: ${provider}:${providerUserId}`);

    res.json({
      success: true,
      player: profile
    } as AuthResponse);
  } catch (error) {
    console.error('[AUTH] OAuth error:', error);
    res.status(500).json({
      success: false,
      error: 'OAuth authentication failed'
    } as AuthResponse);
  }
});

app.patch('/api/account/profile', (req, res) => {
  try {
    const { userId, name, age, profileImage } = req.body as UpdateProfileRequest;

    if (!userId || !name || age === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId, name, and age are required'
      } as AuthResponse);
    }

    const userData = getUserByUserId(userId);
    if (!userData) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      } as AuthResponse);
    }

    const validationError = validateProfileFields(name, age);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      } as AuthResponse);
    }

    userData.profile.name = name.trim();
    userData.profile.age = age;
    userData.profile.profileImage = profileImage;
    userData.profile.lastLoginAt = Date.now();

    res.json({
      success: true,
      player: userData.profile
    } as AuthResponse);
  } catch (error) {
    console.error('[ACCOUNT] Profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    } as AuthResponse);
  }
});

app.patch('/api/account/password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body as UpdatePasswordRequest;

    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'userId and newPassword are required'
      } as AuthResponse);
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      } as AuthResponse);
    }

    const userData = getUserByUserId(userId);
    if (!userData) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      } as AuthResponse);
    }

    if (userData.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password is required'
        } as AuthResponse);
      }

      const isValidPassword = await bcrypt.compare(currentPassword, userData.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect'
        } as AuthResponse);
      }
    }

    userData.passwordHash = await bcrypt.hash(newPassword, 10);
    addAuthProvider(userData.profile, 'password');
    userData.profile.lastLoginAt = Date.now();

    res.json({
      success: true,
      player: userData.profile
    } as AuthResponse);
  } catch (error) {
    console.error('[ACCOUNT] Password update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update password'
    } as AuthResponse);
  }
});

app.post('/api/account/link-oauth', (req, res) => {
  try {
    const { userId, provider, providerUserId, email } = req.body as LinkOAuthRequest;

    if (!userId || !provider || !providerUserId) {
      return res.status(400).json({
        success: false,
        error: 'userId, provider, and providerUserId are required'
      } as AuthResponse);
    }

    const userData = getUserByUserId(userId);
    if (!userData) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      } as AuthResponse);
    }

    linkOAuthProvider(userData, provider, providerUserId, email);
    userData.profile.lastLoginAt = Date.now();

    res.json({
      success: true,
      player: userData.profile
    } as AuthResponse);
  } catch (error) {
    console.error('[ACCOUNT] Link OAuth error:', error);
    res.status(409).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to link OAuth provider'
    } as AuthResponse);
  }
});

// ==================== REST API ROUTES ====================

// Get available rooms (for lobby)
app.get('/api/rooms', (req, res) => {
  try {
    const rooms = roomManager.getAvailableRooms();
    res.json({ success: true, data: { rooms } });
  } catch (error) {
    console.error('[API] Error getting rooms:', error);
    res.status(500).json({ success: false, error: 'Failed to get rooms' });
  }
});

// Get room by code
app.get('/api/rooms/:code', (req, res) => {
  try {
    const room = roomManager.getRoomByCode(req.params.code);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    res.json({ success: true, data: { room } });
  } catch (error) {
    console.error('[API] Error getting room:', error);
    res.status(500).json({ success: false, error: 'Failed to get room' });
  }
});

// Get server stats
app.get('/api/stats', (req, res) => {
  try {
    const roomStats = roomManager.getStats();
    const wordStats = wordValidationService.getCacheStats();
    res.json({
      success: true,
      data: {
        rooms: roomStats,
        words: wordStats,
        activeGames: gameManager.getActiveGamesCount()
      }
    });
  } catch (error) {
    console.error('[API] Error getting stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== SOCKET.IO SETUP ====================

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: corsOriginOption,
    methods: ['GET', 'POST']
  },
  pingTimeout: 10000,
  pingInterval: 5000
});

const rematchVotes = new Map<string, Set<string>>();

// Socket connection handler
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  const aiTurnTimeouts = new Map<string, NodeJS.Timeout>();

  function emitAbilityStates(roomId: string) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    for (const player of room.players) {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.emit('ability_state', gameManager.getAbilityState(roomId, player.id));
      }
    }
  }

  function emitTurnChanged(roomId: string) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const currentPlayer = gameManager.getCurrentPlayer(room);
    if (currentPlayer) {
      const gameState = gameManager.getGameState(room);
      io.to(roomId).emit('turn_changed', {
        currentPlayerId: currentPlayer.id,
        currentPlayerName: currentPlayer.name,
        requiredLetter: room.requiredLetter,
        chainDirection: gameState.chainDirection,
      });
    }

    emitAbilityStates(roomId);
  }

  function emitRematchStatus(roomId: string, requester?: { id: string; name: string }) {
    const acceptedPlayerIds = [...(rematchVotes.get(roomId) ?? new Set<string>())];
    const payload: RematchStatusPayload = {
      roomId,
      acceptedPlayerIds,
      requestedByPlayerId: requester?.id,
      requestedByPlayerName: requester?.name,
    };
    io.to(roomId).emit('rematch_status', payload);
  }

  function clearAiTurn(roomId: string) {
    const timeout = aiTurnTimeouts.get(roomId);
    if (timeout) {
      clearTimeout(timeout);
      aiTurnTimeouts.delete(roomId);
    }
  }

  function buildTimerCallback(roomId: string) {
    return {
      onTick: (timeRemaining: number) => {
        io.to(roomId).emit('timer_update', timeRemaining);
      },
      onExpire: () => {
        clearAiTurn(roomId);
        handleTurnTimeout(roomId);
      }
    };
  }

  function handleSuccessfulWordSubmission(roomId: string, playerId: string, playerName: string, word: string) {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      return;
    }

    io.to(roomId).emit('word_submitted', {
      playerId,
      playerName,
      word: word.toLowerCase().trim(),
      nextLetter: room.requiredLetter || ''
    });

    emitTurnChanged(roomId);
    gameManager.startTimer(roomId, room.settings.timeLimit, buildTimerCallback(roomId));
    void scheduleAiTurnIfNeeded(roomId);
  }

  async function scheduleAiTurnIfNeeded(roomId: string) {
    clearAiTurn(roomId);

    const room = roomManager.getRoom(roomId);
    if (!room || room.status !== 'playing') {
      return;
    }

    const plan = gameManager.getAiTurnPlan(roomId);
    if (!plan) {
      return;
    }

    const timeout = setTimeout(async () => {
      aiTurnTimeouts.delete(roomId);

      const liveRoom = roomManager.getRoom(roomId);
      if (!liveRoom || liveRoom.status !== 'playing') {
        return;
      }

      const currentPlayer = gameManager.getCurrentPlayer(liveRoom);
      if (!currentPlayer || currentPlayer.id !== plan.player.id || !currentPlayer.isBot) {
        return;
      }

      const attemptedWord = plan.shouldMistake
        ? `${(liveRoom.requiredLetter || 'z').toLowerCase()}zzz`
        : plan.word;

      if (!attemptedWord) {
        handleTurnTimeout(roomId);
        return;
      }

      const result = await gameManager.submitWord(roomId, plan.player.id, attemptedWord);
      if (result.success) {
        handleSuccessfulWordSubmission(roomId, plan.player.id, plan.player.name, attemptedWord);
        return;
      }

      const updatedRoom = roomManager.getRoom(roomId);
      const stillAiTurn = updatedRoom && updatedRoom.status === 'playing' && gameManager.getCurrentPlayer(updatedRoom)?.id === plan.player.id;
      if (stillAiTurn && gameManager.getRemainingTime(roomId) > 1) {
        void scheduleAiTurnIfNeeded(roomId);
      }
    }, plan.delayMs);

    aiTurnTimeouts.set(roomId, timeout);
  }

  // ==================== ROOM MANAGEMENT EVENTS ====================

  // Create a new room
  socket.on('create_room', (data, callback) => {
    try {
      const { room, player } = data;
      
      // Validate input
      if (!room?.roomName?.trim()) {
        return callback({ success: false, error: 'Room name is required' });
      }
      if (!player?.id || !player?.name) {
        return callback({ success: false, error: 'Player information is required' });
      }

      // Create room
      const createdRoom = roomManager.createRoom(room, player, socket.id);
      
      // Join socket to room
      socket.join(createdRoom.id);
      
      console.log(`[Socket] ${player.name} created room ${createdRoom.roomCode}`);
      
      callback({ success: true, room: createdRoom });
    } catch (error) {
      console.error('[Socket] Error creating room:', error);
      callback({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create room' 
      });
    }
  });

  // Join an existing room
  socket.on('join_room', (data, callback) => {
    try {
      const { join, player } = data;
      
      // Validate input
      if (!join?.roomCode?.trim()) {
        return callback({ success: false, error: 'Room code is required' });
      }
      if (!player?.id || !player?.name) {
        return callback({ success: false, error: 'Player information is required' });
      }

      // Join room
      const room = roomManager.joinRoom(join, player, socket.id);
      
      if (!room) {
        return callback({ success: false, error: 'Room not found' });
      }

      // Join socket to room
      socket.join(room.id);
      
      // Notify other players
      const joinedPlayer = room.players.find(p => p.id === player.id);
      if (joinedPlayer) {
        socket.to(room.id).emit('player_joined', joinedPlayer);
      }

      // Broadcast the full room after joins/rejoins so every client gets the same player list.
      io.to(room.id).emit('room_updated', room);
      
      console.log(`[Socket] ${player.name} joined room ${join.roomCode}`);
      
      callback({ success: true, room });
    } catch (error) {
      console.error('[Socket] Error joining room:', error);
      callback({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to join room' 
      });
    }
  });

  // Leave a room
  socket.on('leave_room', (data, callback) => {
    try {
      const { roomId } = data;
      const existingPlayer = roomManager.getRoom(roomId)?.players.find(p => p.socketId === socket.id);
      
      const { room, newAdminId } = roomManager.leaveRoom(roomId, existingPlayer?.id || socket.id);
      
      if (room) {
        socket.leave(roomId);
        if (existingPlayer) {
          socket.to(roomId).emit('player_left', existingPlayer.id);
        }
        
        // Notify about admin transfer if applicable
        if (newAdminId) {
          const newAdmin = room.players.find(p => p.id === newAdminId);
          if (newAdmin) {
            io.to(roomId).emit('admin_transferred', {
              newAdminId,
              newAdminName: newAdmin.name
            });
          }
        }
        
        // Broadcast updated room
        io.to(roomId).emit('room_updated', room);
      }
      
      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('[Socket] Error leaving room:', error);
      if (callback) {
        callback({ success: false });
      }
    }
  });

  // Kick a player (admin only)
  socket.on('kick_player', (data, callback) => {
    try {
      const { roomId, playerId } = data;
      
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      const admin = room.players.find(p => p.socketId === socket.id);
      if (!admin) {
        return callback?.({ success: false, error: 'You are not in this room' });
      }

      const kickedPlayer = room.players.find(p => p.id === playerId);
      if (!kickedPlayer) {
        return callback?.({ success: false, error: 'Player not found in room' });
      }

      roomManager.kickPlayer(roomId, admin.id, playerId);
      
      // Notify kicked player and remove their socket from the Socket.IO room.
      io.to(kickedPlayer.socketId).emit('player_kicked', playerId);
      const kickedSocket = io.sockets.sockets.get(kickedPlayer.socketId);
      if (kickedSocket) {
        kickedSocket.leave(roomId);
      }
      
      // Broadcast updated room
      io.to(roomId).emit('player_left', playerId);
      io.to(roomId).emit('room_updated', room);
      
      console.log(`[Socket] Admin ${admin.name} kicked player from room ${room.roomCode}`);
      
      callback?.({ success: true });
    } catch (error) {
      console.error('[Socket] Error kicking player:', error);
      callback?.({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to kick player' 
      });
    }
  });

  // Update room settings (admin only)
  socket.on('update_room_settings', (data, callback) => {
    try {
      const { roomId, settings } = data;
      
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      const admin = room.players.find(p => p.socketId === socket.id);
      if (!admin) {
        return callback?.({ success: false, error: 'You are not in this room' });
      }

      const updatedRoom = roomManager.updateSettings(roomId, admin.id, settings);
      
      // Broadcast updated room
      io.to(roomId).emit('room_updated', updatedRoom);
      
      console.log(`[Socket] Settings updated for room ${room.roomCode}`);
      
      callback?.({ success: true });
    } catch (error) {
      console.error('[Socket] Error updating settings:', error);
      callback?.({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update settings' 
      });
    }
  });

  socket.on('update_room_access', (data, callback) => {
    try {
      const { roomId, access } = data;

      const room = roomManager.getRoom(roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      const admin = room.players.find(p => p.socketId === socket.id);
      if (!admin) {
        return callback?.({ success: false, error: 'You are not in this room' });
      }

      const updatedRoom = roomManager.updateAccess(roomId, admin.id, access);
      io.to(roomId).emit('room_updated', updatedRoom);

      callback?.({ success: true });
    } catch (error) {
      console.error('[Socket] Error updating room access:', error);
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update room access'
      });
    }
  });

  // Toggle ready status
  socket.on('ready_toggle', (data, callback) => {
    try {
      const { roomId } = data;
      
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return callback?.({ success: false, isReady: false });
      }

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) {
        return callback?.({ success: false, isReady: false });
      }

      const isReady = roomManager.toggleReady(roomId, player.id);
      
      // Broadcast ready change
      io.to(roomId).emit('player_ready_changed', { playerId: player.id, isReady });
      io.to(roomId).emit('room_updated', room);
      
      callback?.({ success: true, isReady });
    } catch (error) {
      console.error('[Socket] Error toggling ready:', error);
      callback?.({ success: false, isReady: false });
    }
  });

  // ==================== GAME CONTROL EVENTS ====================

  // Start game (admin only)
  socket.on('start_game', async (data, callback) => {
    try {
      const { roomId } = data;
      
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      const admin = room.players.find(p => p.socketId === socket.id);
      if (!admin) {
        return callback?.({ success: false, error: 'You are not in this room' });
      }

      // Start the game
      const gameState = await gameManager.startGame(roomId, admin.id);
      
      // Update room status
      roomManager.setRoomStatus(roomId, 'playing');
      io.to(roomId).emit('room_updated', room);
      
      // Broadcast game start
      io.to(roomId).emit('game_started', gameState);
      emitAbilityStates(roomId);

      gameManager.startTimer(roomId, room.settings.timeLimit, buildTimerCallback(roomId));
      void scheduleAiTurnIfNeeded(roomId);
      
      console.log(`[Socket] Game started in room ${room.roomCode}`);
      
      callback?.({ success: true });
    } catch (error) {
      console.error('[Socket] Error starting game:', error);
      callback?.({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start game' 
      });
    }
  });

  // Submit word
  socket.on('submit_word', async (data, callback) => {
    try {
      const { roomId, word } = data;
      
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) {
        return callback?.({ success: false, error: 'You are not in this room' });
      }

      const result = await gameManager.submitWord(roomId, player.id, word);
      
      if (result.success && result.gameState) {
        handleSuccessfulWordSubmission(roomId, player.id, player.name, word);
        console.log(`[Socket] Word submitted in room ${room.roomCode}: ${word}`);
      } else {
        // Word was rejected
        socket.emit('word_rejected', { reason: result.error || 'Invalid word' });
      }
      
      callback?.(result);
    } catch (error) {
      console.error('[Socket] Error submitting word:', error);
      callback?.({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to submit word' 
      });
    }
  });

  socket.on('use_ability', (data, callback) => {
    try {
      const room = roomManager.getRoom(data.roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      const player = room.players.find((candidate) => candidate.socketId === socket.id);
      if (!player) {
        return callback?.({ success: false, error: 'You are not in this room' });
      }

      const result = gameManager.useAbility(data.roomId, player.id, data.ability, data.targetPlayerId);
      if (!result.success) {
        return callback?.({ success: false, error: result.error });
      }

      if (result.effect) {
        io.to(data.roomId).emit('ability_effect', result.effect);
      }

      emitTurnChanged(data.roomId);
      void scheduleAiTurnIfNeeded(data.roomId);

      if (result.gameState) {
        io.to(data.roomId).emit('room_updated', room);
      }

      callback?.({ success: true, hints: result.hints });
    } catch (error) {
      console.error('[Socket] Error using ability:', error);
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to use ability',
      });
    }
  });

  socket.on('send_reaction', (data, callback) => {
    try {
      const room = roomManager.getRoom(data.roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      const player = room.players.find((candidate) => candidate.socketId === socket.id);
      if (!player) {
        return callback?.({ success: false, error: 'You are not in this room' });
      }

      if (room.status !== 'playing') {
        return callback?.({ success: false, error: 'Reactions are only available during a match' });
      }

      const emoji = data.emoji.trim().slice(0, 2);
      if (!emoji) {
        return callback?.({ success: false, error: 'Choose a reaction first' });
      }

      const payload: MatchReactionPayload = {
        roomId: room.id,
        playerId: player.id,
        playerName: player.name,
        emoji,
        createdAt: Date.now(),
      };

      io.to(room.id).emit('reaction_received', payload);
      callback?.({ success: true });
    } catch (error) {
      console.error('[Socket] Error sending reaction:', error);
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send reaction',
      });
    }
  });

  socket.on('send_quick_message', (data, callback) => {
    try {
      const room = roomManager.getRoom(data.roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      const player = room.players.find((candidate) => candidate.socketId === socket.id);
      if (!player) {
        return callback?.({ success: false, error: 'You are not in this room' });
      }

      if (room.status !== 'playing') {
        return callback?.({ success: false, error: 'Quick messages are only available during a match' });
      }

      const message = data.message.trim().slice(0, 60);
      if (!message) {
        return callback?.({ success: false, error: 'Choose a message first' });
      }

      const payload: QuickMessagePayload = {
        roomId: room.id,
        playerId: player.id,
        playerName: player.name,
        message,
        createdAt: Date.now(),
      };

      io.to(room.id).emit('quick_message_received', payload);
      callback?.({ success: true });
    } catch (error) {
      console.error('[Socket] Error sending quick message:', error);
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send quick message',
      });
    }
  });

  socket.on('request_rematch', (data, callback) => {
    try {
      const room = roomManager.getRoom(data.roomId);
      if (!room) {
        return callback?.({ success: false, error: 'Room not found' });
      }

      const player = room.players.find((candidate) => candidate.socketId === socket.id);
      if (!player) {
        return callback?.({ success: false, error: 'You are not in this room' });
      }

      if (room.status !== 'ended') {
        return callback?.({ success: false, error: 'Rematch is only available after a match ends' });
      }

      let acceptedPlayers = rematchVotes.get(room.id);
      if (!acceptedPlayers) {
        acceptedPlayers = new Set<string>();
        rematchVotes.set(room.id, acceptedPlayers);
      }
      acceptedPlayers.add(player.id);
      emitRematchStatus(room.id, { id: player.id, name: player.name });

      const connectedPlayers = room.players.filter((candidate) => candidate.isConnected);
      const everyoneAccepted = connectedPlayers.length > 0 && connectedPlayers.every((candidate) => acceptedPlayers.has(candidate.id));

      if (!everyoneAccepted) {
        return callback?.({ success: true, room });
      }

      gameManager.cleanupRoom(room.id);
      clearAiTurn(room.id);
      const resetRoom = roomManager.resetRoomForNextGame(room.id);
      if (!resetRoom) {
        return callback?.({ success: false, error: 'Failed to reset room for rematch' });
      }
      rematchVotes.delete(room.id);

      io.to(room.id).emit('room_updated', resetRoom);
      io.to(room.id).emit('rematch_started', {
        room: resetRoom,
        requestedByPlayerId: player.id,
        requestedByPlayerName: player.name,
      });

      callback?.({ success: true, room: resetRoom });
    } catch (error) {
      console.error('[Socket] Error starting rematch:', error);
      callback?.({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start rematch',
      });
    }
  });

  // ==================== DISCONNECT HANDLER ====================

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Client disconnected: ${socket.id}, reason: ${reason}`);
    
    // Find player's room
    const { player, room } = roomManager.getPlayerBySocketId(socket.id);
    
    if (room && player) {
      rematchVotes.get(room.id)?.delete(player.id);
      if (room.status === 'ended') {
        emitRematchStatus(room.id);
      }
      // Handle based on game status
      if (room.status === 'playing') {
        // Handle player disconnect during game
        const result = gameManager.handlePlayerDisconnect(room.id, player.id);
        
        if (result.gameEnded && room.leaderboard) {
          // Game ended due to disconnect
          rematchVotes.delete(room.id);
          io.to(room.id).emit('game_ended', room.leaderboard);
          io.to(room.id).emit('room_updated', room);
          emitRematchStatus(room.id);
          gameManager.cleanupRoom(room.id);
          clearAiTurn(room.id);
        } else {
          // Broadcast player elimination and turn change
          io.to(room.id).emit('player_eliminated', {
            playerId: player.id,
            playerName: player.name,
            reason: 'Disconnected'
          });
          
          emitTurnChanged(room.id);
          void scheduleAiTurnIfNeeded(room.id);
          
          io.to(room.id).emit('room_updated', room);
        }
      } else {
        // Handle disconnect in waiting room
        const { room: updatedRoom, newAdminId } = roomManager.markPlayerDisconnected(room.id, socket.id);
        
        if (updatedRoom) {
          socket.to(room.id).emit('player_left', player.id);
          
          if (newAdminId) {
            const newAdmin = updatedRoom.players.find(p => p.id === newAdminId);
            if (newAdmin) {
              io.to(room.id).emit('admin_transferred', {
                newAdminId,
                newAdminName: newAdmin.name
              });
            }
          }
          
          io.to(room.id).emit('room_updated', updatedRoom);
        }
      }
    }
  });

  // Helper function to handle turn timeout
  function handleTurnTimeout(roomId: string) {
    const room = roomManager.getRoom(roomId);
    if (!room || room.status !== 'playing') return;

    const result = gameManager.handleTimeout(roomId);
    
    if (result.eliminatedPlayer) {
      io.to(roomId).emit('player_eliminated', {
        playerId: result.eliminatedPlayer.id,
        playerName: result.eliminatedPlayer.name,
        reason: 'Time expired'
      });
      
      io.to(roomId).emit('timer_expired', {
        playerId: result.eliminatedPlayer.id,
        playerName: result.eliminatedPlayer.name
      });
    }
    
    if (result.gameEnded && room.leaderboard) {
      rematchVotes.delete(roomId);
      io.to(roomId).emit('game_ended', room.leaderboard);
      io.to(roomId).emit('room_updated', room);
      emitRematchStatus(roomId);
      gameManager.cleanupRoom(roomId);
      clearAiTurn(roomId);
    } else {
      // Continue game with next player
      emitTurnChanged(roomId);

      gameManager.startTimer(roomId, room.settings.timeLimit, buildTimerCallback(roomId));
      void scheduleAiTurnIfNeeded(roomId);
    }
    
    io.to(roomId).emit('room_updated', room);
  }
});

// ==================== SERVER START ====================

const PORT = env.port;

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           🎮 LAST LETTER GAME SERVER 🎮                    ║
║                                                            ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port: ${PORT}                            ║
║  Environment: ${env.nodeEnv}                    ║
║  Allowed Origins: ${allowAllOrigins ? '*' : allowedOrigins.join(', ')}                    ║
║                                                            ║
║  REST API Endpoints:                                       ║
║    - GET /api/health     - Health check                    ║
║    - GET /api/rooms      - List available rooms            ║
║    - GET /api/rooms/:code - Get room by code               ║
║    - GET /api/stats      - Server statistics               ║
║                                                            ║
║  Socket.IO Events:                                         ║
║    - Room Management: create_room, join_room, leave_room   ║
║    - Game Control: start_game, submit_word                 ║
║    - Player Actions: ready_toggle, kick_player             ║
║    - Settings: update_room_settings                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});
