/**
 * Shared TypeScript types for Last Letter game
 * Used by both frontend and backend
 */

// ==================== PLAYER TYPES ====================

export type Rank = 'Plastic' | 'Iron' | 'Silver' | 'Gold' | 'Diamond' | 'Master';
export type AuthProvider = 'password' | 'google' | 'facebook';

export interface PlayerProfile {
  id: string;
  userId: string; // Unique user identifier for login
  name: string;
  age: number;
  profileImage?: string;
  authProviders: AuthProvider[];
  rank: Rank;
  rankPoints: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  winStreak: number;
  bestWinStreak: number;
  protectedRank: Rank | null;
  rankProtectionMatches: number;
  createdAt: number;
  lastLoginAt: number;
}

export interface UserCredentials {
  userId: string;
  password: string;
}

export interface OAuthAuthRequest {
  provider: 'google' | 'facebook';
  providerUserId: string;
  email?: string;
  name?: string;
  age?: number;
  profileImage?: string;
}

export interface UpdateProfileRequest {
  userId: string;
  name: string;
  age: number;
  profileImage?: string;
}

export interface UpdatePasswordRequest {
  userId: string;
  currentPassword?: string;
  newPassword: string;
}

export interface LinkOAuthRequest {
  userId: string;
  provider: 'google' | 'facebook';
  providerUserId: string;
  email?: string;
}

export interface AppSettings {
  volume: number;
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
  Master: 7000,
} as const;

export const RANK_POINTS = {
  WIN: 100,
  LOSS: -50,
  DRAW: 20,
  WIN_STREAK_2: 20,
  WIN_STREAK_3: 30,
  WIN_STREAK_5: 50,
  FAST_WIN: 10,
  PERFECT_GAME: 15,
  BEAT_STRONGER_PLAYER: 25,
} as const;

export function calculateRank(points: number): Rank {
  if (points >= RANK_THRESHOLDS.Master) return 'Master';
  if (points >= RANK_THRESHOLDS.Diamond) return 'Diamond';
  if (points >= RANK_THRESHOLDS.Gold) return 'Gold';
  if (points >= RANK_THRESHOLDS.Silver) return 'Silver';
  if (points >= RANK_THRESHOLDS.Iron) return 'Iron';
  return 'Plastic';
}

export function getNextRankThreshold(currentRank: Rank): number {
  const ranks: Rank[] = ['Plastic', 'Iron', 'Silver', 'Gold', 'Diamond', 'Master'];
  const currentIndex = ranks.indexOf(currentRank);
  if (currentIndex === ranks.length - 1) return RANK_THRESHOLDS.Master;
  return RANK_THRESHOLDS[ranks[currentIndex + 1]];
}

