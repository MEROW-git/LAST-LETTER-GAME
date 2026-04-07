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
import type { RoomSummary } from '@shared/types';

const LOBBY_NOTICE_STORAGE_KEY = 'last_letter_lobby_notice';

export default function LobbyPage() {
  const router = useRouter();
  const { createRoom, joinRoom, isConnected } = useSocket();
  
  const [activeTab, setActiveTab] = useState<'join' | 'create' | 'list'>('list');
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
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

    setIsLoading(true);
    
    createRoom(roomName.trim(), (response) => {
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
    
    joinRoom(roomCode.trim().toUpperCase(), (response) => {
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
    
    joinRoom(code, (response) => {
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
                <h2 className="text-xl font-semibold text-white">Available Rooms</h2>
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
                        <h3 className="font-semibold text-white">{room.roomName}</h3>
                        <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
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
                        onClick={() => handleJoinFromList(room.roomCode)}
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
                <button
                  type="submit"
                  disabled={isLoading || !roomName.trim()}
                  className="w-full btn btn-success"
                >
                  {isLoading ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
