/**
 * Room Manager
 * 
 * Handles all room-related operations:
 * - Creating rooms
 * - Joining/leaving rooms
 * - Room settings management
 * - Player management (kick, ready, admin transfer)
 * - Room cleanup
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  Room, 
  RoomSummary, 
  Player, 
  PlayerProfile, 
  RoomSettings,
  PlayerStats 
} from '../../../shared/types';

// Generate a random 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map(); // roomId -> Room
  private roomCodes: Map<string, string> = new Map(); // roomCode -> roomId
  
  // Constants
  private readonly MIN_PLAYERS = 2;
  private readonly MAX_PLAYERS = 15;
  private readonly DEFAULT_TIME_LIMIT = 15;
  private readonly ROOM_CODE_MAX_ATTEMPTS = 10;

  /**
   * Create a new room
   */
  createRoom(roomName: string, playerProfile: PlayerProfile, socketId: string): Room {
    const roomId = uuidv4();
    
    // Generate unique room code
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (this.roomCodes.has(roomCode) && attempts < this.ROOM_CODE_MAX_ATTEMPTS) {
      roomCode = generateRoomCode();
      attempts++;
    }
    
    if (attempts >= this.ROOM_CODE_MAX_ATTEMPTS) {
      throw new Error('Failed to generate unique room code');
    }

    // Create admin player
    const adminPlayer: Player = {
      ...playerProfile,
      socketId,
      isReady: false,
      isAdmin: true,
      isEliminated: false,
      isConnected: true,
      joinedAt: Date.now(),
      stats: {
        validWordsSubmitted: 0,
        timeoutCount: 0,
        longestWord: ''
      }
    };

    // Create room
    const room: Room = {
      id: roomId,
      roomCode,
      roomName: roomName.trim() || 'Untitled Room',
      adminPlayerId: playerProfile.id,
      players: [adminPlayer],
      settings: {
        maxPlayers: this.MAX_PLAYERS,
        timeLimit: this.DEFAULT_TIME_LIMIT
      },
      status: 'waiting',
      currentTurnIndex: 0,
      currentWord: null,
      requiredLetter: null,
      usedWords: [],
      leaderboard: null,
      createdAt: Date.now(),
      gameStartedAt: null,
      gameEndedAt: null
    };

    this.rooms.set(roomId, room);
    this.roomCodes.set(roomCode, roomId);

    console.log(`[RoomManager] Created room ${roomCode} (${roomId}) by ${playerProfile.name}`);
    return room;
  }

  /**
   * Join an existing room by room code
   */
  joinRoom(roomCode: string, playerProfile: PlayerProfile, socketId: string): Room | null {
    const normalizedCode = roomCode.toUpperCase().trim();
    const roomId = this.roomCodes.get(normalizedCode);
    
    if (!roomId) {
      return null;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    // Check if room is full
    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Room is full');
    }

    // Check if game already started
    if (room.status !== 'waiting') {
      throw new Error('Game has already started');
    }

    // Check if player is already in room (reconnect scenario)
    const existingPlayerIndex = room.players.findIndex(p => p.id === playerProfile.id);
    if (existingPlayerIndex >= 0) {
      // Update socket ID and connection status
      room.players[existingPlayerIndex].socketId = socketId;
      room.players[existingPlayerIndex].isConnected = true;
      console.log(`[RoomManager] Player ${playerProfile.name} reconnected to room ${roomCode}`);
      return room;
    }

    // Create new player
    const newPlayer: Player = {
      ...playerProfile,
      socketId,
      isReady: false,
      isAdmin: false,
      isEliminated: false,
      isConnected: true,
      joinedAt: Date.now(),
      stats: {
        validWordsSubmitted: 0,
        timeoutCount: 0,
        longestWord: ''
      }
    };

    room.players.push(newPlayer);
    console.log(`[RoomManager] Player ${playerProfile.name} joined room ${roomCode}`);
    
    return room;
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string, playerId: string): { room: Room | null; newAdminId?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { room: null };
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex < 0) {
      return { room };
    }

    const player = room.players[playerIndex];
    const wasAdmin = player.isAdmin;

    // Remove the player entirely when they explicitly leave the room.
    room.players.splice(playerIndex, 1);
    console.log(`[RoomManager] Player ${player.name} left room ${room.roomCode}`);

    // If room is empty, delete it
    if (room.players.length === 0) {
      this.deleteRoom(roomId);
      console.log(`[RoomManager] Deleted empty room ${room.roomCode}`);
      return { room: null };
    }

    // If admin left, transfer admin to next available player
    let newAdminId: string | undefined;
    if (wasAdmin) {
      newAdminId = this.transferAdmin(roomId) || undefined;
    }

    // If game is in progress, handle player leaving
    if (room.status === 'playing') {
      // Mark player as eliminated if they leave during game
      player.isEliminated = true;
      player.isConnected = false;
      
      // Check if game should end (only one player left)
      const activePlayers = room.players.filter(p => !p.isEliminated && p.isConnected);
      if (activePlayers.length <= 1) {
        // Game should end - handled by GameManager
        return { room, newAdminId };
      }
    }

    return { room, newAdminId };
  }

  /**
   * Kick a player from room (admin only)
   */
  kickPlayer(roomId: string, adminId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Verify admin
    const admin = room.players.find(p => p.id === adminId);
    if (!admin || !admin.isAdmin) {
      throw new Error('Only admin can kick players');
    }

    // Cannot kick yourself
    if (adminId === playerId) {
      throw new Error('Cannot kick yourself');
    }

    // Find player to kick
    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex < 0) {
      throw new Error('Player not found in room');
    }

    const player = room.players[playerIndex];
    room.players.splice(playerIndex, 1);
    console.log(`[RoomManager] Admin ${admin.name} kicked player ${player.name} from room ${room.roomCode}`);

    return true;
  }

  /**
   * Toggle player ready status
   */
  toggleReady(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new Error('Cannot change ready status during a game');
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found in room');
    }

    player.isReady = !player.isReady;
    console.log(`[RoomManager] Player ${player.name} is ${player.isReady ? 'ready' : 'not ready'}`);
    
    return player.isReady;
  }

  /**
   * Update room settings (admin only)
   */
  updateSettings(
    roomId: string, 
    adminId: string, 
    settings: Partial<RoomSettings>
  ): Room {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Verify admin
    const admin = room.players.find(p => p.id === adminId);
    if (!admin || !admin.isAdmin) {
      throw new Error('Only admin can change settings');
    }

    // Cannot change settings during game
    if (room.status !== 'waiting') {
      throw new Error('Cannot change settings during game');
    }

    // Validate and update max players
    if (settings.maxPlayers !== undefined) {
      const newMax = settings.maxPlayers;
      
      // Must be within limits
      if (newMax < this.MIN_PLAYERS || newMax > this.MAX_PLAYERS) {
        throw new Error(`Max players must be between ${this.MIN_PLAYERS} and ${this.MAX_PLAYERS}`);
      }
      
      // Cannot be less than current player count
      if (newMax < room.players.length) {
        throw new Error('Cannot set max players below current player count');
      }
      
      room.settings.maxPlayers = newMax;
    }

    // Validate and update time limit
    if (settings.timeLimit !== undefined) {
      const newTimeLimit = settings.timeLimit;
      
      // Must be between 5 and 30 seconds
      if (newTimeLimit < 5 || newTimeLimit > 30) {
        throw new Error('Time limit must be between 5 and 30 seconds');
      }
      
      room.settings.timeLimit = newTimeLimit;
    }

    console.log(`[RoomManager] Updated settings for room ${room.roomCode}:`, room.settings);
    return room;
  }

  /**
   * Transfer admin to another player
   */
  transferAdmin(roomId: string, newAdminId?: string): string | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    // Find current admin and remove admin status
    const currentAdmin = room.players.find(p => p.isAdmin);
    if (currentAdmin) {
      currentAdmin.isAdmin = false;
    }

    let targetAdmin: Player | undefined;

    if (newAdminId) {
      // Transfer to specific player
      targetAdmin = room.players.find(p => p.id === newAdminId);
    } else {
      // Auto-transfer to first connected, non-eliminated player
      targetAdmin = room.players.find(p => p.isConnected && !p.isEliminated);
      
      // If no eligible player, transfer to first connected player
      if (!targetAdmin) {
        targetAdmin = room.players.find(p => p.isConnected);
      }
      
      // If still no eligible player, transfer to first player
      if (!targetAdmin && room.players.length > 0) {
        targetAdmin = room.players[0];
      }
    }

    if (targetAdmin) {
      targetAdmin.isAdmin = true;
      room.adminPlayerId = targetAdmin.id;
      console.log(`[RoomManager] Admin transferred to ${targetAdmin.name} in room ${room.roomCode}`);
      return targetAdmin.id;
    }

    return null;
  }

  /**
   * Get a room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get a room by room code
   */
  getRoomByCode(roomCode: string): Room | undefined {
    const roomId = this.roomCodes.get(roomCode.toUpperCase().trim());
    if (roomId) {
      return this.rooms.get(roomId);
    }
    return undefined;
  }

  /**
   * Get all available rooms (for lobby)
   */
  getAvailableRooms(): RoomSummary[] {
    const rooms: RoomSummary[] = [];
    
    for (const room of this.rooms.values()) {
      // Only show waiting rooms that aren't full
      if (room.status === 'waiting' && room.players.length < room.settings.maxPlayers) {
        const admin = room.players.find(p => p.isAdmin);
        rooms.push({
          id: room.id,
          roomCode: room.roomCode,
          roomName: room.roomName,
          currentPlayers: room.players.length,
          maxPlayers: room.settings.maxPlayers,
          timeLimit: room.settings.timeLimit,
          status: room.status,
          adminName: admin?.name || 'Unknown'
        });
      }
    }
    
    // Sort by creation time (newest first)
    return rooms.sort((a, b) => {
      const roomA = this.rooms.get(a.id);
      const roomB = this.rooms.get(b.id);
      return (roomB?.createdAt || 0) - (roomA?.createdAt || 0);
    });
  }

  /**
   * Delete a room
   */
  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.roomCodes.delete(room.roomCode);
      this.rooms.delete(roomId);
    }
  }

  /**
   * Update room status
   */
  setRoomStatus(roomId: string, status: Room['status']): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.status = status;
      
      if (status === 'playing' && !room.gameStartedAt) {
        room.gameStartedAt = Date.now();
      }
      
      if (status === 'ended' && !room.gameEndedAt) {
        room.gameEndedAt = Date.now();
      }
    }
  }

  /**
   * Reset a finished room back to waiting state for another round
   */
  resetRoomForNextGame(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    room.status = 'waiting';
    room.currentTurnIndex = 0;
    room.currentWord = null;
    room.requiredLetter = null;
    room.usedWords = [];
    room.leaderboard = null;
    room.gameStartedAt = null;
    room.gameEndedAt = null;

    room.players.forEach((player) => {
      player.isReady = false;
      player.isEliminated = false;
      player.stats = {
        validWordsSubmitted: 0,
        timeoutCount: 0,
        longestWord: '',
      };
    });

    return room;
  }

  /**
   * Mark player as disconnected
   */
  markPlayerDisconnected(roomId: string, socketId: string): { room: Room | null; newAdminId?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { room: null };
    }

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) {
      return { room };
    }

    player.isConnected = false;
    console.log(`[RoomManager] Player ${player.name} disconnected from room ${room.roomCode}`);

    // If admin disconnected, transfer admin
    let newAdminId: string | undefined;
    if (player.isAdmin && room.status === 'waiting') {
      newAdminId = this.transferAdmin(roomId) || undefined;
    }

    // If room is empty (all disconnected), delete it after a delay
    const allDisconnected = room.players.every(p => !p.isConnected);
    if (allDisconnected) {
      // Schedule room deletion after 30 seconds
      setTimeout(() => {
        const currentRoom = this.rooms.get(roomId);
        if (currentRoom && currentRoom.players.every(p => !p.isConnected)) {
          this.deleteRoom(roomId);
          console.log(`[RoomManager] Deleted abandoned room ${room.roomCode}`);
        }
      }, 30000);
    }

    return { room, newAdminId };
  }

  /**
   * Reconnect player to room
   */
  reconnectPlayer(roomId: string, playerId: string, newSocketId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return null;
    }

    player.socketId = newSocketId;
    player.isConnected = true;
    console.log(`[RoomManager] Player ${player.name} reconnected to room ${room.roomCode}`);

    return room;
  }

  /**
   * Get room by socket ID
   */
  getRoomBySocketId(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.socketId === socketId)) {
        return room;
      }
    }
    return null;
  }

  /**
   * Get player by socket ID
   */
  getPlayerBySocketId(socketId: string): { player: Player | null; room: Room | null } {
    for (const room of this.rooms.values()) {
      const player = room.players.find(p => p.socketId === socketId);
      if (player) {
        return { player, room };
      }
    }
    return { player: null, room: null };
  }

  /**
   * Get statistics
   */
  getStats(): { totalRooms: number; totalPlayers: number } {
    let totalPlayers = 0;
    for (const room of this.rooms.values()) {
      totalPlayers += room.players.length;
    }
    
    return {
      totalRooms: this.rooms.size,
      totalPlayers
    };
  }
}

// Export singleton instance
export const roomManager = new RoomManager();
