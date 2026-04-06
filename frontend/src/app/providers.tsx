'use client';

/**
 * Providers Component
 * 
 * Wraps the app with all necessary context providers
 */

import { SocketProvider } from '@/contexts/SocketContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      {children}
    </SocketProvider>
  );
}
