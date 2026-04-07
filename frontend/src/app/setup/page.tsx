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
import { savePlayerProfile, getPlayerProfile } from '@/utils/localStorage';
import type { PlayerProfile, AuthResponse } from '@shared/types';

export default function SetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLogin, setIsLogin] = useState(true); // Toggle between login and register
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ userId?: string; password?: string; name?: string; age?: string; general?: string }>({});

  // Check if profile already exists
  useEffect(() => {
    const profile = getPlayerProfile();
    if (profile) {
      // User is already logged in, redirect to main menu
      router.push('/');
      return;
    }
  }, [router]);

  const validate = (): boolean => {
    const newErrors: { userId?: string; password?: string; name?: string; age?: string } = {};

    if (!userId.trim()) {
      newErrors.userId = 'User ID is required';
    } else if (userId.trim().length < 3) {
      newErrors.userId = 'User ID must be at least 3 characters';
    } else if (userId.trim().length > 20) {
      newErrors.userId = 'User ID must be less than 20 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(userId.trim())) {
      newErrors.userId = 'User ID can only contain letters, numbers, and underscores';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) return;

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

      const data: AuthResponse = await response.json();

      if (data.success && data.player) {
        // Save to localStorage
        savePlayerProfile(data.player);
        // Redirect to main menu
        router.push('/');
      } else {
        setErrors({ general: data.error || 'Authentication failed' });
      }
    } catch (error) {
      console.error('Auth error:', error);
      setErrors({ general: 'Network error. Please try again.' });
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

            {/* Registration Fields */}
            {!isLogin && (
              <>
                {/* Profile Image */}
                <div className="flex flex-col items-center">
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

                  <div className="flex gap-2">
                    {profileImage && (
                      <button
                        type="button"
                        onClick={handleSkipImage}
                        className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                        disabled={isLoading}
                      >
                        Remove Image
                      </button>
                    )}
                  </div>
                </div>

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
                  {isLogin ? 'Signing In...' : 'Creating Account...'}
                </div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Info */}
        <p className="text-center text-slate-500 text-sm mt-6">
          {isLogin
            ? "Don't have an account? Switch to Sign Up above."
            : "Already have an account? Switch to Sign In above."
          }
        </p>
      </div>
    </div>
  );
}
