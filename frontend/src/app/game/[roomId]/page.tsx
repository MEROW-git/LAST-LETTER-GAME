'use client';

/**
 * In-Game Page
 * 
 * Features:
 * - Current word display
 * - Required starting letter
 * - Current player turn indicator
 * - Countdown timer
 * - Word input
 * - Used words list
 * - Player list with alive/eliminated status
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getPlayerProfile } from '@/utils/localStorage';
import { useSocket } from '@/contexts/SocketContext';

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const wordInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    currentRoom, 
    gameState, 
    leaderboard,
    submitWord, 
    leaveRoom,
    isConnected 
  } = useSocket();
  
  const [profile, setProfile] = useState(getPlayerProfile());
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showUsedWords, setShowUsedWords] = useState(false);

  // Check profile and redirect if needed
  useEffect(() => {
    if (!profile) {
      router.push('/setup');
      return;
    }

    // If game ended, redirect to leaderboard
    if (leaderboard) {
      router.push(`/leaderboard/${roomId}`);
      return;
    }

    // If not in playing state and no game state, redirect to room
    if (currentRoom?.status !== 'playing' && !gameState) {
      router.push(`/room/${roomId}`);
    }
  }, [profile, currentRoom, gameState, leaderboard, roomId, router]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (!currentRoom && !gameState) {
      router.push('/lobby');
    }
  }, [profile, currentRoom, gameState, router]);

  // Focus input when it's player's turn
  useEffect(() => {
    if (gameState?.currentPlayerId === profile?.id) {
      wordInputRef.current?.focus();
    }
  }, [gameState?.currentPlayerId, profile?.id]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!word.trim()) return;

    submitWord(word.trim(), (response) => {
      if (response?.success) {
        setWord('');
      } else if (response?.error) {
        setError(response.error);
        setTimeout(() => setError(null), 3000);
      }
    });
  }, [word, submitWord]);

  const handleLeaveGame = () => {
    if (confirm('Are you sure you want to leave the game? You will be eliminated.')) {
      leaveRoom(() => {
        router.push('/lobby');
      });
    }
  };

  if (!profile || !gameState || !currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const isMyTurn = gameState.currentPlayerId === profile.id;
  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
  const me = gameState.players.find(p => p.id === profile.id);
  const amEliminated = me?.isEliminated || false;

  // Calculate timer percentage
  const timerPercentage = (gameState.timeRemaining / gameState.totalTime) * 100;
  const timerColor = timerPercentage > 50 ? 'bg-success-500' : timerPercentage > 25 ? 'bg-warning-500' : 'bg-danger-500';

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleLeaveGame}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Leave
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">{currentRoom.roomName}</h1>
            <p className="text-slate-400 text-sm">Room: {currentRoom.roomCode}</p>
          </div>
          <div className="w-16"></div>
        </div>

        {/* Game Status */}
        {amEliminated ? (
          <div className="bg-danger-900/50 border border-danger-500 rounded-xl p-4 mb-6 text-center">
            <p className="text-danger-200 font-semibold">You have been eliminated!</p>
            <p className="text-danger-300 text-sm mt-1">Watch the game or leave to lobby</p>
          </div>
        ) : (
          <div className={`rounded-xl p-4 mb-6 text-center ${
            isMyTurn 
              ? 'bg-primary-900/50 border border-primary-500' 
              : 'bg-slate-800 border border-slate-700'
          }`}>
            <p className="text-slate-400 text-sm">
              {isMyTurn ? "It's your turn!" : "Current Turn"}
            </p>
            <p className={`text-2xl font-bold ${isMyTurn ? 'text-primary-400' : 'text-white'}`}>
              {currentPlayer?.name || 'Unknown'}
            </p>
          </div>
        )}

        {/* Timer Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Time Remaining</span>
            <span className={`font-mono font-bold ${
              gameState.timeRemaining <= 5 ? 'text-danger-400' : 'text-white'
            }`}>
              {gameState.timeRemaining}s
            </span>
          </div>
          <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-linear ${timerColor}`}
              style={{ width: `${timerPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Current Word Display */}
        <div className="card mb-6 text-center">
          <p className="text-slate-400 text-sm mb-2">Current Word</p>
          <div className="text-4xl md:text-5xl font-bold text-white mb-4">
            {gameState.currentWord ? (
              <span className="font-mono tracking-wider">{gameState.currentWord.toUpperCase()}</span>
            ) : (
              <span className="text-slate-600 italic">No word yet</span>
            )}
          </div>
          
          {gameState.requiredLetter && (
            <div className="inline-flex items-center gap-2 bg-accent-900/50 border border-accent-500 rounded-full px-6 py-3">
              <span className="text-slate-400">Next word must start with:</span>
              <span className="text-3xl font-bold text-accent-400 font-mono">
                {gameState.requiredLetter.toUpperCase()}
              </span>
            </div>
          )}
          
          {!gameState.requiredLetter && !amEliminated && (
            <p className="text-primary-400">
              First player can enter any word!
            </p>
          )}
        </div>

        {/* Word Input */}
        {isMyTurn && !amEliminated && (
          <form onSubmit={handleSubmit} className="mb-6">
            {error && (
              <div className="bg-danger-900/50 border border-danger-500 rounded-lg p-3 mb-4 flex items-center gap-2 animate-shake">
                <svg className="w-5 h-5 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-danger-200 text-sm">{error}</span>
              </div>
            )}
            
            <div className="flex gap-2">
              <input
                ref={wordInputRef}
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value.toLowerCase())}
                placeholder={gameState.requiredLetter 
                  ? `Enter word starting with ${gameState.requiredLetter.toUpperCase()}...` 
                  : 'Enter any word...'
                }
                className="flex-1 input text-lg py-4"
                autoFocus
              />
              <button
                type="submit"
                disabled={!word.trim()}
                className="btn btn-primary px-8"
              >
                Submit
              </button>
            </div>
          </form>
        )}

        {/* Player List */}
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Players</h2>
            <span className="text-slate-400 text-sm">
              {gameState.players.filter(p => !p.isEliminated).length} alive
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {gameState.players.map((player) => (
              <div
                key={player.id}
                className={`p-3 rounded-xl text-center ${
                  player.isEliminated 
                    ? 'bg-slate-800/50 opacity-50' 
                    : player.id === gameState.currentPlayerId
                      ? 'bg-primary-900/50 border border-primary-500'
                      : 'bg-slate-800'
                }`}
              >
                <div className="w-10 h-10 mx-auto rounded-full bg-slate-700 flex items-center justify-center mb-2">
                  {player.profileImage ? (
                    <img src={player.profileImage} alt={player.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span>👤</span>
                  )}
                </div>
                <p className={`text-sm font-medium truncate ${
                  player.isEliminated ? 'text-slate-500 line-through' : 'text-white'
                }`}>
                  {player.name}
                </p>
                {player.isEliminated && (
                  <span className="text-xs text-danger-400">Eliminated</span>
                )}
                {player.id === profile.id && (
                  <span className="text-xs text-primary-400">You</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Used Words Toggle */}
        <button
          onClick={() => setShowUsedWords(!showUsedWords)}
          className="w-full btn btn-secondary flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {showUsedWords ? 'Hide' : 'Show'} Used Words ({gameState.usedWords.length})
        </button>

        {/* Used Words List */}
        {showUsedWords && (
          <div className="card mt-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Used Words</h3>
            {gameState.usedWords.length === 0 ? (
              <p className="text-slate-500 text-sm">No words used yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {gameState.usedWords.map((usedWord, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-slate-800 rounded-full text-sm text-slate-300 font-mono"
                  >
                    {usedWord.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
