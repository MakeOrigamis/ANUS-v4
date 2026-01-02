import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logError } from '@/lib/logger';
import {
  claimCreatorFees,
  smartBuy,
  smartSell,
  buyOnBondingCurve,
  sellOnBondingCurve,
  swapWithJupiter,
  fetchPumpFunToken,
  getSOLBalance,
  getTokenBalance,
} from '@/lib/solana';
import {
  validateTradeAmount,
  getWalletBalanceForValidation,
} from '@/lib/trade-validation';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Check trading status
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optimized query - only fetch needed fields
    const project = await prisma.project.findUnique({
      where: { userId: session.user.id },
      select: {
        tokenMintAddress: true,
        encryptedPrivateKey: true,
        wallets: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'No project found' }, { status: 404 });
    }

    return NextResponse.json({
      configured: true,
      tokenMint: project.tokenMintAddress,
      hasDevWallet: !!project.encryptedPrivateKey,
      operationalWallets: project.wallets.length,
      endpoints: {
        claim: 'POST /api/trade { action: "claim" }',
        buy: 'POST /api/trade { action: "buy", amount: 0.1, walletId?: "..." }',
        sell: 'POST /api/trade { action: "sell", amount: 1000, walletId?: "..." }',
      },
    });
  } catch (error) {
    logError('Trade API GET error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Execute trading actions
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optimized query - only fetch needed fields
    const project = await prisma.project.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        tokenMintAddress: true,
        encryptedPrivateKey: true,
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

    const body = await request.json();
    const { 
      action, 
      amount, 
      walletId, // Optional: use specific operational wallet
      slippageBps = 500, // 5% default
      dryRun = false, // For testing
    } = body;

    // Get token info to check bonding status
    const tokenData = await fetchPumpFunToken(project.tokenMintAddress);
    const isBonded = tokenData?.complete ?? false;

    // Parse PARRY config if exists (for validation limits)
    let parryConfig = null;
    if (project.parryConfig) {
      try {
        parryConfig = JSON.parse(decrypt(project.parryConfig));
      } catch {
        // Use defaults if parsing fails
      }
    }

    // Dry run - just show what would happen
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        wouldExecute: {
          action,
          tokenMint: project.tokenMintAddress,
          amount,
          isBonded,
          slippageBps,
        },
        message: 'Dry run - no transaction sent. Set dryRun: false to execute.',
      });
    }

    // Get the private key to use
    let privateKey: string;
    let walletAddress: string;
    
    if (walletId) {
      // Use specific operational wallet
      const wallet = project.wallets.find(w => w.id === walletId);
      if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
      }
      if (!wallet.isActive) {
        return NextResponse.json({ error: 'Wallet is not active' }, { status: 400 });
      }
      privateKey = decrypt(wallet.encryptedPrivateKey);
      walletAddress = wallet.address;
    } else {
      // Use dev wallet
      privateKey = decrypt(project.encryptedPrivateKey);
      // Get dev wallet address from private key using the helper function
      const { getKeypairFromPrivate } = await import('@/lib/solana');
      const keypair = getKeypairFromPrivate(privateKey);
      if (!keypair) {
        return NextResponse.json({ 
          error: 'Invalid private key format' 
        }, { status: 400 });
      }
      walletAddress = keypair.publicKey.toBase58();
    }

    switch (action) {
      // ═══════════════════════════════════════════════════════════════════════
      // CLAIM CREATOR FEES
      // ═══════════════════════════════════════════════════════════════════════
      case 'claim': {
        const result = await claimCreatorFees(
          privateKey,
          project.tokenMintAddress,
          isBonded
        );

        return NextResponse.json({
          success: result.success,
          action: 'claim',
          tokenMint: project.tokenMintAddress,
          pool: result.pool,
          signature: result.signature,
          error: result.error,
          solscanUrl: result.signature 
            ? `https://solscan.io/tx/${result.signature}` 
            : undefined,
        });
      }

      // ═══════════════════════════════════════════════════════════════════════
      // BUY TOKENS
      // ═══════════════════════════════════════════════════════════════════════
      case 'buy': {
        if (!amount || amount <= 0) {
          return NextResponse.json({ 
            error: 'Amount required (in SOL)' 
          }, { status: 400 });
        }

        // Validate trade amount
        const walletBalance = await getWalletBalanceForValidation({
          walletAddress,
          tokenMint: project.tokenMintAddress,
        });

        const validation = await validateTradeAmount({
          action: 'buy',
          amount,
          walletBalance,
          config: parryConfig,
        });

        if (!validation.valid) {
          return NextResponse.json({
            success: false,
            error: validation.error,
            warnings: validation.warnings,
          }, { status: 400 });
        }

        const result = await smartBuy(
          privateKey,
          project.tokenMintAddress,
          amount,
          isBonded
        );

        return NextResponse.json({
          success: result.success,
          action: 'buy',
          tokenMint: project.tokenMintAddress,
          solAmount: amount,
          isBonded,
          method: isBonded ? 'jupiter' : 'bonding_curve',
          signature: result.signature,
          error: result.error,
          solscanUrl: result.signature 
            ? `https://solscan.io/tx/${result.signature}` 
            : undefined,
        });
      }

      // ═══════════════════════════════════════════════════════════════════════
      // SELL TOKENS
      // ═══════════════════════════════════════════════════════════════════════
      case 'sell': {
        if (!amount || amount <= 0) {
          return NextResponse.json({ 
            error: 'Amount required (in tokens)' 
          }, { status: 400 });
        }

        // Validate trade amount
        const walletBalance = await getWalletBalanceForValidation({
          walletAddress,
          tokenMint: project.tokenMintAddress,
        });

        // Get token price for validation (if available)
        // Calculate price per token: market cap / total supply
        let tokenPrice = 0;
        if (tokenData?.usd_market_cap && tokenData.usd_market_cap > 0) {
          const totalSupply = 1_000_000_000; // Pump.fun fixed supply
          tokenPrice = tokenData.usd_market_cap / totalSupply;
          // Convert USD price to SOL (rough estimate: assume $100 per SOL)
          tokenPrice = tokenPrice / 100;
        }

        const validation = await validateTradeAmount({
          action: 'sell',
          amount,
          walletBalance,
          config: parryConfig,
          tokenPrice,
        });

        if (!validation.valid) {
          return NextResponse.json({
            success: false,
            error: validation.error,
            warnings: validation.warnings,
          }, { status: 400 });
        }

        const result = await smartSell(
          privateKey,
          project.tokenMintAddress,
          amount,
          isBonded
        );

        return NextResponse.json({
          success: result.success,
          action: 'sell',
          tokenMint: project.tokenMintAddress,
          tokenAmount: amount,
          isBonded,
          method: isBonded ? 'jupiter' : 'bonding_curve',
          signature: result.signature,
          error: result.error,
          solscanUrl: result.signature 
            ? `https://solscan.io/tx/${result.signature}` 
            : undefined,
        });
      }

      // ═══════════════════════════════════════════════════════════════════════
      // BUY ON BONDING CURVE (EXPLICIT)
      // ═══════════════════════════════════════════════════════════════════════
      case 'buy_bonding': {
        if (!amount || amount <= 0) {
          return NextResponse.json({ 
            error: 'Amount required (in SOL)' 
          }, { status: 400 });
        }

        // Validate trade amount
        const walletBalance = await getWalletBalanceForValidation({
          walletAddress,
          tokenMint: project.tokenMintAddress,
        });

        const validation = await validateTradeAmount({
          action: 'buy',
          amount,
          walletBalance,
          config: parryConfig,
        });

        if (!validation.valid) {
          return NextResponse.json({
            success: false,
            error: validation.error,
            warnings: validation.warnings,
          }, { status: 400 });
        }

        const result = await buyOnBondingCurve(
          privateKey,
          project.tokenMintAddress,
          amount,
          slippageBps
        );

        return NextResponse.json({
          success: result.success,
          action: 'buy_bonding',
          tokenMint: project.tokenMintAddress,
          solAmount: amount,
          signature: result.signature,
          error: result.error,
          solscanUrl: result.signature 
            ? `https://solscan.io/tx/${result.signature}` 
            : undefined,
        });
      }

      // ═══════════════════════════════════════════════════════════════════════
      // SELL ON BONDING CURVE (EXPLICIT)
      // ═══════════════════════════════════════════════════════════════════════
      case 'sell_bonding': {
        if (!amount || amount <= 0) {
          return NextResponse.json({ 
            error: 'Amount required (in tokens)' 
          }, { status: 400 });
        }

        // Validate trade amount
        const walletBalance = await getWalletBalanceForValidation({
          walletAddress,
          tokenMint: project.tokenMintAddress,
        });

        // Get token price for validation (if available)
        // Calculate price per token: market cap / total supply
        let tokenPrice = 0;
        if (tokenData?.usd_market_cap && tokenData.usd_market_cap > 0) {
          const totalSupply = 1_000_000_000; // Pump.fun fixed supply
          tokenPrice = tokenData.usd_market_cap / totalSupply;
          // Convert USD price to SOL (rough estimate: assume $100 per SOL)
          tokenPrice = tokenPrice / 100;
        }

        const validation = await validateTradeAmount({
          action: 'sell',
          amount,
          walletBalance,
          config: parryConfig,
          tokenPrice,
        });

        if (!validation.valid) {
          return NextResponse.json({
            success: false,
            error: validation.error,
            warnings: validation.warnings,
          }, { status: 400 });
        }

        const result = await sellOnBondingCurve(
          privateKey,
          project.tokenMintAddress,
          amount,
          slippageBps
        );

        return NextResponse.json({
          success: result.success,
          action: 'sell_bonding',
          tokenMint: project.tokenMintAddress,
          tokenAmount: amount,
          signature: result.signature,
          error: result.error,
          solscanUrl: result.signature 
            ? `https://solscan.io/tx/${result.signature}` 
            : undefined,
        });
      }

      // ═══════════════════════════════════════════════════════════════════════
      // SWAP VIA JUPITER (EXPLICIT)
      // ═══════════════════════════════════════════════════════════════════════
      case 'jupiter_swap': {
        const { inputMint, outputMint } = body;
        
        if (!inputMint || !outputMint || !amount) {
          return NextResponse.json({ 
            error: 'inputMint, outputMint, and amount required' 
          }, { status: 400 });
        }

        const result = await swapWithJupiter(
          privateKey,
          inputMint,
          outputMint,
          amount,
          slippageBps
        );

        return NextResponse.json({
          success: result.success,
          action: 'jupiter_swap',
          inputMint,
          outputMint,
          amountIn: result.amountIn,
          amountOut: result.amountOut,
          signature: result.signature,
          error: result.error,
          solscanUrl: result.signature 
            ? `https://solscan.io/tx/${result.signature}` 
            : undefined,
        });
      }

      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`,
          validActions: ['claim', 'buy', 'sell', 'buy_bonding', 'sell_bonding', 'jupiter_swap'],
        }, { status: 400 });
    }
  } catch (error) {
    logError('Trade API POST error', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

