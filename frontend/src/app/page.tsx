'use client';

/**
 * Main Menu Page
 * 
 * Shows after setup completion:
 * - Play (go to lobby)
 * - Edit Profile
 * - How to Play
 * - Exit
 * 
 * Displays saved player info
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPlayerProfile, clearPlayerProfile } from '@/utils/localStorage';
import type { PlayerProfile } from '@shared/types';

export default function MainMenu() {
  const router = useRouter();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  useEffect(() => {
    const playerProfile = getPlayerProfile();
    if (!playerProfile) {
      // Redirect to setup if no profile exists
      router.push('/setup');
      return;
    }
    setProfile(playerProfile);
  }, [router]);

  const handleExit = () => {
    if (confirm('Are you sure you want to exit? Your profile will be cleared.')) {
      clearPlayerProfile();
      window.close();
      // Fallback if window.close() doesn't work
      router.push('/setup');
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Player Profile Card */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-primary-500">
              {profile.profileImage ? (
                <img 
                  src={profile.profileImage} 
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl">🎮</span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{profile.name}</h2>
              <p className="text-slate-400">Age: {profile.age}</p>
            </div>
          </div>
        </div>

        {/* Game Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold gradient-text mb-2">Last Letter</h1>
          <p className="text-slate-400">Multiplayer Word Chain Game</p>
        </div>

        {/* Menu Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => router.push('/lobby')}
            className="w-full btn btn-primary text-lg py-4"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Play
            </span>
          </button>

          <button
            onClick={() => router.push('/setup')}
            className="w-full btn btn-secondary text-lg py-4"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Edit Profile
            </span>
          </button>

          <button
            onClick={() => setShowHowToPlay(true)}
            className="w-full btn btn-secondary text-lg py-4"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How to Play
            </span>
          </button>

          <button
            onClick={handleExit}
            className="w-full btn btn-danger text-lg py-4"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Exit
            </span>
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-8">
          Connect with friends and test your vocabulary!
        </p>
      </div>

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">How to Play</h2>
              <button
                onClick={() => setShowHowToPlay(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6 text-slate-300">
              <section>
                <h3 className="text-lg font-semibold text-primary-400 mb-2">🎯 Objective</h3>
                <p>Be the last player standing by entering valid English words in a chain!</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-primary-400 mb-2">📝 Rules</h3>
                <ol className="list-decimal list-inside space-y-2">
                  <li>The first player can enter any valid English word</li>
                  <li>The next player must enter a word that starts with the <strong>last letter</strong> of the previous word</li>
                  <li>Words cannot be reused in the same match</li>
                  <li>You have a limited time to enter your word (5-30 seconds)</li>
                  <li>If you fail to enter a valid word in time, you are eliminated</li>
                  <li>The last remaining player wins!</li>
                </ol>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-primary-400 mb-2">💡 Example</h3>
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 bg-primary-600 rounded-full text-white font-mono">DOG</span>
                    <span className="text-slate-500">→</span>
                    <span className="px-3 py-1 bg-accent-600 rounded-full text-white font-mono">GONE</span>
                    <span className="text-slate-500">→</span>
                    <span className="px-3 py-1 bg-success-600 rounded-full text-white font-mono">EGG</span>
                    <span className="text-slate-500">→</span>
                    <span className="px-3 py-1 bg-warning-600 rounded-full text-white font-mono">GOAT</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-primary-400 mb-2">⚠️ Validations</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Words must be real English words</li>
                  <li>Words must start with the required letter</li>
                  <li>Words must be at least 2 letters long</li>
                  <li>Words can only contain letters (no numbers or symbols)</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-primary-400 mb-2">👥 Multiplayer</h3>
                <p>Play with 2-15 players in real-time. Create a room or join an existing one with a room code!</p>
              </section>
            </div>

            <button
              onClick={() => setShowHowToPlay(false)}
              className="w-full btn btn-primary mt-6"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
