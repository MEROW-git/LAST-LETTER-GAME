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
import { applyMatchResultToProfile, getPlayerProfile } from '@/utils/localStorage';
import { useSocket } from '@/contexts/SocketContext';
import { getRankUpSummary, playFeedbackSound } from '@/lib/gameFeedback';
import { getNextRankThreshold } from '@shared/types';

export default function LeaderboardPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  
  const { leaderboard, currentRoom, requestRematch, rematchStatus } = useSocket();
  const [isLeaving, setIsLeaving] = useState(false);
  const [rankUpState, setRankUpState] = useState<{ previousRank: string; nextRank: string } | null>(null);
  const [rematchMessage, setRematchMessage] = useState<string | null>(null);
  const [rewardSummary, setRewardSummary] = useState<{
    pointsChange: number;
    previousRank: string;
    nextRank: string;
    currentRankPoints: number;
    winStreak: number;
    isWinner: boolean;
  } | null>(null);
  const [animatedPointsChange, setAnimatedPointsChange] = useState(0);

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

  useEffect(() => {
    if (leaderboard) {
      const profileBeforeUpdate = getPlayerProfile();
      const updatedProfile = applyMatchResultToProfile(leaderboard);
      const myRanking = profileBeforeUpdate
        ? leaderboard.rankings.find((ranking) => ranking.playerId === profileBeforeUpdate.id)
        : null;

      if (myRanking && updatedProfile) {
        const rankSummary = getRankUpSummary(myRanking.playerRankPointsBefore, updatedProfile.rankPoints);
        setRewardSummary({
          pointsChange: updatedProfile.rankPoints - myRanking.playerRankPointsBefore,
          previousRank: rankSummary.previousRank,
          nextRank: rankSummary.nextRank,
          currentRankPoints: updatedProfile.rankPoints,
          winStreak: updatedProfile.winStreak,
          isWinner: leaderboard.winnerId === profileBeforeUpdate?.id,
        });
        if (rankSummary.rankedUp) {
          setRankUpState({
            previousRank: rankSummary.previousRank,
            nextRank: rankSummary.nextRank,
          });
          playFeedbackSound('rankUp');
        }
        if (leaderboard.winnerId === profileBeforeUpdate?.id) {
          playFeedbackSound('win');
        } else if (leaderboard.winnerId && leaderboard.winnerId !== profileBeforeUpdate?.id) {
          playFeedbackSound('lose');
        }
      }
    }
  }, [leaderboard]);

  useEffect(() => {
    if (!rewardSummary) {
      setAnimatedPointsChange(0);
      return;
    }

    const target = rewardSummary.pointsChange;
    const durationMs = 900;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      setAnimatedPointsChange(Math.round(target * progress));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    setAnimatedPointsChange(0);
    const frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [rewardSummary]);

  const handleBackToRoom = () => {
    setIsLeaving(true);
    router.push(`/room/${roomId}`);
  };

  const handleRematch = () => {
    requestRematch((response) => {
      if (response.success && response.room) {
        setIsLeaving(true);
        router.push(`/room/${response.room.id}`);
      } else if (response.error) {
        setRematchMessage(response.error);
        setTimeout(() => setRematchMessage(null), 3000);
      }
    });
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
  const profile = getPlayerProfile();
  const isAdmin = currentRoom?.adminPlayerId === profile?.id;
  const acceptedPlayerIds = new Set(rematchStatus?.acceptedPlayerIds ?? []);
  const acceptedCount = currentRoom?.players.filter((player) => acceptedPlayerIds.has(player.id)).length ?? 0;
  const waitingCount = Math.max(0, (currentRoom?.players.length ?? 0) - acceptedCount);
  const hasAcceptedRematch = profile ? acceptedPlayerIds.has(profile.id) : false;
  const strongWordGame = leaderboard.totalWords >= 10;
  const fastFinish = leaderboard.gameDuration > 0 && leaderboard.gameDuration <= 90;
  const fullLobby = leaderboard.rankings.length >= 4;
  const rankOrder = ['Plastic', 'Iron', 'Silver', 'Gold', 'Diamond', 'Master'];
  const confettiPieces = Array.from({ length: 18 }, (_, index) => ({
    id: index,
    left: `${4 + ((index * 93) % 92)}%`,
    delay: `${(index % 6) * 0.12}s`,
    duration: `${3.1 + (index % 5) * 0.28}s`,
    rotate: `${(index % 2 === 0 ? 1 : -1) * (18 + index * 7)}deg`,
    color: ['#facc15', '#38bdf8', '#fb7185', '#4ade80', '#c084fc', '#f59e0b'][index % 6],
  }));
  const nextRankThreshold = rewardSummary ? getNextRankThreshold(rewardSummary.nextRank as typeof rewardSummary.nextRank & Parameters<typeof getNextRankThreshold>[0]) : null;
  const hasAnotherRank = rewardSummary ? rewardSummary.nextRank !== 'Master' : false;
  const nextRankLabel = rewardSummary && hasAnotherRank
    ? rankOrder[Math.min(rankOrder.indexOf(rewardSummary.nextRank) + 1, rankOrder.length - 1)]
    : null;
  const rankingDeltaFor = (playerId: string) => {
    if (rewardSummary && profile?.id === playerId) {
      return rewardSummary.pointsChange;
    }
    if (leaderboard.winnerId === null) {
      return 20;
    }
    return leaderboard.winnerId === playerId ? 100 : -50;
  };
  const placementEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}.`;
  };

  return (
    <div className="min-h-screen p-4 animate-fade-in backdrop-blur-[3px]">
      <div className="mx-auto max-w-7xl animate-fade-in">
        {rankUpState && (
          <div className="mb-6 overflow-hidden rounded-3xl border border-warning-400/60 bg-gradient-to-r from-warning-500/20 via-amber-400/20 to-primary-500/15 p-6 text-center animate-rank-up">
            <div className="text-4xl mb-2">✨</div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-warning-200">Rank Up</p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              {rankUpState.previousRank} to {rankUpState.nextRank}
            </h2>
            <p className="mt-2 text-sm text-warning-100">Your post-match rating pushed you into a new tier.</p>
          </div>
        )}

        {rematchMessage && (
          <div className="mb-6 rounded-xl border border-primary-500/40 bg-primary-500/10 px-4 py-3 text-sm text-primary-100">
            {rematchMessage}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="space-y-6">
            {currentRoom?.status === 'ended' && (
              <div className="rounded-2xl border border-slate-700 bg-slate-950/80 px-5 py-4 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Rematch Flow</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {acceptedCount > 0 ? 'Waiting for players to accept...' : 'Start a rematch vote for the next round.'}
                    </p>
                  </div>
                  <div className="rounded-full border border-primary-400/30 bg-primary-500/10 px-3 py-1 text-sm font-semibold text-primary-200">
                    {acceptedCount} accepted
                    {waitingCount > 0 ? ` • ${waitingCount} waiting` : ' • ready to start'}
                  </div>
                </div>
                {currentRoom.players.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {currentRoom.players.map((player) => {
                      const accepted = acceptedPlayerIds.has(player.id);
                      return (
                        <div key={player.id} className={`rounded-2xl border px-4 py-3 ${accepted ? 'border-success-500/40 bg-success-500/10' : 'border-slate-700 bg-slate-900/60'}`}>
                          <p className="font-semibold text-white">{player.name}</p>
                          <p className={`mt-1 text-sm ${accepted ? 'text-success-300' : 'text-slate-400'}`}>
                            {accepted ? 'Accepted rematch' : 'Waiting for response'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </aside>

          <div className="space-y-6">
            {leaderboard.winnerName && (
              <div className="card relative overflow-hidden text-center bg-gradient-to-r from-primary-900/60 via-slate-900/80 to-accent-900/50 border-primary-500 glow-primary animate-scale-in">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {confettiPieces.map((piece) => (
                    <span
                      key={piece.id}
                      className="leaderboard-confetti"
                      style={{
                        left: piece.left,
                        animationDelay: piece.delay,
                        animationDuration: piece.duration,
                        backgroundColor: piece.color,
                        ['--confetti-rotate' as string]: piece.rotate,
                      }}
                    />
                  ))}
                </div>
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-3xl font-bold text-white mb-1">{leaderboard.winnerName} wins!</h2>
                {rewardSummary && (
                  <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-warning-400/35 bg-slate-950/85 px-5 py-4 text-left shadow-[0_18px_40px_rgba(15,23,42,0.45)]">
                    <div className="grid gap-2 text-base text-slate-100">
                      <p>{animatedPointsChange >= 0 ? '+' : ''}{animatedPointsChange} Points 🎉</p>
                      <p>
                        {rewardSummary.previousRank === rewardSummary.nextRank
                          ? `Rank: ${rewardSummary.nextRank}`
                          : `Rank: ${rewardSummary.previousRank} → ${rewardSummary.nextRank} 🔥`}
                      </p>
                      <p>Win Streak: {rewardSummary.winStreak}</p>
                    </div>
                    {nextRankThreshold && (
                      <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
                        <p className="text-sm font-semibold text-white">
                          {hasAnotherRank ? `Next Rank: ${nextRankLabel}` : 'Top Rank Reached'}
                        </p>
                        {hasAnotherRank && (
                          <>
                            <p className="mt-1 text-sm text-slate-300">
                              {rewardSummary.currentRankPoints} / {nextRankThreshold}
                            </p>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-warning-400 to-primary-400"
                                style={{ width: `${Math.min(100, (rewardSummary.currentRankPoints / nextRankThreshold) * 100)}%` }}
                              ></div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-4">Final Ranking</h2>
              <div className="space-y-3">
                {leaderboard.rankings.map((ranking) => (
                  <div
                    key={ranking.playerId}
                    className={`flex items-center gap-4 p-4 rounded-xl ${
                      ranking.rank === 1 ? 'bg-primary-900/30 border border-primary-500/30' : 'bg-slate-800'
                    }`}
                  >
                    <div className="w-12 text-2xl">{placementEmoji(ranking.rank)}</div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{ranking.playerName}</p>
                    </div>
                    <div className={`text-right text-sm font-semibold ${rankingDeltaFor(ranking.playerId) >= 0 ? 'text-success-300' : 'text-danger-300'}`}>
                      {rankingDeltaFor(ranking.playerId) >= 0 ? '+' : ''}{rankingDeltaFor(ranking.playerId)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="card">
              <h3 className="text-xl font-semibold text-white">Match Stats</h3>
              <div className="mt-4 space-y-4">
                <div className={`rounded-2xl border px-4 py-4 ${strongWordGame ? 'border-success-400/40 bg-success-500/10' : 'border-slate-700 bg-slate-900/60'}`}>
                  <p className="text-sm font-semibold text-slate-300">🧠 Words</p>
                  <p className={`mt-2 text-2xl font-bold ${strongWordGame ? 'text-success-300' : 'text-white'}`}>{leaderboard.totalWords}</p>
                </div>
                <div className={`rounded-2xl border px-4 py-4 ${fastFinish ? 'border-warning-400/40 bg-warning-500/10' : 'border-slate-700 bg-slate-900/60'}`}>
                  <p className="text-sm font-semibold text-slate-300">⏱ Duration</p>
                  <p className={`mt-2 text-2xl font-bold ${fastFinish ? 'text-warning-200' : 'text-white'}`}>{leaderboard.gameDuration}s</p>
                </div>
                <div className={`rounded-2xl border px-4 py-4 ${fullLobby ? 'border-primary-400/40 bg-primary-500/10' : 'border-slate-700 bg-slate-900/60'}`}>
                  <p className="text-sm font-semibold text-slate-300">👥 Players</p>
                  <p className={`mt-2 text-2xl font-bold ${fullLobby ? 'text-primary-300' : 'text-white'}`}>{leaderboard.rankings.length}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button onClick={handleRematch} className="w-full btn btn-success">
                {hasAcceptedRematch ? '🔄 Accepted' : isAdmin ? '🔄 Start Rematch' : '🔄 Accept Rematch'}
              </button>
              <button onClick={handleBackToRoom} className="w-full btn btn-primary">
                🏠 Room
              </button>
              <button onClick={() => router.push('/')} className="w-full btn btn-secondary">
                ❌ Exit
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
