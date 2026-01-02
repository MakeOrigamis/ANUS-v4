import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { 
  claimCreatorFees as claimFees,
  fetchPumpFunToken,
  getPublicKeyFromPrivate
} from '@/lib/solana';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logDebug, logError, logInfo } from '@/lib/logger';

/**
 * GET - Check token info and bonding status
 * Query params: mint (token mint address)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint');
  
  if (!mint) {
    return NextResponse.json({
      success: false,
      error: 'Missing mint parameter',
    }, { status: 400 });
  }
  
  try {
    // Get token info via our unified fetcher
    const tokenInfo = await fetchPumpFunToken(mint);
    
    if (!tokenInfo) {
      return NextResponse.json({
        success: false,
        error: 'Token not found',
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      token: {
        mint,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        complete: tokenInfo.complete,
        marketCap: tokenInfo.usd_market_cap,
        creator: tokenInfo.creator,
      },
      claimMethod: tokenInfo.complete ? 'pumpswap' : 'pumpfun',
      message: 'Use POST /api/trade with action: "claim" to claim fees',
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST - Claim creator fees
 * Body: { mint: string, privateKey: string, dryRun?: boolean }
 * 
 * NOTE: Prefer using /api/trade with action: "claim" - this endpoint is for direct access
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
    const { mint, privateKey, dryRun = true } = body;
    
    if (!mint || !privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing mint or privateKey',
      }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY: Validate user project
    // ═══════════════════════════════════════════════════════════════════════════
    const project = await prisma.project.findUnique({
      where: { userId: session.user.id },
      select: {
        tokenMintAddress: true,
        encryptedPrivateKey: true,
        wallets: {
          select: {
            address: true,
            encryptedPrivateKey: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'No project found',
      }, { status: 404 });
    }

    // Check if the mint belongs to the user's project
    if (project.tokenMintAddress !== mint) {
      return NextResponse.json({
        success: false,
        error: 'Token mint does not match your project',
      }, { status: 403 });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY: PrivateKey validation - must belong to dev wallet or operational wallet
    // ═══════════════════════════════════════════════════════════════════════════
    let wallet: Keypair;
    let walletAddress: string;
    try {
      if (privateKey.startsWith('[')) {
        wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKey)));
      } else {
        wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
      }
      walletAddress = wallet.publicKey.toBase58();
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid private key format',
      }, { status: 400 });
    }

    // Check if the privateKey belongs to the dev wallet
    let isAuthorized = false;
    try {
      const devWalletPrivateKey = decrypt(project.encryptedPrivateKey);
      const devWalletAddress = getPublicKeyFromPrivate(devWalletPrivateKey);
      if (devWalletAddress === walletAddress) {
        isAuthorized = true;
      }
    } catch (error) {
      logError('Error checking dev wallet', error as Error);
    }

    // Check if the privateKey belongs to an operational wallet
    if (!isAuthorized) {
      for (const walletData of project.wallets) {
        try {
          const walletPrivateKey = decrypt(walletData.encryptedPrivateKey);
          const walletPubAddress = getPublicKeyFromPrivate(walletPrivateKey);
          if (walletPubAddress === walletAddress) {
            isAuthorized = true;
            break;
          }
        } catch (error) {
          logError('Error checking operational wallet', error as Error, { walletId: walletData.address });
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({
        success: false,
        error: 'Private key does not belong to your project',
      }, { status: 403 });
    }
    
    // Get token info to check bonding status
    const tokenInfo = await fetchPumpFunToken(mint);
    const isBonded = tokenInfo?.complete ?? false;
    
    logInfo('Claim request', {
      mint,
      wallet: wallet.publicKey.toBase58(),
      bonded: isBonded,
      dryRun: dryRun,
    });
    
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        wouldClaim: {
          method: isBonded ? 'pumpswap' : 'pumpfun',
          wallet: wallet.publicKey.toBase58(),
          mint,
        },
        message: 'Dry run - no transaction sent. Set dryRun: false to execute.',
      });
    }
    
    // Actually claim using the direct Solana function
    const result = await claimFees(privateKey, mint, isBonded);
    
    return NextResponse.json({
      success: result.success,
      signature: result.signature,
      pool: result.pool,
      method: isBonded ? 'pumpswap' : 'pumpfun',
      error: result.error,
      solscanUrl: result.signature 
        ? `https://solscan.io/tx/${result.signature}` 
        : undefined,
    });
    
  } catch (error) {
    logError('Claim API error', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

