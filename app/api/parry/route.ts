import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createParryBrain, ParryBrain } from '@/lib/parry-brain';
import { logError } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// User-specific PARRY instances (Map: userId -> ParryBrain)
// ═══════════════════════════════════════════════════════════════════════════════
const parryInstances = new Map<string, ParryBrain>();

function getParryInstance(userId: string): ParryBrain | null {
  return parryInstances.get(userId) || null;
}

function setParryInstance(userId: string, instance: ParryBrain | null): void {
  if (instance) {
    parryInstances.set(userId, instance);
  } else {
    parryInstances.delete(userId);
  }
}

/**
 * GET - Get PARRY status
 */
export async function GET() {
  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY: Session validation
  // ═══════════════════════════════════════════════════════════════════════════
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized',
    }, { status: 401 });
  }

  const parryInstance = getParryInstance(session.user.id);
  if (!parryInstance) {
    return NextResponse.json({
      status: 'offline',
      message: 'PARRY is not running. POST to start her.',
    });
  }
  
  const state = parryInstance.getState();
  const config = parryInstance.getConfig();
  
  return NextResponse.json({
    status: state.isRunning ? 'running' : 'stopped',
    uptime: state.isRunning ? Date.now() - state.startTime : 0,
    token: {
      mint: state.tokenMint,
      name: state.tokenName,
      symbol: state.tokenSymbol,
    },
    position: state.position,
    marketState: state.marketState ? {
      phase: state.marketState.phase,
      price: state.marketState.currentPrice,
      rsi: state.marketState.rsi14,
      netVolume5m: state.marketState.netVolume5m,
    } : null,
    trades: state.trades.length,
    tweets: state.tweets.length,
    lastTrade: state.lastTrade,
    lastTweet: state.lastTweet,
    errors: state.errors.slice(-5), // Last 5 errors
    config: {
      tradingEnabled: config.tradingEnabled,
      twitterEnabled: config.twitterEnabled,
      dryRun: config.dryRun,
    },
  });
}

/**
 * POST - Start/Control PARRY
 * Body: {
 *   action: 'start' | 'stop' | 'tweet',
 *   tokenMint?: string,
 *   walletPrivateKey?: string,
 *   config?: Partial<ParryConfig>
 * }
 */
export async function POST(request: Request) {
  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY: Session validation
    // ═══════════════════════════════════════════════════════════════════════════
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
      }, { status: 401 });
    }

    const body = await request.json();
    const { action, tokenMint, tweetType, config } = body;
    
    // Get user-specific instance
    const parryInstance = getParryInstance(session.user.id);
    
    switch (action) {
      case 'start': {
        // Check if already running for this user
        if (parryInstance?.getState().isRunning) {
          return NextResponse.json({
            success: false,
            error: 'PARRY is already running for your account',
          }, { status: 400 });
        }

        // Read private key from server-side env (NEVER from client!)
        // Use DEV_WALLET_PRIVATE_KEY for direct Solana transactions
        const walletPrivateKey = process.env.DEV_WALLET_PRIVATE_KEY;
        
        if (!walletPrivateKey) {
          return NextResponse.json({
            success: false,
            error: 'DEV_WALLET_PRIVATE_KEY not configured in .env - Add your dev wallet private key to trade',
          }, { status: 400 });
        }
        
        // Token mint is optional for dry run / testing
        const finalTokenMint = tokenMint || process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT || 'TEST_MODE';
        
        // Stop existing instance for this user if it exists
        if (parryInstance) {
          parryInstance.stop();
        }
        
        // Create new instance for this user
        const newInstance = createParryBrain({
          tokenMint: finalTokenMint,
          walletPrivateKey,
          dryRun: config?.dryRun ?? true, // Default to dry run for safety
          tradingEnabled: config?.tradingEnabled ?? false,
          twitterEnabled: config?.twitterEnabled ?? false,
          tweetIntervalMinutes: config?.tweetIntervalMinutes ?? 30,
          verbose: true,
        });
        
        // Store instance for this user
        setParryInstance(session.user.id, newInstance);
        
        // Start PARRY
        await newInstance.start();
        
        return NextResponse.json({
          success: true,
          message: `PARRY started! Token: ${finalTokenMint.slice(0, 8)}... DryRun: ${config?.dryRun ?? true}`,
          status: 'running',
          tokenMint: finalTokenMint,
          dryRun: config?.dryRun ?? true,
        });
      }
      
      case 'stop': {
        if (!parryInstance) {
          return NextResponse.json({
            success: false,
            error: 'PARRY is not running',
          }, { status: 400 });
        }
        
        parryInstance.stop();
        setParryInstance(session.user.id, null);
        
        return NextResponse.json({
          success: true,
          message: 'PARRY stopped',
          status: 'stopped',
        });
      }
      
      case 'tweet': {
        if (!parryInstance) {
          return NextResponse.json({
            success: false,
            error: 'PARRY is not running',
          }, { status: 400 });
        }
        
        const post = await parryInstance.manualTweet(tweetType || 'schizo');
        
        return NextResponse.json({
          success: true,
          post,
        });
      }
      
      case 'update-config': {
        if (!parryInstance) {
          return NextResponse.json({
            success: false,
            error: 'PARRY is not running',
          }, { status: 400 });
        }
        
        parryInstance.updateConfig(config);
        
        return NextResponse.json({
          success: true,
          message: 'Config updated',
        });
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: start, stop, tweet, update-config',
        }, { status: 400 });
    }
    
  } catch (error) {
    logError('PARRY API error', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

