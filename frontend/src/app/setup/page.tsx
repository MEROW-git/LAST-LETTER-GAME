'use client';

/**
 * Setup Page - User Registration/Login
 *
 * New user registration or login:
 * - UserID (unique identifier)
 * - Password
 * - Name (required for registration)
 * - Age (required for registration)
 * - Profile picture (optional)
 *
 * Saves to server and localStorage, redirects to main menu on completion
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  activateStoredPlayerProfile,
  getPlayerProfile,
  getStoredPlayerProfiles,
  generateRandomAvatar,
  removeStoredPlayerProfile,
  savePlayerProfile,
} from '@/utils/localStorage';
import { getProviders, signIn, signOut, useSession } from 'next-auth/react';
import type { AuthResponse, PlayerProfile, OAuthAuthRequest } from '@shared/types';

export default function SetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitializedAvatarRef = useRef(false);
  const attemptedOAuthLoginRef = useRef(false);
  const { data: session, status } = useSession();

  const [isLogin, setIsLogin] = useState(true); // Toggle between login and register
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ userId?: string; password?: string; name?: string; age?: string; general?: string }>({});
  const [availableProviders, setAvailableProviders] = useState<Record<string, { id: string; name: string }> | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<PlayerProfile[]>([]);
  const isOAuthSession = Boolean(session?.user?.provider && session.user.providerAccountId);
  const isOAuthMode = !isLogin && isOAuthSession;

  // Check if profile already exists
  useEffect(() => {
    const profile = getPlayerProfile();
    if (profile) {
      // User is already logged in, redirect to main menu
      router.push('/');
      return;
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      const providers = await getProviders();
      setAvailableProviders(providers ?? {});
    })();
    setSavedProfiles(getStoredPlayerProfiles());
  }, []);

  useEffect(() => {
    if (isLogin) {
      hasInitializedAvatarRef.current = false;
      return;
    }

    if (hasInitializedAvatarRef.current) {
      return;
    }

    const sessionImage = session?.user?.image?.trim();
    setProfileImage(sessionImage || generateRandomAvatar(userId.trim() || name.trim() || undefined));
    hasInitializedAvatarRef.current = true;
  }, [isLogin, name, profileImage, session?.user?.image, userId]);

  useEffect(() => {
    if (!isOAuthSession || status !== 'authenticated') {
      attemptedOAuthLoginRef.current = false;
      return;
    }

    if (!name && session?.user?.name) {
      setName(session.user.name);
    }

    if (isLogin && !attemptedOAuthLoginRef.current) {
      attemptedOAuthLoginRef.current = true;
      void handleOAuthAuth(false);
    }
  }, [isLogin, isOAuthSession, name, session, status]);

  const validate = (): boolean => {
    const newErrors: { userId?: string; password?: string; name?: string; age?: string } = {};

    if (!isOAuthMode) {
      if (!userId.trim()) {
        newErrors.userId = 'User ID is required';
      } else if (userId.trim().length < 3) {
        newErrors.userId = 'User ID must be at least 3 characters';
      } else if (userId.trim().length > 20) {
        newErrors.userId = 'User ID must be less than 20 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(userId.trim())) {
        newErrors.userId = 'User ID can only contain letters, numbers, and underscores';
      }
    }

    if (!isOAuthMode) {
      if (!password) {
        newErrors.password = 'Password is required';
      } else if (password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
    }

    if (!isLogin) {
      // Additional validation for registration
      if (!name.trim()) {
        newErrors.name = 'Name is required';
      } else if (name.trim().length < 2) {
        newErrors.name = 'Name must be at least 2 characters';
      } else if (name.trim().length > 20) {
        newErrors.name = 'Name must be less than 20 characters';
      }

      if (!age) {
        newErrors.age = 'Age is required';
      } else {
        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 5 || ageNum > 120) {
          newErrors.age = 'Age must be between 5 and 120';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getAuthErrorMessage = (error: unknown): string => {
    if (error instanceof TypeError) {
      return 'Cannot reach the game server. Make sure the backend is running on http://localhost:3001.';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Authentication failed. Please try again.';
  };

  const syncOAuthAccount = async (includeProfileDetails: boolean): Promise<AuthResponse> => {
    const provider = session?.user?.provider;
    const providerUserId = session?.user?.providerAccountId;

    if (!provider || !providerUserId || (provider !== 'google' && provider !== 'facebook')) {
      throw new Error('OAuth session is missing provider details. Please sign in again.');
    }

    const payload: OAuthAuthRequest = {
      provider,
      providerUserId,
      email: session.user?.email || undefined,
      profileImage: profileImage || session.user?.image || undefined,
    };

    if (includeProfileDetails) {
      payload.name = name.trim();
      payload.age = parseInt(age, 10);
    }

    const response = await fetch('/api/auth/oauth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('The auth server returned an invalid response. Check that the backend is running and reachable.');
    }

    return response.json() as Promise<AuthResponse>;
  };

  const handleOAuthAuth = async (includeProfileDetails: boolean) => {
    setErrors({});
    setIsLoading(true);

    try {
      const data = await syncOAuthAccount(includeProfileDetails);

      if (data.success && data.player) {
        savePlayerProfile(data.player);
        setSavedProfiles(getStoredPlayerProfiles());
        router.push('/');
        return;
      }

      if (!includeProfileDetails && data.error?.includes('Complete sign up')) {
        setIsLogin(false);
        setErrors({ general: 'Finish your profile to create your account.' });
        return;
      }

      setErrors({ general: data.error || 'Authentication failed' });
    } catch (error) {
      console.error('OAuth auth error:', error);
      setErrors({ general: getAuthErrorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) return;

    if (isOAuthMode) {
      await handleOAuthAuth(true);
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin
        ? { userId: userId.trim(), password }
        : {
            userId: userId.trim(),
            password,
            name: name.trim(),
            age: parseInt(age),
            profileImage: profileImage || undefined
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('The auth server returned an invalid response. Check that the backend is running and reachable.');
      }

      const data: AuthResponse = await response.json();

      if (data.success && data.player) {
        // Save to localStorage
        savePlayerProfile(data.player);
        setSavedProfiles(getStoredPlayerProfiles());
        // Redirect to main menu
        router.push('/');
      } else {
        setErrors({ general: data.error || 'Authentication failed' });
      }
    } catch (error) {
      console.error('Auth error:', error);
      setErrors({ general: getAuthErrorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setProfileImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSkipImage = () => {
    setProfileImage('');
  };

  const handleRandomAvatar = () => {
    setProfileImage(generateRandomAvatar(userId.trim() || name.trim() || undefined));
    hasInitializedAvatarRef.current = true;
  };

  const handleOAuthProviderSignIn = async (provider: 'google' | 'facebook') => {
    setErrors({});
    await signIn(provider, { callbackUrl: '/setup' });
  };

  const handleUseSavedProfile = async (profile: PlayerProfile) => {
    setErrors({});
    activateStoredPlayerProfile(profile);
    await signOut({ redirect: false });
    router.push('/');
  };

  const handleRemoveSavedProfile = (userIdToRemove: string) => {
    setSavedProfiles(removeStoredPlayerProfile(userIdToRemove));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white neon-text animate-smooth-shake mb-2">
              Last Letter
            </h1>
            <p className="text-slate-400">
              {isLogin ? 'Welcome back! Sign in to continue' : 'Create your account to start playing'}
            </p>
        </div>

        {/* Auth Form */}
        <div className="card">
          {/* Mode Toggle */}
          <div className="flex mb-6 bg-slate-700 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setErrors({});
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isLogin
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setErrors({});
                setProfileImage((currentImage) => currentImage || generateRandomAvatar(userId.trim() || name.trim() || undefined));
                hasInitializedAvatarRef.current = true;
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                !isLogin
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {/* General Error */}
            {errors.general && (
              <div className="p-3 bg-danger-500/20 border border-danger-500/50 rounded-lg">
                <p className="text-sm text-danger-400">{errors.general}</p>
              </div>
            )}

            {availableProviders && Object.keys(availableProviders).length > 0 ? (
              <>
                <div className="space-y-3">
                  {availableProviders.google && (
                    <button
                      type="button"
                      onClick={() => void handleOAuthProviderSignIn('google')}
                      className="w-full rounded-lg border border-slate-600 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isLoading || status === 'loading'}
                    >
                      Continue with Google
                    </button>
                  )}
                  {availableProviders.facebook && (
                    <button
                      type="button"
                      onClick={() => void handleOAuthProviderSignIn('facebook')}
                      className="w-full rounded-lg bg-[#1877F2] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1669d9] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isLoading || status === 'loading'}
                    >
                      Continue with Facebook
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-700"></div>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    or
                  </span>
                  <div className="h-px flex-1 bg-slate-700"></div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                <p className="text-sm text-slate-400">
                  Google and Facebook sign-in will appear here after their OAuth env vars are configured.
                </p>
              </div>
            )}

            {isOAuthSession && (
              <div className="rounded-lg border border-primary-500/40 bg-primary-500/10 p-3">
                <p className="text-sm text-slate-200">
                  Signed in with {session?.user?.provider === 'google' ? 'Google' : 'Facebook'}
                  {session?.user?.email ? ` as ${session.user.email}` : ''}.
                </p>
                <button
                  type="button"
                  onClick={() => void signOut({ callbackUrl: '/setup' })}
                  className="mt-2 text-sm text-primary-300 transition-colors hover:text-primary-200"
                  disabled={isLoading}
                >
                  Use a different account
                </button>
              </div>
            )}

            {/* Registration Avatar */}
            {!isLogin && (
              <div className="flex flex-col items-center rounded-xl border border-slate-600/60 bg-slate-800/40 px-4 py-5">
                <p className="mb-3 text-sm font-medium text-slate-300">Choose Avatar</p>

                <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-slate-600">
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">🎮</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 hover:bg-primary-500 rounded-full flex items-center justify-center transition-colors"
                    disabled={isLoading}
                    aria-label="Upload avatar"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                  <button
                    type="button"
                    onClick={handleRandomAvatar}
                    className="text-primary-400 hover:text-primary-300 transition-colors"
                    disabled={isLoading}
                  >
                    Random Avatar
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-slate-300 hover:text-white transition-colors"
                    disabled={isLoading}
                  >
                    Upload Image
                  </button>
                  {profileImage && (
                    <button
                      type="button"
                      onClick={handleSkipImage}
                      className="text-slate-400 hover:text-slate-300 transition-colors"
                      disabled={isLoading}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}

            {!isOAuthMode && (
              <>
                {/* User ID Input */}
                <div>
                  <label htmlFor="userId" className="block text-sm font-medium text-slate-300 mb-2">
                    User ID <span className="text-danger-500">*</span>
                  </label>
                  <input
                    id="userId"
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter your user ID"
                    className={`input ${errors.userId ? 'border-danger-500 ring-1 ring-danger-500' : ''}`}
                    maxLength={20}
                    disabled={isLoading}
                  />
                  {errors.userId && (
                    <p className="mt-1 text-sm text-danger-400">{errors.userId}</p>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                    Password <span className="text-danger-500">*</span>
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`input ${errors.password ? 'border-danger-500 ring-1 ring-danger-500' : ''}`}
                    disabled={isLoading}
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-danger-400">{errors.password}</p>
                  )}
                </div>
              </>
            )}

            {/* Registration Fields */}
            {!isLogin && (
              <>
                {isOAuthMode && (
                  <div className="rounded-lg border border-slate-600/60 bg-slate-800/40 p-3">
                    <p className="text-sm text-slate-300">
                      We’ll create your game account from your {session?.user?.provider} profile. Pick your display name, age, and avatar to finish setup.
                    </p>
                  </div>
                )}

                {/* Name Input */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                    Your Name <span className="text-danger-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your display name"
                    className={`input ${errors.name ? 'border-danger-500 ring-1 ring-danger-500' : ''}`}
                    maxLength={20}
                    disabled={isLoading}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-danger-400">{errors.name}</p>
                  )}
                </div>

                {/* Age Input */}
                <div>
                  <label htmlFor="age" className="block text-sm font-medium text-slate-300 mb-2">
                    Your Age <span className="text-danger-500">*</span>
                  </label>
                  <input
                    id="age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Enter your age"
                    className={`input ${errors.age ? 'border-danger-500 ring-1 ring-danger-500' : ''}`}
                    min={5}
                    max={120}
                    disabled={isLoading}
                  />
                  {errors.age && (
                    <p className="mt-1 text-sm text-danger-400">{errors.age}</p>
                  )}
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isOAuthMode ? 'Finishing Setup...' : isLogin ? 'Signing In...' : 'Creating Account...'}
                </div>
              ) : (
                isOAuthMode ? 'Complete Account' : isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Info */}
        <p className="text-center text-slate-500 text-sm mt-6">
          {isOAuthMode
            ? 'Already have a password account? Switch back to Sign In above.'
            : isLogin
            ? "Don't have an account? Switch to Sign Up above."
            : "Already have an account? Switch to Sign In above."
          }
        </p>

        <div className="card mt-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Saved Test Accounts</h2>
            <p className="text-sm text-slate-400">
              Each browser tab now keeps its own active player. Use this section to switch tabs into different accounts for multiplayer testing.
            </p>
          </div>

          {savedProfiles.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
              <p className="text-sm text-slate-400">
                No saved test accounts yet. Create a few accounts here, then open another tab and choose a different one from this list.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedProfiles.map((profile) => (
                <div
                  key={profile.userId}
                  className="rounded-xl border border-slate-700 bg-slate-800/40 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center border border-slate-600">
                      {profile.profileImage ? (
                        <img src={profile.profileImage} alt={profile.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🎮</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{profile.name}</p>
                      <p className="text-sm text-slate-400 truncate">@{profile.userId} • Age {profile.age}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {profile.authProviders.map((provider) => (
                          <span
                            key={`${profile.userId}-${provider}`}
                            className="rounded-full bg-primary-600/20 px-2.5 py-1 text-xs font-medium text-primary-200"
                          >
                            {provider === 'password' ? 'Password' : provider === 'google' ? 'Google' : 'Facebook'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => void handleUseSavedProfile(profile)}
                      className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500"
                    >
                      Use In This Tab
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSavedProfile(profile.userId)}
                      className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                    >
                      Forget
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