export interface Player extends PlayerProfile {
  socketId: string;
  isBot: boolean;
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
export type GameMode = 'multiplayer' | 'single_player';
export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface RoomSettings {
  maxPlayers: number;
  timeLimit: number; // in seconds, 5-30
  botCount?: number;
  aiDifficulty?: AIDifficulty;
}

export interface CreateRoomRequest {
  roomName: string;
  isPrivate?: boolean;
  password?: string;
  gameMode?: GameMode;
  aiDifficulty?: AIDifficulty;
}

export interface JoinRoomRequest {
  roomCode: string;
  password?: string;
  inviteToken?: string;
}

export interface UpdateRoomAccessRequest {
  isPrivate: boolean;
  password?: string;
}

export interface Room {
  id: string;
  roomCode: string;
  roomName: string;
  gameMode: GameMode;
  aiDifficulty: AIDifficulty | null;
  isPrivate: boolean;
  inviteToken: string;
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
  gameMode: GameMode;
  aiDifficulty: AIDifficulty | null;
  isPrivate: boolean;
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
  chainDirection: 'last' | 'first';
  usedWords: string[];
  players: Player[];
  status: RoomStatus;
}

export interface WordValidationResult {
  valid: boolean;
  reason?: string;
  word?: string;
}

export type AbilityType =
  | 'time_freeze'
  | 'letter_change'
  | 'hint_boost'
  | 'block_opponent'
  | 'reverse_chain'
  | 'skip_turn_attack';

export interface PlayerAbilityState {
  time_freeze: number;
  letter_change: number;
  hint_boost: number;
  block_opponent: number;
  reverse_chain: number;
  skip_turn_attack: number;
  isBlocked: boolean;
  reverseChainArmed: boolean;
}

export interface UseAbilityRequest {
  roomId: string;
  ability: AbilityType;
  targetPlayerId?: string;
}

export interface AbilityEffectPayload {
  ability: AbilityType;
  actorPlayerId: string;
  actorPlayerName: string;
  targetPlayerId?: string;
  targetPlayerName?: string;
  durationSeconds?: number;
  newRequiredLetter?: string | null;
  chainDirection?: 'last' | 'first';
}

export interface MatchReactionPayload {
  roomId: string;
  playerId: string;
  playerName: string;
  emoji: string;
  createdAt: number;
}

export interface QuickMessagePayload {
  roomId: string;
  playerId: string;
  playerName: string;
  message: string;
  createdAt: number;
}

export interface RematchStatusPayload {
  roomId: string;
  acceptedPlayerIds: string[];
  requestedByPlayerId?: string;
  requestedByPlayerName?: string;
}

// ==================== LEADERBOARD TYPES ====================

export interface PlayerRanking {
  rank: number;
  playerId: string;
  playerName: string;
  placement: string;
  playerRankPointsBefore: number;
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
  'create_room': (data: { room: CreateRoomRequest; player: PlayerProfile }, callback: (response: { success: boolean; room?: Room; error?: string }) => void) => void;
  'join_room': (data: { join: JoinRoomRequest; player: PlayerProfile }, callback: (response: { success: boolean; room?: Room; error?: string }) => void) => void;
  'leave_room': (data: { roomId: string }, callback?: (response: { success: boolean }) => void) => void;
  'kick_player': (data: { roomId: string; playerId: string }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  
  // Room settings
  'update_room_settings': (data: { roomId: string; settings: Partial<RoomSettings> }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'update_room_access': (data: { roomId: string; access: UpdateRoomAccessRequest }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  
  // Player ready state
  'ready_toggle': (data: { roomId: string }, callback?: (response: { success: boolean; isReady: boolean }) => void) => void;
  
  // Game control
  'start_game': (data: { roomId: string }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  
  // Gameplay
  'submit_word': (data: { roomId: string; word: string }, callback?: (response: { success: boolean; error?: string; result?: WordValidationResult }) => void) => void;
  'use_ability': (data: UseAbilityRequest, callback?: (response: { success: boolean; error?: string; hints?: string[] }) => void) => void;
  'send_reaction': (data: { roomId: string; emoji: string }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'send_quick_message': (data: { roomId: string; message: string }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'request_rematch': (data: { roomId: string }, callback?: (response: { success: boolean; room?: Room; error?: string }) => void) => void;
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
  'turn_changed': (data: { currentPlayerId: string; currentPlayerName: string; requiredLetter: string | null; chainDirection: 'last' | 'first' }) => void;
  'word_submitted': (data: { playerId: string; playerName: string; word: string; nextLetter: string }) => void;
  'word_rejected': (data: { reason: string }) => void;
  'player_eliminated': (data: { playerId: string; playerName: string; reason: string }) => void;
  'timer_update': (timeRemaining: number) => void;
  'timer_expired': (data: { playerId: string; playerName: string }) => void;
  'ability_state': (state: PlayerAbilityState) => void;
  'ability_effect': (effect: AbilityEffectPayload) => void;
  'reaction_received': (payload: MatchReactionPayload) => void;
  'quick_message_received': (payload: QuickMessagePayload) => void;
  'rematch_status': (payload: RematchStatusPayload) => void;
  'rematch_started': (data: { room: Room; requestedByPlayerId: string; requestedByPlayerName: string }) => void;
  
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
  ACTIVE_PLAYER_PROFILE: 'last_letter_active_player_profile',
  SAVED_PLAYER_PROFILES: 'last_letter_saved_player_profiles',
  APP_SETTINGS: 'last_letter_app_settings',
  PROCESSED_MATCH_RESULTS: 'last_letter_processed_match_results',
} as const;
