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
import { playFeedbackSound } from '@/lib/gameFeedback';

type MatchBurst = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  dx: number;
  dy: number;
  duration: number;
};

type SocialToast = {
  id: string;
  kind: 'reaction' | 'message';
  playerName: string;
  emoji?: string;
  message?: string;
};

const REACTION_OPTIONS = ['🔥', '😂', '👏', '😮', '😈', '💯'] as const;
const QUICK_MESSAGE_OPTIONS = ['Nice move', 'Hurry up', 'Good game'] as const;

const ABILITY_CONFIG = [
  {
    key: 'time_freeze',
    label: 'Time Freeze',
    emoji: '⏳',
    description: 'Pause the timer for 4 seconds',
    needsTarget: false,
  },
  {
    key: 'letter_change',
    label: 'Letter Change',
    emoji: '🔄',
    description: 'Change the required letter',
    needsTarget: false,
  },
  {
    key: 'hint_boost',
    label: 'Hint Boost',
    emoji: '💡',
    description: 'Suggest up to 2 valid words',
    needsTarget: false,
  },
  {
    key: 'block_opponent',
    label: 'Block Opponent',
    emoji: '🚫',
    description: 'Stop a target using abilities for one turn',
    needsTarget: true,
  },
  {
    key: 'reverse_chain',
    label: 'Reverse Chain',
    emoji: '↩️',
    description: 'Use the first letter rule for the next chain',
    needsTarget: false,
  },
  {
    key: 'skip_turn_attack',
    label: 'Skip Turn',
    emoji: '💥',
    description: 'Make a target lose their next turn',
    needsTarget: true,
  },
] as const;

