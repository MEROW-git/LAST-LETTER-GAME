'use client';

/**
 * Room Page
 * 
 * Features:
 * - Room info (name, code)
 * - Player list with ready status
 * - Admin controls (kick, settings, start game)
 * - Ready/unready toggle
 * - Leave room
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getPlayerProfile } from '@/utils/localStorage';
import { useSocket } from '@/contexts/SocketContext';
import { useDialog } from '@/contexts/DialogContext';
import type { Player, RoomSettings } from '@shared/types';

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  
  const { 
    currentRoom, 
    isConnected, 
    leaveRoom, 
    kickPlayer, 
    updateSettings, 
    toggleReady, 
    startGame 
  } = useSocket();
  const { showConfirm } = useDialog();
  
  const [profile, setProfile] = useState(getPlayerProfile());
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>({ maxPlayers: 15, timeLimit: 15 });
  const [error, setError] = useState<string | null>(null);

  // Check profile
  useEffect(() => {
    if (!profile) {
      router.push('/setup');
    }
  }, [profile, router]);

  useEffect(() => {
    if (!currentRoom) {
      router.push('/lobby');
      return;
    }

    if (currentRoom.id !== roomId) {
      router.push(currentRoom.status === 'playing' ? `/game/${currentRoom.id}` : `/room/${currentRoom.id}`);
    }
  }, [currentRoom, roomId, router]);

  // Sync settings with room
  useEffect(() => {
    if (currentRoom) {
      setSettings(currentRoom.settings);
    }
  }, [currentRoom]);

  // Redirect to game if game starts
  useEffect(() => {
    if (currentRoom?.status === 'playing') {
      router.push(`/game/${roomId}`);
    }
  }, [currentRoom?.status, roomId, router]);

  const handleLeaveRoom = () => {
    leaveRoom(() => {
      router.push('/lobby');
    });
  };

  const handleKickPlayer = async (playerId: string) => {
    const confirmed = await showConfirm('Are you sure you want to kick this player?', {
      title: 'Kick Player',
      confirmLabel: 'Kick Player',
      cancelLabel: 'Keep Player',
    });

    if (confirmed) {
      kickPlayer(playerId);
    }
  };

  const handleUpdateSettings = () => {
    updateSettings(settings, (response) => {
      if (response?.success) {
        setShowSettings(false);
      } else if (response?.error) {
        setError(response.error);
      }
    });
  };

  const handleStartGame = () => {
    startGame((response) => {
      if (response?.error) {
        setError(response.error);
      }
    });
  };

  const handleToggleReady = () => {
    toggleReady();
  };

  if (!profile || !currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const isAdmin = currentRoom.adminPlayerId === profile.id;
  const currentPlayer = currentRoom.players.find(p => p.id === profile.id);
  const allPlayersReady = currentRoom.players.every(p => p.isReady || p.isAdmin);
  const canStart = isAdmin && allPlayersReady && currentRoom.players.length >= 2;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleLeaveRoom}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Leave
          </button>
          <h1 className="text-2xl font-bold gradient-text">{currentRoom.roomName}</h1>
          <div className="w-16"></div>
        </div>

        {/* Room Code & Info */}
        <div className="card mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-slate-400 text-sm">Room Code</p>
              <p className="text-3xl font-mono font-bold text-primary-400 tracking-widest">
                {currentRoom.roomCode}
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-slate-400 text-sm">Players</p>
                <p className="text-xl font-semibold text-white">
                  {currentRoom.players.length}/{currentRoom.settings.maxPlayers}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-sm">Time Limit</p>
                <p className="text-xl font-semibold text-white">
                  {currentRoom.settings.timeLimit}s
                </p>
              </div>
            </div>
          </div>
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

        {/* Admin Controls */}
        {isAdmin && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setShowSettings(true)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className="btn btn-success flex-1 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Game
            </button>
          </div>
        )}

        {/* Player List */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">
            Players ({currentRoom.players.length})
          </h2>
          <div className="space-y-3">
            {currentRoom.players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isAdmin={isAdmin}
                isCurrentUser={player.id === profile.id}
                onKick={() => handleKickPlayer(player.id)}
              />
            ))}
          </div>
        </div>

        {/* Ready Button (non-admin) */}
        {!isAdmin && (
          <div className="mt-6">
            <button
              onClick={handleToggleReady}
              className={`w-full btn text-lg py-4 ${
                currentPlayer?.isReady ? 'btn-danger' : 'btn-success'
              }`}
            >
              {currentPlayer?.isReady ? 'Not Ready' : 'Ready'}
            </button>
          </div>
        )}

        {/* Waiting message */}
        {!isAdmin && !currentPlayer?.isReady && (
          <p className="text-center text-warning-400 mt-4">
            Click Ready when you&apos;re prepared to play!
          </p>
        )}

        {isAdmin && !allPlayersReady && (
          <p className="text-center text-slate-400 mt-4">
            Waiting for all players to be ready...
          </p>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="card max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Room Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Max Players: {settings.maxPlayers}
                </label>
                <input
                  type="range"
                  min={2}
                  max={15}
                  value={settings.maxPlayers}
                  onChange={(e) => setSettings(s => ({ ...s, maxPlayers: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>2</span>
                  <span>15</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Time Limit: {settings.timeLimit} seconds
                </label>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={5}
                  value={settings.timeLimit}
                  onChange={(e) => setSettings(s => ({ ...s, timeLimit: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>5s</span>
                  <span>30s</span>
                </div>
              </div>

              <button
                onClick={handleUpdateSettings}
                className="w-full btn btn-primary"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Player Card Component
function PlayerCard({ 
  player, 
  isAdmin, 
  isCurrentUser, 
  onKick 
}: { 
  player: Player; 
  isAdmin: boolean; 
  isCurrentUser: boolean;
  onKick: () => void;
}) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl ${
      isCurrentUser ? 'bg-primary-900/30 border border-primary-500/30' : 'bg-slate-800'
    }`}>
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
        {player.profileImage ? (
          <img src={player.profileImage} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl">👤</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{player.name}</span>
          {player.isAdmin && (
            <span className="px-2 py-0.5 bg-warning-600 text-white text-xs rounded-full">
              Admin
            </span>
          )}
          {isCurrentUser && (
            <span className="px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-2 h-2 rounded-full ${player.isConnected ? 'bg-success-500' : 'bg-slate-500'}`}></span>
          <span className="text-xs text-slate-400">
            {player.isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Ready Status */}
      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
        player.isReady 
          ? 'bg-success-600/30 text-success-400' 
          : 'bg-slate-700 text-slate-400'
      }`}>
        {player.isReady ? 'Ready' : 'Not Ready'}
      </div>

      {/* Kick Button (admin only, not for self) */}
      {isAdmin && !player.isAdmin && (
        <button
          onClick={onKick}
          className="text-danger-400 hover:text-danger-300 p-2"
          title="Kick player"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
