// ═══════════════════════════════════════════════════════════════════════════════
// PARRY ENGINE - The Autonomous Trading Brain
// Combines: Technical Analysis (EMA/Fib) + AI Decisions + Strategy Execution
// ═══════════════════════════════════════════════════════════════════════════════

import { 
  buyOnBondingCurve, 
  sellOnBondingCurve, 
  getSOLBalance,
  getTokenBalance,
  fetchPumpFunToken,
  type PumpFunTokenData
} from './solana';
import { decrypt } from './encryption';
import {
  calculateIndicators,
  getIndicatorSummary,
  type TechnicalIndicators,
} from './chart-data';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParryConfig {
  tokenMint: string;
  // Strategy toggles
  volumeBotEnabled: boolean;
  priceStabilizerEnabled: boolean;
  volumeFarmerEnabled: boolean;
  // Market cap thresholds
  minMcToSell: number;
  lightMcThreshold: number;
  mediumMcThreshold: number;
  heavyMcThreshold: number;
  // Sell percentages
  lightSellPercent: number;
  mediumSellPercent: number;
  heavySellPercent: number;
  volumeFarmingPercent: number;
  // Trade limits
  maxSellPerTrade: number;
  maxBuyPerTrade: number;
  cooldownSeconds: number;
  // Wallet limits
  maxSupplyPercent: number;
  maxSolPerWallet: number;
  // Execution
  slippageBps: number;
  // AI
  deepseekApiKey?: string;
  customPersonality?: string;
}

export interface WalletInfo {
  id: string;
  address: string;
  encryptedPrivateKey: string;
  isActive: boolean;
}

export interface ParryLogEntry {
  timestamp: Date;
  type: 'info' | 'trade' | 'analysis' | 'ai' | 'error' | 'decision';
  message: string;
  data?: any;
}

export interface MarketState {
  price: number;
  priceChange1m: number;
  priceChange5m: number;
  marketCap: number;
  volume24h: number;
  trend: 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';
  // From real chart data
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  // Fibonacci
  fibLevels: {
    high: number;
    low: number;
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_786: number;
  };
  inGoldenPocket: boolean;
  // Signals
  emaCrossUp: boolean;
  emaCrossDown: boolean;
  buySignal: boolean;
  sellSignal: boolean;
  // Raw indicators for AI
  indicators: TechnicalIndicators | null;
}

export interface ParryDecision {
  action: 'buy' | 'sell' | 'hold' | 'wait';
  reason: string;
  amount: number;
  confidence: number;
  aiInsight?: string;
}

