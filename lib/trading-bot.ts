// ═══════════════════════════════════════════════════════════════════════════════
// TRADING BOT SERVICE
// Volume Bot, Price Stabilizer, Volume Farmer
// With EMA + Fibonacci Strategy
// ═══════════════════════════════════════════════════════════════════════════════

import { 
  buyOnBondingCurve, 
  sellOnBondingCurve, 
  getSOLBalance,
  getTokenBalance,
  fetchPumpFunToken,
  smartBuy,
  smartSell
} from './solana';
import { decrypt } from './encryption';
import { logInfo, logError, logDebug } from './logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICAL ANALYSIS: EMA + FIBONACCI
// ═══════════════════════════════════════════════════════════════════════════════

interface PricePoint {
  timestamp: number;
  price: number;
}

interface TechnicalLevels {
  ema9: number;
  ema21: number;
  ema50: number;
  fibLevels: {
    level_0: number;    // 0% - recent high
    level_236: number;  // 23.6%
    level_382: number;  // 38.2% - Golden pocket start
    level_500: number;  // 50%
    level_618: number;  // 61.8% - Golden pocket end
    level_786: number;  // 78.6%
    level_100: number;  // 100% - recent low
  };
  trend: 'bullish' | 'bearish' | 'neutral';
  buyZone: boolean;
  sellZone: boolean;
}

// Calculate EMA
function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

// Calculate Fibonacci retracement levels
function calculateFibonacci(high: number, low: number): TechnicalLevels['fibLevels'] {
  const diff = high - low;
  return {
    level_0: high,
    level_236: high - diff * 0.236,
    level_382: high - diff * 0.382,
    level_500: high - diff * 0.5,
    level_618: high - diff * 0.618,
    level_786: high - diff * 0.786,
    level_100: low,
  };
}

