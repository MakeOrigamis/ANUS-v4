'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logError } from '@/lib/logger-client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary Component
 * Catches React component errors and displays user-friendly error messages
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to server
    logError('React Error Boundary caught error', error, {
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
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
                  <h1 className="text-2xl font-light text-white mb-1">SYSTEM ERROR</h1>
                  <p className="text-sm text-[#A1A1AA]">An unexpected error occurred</p>
                </div>
              </div>

              {/* Error Message */}
              <div className="mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400 font-mono mb-2">
                  {this.state.error?.message || 'Unknown error occurred'}
                </p>
                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <details className="mt-4">
                    <summary className="text-xs text-[#666] cursor-pointer mb-2">
                      Technical Details (Development Only)
                    </summary>
                    <pre className="text-xs text-[#666] overflow-auto max-h-48 p-2 bg-black/20 rounded">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={this.handleReset}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#00F2FF]/20 text-[#00F2FF] rounded-lg text-sm font-medium transition-all duration-200 hover:bg-[#00F2FF]/30"
                  style={{ textShadow: '0 0 8px rgba(0,242,255,0.6)' }}
                >
                  <RefreshCw className="w-4 h-4" />
                  TRY AGAIN
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
                If this error persists, please contact support with the error details above.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
