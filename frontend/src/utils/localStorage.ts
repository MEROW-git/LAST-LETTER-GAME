/**
 * Local Storage Utilities
 * 
 * Handles player profile persistence in browser localStorage
 * Now includes user authentication and ranking system
 */

import { v4 as uuidv4 } from 'uuid';
import type { AppSettings, MatchResult, PlayerProfile, Rank } from '@shared/types';
import { LOCAL_STORAGE_KEYS, RANK_POINTS, RANK_THRESHOLDS } from '@shared/types';

const DEFAULT_APP_SETTINGS: AppSettings = {
  volume: 70,
};

function calculateLocalRank(points: number): Rank {
  if (points >= RANK_THRESHOLDS.Master) return 'Master';
  if (points >= 5000) return 'Diamond';
  if (points >= 3000) return 'Gold';
  if (points >= 1500) return 'Silver';
  if (points >= 500) return 'Iron';
  return 'Plastic';
}

const RANK_ORDER: Rank[] = ['Plastic', 'Iron', 'Silver', 'Gold', 'Diamond', 'Master'];

function getRankThreshold(rank: Rank): number {
  return RANK_THRESHOLDS[rank];
}

function getRankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

function normalizePlayerProfile(profile: Partial<PlayerProfile> | null): PlayerProfile | null {
  if (!profile || !profile.id || !profile.userId || !profile.name || typeof profile.age !== 'number') {
    return null;
  }

  return {
    ...profile,
    authProviders: profile.authProviders && profile.authProviders.length > 0 ? profile.authProviders : ['password'],
    gamesDrawn: profile.gamesDrawn ?? 0,
    winStreak: profile.winStreak ?? 0,
    bestWinStreak: profile.bestWinStreak ?? 0,
    protectedRank: profile.protectedRank ?? null,
    rankProtectionMatches: profile.rankProtectionMatches ?? 0,
  } as PlayerProfile;
}

function readJsonStorage<T>(storage: Storage, key: string): T | null {
  const stored = storage.getItem(key);
  if (!stored) {
    return null;
  }

  return JSON.parse(stored) as T;
}

/**
 * Get player profile from sessionStorage for this tab.
 * Falls back once to the legacy localStorage key and migrates it.
 */
export function getPlayerProfile(): PlayerProfile | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const activeProfile = normalizePlayerProfile(
      readJsonStorage<Partial<PlayerProfile>>(sessionStorage, LOCAL_STORAGE_KEYS.ACTIVE_PLAYER_PROFILE)
    );
    if (activeProfile) {
      return activeProfile;
    }

    const legacyProfile = normalizePlayerProfile(
      readJsonStorage<Partial<PlayerProfile>>(localStorage, LOCAL_STORAGE_KEYS.PLAYER_PROFILE)
    );
    if (legacyProfile) {
      sessionStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_PLAYER_PROFILE, JSON.stringify(legacyProfile));
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PLAYER_PROFILE);
      saveStoredPlayerProfile(legacyProfile);
      return legacyProfile;
    }
  } catch (error) {
    console.error('Error reading player profile:', error);
  }
  return null;
}

export function getStoredPlayerProfiles(): PlayerProfile[] {
  if (typeof window === 'undefined') return [];

  try {
    const storedProfiles = readJsonStorage<Array<Partial<PlayerProfile>>>(
      localStorage,
      LOCAL_STORAGE_KEYS.SAVED_PLAYER_PROFILES
    );

    if (!storedProfiles) {
      return [];
    }

    return storedProfiles
      .map((profile) => normalizePlayerProfile(profile))
      .filter((profile): profile is PlayerProfile => profile !== null);
  } catch (error) {
    console.error('Error reading saved player profiles:', error);
    return [];
  }
}

function saveStoredProfiles(profiles: PlayerProfile[]) {
  localStorage.setItem(LOCAL_STORAGE_KEYS.SAVED_PLAYER_PROFILES, JSON.stringify(profiles));
}

export function saveStoredPlayerProfile(profile: PlayerProfile): PlayerProfile[] {
  if (typeof window === 'undefined') return [];

  try {
    const existingProfiles = getStoredPlayerProfiles().filter(
      (existingProfile) => existingProfile.userId !== profile.userId
    );
    const nextProfiles = [profile, ...existingProfiles];
    saveStoredProfiles(nextProfiles);
    return nextProfiles;
  } catch (error) {
    console.error('Error saving stored player profile:', error);
    return getStoredPlayerProfiles();
  }
}

