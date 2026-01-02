// ═══════════════════════════════════════════════════════════════════════════════
// $ANUS DATA FEED - Real-time metrics for PARRY
// ═══════════════════════════════════════════════════════════════════════════════

import { AnusMarketData } from './ai';
import { logError } from './logger';

const PUMPFUN_API = 'https://frontend-api.pump.fun';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;

// Store for tracking changes
let previousData: AnusMarketData | null = null;
let previousHolderCount: number | null = null;

export interface PumpFunTokenData {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  video_uri?: string;
  metadata_uri: string;
  twitter?: string;
  telegram?: string;
  bonding_curve: string;
  associated_bonding_curve: string;
  creator: string;
  created_timestamp: number;
  raydium_pool?: string;
  complete: boolean;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  total_supply: number;
  website?: string;
  show_name: boolean;
  king_of_the_hill_timestamp?: number;
  market_cap: number;
  reply_count: number;
  last_reply?: number;
  nsfw: boolean;
  market_id?: string;
  inverted: boolean;
  usd_market_cap: number;
}

export interface PumpFunTrade {
  signature: string;
  mint: string;
  sol_amount: number;
  token_amount: number;
  is_buy: boolean;
  user: string;
  timestamp: number;
  tx_index: number;
  username?: string;
  profile_image?: string;
  slot: number;
}

/**
 * Fetch token data from Pump.fun
 */
export async function fetchPumpFunToken(mintAddress: string): Promise<PumpFunTokenData | null> {
  try {
    const response = await fetch(`${PUMPFUN_API}/coins/${mintAddress}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    logError('Error fetching pump.fun token', error as Error);
    return null;
  }
}

/**
 * Fetch recent trades from Pump.fun
 */
export async function fetchRecentTrades(mintAddress: string, limit: number = 50): Promise<PumpFunTrade[]> {
  try {
    const response = await fetch(`${PUMPFUN_API}/trades/latest/${mintAddress}?limit=${limit}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    logError('Error fetching trades', error as Error);
    return [];
  }
}

/**
 * Get holder count from Helius
 */
export async function fetchHolderCount(mintAddress: string): Promise<number> {
  try {
    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenLargestAccounts',
        params: [mintAddress]
      })
    });
    
    const data = await response.json();
    // This gives us top holders, not total count
    // For total count we'd need to paginate through all token accounts
    return data.result?.value?.length || 0;
  } catch (error) {
    logError('Error fetching holder count', error as Error);
    return 0;
  }
}

/**
 * Calculate price from bonding curve reserves
 */
export function calculatePrice(virtualSolReserves: number, virtualTokenReserves: number): number {
  if (virtualTokenReserves === 0) return 0;
  // Price in SOL per token
  const priceInSol = virtualSolReserves / virtualTokenReserves;
  return priceInSol;
}

/**
 * Analyze recent trades for buy/sell ratio and volume
 */
export function analyzeTrades(trades: PumpFunTrade[]): {
  buyCount: number;
  sellCount: number;
  buyVolume: number;
  sellVolume: number;
  biggestBuy: number;
  recentTrend: 'bullish' | 'bearish' | 'neutral';
} {
  let buyCount = 0;
  let sellCount = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  let biggestBuy = 0;

  for (const trade of trades) {
    if (trade.is_buy) {
      buyCount++;
      buyVolume += trade.sol_amount;
      if (trade.sol_amount > biggestBuy) {
        biggestBuy = trade.sol_amount;
      }
    } else {
      sellCount++;
      sellVolume += trade.sol_amount;
    }
  }

  const buyRatio = buyCount / (buyCount + sellCount || 1);
  const recentTrend = buyRatio > 0.6 ? 'bullish' : buyRatio < 0.4 ? 'bearish' : 'neutral';

  return {
    buyCount,
    sellCount,
    buyVolume: buyVolume / 1e9, // Convert from lamports
    sellVolume: sellVolume / 1e9,
    biggestBuy: biggestBuy / 1e9,
    recentTrend
  };
}

/**
 * Get complete market data for $ANUS
 */
export async function getAnusMarketData(mintAddress: string): Promise<AnusMarketData> {
  const [tokenData, trades] = await Promise.all([
    fetchPumpFunToken(mintAddress),
    fetchRecentTrades(mintAddress, 100)
  ]);

  if (!tokenData) {
    return {};
  }

  const tradeAnalysis = analyzeTrades(trades);
  const price = calculatePrice(tokenData.virtual_sol_reserves, tokenData.virtual_token_reserves);
  
  // Calculate changes from previous data
  let priceChange1h = 0;
  let holderChange = 0;
  let volumeChange = 0;

  if (previousData) {
    if (previousData.price) {
      priceChange1h = ((price - previousData.price) / previousData.price) * 100;
    }
    if (previousData.volume24h) {
      const currentVolume = tradeAnalysis.buyVolume + tradeAnalysis.sellVolume;
      volumeChange = ((currentVolume - previousData.volume24h) / previousData.volume24h) * 100;
    }
  }

  if (previousHolderCount !== null) {
    // We don't have accurate holder count from this API
    // Would need to use a different source
  }

  const data: AnusMarketData = {
    price: price * 1e9, // Convert to readable number
    priceChange1h,
    priceChange24h: 0, // Would need historical data
    volume24h: tradeAnalysis.buyVolume + tradeAnalysis.sellVolume,
    volumeChange,
    marketCap: tokenData.usd_market_cap,
    liquidity: tokenData.virtual_sol_reserves / 1e9,
    recentBuys: tradeAnalysis.buyCount,
    recentSells: tradeAnalysis.sellCount,
    biggestBuy: tradeAnalysis.biggestBuy,
    sentiment: tradeAnalysis.recentTrend === 'bullish' ? 'greed' : 
               tradeAnalysis.recentTrend === 'bearish' ? 'fear' : 'neutral'
  };

  // Store for next comparison
  previousData = data;

  return data;
}

/**
 * Get a quick summary string for logging
 */
export function formatMarketSummary(data: AnusMarketData): string {
  const parts: string[] = [];
  
  if (data.marketCap) parts.push(`MC: $${(data.marketCap / 1000).toFixed(1)}k`);
  if (data.volume24h) parts.push(`Vol: ${data.volume24h.toFixed(2)} SOL`);
  if (data.recentBuys !== undefined && data.recentSells !== undefined) {
    const ratio = data.recentBuys / (data.recentBuys + data.recentSells);
    parts.push(`Buys: ${(ratio * 100).toFixed(0)}%`);
  }
  if (data.biggestBuy) parts.push(`Whale: ${data.biggestBuy.toFixed(2)} SOL`);
  if (data.sentiment) parts.push(`Sentiment: ${data.sentiment}`);

  return parts.join(' | ');
}

