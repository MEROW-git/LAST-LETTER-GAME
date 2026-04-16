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
  AIDifficulty,
  AbilityEffectPayload,
  AbilityType,
  Room, 
  GameState, 
  MatchResult, 
  PlayerRanking,
  Player,
  PlayerAbilityState
} from '../../../shared/types';
import { wordValidationService } from '../services/WordValidationService';
import { roomManager } from './RoomManager';

// Timer callback type
interface TimerCallback {
  onTick: (timeRemaining: number) => void;
  onExpire: () => void;
}

type AITurnPlan = {
  player: Player;
  delayMs: number;
  word: string | null;
  shouldMistake: boolean;
};

const AI_BEHAVIOR: Record<AIDifficulty, { delayRangeMs: [number, number]; mistakeChance: number }> = {
  easy: { delayRangeMs: [2200, 4200], mistakeChance: 0.22 },
  medium: { delayRangeMs: [1400, 2600], mistakeChance: 0.08 },
  hard: { delayRangeMs: [900, 1700], mistakeChance: 0.02 },
};

export class GameManager {
  private activeTimers: Map<string, NodeJS.Timeout> = new Map(); // roomId -> interval
  private timeRemaining: Map<string, number> = new Map(); // roomId -> seconds
  private timerCallbacks: Map<string, TimerCallback | undefined> = new Map();
  private pausedUntil: Map<string, number> = new Map();
  private playerAbilities: Map<string, Map<string, PlayerAbilityState>> = new Map();
  private blockedPlayers: Map<string, Set<string>> = new Map();
  private skipPlayers: Map<string, Set<string>> = new Map();
  private reverseChainPlayers: Map<string, Set<string>> = new Map();

  private createDefaultAbilityState(): PlayerAbilityState {
    return {
      time_freeze: 1,
      letter_change: 1,
      hint_boost: 1,
      block_opponent: 1,
      reverse_chain: 1,
      skip_turn_attack: 1,
      isBlocked: false,
      reverseChainArmed: false,
    };
  }

  private getAbilityMap(roomId: string): Map<string, PlayerAbilityState> {
    let roomMap = this.playerAbilities.get(roomId);
    if (!roomMap) {
      roomMap = new Map();
      this.playerAbilities.set(roomId, roomMap);
    }
    return roomMap;
  }

  private getPlayerAbilityState(roomId: string, playerId: string): PlayerAbilityState {
    const roomMap = this.getAbilityMap(roomId);
    let state = roomMap.get(playerId);
    if (!state) {
      state = this.createDefaultAbilityState();
      roomMap.set(playerId, state);
    }
    return state;
  }

  private syncPlayerAbilityFlags(roomId: string, playerId: string) {
    const state = this.getPlayerAbilityState(roomId, playerId);
    state.isBlocked = this.blockedPlayers.get(roomId)?.has(playerId) ?? false;
    state.reverseChainArmed = this.reverseChainPlayers.get(roomId)?.has(playerId) ?? false;
  }

  getAbilityState(roomId: string, playerId: string): PlayerAbilityState {
    this.syncPlayerAbilityFlags(roomId, playerId);
    return { ...this.getPlayerAbilityState(roomId, playerId) };
  }

  private clearTurnFlags(roomId: string, playerId: string) {
    this.blockedPlayers.get(roomId)?.delete(playerId);
    this.reverseChainPlayers.get(roomId)?.delete(playerId);
    this.syncPlayerAbilityFlags(roomId, playerId);
  }

