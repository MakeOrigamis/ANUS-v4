'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { logError } from '@/lib/logger-client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Hub-specific Error Page
 * Catches errors in the hub route and displays user-friendly error messages
 */
export default function HubError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logError('Hub Error Page caught error', error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#A1A1AA] font-mono flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-[#0A0A0A] border border-red-500/20 rounded-lg p-8 shadow-2xl">
          {/* Error Icon */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-white mb-1">HUB ERROR</h1>
              <p className="text-sm text-[#A1A1AA]">An error occurred in the operations hub</p>
            </div>
          </div>

          {/* Error Message */}
          <div className="mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400 font-mono mb-2">
              {error.message || 'Unknown error occurred'}
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
              TRY AGAIN
            </button>
            <Link
              href="/hub"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/5 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:bg-white/10 border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              BACK TO HUB
            </Link>
            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/5 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:bg-white/10 border border-white/10"
            >
              <Home className="w-4 h-4" />
              GO HOME
            </Link>
          </div>

          {/* Help Text */}
          <p className="mt-6 text-xs text-[#666] text-center">
            If this error persists, please contact support with the error details above.
          </p>
        </div>
      </div>
    </div>
  );
}
