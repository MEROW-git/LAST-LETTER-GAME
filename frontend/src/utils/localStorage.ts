/**
 * Local Storage Utilities
 * 
 * Handles player profile persistence in browser localStorage
 */

import { v4 as uuidv4 } from 'uuid';
import type { PlayerProfile } from '@shared/types';
import { LOCAL_STORAGE_KEYS } from '@shared/types';

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
export function savePlayerProfile(profile: Omit<PlayerProfile, 'id'>): PlayerProfile {
  const existingProfile = getPlayerProfile();
  
  const newProfile: PlayerProfile = {
    id: existingProfile?.id || uuidv4(), // Keep existing ID if available
    ...profile,
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
  const randomSeed = seed || seeds[Math.floor(Math.random() * seeds.length)];
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}`;
}

/**
 * Get or create player profile
 * If no profile exists, returns null (caller should redirect to setup)
 */
export function getOrCreateProfile(): PlayerProfile | null {
  return getPlayerProfile();
}
