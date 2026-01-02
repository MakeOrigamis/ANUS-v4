// ═══════════════════════════════════════════════════════════════════════════════
// PARRY TRADING STRATEGY - Autonomous Market Making
// ═══════════════════════════════════════════════════════════════════════════════

import { logDebug } from './logger';

/**
 * STRATEGY OVERVIEW:
 * 
 * SELLING (During Euphoria):
 * - Detect net positive volume (more buys than sells)
 * - When parabolic: sell 10-15% of each incoming buy
 * - Sell slow and smooth, never dump
 * - Goal: Farm volume, take profit at tops
 * 
 * BUYING (During Dips):
 * - Buy at key support levels (EMA, Fibonacci, psychological)
 * - Only buy when price drops to targets
 * - Accumulate during fear/consolidation
 * 
 * TIMEFRAMES:
 * - 0-15 min: 30 second candles (new token, high volatility)
 * - 15-60 min: 1 minute candles
 * - 1-4 hours: 5 minute candles
 * - 4+ hours: 15 minute candles
 * - 24+ hours: 1 hour candles
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export interface MarketState {
  currentPrice: number;
  priceChange1m: number;
  priceChange5m: number;
  priceChange15m: number;
  priceChange1h: number;
  volume1m: number;
  volume5m: number;
  netVolume1m: number; // positive = more buys, negative = more sells
  netVolume5m: number;
  buyCount1m: number;
  sellCount1m: number;
  ema9: number;
  ema21: number;
  ema50: number;
  rsi14: number;
  fibLevels: FibonacciLevels;
  phase: MarketPhase;
  tokenAgeMinutes: number;
  // New fields for bonding/market cap awareness
  marketCapUSD: number;
  bondingComplete: boolean;
}

export interface FibonacciLevels {
  high: number;      // Recent high (100%)
  low: number;       // Recent low (0%)
  fib236: number;    // 23.6% retracement
  fib382: number;    // 38.2% retracement (golden pocket start)
  fib500: number;    // 50% retracement
  fib618: number;    // 61.8% retracement (golden ratio)
  fib786: number;    // 78.6% retracement
}

export type MarketPhase = 
  | 'accumulation'    // Low volume, sideways, smart money buying
  | 'markup'          // Price rising, volume increasing
  | 'euphoria'        // Parabolic, FOMO, high volume - SELL HERE
  | 'distribution'    // Price topping, volume decreasing
  | 'decline'         // Price falling, panic selling
  | 'capitulation';   // Maximum fear - BUY HERE

export interface TradeSignal {
  action: 'buy' | 'sell' | 'hold';
  amount: number;           // In SOL for buys, tokens for sells
  amountPercent: number;    // Percentage of position/funds
  urgency: 'immediate' | 'limit' | 'wait';
  reason: string;
  targetPrice?: number;     // For limit orders
  stopLoss?: number;
  confidence: number;       // 0-100
}

export interface StrategyConfig {
  // Sell settings
  sellDuringEuphoria: boolean;
  euphoriaSellPercent: number;      // % of incoming buys to sell (10-15%)
  maxSellPerTrade: number;          // Max SOL value per sell
  minNetVolumeToSell: number;       // Min net positive volume to trigger sells
  
  // Buy settings
  buyAtSupport: boolean;
  buyAtFibLevels: boolean;
  buyAtEMA: boolean;
  maxBuyPerTrade: number;           // Max SOL per buy
  dipThresholdPercent: number;      // Min dip % to trigger buy
  
  // Risk management
  maxPositionPercent: number;       // Max % of liquidity to hold
  stopLossPercent: number;          // Stop loss trigger
  takeProfitPercent: number;        // Take profit trigger
  
  // Volume farming
  volumeFarmingEnabled: boolean;
  volumeFarmSellPercent: number;    // % of buys to sell back for volume
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET CAP THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MarketCapRules {
  // Before these thresholds: NO SELLING
  minMarketCapToSell: number;       // Don't sell below this (e.g., $250k)
  
  // Selling intensity based on market cap
  lightSellThreshold: number;       // $250k-$500k: light selling
  mediumSellThreshold: number;      // $500k-$1M: medium selling
  heavySellThreshold: number;       // $1M+: heavier selling (but still smooth)
  
  // Sell percentages at each level
  lightSellPercent: number;         // 5-8% of incoming buys
  mediumSellPercent: number;        // 10-12% of incoming buys  
  heavySellPercent: number;         // 12-15% of incoming buys
}

export const DEFAULT_MARKET_CAP_RULES: MarketCapRules = {
  minMarketCapToSell: 250_000,      // $250k minimum to start selling
  lightSellThreshold: 250_000,      // $250k
  mediumSellThreshold: 500_000,     // $500k
  heavySellThreshold: 1_000_000,    // $1M
  lightSellPercent: 6,              // 6% of buys
  mediumSellPercent: 10,            // 10% of buys
  heavySellPercent: 14,             // 14% of buys
};

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET POSITION LIMITS
// ═══════════════════════════════════════════════════════════════════════════════

export interface WalletLimits {
  maxSupplyPercentPerWallet: number;  // Max % of supply any single wallet can hold
  maxSolPerWallet: number;            // Max SOL value per wallet
  minWallets: number;                 // Minimum wallets to spread across
  maxWallets: number;                 // Maximum wallets
}

export const DEFAULT_WALLET_LIMITS: WalletLimits = {
  maxSupplyPercentPerWallet: 2,       // Max 2% supply per wallet (anti-whale)
  maxSolPerWallet: 10,                // Max 10 SOL worth per wallet
  minWallets: 10,                     // At least 10 wallets
  maxWallets: 25,                     // Max 25 wallets
};

/**
 * Check if a wallet is within limits
 */