export function removeStoredPlayerProfile(userId: string): PlayerProfile[] {
  if (typeof window === 'undefined') return [];

  try {
    const nextProfiles = getStoredPlayerProfiles().filter((profile) => profile.userId !== userId);
    saveStoredProfiles(nextProfiles);
    return nextProfiles;
  } catch (error) {
    console.error('Error removing stored player profile:', error);
    return getStoredPlayerProfiles();
  }
}

/**
 * Save player profile to localStorage
 */
export function savePlayerProfile(profile: Omit<PlayerProfile, 'id' | 'rank' | 'rankPoints' | 'gamesPlayed' | 'gamesWon' | 'gamesLost' | 'gamesDrawn' | 'winStreak' | 'bestWinStreak' | 'protectedRank' | 'rankProtectionMatches' | 'createdAt' | 'lastLoginAt'> & { id?: string }): PlayerProfile {
  const existingProfile = getPlayerProfile();
  const now = Date.now();
  
  const newProfile: PlayerProfile = {
    id: profile.id || existingProfile?.id || uuidv4(),
    userId: profile.userId,
    name: profile.name,
    age: profile.age,
    profileImage: profile.profileImage,
    authProviders: profile.authProviders || existingProfile?.authProviders || ['password'],
    rank: existingProfile?.rank || 'Plastic',
    rankPoints: existingProfile?.rankPoints || 0,
    gamesPlayed: existingProfile?.gamesPlayed || 0,
    gamesWon: existingProfile?.gamesWon || 0,
    gamesLost: existingProfile?.gamesLost || 0,
    gamesDrawn: existingProfile?.gamesDrawn || 0,
    winStreak: existingProfile?.winStreak || 0,
    bestWinStreak: existingProfile?.bestWinStreak || 0,
    protectedRank: existingProfile?.protectedRank || null,
    rankProtectionMatches: existingProfile?.rankProtectionMatches || 0,
    createdAt: existingProfile?.createdAt || now,
    lastLoginAt: now,
  };
  
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_PLAYER_PROFILE, JSON.stringify(newProfile));
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PLAYER_PROFILE);
      saveStoredPlayerProfile(newProfile);
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
      sessionStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_PLAYER_PROFILE, JSON.stringify(updatedProfile));
      saveStoredPlayerProfile(updatedProfile);
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
  
  const pointsChange = won ? RANK_POINTS.WIN : RANK_POINTS.LOSS;
  const newRankPoints = Math.max(0, profile.rankPoints + pointsChange); // Don't go below 0
  const newRank = calculateLocalRank(newRankPoints);

  return updatePlayerProfile({
    gamesPlayed: newGamesPlayed,
    gamesWon: newGamesWon,
    gamesLost: newGamesLost,
    gamesDrawn: profile.gamesDrawn,
    winStreak: won ? profile.winStreak + 1 : 0,
    bestWinStreak: won ? Math.max(profile.bestWinStreak, profile.winStreak + 1) : profile.bestWinStreak,
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
 * Clear active player profile for this tab
 */
export function clearPlayerProfile(): void {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(LOCAL_STORAGE_KEYS.ACTIVE_PLAYER_PROFILE);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PLAYER_PROFILE);
    } catch (error) {
      console.error('Error clearing player profile:', error);
    }
  }
}

export function activateStoredPlayerProfile(profile: PlayerProfile): PlayerProfile {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_PLAYER_PROFILE, JSON.stringify(profile));
    saveStoredPlayerProfile(profile);
  }

  return profile;
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

export function getAppSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_APP_SETTINGS;

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.APP_SETTINGS);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      return {
        volume: typeof parsed.volume === 'number' ? parsed.volume : DEFAULT_APP_SETTINGS.volume,
      };
    }
  } catch (error) {
    console.error('Error reading app settings:', error);
  }

  return DEFAULT_APP_SETTINGS;
}

export function saveAppSettings(settings: Partial<AppSettings>): AppSettings {
  const existingSettings = getAppSettings();
  const mergedSettings: AppSettings = {
    ...existingSettings,
    ...settings,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.APP_SETTINGS, JSON.stringify(mergedSettings));
    } catch (error) {
      console.error('Error saving app settings:', error);
    }
  }

  return mergedSettings;
}

function getProcessedMatchResults(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = readJsonStorage<string[]>(localStorage, LOCAL_STORAGE_KEYS.PROCESSED_MATCH_RESULTS);
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.error('Error reading processed match results:', error);
    return [];
  }
}

function saveProcessedMatchResults(matchKeys: string[]) {
  localStorage.setItem(LOCAL_STORAGE_KEYS.PROCESSED_MATCH_RESULTS, JSON.stringify(matchKeys));
}

