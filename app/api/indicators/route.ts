// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICAL INDICATORS API
// Returns technical indicators for dashboard visualization
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { calculateIndicators } from '@/lib/chart-data';
import { logError, logDebug } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE (In-Memory - reduces API calls)
// ═══════════════════════════════════════════════════════════════════════════════

interface CachedIndicators {
  indicators: any;
  timestamp: number;
}

const indicatorsCache = new Map<string, CachedIndicators>();
const CACHE_TTL = 30 * 1000; // 30 seconds cache

function getCachedIndicators(tokenMint: string): any | null {
  const cached = indicatorsCache.get(tokenMint);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.indicators;
  }
  return null;
}

function setCachedIndicators(tokenMint: string, indicators: any): void {
  indicatorsCache.set(tokenMint, {
    indicators,
    timestamp: Date.now(),
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenMint = searchParams.get('mint');

    if (!tokenMint) {
      return NextResponse.json({ 
        success: false,
        error: 'Token mint address is required' 
      }, { status: 400 });
    }

    logDebug('Fetching technical indicators', { tokenMint });

    // Check cache first
    const cached = getCachedIndicators(tokenMint);
    if (cached) {
      logDebug('Returning cached indicators', { age: Date.now() - (indicatorsCache.get(tokenMint)?.timestamp || 0) });
      return NextResponse.json({
        success: true,
        indicators: cached,
        cached: true,
      });
    }

    // Calculate indicators
    const indicators = await calculateIndicators(tokenMint);
    
    if (!indicators) {
      return NextResponse.json({
        success: false,
        error: 'Could not calculate indicators. Token may not have enough price history.',
        indicators: null,
      }, { status: 404 });
    }

    // Cache the results
    setCachedIndicators(tokenMint, indicators);

    return NextResponse.json({
      success: true,
      indicators,
      cached: false,
    });

  } catch (error) {
    logError('Indicators API error', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      indicators: null,
    }, { status: 500 });
  }
}
