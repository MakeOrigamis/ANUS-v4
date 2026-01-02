// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT UTILITIES
// Helper functions for rate limiting in API routes
// ═══════════════════════════════════════════════════════════════════════════════

import { logWarn } from './logger';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

/**
 * Rate limit configuration for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
  // Trading endpoints - very strict (critical operations)
  TRADING: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  PARRY_ENGINE: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  TRADING_BOT: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 per minute
  
  // PARRY control - moderate
  PARRY: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 per minute
  
  // AI endpoints - moderate (can be expensive)
  AI: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 per minute
  
  // Twitter - moderate
  TWITTER: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 per minute
  
  // Claim endpoint - strict (financial operation)
  CLAIM: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  
  // Token sync - moderate (external API calls, but needed for dashboard/parry-core)
  TOKEN_SYNC: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 per minute (increased for dashboard usage)
  
  // Default for all other API endpoints
  DEFAULT: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 per minute
} as const;

/**
 * Get rate limit config for a given path
 */
export function getRateLimitConfigForPath(pathname: string): { windowMs: number; maxRequests: number } {
  if (pathname.startsWith('/api/trade')) {
    return RATE_LIMIT_CONFIGS.TRADING;
  }
  if (pathname.startsWith('/api/parry-engine')) {
    return RATE_LIMIT_CONFIGS.PARRY_ENGINE;
  }
  if (pathname.startsWith('/api/trading')) {
    return RATE_LIMIT_CONFIGS.TRADING_BOT;
  }
  if (pathname.startsWith('/api/parry')) {
    return RATE_LIMIT_CONFIGS.PARRY;
  }
  if (pathname.startsWith('/api/ai')) {
    return RATE_LIMIT_CONFIGS.AI;
  }
  if (pathname.startsWith('/api/twitter')) {
    return RATE_LIMIT_CONFIGS.TWITTER;
  }
  if (pathname.startsWith('/api/claim')) {
    return RATE_LIMIT_CONFIGS.CLAIM;
  }
  if (pathname.startsWith('/api/token')) {
    return RATE_LIMIT_CONFIGS.TOKEN_SYNC; // Token sync: 10 per minute
  }
  
  return RATE_LIMIT_CONFIGS.DEFAULT;
}

/**
 * Log rate limit violation (for monitoring)
 */
export function logRateLimitViolation(identifier: string, pathname: string, config: { windowMs: number; maxRequests: number }): void {
  logWarn('Rate limit exceeded', {
    identifier,
    pathname,
    limit: config.maxRequests,
    windowMs: config.windowMs,
  });
}