function calculateProtectedRankState(
  profile: PlayerProfile,
  nextRankPoints: number
): Pick<PlayerProfile, 'rank' | 'protectedRank' | 'rankProtectionMatches'> {
  const calculatedRank = calculateLocalRank(nextRankPoints);
  const previousRank = profile.rank;
  const previousIndex = getRankIndex(previousRank);
  const nextIndex = getRankIndex(calculatedRank);

  if (nextIndex > previousIndex) {
    return {
      rank: calculatedRank,
      protectedRank: calculatedRank === 'Plastic' ? null : calculatedRank,
      rankProtectionMatches: calculatedRank === 'Plastic' ? 0 : 2,
    };
  }

  if (profile.rankProtectionMatches > 0 && profile.protectedRank) {
    const remainingMatches = Math.max(0, profile.rankProtectionMatches - 1);
    const isBelowProtectedThreshold = nextRankPoints < getRankThreshold(profile.protectedRank);
    const effectiveRank = isBelowProtectedThreshold ? profile.protectedRank : calculatedRank;

    return {
      rank: effectiveRank,
      protectedRank: remainingMatches > 0 ? profile.protectedRank : null,
      rankProtectionMatches: remainingMatches,
    };
  }

  return {
    rank: calculatedRank,
    protectedRank: null,
    rankProtectionMatches: 0,
  };
}

export function applyMatchResultToProfile(result: MatchResult): PlayerProfile | null {
  const profile = getPlayerProfile();
  if (!profile) return null;

  const myRanking = result.rankings.find((ranking) => ranking.playerId === profile.id);
  const didParticipate = Boolean(myRanking);
  if (!didParticipate) {
    return profile;
  }

  const matchKey = `${result.roomId}:${result.endedAt}`;
  const processedMatches = getProcessedMatchResults();
  if (processedMatches.includes(matchKey)) {
    return profile;
  }

  const didWin = result.winnerId === profile.id;
  const isDraw = result.winnerId === null;
  const nextGamesPlayed = profile.gamesPlayed + 1;
  const nextGamesWon = didWin ? profile.gamesWon + 1 : profile.gamesWon;
  const nextGamesLost = !didWin && !isDraw ? profile.gamesLost + 1 : profile.gamesLost;
  const nextGamesDrawn = isDraw ? profile.gamesDrawn + 1 : profile.gamesDrawn;

  let pointsChange = didWin ? RANK_POINTS.WIN : isDraw ? RANK_POINTS.DRAW : RANK_POINTS.LOSS;
  const nextWinStreak = didWin ? profile.winStreak + 1 : 0;

  if (didWin) {
    if (nextWinStreak >= 5) {
      pointsChange += RANK_POINTS.WIN_STREAK_5;
    } else if (nextWinStreak >= 3) {
      pointsChange += RANK_POINTS.WIN_STREAK_3;
    } else if (nextWinStreak >= 2) {
      pointsChange += RANK_POINTS.WIN_STREAK_2;
    }

    if (result.gameDuration <= 60) {
      pointsChange += RANK_POINTS.FAST_WIN;
    }

    if (myRanking && myRanking.timeoutCount === 0) {
      pointsChange += RANK_POINTS.PERFECT_GAME;
    }

    const beatStrongerPlayer = result.rankings.some(
      (ranking) => ranking.playerId !== profile.id && ranking.playerRankPointsBefore > profile.rankPoints
    );
    if (beatStrongerPlayer) {
      pointsChange += RANK_POINTS.BEAT_STRONGER_PLAYER;
    }
  }

  const nextRankPoints = Math.max(0, profile.rankPoints + pointsChange);
  const protectionState = calculateProtectedRankState(profile, nextRankPoints);

  const updatedProfile = updatePlayerProfile({
    gamesPlayed: nextGamesPlayed,
    gamesWon: nextGamesWon,
    gamesLost: nextGamesLost,
    gamesDrawn: nextGamesDrawn,
    winStreak: nextWinStreak,
    bestWinStreak: Math.max(profile.bestWinStreak, nextWinStreak),
    rankPoints: nextRankPoints,
    rank: protectionState.rank,
    protectedRank: protectionState.protectedRank,
    rankProtectionMatches: protectionState.rankProtectionMatches,
    lastLoginAt: Date.now(),
  });
  if (!updatedProfile) {
    return null;
  }

  saveProcessedMatchResults([...processedMatches, matchKey].slice(-50));
  return updatedProfile;
}