export function isWalletWithinLimits(
  walletTokens: number,
  totalSupply: number,
  tokenPriceInSol: number,
  limits: WalletLimits = DEFAULT_WALLET_LIMITS
): { withinLimits: boolean; supplyPercent: number; solValue: number; warnings: string[] } {
  const supplyPercent = (walletTokens / totalSupply) * 100;
  const solValue = walletTokens * tokenPriceInSol;
  const warnings: string[] = [];
  
  if (supplyPercent > limits.maxSupplyPercentPerWallet) {
    warnings.push(`Wallet holds ${supplyPercent.toFixed(2)}% > max ${limits.maxSupplyPercentPerWallet}%`);
  }
  
  if (solValue > limits.maxSolPerWallet) {
    warnings.push(`Wallet value ${solValue.toFixed(2)} SOL > max ${limits.maxSolPerWallet} SOL`);
  }
  
  return {
    withinLimits: warnings.length === 0,
    supplyPercent,
    solValue,
    warnings,
  };
}

/**
 * Calculate how to distribute tokens across wallets
 * Ensures no wallet exceeds 2% supply
 */
export function calculateWalletDistribution(
  totalTokensToDistribute: number,
  totalSupply: number,
  limits: WalletLimits = DEFAULT_WALLET_LIMITS
): { walletsNeeded: number; tokensPerWallet: number; supplyPercentPerWallet: number } {
  const maxTokensPerWallet = totalSupply * (limits.maxSupplyPercentPerWallet / 100);
  const walletsNeeded = Math.max(
    limits.minWallets,
    Math.ceil(totalTokensToDistribute / maxTokensPerWallet)
  );
  
  const tokensPerWallet = totalTokensToDistribute / walletsNeeded;
  const supplyPercentPerWallet = (tokensPerWallet / totalSupply) * 100;
  
  return {
    walletsNeeded: Math.min(walletsNeeded, limits.maxWallets),
    tokensPerWallet,
    supplyPercentPerWallet,
  };
}

/**
 * Check if we should rebalance wallets (one has too much)
 */
