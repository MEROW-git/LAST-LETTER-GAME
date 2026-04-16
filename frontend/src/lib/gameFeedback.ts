import { calculateRank, type Rank } from '@shared/types';
import { getAppSettings } from '@/utils/localStorage';

type FeedbackSound =
  | 'turn'
  | 'countdown'
  | 'correct'
  | 'invalid'
  | 'ability'
  | 'rankUp'
  | 'reaction'
  | 'quickMessage'
  | 'win'
  | 'lose';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined);
  }

  return audioContext;
}

function getVolume() {
  return Math.max(0, Math.min(1, getAppSettings().volume / 100));
}

function playTone(
  context: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

export function playFeedbackSound(sound: FeedbackSound) {
  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const volume = getVolume();
  const baseVolume = Math.max(0.0001, volume * 0.15);

  switch (sound) {
    case 'turn':
      playTone(context, 392, now, 0.18, baseVolume, 'triangle');
      playTone(context, 523.25, now + 0.12, 0.22, baseVolume * 1.1, 'triangle');
      break;
    case 'countdown':
      playTone(context, 760, now, 0.08, baseVolume * 0.8, 'square');
      break;
    case 'correct':
      playTone(context, 523.25, now, 0.12, baseVolume, 'triangle');
      playTone(context, 659.25, now + 0.1, 0.14, baseVolume * 1.1, 'triangle');
      playTone(context, 783.99, now + 0.18, 0.18, baseVolume * 1.2, 'triangle');
      break;
    case 'invalid':
      playTone(context, 320, now, 0.14, baseVolume, 'sawtooth');
      playTone(context, 220, now + 0.08, 0.2, baseVolume * 0.9, 'sawtooth');
      break;
    case 'ability':
      playTone(context, 460, now, 0.08, baseVolume, 'triangle');
      playTone(context, 690, now + 0.08, 0.16, baseVolume * 1.1, 'triangle');
      break;
    case 'rankUp':
      playTone(context, 392, now, 0.15, baseVolume, 'triangle');
      playTone(context, 523.25, now + 0.11, 0.16, baseVolume * 1.1, 'triangle');
      playTone(context, 659.25, now + 0.22, 0.18, baseVolume * 1.15, 'triangle');
      playTone(context, 783.99, now + 0.35, 0.28, baseVolume * 1.2, 'triangle');
      break;
    case 'reaction':
      playTone(context, 659.25, now, 0.08, baseVolume * 0.8, 'triangle');
      playTone(context, 987.77, now + 0.07, 0.12, baseVolume * 0.9, 'triangle');
      break;
    case 'quickMessage':
      playTone(context, 587.33, now, 0.1, baseVolume * 0.95, 'triangle');
      playTone(context, 783.99, now + 0.08, 0.14, baseVolume, 'triangle');
      break;
    case 'win':
      playTone(context, 523.25, now, 0.14, baseVolume, 'triangle');
      playTone(context, 659.25, now + 0.1, 0.16, baseVolume * 1.1, 'triangle');
      playTone(context, 783.99, now + 0.2, 0.18, baseVolume * 1.2, 'triangle');
      playTone(context, 1046.5, now + 0.34, 0.26, baseVolume * 1.25, 'triangle');
      break;
    case 'lose':
      playTone(context, 392, now, 0.16, baseVolume * 0.9, 'sine');
      playTone(context, 311.13, now + 0.12, 0.18, baseVolume * 0.85, 'sine');
      playTone(context, 261.63, now + 0.24, 0.26, baseVolume * 0.8, 'sine');
      break;
  }
}

export function getRankUpSummary(previousPoints: number, nextPoints: number): { previousRank: Rank; nextRank: Rank; rankedUp: boolean } {
  const previousRank = calculateRank(previousPoints);
  const nextRank = calculateRank(nextPoints);

  return {
    previousRank,
    nextRank,
    rankedUp: previousRank !== nextRank,
  };
}
