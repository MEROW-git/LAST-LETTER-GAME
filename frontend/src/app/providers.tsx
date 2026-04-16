'use client';

/**
 * Providers Component
 * 
 * Wraps the app with all necessary context providers
 */

import { SocketProvider } from '@/contexts/SocketContext';
import { DialogProvider } from '@/contexts/DialogContext';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DialogProvider>
        <SocketProvider>
          {children}
        </SocketProvider>
      </DialogProvider>
    </SessionProvider>
  );
}
