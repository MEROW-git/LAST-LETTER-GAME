'use client';

/**
 * Providers Component
 * 
 * Wraps the app with all necessary context providers
 */

import { SocketProvider } from '@/contexts/SocketContext';
import { DialogProvider } from '@/contexts/DialogContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DialogProvider>
      <SocketProvider>
        {children}
      </SocketProvider>
    </DialogProvider>
  );
}
