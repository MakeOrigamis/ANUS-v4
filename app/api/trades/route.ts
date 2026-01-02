// ═══════════════════════════════════════════════════════════════════════════════
// TRADES API
// Fetches recent trades using Helius RPC (Moralis doesn't have trades endpoint)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { logError, logDebug, logWarn } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE (In-Memory - reduces Helius RPC calls)
// ═══════════════════════════════════════════════════════════════════════════════

interface CachedTrades {
  trades: any[];
  timestamp: number;
  source: string;
}

const tradesCache = new Map<string, CachedTrades>();
const CACHE_TTL = 15 * 1000; // 15 seconds cache (to avoid Helius rate limits)

function getCachedTrades(tokenMint: string): CachedTrades | null {
  const cached = tradesCache.get(tokenMint);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  return null;
}

function setCachedTrades(tokenMint: string, trades: any[], source: string): void {
  tradesCache.set(tokenMint, {
    trades,
    timestamp: Date.now(),
    source,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenMint = searchParams.get('mint');
    const limit = parseInt(searchParams.get('limit') || '20'); // Default: 20 trades

    if (!tokenMint) {
      return NextResponse.json({ 
        success: false,
        error: 'Token mint address is required' 
      }, { status: 400 });
    }

    // Validate token mint address format
    try {
      new PublicKey(tokenMint);
    } catch (error) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid token mint address format',
        tokenMint 
      }, { status: 400 });
    }

    logDebug('Fetching trades via Helius', { tokenMint, limit });

    // Check cache first (to reduce Helius RPC calls)
    const cached = getCachedTrades(tokenMint);
    if (cached) {
      logDebug('Returning cached trades', { count: cached.trades.length, age: Date.now() - cached.timestamp });
      return NextResponse.json({
        success: true,
        trades: cached.trades,
        source: cached.source,
        cached: true,
      });
    }

    // Use Helius RPC to get recent transactions for the token
    const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!heliusApiKey) {
      return NextResponse.json({ 
        error: 'NEXT_PUBLIC_HELIUS_API_KEY not configured',
        trades: []
      }, { status: 503 });
    }

    const rpcEndpoint = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    const connection = new Connection(rpcEndpoint, 'confirmed');

    try {
      // Get recent signatures for the token mint
      const mintPublicKey = new PublicKey(tokenMint);
      
      // Fetch recent signatures (transactions involving this token)
      // Fetch more signatures than needed to account for non-trade transactions
      const signatures = await connection.getSignaturesForAddress(mintPublicKey, { limit: Math.min(limit * 3, 60) });
      
      if (signatures.length === 0) {
        logDebug('No transactions found for token', { tokenMint });
        const emptyResult = {
          success: true,
          trades: [],
          source: 'helius',
          message: 'No recent transactions found for this token',
        };
        // Cache empty results too (shorter TTL would be better, but keeping it simple)
        setCachedTrades(tokenMint, [], 'helius');
        return NextResponse.json(emptyResult);
      }

      // Parse transactions to extract trade data
      const trades: any[] = [];
      
      // Process signatures until we have enough trades or run out of signatures
      for (const sig of signatures) {
        if (trades.length >= limit) break; // Stop when we have enough trades
        try {
          const tx = await connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx || !tx.meta) continue;

          // Check if transaction involves token transfers
          const preBalances = tx.meta.preTokenBalances || [];
          const postBalances = tx.meta.postTokenBalances || [];
          
          // Find token balance changes
          const tokenChanges = postBalances
            .filter((post: any) => post.mint === tokenMint)
            .map((post: any) => {
              const pre = preBalances.find((p: any) => 
                p.accountIndex === post.accountIndex && p.mint === tokenMint
              );
              const change = parseFloat(post.uiTokenAmount.uiAmountString || '0') - 
                            parseFloat(pre?.uiTokenAmount.uiAmountString || '0');
              return { change, owner: post.owner };
            })
            .filter((c: any) => c.change !== 0);

          if (tokenChanges.length > 0) {
            const change = tokenChanges[0];
            const isBuy = change.change > 0;
            
            // Get SOL amount from transaction
            const solAmount = tx.meta.postBalances[0] - tx.meta.preBalances[0];
            const solAmountAbs = Math.abs(solAmount) / 1e9;

            trades.push({
              signature: sig.signature,
              timestamp: sig.blockTime ? sig.blockTime * 1000 : Date.now(),
              is_buy: isBuy,
              token_amount: Math.abs(change.change),
              sol_amount: solAmountAbs * 1e9, // Convert back to lamports for consistency
              block_time: sig.blockTime,
            });
          }
        } catch (error) {
          logDebug('Error parsing transaction', { signature: sig.signature, error });
          continue;
        }
      }

      logDebug('Parsed trades from Helius', { count: trades.length });
      
      const finalTrades = trades.slice(0, limit);
      
      // Cache the results
      setCachedTrades(tokenMint, finalTrades, 'helius');
      
      return NextResponse.json({
        success: true,
        trades: finalTrades,
        source: 'helius',
        cached: false,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('Helius RPC error', error as Error, { tokenMint, errorMessage });
      return NextResponse.json({
        success: false,
        error: `Failed to fetch trades from Helius: ${errorMessage}`,
        trades: [],
      }, { status: 500 });
    }

  } catch (error) {
    logError('Trades API error', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      trades: [],
    }, { status: 500 });
  }
}
