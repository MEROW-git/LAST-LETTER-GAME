'use client';

/**
 * Socket.IO Context
 * 
 * Provides Socket.IO connection and event handlers throughout the app
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { 
  AbilityEffectPayload,
  MatchReactionPayload,
  QuickMessagePayload,
  RematchStatusPayload,
  PlayerAbilityState,
  CreateRoomRequest,
  ClientToServerEvents, 
  JoinRoomRequest,
  ServerToClientEvents,
  Room,
  GameState,
  MatchResult 
} from '@shared/types';
import { applyMatchResultToProfile, getPlayerProfile } from '@/utils/localStorage';
import { useDialog } from '@/contexts/DialogContext';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type RoomResponseCallback = (response: { success: boolean; room?: Room; error?: string }) => void;
type SuccessCallback = (response: { success: boolean }) => void;
type ErrorCallback = (response: { success: boolean; error?: string }) => void;
type ReadyCallback = (response: { success: boolean; isReady: boolean }) => void;
type AbilityCallback = (response: { success: boolean; error?: string; hints?: string[] }) => void;

interface SocketContextType {
  socket: AppSocket | null;
  isConnected: boolean;
  currentRoom: Room | null;
  gameState: GameState | null;
  leaderboard: MatchResult | null;
  abilityState: PlayerAbilityState | null;
  latestAbilityEffect: AbilityEffectPayload | null;
  latestReaction: MatchReactionPayload | null;
  latestQuickMessage: QuickMessagePayload | null;
  rematchStatus: RematchStatusPayload | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  createRoom: (room: CreateRoomRequest, callback?: RoomResponseCallback) => void;
  joinRoom: (join: JoinRoomRequest, callback?: RoomResponseCallback) => void;
  leaveRoom: (callback?: SuccessCallback) => void;
  kickPlayer: (playerId: string, callback?: ErrorCallback) => void;
  updateSettings: (settings: { maxPlayers?: number; timeLimit?: number }, callback?: ErrorCallback) => void;
  updateRoomAccess: (access: { isPrivate: boolean; password?: string }, callback?: ErrorCallback) => void;
  toggleReady: (callback?: ReadyCallback) => void;
  startGame: (callback?: ErrorCallback) => void;
  submitWord: (word: string, callback?: ErrorCallback) => void;
  useAbility: (data: { ability: AbilityEffectPayload['ability']; targetPlayerId?: string }, callback?: AbilityCallback) => void;
  sendReaction: (emoji: string, callback?: ErrorCallback) => void;
  sendQuickMessage: (message: string, callback?: ErrorCallback) => void;
  requestRematch: (callback?: RoomResponseCallback) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001';
const LOBBY_NOTICE_STORAGE_KEY = 'last_letter_lobby_notice';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<MatchResult | null>(null);
  const [abilityState, setAbilityState] = useState<PlayerAbilityState | null>(null);
  const [latestAbilityEffect, setLatestAbilityEffect] = useState<AbilityEffectPayload | null>(null);
  const [latestReaction, setLatestReaction] = useState<MatchReactionPayload | null>(null);
  const [latestQuickMessage, setLatestQuickMessage] = useState<QuickMessagePayload | null>(null);
  const [rematchStatus, setRematchStatus] = useState<RematchStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<AppSocket | null>(null);
  const { showAlert } = useDialog();

  // Initialize socket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const newSocket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    }) as AppSocket;

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err);
      setError('Failed to connect to server');
      setIsConnected(false);
    });

    // Room events
    newSocket.on('room_updated', (room) => {
      console.log('[Socket] Room updated:', room.id);
      setCurrentRoom(room);
    });

    newSocket.on('player_joined', (player) => {
      console.log('[Socket] Player joined:', player.name);
    });

    newSocket.on('player_left', (playerId) => {
      console.log('[Socket] Player left:', playerId);
    });

    newSocket.on('player_kicked', (playerId) => {
      console.log('[Socket] Player kicked:', playerId);
      if (playerId === getPlayerProfile()?.id) {
        const kickedMessage = 'You have been kicked from the room';
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(LOBBY_NOTICE_STORAGE_KEY, kickedMessage);
        }
        setCurrentRoom(null);
        setGameState(null);
        setLeaderboard(null);
        setError(kickedMessage);
        showAlert(kickedMessage, { title: 'Removed From Room' }).then(() => {
          window.location.assign('/lobby');
        });
      }
    });

    newSocket.on('player_ready_changed', (data) => {
      console.log('[Socket] Player ready changed:', data.playerId, data.isReady);
    });

    newSocket.on('admin_transferred', (data) => {
      console.log('[Socket] Admin transferred to:', data.newAdminName);
    });

    // Game events
    newSocket.on('game_started', (gameState) => {
      console.log('[Socket] Game started');
      setGameState(gameState);
      setLeaderboard(null);
      setLatestAbilityEffect(null);
      setLatestReaction(null);
      setLatestQuickMessage(null);
      setRematchStatus(null);
    });

    newSocket.on('game_ended', (result) => {
      console.log('[Socket] Game ended');
      setLeaderboard(result);
      setGameState(null);
      applyMatchResultToProfile(result);
    });

    newSocket.on('turn_changed', (data) => {
      console.log('[Socket] Turn changed to:', data.currentPlayerName);
      setGameState((prev) => prev ? {
        ...prev,
        currentPlayerId: data.currentPlayerId,
        currentPlayerName: data.currentPlayerName,
        requiredLetter: data.requiredLetter,
        chainDirection: data.chainDirection,
      } : null);
    });

    newSocket.on('word_submitted', (data) => {
      console.log('[Socket] Word submitted:', data.word);
      setGameState((prev) => prev ? {
        ...prev,
        currentWord: data.word,
        requiredLetter: data.nextLetter,
        usedWords: [...prev.usedWords, data.word],
      } : null);
    });

    newSocket.on('word_rejected', (data) => {
      console.log('[Socket] Word rejected:', data.reason);
      setError(data.reason);
      setTimeout(() => setError(null), 3000);
    });

    newSocket.on('player_eliminated', (data) => {
      console.log('[Socket] Player eliminated:', data.playerName);
      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map(p => 
            p.id === data.playerId ? { ...p, isEliminated: true } : p
          ),
        };
      });
    });

    newSocket.on('timer_update', (timeRemaining) => {
      setGameState((prev) => prev ? { ...prev, timeRemaining } : null);
    });

    newSocket.on('timer_expired', (data) => {
      console.log('[Socket] Timer expired for:', data.playerName);
    });

    newSocket.on('ability_state', (state) => {
      setAbilityState(state);
    });

    newSocket.on('ability_effect', (effect) => {
      setLatestAbilityEffect(effect);
    });

    newSocket.on('reaction_received', (payload) => {
      setLatestReaction(payload);
    });

    newSocket.on('quick_message_received', (payload) => {
      setLatestQuickMessage(payload);
    });

    newSocket.on('rematch_status', (payload) => {
      setRematchStatus(payload);
    });

    newSocket.on('rematch_started', (data) => {
      setCurrentRoom(data.room);
      setGameState(null);
      setLeaderboard(null);
      setLatestAbilityEffect(null);
      setLatestReaction(null);
      setLatestQuickMessage(null);
      setRematchStatus(null);
    });

    newSocket.on('error', (err) => {
      console.error('[Socket] Error:', err);
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    });
  }, []);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Socket action wrappers
  const createRoom = useCallback((room: CreateRoomRequest, callback?: RoomResponseCallback) => {
    if (!socketRef.current) return;
    
    const profile = getPlayerProfile();
    if (!profile) {
      callback?.({ success: false, error: 'Player information is required' });
      return;
    }

    socketRef.current.emit('create_room', { room, player: profile }, (response) => {
      if (response.success && response.room) {
        setCurrentRoom(response.room);
      }
      callback?.(response);
    });
  }, []);

  const joinRoom = useCallback((join: JoinRoomRequest, callback?: RoomResponseCallback) => {
    if (!socketRef.current) return;
    
    const profile = getPlayerProfile();
    if (!profile) {
      callback?.({ success: false, error: 'Player information is required' });
      return;
    }

    socketRef.current.emit('join_room', {
      join: {
        ...join,
        roomCode: join.roomCode.toUpperCase(),
      },
      player: profile,
    }, (response) => {
      if (response.success && response.room) {
        setCurrentRoom(response.room);
      }
      callback?.(response);
    });
  }, []);

  const leaveRoom = useCallback((callback?: SuccessCallback) => {
    if (!currentRoom) {
      setCurrentRoom(null);
      setGameState(null);
      setLeaderboard(null);
      setAbilityState(null);
      setLatestAbilityEffect(null);
      setLatestReaction(null);
      setLatestQuickMessage(null);
      setRematchStatus(null);
      callback?.({ success: true });
      return;
    }

    if (!socketRef.current) {
      setCurrentRoom(null);
      setGameState(null);
      setLeaderboard(null);
      setAbilityState(null);
      setLatestAbilityEffect(null);
      setLatestReaction(null);
      setLatestQuickMessage(null);
      setRematchStatus(null);
      callback?.({ success: false });
      return;
    }
    
    socketRef.current.emit('leave_room', { roomId: currentRoom.id }, (response) => {
      setCurrentRoom(null);
      setGameState(null);
      setLeaderboard(null);
      setAbilityState(null);
      setLatestAbilityEffect(null);
      setLatestReaction(null);
      setLatestQuickMessage(null);
      setRematchStatus(null);
      callback?.(response);
    });
  }, [currentRoom]);

  const kickPlayer = useCallback((playerId: string, callback?: ErrorCallback) => {
    if (!socketRef.current || !currentRoom) return;
    
    socketRef.current.emit('kick_player', { roomId: currentRoom.id, playerId }, callback);
  }, [currentRoom]);

  const updateSettings = useCallback((settings: { maxPlayers?: number; timeLimit?: number }, callback?: ErrorCallback) => {
    if (!socketRef.current || !currentRoom) return;
    
    socketRef.current.emit('update_room_settings', { roomId: currentRoom.id, settings }, callback);
  }, [currentRoom]);

  const updateRoomAccess = useCallback((access: { isPrivate: boolean; password?: string }, callback?: ErrorCallback) => {
    if (!socketRef.current || !currentRoom) return;

    socketRef.current.emit('update_room_access', { roomId: currentRoom.id, access }, callback);
  }, [currentRoom]);

  const toggleReady = useCallback((callback?: ReadyCallback) => {
    if (!socketRef.current || !currentRoom) return;
    
    socketRef.current.emit('ready_toggle', { roomId: currentRoom.id }, callback);
  }, [currentRoom]);

  const startGame = useCallback((callback?: ErrorCallback) => {
    if (!socketRef.current || !currentRoom) return;
    
    socketRef.current.emit('start_game', { roomId: currentRoom.id }, callback);
  }, [currentRoom]);

  const submitWord = useCallback((word: string, callback?: ErrorCallback) => {
    if (!socketRef.current || !currentRoom) return;
    
    socketRef.current.emit('submit_word', { roomId: currentRoom.id, word }, callback);
  }, [currentRoom]);

  const useAbility = useCallback((data: { ability: AbilityEffectPayload['ability']; targetPlayerId?: string }, callback?: AbilityCallback) => {
    if (!socketRef.current || !currentRoom) return;

    socketRef.current.emit('use_ability', {
      roomId: currentRoom.id,
      ability: data.ability,
      targetPlayerId: data.targetPlayerId,
    }, callback);
  }, [currentRoom]);

  const sendReaction = useCallback((emoji: string, callback?: ErrorCallback) => {
    if (!socketRef.current || !currentRoom) return;

    socketRef.current.emit('send_reaction', {
      roomId: currentRoom.id,
      emoji,
    }, callback);
  }, [currentRoom]);

  const sendQuickMessage = useCallback((message: string, callback?: ErrorCallback) => {
    if (!socketRef.current || !currentRoom) return;

    socketRef.current.emit('send_quick_message', {
      roomId: currentRoom.id,
      message,
    }, callback);
  }, [currentRoom]);

  const requestRematch = useCallback((callback?: RoomResponseCallback) => {
    if (!socketRef.current || !currentRoom) return;

    socketRef.current.emit('request_rematch', { roomId: currentRoom.id }, (response) => {
      if (response.success && response.room) {
        const nextRoom = response.room;
        setCurrentRoom(response.room);
        setGameState(null);
        setLeaderboard(null);
        setRematchStatus((previous) => previous ? { ...previous, roomId: nextRoom.id } : previous);
      }
      callback?.(response);
    });
  }, [currentRoom]);

  const value: SocketContextType = {
    socket,
    isConnected,
    currentRoom,
    gameState,
    leaderboard,
    abilityState,
    latestAbilityEffect,
    latestReaction,
    latestQuickMessage,
    rematchStatus,
    error,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    leaveRoom,
    kickPlayer,
    updateSettings,
    updateRoomAccess,
    toggleReady,
    startGame,
    submitWord,
    useAbility,
    sendReaction,
    sendQuickMessage,
    requestRematch,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
