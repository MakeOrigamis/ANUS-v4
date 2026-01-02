// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TOKEN MINT API
// Stores and retrieves the token mint address for the public dashboard
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logError, logInfo } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// GET: Retrieve dashboard token mint (public, no auth required)
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET() {
  try {
    // Try to get from most recently updated project with a mint address
    // This ensures we get the latest saved token mint
    // Get all projects and filter for valid mint addresses
    const allProjects = await prisma.project.findMany({
      select: {
        tokenMintAddress: true,
        updatedAt: true,
        userId: true,
      },
      orderBy: {
        updatedAt: 'desc', // Get most recently updated (when mint was saved)
      },
    });

    // Find the first project with a valid mint address (length > 30)
    const project = allProjects.find(p => 
      p.tokenMintAddress && 
      p.tokenMintAddress.length > 30
    );

    if (project?.tokenMintAddress) {
      logInfo('Dashboard token mint retrieved', { 
        tokenMint: project.tokenMintAddress.slice(0, 20) + '...',
        updatedAt: project.updatedAt.toISOString(),
      });
      return NextResponse.json({
        success: true,
        tokenMint: project.tokenMintAddress,
        source: 'database',
      });
    }

    // Fallback to environment variable
    const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
    if (envMint) {
      return NextResponse.json({
        success: true,
        tokenMint: envMint,
        source: 'environment',
      });
    }

    return NextResponse.json({
      success: false,
      tokenMint: null,
      message: 'No token mint configured',
    });
  } catch (error) {
    logError('Error fetching dashboard token mint', error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch token mint',
    }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST: Update dashboard token mint (requires auth - only from /parry-core)
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tokenMint } = body;

    if (!tokenMint || typeof tokenMint !== 'string' || tokenMint.length < 30) {
      return NextResponse.json({ 
        error: 'Invalid token mint address',
        message: 'Token mint must be at least 30 characters',
      }, { status: 400 });
    }

    // Update the user's project with the new token mint
    const project = await prisma.project.findUnique({
      where: { userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json({ 
        error: 'No project found',
        message: 'Please initialize your project first',
      }, { status: 404 });
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { 
        tokenMintAddress: tokenMint,
        updatedAt: new Date(), // Explicitly update timestamp to ensure it's the most recent
      },
    });

    logInfo('Dashboard token mint updated', { 
      userId: session.user.id, 
      projectId: project.id,
      tokenMint: tokenMint.slice(0, 20) + '...',
      fullMint: tokenMint, // Log full mint for debugging
    });

    return NextResponse.json({
      success: true,
      message: 'Token mint address updated successfully',
    });
  } catch (error) {
    logError('Error updating dashboard token mint', error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update token mint',
    }, { status: 500 });
  }
}
