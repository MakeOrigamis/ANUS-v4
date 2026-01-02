'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        {children}
      </SessionProvider>
    </ErrorBoundary>
  );
}