// Analyze price data and return technical levels
function analyzeTechnicals(priceHistory: PricePoint[]): TechnicalLevels | null {
  if (priceHistory.length < 21) return null;
  
  const prices = priceHistory.map(p => p.price);
  const currentPrice = prices[prices.length - 1];
  
  // Calculate EMAs
  const ema9 = calculateEMA(prices, 9);
  const ema21 = calculateEMA(prices, 21);
  const ema50 = calculateEMA(prices, Math.min(50, prices.length));
  
  // Find recent high/low for Fibonacci
  const recentPrices = prices.slice(-50);
  const high = Math.max(...recentPrices);
  const low = Math.min(...recentPrices);
  
  const fibLevels = calculateFibonacci(high, low);
  
  // Determine trend
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (ema9 > ema21 && ema21 > ema50) {
    trend = 'bullish';
  } else if (ema9 < ema21 && ema21 < ema50) {
    trend = 'bearish';
  }
  
  // Buy zone: Price in golden pocket (38.2% - 61.8%) during uptrend
  const inGoldenPocket = currentPrice >= fibLevels.level_618 && currentPrice <= fibLevels.level_382;
  const buyZone = inGoldenPocket && (trend === 'bullish' || trend === 'neutral');
  
  // Sell zone: Price near recent high or EMA crossover down
  const nearHigh = currentPrice >= fibLevels.level_236;
  const emaCrossDown = ema9 < ema21 && prices[prices.length - 2] > calculateEMA(prices.slice(0, -1), 21);
  const sellZone = nearHigh || emaCrossDown;
  
  return {
    ema9,
    ema21,
    ema50,
    fibLevels,
    trend,
    buyZone,
    sellZone,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TradingConfig {
  tokenMint: string;
  // Volume Bot settings
  volumeBotEnabled: boolean;
  buyAmountSol: number;        // How much SOL per buy (default: 1)
  sellSplitCount: number;      // How many sells per buy (default: 5)
  delayBetweenSellsMs: number; // Delay between sells (default: 1500ms)
  // Price Stabilizer settings
  priceStabilizerEnabled: boolean;
  minMcToStabilize: number;    // Minimum MC to start stabilizing
  buyDipPercent: number;       // Buy when price dips X%
  maxBuyPerStabilize: number;  // Max SOL per stabilization buy
  // Volume Farmer settings
  volumeFarmerEnabled: boolean;
  volumeFarmPercent: number;   // % to sell into positive volume
  minVolumeToFarm: number;     // Minimum volume to trigger farming
  // General
  maxSupplyPercent: number;    // Max % supply per wallet (default: 2%)
  maxSolPerWallet: number;     // Max SOL value per wallet (default: 10)
  slippageBps: number;         // Slippage in basis points (default: 1000 = 10%)
  cooldownMs: number;          // Cooldown between rounds
}

export interface WalletInfo {
  id: string;
  address: string;
  encryptedPrivateKey: string;
  isActive: boolean;
}

export interface TradeLog {
  timestamp: Date;
  type: 'buy' | 'sell' | 'stabilize' | 'farm';
  wallet: string;
  amount: number;
  signature?: string;
  success: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOLUME BOT
// Simple strategy: Buy tokens, sell in smaller chunks for volume
// ═══════════════════════════════════════════════════════════════════════════════

export class VolumeBot {
  private config: TradingConfig;
  private wallets: WalletInfo[];
  private isRunning: boolean = false;
  private logs: TradeLog[] = [];
  private onLog?: (log: TradeLog) => void;

  constructor(config: TradingConfig, wallets: WalletInfo[], onLog?: (log: TradeLog) => void) {
    this.config = config;
    this.wallets = wallets.filter(w => w.isActive);
    this.onLog = onLog;
  }

  private log(log: TradeLog) {
    this.logs.push(log);
    logInfo(`[VolumeBot] ${log.type.toUpperCase()} ${log.success ? '✓' : '✗'}`, { amount: log.amount, wallet: log.wallet });
    if (this.onLog) this.onLog(log);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Random delay between sells (100-500ms each, max 2s total)
   * Simple volume generation - no strategy needed
   */
  private getRandomDelay(): number {
    // Random between 100ms and 500ms
    return Math.floor(Math.random() * 400) + 100;
  }

  private getRandomWallet(): WalletInfo | null {
    if (this.wallets.length === 0) return null;
    return this.wallets[Math.floor(Math.random() * this.wallets.length)];
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logDebug('[VolumeBot] Already running');
      return;
    }

    this.isRunning = true;
    logInfo('[VolumeBot] Starting volume bot');

    while (this.isRunning && this.config.volumeBotEnabled) {
      try {
        await this.executeVolumeRound();
        // Cooldown between rounds
        await this.sleep(this.config.cooldownMs);
      } catch (error) {
        logError('[VolumeBot] Error in round', error as Error);
        await this.sleep(5000); // Wait 5s on error
      }
    }

    logInfo('[VolumeBot] Stopped');
  }

  stop(): void {
    this.isRunning = false;
    logDebug('[VolumeBot] Stopping');
  }

  private async executeVolumeRound(): Promise<void> {
    const wallet = this.getRandomWallet();
    if (!wallet) {
      logDebug('[VolumeBot] No active wallets available');
      return;
    }

    // Decrypt private key
    let privateKey: string;
    try {
      privateKey = decrypt(wallet.encryptedPrivateKey);
    } catch (error) {
      logError('[VolumeBot] Failed to decrypt wallet key', error as Error);
      return;
    }

    // Check wallet SOL balance
    const balance = await getSOLBalance(wallet.address);
    if (balance < this.config.buyAmountSol + 0.01) { // +0.01 for fees
      logDebug('[VolumeBot] Wallet has insufficient SOL', { wallet: wallet.address.slice(0,8), balance: balance.toFixed(4) });
      return;
    }

    // 1. BUY tokens
    logInfo('[VolumeBot] Buying tokens', { amount: this.config.buyAmountSol });
    const buyResult = await buyOnBondingCurve(
      privateKey,
      this.config.tokenMint,
      this.config.buyAmountSol,
      this.config.slippageBps
    );

    this.log({
      timestamp: new Date(),
      type: 'buy',
      wallet: wallet.address,
      amount: this.config.buyAmountSol,
      signature: buyResult.signature,
      success: buyResult.success,
      error: buyResult.error,
    });

    if (!buyResult.success) {
      logDebug('[VolumeBot] Buy failed, skipping sells');
      return;
    }

    // Wait a moment after buy
    await this.sleep(2000);

    // 2. SELL in smaller chunks with RANDOM delays (100-500ms each, max ~2s total)
    const tokenBalance = await getTokenBalance(wallet.address, this.config.tokenMint);
    if (!tokenBalance || tokenBalance <= 0) {
      logDebug('[VolumeBot] No tokens to sell');
      return;
    }

    const sellAmountPerTx = Math.floor(tokenBalance / this.config.sellSplitCount);
    
    for (let i = 0; i < this.config.sellSplitCount && this.isRunning; i++) {
      logInfo('[VolumeBot] Selling chunk', { chunk: i + 1, total: this.config.sellSplitCount });
      
      const sellResult = await sellOnBondingCurve(
        privateKey,
        this.config.tokenMint,
        sellAmountPerTx,
        this.config.slippageBps
      );

      // Estimate SOL value (rough)
      const estimatedSolValue = this.config.buyAmountSol / this.config.sellSplitCount;

      this.log({
        timestamp: new Date(),
        type: 'sell',
        wallet: wallet.address,
        amount: estimatedSolValue,
        signature: sellResult.signature,
        success: sellResult.success,
        error: sellResult.error,
      });

      // Random delay between sells (100-500ms)
      if (i < this.config.sellSplitCount - 1) {
        const delay = this.getRandomDelay();
        logDebug('[VolumeBot] Random delay', { delay });
        await this.sleep(delay);
      }
    }

    logInfo('[VolumeBot] Round complete');
  }

  getLogs(): TradeLog[] {
    return this.logs;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE STABILIZER
// Uses EMA + Fibonacci strategy with dynamic timeframes
// Timeframe progression: 30s → 1m → 5m → 15m (every 15 minutes)
// ═══════════════════════════════════════════════════════════════════════════════

export class PriceStabilizer {
  private config: TradingConfig;
  private wallets: WalletInfo[];
  private isRunning: boolean = false;
  private logs: TradeLog[] = [];
  private priceHistory: PricePoint[] = [];
  private startTime: number = 0;
  private onLog?: (log: TradeLog) => void;

  // Timeframe progression (in seconds)
  private readonly TIMEFRAMES = [30, 60, 300, 900]; // 30s, 1m, 5m, 15m
  private readonly TIMEFRAME_UPGRADE_INTERVAL = 15 * 60 * 1000; // 15 minutes

  constructor(config: TradingConfig, wallets: WalletInfo[], onLog?: (log: TradeLog) => void) {
    this.config = config;
    this.wallets = wallets.filter(w => w.isActive);
    this.onLog = onLog;
  }

  private log(log: TradeLog) {
    this.logs.push(log);
    logInfo(`[PriceStabilizer] ${log.type.toUpperCase()} ${log.success ? '✓' : '✗'}`, { amount: log.amount });
    if (this.onLog) this.onLog(log);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getRandomWallet(): WalletInfo | null {
    if (this.wallets.length === 0) return null;
    return this.wallets[Math.floor(Math.random() * this.wallets.length)];
  }

  // Get current timeframe based on how long bot has been running
  private getCurrentTimeframe(): number {
    const elapsedMs = Date.now() - this.startTime;
    const timeframeIndex = Math.min(
      Math.floor(elapsedMs / this.TIMEFRAME_UPGRADE_INTERVAL),
      this.TIMEFRAMES.length - 1
    );
    return this.TIMEFRAMES[timeframeIndex];
  }

  // Get check interval (poll more frequently on smaller timeframes)
  private getCheckInterval(): number {
    const timeframe = this.getCurrentTimeframe();
    // Check every 1/3 of the timeframe, min 10 seconds
    return Math.max(10000, (timeframe * 1000) / 3);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = Date.now();
    this.priceHistory = [];
    
    logInfo('[PriceStabilizer] Starting with EMA + Fibonacci strategy');
    logDebug('[PriceStabilizer] Timeframe progression: 30s → 1m → 5m → 15m (every 15 min)');

    while (this.isRunning && this.config.priceStabilizerEnabled) {
      try {
        await this.collectPriceAndAnalyze();
        const checkInterval = this.getCheckInterval();
        const currentTf = this.getCurrentTimeframe();
        logDebug('[PriceStabilizer] Next check', { interval: checkInterval/1000, timeframe: currentTf });
        await this.sleep(checkInterval);
      } catch (error) {
        logError('[PriceStabilizer] Error', error as Error);
        await this.sleep(10000);
      }
    }

    logInfo('[PriceStabilizer] Stopped');
  }

  stop(): void {
    this.isRunning = false;
  }

  private async collectPriceAndAnalyze(): Promise<void> {
    // Fetch current token data
    const tokenData = await fetchPumpFunToken(this.config.tokenMint);
    if (!tokenData) {
      logDebug('[PriceStabilizer] Could not fetch token data');
      return;
    }

    const currentMc = tokenData.usd_market_cap;
    const currentPrice = tokenData.market_cap; // SOL price

    // Add to price history
    this.priceHistory.push({
      timestamp: Date.now(),
      price: currentPrice,
    });

    // Keep only last 100 data points
    if (this.priceHistory.length > 100) {
      this.priceHistory.shift();
    }

    logDebug('[PriceStabilizer] Price update', { price: currentPrice.toFixed(6), marketCap: currentMc.toLocaleString(), historyPoints: this.priceHistory.length });

    // Check if MC is above minimum threshold
    if (currentMc < this.config.minMcToStabilize) {
      logDebug('[PriceStabilizer] MC below threshold, waiting', { threshold: this.config.minMcToStabilize.toLocaleString() });
      return;
    }

    // Need at least 21 data points for EMA analysis
    if (this.priceHistory.length < 21) {
      logDebug('[PriceStabilizer] Collecting data', { current: this.priceHistory.length, required: 21 });
      return;
    }

    // Analyze technicals
    const technicals = analyzeTechnicals(this.priceHistory);
    if (!technicals) {
      logDebug('[PriceStabilizer] Insufficient data for analysis');
      return;
    }

    // Log technical analysis
    logDebug('[PriceStabilizer] Technical Analysis', {
      ema9: technicals.ema9.toFixed(6),
      ema21: technicals.ema21.toFixed(6),
      ema50: technicals.ema50.toFixed(6),
      trend: technicals.trend.toUpperCase(),
      buyZone: technicals.buyZone,
      sellZone: technicals.sellZone,
      fib382: technicals.fibLevels.level_382.toFixed(6),
      fib618: technicals.fibLevels.level_618.toFixed(6),
    });

    // Decision: BUY if in golden pocket (38.2% - 61.8% retracement) during uptrend/neutral
    if (technicals.buyZone && !technicals.sellZone) {
      logInfo('[PriceStabilizer] BUY SIGNAL: Price in Fibonacci golden pocket');
      await this.executeBuy();
    }
    // Also buy if price touches EMA50 support during uptrend
    else if (technicals.trend === 'bullish' && currentPrice <= technicals.ema50 * 1.02) {
      logInfo('[PriceStabilizer] BUY SIGNAL: Price at EMA50 support during uptrend');
      await this.executeBuy();
    }
    // Emergency buy if price crashes below Fib 78.6%
    else if (currentPrice < technicals.fibLevels.level_786) {
      logInfo('[PriceStabilizer] EMERGENCY BUY: Price below Fib 78.6%');
      await this.executeBuy();
    }
    else {
      logDebug('[PriceStabilizer] No buy signal, continuing to monitor');
    }
  }

  private async executeBuy(): Promise<void> {
    const wallet = this.getRandomWallet();
    if (!wallet) {
      logDebug('[PriceStabilizer] No active wallets available');
      return;
    }

    let privateKey: string;
    try {
      privateKey = decrypt(wallet.encryptedPrivateKey);
    } catch {
      logError('[PriceStabilizer] Failed to decrypt wallet key', new Error('Decryption failed'));
      return;
    }

    // Check balance
    const balance = await getSOLBalance(wallet.address);
    const buyAmount = Math.min(this.config.maxBuyPerStabilize, balance - 0.01);
    
    if (buyAmount < 0.05) {
      logDebug('[PriceStabilizer] Insufficient funds', { wallet: wallet.address.slice(0,8), balance: balance.toFixed(4) });
      return;
    }

    logInfo('[PriceStabilizer] Executing buy', { amount: buyAmount.toFixed(4) });

    const result = await buyOnBondingCurve(
      privateKey,
      this.config.tokenMint,
      buyAmount,
      this.config.slippageBps
    );

    this.log({
      timestamp: new Date(),
      type: 'stabilize',
      wallet: wallet.address,
      amount: buyAmount,
      signature: result.signature,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      logInfo('[PriceStabilizer] Buy successful', { signature: result.signature?.slice(0, 20) });
    } else {
      logError('[PriceStabilizer] Buy failed', new Error(result.error || 'Unknown error'));
    }
  }

  getLogs(): TradeLog[] {
    return this.logs;
  }

  // Get current status for display
  getStatus(): { timeframe: number; dataPoints: number; trend: string } {
    const technicals = this.priceHistory.length >= 21 ? analyzeTechnicals(this.priceHistory) : null;
    return {
      timeframe: this.getCurrentTimeframe(),
      dataPoints: this.priceHistory.length,
      trend: technicals?.trend || 'collecting',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOLUME FARMER
// Sells small amounts into net positive volume (anti-dump)
// ═══════════════════════════════════════════════════════════════════════════════

export class VolumeFarmer {
  private config: TradingConfig;
  private wallets: WalletInfo[];
  private isRunning: boolean = false;
  private logs: TradeLog[] = [];
  private onLog?: (log: TradeLog) => void;

  constructor(config: TradingConfig, wallets: WalletInfo[], onLog?: (log: TradeLog) => void) {
    this.config = config;
    this.wallets = wallets.filter(w => w.isActive);
    this.onLog = onLog;
  }

  private log(log: TradeLog) {
    this.logs.push(log);
    logInfo(`[VolumeFarmer] ${log.type.toUpperCase()} ${log.success ? '✓' : '✗'}`, { amount: log.amount });
    if (this.onLog) this.onLog(log);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getWalletWithTokens(): WalletInfo | null {
    // In production, check which wallet has most tokens
    if (this.wallets.length === 0) return null;
    return this.wallets[Math.floor(Math.random() * this.wallets.length)];
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logInfo('[VolumeFarmer] Starting');

    while (this.isRunning && this.config.volumeFarmerEnabled) {
      try {
        await this.checkAndFarm();
        await this.sleep(15000); // Check every 15 seconds
      } catch (error) {
        logError('[VolumeFarmer] Error', error as Error);
        await this.sleep(5000);
      }
    }

    logInfo('[VolumeFarmer] Stopped');
  }

  stop(): void {
    this.isRunning = false;
  }

  private async checkAndFarm(): Promise<void> {
    // Fetch token data to check volume
    const tokenData = await fetchPumpFunToken(this.config.tokenMint);
    if (!tokenData) return;

    // TODO: Get actual volume data from API
    // For now, we'll simulate with random chance
    const shouldFarm = Math.random() > 0.7; // 30% chance to farm

    if (!shouldFarm) return;

    const wallet = this.getWalletWithTokens();
    if (!wallet) return;

    let privateKey: string;
    try {
      privateKey = decrypt(wallet.encryptedPrivateKey);
    } catch {
      return;
    }

    // Check token balance
    const tokenBalance = await getTokenBalance(wallet.address, this.config.tokenMint);
    if (!tokenBalance || tokenBalance <= 0) {
      logDebug('[VolumeFarmer] No tokens to farm');
      return;
    }

    // Sell small percentage
    const sellAmount = Math.floor(tokenBalance * (this.config.volumeFarmPercent / 100));
    if (sellAmount <= 0) return;

    logInfo('[VolumeFarmer] Farming tokens', { amount: sellAmount });

    const result = await sellOnBondingCurve(
      privateKey,
      this.config.tokenMint,
      sellAmount,
      this.config.slippageBps
    );

    this.log({
      timestamp: new Date(),
      type: 'farm',
      wallet: wallet.address,
      amount: sellAmount,
      signature: result.signature,
      success: result.success,
      error: result.error,
    });
  }

  getLogs(): TradeLog[] {
    return this.logs;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRADING BOT MANAGER
// Orchestrates all trading strategies
// ═══════════════════════════════════════════════════════════════════════════════

export class TradingBotManager {
  private volumeBot: VolumeBot | null = null;
  private priceStabilizer: PriceStabilizer | null = null;
  private volumeFarmer: VolumeFarmer | null = null;
  private config: TradingConfig;
  private wallets: WalletInfo[];
  private onLog?: (log: TradeLog) => void;

  constructor(config: TradingConfig, wallets: WalletInfo[], onLog?: (log: TradeLog) => void) {
    this.config = config;
    this.wallets = wallets;
    this.onLog = onLog;
  }

  updateConfig(config: Partial<TradingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  updateWallets(wallets: WalletInfo[]): void {
    this.wallets = wallets;
  }

  startVolumeBot(): void {
    if (this.volumeBot) {
      this.volumeBot.stop();
    }
    this.volumeBot = new VolumeBot(this.config, this.wallets, this.onLog);
    this.volumeBot.start();
  }

  stopVolumeBot(): void {
    if (this.volumeBot) {
      this.volumeBot.stop();
      this.volumeBot = null;
    }
  }

  startPriceStabilizer(): void {
    if (this.priceStabilizer) {
      this.priceStabilizer.stop();
    }
    this.priceStabilizer = new PriceStabilizer(this.config, this.wallets, this.onLog);
    this.priceStabilizer.start();
  }

  stopPriceStabilizer(): void {
    if (this.priceStabilizer) {
      this.priceStabilizer.stop();
      this.priceStabilizer = null;
    }
  }

  startVolumeFarmer(): void {
    if (this.volumeFarmer) {
      this.volumeFarmer.stop();
    }
    this.volumeFarmer = new VolumeFarmer(this.config, this.wallets, this.onLog);
    this.volumeFarmer.start();
  }

  stopVolumeFarmer(): void {
    if (this.volumeFarmer) {
      this.volumeFarmer.stop();
      this.volumeFarmer = null;
    }
  }

  stopAll(): void {
    this.stopVolumeBot();
    this.stopPriceStabilizer();
    this.stopVolumeFarmer();
  }

  getAllLogs(): TradeLog[] {
    const logs: TradeLog[] = [];
    if (this.volumeBot) logs.push(...this.volumeBot.getLogs());
    if (this.priceStabilizer) logs.push(...this.priceStabilizer.getLogs());
    if (this.volumeFarmer) logs.push(...this.volumeFarmer.getLogs());
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_TRADING_CONFIG: TradingConfig = {
  tokenMint: '',
  // Volume Bot
  volumeBotEnabled: false,
  buyAmountSol: 1.0,
  sellSplitCount: 5,
  delayBetweenSellsMs: 1500,
  // Price Stabilizer
  priceStabilizerEnabled: false,
  minMcToStabilize: 50000,
  buyDipPercent: 5,
  maxBuyPerStabilize: 0.5,
  // Volume Farmer
  volumeFarmerEnabled: false,
  volumeFarmPercent: 8,
  minVolumeToFarm: 1000,
  // General
  maxSupplyPercent: 2,
  maxSolPerWallet: 10,
  slippageBps: 1000, // 10%
  cooldownMs: 60000, // 1 minute
};

