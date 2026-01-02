// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK ENDPOINT
// Provides system status for monitoring and diagnostics
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getConnection } from '@/lib/solana';
import { logInfo, logError } from '@/lib/logger';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      responseTime?: number;
      error?: string;
    };
    rpc: {
      status: 'ok' | 'error';
      responseTime?: number;
      error?: string;
      endpoint?: string;
    };
    apis: {
      moralis: {
        status: 'ok' | 'error' | 'not_configured';
        error?: string;
      };
      dexscreener: {
        status: 'ok' | 'error';
        responseTime?: number;
        error?: string;
      };
    };
    environment: {
      status: 'ok' | 'warning';
      missing?: string[];
      configured?: string[];
    };
  };
  uptime: number;
  version: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check database connection
 */
async function checkDatabase(): Promise<{ status: 'ok' | 'error'; responseTime?: number; error?: string }> {
  const startTime = Date.now();
  try {
    // Simple query to check database connection
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    return { status: 'ok', responseTime };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'error',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Solana RPC connection
 */
async function checkRPC(): Promise<{ status: 'ok' | 'error'; responseTime?: number; error?: string; endpoint?: string }> {
  const startTime = Date.now();
  try {
    const connection = getConnection();
    const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    const endpoint = heliusKey 
      ? 'https://mainnet.helius-rpc.com/?api-key=***'
      : 'https://api.mainnet-beta.solana.com';
    
    // Get latest blockhash (lightweight operation)
    await connection.getLatestBlockhash('confirmed');
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'ok',
      responseTime,
      endpoint,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'error',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check external APIs
 */
async function checkAPIs(): Promise<{
  moralis: { status: 'ok' | 'error' | 'not_configured'; error?: string };
  dexscreener: { status: 'ok' | 'error'; responseTime?: number; error?: string };
}> {
  const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
  const moralisStatus: { status: 'ok' | 'error' | 'not_configured'; error?: string } = 
    moralisKey 
      ? { status: 'ok' } // API key exists, assume it's working (don't make actual request to avoid rate limits)
      : { status: 'not_configured' };
  
  // Check DexScreener (public API, no key needed)
  const dexStartTime = Date.now();
  try {
    const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    const responseTime = Date.now() - dexStartTime;
    if (response.ok) {
      return {
        moralis: moralisStatus,
        dexscreener: { status: 'ok', responseTime },
      };
    } else {
      return {
        moralis: moralisStatus,
        dexscreener: { 
          status: 'error', 
          responseTime,
          error: `HTTP ${response.status}`,
        },
      };
    }
  } catch (error) {
    const responseTime = Date.now() - dexStartTime;
    return {
      moralis: moralisStatus,
      dexscreener: {
        status: 'error',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Check environment variables
 */
function checkEnvironment(): { status: 'ok' | 'warning'; missing?: string[]; configured?: string[] } {
  const required = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'ENCRYPTION_KEY',
  ];
  
  const optional = [
    'NEXT_PUBLIC_HELIUS_API_KEY',
    'NEXT_PUBLIC_MORALIS_API_KEY',
    'DEEPSEEK_API_KEY',
    'TWITTER_API_KEY',
  ];
  
  const missing: string[] = [];
  const configured: string[] = [];
  
  // Check required
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    } else {
      configured.push(key);
    }
  }
  
  // Check optional
  for (const key of optional) {
    if (process.env[key]) {
      configured.push(key);
    }
  }
  
  return {
    status: missing.length > 0 ? 'warning' : 'ok',
    missing: missing.length > 0 ? missing : undefined,
    configured,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════

const startTime = Date.now();

export async function GET() {
  try {
    logInfo('Health check requested');
    
    // Run all checks in parallel
    const [database, rpc, apis, environment] = await Promise.all([
      checkDatabase(),
      checkRPC(),
      checkAPIs(),
      Promise.resolve(checkEnvironment()),
    ]);
    
    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Critical checks (database, RPC)
    if (database.status === 'error' || rpc.status === 'error') {
      overallStatus = 'unhealthy';
    } else if (
      apis.moralis.status === 'error' || 
      apis.dexscreener.status === 'error' ||
      environment.status === 'warning'
    ) {
      overallStatus = 'degraded';
    }
    
    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        rpc,
        apis,
        environment,
      },
      uptime: Date.now() - startTime,
      version: process.env.npm_package_version || '0.1.0',
    };
    
    // Return appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    logError('Health check error', error as Error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
