/**
 * Game Manager
 * 
 * Handles all game-related operations:
 * - Starting games
 * - Turn management
 * - Timer management
 * - Word submission handling
 * - Player elimination
 * - Game ending and leaderboard generation
 */

import type { 
  Room, 
  GameState, 
  MatchResult, 
  PlayerRanking,
  Player 
} from '../../../shared/types';
import { wordValidationService } from '../services/WordValidationService';
import { roomManager } from './RoomManager';

// Timer callback type
interface TimerCallback {
  onTick: (timeRemaining: number) => void;
  onExpire: () => void;
}

export class GameManager {
  private activeTimers: Map<string, NodeJS.Timeout> = new Map(); // roomId -> interval
  private timeRemaining: Map<string, number> = new Map(); // roomId -> seconds

  /**
   * Start a new game
   */
  async startGame(roomId: string, adminId: string): Promise<GameState> {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Verify admin
    const admin = room.players.find(p => p.id === adminId);
    if (!admin || !admin.isAdmin) {
      throw new Error('Only admin can start the game');
    }

    // Check minimum players
    if (room.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Check all players are ready
    const notReadyPlayers = room.players.filter(p => !p.isReady && !p.isAdmin);
    if (notReadyPlayers.length > 0) {
      throw new Error(`Waiting for players to be ready: ${notReadyPlayers.map(p => p.name).join(', ')}`);
    }

    // Reset game state
    room.status = 'playing';
    room.currentWord = null;
    room.requiredLetter = null;
    room.usedWords = [];
    room.currentTurnIndex = 0;
    room.leaderboard = null;
    room.gameStartedAt = Date.now();
    room.gameEndedAt = null;

    // Reset all player states
    room.players.forEach(player => {
      player.isEliminated = false;
      player.stats = {
        validWordsSubmitted: 0,
        timeoutCount: 0,
        longestWord: ''
      };
    });

    // Shuffle player order for variety
    room.players.sort(() => Math.random() - 0.5);

    // Set first player's turn
    const firstPlayer = room.players[0];
    room.currentTurnIndex = 0;

    console.log(`[GameManager] Game started in room ${room.roomCode}`);

    // Start the timer
    this.startTimer(roomId, room.settings.timeLimit);

    return this.getGameState(room);
  }

  /**
   * Submit a word for the current player
   */
  async submitWord(
    roomId: string, 
    playerId: string, 
    word: string
  ): Promise<{ success: boolean; error?: string; gameState?: GameState }> {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // Check game is playing
    if (room.status !== 'playing') {
      return { success: false, error: 'Game is not in progress' };
    }

    // Get current player
    const currentPlayer = this.getCurrentPlayer(room);
    if (!currentPlayer) {
      return { success: false, error: 'No current player' };
    }

    // Verify it's the player's turn
    if (currentPlayer.id !== playerId) {
      return { success: false, error: 'It is not your turn' };
    }

    // Validate the word
    const validationResult = await wordValidationService.validateWord(
      word,
      room.requiredLetter,
      room.usedWords
    );

    if (!validationResult.valid) {
      return { 
        success: false, 
        error: validationResult.reason || 'Invalid word' 
      };
    }

    const normalizedWord = word.toLowerCase().trim();
    const lastLetter = normalizedWord.charAt(normalizedWord.length - 1).toUpperCase();

    // Update game state
    room.currentWord = normalizedWord;
    room.requiredLetter = lastLetter;
    room.usedWords.push(normalizedWord);

    // Update player stats
    currentPlayer.stats.validWordsSubmitted++;
    if (normalizedWord.length > currentPlayer.stats.longestWord.length) {
      currentPlayer.stats.longestWord = normalizedWord;
    }

    console.log(`[GameManager] Player ${currentPlayer.name} submitted word: ${normalizedWord}`);

    // Move to next player
    this.moveToNextPlayer(room);

    // Reset timer
    this.resetTimer(roomId, room.settings.timeLimit);

    return { 
      success: true, 
      gameState: this.getGameState(room) 
    };
  }

  /**
   * Handle player timeout (elimination)
   */
  handleTimeout(roomId: string): { eliminatedPlayer: Player | null; gameEnded: boolean; winner?: Player } {
    const room = roomManager.getRoom(roomId);
    if (!room || room.status !== 'playing') {
      return { eliminatedPlayer: null, gameEnded: false };
    }

    const currentPlayer = this.getCurrentPlayer(room);
    if (!currentPlayer) {
      return { eliminatedPlayer: null, gameEnded: false };
    }

    // Eliminate the player
    currentPlayer.isEliminated = true;
    currentPlayer.stats.timeoutCount++;

    console.log(`[GameManager] Player ${currentPlayer.name} eliminated due to timeout`);

    // Check if game should end
    const activePlayers = this.getActivePlayers(room);
    
    if (activePlayers.length <= 1) {
      // Game ends - we have a winner
      const winner = activePlayers[0] || null;
      
      // Stop timer
      this.stopTimer(roomId);
      
      // Generate leaderboard
      this.endGame(room, winner);
      
      return { 
        eliminatedPlayer: currentPlayer, 
        gameEnded: true, 
        winner: winner || undefined 
      };
    }

    // Move to next player
    this.moveToNextPlayer(room);

    // Reset timer
    this.resetTimer(roomId, room.settings.timeLimit);

    return { 
      eliminatedPlayer: currentPlayer, 
      gameEnded: false 
    };
  }

  /**
   * Handle player disconnection during game
   */
  handlePlayerDisconnect(roomId: string, playerId: string): { gameEnded: boolean; winner?: Player } {
    const room = roomManager.getRoom(roomId);
    if (!room || room.status !== 'playing') {
      return { gameEnded: false };
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return { gameEnded: false };
    }

    // Mark player as eliminated
    player.isEliminated = true;
    player.isConnected = false;

    console.log(`[GameManager] Player ${player.name} eliminated due to disconnect`);

    // Check if game should end
    const activePlayers = this.getActivePlayers(room);
    
    if (activePlayers.length <= 1) {
      const winner = activePlayers[0] || null;
      
      // Stop timer
      this.stopTimer(roomId);
      
      // Generate leaderboard
      this.endGame(room, winner);
      
      return { 
        gameEnded: true, 
        winner: winner || undefined 
      };
    }

    // If disconnected player was current player, move to next
    const currentPlayer = this.getCurrentPlayer(room);
    if (currentPlayer && currentPlayer.id === playerId) {
      this.moveToNextPlayer(room);
      this.resetTimer(roomId, room.settings.timeLimit);
    }

    return { gameEnded: false };
  }

  /**
   * Move to next active player
   */
  private moveToNextPlayer(room: Room): void {
    const playerCount = room.players.length;
    let attempts = 0;
    
    do {
      room.currentTurnIndex = (room.currentTurnIndex + 1) % playerCount;
      attempts++;
    } while (
      attempts < playerCount && 
      room.players[room.currentTurnIndex].isEliminated
    );

    // If first word hasn't been played yet, set required letter to null
    if (room.usedWords.length === 0) {
      room.requiredLetter = null;
    }
  }

  /**
   * Get current player
   */
  getCurrentPlayer(room: Room): Player | null {
    if (room.players.length === 0) return null;
    
    const player = room.players[room.currentTurnIndex];
    if (player.isEliminated) {
      // Find next active player
      for (let i = 0; i < room.players.length; i++) {
        const idx = (room.currentTurnIndex + i) % room.players.length;
        if (!room.players[idx].isEliminated) {
          return room.players[idx];
        }
      }
      return null;
    }
    return player;
  }

  /**
   * Get active (non-eliminated) players
   */
  getActivePlayers(room: Room): Player[] {
    return room.players.filter(p => !p.isEliminated);
  }

  /**
   * Get game state for client
   */
  getGameState(room: Room): GameState {
    const currentPlayer = this.getCurrentPlayer(room);
    
    return {
      roomId: room.id,
      currentWord: room.currentWord,
      requiredLetter: room.requiredLetter,
      currentPlayerId: currentPlayer?.id || null,
      currentPlayerName: currentPlayer?.name || null,
      timeRemaining: this.timeRemaining.get(room.id) || room.settings.timeLimit,
      totalTime: room.settings.timeLimit,
      usedWords: room.usedWords,
      players: room.players,
      status: room.status
    };
  }

  /**
   * Start the turn timer
   */
  startTimer(roomId: string, duration: number, callbacks?: TimerCallback): void {
    // Stop any existing timer
    this.stopTimer(roomId);

    let remaining = duration;
    this.timeRemaining.set(roomId, remaining);

    const interval = setInterval(() => {
      remaining--;
      this.timeRemaining.set(roomId, remaining);

      if (callbacks?.onTick) {
        callbacks.onTick(remaining);
      }

      if (remaining <= 0) {
        this.stopTimer(roomId);
        if (callbacks?.onExpire) {
          callbacks.onExpire();
        }
      }
    }, 1000);

    this.activeTimers.set(roomId, interval);
  }

  /**
   * Reset the timer
   */
  resetTimer(roomId: string, duration: number): void {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    this.startTimer(roomId, duration);
  }

  /**
   * Stop the timer
   */
  stopTimer(roomId: string): void {
    const timer = this.activeTimers.get(roomId);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(roomId);
    }
    this.timeRemaining.delete(roomId);
  }