export function shouldRebalanceWallets(
  walletBalances: { address: string; tokens: number }[],
  totalSupply: number,
  limits: WalletLimits = DEFAULT_WALLET_LIMITS
): { shouldRebalance: boolean; overweightWallets: string[]; underweightWallets: string[] } {
  const maxTokens = totalSupply * (limits.maxSupplyPercentPerWallet / 100);
  const avgTokens = walletBalances.reduce((sum, w) => sum + w.tokens, 0) / walletBalances.length;
  const minTokens = avgTokens * 0.3; // Wallet is underweight if < 30% of average
  
  const overweightWallets = walletBalances
    .filter(w => w.tokens > maxTokens)
    .map(w => w.address);
    
  const underweightWallets = walletBalances
    .filter(w => w.tokens < minTokens && w.tokens > 0)
    .map(w => w.address);
  
  return {
    shouldRebalance: overweightWallets.length > 0,
    overweightWallets,
    underweightWallets,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  // Sell settings - conservative for smooth selling
  sellDuringEuphoria: true,
  euphoriaSellPercent: 12,          // Sell 12% of incoming buys
  maxSellPerTrade: 2,               // Max 2 SOL per sell
  minNetVolumeToSell: 0.5,          // Need 0.5 SOL net positive volume
  
  // Buy settings
  buyAtSupport: true,
  buyAtFibLevels: true,
  buyAtEMA: true,
  maxBuyPerTrade: 1,                // Max 1 SOL per buy
  dipThresholdPercent: 15,          // Buy when down 15%+
  
  // Risk management
  maxPositionPercent: 30,           // Max 30% of liquidity
  stopLossPercent: 50,              // Stop loss at -50%
  takeProfitPercent: 200,           // Take profit at +200%
  
  // Volume farming
  volumeFarmingEnabled: true,
  volumeFarmSellPercent: 10,        // Sell 10% of buys for volume
};

// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICAL INDICATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate EMA (Exponential Moving Average)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // Neutral if not enough data
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate Fibonacci retracement levels
 */
export function calculateFibonacci(high: number, low: number): FibonacciLevels {
  const range = high - low;
  
  return {
    high,
    low,
    fib236: high - (range * 0.236),
    fib382: high - (range * 0.382),
    fib500: high - (range * 0.5),
    fib618: high - (range * 0.618),
    fib786: high - (range * 0.786),
  };
}

/**
 * Find recent high and low for Fibonacci
 */
export function findHighLow(candles: PriceCandle[], lookback: number = 50): { high: number; low: number } {
  const recentCandles = candles.slice(-lookback);
  
  let high = 0;
  let low = Infinity;
  
  for (const candle of recentCandles) {
    if (candle.high > high) high = candle.high;
    if (candle.low < low) low = candle.low;
  }
  
  return { high, low: low === Infinity ? 0 : low };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET PHASE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect current market phase
 */
export function detectMarketPhase(state: Partial<MarketState>): MarketPhase {
  const { 
    priceChange5m = 0, 
    priceChange15m = 0,
    netVolume5m = 0,
    rsi14 = 50,
    currentPrice = 0,
    ema9 = 0,
    ema21 = 0
  } = state;
  
  // EUPHORIA: Price up significantly, high volume, RSI overbought
  if (priceChange5m > 20 && netVolume5m > 1 && rsi14 > 70) {
    return 'euphoria';
  }
  
  // CAPITULATION: Price down significantly, RSI oversold
  if (priceChange5m < -20 && rsi14 < 30) {
    return 'capitulation';
  }
  
  // MARKUP: Price rising steadily, above EMAs
  if (priceChange15m > 10 && currentPrice > ema9 && ema9 > ema21) {
    return 'markup';
  }
  
  // DECLINE: Price falling, below EMAs
  if (priceChange15m < -10 && currentPrice < ema9 && ema9 < ema21) {
    return 'decline';
  }
  
  // DISTRIBUTION: Price at high but losing momentum
  if (priceChange5m < 5 && priceChange15m > 15 && netVolume5m < 0) {
    return 'distribution';
  }
  
  // ACCUMULATION: Sideways, low volume
  return 'accumulation';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMEFRAME SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get appropriate candle timeframe based on token age
 */
export function getTimeframe(tokenAgeMinutes: number): {
  seconds: number;
  label: string;
} {
  if (tokenAgeMinutes < 15) {
    return { seconds: 30, label: '30s' };
  } else if (tokenAgeMinutes < 60) {
    return { seconds: 60, label: '1m' };
  } else if (tokenAgeMinutes < 240) { // 4 hours
    return { seconds: 300, label: '5m' };
  } else if (tokenAgeMinutes < 1440) { // 24 hours
    return { seconds: 900, label: '15m' };
  } else {
    return { seconds: 3600, label: '1h' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGY ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main strategy function - generates trade signals
 * 
 * KEY RULES:
 * 1. NO SELLING before bonding complete
 * 2. NO SELLING below $250k market cap
 * 3. Light selling $250k-$500k
 * 4. Medium selling $500k-$1M
 * 5. Heavy selling $1M+ (still smooth, not dumping)
 */
export function generateTradeSignal(
  state: MarketState,
  config: StrategyConfig = DEFAULT_STRATEGY_CONFIG,
  currentPosition: { tokens: number; avgPrice: number; solBalance: number },
  marketCapRules: MarketCapRules = DEFAULT_MARKET_CAP_RULES
): TradeSignal {
  
  const { phase, currentPrice, ema9, ema21, ema50, fibLevels, rsi14, netVolume5m, marketCapUSD, bondingComplete } = state;
  const { tokens, avgPrice, solBalance } = currentPosition;
  
  // Calculate P&L
  const pnlPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RULE #1: NO SELLING BEFORE BONDING COMPLETE
  // ═══════════════════════════════════════════════════════════════════════════
  const canSell = bondingComplete && marketCapUSD >= marketCapRules.minMarketCapToSell;
  
  if (!bondingComplete && tokens > 0) {
    // Can only buy during bonding, not sell
    logDebug('[STRATEGY] Bonding not complete. NO SELLING allowed.');
  }
  
  if (bondingComplete && marketCapUSD < marketCapRules.minMarketCapToSell && tokens > 0) {
    logDebug('[STRATEGY] Market cap below threshold. NO SELLING allowed.', { current: marketCapUSD/1000, threshold: marketCapRules.minMarketCapToSell/1000 });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DETERMINE SELL INTENSITY BASED ON MARKET CAP
  // ═══════════════════════════════════════════════════════════════════════════
  let sellIntensity: 'none' | 'light' | 'medium' | 'heavy' = 'none';
  let dynamicSellPercent = 0;
  
  if (canSell) {
    if (marketCapUSD >= marketCapRules.heavySellThreshold) {
      sellIntensity = 'heavy';
      dynamicSellPercent = marketCapRules.heavySellPercent;
    } else if (marketCapUSD >= marketCapRules.mediumSellThreshold) {
      sellIntensity = 'medium';
      dynamicSellPercent = marketCapRules.mediumSellPercent;
    } else if (marketCapUSD >= marketCapRules.lightSellThreshold) {
      sellIntensity = 'light';
      dynamicSellPercent = marketCapRules.lightSellPercent;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STOP LOSS CHECK (only if selling allowed)
  // ═══════════════════════════════════════════════════════════════════════════
  if (canSell && pnlPercent < -config.stopLossPercent && tokens > 0) {
    return {
      action: 'sell',
      amount: tokens * 0.5, // Sell half to reduce exposure
      amountPercent: 50,
      urgency: 'immediate',
      reason: `stop loss triggered at ${pnlPercent.toFixed(1)}%`,
      confidence: 90,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TAKE PROFIT CHECK (only if selling allowed)
  // ═══════════════════════════════════════════════════════════════════════════
  if (canSell && pnlPercent > config.takeProfitPercent && tokens > 0) {
    return {
      action: 'sell',
      amount: tokens * 0.3, // Sell 30% to lock profits
      amountPercent: 30,
      urgency: 'immediate',
      reason: `take profit at ${pnlPercent.toFixed(1)}%`,
      confidence: 85,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EUPHORIA SELL - Sell during pumps (market cap gated)
  // ═══════════════════════════════════════════════════════════════════════════
  if (canSell && config.sellDuringEuphoria && phase === 'euphoria' && tokens > 0 && sellIntensity !== 'none') {
    // Check net positive volume
    if (netVolume5m > config.minNetVolumeToSell) {
      const sellPercent = dynamicSellPercent;
      const sellAmount = Math.min(
        tokens * (sellPercent / 100),
        config.maxSellPerTrade / currentPrice
      );
      
      return {
        action: 'sell',
        amount: sellAmount,
        amountPercent: sellPercent,
        urgency: 'immediate',
        reason: `euphoria @ $${(marketCapUSD/1000).toFixed(0)}k MC. ${sellIntensity} sell ${sellPercent}%. net vol +${netVolume5m.toFixed(2)} SOL`,
        confidence: 80,
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME FARMING - Sell small amounts into buys (market cap gated)
  // ═══════════════════════════════════════════════════════════════════════════
  if (canSell && config.volumeFarmingEnabled && netVolume5m > 0.3 && tokens > 0 && phase !== 'decline' && sellIntensity !== 'none') {
    const sellPercent = Math.min(dynamicSellPercent, config.volumeFarmSellPercent);
    const sellAmount = Math.min(
      tokens * (sellPercent / 100),
      netVolume5m * 0.15 / currentPrice // Sell max 15% of net volume
    );
    
    if (sellAmount * currentPrice > 0.05) { // Min 0.05 SOL trade
      return {
        action: 'sell',
        amount: sellAmount,
        amountPercent: sellPercent,
        urgency: 'limit',
        reason: `vol farming @ $${(marketCapUSD/1000).toFixed(0)}k MC. selling ${sellPercent}% into +${netVolume5m.toFixed(2)} SOL buys`,
        targetPrice: currentPrice * 1.001, // Slight premium
        confidence: 70,
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BUY AT FIBONACCI SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════
  if (config.buyAtFibLevels && solBalance > 0.1) {
    // Golden pocket (0.618-0.65) - strongest buy zone
    if (currentPrice <= fibLevels.fib618 && currentPrice >= fibLevels.fib786) {
      const buyAmount = Math.min(solBalance * 0.25, config.maxBuyPerTrade);
      return {
        action: 'buy',
        amount: buyAmount,
        amountPercent: 25,
        urgency: 'immediate',
        reason: `price at golden pocket (0.618 fib). strong support.`,
        stopLoss: fibLevels.low * 0.95,
        confidence: 85,
      };
    }
    
    // 0.382 fib - first support
    if (currentPrice <= fibLevels.fib382 && currentPrice > fibLevels.fib500) {
      const buyAmount = Math.min(solBalance * 0.15, config.maxBuyPerTrade);
      return {
        action: 'buy',
        amount: buyAmount,
        amountPercent: 15,
        urgency: 'limit',
        reason: `price at 0.382 fib support`,
        targetPrice: fibLevels.fib382,
        stopLoss: fibLevels.fib618 * 0.95,
        confidence: 70,
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BUY AT EMA SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════
  if (config.buyAtEMA && solBalance > 0.1) {
    // Price touching EMA21 from above (support test)
    const ema21Distance = ((currentPrice - ema21) / ema21) * 100;
    if (ema21Distance > -2 && ema21Distance < 2 && state.priceChange5m < 0) {
      const buyAmount = Math.min(solBalance * 0.2, config.maxBuyPerTrade);
      return {
        action: 'buy',
        amount: buyAmount,
        amountPercent: 20,
        urgency: 'limit',
        reason: `price testing EMA21 support`,
        targetPrice: ema21,
        stopLoss: ema50 * 0.95,
        confidence: 75,
      };
    }
    
    // Price at EMA50 - stronger support
    const ema50Distance = ((currentPrice - ema50) / ema50) * 100;
    if (ema50Distance > -3 && ema50Distance < 3 && state.priceChange15m < -10) {
      const buyAmount = Math.min(solBalance * 0.3, config.maxBuyPerTrade);
      return {
        action: 'buy',
        amount: buyAmount,
        amountPercent: 30,
        urgency: 'immediate',
        reason: `price at EMA50 strong support`,
        stopLoss: currentPrice * 0.85,
        confidence: 80,
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CAPITULATION BUY - Buy extreme fear
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'capitulation' && solBalance > 0.1 && rsi14 < 25) {
    const buyAmount = Math.min(solBalance * 0.4, config.maxBuyPerTrade * 2);
    return {
      action: 'buy',
      amount: buyAmount,
      amountPercent: 40,
      urgency: 'immediate',
      reason: `capitulation detected. RSI ${rsi14.toFixed(0)}. extreme fear = opportunity`,
      stopLoss: currentPrice * 0.7,
      confidence: 75,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT: HOLD
  // ═══════════════════════════════════════════════════════════════════════════
  return {
    action: 'hold',
    amount: 0,
    amountPercent: 0,
    urgency: 'wait',
    reason: `no clear signal. phase: ${phase}. waiting for setup.`,
    confidence: 50,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build market state from candles and trades
 */
export function buildMarketState(
  candles: PriceCandle[],
  tokenAgeMinutes: number
): MarketState {
  const prices = candles.map(c => c.close);
  const currentPrice = prices[prices.length - 1] || 0;
  
  // Calculate EMAs
  const ema9 = calculateEMA(prices, 9);
  const ema21 = calculateEMA(prices, 21);
  const ema50 = calculateEMA(prices, 50);
  
  // Calculate RSI
  const rsi14 = calculateRSI(prices, 14);
  
  // Calculate Fibonacci
  const { high, low } = findHighLow(candles);
  const fibLevels = calculateFibonacci(high, low);
  
  // Calculate price changes
  const price1mAgo = candles.length > 2 ? candles[candles.length - 3].close : currentPrice;
  const price5mAgo = candles.length > 10 ? candles[candles.length - 11].close : currentPrice;
  const price15mAgo = candles.length > 30 ? candles[candles.length - 31].close : currentPrice;
  const price1hAgo = candles.length > 120 ? candles[candles.length - 121].close : currentPrice;
  
  const priceChange1m = ((currentPrice - price1mAgo) / price1mAgo) * 100;
  const priceChange5m = ((currentPrice - price5mAgo) / price5mAgo) * 100;
  const priceChange15m = ((currentPrice - price15mAgo) / price15mAgo) * 100;
  const priceChange1h = ((currentPrice - price1hAgo) / price1hAgo) * 100;
  
  // Calculate volumes
  const recent1m = candles.slice(-2);
  const recent5m = candles.slice(-10);
  
  const volume1m = recent1m.reduce((sum, c) => sum + c.volume, 0);
  const volume5m = recent5m.reduce((sum, c) => sum + c.volume, 0);
  
  const buyVol1m = recent1m.reduce((sum, c) => sum + c.buyVolume, 0);
  const sellVol1m = recent1m.reduce((sum, c) => sum + c.sellVolume, 0);
  const buyVol5m = recent5m.reduce((sum, c) => sum + c.buyVolume, 0);
  const sellVol5m = recent5m.reduce((sum, c) => sum + c.sellVolume, 0);
  
  const netVolume1m = buyVol1m - sellVol1m;
  const netVolume5m = buyVol5m - sellVol5m;
  
  const state: MarketState = {
    currentPrice,
    priceChange1m,
    priceChange5m,
    priceChange15m,
    priceChange1h,
    volume1m,
    volume5m,
    netVolume1m,
    netVolume5m,
    buyCount1m: recent1m.length, // Simplified
    sellCount1m: recent1m.length,
    ema9,
    ema21,
    ema50,
    rsi14,
    fibLevels,
    phase: 'accumulation', // Will be set below
    tokenAgeMinutes,
    // These will be set by caller with actual data
    marketCapUSD: 0,
    bondingComplete: false,
  };
  
  state.phase = detectMarketPhase(state);
  
  return state;
}

/**
 * Update market state with bonding/market cap info
 */
export function updateMarketStateWithTokenInfo(
  state: MarketState,
  marketCapUSD: number,
  bondingComplete: boolean
): MarketState {
  return {
    ...state,
    marketCapUSD,
    bondingComplete,
  };
}

/**
 * Format signal for logging/display
 */
export function formatSignal(signal: TradeSignal): string {
  const emoji = signal.action === 'buy' ? '🟢' : signal.action === 'sell' ? '🔴' : '⚪';
  return `${emoji} ${signal.action.toUpperCase()} | ${signal.amountPercent}% | ${signal.reason} | confidence: ${signal.confidence}%`;
}