const ABILITY_EFFECT_STYLES: Record<(typeof ABILITY_CONFIG)[number]['key'], { label: string; bannerClass: string; particleColors: string[] }> = {
  time_freeze: {
    label: 'Freeze Field',
    bannerClass: 'border-cyan-400/50 bg-cyan-400/10 text-cyan-100',
    particleColors: ['#67e8f9', '#a5f3fc', '#dbeafe'],
  },
  letter_change: {
    label: 'Letter Flux',
    bannerClass: 'border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-100',
    particleColors: ['#f0abfc', '#f5d0fe', '#fdba74'],
  },
  hint_boost: {
    label: 'Insight Spark',
    bannerClass: 'border-amber-400/50 bg-amber-400/10 text-amber-100',
    particleColors: ['#fde68a', '#fcd34d', '#fef3c7'],
  },
  block_opponent: {
    label: 'Seal Cast',
    bannerClass: 'border-rose-400/50 bg-rose-400/10 text-rose-100',
    particleColors: ['#fb7185', '#fecdd3', '#fda4af'],
  },
  reverse_chain: {
    label: 'Chain Flip',
    bannerClass: 'border-violet-400/50 bg-violet-400/10 text-violet-100',
    particleColors: ['#c4b5fd', '#ddd6fe', '#a78bfa'],
  },
  skip_turn_attack: {
    label: 'Impact Burst',
    bannerClass: 'border-orange-400/50 bg-orange-400/10 text-orange-100',
    particleColors: ['#fb923c', '#fdba74', '#fed7aa'],
  },
};

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const wordInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    currentRoom, 
    gameState, 
    leaderboard,
    abilityState,
    latestAbilityEffect,
    latestReaction,
    latestQuickMessage,
    submitWord, 
    useAbility,
    sendReaction,
    sendQuickMessage,
    leaveRoom,
    isConnected 
  } = useSocket();
  
  const [profile, setProfile] = useState(getPlayerProfile());
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showUsedWords, setShowUsedWords] = useState(false);
  const [abilityHints, setAbilityHints] = useState<string[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [effectBanner, setEffectBanner] = useState<string | null>(null);
  const [socialToasts, setSocialToasts] = useState<SocialToast[]>([]);
  const [turnAnimationKey, setTurnAnimationKey] = useState(0);
  const [turnAnnouncement, setTurnAnnouncement] = useState<string | null>(null);
  const [countdownPulse, setCountdownPulse] = useState(false);
  const [activeAbilityCast, setActiveAbilityCast] = useState<string | null>(null);
  const [wordCelebrationKey, setWordCelebrationKey] = useState(0);
  const [screenShakeKey, setScreenShakeKey] = useState(0);
  const [bursts, setBursts] = useState<MatchBurst[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const previousTurnPlayerIdRef = useRef<string | null>(null);
  const lastCountdownSecondRef = useRef<number | null>(null);
  const burstIdRef = useRef(0);

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

  const triggerScreenShake = useCallback(() => {
    setScreenShakeKey((value) => value + 1);
  }, []);

  const spawnBurst = useCallback((x: number, y: number, colors: string[], count = 12) => {
    const nextBurst = Array.from({ length: count }, (_, index) => {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.35;
      const speed = 42 + Math.random() * 62;
      return {
        id: burstIdRef.current++,
        x,
        y,
        size: 5 + Math.random() * 8,
        color: colors[index % colors.length],
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        duration: 650 + Math.random() * 350,
      };
    });

    setBursts((current) => [...current, ...nextBurst]);
    const longestDuration = Math.max(...nextBurst.map((burst) => burst.duration));
    window.setTimeout(() => {
      setBursts((current) => current.filter((burst) => !nextBurst.some((createdBurst) => createdBurst.id === burst.id)));
    }, longestDuration + 80);
  }, []);

  useEffect(() => {
    if (!latestAbilityEffect) return;

    let message = `${latestAbilityEffect.actorPlayerName} used ${latestAbilityEffect.ability.replace(/_/g, ' ')}`;
    if (latestAbilityEffect.targetPlayerName) {
      message += ` on ${latestAbilityEffect.targetPlayerName}`;
    }
    if (latestAbilityEffect.newRequiredLetter) {
      message += ` and changed the letter to ${latestAbilityEffect.newRequiredLetter}`;
    }
    if (latestAbilityEffect.chainDirection === 'first') {
      message += '. Next word follows the first-letter rule';
    }

    setEffectBanner(message);
    setActiveAbilityCast(latestAbilityEffect.ability);
    playFeedbackSound('ability');
    spawnBurst(50, 28, ABILITY_EFFECT_STYLES[latestAbilityEffect.ability].particleColors, 14);
    if (latestAbilityEffect.ability === 'block_opponent' || latestAbilityEffect.ability === 'skip_turn_attack') {
      triggerScreenShake();
    }
    const castTimeout = window.setTimeout(() => setActiveAbilityCast(null), 850);
    const timeout = window.setTimeout(() => setEffectBanner(null), 10000);
    return () => {
      window.clearTimeout(castTimeout);
      window.clearTimeout(timeout);
    };
  }, [latestAbilityEffect, spawnBurst, triggerScreenShake]);

  useEffect(() => {
    const currentTurnPlayerId = gameState?.currentPlayerId ?? null;
    if (!currentTurnPlayerId) return;

    const previousTurnPlayerId = previousTurnPlayerIdRef.current;
    if (previousTurnPlayerId === currentTurnPlayerId) {
      return;
    }

    previousTurnPlayerIdRef.current = currentTurnPlayerId;
    setTurnAnimationKey((value) => value + 1);

    if (currentTurnPlayerId === profile?.id) {
      setTurnAnnouncement('Your turn');
      playFeedbackSound('turn');
      const timeout = window.setTimeout(() => setTurnAnnouncement(null), 1800);
      return () => window.clearTimeout(timeout);
    }

    setTurnAnnouncement(null);
    return undefined;
  }, [gameState?.currentPlayerId, profile?.id]);

  useEffect(() => {
    if (!gameState?.currentPlayerId || !profile) return;

    const isActivePlayerTurn = gameState.currentPlayerId === profile.id;
    const lowTime = gameState.timeRemaining <= 5 && gameState.timeRemaining > 0;

    setCountdownPulse(isActivePlayerTurn && lowTime);

    if (!isActivePlayerTurn || !lowTime) {
      lastCountdownSecondRef.current = null;
      return;
    }

    if (lastCountdownSecondRef.current !== gameState.timeRemaining) {
      lastCountdownSecondRef.current = gameState.timeRemaining;
      playFeedbackSound('countdown');
    }
  }, [gameState?.currentPlayerId, gameState?.timeRemaining, profile]);

  useEffect(() => {
    if (!latestReaction) return;

    const toastId = `${latestReaction.playerId}-${latestReaction.createdAt}-reaction`;
    const nextToast: SocialToast = {
      id: toastId,
      kind: 'reaction',
      playerName: latestReaction.playerName,
      emoji: latestReaction.emoji,
    };
    setSocialToasts([nextToast]);
    playFeedbackSound('reaction');
    spawnBurst(32, 70, ['#fef08a', '#f9a8d4', '#93c5fd'], 10);
    const timeout = window.setTimeout(() => {
      setSocialToasts((current) => current.filter((toast) => toast.id !== toastId));
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [latestReaction, spawnBurst]);

  useEffect(() => {
    if (!latestQuickMessage) return;

    const toastId = `${latestQuickMessage.playerId}-${latestQuickMessage.createdAt}-message`;
    const nextToast: SocialToast = {
      id: toastId,
      kind: 'message',
      playerName: latestQuickMessage.playerName,
      message: latestQuickMessage.message,
    };
    setSocialToasts([nextToast]);
    playFeedbackSound('quickMessage');
    const timeout = window.setTimeout(() => {
      setSocialToasts((current) => current.filter((toast) => toast.id !== toastId));
    }, 5000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [latestQuickMessage]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!word.trim()) return;

    submitWord(word.trim(), (response) => {
      if (response?.success) {
        setWord('');
        setWordCelebrationKey((value) => value + 1);
        playFeedbackSound('correct');
        spawnBurst(50, 36, ['#4ade80', '#86efac', '#bbf7d0'], 18);
      } else if (response?.error) {
        setError(response.error);
        playFeedbackSound('invalid');
        triggerScreenShake();
        spawnBurst(50, 46, ['#fb7185', '#fca5a5', '#fecdd3'], 12);
        setTimeout(() => setError(null), 3000);
      }
    });
  }, [word, submitWord, spawnBurst, triggerScreenShake]);

  const handleLeaveGame = () => {
    if (confirm('Are you sure you want to leave the game? You will be eliminated.')) {
      leaveRoom(() => {
        router.push('/lobby');
      });
    }
  };

  const handleCopyRoomCode = useCallback(async () => {
    if (typeof window === 'undefined' || !currentRoom) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentRoom.roomCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2200);
    } catch (copyError) {
      setError('Failed to copy room code');
      setTimeout(() => setError(null), 3000);
    }
  }, [currentRoom]);

  const handleReaction = useCallback((emoji: string) => {
    sendReaction(emoji, (response) => {
      if (response?.error) {
        setError(response.error);
        setTimeout(() => setError(null), 3000);
      }
    });
  }, [sendReaction]);

  const handleQuickMessage = useCallback((message: string) => {
    sendQuickMessage(message, (response) => {
      if (response?.error) {
        setError(response.error);
        setTimeout(() => setError(null), 3000);
      }
    });
  }, [sendQuickMessage]);

  const handleUseAbility = useCallback((ability: 'time_freeze' | 'letter_change' | 'hint_boost' | 'block_opponent' | 'reverse_chain' | 'skip_turn_attack') => {
    setError(null);

    const needsTarget = ability === 'block_opponent' || ability === 'skip_turn_attack';
    if (needsTarget && !selectedTargetId) {
      setError('Choose a target player first');
      return;
    }

    useAbility({ ability, targetPlayerId: needsTarget ? selectedTargetId : undefined }, (response) => {
      if (response?.success) {
        if (response.hints) {
          setAbilityHints(response.hints);
        }
        if (needsTarget) {
          setSelectedTargetId('');
        }
      } else if (response?.error) {
        setError(response.error);
        triggerScreenShake();
        setTimeout(() => setError(null), 3000);
      }
    });
  }, [selectedTargetId, useAbility, triggerScreenShake]);

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
  const availableTargets = gameState.players.filter((player) => !player.isEliminated && player.id !== profile.id);

  // Calculate timer percentage
  const timerPercentage = (gameState.timeRemaining / gameState.totalTime) * 100;
  const timerColor = timerPercentage > 50 ? 'bg-success-500' : timerPercentage > 25 ? 'bg-warning-500' : 'bg-danger-500';
  const timerState = gameState.timeRemaining <= 5 ? 'danger' : gameState.timeRemaining <= 10 ? 'warning' : 'safe';
  const turnCardClasses = isMyTurn
    ? 'bg-primary-900/60 border border-primary-400 glow-primary animate-turn-spotlight'
    : 'bg-slate-800 border border-slate-700';
  const activeAbilityStyle = latestAbilityEffect ? ABILITY_EFFECT_STYLES[latestAbilityEffect.ability] : null;
  const isImpactAbility = latestAbilityEffect?.ability === 'block_opponent' || latestAbilityEffect?.ability === 'skip_turn_attack';

  return (
    <div className="min-h-screen p-4">
      <div key={screenShakeKey} className="max-w-7xl mx-auto animate-screen-shake">
        <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
          {bursts.map((burst) => (
            <span
              key={burst.id}
              className="particle-burst"
              style={{
                left: `${burst.x}%`,
                top: `${burst.y}%`,
                width: `${burst.size}px`,
                height: `${burst.size}px`,
                backgroundColor: burst.color,
                color: burst.color,
                ['--burst-x' as string]: `${burst.dx}px`,
                ['--burst-y' as string]: `${burst.dy}px`,
                ['--burst-duration' as string]: `${burst.duration}ms`,
              }}
            />
          ))}
        </div>

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
          <button
            onClick={() => void handleCopyRoomCode()}
            className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-primary-400 hover:text-white"
          >
            {copiedCode ? 'Code Copied' : 'Copy Code'}
          </button>
        </div>

        {socialToasts.length > 0 && (
          <div className="pointer-events-none fixed left-1/2 top-24 z-40 flex w-full max-w-xl -translate-x-1/2 justify-center px-4">
            {socialToasts.map((toast) => (
              <div
                key={toast.id}
                className={`w-full rounded-2xl border px-4 py-3 text-center shadow-[0_18px_40px_rgba(15,23,42,0.32)] animate-social-toast ${
                  toast.kind === 'reaction'
                    ? 'border-primary-300/45 bg-slate-950/92 text-primary-50'
                    : 'border-emerald-300/35 bg-slate-950/92 text-emerald-50'
                }`}
              >
                <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${
                  toast.kind === 'reaction' ? 'text-primary-200/80' : 'text-emerald-200/85'
                }`}>
                  {toast.playerName}
                </p>
                <p className="mt-1 text-lg font-bold">
                  {toast.kind === 'reaction' ? (
                    <span className="inline-flex items-center gap-3">
                      <span className="text-2xl">{toast.emoji}</span>
                      <span>reacted</span>
                    </span>
                  ) : (
                    toast.message
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
          <aside className="xl:sticky xl:top-4 h-fit">
            <div className="card mb-6">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Emoji Reactions</h3>
                <p className="mt-1 text-xs text-slate-500">Left side, easy to tap during the match.</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {REACTION_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleReaction(emoji)}
                      className="rounded-2xl border border-slate-700 bg-slate-800/80 py-3 text-2xl transition hover:-translate-y-0.5 hover:border-primary-400"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Quick Messages</h3>
                <p className="mt-1 text-xs text-slate-500">Tap here. The live popup appears above the match.</p>
                <div className="mt-4 space-y-2">
                  {QUICK_MESSAGE_OPTIONS.map((message) => (
                    <button
                      key={message}
                      type="button"
                      onClick={() => handleQuickMessage(message)}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-left text-sm font-medium text-slate-100 transition hover:border-primary-400 hover:text-white"
                    >
                      {message}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <div>
            {/* Game Status */}
            {amEliminated ? (
              <div className="bg-danger-900/50 border border-danger-500 rounded-xl p-4 mb-6 text-center">
                <p className="text-danger-200 font-semibold">You have been eliminated!</p>
                <p className="text-danger-300 text-sm mt-1">Watch the game or leave to lobby</p>
              </div>
            ) : (
              <div key={turnAnimationKey} className={`rounded-2xl p-5 mb-6 text-center shadow-[0_18px_45px_rgba(15,23,42,0.28)] ${turnCardClasses}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {isMyTurn ? 'Your Turn' : 'Current Turn'}
                </p>
                <p className={`mt-1 text-3xl font-bold ${isMyTurn ? 'text-primary-300' : 'text-white'}`}>
                  {isMyTurn ? 'Play now' : (currentPlayer?.name || 'Unknown')}
                </p>
                {isMyTurn && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary-300/70 bg-primary-300/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.24em] text-primary-50 animate-turn-beacon">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary-300"></span>
                    YOUR TURN
                  </div>
                )}
                {turnAnnouncement && !isMyTurn && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary-400/50 bg-primary-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary-100 animate-badge-pop">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary-300"></span>
                    {turnAnnouncement}
                  </div>
                )}
              </div>
            )}

            {/* Timer Bar */}
            <div className={`mb-6 rounded-2xl border px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.18)] ${timerState === 'danger' ? 'border-danger-400/60 bg-danger-500/10' : timerState === 'warning' ? 'border-warning-400/40 bg-warning-500/10' : 'border-slate-700 bg-slate-900/50'}`}>
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Time Remaining</span>
                <span className={`font-mono font-bold ${
                  gameState.timeRemaining <= 5 ? 'text-danger-400 animate-countdown-alert' : 'text-white'
                }`}>
                  {gameState.timeRemaining}s
                </span>
              </div>
              {countdownPulse && (
                <p className="mb-2 text-sm font-bold uppercase tracking-[0.24em] text-danger-300 animate-countdown-alert">
                  Hurry up
                </p>
              )}
              {gameState.timeRemaining <= 3 && (
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-danger-200">
                  Final seconds
                </p>
              )}
              <div className={`h-4 bg-slate-800 rounded-full overflow-hidden ${countdownPulse ? 'ring-2 ring-danger-400/40' : ''}`}>
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${timerColor} ${countdownPulse ? 'animate-timer-warning' : ''}`}
                  style={{ width: `${timerPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Current Word Display */}
            <div key={wordCelebrationKey} className={`card relative mb-6 min-h-[240px] overflow-visible text-center shadow-[0_24px_55px_rgba(15,23,42,0.22)] ${wordCelebrationKey > 0 ? 'animate-word-success' : ''}`}>
              {effectBanner && isImpactAbility && (
                <div className={`absolute left-0 top-1/2 z-10 w-full -translate-y-[calc(100%+1rem)] px-2 md:left-auto md:right-6 md:top-6 md:w-auto md:max-w-sm md:translate-y-0 ${activeAbilityStyle?.bannerClass ?? 'border-primary-500/60 bg-slate-950/95 text-primary-100'} rounded-2xl border px-4 py-3 text-left shadow-[0_18px_40px_rgba(15,23,42,0.45)] animate-ability-wave`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-80">
                    {activeAbilityStyle?.label ?? 'Ability'}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{effectBanner}</p>
                </div>
              )}

              <p className="text-slate-400 text-sm mb-3 uppercase tracking-[0.24em]">Current Word</p>
              <div className="text-5xl md:text-6xl font-bold text-white mb-5">
                {gameState.currentWord ? (
                  <span className="font-mono tracking-wider">{gameState.currentWord.toUpperCase()}</span>
                ) : (
                  <span className="text-primary-200">Start with any word!</span>
                )}
              </div>

              {gameState.requiredLetter && (
                <div className="inline-flex items-center gap-3 rounded-2xl border border-accent-400/70 bg-accent-500/10 px-6 py-4 shadow-[0_0_25px_rgba(192,38,211,0.12)]">
                  <span className="text-slate-300 text-sm uppercase tracking-[0.22em]">
                    {gameState.chainDirection === 'first' ? 'Next word follows the first letter:' : 'Next word must start with:'}
                  </span>
                  <span className="rounded-xl bg-accent-400/15 px-4 py-2 text-4xl font-black text-accent-300 font-mono neon-accent">
                    {gameState.requiredLetter.toUpperCase()}
                  </span>
                </div>
              )}

              {!gameState.requiredLetter && !amEliminated && (
                <p className="text-lg font-semibold text-primary-300">
                  Start with any word!
                </p>
              )}

              <div className="mt-4 space-y-3">
                {effectBanner && !isImpactAbility && (
                  <div className={`mx-auto max-w-2xl rounded-2xl border px-4 py-3 text-left shadow-[0_18px_40px_rgba(15,23,42,0.45)] animate-ability-wave ${activeAbilityStyle?.bannerClass ?? 'border-primary-500/60 bg-slate-950/95 text-primary-100'}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-80">
                      {activeAbilityStyle?.label ?? 'Ability'}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{effectBanner}</p>
                  </div>
                )}

                {abilityHints.length > 0 && (
                  <div className="mx-auto max-w-2xl rounded-2xl border border-success-500/40 bg-slate-950/95 px-4 py-3 text-left text-success-100 shadow-[0_18px_40px_rgba(15,23,42,0.45)] animate-ability-wave">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-success-200/85">
                      Hint Boost
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {abilityHints.map((hint) => (
                        <span key={hint} className="rounded-full border border-success-400/25 bg-success-500/10 px-3 py-1 text-sm font-mono text-success-100">
                          {hint.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                    className={`p-3 rounded-xl text-center transition-all ${
                      player.isEliminated
                        ? 'bg-slate-800/50 opacity-50'
                        : player.id === gameState.currentPlayerId
                          ? 'bg-primary-900/60 border border-primary-400 shadow-[0_0_25px_rgba(56,189,248,0.22)] animate-player-active'
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

          {!amEliminated && (
            <aside className="xl:sticky xl:top-4 h-fit">
              <div className="card mb-6 overflow-hidden">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Abilities</h2>
                    <p className="text-sm text-slate-400">Private power-ups just for this player.</p>
                  </div>
                  {abilityState?.isBlocked && (
                    <span className="rounded-full bg-danger-500/20 px-3 py-1 text-xs font-semibold text-danger-300">
                      Blocked
                    </span>
                  )}
                </div>

                {availableTargets.length > 0 && (
                  <div className="mb-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Pick Target
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {availableTargets.map((player) => {
                        const isSelected = selectedTargetId === player.id;
                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => setSelectedTargetId(isSelected ? '' : player.id)}
                            className={`rounded-2xl border p-3 text-left transition-all ${
                              isSelected
                                ? 'border-primary-500 bg-primary-500/15 shadow-[0_0_20px_rgba(14,165,233,0.12)]'
                                : 'border-slate-700 bg-slate-800/70 hover:border-primary-500/60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-11 w-11 overflow-hidden rounded-full border border-slate-600 bg-slate-700">
                                {player.profileImage ? (
                                  <img src={player.profileImage} alt={player.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-lg">🎯</div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{player.name}</p>
                                <p className={`text-xs ${isSelected ? 'text-primary-200' : 'text-slate-400'}`}>
                                  {isSelected ? 'Target locked' : 'Tap to target'}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {ABILITY_CONFIG.map((ability) => {
                    const charges = abilityState?.[ability.key as keyof typeof abilityState];
                    const needsTarget = ability.needsTarget;
                    const missingTarget = needsTarget && !selectedTargetId;
                    const isCasting = activeAbilityCast === ability.key;
                    return (
                      <button
                        key={ability.key}
                        type="button"
                        onClick={() => handleUseAbility(ability.key)}
                        disabled={!isMyTurn || abilityState?.isBlocked || !charges || missingTarget}
                        className={`w-full rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800/90 to-slate-900/70 p-4 text-left transition-all hover:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 ${isCasting ? 'animate-ability-cast border-primary-400' : ''}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{ability.emoji}</span>
                            <div>
                              <span className="block font-semibold text-white">{ability.label}</span>
                              <span className="text-xs text-slate-500">
                                {needsTarget ? 'Needs a target' : 'Instant cast'}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-full bg-primary-600/20 px-2 py-1 text-xs font-medium text-primary-200">
                            {charges ?? 0} left
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">{ability.description}</p>
                      </button>
                    );
                  })}
                </div>

              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
