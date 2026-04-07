'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type DialogVariant = 'alert' | 'confirm';

interface DialogState {
  isOpen: boolean;
  variant: DialogVariant;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

interface DialogContextType {
  showAlert: (message: string, options?: { title?: string; confirmLabel?: string }) => Promise<void>;
  showConfirm: (message: string, options?: { title?: string; confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

const defaultDialogState: DialogState = {
  isOpen: false,
  variant: 'alert',
  title: '',
  message: '',
  confirmLabel: 'OK',
  cancelLabel: 'Cancel',
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(defaultDialogState);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closeDialog = useCallback((result: boolean) => {
    setDialog(defaultDialogState);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const showAlert = useCallback<DialogContextType['showAlert']>((message, options) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setDialog({
        isOpen: true,
        variant: 'alert',
        title: options?.title || 'Notice',
        message,
        confirmLabel: options?.confirmLabel || 'OK',
        cancelLabel: 'Cancel',
      });
    });
  }, []);

  const showConfirm = useCallback<DialogContextType['showConfirm']>((message, options) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        isOpen: true,
        variant: 'confirm',
        title: options?.title || 'Confirm Action',
        message,
        confirmLabel: options?.confirmLabel || 'Confirm',
        cancelLabel: options?.cancelLabel || 'Cancel',
      });
    });
  }, []);

  const value = useMemo(
    () => ({
      showAlert,
      showConfirm,
    }),
    [showAlert, showConfirm]
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="glass-strong w-full max-w-md rounded-3xl border border-slate-700/80 p-6 shadow-2xl animate-scale-in">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">{dialog.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-200">{dialog.message}</p>
            </div>

            <div className="flex justify-end gap-3">
              {dialog.variant === 'confirm' && (
                <button
                  type="button"
                  onClick={() => closeDialog(false)}
                  className="btn btn-secondary"
                >
                  {dialog.cancelLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => closeDialog(true)}
                className={dialog.variant === 'confirm' ? 'btn btn-danger' : 'btn btn-primary'}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
