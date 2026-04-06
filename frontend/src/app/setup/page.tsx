'use client';

/**
 * Setup Page
 * 
 * First-time player setup:
 * - Name (required)
 * - Age (required)
 * - Profile picture (optional)
 * 
 * Saves to localStorage, redirects to main menu on completion
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { savePlayerProfile, getPlayerProfile, generateRandomAvatar } from '@/utils/localStorage';

export default function SetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; age?: string }>({});

  // Check if profile already exists
  useEffect(() => {
    const profile = getPlayerProfile();
    if (profile) {
      // Pre-fill existing data
      setName(profile.name);
      setAge(profile.age.toString());
      setProfileImage(profile.profileImage || '');
    }
    setIsLoading(false);
  }, []);

  const validate = (): boolean => {
    const newErrors: { name?: string; age?: string } = {};
    
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    // Save profile
    savePlayerProfile({
      name: name.trim(),
      age: parseInt(age),
      profileImage: profileImage || undefined,
    });
    
    // Redirect to main menu
    router.push('/');
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

  const handleGenerateAvatar = () => {
    setProfileImage(generateRandomAvatar(name || 'player'));
  };

  const handleSkipImage = () => {
    setProfileImage('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Last Letter</h1>
          <p className="text-slate-400">Create your player profile</p>
        </div>

        {/* Setup Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                <button
                  type="button"
                  onClick={handleGenerateAvatar}
                  className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Generate Avatar
                </button>
                {profileImage && (
                  <>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={handleSkipImage}
                      className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      Remove
                    </button>
                  </>
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
                placeholder="Enter your name"
                className={`input ${errors.name ? 'border-danger-500 ring-1 ring-danger-500' : ''}`}
                maxLength={20}
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
              />
              {errors.age && (
                <p className="mt-1 text-sm text-danger-400">{errors.age}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full btn btn-primary"
            >
              Save Profile
            </button>

            {/* Skip option for existing profiles */}
            {getPlayerProfile() && (
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full btn btn-secondary"
              >
                Cancel
              </button>
            )}
          </form>
        </div>

        {/* Info */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Your profile is stored locally in your browser.
        </p>
      </div>
    </div>
  );
}
