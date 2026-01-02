// ═══════════════════════════════════════════════════════════════════════════════
// PARRY ENGINE API
// Start/Stop/Status of the autonomous trading brain
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import {
  createParryEngine,
  getParryEngine,
  stopParryEngine,
  type ParryConfig,
  type WalletInfo,
  type ParryLogEntry,
} from '@/lib/parry-engine';
import { logError } from '@/lib/logger';

// Store logs in memory for API access
const engineLogs: ParryLogEntry[] = [];

function logHandler(log: ParryLogEntry) {
  engineLogs.unshift(log);
  if (engineLogs.length > 100) engineLogs.pop();
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // Get project data - optimized query (only fetch what we need)
    const project = await prisma.project.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        tokenMintAddress: true,
        parryConfig: true,
        encryptedDeepseekKey: true,
        customPersonality: true,
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

    switch (action) {
      case 'start': {
        const existingEngine = getParryEngine();
        if (existingEngine?.isActive()) {
          return NextResponse.json({ 
            success: false, 
            error: 'PARRY is already running' 
          });
        }

        // Build wallet info
        const wallets: WalletInfo[] = project.wallets.map(w => ({
          id: w.id,
          address: w.address,
          encryptedPrivateKey: w.encryptedPrivateKey,
          isActive: w.isActive,
        }));

        if (wallets.filter(w => w.isActive).length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No active wallets. Add and activate at least one wallet.',
          });
        }

        // Parse PARRY config
        let parryConfig: any = {};
        if (project.parryConfig) {
          try {
            parryConfig = JSON.parse(decrypt(project.parryConfig));
          } catch {
            // Use defaults
          }
        }

        // Get DeepSeek API key if set
        let deepseekApiKey: string | undefined;
        if (project.encryptedDeepseekKey) {
          try {
            deepseekApiKey = decrypt(project.encryptedDeepseekKey);
          } catch {}
        }

        // Build full config
        const config: ParryConfig = {
          tokenMint: project.tokenMintAddress,
          // Strategy toggles
          volumeBotEnabled: parryConfig.volumeBot || false,
          priceStabilizerEnabled: parryConfig.priceStabilizer || false,
          volumeFarmerEnabled: parryConfig.volumeFarmer || false,
          // Market cap thresholds
          minMcToSell: parryConfig.minMcToSell || 250000,
          lightMcThreshold: parryConfig.lightMcThreshold || 250000,
          mediumMcThreshold: parryConfig.mediumMcThreshold || 500000,
          heavyMcThreshold: parryConfig.heavyMcThreshold || 1000000,
          // Sell percentages
          lightSellPercent: parryConfig.lightSellPercent || 6,
          mediumSellPercent: parryConfig.mediumSellPercent || 10,
          heavySellPercent: parryConfig.heavySellPercent || 14,
          volumeFarmingPercent: parryConfig.volumeFarmingPercent || 8,
          // Trade limits
          maxSellPerTrade: parryConfig.maxSellPerTrade || 2,
          maxBuyPerTrade: parryConfig.maxBuyPerTrade || 1,
          cooldownSeconds: parryConfig.cooldownSeconds || 60,
          // Wallet limits
          maxSupplyPercent: parryConfig.maxSupplyPercent || 2,
          maxSolPerWallet: parryConfig.maxSolPerWallet || 10,
          // Execution
          slippageBps: (parryConfig.slippage || 10) * 100,
          // AI
          deepseekApiKey,
          customPersonality: project.customPersonality || undefined,
        };

        // Create and start engine
        const engine = createParryEngine(config, wallets, logHandler);
        
        // Start in background (don't await)
        engine.start().catch(err => {
          logError('PARRY engine error', err as Error);
        });

        return NextResponse.json({
          success: true,
          message: 'PARRY Engine started',
          status: engine.getStatus(),
        });
      }

      case 'stop': {
        stopParryEngine();
        return NextResponse.json({
          success: true,
          message: 'PARRY Engine stopped',
        });
      }

      case 'status': {
        const engine = getParryEngine();
        return NextResponse.json({
          success: true,
          running: engine?.isActive() || false,
          status: engine?.getStatus() || null,
          logs: engineLogs.slice(0, 50),
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    logError('PARRY API error', error as Error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const engine = getParryEngine();
    
    return NextResponse.json({
      success: true,
      running: engine?.isActive() || false,
      status: engine?.getStatus() || null,
      logs: engineLogs.slice(0, 50),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}

