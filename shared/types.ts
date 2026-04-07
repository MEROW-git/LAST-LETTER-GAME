/**
 * Shared TypeScript types for Last Letter game
 * Used by both frontend and backend
 */

// ==================== PLAYER TYPES ====================

export type Rank = 'Plastic' | 'Iron' | 'Silver' | 'Gold' | 'Diamond';

export interface PlayerProfile {
  id: string;
  userId: string; // Unique user identifier for login
  name: string;
  age: number;
  profileImage?: string;
  rank: Rank;
  rankPoints: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  createdAt: number;
  lastLoginAt: number;
}

export interface UserCredentials {
  userId: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  player?: PlayerProfile;
  error?: string;
}

// ==================== RANKING SYSTEM ====================

export const RANK_THRESHOLDS = {
  Plastic: 0,
  Iron: 500,
  Silver: 1500,
  Gold: 3000,
  Diamond: 5000,
} as const;

export const RANK_POINTS = {
  WIN: 100,
  LOSS: -50,
} as const;

export function calculateRank(points: number): Rank {
  if (points >= RANK_THRESHOLDS.Diamond) return 'Diamond';
  if (points >= RANK_THRESHOLDS.Gold) return 'Gold';
  if (points >= RANK_THRESHOLDS.Silver) return 'Silver';
  if (points >= RANK_THRESHOLDS.Iron) return 'Iron';
  return 'Plastic';
}

export function getNextRankThreshold(currentRank: Rank): number {
  const ranks: Rank[] = ['Plastic', 'Iron', 'Silver', 'Gold', 'Diamond'];
  const currentIndex = ranks.indexOf(currentRank);
  if (currentIndex === ranks.length - 1) return RANK_THRESHOLDS.Diamond; // Max rank
  return RANK_THRESHOLDS[ranks[currentIndex + 1]];
}

export interface Player extends PlayerProfile {
  socketId: string;
  isReady: boolean;
  isAdmin: boolean;
  isEliminated: boolean;
  isConnected: boolean;
  joinedAt: number;
  stats: PlayerStats;
}

export interface PlayerStats {
  validWordsSubmitted: number;
  timeoutCount: number;
  longestWord: string;
}

// ==================== ROOM TYPES ====================

export type RoomStatus = 'waiting' | 'playing' | 'ended';

export interface RoomSettings {
  maxPlayers: number;
  timeLimit: number; // in seconds, 5-30
}

export interface Room {
  id: string;
  roomCode: string;
  roomName: string;
  adminPlayerId: string;
  players: Player[];
  settings: RoomSettings;
  status: RoomStatus;
  currentTurnIndex: number;
  currentWord: string | null;
  requiredLetter: string | null;
  usedWords: string[];
  leaderboard: MatchResult | null;
  createdAt: number;
  gameStartedAt: number | null;
  gameEndedAt: number | null;
}

export interface RoomSummary {
  id: string;
  roomCode: string;
  roomName: string;
  currentPlayers: number;
  maxPlayers: number;
  timeLimit: number;
  status: RoomStatus;
  adminName: string;
}

// ==================== GAME TYPES ====================

export interface GameState {
  roomId: string;
  currentWord: string | null;
  requiredLetter: string | null;
  currentPlayerId: string | null;
  currentPlayerName: string | null;
  timeRemaining: number;
  totalTime: number;
  usedWords: string[];
  players: Player[];
  status: RoomStatus;
}

export interface WordValidationResult {
  valid: boolean;
  reason?: string;
  word?: string;
}

// ==================== LEADERBOARD TYPES ====================

export interface PlayerRanking {
  rank: number;
  playerId: string;
  playerName: string;
  placement: string;
  validWordsSubmitted: number;
  timeoutCount: number;
  longestWord: string;
  eliminatedAt?: number;
}

export interface MatchResult {
  roomId: string;
  winnerId: string | null;
  winnerName: string | null;
  rankings: PlayerRanking[];
  totalWords: number;
  gameDuration: number; // in seconds
  endedAt: number;
}

// ==================== SOCKET EVENT TYPES ====================

// Client to Server events
export interface ClientToServerEvents {
  // Room management
  'create_room': (data: { roomName: string; player: PlayerProfile }, callback: (response: { success: boolean; room?: Room; error?: string }) => void) => void;
  'join_room': (data: { roomCode: string; player: PlayerProfile }, callback: (response: { success: boolean; room?: Room; error?: string }) => void) => void;
  'leave_room': (data: { roomId: string }, callback?: (response: { success: boolean }) => void) => void;
  'kick_player': (data: { roomId: string; playerId: string }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  
  // Room settings
  'update_room_settings': (data: { roomId: string; settings: Partial<RoomSettings> }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  
  // Player ready state
  'ready_toggle': (data: { roomId: string }, callback?: (response: { success: boolean; isReady: boolean }) => void) => void;
  
  // Game control
  'start_game': (data: { roomId: string }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  
  // Gameplay
  'submit_word': (data: { roomId: string; word: string }, callback?: (response: { success: boolean; error?: string; result?: WordValidationResult }) => void) => void;
}

// Server to Client events
export interface ServerToClientEvents {
  // Room updates
  'room_updated': (room: Room) => void;
  'player_joined': (player: Player) => void;
  'player_left': (playerId: string) => void;
  'player_kicked': (playerId: string) => void;
  
  // Ready state
  'player_ready_changed': (data: { playerId: string; isReady: boolean }) => void;
  
  // Admin transfer
  'admin_transferred': (data: { newAdminId: string; newAdminName: string }) => void;
  
  // Game events
  'game_started': (gameState: GameState) => void;
  'game_ended': (result: MatchResult) => void;
  'turn_changed': (data: { currentPlayerId: string; currentPlayerName: string; requiredLetter: string | null }) => void;
  'word_submitted': (data: { playerId: string; playerName: string; word: string; nextLetter: string }) => void;
  'word_rejected': (data: { reason: string }) => void;
  'player_eliminated': (data: { playerId: string; playerName: string; reason: string }) => void;
  'timer_update': (timeRemaining: number) => void;
  'timer_expired': (data: { playerId: string; playerName: string }) => void;
  
  // Errors
  'error': (error: { message: string }) => void;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RoomsListResponse {
  rooms: RoomSummary[];
}

// ==================== LOCAL STORAGE TYPES ====================

export const LOCAL_STORAGE_KEYS = {
  PLAYER_PROFILE: 'last_letter_player_profile',
} as const;
