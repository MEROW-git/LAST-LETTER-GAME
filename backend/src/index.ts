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
  ClientToServerEvents, 
  ServerToClientEvents,
  PlayerProfile,
  UserCredentials,
  AuthResponse,
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
const userStore: Map<string, { passwordHash: string; profile: PlayerProfile }> = new Map();

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
    const now = Date.now();
    const profile: PlayerProfile = {
      id: uuidv4(),
      userId: userId.toLowerCase(),
      name: name.trim(),
      age: parseInt(age),
      profileImage,
      rank: 'Plastic' as Rank,
      rankPoints: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      createdAt: now,
      lastLoginAt: now,
    };

    // Store user
    userStore.set(userId.toLowerCase(), { passwordHash, profile });

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
    if (!userData) {
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

// Socket connection handler
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // ==================== ROOM MANAGEMENT EVENTS ====================

  // Create a new room
  socket.on('create_room', (data, callback) => {
    try {
      const { roomName, player } = data;
      
      // Validate input
      if (!roomName?.trim()) {
        return callback({ success: false, error: 'Room name is required' });
      }
      if (!player?.id || !player?.name) {
        return callback({ success: false, error: 'Player information is required' });
      }

      // Create room
      const room = roomManager.createRoom(roomName, player, socket.id);
      
      // Join socket to room
      socket.join(room.id);
      
      console.log(`[Socket] ${player.name} created room ${room.roomCode}`);
      
      callback({ success: true, room });
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
      const { roomCode, player } = data;
      
      // Validate input
      if (!roomCode?.trim()) {
        return callback({ success: false, error: 'Room code is required' });
      }
      if (!player?.id || !player?.name) {
        return callback({ success: false, error: 'Player information is required' });
      }

      // Join room
      const room = roomManager.joinRoom(roomCode, player, socket.id);
      
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
      
      console.log(`[Socket] ${player.name} joined room ${roomCode}`);
      
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
      
      // Set up timer callbacks
      const timerCallback = {
        onTick: (timeRemaining: number) => {
          io.to(roomId).emit('timer_update', timeRemaining);
        },
        onExpire: () => {
          handleTurnTimeout(roomId);
        }
      };
      
      // Restart timer with callbacks
      gameManager.startTimer(roomId, room.settings.timeLimit, timerCallback);
      
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
        // Broadcast word submission
        io.to(roomId).emit('word_submitted', {
          playerId: player.id,
          playerName: player.name,
          word: word.toLowerCase().trim(),
          nextLetter: room.requiredLetter || ''
        });
        
        // Broadcast turn change
        const currentPlayer = gameManager.getCurrentPlayer(room);
        if (currentPlayer) {
          io.to(roomId).emit('turn_changed', {
            currentPlayerId: currentPlayer.id,
            currentPlayerName: currentPlayer.name,
            requiredLetter: room.requiredLetter
          });
        }
        
        // Reset timer
        const timerCallback = {
          onTick: (timeRemaining: number) => {
            io.to(roomId).emit('timer_update', timeRemaining);
          },
          onExpire: () => {
            handleTurnTimeout(roomId);
          }
        };
        gameManager.startTimer(roomId, room.settings.timeLimit, timerCallback);
        
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

  // ==================== DISCONNECT HANDLER ====================

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Client disconnected: ${socket.id}, reason: ${reason}`);
    
    // Find player's room
    const { player, room } = roomManager.getPlayerBySocketId(socket.id);
    
    if (room && player) {
      // Handle based on game status
      if (room.status === 'playing') {
        // Handle player disconnect during game
        const result = gameManager.handlePlayerDisconnect(room.id, player.id);
        
        if (result.gameEnded && room.leaderboard) {
          // Game ended due to disconnect
          io.to(room.id).emit('game_ended', room.leaderboard);
          gameManager.cleanupRoom(room.id);
          const resetRoom = roomManager.resetRoomForNextGame(room.id);
          if (resetRoom) {
            io.to(room.id).emit('room_updated', resetRoom);
          }
        } else {
          // Broadcast player elimination and turn change
          io.to(room.id).emit('player_eliminated', {
            playerId: player.id,
            playerName: player.name,
            reason: 'Disconnected'
          });
          
          const currentPlayer = gameManager.getCurrentPlayer(room);
          if (currentPlayer) {
            io.to(room.id).emit('turn_changed', {
              currentPlayerId: currentPlayer.id,
              currentPlayerName: currentPlayer.name,
              requiredLetter: room.requiredLetter
            });
          }
          
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
      io.to(roomId).emit('game_ended', room.leaderboard);
      gameManager.cleanupRoom(roomId);
      const resetRoom = roomManager.resetRoomForNextGame(roomId);
      if (resetRoom) {
        io.to(roomId).emit('room_updated', resetRoom);
      }
    } else {
      // Continue game with next player
      const currentPlayer = gameManager.getCurrentPlayer(room);
      if (currentPlayer) {
        io.to(roomId).emit('turn_changed', {
          currentPlayerId: currentPlayer.id,
          currentPlayerName: currentPlayer.name,
          requiredLetter: room.requiredLetter
        });
      }
      
      // Restart timer
      const timerCallback = {
        onTick: (timeRemaining: number) => {
          io.to(roomId).emit('timer_update', timeRemaining);
        },
        onExpire: () => {
          handleTurnTimeout(roomId);
        }
      };
      gameManager.startTimer(roomId, room.settings.timeLimit, timerCallback);
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