  /**
   * Get remaining time for a room
   */
  getRemainingTime(roomId: string): number {
    return this.timeRemaining.get(roomId) || 0;
  }

  /**
   * End the game and generate leaderboard
   */
  private endGame(room: Room, winner: Player | null): MatchResult {
    room.status = 'ended';
    room.gameEndedAt = Date.now();

    const gameDuration = room.gameEndedAt - (room.gameStartedAt || room.gameEndedAt);
    
    // Generate rankings
    const rankings: PlayerRanking[] = [];
    
    // Winner is rank 1
    if (winner) {
      rankings.push({
        rank: 1,
        playerId: winner.id,
        playerName: winner.name,
        placement: 'Winner',
        validWordsSubmitted: winner.stats.validWordsSubmitted,
        timeoutCount: winner.stats.timeoutCount,
        longestWord: winner.stats.longestWord
      });
    }

    // Sort eliminated players by when they were eliminated (reverse order of elimination)
    // Players eliminated later get better ranks
    const eliminatedPlayers = room.players
      .filter(p => p.isEliminated)
      .sort((a, b) => b.stats.timeoutCount - a.stats.timeoutCount);

    let rank = 2;
    eliminatedPlayers.forEach(player => {
      rankings.push({
        rank,
        playerId: player.id,
        playerName: player.name,
        placement: rank === 2 ? '2nd Place' : rank === 3 ? '3rd Place' : `${rank}th Place`,
        validWordsSubmitted: player.stats.validWordsSubmitted,
        timeoutCount: player.stats.timeoutCount,
        longestWord: player.stats.longestWord
      });
      rank++;
    });

    const result: MatchResult = {
      roomId: room.id,
      winnerId: winner?.id || null,
      winnerName: winner?.name || null,
      rankings,
      totalWords: room.usedWords.length,
      gameDuration: Math.floor(gameDuration / 1000),
      endedAt: room.gameEndedAt
    };

    room.leaderboard = result;

    console.log(`[GameManager] Game ended in room ${room.roomCode}. Winner: ${winner?.name || 'None'}`);

    return result;
  }

  /**
   * Get leaderboard for a room
   */
  getLeaderboard(roomId: string): MatchResult | null {
    const room = roomManager.getRoom(roomId);
    return room?.leaderboard || null;
  }

  /**
   * Force end a game (for admin)
   */
  forceEndGame(roomId: string, adminId: string): MatchResult | null {
    const room = roomManager.getRoom(roomId);
    if (!room) return null;

    const admin = room.players.find(p => p.id === adminId);
    if (!admin || !admin.isAdmin) {
      throw new Error('Only admin can end the game');
    }

    if (room.status !== 'playing') {
      throw new Error('Game is not in progress');
    }

    this.stopTimer(roomId);

    const activePlayers = this.getActivePlayers(room);
    const winner = activePlayers[0] || null;

    return this.endGame(room, winner);
  }

  /**
   * Clean up resources for a room
   */
  cleanupRoom(roomId: string): void {
    this.stopTimer(roomId);
  }

  /**
   * Get active games count
   */
  getActiveGamesCount(): number {
    let count = 0;
    for (const room of roomManager.getAvailableRooms()) {
      if (room.status === 'playing') count++;
    }
    return count;
  }
}

// Export singleton instance
export const gameManager = new GameManager();