// Price history for fallback tracking
interface PricePoint {
  timestamp: number;
  price: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARRY ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ParryEngine {
  private config: ParryConfig;
  private wallets: WalletInfo[];
  private isRunning: boolean = false;
  private logs: ParryLogEntry[] = [];
  private priceHistory: PricePoint[] = [];
  private lastTradeTime: number = 0;
  private startTime: number = 0;
  private onLog?: (log: ParryLogEntry) => void;

  // Timeframe progression (seconds)
  private readonly TIMEFRAMES = [30, 60, 300, 900]; // 30s, 1m, 5m, 15m
  private readonly TIMEFRAME_UPGRADE_INTERVAL = 15 * 60 * 1000; // Every 15 min

  constructor(config: ParryConfig, wallets: WalletInfo[], onLog?: (log: ParryLogEntry) => void) {
    this.config = config;
    this.wallets = wallets.filter(w => w.isActive);
    this.onLog = onLog;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  private log(type: ParryLogEntry['type'], message: string, data?: any) {
    const entry: ParryLogEntry = {
      timestamp: new Date(),
      type,
      message,
      data,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop();
    
    const prefix = {
      info: '📋',
      trade: '💰',
      analysis: '📊',
      ai: '🤖',
      error: '❌',
      decision: '🎯',
    }[type];
    
    // Use structured logging instead of console.log
    // The onLog callback handles the actual logging
    if (this.onLog) this.onLog(entry);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET ANALYSIS (Using Real Chart Data)
  // ═══════════════════════════════════════════════════════════════════════════

  private async analyzeMarket(): Promise<MarketState | null> {
    try {
      // Fetch basic token data
      const tokenData = await fetchPumpFunToken(this.config.tokenMint);
      const marketCap = tokenData?.usd_market_cap || 0;

      // Fetch REAL chart data and calculate indicators
      this.log('analysis', 'Fetching chart data from Birdeye/DexScreener...');
      const indicators = await calculateIndicators(this.config.tokenMint);

      if (!indicators) {
        this.log('error', 'Failed to fetch chart data - using fallback');
        
        // Fallback to basic price tracking
        if (!tokenData) return null;
        
        const currentPrice = tokenData.market_cap || 0;
        this.priceHistory.push({ timestamp: Date.now(), price: currentPrice });
        if (this.priceHistory.length > 100) this.priceHistory.shift();
        
        if (this.priceHistory.length < 5) {
          this.log('info', `Collecting data... ${this.priceHistory.length}/5 points`);
          return null;
        }

        // Return minimal state
        return {
          price: currentPrice,
          priceChange1m: 0,
          priceChange5m: 0,
          marketCap,
          volume24h: 0,
          trend: 'neutral',
          ema9: currentPrice,
          ema21: currentPrice,
          ema50: currentPrice,
          ema200: currentPrice,
          rsi14: 50,
          fibLevels: {
            high: currentPrice * 1.1,
            low: currentPrice * 0.9,
            level_236: currentPrice * 1.05,
            level_382: currentPrice * 1.03,
            level_500: currentPrice,
            level_618: currentPrice * 0.97,
            level_786: currentPrice * 0.95,
          },
          inGoldenPocket: false,
          emaCrossUp: false,
          emaCrossDown: false,
          buySignal: false,
          sellSignal: false,
          indicators: null,
        };
      }

      // Log the real indicators
      this.log('analysis', 
        `EMA9: $${indicators.ema9.toFixed(8)} | ` +
        `EMA21: $${indicators.ema21.toFixed(8)} | ` +
        `RSI: ${indicators.rsi14.toFixed(1)}`
      );

      const currentPrice = indicators.currentPrice;

      // Calculate price changes from candles
      const candles = indicators.rawCandles;
      const priceChange1m = candles.length > 2 
        ? ((currentPrice - candles[candles.length - 3]?.close) / candles[candles.length - 3]?.close * 100) || 0
        : 0;
      const priceChange5m = candles.length > 10
        ? ((currentPrice - candles[candles.length - 11]?.close) / candles[candles.length - 11]?.close * 100) || 0
        : 0;

      // Generate BUY signal
      const buySignal = 
        // In golden pocket with bullish momentum
        (indicators.inGoldenPocket && (indicators.trend === 'bull' || indicators.trend === 'strong_bull')) ||
        // EMA9 crossed above EMA21 (bullish crossover)
        indicators.emaCrossUp ||
        // RSI oversold bounce
        (indicators.rsi14 < 35 && indicators.priceVsEma50 < 3) ||
        // Price testing EMA50 support in uptrend
        (indicators.trend !== 'bear' && indicators.trend !== 'strong_bear' && 
         indicators.priceVsEma50 >= -2 && indicators.priceVsEma50 <= 2);

      // Generate SELL signal
      const sellSignal = 
        // EMA bearish crossover
        indicators.emaCrossDown ||
        // RSI overbought
        (indicators.rsi14 > 75) ||
        // Price way above EMAs (overextended)
        (indicators.priceVsEma9 > 15) ||
        // Strong bear trend
        (indicators.trend === 'strong_bear' && indicators.priceVsEma21 < -5);

      return {
        price: currentPrice,
        priceChange1m,
        priceChange5m,
        marketCap,
        volume24h: marketCap * 0.1,
        trend: indicators.trend,
        ema9: indicators.ema9,
        ema21: indicators.ema21,
        ema50: indicators.ema50,
        ema200: indicators.ema200,
        rsi14: indicators.rsi14,
        fibLevels: {
          high: indicators.fibHigh,
          low: indicators.fibLow,
          level_236: indicators.fib236,
          level_382: indicators.fib382,
          level_500: indicators.fib500,
          level_618: indicators.fib618,
          level_786: indicators.fib786,
        },
        inGoldenPocket: indicators.inGoldenPocket,
        emaCrossUp: indicators.emaCrossUp,
        emaCrossDown: indicators.emaCrossDown,
        buySignal,
        sellSignal,
        indicators,
      };
    } catch (error) {
      this.log('error', `Market analysis failed: ${error}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI DECISION (DeepSeek)
  // ═══════════════════════════════════════════════════════════════════════════

  private async getAIDecision(market: MarketState): Promise<string | null> {
    if (!this.config.deepseekApiKey) {
      return null;
    }

    try {
      // Build rich technical analysis prompt
      const indicatorSummary = market.indicators 
        ? getIndicatorSummary(market.indicators)
        : `Price: $${market.price.toFixed(8)}\nTrend: ${market.trend}`;

      const prompt = `You are PARRY, an autonomous crypto trading AI with deep technical analysis skills.

${indicatorSummary}

MARKET CONTEXT:
- Market Cap: $${market.marketCap.toLocaleString()}
- 1m Change: ${market.priceChange1m > 0 ? '+' : ''}${market.priceChange1m.toFixed(2)}%
- 5m Change: ${market.priceChange5m > 0 ? '+' : ''}${market.priceChange5m.toFixed(2)}%
- Buy Signal: ${market.buySignal ? 'ACTIVE 🟢' : 'inactive'}
- Sell Signal: ${market.sellSignal ? 'ACTIVE 🔴' : 'inactive'}
- EMA Crossover Up: ${market.emaCrossUp ? 'YES' : 'no'}
- EMA Crossover Down: ${market.emaCrossDown ? 'YES' : 'no'}

Based on the technical indicators above, give a brief trading recommendation in 1-2 sentences.
${this.config.customPersonality || 'Be decisive and use lowercase. Focus on the key signals.'}`;

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.deepseekApiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
      }
    } catch (error) {
      this.log('error', `AI decision failed: ${error}`);
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DECISION MAKING
  // ═══════════════════════════════════════════════════════════════════════════

  private async makeDecision(market: MarketState): Promise<ParryDecision> {
    const mc = market.marketCap;
    const config = this.config;

    // Check cooldown
    const timeSinceLastTrade = Date.now() - this.lastTradeTime;
    if (timeSinceLastTrade < config.cooldownSeconds * 1000) {
      return {
        action: 'wait',
        reason: `Cooldown: ${Math.ceil((config.cooldownSeconds * 1000 - timeSinceLastTrade) / 1000)}s remaining`,
        amount: 0,
        confidence: 0,
      };
    }

    // Get AI insight
    const aiInsightResult = await this.getAIDecision(market);
    const aiInsight = aiInsightResult || undefined;
    if (aiInsight) {
      this.log('ai', aiInsight);
    }

    // SELL LOGIC (Volume Farmer + Price Stabilizer sells)
    if (this.config.volumeFarmerEnabled && market.sellSignal && mc >= config.minMcToSell) {
      let sellPercent = config.lightSellPercent;
      let reason = 'Light sell';

      // Determine sell intensity based on market cap AND technical signals
      if (mc >= config.heavyMcThreshold) {
        sellPercent = config.heavySellPercent;
        reason = 'Heavy sell - high MC euphoria';
      } else if (mc >= config.mediumMcThreshold) {
        sellPercent = config.mediumSellPercent;
        reason = 'Medium sell - good MC levels';
      }

      // Add extra context from indicators
      if (market.emaCrossDown) {
        reason += ' + EMA bearish cross';
        sellPercent = Math.min(sellPercent * 1.2, config.maxSellPerTrade * 100);
      }
      if (market.rsi14 > 75) {
        reason += ' + RSI overbought';
        sellPercent = Math.min(sellPercent * 1.3, config.maxSellPerTrade * 100);
      }

      return {
        action: 'sell',
        reason,
        amount: Math.min(config.maxSellPerTrade, sellPercent / 100),
        confidence: market.emaCrossDown ? 0.9 : market.sellSignal ? 0.8 : 0.5,
        aiInsight,
      };
    }

    // BUY LOGIC (Price Stabilizer)
    if (this.config.priceStabilizerEnabled && market.buySignal) {
      let reason = 'Buy signal';
      let confidence = 0.6;
      
      // Determine buy reason from indicators
      if (market.emaCrossUp) {
        reason = 'EMA9 crossed above EMA21 (bullish)';
        confidence = 0.85;
      } else if (market.inGoldenPocket) {
        reason = 'In Fibonacci golden pocket (38.2%-61.8%)';
        confidence = 0.8;
      } else if (market.rsi14 < 35) {
        reason = 'RSI oversold bounce';
        confidence = 0.75;
      } else if (market.price <= market.ema50 * 1.02) {
        reason = 'Testing EMA50 support';
        confidence = 0.7;
      }

      return {
        action: 'buy',
        reason,
        amount: config.maxBuyPerTrade,
        confidence,
        aiInsight,
      };
    }

    // VOLUME BOT (simple buy/sell cycles)
    if (this.config.volumeBotEnabled && Math.random() > 0.7) {
      // 30% chance to generate volume
      const action = Math.random() > 0.5 ? 'buy' : 'sell';
      return {
        action: action as 'buy' | 'sell',
        reason: 'Volume generation cycle',
        amount: action === 'buy' ? config.maxBuyPerTrade * 0.5 : config.maxSellPerTrade * 0.3,
        confidence: 0.4,
        aiInsight,
      };
    }

    return {
      action: 'hold',
      reason: 'No strong signals - holding position',
      amount: 0,
      confidence: 0.5,
      aiInsight,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRADE EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  private getRandomActiveWallet(): WalletInfo | null {
    const active = this.wallets.filter(w => w.isActive);
    if (active.length === 0) return null;
    return active[Math.floor(Math.random() * active.length)];
  }

  private async executeTrade(decision: ParryDecision): Promise<boolean> {
    if (decision.action === 'hold' || decision.action === 'wait') {
      return false;
    }

    const wallet = this.getRandomActiveWallet();
    if (!wallet) {
      this.log('error', 'No active wallets available');
      return false;
    }

    let privateKey: string;
    try {
      privateKey = decrypt(wallet.encryptedPrivateKey);
    } catch {
      this.log('error', 'Failed to decrypt wallet key');
      return false;
    }

    const walletShort = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;

    if (decision.action === 'buy') {
      // Check SOL balance
      const balance = await getSOLBalance(wallet.address);
      const buyAmount = Math.min(decision.amount, balance - 0.01);
      
      if (buyAmount < 0.01) {
        this.log('error', `Wallet ${walletShort} has insufficient SOL (${balance.toFixed(4)})`);
        return false;
      }

      this.log('trade', `BUY ${buyAmount.toFixed(4)} SOL via ${walletShort} | ${decision.reason}`);
      
      const result = await buyOnBondingCurve(
        privateKey,
        this.config.tokenMint,
        buyAmount,
        this.config.slippageBps
      );

      if (result.success) {
        this.log('trade', `✅ Buy successful! TX: ${result.signature?.slice(0, 20)}...`);
        this.lastTradeTime = Date.now();
        return true;
      } else {
        this.log('error', `Buy failed: ${result.error}`);
        return false;
      }
    }

    if (decision.action === 'sell') {
      // Check token balance
      const tokenBalance = await getTokenBalance(wallet.address, this.config.tokenMint);
      if (!tokenBalance || tokenBalance <= 0) {
        this.log('error', `Wallet ${walletShort} has no tokens to sell`);
        return false;
      }

      // Calculate sell amount (percentage of holdings)
      const sellAmount = Math.floor(tokenBalance * decision.amount);
      if (sellAmount <= 0) {
        this.log('error', 'Sell amount too small');
        return false;
      }

      this.log('trade', `SELL ${sellAmount.toLocaleString()} tokens via ${walletShort} | ${decision.reason}`);

      const result = await sellOnBondingCurve(
        privateKey,
        this.config.tokenMint,
        sellAmount,
        this.config.slippageBps
      );

      if (result.success) {
        this.log('trade', `✅ Sell successful! TX: ${result.signature?.slice(0, 20)}...`);
        this.lastTradeTime = Date.now();
        return true;
      } else {
        this.log('error', `Sell failed: ${result.error}`);
        return false;
      }
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  private getCurrentTimeframe(): number {
    const elapsed = Date.now() - this.startTime;
    const index = Math.min(
      Math.floor(elapsed / this.TIMEFRAME_UPGRADE_INTERVAL),
      this.TIMEFRAMES.length - 1
    );
    return this.TIMEFRAMES[index];
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('info', 'PARRY is already running');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.priceHistory = [];

    this.log('info', '═══════════════════════════════════════');
    this.log('info', '🚀 PARRY ENGINE INITIALIZED');
    this.log('info', `Token: ${this.config.tokenMint.slice(0, 12)}...`);
    this.log('info', `Active wallets: ${this.wallets.length}`);
    this.log('info', `Volume Bot: ${this.config.volumeBotEnabled ? 'ON' : 'OFF'}`);
    this.log('info', `Price Stabilizer: ${this.config.priceStabilizerEnabled ? 'ON' : 'OFF'}`);
    this.log('info', `Volume Farmer: ${this.config.volumeFarmerEnabled ? 'ON' : 'OFF'}`);
    this.log('info', `AI: ${this.config.deepseekApiKey ? 'CONNECTED' : 'DISABLED'}`);
    this.log('info', '═══════════════════════════════════════');

    while (this.isRunning) {
      try {
        const timeframe = this.getCurrentTimeframe();
        this.log('analysis', `━━━ Cycle Start (TF: ${timeframe}s) ━━━`);

        // 1. Analyze market
        const market = await this.analyzeMarket();
        
        if (market) {
          this.log('analysis', 
            `MC: $${market.marketCap.toLocaleString()} | ` +
            `Trend: ${market.trend.toUpperCase()} | ` +
            `1m: ${market.priceChange1m > 0 ? '+' : ''}${market.priceChange1m.toFixed(2)}%`
          );

          // 2. Make decision
          const decision = await this.makeDecision(market);
          
          this.log('decision', 
            `Action: ${decision.action.toUpperCase()} | ` +
            `Confidence: ${(decision.confidence * 100).toFixed(0)}% | ` +
            `${decision.reason}`
          );

          // 3. Execute if actionable
          if (decision.action !== 'hold' && decision.action !== 'wait') {
            await this.executeTrade(decision);
          }
        }

        // Wait before next cycle
        const checkInterval = Math.max(10000, timeframe * 1000 / 2);
        this.log('info', `Next cycle in ${checkInterval / 1000}s...`);
        await this.sleep(checkInterval);

      } catch (error) {
        this.log('error', `Loop error: ${error}`);
        await this.sleep(5000);
      }
    }

    this.log('info', '🛑 PARRY ENGINE STOPPED');
  }

  stop(): void {
    this.isRunning = false;
    this.log('info', 'Stopping PARRY...');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  isActive(): boolean {
    return this.isRunning;
  }

  getLogs(): ParryLogEntry[] {
    return this.logs;
  }

  getStatus(): {
    running: boolean;
    uptime: number;
    timeframe: number;
    dataPoints: number;
    lastTrade: number;
  } {
    return {
      running: this.isRunning,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      timeframe: this.getCurrentTimeframe(),
      dataPoints: this.priceHistory.length,
      lastTrade: this.lastTradeTime,
    };
  }

  updateConfig(config: Partial<ParryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  updateWallets(wallets: WalletInfo[]): void {
    this.wallets = wallets.filter(w => w.isActive);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let parryInstance: ParryEngine | null = null;

export function getParryEngine(): ParryEngine | null {
  return parryInstance;
}

export function createParryEngine(
  config: ParryConfig, 
  wallets: WalletInfo[],
  onLog?: (log: ParryLogEntry) => void
): ParryEngine {
  if (parryInstance) {
    parryInstance.stop();
  }
  parryInstance = new ParryEngine(config, wallets, onLog);
  return parryInstance;
}

export function stopParryEngine(): void {
  if (parryInstance) {
    parryInstance.stop();
    parryInstance = null;
  }
}

