'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global Error Handler (Root Layout Level)
 * Catches errors that occur in the root layout itself
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log to console (logger might not be available at this level)
    console.error('Global error caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-[#050505] text-[#A1A1AA] font-mono flex items-center justify-center p-6">
          <div className="max-w-2xl w-full">
            <div className="bg-[#0A0A0A] border border-red-500/20 rounded-lg p-8 shadow-2xl">
              {/* Error Icon */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-light text-white mb-1">CRITICAL SYSTEM ERROR</h1>
                  <p className="text-sm text-[#A1A1AA]">A critical error occurred in the application root</p>
                </div>
              </div>

              {/* Error Message */}
              <div className="mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400 font-mono mb-2">
                  {error.message || 'Unknown critical error occurred'}
                </p>
                {error.digest && (
                  <p className="text-xs text-[#666] mt-2">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={reset}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#00F2FF]/20 text-[#00F2FF] rounded-lg text-sm font-medium transition-all duration-200 hover:bg-[#00F2FF]/30"
                  style={{ textShadow: '0 0 8px rgba(0,242,255,0.6)' }}
                >
                  <RefreshCw className="w-4 h-4" />
                  RELOAD APPLICATION
                </button>
                <a
                  href="/"
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/5 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:bg-white/10 border border-white/10"
                >
                  <Home className="w-4 h-4" />
                  GO HOME
                </a>
              </div>

              {/* Help Text */}
              <p className="mt-6 text-xs text-[#666] text-center">
                This is a critical error. Please refresh the page or contact support if the problem persists.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
