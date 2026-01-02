// ═══════════════════════════════════════════════════════════════════════════════
// TRADING BOT API
// Start/stop trading strategies, get status
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { 
  TradingBotManager, 
  TradingConfig, 
  DEFAULT_TRADING_CONFIG,
  WalletInfo,
  TradeLog
} from '@/lib/trading-bot';
import { logError } from '@/lib/logger';

// Global bot manager instance (persists across requests)
let botManager: TradingBotManager | null = null;
const tradeLogs: TradeLog[] = [];

function logHandler(log: TradeLog) {
  tradeLogs.unshift(log);
  // Keep only last 100 logs
  if (tradeLogs.length > 100) {
    tradeLogs.pop();
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, strategy, config: userConfig } = body;

    // Get project data - optimized query (only fetch what we need)
    const project = await prisma.project.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        tokenMintAddress: true,
        parryConfig: true,
        wallets: {
          select: {
            id: true,
            address: true,
            encryptedPrivateKey: true,
            isActive: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'No project found' }, { status: 404 });
    }

    // Build wallet info array with encrypted keys
    const wallets: WalletInfo[] = project.wallets.map(w => ({
      id: w.id,
      address: w.address,
      encryptedPrivateKey: w.encryptedPrivateKey,
      isActive: w.isActive,
    }));

    // Parse PARRY config if exists
    let parryConfig: Partial<TradingConfig> = {};
    if (project.parryConfig) {
      try {
        parryConfig = JSON.parse(decrypt(project.parryConfig));
      } catch {
        // Use defaults
      }
    }

    // Merge configs
    const tradingConfig: TradingConfig = {
      ...DEFAULT_TRADING_CONFIG,
      tokenMint: project.tokenMintAddress,
      ...parryConfig,
      ...userConfig,
    };

    // Initialize or update bot manager
    if (!botManager) {
      botManager = new TradingBotManager(tradingConfig, wallets, logHandler);
    } else {
      botManager.updateConfig(tradingConfig);
      botManager.updateWallets(wallets);
    }

    switch (action) {
      case 'start':
        switch (strategy) {
          case 'volumeBot':
            botManager.startVolumeBot();
            return NextResponse.json({ success: true, message: 'Volume Bot started' });
          case 'priceStabilizer':
            botManager.startPriceStabilizer();
            return NextResponse.json({ success: true, message: 'Price Stabilizer started' });
          case 'volumeFarmer':
            botManager.startVolumeFarmer();
            return NextResponse.json({ success: true, message: 'Volume Farmer started' });
          default:
            return NextResponse.json({ error: 'Unknown strategy' }, { status: 400 });
        }

      case 'stop':
        switch (strategy) {
          case 'volumeBot':
            botManager.stopVolumeBot();
            return NextResponse.json({ success: true, message: 'Volume Bot stopped' });
          case 'priceStabilizer':
            botManager.stopPriceStabilizer();
            return NextResponse.json({ success: true, message: 'Price Stabilizer stopped' });
          case 'volumeFarmer':
            botManager.stopVolumeFarmer();
            return NextResponse.json({ success: true, message: 'Volume Farmer stopped' });
          case 'all':
            botManager.stopAll();
            return NextResponse.json({ success: true, message: 'All strategies stopped' });
          default:
            return NextResponse.json({ error: 'Unknown strategy' }, { status: 400 });
        }

      case 'status':
        return NextResponse.json({
          success: true,
          status: {
            volumeBot: !!botManager && tradingConfig.volumeBotEnabled,
            priceStabilizer: !!botManager && tradingConfig.priceStabilizerEnabled,
            volumeFarmer: !!botManager && tradingConfig.volumeFarmerEnabled,
          },
          logs: tradeLogs.slice(0, 20),
        });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    logError('Trading API error', error as Error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Trading error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return recent trade logs and status
    return NextResponse.json({
      success: true,
      logs: tradeLogs.slice(0, 50),
      isRunning: !!botManager,
    });
  } catch (error) {
    logError('Trading API GET error', error as Error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}

