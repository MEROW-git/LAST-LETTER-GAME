'use client';

/**
 * Leaderboard Page
 * 
 * Shows after game ends:
 * - Rankings of all players
 * - Winner highlighted
 * - Stats (valid words, timeouts, longest word)
 * - Navigation buttons
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getPlayerProfile } from '@/utils/localStorage';
import { useSocket } from '@/contexts/SocketContext';

export default function LeaderboardPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  
  const { leaderboard, currentRoom } = useSocket();
  const [isLeaving, setIsLeaving] = useState(false);

  // Check profile
  useEffect(() => {
    const profile = getPlayerProfile();
    if (!profile) {
      router.push('/setup');
    }
  }, [router]);

  // If no leaderboard, redirect to room
  useEffect(() => {
    if (isLeaving) {
      return;
    }

    if (currentRoom?.status === 'playing') {
      router.push(`/game/${roomId}`);
      return;
    }
    if (!leaderboard && currentRoom?.status !== 'ended') {
      router.push(`/room/${roomId}`);
    }
  }, [isLeaving, leaderboard, currentRoom, roomId, router]);

  const handleBackToRoom = () => {
    setIsLeaving(true);
    router.push(`/room/${roomId}`);
  };

  if (!leaderboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Game Over!</h1>
          <p className="text-slate-400">
            {leaderboard.winnerName ? (
              <><span className="text-primary-400 font-semibold">{leaderboard.winnerName}</span> wins!</>
            ) : (
              'No winner'
            )}
          </p>
        </div>

        {/* Winner Banner */}
        {leaderboard.winnerName && (
          <div className="card mb-8 text-center bg-gradient-to-r from-primary-900/50 to-accent-900/50 border-primary-500">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-white mb-1">{leaderboard.winnerName}</h2>
            <p className="text-primary-400 font-semibold">Winner</p>
          </div>
        )}

        {/* Game Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-white">{leaderboard.totalWords}</p>
            <p className="text-slate-400 text-sm">Total Words</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-white">{formatDuration(leaderboard.gameDuration)}</p>
            <p className="text-slate-400 text-sm">Game Duration</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-white">{leaderboard.rankings.length}</p>
            <p className="text-slate-400 text-sm">Players</p>
          </div>
        </div>

        {/* Rankings Table */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Final Rankings</h2>
          <div className="space-y-3">
            {leaderboard.rankings.map((ranking, index) => (
              <div
                key={ranking.playerId}
                className={`flex items-center gap-4 p-4 rounded-xl ${
                  ranking.rank === 1 
                    ? 'bg-primary-900/30 border border-primary-500/30' 
                    : 'bg-slate-800'
                }`}
              >
                {/* Rank */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  ranking.rank === 1 ? 'bg-warning-500 text-white' :
                  ranking.rank === 2 ? 'bg-slate-400 text-white' :
                  ranking.rank === 3 ? 'bg-amber-700 text-white' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {ranking.rank === 1 ? '👑' : ranking.rank}
                </div>

                {/* Player Info */}
                <div className="flex-1">
                  <p className="font-semibold text-white">{ranking.playerName}</p>
                  <p className="text-sm text-slate-400">{ranking.placement}</p>
                </div>

                {/* Stats */}
                <div className="text-right text-sm">
                  <p className="text-slate-400">
                    <span className="text-success-400">{ranking.validWordsSubmitted}</span> words
                  </p>
                  {ranking.longestWord && (
                    <p className="text-slate-500">
                      Longest: <span className="text-primary-400 font-mono">{ranking.longestWord.toUpperCase()}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleBackToRoom}
            className="flex-1 btn btn-primary"
          >
            Back to Room
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 btn btn-secondary"
          >
            Exit to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
