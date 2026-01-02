// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING MIDDLEWARE
// Protects API endpoints from abuse and DDoS attacks
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getRateLimitConfigForPath, logRateLimitViolation } from '@/lib/rate-limit';

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT STORE (In-Memory - can be upgraded to Redis for production)
// ═══════════════════════════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Store: identifier -> rate limit entry
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes (only in Node.js environment)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get identifier for rate limiting (user ID or IP)
 */
function getIdentifier(request: NextRequest, userId?: string | null): string {
  // Prefer user ID if available (more accurate)
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fallback to IP address (extract from headers)
  const ip = 
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
    request.headers.get('x-real-ip') || 
    request.headers.get('cf-connecting-ip') || // Cloudflare
    'unknown';
  
  return `ip:${ip}`;
}

/**
 * Check rate limit and return whether request should be allowed
 */
function checkRateLimit(identifier: string, config: { windowMs: number; maxRequests: number }): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  // No entry exists or window expired - create new entry
  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime,
    });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }
  
  // Entry exists and window is still active
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROXY MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Only apply rate limiting to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Skip rate limiting for NextAuth routes (they have their own protection)
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }
  
  // Skip rate limiting for health check (needs to be always available)
  if (pathname.startsWith('/api/health')) {
    return NextResponse.next();
  }
  
  // Skip rate limiting for public dashboard endpoints (read-only, public access)
  if (pathname.startsWith('/api/trades')) {
    return NextResponse.next();
  }
  
  if (pathname.startsWith('/api/indicators')) {
    return NextResponse.next();
  }
  
  // Skip rate limiting for public PARRY status (GET only, used by dashboard)
  if (pathname.startsWith('/api/parry') && request.method === 'GET') {
    return NextResponse.next();
  }
  
  // Get rate limit config for this endpoint
  const config = getRateLimitConfigForPath(pathname);
  
  // Try to get user ID from JWT token (for authenticated requests)
  let userId: string | null = null;
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });
    userId = token?.sub || null;
  } catch (error) {
    // Token parsing failed - will use IP-based limiting
  }
  
  // Get identifier (user ID or IP)
  const identifier = getIdentifier(request, userId);
  
  // Check rate limit
  const rateLimit = checkRateLimit(identifier, config);
  
  if (!rateLimit.allowed) {
    // Rate limit exceeded - log violation
    logRateLimitViolation(identifier, pathname, config);
    
    // Rate limit exceeded
    const response = NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again after ${new Date(rateLimit.resetTime).toISOString()}`,
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
      },
      { status: 429 }
    );
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());
    response.headers.set('Retry-After', Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString());
    
    return response;
  }
  
  // Request allowed - add rate limit headers
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
  response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());
  
  return response;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATCHER - Only run middleware on API routes
// ═══════════════════════════════════════════════════════════════════════════════

export const config = {
  matcher: '/api/:path*',
};