  private ensureSet(map: Map<string, Set<string>>, roomId: string): Set<string> {
    let roomSet = map.get(roomId);
    if (!roomSet) {
      roomSet = new Set();
      map.set(roomId, roomSet);
    }
    return roomSet;
  }

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
      this.getAbilityMap(roomId).set(player.id, this.createDefaultAbilityState());
    });
    this.blockedPlayers.set(roomId, new Set());
    this.skipPlayers.set(roomId, new Set());
    this.reverseChainPlayers.set(roomId, new Set());

    // Shuffle player order for variety
    room.players.sort(() => Math.random() - 0.5);

    // Set first player's turn
    const firstPlayer = room.players[0];
    room.currentTurnIndex = 0;

    console.log(`[GameManager] Game started in room ${room.roomCode}`);

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
    const reverseChainActive = this.reverseChainPlayers.get(roomId)?.has(playerId) ?? false;
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
    const nextRequiredLetter = reverseChainActive
      ? normalizedWord.charAt(0).toUpperCase()
      : normalizedWord.charAt(normalizedWord.length - 1).toUpperCase();

    // Update game state
    room.currentWord = normalizedWord;
    room.requiredLetter = nextRequiredLetter;
    room.usedWords.push(normalizedWord);

    // Update player stats
    currentPlayer.stats.validWordsSubmitted++;
    if (normalizedWord.length > currentPlayer.stats.longestWord.length) {
      currentPlayer.stats.longestWord = normalizedWord;
    }

    console.log(`[GameManager] Player ${currentPlayer.name} submitted word: ${normalizedWord}`);
    this.clearTurnFlags(roomId, currentPlayer.id);

    // Move to next player
    this.moveToNextPlayer(roomId, room);

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
    this.clearTurnFlags(roomId, currentPlayer.id);
    this.moveToNextPlayer(roomId, room);

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
      this.clearTurnFlags(roomId, playerId);
      this.moveToNextPlayer(roomId, room);
      this.resetTimer(roomId, room.settings.timeLimit);
    }

    return { gameEnded: false };
  }

  /**
   * Move to next active player
   */
  private moveToNextPlayer(roomId: string, room: Room): void {
    const playerCount = room.players.length;
    let attempts = 0;
    
    do {
      room.currentTurnIndex = (room.currentTurnIndex + 1) % playerCount;
      attempts++;
    } while (
      attempts < playerCount && 
      room.players[room.currentTurnIndex].isEliminated
    );

    const skipSet = this.skipPlayers.get(roomId);
    if (skipSet && skipSet.has(room.players[room.currentTurnIndex].id)) {
      skipSet.delete(room.players[room.currentTurnIndex].id);
      this.clearTurnFlags(roomId, room.players[room.currentTurnIndex].id);
      this.moveToNextPlayer(roomId, room);
      return;
    }

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

  isAiPlayer(player: Player | null | undefined): player is Player {
    return Boolean(player?.isBot);
  }

  getAiTurnPlan(roomId: string): AITurnPlan | null {
    const room = roomManager.getRoom(roomId);
    if (!room || room.status !== 'playing' || room.gameMode !== 'single_player') {
      return null;
    }

    const currentPlayer = this.getCurrentPlayer(room);
    if (!this.isAiPlayer(currentPlayer)) {
      return null;
    }

    const difficulty = room.aiDifficulty ?? 'easy';
    const behavior = AI_BEHAVIOR[difficulty];
    const delayMs = behavior.delayRangeMs[0] + Math.floor(Math.random() * (behavior.delayRangeMs[1] - behavior.delayRangeMs[0] + 1));
    const shouldMistake = Math.random() < behavior.mistakeChance;
    const word = wordValidationService.getAiMove(room.requiredLetter, room.usedWords, difficulty);

    return {
      player: currentPlayer,
      delayMs,
      word,
      shouldMistake,
    };
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
      chainDirection: currentPlayer && (this.reverseChainPlayers.get(room.id)?.has(currentPlayer.id) ?? false) ? 'first' : 'last',
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

    this.timerCallbacks.set(roomId, callbacks);
    let remaining = duration;
    this.timeRemaining.set(roomId, remaining);

    const interval = setInterval(() => {
      const pausedUntil = this.pausedUntil.get(roomId);
      if (pausedUntil && pausedUntil > Date.now()) {
        return;
      }

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

    this.startTimer(roomId, duration, this.timerCallbacks.get(roomId));
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
    this.timerCallbacks.delete(roomId);
    this.pausedUntil.delete(roomId);
  }

  /**
   * Get remaining time for a room
   */
  getRemainingTime(roomId: string): number {
    return this.timeRemaining.get(roomId) || 0;
  }

  pauseTimer(roomId: string, durationSeconds: number): void {
    this.pausedUntil.set(roomId, Date.now() + durationSeconds * 1000);
  }

  useAbility(roomId: string, playerId: string, ability: AbilityType, targetPlayerId?: string): {
    success: boolean;
    error?: string;
    effect?: AbilityEffectPayload;
    hints?: string[];
    gameState?: GameState;
  } {
    const room = roomManager.getRoom(roomId);
    if (!room || room.status !== 'playing') {
      return { success: false, error: 'Game is not in progress' };
    }

    const currentPlayer = this.getCurrentPlayer(room);
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { success: false, error: 'You can only use abilities on your turn' };
    }

    const playerState = this.getPlayerAbilityState(roomId, playerId);
    this.syncPlayerAbilityFlags(roomId, playerId);

    if (playerState.isBlocked) {
      return { success: false, error: 'You are blocked and cannot use abilities this turn' };
    }

    if (playerState[ability] <= 0) {
      return { success: false, error: 'This ability has already been used' };
    }

    const makeEffect = (partial: Omit<AbilityEffectPayload, 'ability' | 'actorPlayerId' | 'actorPlayerName'>): AbilityEffectPayload => ({
      ability,
      actorPlayerId: currentPlayer.id,
      actorPlayerName: currentPlayer.name,
      ...partial,
    });

    if ((ability === 'block_opponent' || ability === 'skip_turn_attack') && !targetPlayerId) {
      return { success: false, error: 'Select a target player' };
    }

    const targetPlayer = targetPlayerId ? room.players.find((player) => player.id === targetPlayerId && !player.isEliminated) : undefined;
    if ((ability === 'block_opponent' || ability === 'skip_turn_attack') && (!targetPlayer || targetPlayer.id === currentPlayer.id)) {
      return { success: false, error: 'Choose another active player' };
    }

    playerState[ability] -= 1;

    switch (ability) {
      case 'time_freeze': {
        this.pauseTimer(roomId, 4);
        return {
          success: true,
          effect: makeEffect({ durationSeconds: 4 }),
          gameState: this.getGameState(room),
        };
      }
      case 'letter_change': {
        const letters = 'AEIOULNRST';
        const currentLetter = room.requiredLetter;
        const replacement = letters.split('').find((letter) => letter !== currentLetter) || 'A';
        room.requiredLetter = replacement;
        return {
          success: true,
          effect: makeEffect({ newRequiredLetter: replacement }),
          gameState: this.getGameState(room),
        };
      }
      case 'hint_boost': {
        const hints = wordValidationService.getHints(room.requiredLetter, room.usedWords, 2);
        return {
          success: true,
          effect: makeEffect({}),
          hints,
          gameState: this.getGameState(room),
        };
      }
      case 'block_opponent': {
        const blockedSet = this.ensureSet(this.blockedPlayers, roomId);
        blockedSet.add(targetPlayer!.id);
        this.syncPlayerAbilityFlags(roomId, targetPlayer!.id);
        return {
          success: true,
          effect: makeEffect({ targetPlayerId: targetPlayer!.id, targetPlayerName: targetPlayer!.name }),
          gameState: this.getGameState(room),
        };
      }
      case 'reverse_chain': {
        const reverseSet = this.ensureSet(this.reverseChainPlayers, roomId);
        reverseSet.add(currentPlayer.id);
        this.syncPlayerAbilityFlags(roomId, currentPlayer.id);
        return {
          success: true,
          effect: makeEffect({ chainDirection: 'first' }),
          gameState: this.getGameState(room),
        };
      }
      case 'skip_turn_attack': {
        const skipSet = this.ensureSet(this.skipPlayers, roomId);
        skipSet.add(targetPlayer!.id);
        return {
          success: true,
          effect: makeEffect({ targetPlayerId: targetPlayer!.id, targetPlayerName: targetPlayer!.name }),
          gameState: this.getGameState(room),
        };
      }
      default:
        return { success: false, error: 'Unknown ability' };
    }
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
        playerRankPointsBefore: winner.rankPoints,
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
        playerRankPointsBefore: player.rankPoints,
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
    this.playerAbilities.delete(roomId);
    this.blockedPlayers.delete(roomId);
    this.skipPlayers.delete(roomId);
    this.reverseChainPlayers.delete(roomId);
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
