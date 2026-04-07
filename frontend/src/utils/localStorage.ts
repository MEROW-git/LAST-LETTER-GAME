/**
 * Local Storage Utilities
 * 
 * Handles player profile persistence in browser localStorage
 * Now includes user authentication and ranking system
 */

import { v4 as uuidv4 } from 'uuid';
import type { PlayerProfile, Rank } from '@shared/types';
import { LOCAL_STORAGE_KEYS } from '@shared/types';
import { calculateRank } from '@shared/types';

/**
 * Get player profile from localStorage
 */
export function getPlayerProfile(): PlayerProfile | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.PLAYER_PROFILE);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading player profile:', error);
  }
  return null;
}

/**
 * Save player profile to localStorage
 */
export function savePlayerProfile(profile: Omit<PlayerProfile, 'id' | 'rank' | 'rankPoints' | 'gamesPlayed' | 'gamesWon' | 'gamesLost' | 'createdAt' | 'lastLoginAt'> & { id?: string }): PlayerProfile {
  const existingProfile = getPlayerProfile();
  const now = Date.now();
  
  const newProfile: PlayerProfile = {
    id: profile.id || existingProfile?.id || uuidv4(),
    userId: profile.userId,
    name: profile.name,
    age: profile.age,
    profileImage: profile.profileImage,
    rank: existingProfile?.rank || 'Plastic',
    rankPoints: existingProfile?.rankPoints || 0,
    gamesPlayed: existingProfile?.gamesPlayed || 0,
    gamesWon: existingProfile?.gamesWon || 0,
    gamesLost: existingProfile?.gamesLost || 0,
    createdAt: existingProfile?.createdAt || now,
    lastLoginAt: now,
  };
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.PLAYER_PROFILE, JSON.stringify(newProfile));
    } catch (error) {
      console.error('Error saving player profile:', error);
    }
  }
  
  return newProfile;
}

/**
 * Update player profile (partial update)
 */
export function updatePlayerProfile(updates: Partial<PlayerProfile>): PlayerProfile | null {
  const existingProfile = getPlayerProfile();
  if (!existingProfile) return null;
  
  const updatedProfile = {
    ...existingProfile,
    ...updates,
  };
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.PLAYER_PROFILE, JSON.stringify(updatedProfile));
    } catch (error) {
      console.error('Error updating player profile:', error);
    }
  }
  
  return updatedProfile;
}

/**
 * Update player stats after a game
 */
export function updatePlayerStats(won: boolean): PlayerProfile | null {
  const profile = getPlayerProfile();
  if (!profile) return null;

  const newGamesPlayed = profile.gamesPlayed + 1;
  const newGamesWon = won ? profile.gamesWon + 1 : profile.gamesWon;
  const newGamesLost = won ? profile.gamesLost : profile.gamesLost + 1;
  
  // Calculate new rank points
  const pointsChange = won ? 100 : -50;
  const newRankPoints = Math.max(0, profile.rankPoints + pointsChange); // Don't go below 0
  const newRank = calculateRank(newRankPoints);

  return updatePlayerProfile({
    gamesPlayed: newGamesPlayed,
    gamesWon: newGamesWon,
    gamesLost: newGamesLost,
    rankPoints: newRankPoints,
    rank: newRank,
    lastLoginAt: Date.now(),
  });
}

/**
 * Check if player profile exists
 */
export function hasPlayerProfile(): boolean {
  return getPlayerProfile() !== null;
}

/**
 * Clear player profile from localStorage
 */
export function clearPlayerProfile(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PLAYER_PROFILE);
    } catch (error) {
      console.error('Error clearing player profile:', error);
    }
  }
}

/**
 * Generate a random avatar URL
 */
export function generateRandomAvatar(seed?: string): string {
  const seeds = [
    'felix', 'bella', 'leo', 'luna', 'max', 'lucy',
    'charlie', 'lily', 'rocky', 'daisy'
  ];
  const baseSeed = seed || seeds[Math.floor(Math.random() * seeds.length)];
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const finalSeed = `${baseSeed}-${randomSuffix}`;
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${finalSeed}`;
}

/**
 * Get or create player profile
 * If no profile exists, returns null (caller should redirect to setup)
 */
export function getOrCreateProfile(): PlayerProfile | null {
  return getPlayerProfile();
}
