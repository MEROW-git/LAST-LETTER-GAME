'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProviders, signIn, signOut, useSession } from 'next-auth/react';
import {
  clearPlayerProfile,
  generateRandomAvatar,
  getAppSettings,
  getPlayerProfile,
  saveAppSettings,
  savePlayerProfile,
} from '@/utils/localStorage';
import type { AuthResponse, PlayerProfile } from '@shared/types';

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasTriedGoogleLinkRef = useRef(false);
  const { data: session, status } = useSession();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [availableProviders, setAvailableProviders] = useState<Record<string, { id: string; name: string }> | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [volume, setVolume] = useState(70);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

  useEffect(() => {
    const existingProfile = getPlayerProfile();
    if (!existingProfile) {
      router.push('/setup');
      return;
    }

    const appSettings = getAppSettings();
    setProfile(existingProfile);
    setName(existingProfile.name);
    setAge(String(existingProfile.age));
    setProfileImage(existingProfile.profileImage || generateRandomAvatar(existingProfile.userId));
    setVolume(appSettings.volume);
  }, [router]);

  useEffect(() => {
    void (async () => {
      const providers = await getProviders();
      setAvailableProviders(providers ?? {});
    })();
  }, []);

  useEffect(() => {
    if (!profile || status !== 'authenticated' || session?.user?.provider !== 'google' || !session.user.providerAccountId) {
      hasTriedGoogleLinkRef.current = false;
      return;
    }

    if (profile.authProviders.includes('google') || hasTriedGoogleLinkRef.current) {
      return;
    }

    hasTriedGoogleLinkRef.current = true;
    setIsLinkingGoogle(true);
    setOauthError(null);
    setOauthMessage(null);

    void (async () => {
      try {
        const response = await fetch('/api/account/link-oauth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: profile.userId,
            provider: 'google',
            providerUserId: session.user?.providerAccountId,
            email: session.user?.email || undefined,
          }),
        });

        const data = (await response.json()) as AuthResponse;
        if (!data.success || !data.player) {
          throw new Error(data.error || 'Failed to connect Google account');
        }

        const savedProfile = savePlayerProfile(data.player);
        setProfile(savedProfile);
        setOauthMessage('Google account connected.');
      } catch (error) {
        setOauthError(error instanceof Error ? error.message : 'Failed to connect Google account');
      } finally {
        setIsLinkingGoogle(false);
      }
    })();
  }, [profile, session, status]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setProfileError(null);
    setProfileMessage(null);

    const parsedAge = parseInt(age, 10);
    if (!name.trim()) {
      setProfileError('Name is required');
      return;
    }
    if (name.trim().length < 2 || name.trim().length > 20) {
      setProfileError('Name must be between 2 and 20 characters');
      return;
    }
    if (Number.isNaN(parsedAge) || parsedAge < 5 || parsedAge > 120) {
      setProfileError('Age must be between 5 and 120');
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile.userId,
          name: name.trim(),
          age: parsedAge,
          profileImage: profileImage || undefined,
        }),
      });

      const data = (await response.json()) as AuthResponse;
      if (!data.success || !data.player) {
        throw new Error(data.error || 'Failed to save profile');
      }

      const savedProfile = savePlayerProfile(data.player);
      setProfile(savedProfile);
      setProfileImage(savedProfile.profileImage || '');
      setProfileMessage('Profile updated.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setPasswordError(null);
    setPasswordMessage(null);

    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setIsSavingPassword(true);

    try {
      const response = await fetch('/api/account/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile.userId,
          currentPassword: currentPassword || undefined,
          newPassword,
        }),
      });

      const data = (await response.json()) as AuthResponse;
      if (!data.success || !data.player) {
        throw new Error(data.error || 'Failed to update password');
      }

      const savedProfile = savePlayerProfile(data.player);
      setProfile(savedProfile);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage(savedProfile.authProviders.includes('password') ? 'Password updated.' : 'Password saved.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleVolumeChange = (nextVolume: number) => {
    setVolume(nextVolume);
    saveAppSettings({ volume: nextVolume });
  };

  const handleConnectGoogle = async () => {
    setOauthError(null);
    setOauthMessage(null);
    await signIn('google', { callbackUrl: '/settings' });
  };

  const handleSwitchAccount = async () => {
    clearPlayerProfile();
    await signOut({ redirect: false });
    router.push('/setup');
    router.refresh();
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white neon-text">Settings</h1>
            <p className="text-slate-300">Manage your profile, account, and sound preferences</p>
          </div>
          <div className="w-16"></div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={handleSaveProfile} className="card space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-white">Profile</h2>
              <p className="text-sm text-slate-400">Change your display name, age, and avatar.</p>
            </div>

            <div className="flex flex-col items-center rounded-xl border border-slate-600/60 bg-slate-800/40 px-4 py-5">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-slate-600">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">🎮</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 hover:bg-primary-500 rounded-full flex items-center justify-center transition-colors"
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
                  onClick={() => setProfileImage(generateRandomAvatar(profile.userId || name.trim() || undefined))}
                  className="text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Random Avatar
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={() => setProfileImage('')}
                  className="text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">Your Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                maxLength={20}
              />
            </div>

            <div>
              <label htmlFor="age" className="block text-sm font-medium text-slate-300 mb-2">Your Age</label>
              <input
                id="age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="input"
                min={5}
                max={120}
              />
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3">
              <p className="text-sm text-slate-400">User ID</p>
              <p className="font-semibold text-white">{profile.userId}</p>
            </div>

            {profileError && <p className="text-sm text-danger-400">{profileError}</p>}
            {profileMessage && <p className="text-sm text-success-400">{profileMessage}</p>}

            <button type="submit" className="w-full btn btn-primary" disabled={isSavingProfile}>
              {isSavingProfile ? 'Saving Profile...' : 'Save Profile'}
            </button>
          </form>

          <div className="space-y-6">
            <form onSubmit={handleSavePassword} className="card space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Password</h2>
                <p className="text-sm text-slate-400">
                  {profile.authProviders.includes('password')
                    ? 'Change the password for your account.'
                    : 'Set a password so you can also sign in without Google.'}
                </p>
              </div>

              {profile.authProviders.includes('password') && (
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-300 mb-2">Current Password</label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input"
                  />
                </div>
              )}

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                />
              </div>

              {passwordError && <p className="text-sm text-danger-400">{passwordError}</p>}
              {passwordMessage && <p className="text-sm text-success-400">{passwordMessage}</p>}

              <button type="submit" className="w-full btn btn-secondary" disabled={isSavingPassword}>
                {isSavingPassword ? 'Saving Password...' : profile.authProviders.includes('password') ? 'Change Password' : 'Set Password'}
              </button>
            </form>

            <div className="card space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Connected Accounts</h2>
                <p className="text-sm text-slate-400">Link Google to your account for easier sign in.</p>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3">
                <p className="text-sm text-slate-400 mb-1">Current sign-in methods</p>
                <div className="flex flex-wrap gap-2">
                  {profile.authProviders.map((provider) => (
                    <span key={provider} className="rounded-full bg-primary-600/20 px-3 py-1 text-sm font-medium text-primary-200">
                      {provider === 'password' ? 'Password' : provider === 'google' ? 'Google' : 'Facebook'}
                    </span>
                  ))}
                </div>
              </div>

              {availableProviders?.google ? (
                profile.authProviders.includes('google') ? (
                  <div className="rounded-xl border border-success-500/40 bg-success-500/10 px-4 py-3">
                    <p className="text-sm text-success-300">Google is already connected to this account.</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleConnectGoogle()}
                    className="w-full rounded-lg border border-slate-600 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLinkingGoogle || status === 'loading'}
                  >
                    {isLinkingGoogle ? 'Connecting Google...' : 'Connect Google'}
                  </button>
                )
              ) : (
                <p className="text-sm text-slate-400">Google sign-in will appear here after Google OAuth is configured.</p>
              )}

              {oauthError && <p className="text-sm text-danger-400">{oauthError}</p>}
              {oauthMessage && <p className="text-sm text-success-400">{oauthMessage}</p>}
            </div>

            <div className="card space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Volume</h2>
                <p className="text-sm text-slate-400">Save your sound level now so we can use it when background audio is added.</p>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-300">Master Volume</span>
                  <span className="text-sm font-semibold text-white">{volume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSwitchAccount()}
              className="w-full btn btn-danger"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
