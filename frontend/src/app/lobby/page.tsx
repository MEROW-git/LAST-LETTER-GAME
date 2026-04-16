'use client';

/**
 * Lobby Page
 * 
 * Features:
 * - Create new room
 * - Join room by code
 * - List of available rooms
 * - Room status info
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPlayerProfile } from '@/utils/localStorage';
import { useSocket } from '@/contexts/SocketContext';
import type { AIDifficulty, GameMode, RoomSummary } from '@shared/types';

const LOBBY_NOTICE_STORAGE_KEY = 'last_letter_lobby_notice';

export default function LobbyPage() {
  const router = useRouter();
  const { createRoom, joinRoom, isConnected } = useSocket();
  
  const [activeTab, setActiveTab] = useState<'join' | 'create' | 'list'>('list');
  const [roomCode, setRoomCode] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [roomName, setRoomName] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('multiplayer');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('easy');
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [createRoomPassword, setCreateRoomPassword] = useState('');
  const [availableRooms, setAvailableRooms] = useState<RoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check profile and fetch rooms
  useEffect(() => {
    const profile = getPlayerProfile();
    if (!profile) {
      router.push('/setup');
      return;
    }

    if (typeof window !== 'undefined') {
      const lobbyNotice = sessionStorage.getItem(LOBBY_NOTICE_STORAGE_KEY);
      if (lobbyNotice) {
        setError(lobbyNotice);
        sessionStorage.removeItem(LOBBY_NOTICE_STORAGE_KEY);
      }
    }

    fetchRooms();
    
    // Refresh rooms every 5 seconds
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');
    const inviteRoomCode = params.get('room');

    if (!inviteToken || !inviteRoomCode || !isConnected) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setActiveTab('join');

    joinRoom({ roomCode: inviteRoomCode, inviteToken }, (response) => {
      setIsLoading(false);

      if (response.success && response.room) {
        router.replace(`/room/${response.room.id}`);
      } else {
        setError(response.error || 'Failed to join from invite');
      }
    });
  }, [isConnected, joinRoom, router]);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await fetch('/api/rooms');
      const data = await response.json();
      if (data.success) {
        setAvailableRooms(data.data.rooms);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }

    if (gameMode === 'multiplayer' && isPrivateRoom && (createRoomPassword.trim().length < 4 || createRoomPassword.trim().length > 32)) {
      setError('Private room password must be between 4 and 32 characters');
      return;
    }

    setIsLoading(true);
    
    createRoom({
      roomName: roomName.trim(),
      gameMode,
      aiDifficulty: gameMode === 'single_player' ? aiDifficulty : undefined,
      isPrivate: gameMode === 'multiplayer' ? isPrivateRoom : false,
      password: gameMode === 'multiplayer' && isPrivateRoom ? createRoomPassword.trim() : undefined,
    }, (response) => {
      setIsLoading(false);
      
      if (response.success && response.room) {
        router.push(`/room/${response.room.id}`);
      } else {
        setError(response.error || 'Failed to create room');
      }
    });
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsLoading(true);
    
    joinRoom({
      roomCode: roomCode.trim().toUpperCase(),
      password: roomPassword.trim() || undefined,
    }, (response) => {
      setIsLoading(false);
      
      if (response.success && response.room) {
        router.push(`/room/${response.room.id}`);
      } else {
        setError(response.error || 'Failed to join room');
      }
    });
  };

  const handleJoinFromList = (code: string) => {
    setError(null);
    setIsLoading(true);
    
    joinRoom({ roomCode: code }, (response) => {
      setIsLoading(false);
      
      if (response.success && response.room) {
        router.push(`/room/${response.room.id}`);
      } else {
        setError(response.error || 'Failed to join room');
      }
    });
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold gradient-text">Game Lobby</h1>
          <div className="w-16"></div>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="bg-warning-900/50 border border-warning-500 rounded-lg p-3 mb-6 flex items-center gap-2">
            <div className="w-2 h-2 bg-warning-500 rounded-full animate-pulse"></div>
            <span className="text-warning-200 text-sm">Connecting to server...</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['list', 'join', 'create'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setError(null);
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {tab === 'list' ? 'Room List' : tab}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-danger-900/50 border border-danger-500 rounded-lg p-3 mb-6 flex items-center gap-2 animate-shake">
            <svg className="w-5 h-5 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-danger-200 text-sm">{error}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="card">
          {activeTab === 'list' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Room List</h2>
                <button
                  onClick={fetchRooms}
                  className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>

              {availableRooms.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏠</div>
                  <p className="text-slate-400 mb-2">No rooms available</p>
                  <p className="text-slate-500 text-sm">Create a new room or check back later!</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {availableRooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-slate-800 rounded-xl p-4 flex items-center justify-between hover:bg-slate-750 transition-colors"
                    >
                      <div>
                        <h3 className="font-semibold text-white">
                          {room.isPrivate ? '🔒 ' : ''}{room.roomName}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                          <span>{room.isPrivate ? 'Private room' : 'Public room'}</span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            {room.currentPlayers}/{room.maxPlayers}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {room.timeLimit}s
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {room.adminName}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (room.isPrivate) {
                            const password = window.prompt(`Enter password for ${room.roomName}`);
                            if (password === null) {
                              return;
                            }
                            setError(null);
                            setIsLoading(true);
                            joinRoom({ roomCode: room.roomCode, password }, (response) => {
                              setIsLoading(false);

                              if (response.success && response.room) {
                                router.push(`/room/${response.room.id}`);
                              } else {
                                setError(response.error || 'Failed to join room');
                              }
                            });
                            return;
                          }

                          handleJoinFromList(room.roomCode);
                        }}
                        disabled={isLoading || room.currentPlayers >= room.maxPlayers}
                        className="btn btn-primary px-4 py-2"
                      >
                        {isLoading ? 'Joining...' : 'Join'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'join' && (
            <form onSubmit={handleJoinRoom}>
              <h2 className="text-xl font-semibold text-white mb-4">Join Room</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Room Code
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-character room code"
                    className="input text-center text-2xl tracking-widest uppercase"
                    maxLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    placeholder="Enter password for private rooms"
                    className="input"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Invite links skip this automatically.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || roomCode.length !== 6}
                  className="w-full btn btn-primary"
                >
                  {isLoading ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleCreateRoom}>
              <h2 className="text-xl font-semibold text-white mb-4">Create Room</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Game Mode
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      { value: 'multiplayer', label: 'Multiplayer', description: 'Create a room friends can join.' },
                      { value: 'single_player', label: 'Single Player', description: 'Play against an AI opponent.' },
                    ] as const).map((modeOption) => (
                      <button
                        key={modeOption.value}
                        type="button"
                        onClick={() => setGameMode(modeOption.value)}
                        className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                          gameMode === modeOption.value
                            ? 'border-primary-400 bg-primary-500/12 shadow-[0_0_20px_rgba(56,189,248,0.12)]'
                            : 'border-slate-700 bg-slate-800/50 hover:border-primary-500/60'
                        }`}
                      >
                        <p className="font-semibold text-white">{modeOption.label}</p>
                        <p className="mt-1 text-sm text-slate-400">{modeOption.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {gameMode === 'single_player' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      AI Difficulty
                    </label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {([
                        { value: 'easy', label: 'Easy', description: 'Slower, simpler words, occasional mistakes.' },
                        { value: 'medium', label: 'Medium', description: 'Sharper choices with quicker turns.' },
                        { value: 'hard', label: 'Hard', description: 'Fast, stronger words, very few mistakes.' },
                      ] as const).map((difficultyOption) => (
                        <button
                          key={difficultyOption.value}
                          type="button"
                          onClick={() => setAiDifficulty(difficultyOption.value)}
                          className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                            aiDifficulty === difficultyOption.value
                              ? 'border-warning-400 bg-warning-500/10 shadow-[0_0_20px_rgba(251,146,60,0.12)]'
                              : 'border-slate-700 bg-slate-800/50 hover:border-warning-500/60'
                          }`}
                        >
                          <p className="font-semibold text-white">{difficultyOption.label}</p>
                          <p className="mt-1 text-xs text-slate-400">{difficultyOption.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Room Name
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Enter room name"
                    className="input"
                    maxLength={30}
                  />
                </div>
                {gameMode === 'multiplayer' ? (
                  <>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isPrivateRoom}
                        onChange={(e) => setIsPrivateRoom(e.target.checked)}
                        className="h-4 w-4 accent-sky-500"
                      />
                      <div>
                        <p className="font-medium text-white">Private room</p>
                        <p className="text-sm text-slate-400">Manual joins need a password, invite links do not.</p>
                      </div>
                    </label>
                    {isPrivateRoom && (
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Room Password
                        </label>
                        <input
                          type="password"
                          value={createRoomPassword}
                          onChange={(e) => setCreateRoomPassword(e.target.value)}
                          placeholder="4 to 32 characters"
                          className="input"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-sm text-slate-300">
                    Single Player rooms are private to you and the AI opponent.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isLoading || !roomName.trim()}
                  className="w-full btn btn-success"
                >
                  {isLoading ? 'Creating...' : gameMode === 'single_player' ? 'Create Solo Match' : 'Create Room'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
