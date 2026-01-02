// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN SYNC API
// Server-side token data fetching with rate limiting protection
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchPumpFunToken, getTokenHolderCount } from '@/lib/solana';
import { logError, logInfo, logDebug } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// GET: Fetch token data by mint address (public, for dashboard/parry-core)
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mintAddress = searchParams.get('mint');

    if (!mintAddress) {
      return NextResponse.json({ error: 'Mint address is required' }, { status: 400 });
    }

    logDebug('Token sync GET requested', { mint: mintAddress.slice(0, 20) + '...' });

    const tokenData = await fetchPumpFunToken(mintAddress);
    
    if (!tokenData) {
      return NextResponse.json({ 
        error: 'Token data not found' 
      }, { status: 404 });
    }

    let holderCount = 0;
    try {
      holderCount = await getTokenHolderCount(mintAddress);
    } catch (error) {
      logDebug('Failed to fetch holder count for token sync GET', { mintAddress, error });
      // Continue without holder count
    }

    return NextResponse.json({
      success: true,
      tokenData,
      holderCount,
    });
  } catch (error) {
    logError('Token sync GET error', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST: Fetch token data from user's project (requires auth)
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's project
    const project = await prisma.project.findUnique({
      where: { userId: session.user.id },
      select: {
        tokenMintAddress: true,
      },
    });

    if (!project || !project.tokenMintAddress) {
      return NextResponse.json({ 
        error: 'No project or token mint found' 
      }, { status: 404 });
    }

    // Fetch token data
    logInfo('Token sync requested', { 
      userId: session.user.id, 
      tokenMint: project.tokenMintAddress 
    });

    const tokenData = await fetchPumpFunToken(project.tokenMintAddress);
    
    if (!tokenData) {
      return NextResponse.json({ 
        error: 'Failed to fetch token data' 
      }, { status: 500 });
    }

    // Fetch holder count
    let holderCount = 0;
    try {
      holderCount = await getTokenHolderCount(project.tokenMintAddress);
    } catch (error) {
      logError('Failed to fetch holder count', error as Error);
      // Continue without holder count
    }

    return NextResponse.json({
      success: true,
      tokenData,
      holderCount,
    });
  } catch (error) {
    logError('Token sync error', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
