// ═══════════════════════════════════════════════════════════════════════════════
// PARRY BRAIN - The Complete Autonomous Market Maker
// ═══════════════════════════════════════════════════════════════════════════════
// 
// This is PARRY's central nervous system. She:
// 1. Watches the market in real-time
// 2. Analyzes using EMA, Fibonacci, RSI
// 3. Detects euphoria/fear phases
// 4. Executes trades on pump.fun
// 5. Posts schizo updates on Twitter
// 
// ═══════════════════════════════════════════════════════════════════════════════

import { Keypair, PublicKey } from '@solana/web3.js';
import { 
  MarketState, 
  PriceCandle, 
  TradeSignal,
  StrategyConfig,
  DEFAULT_STRATEGY_CONFIG,
  buildMarketState,
  generateTradeSignal,
  formatSignal,
  getTimeframe,
  calculateEMA,
  calculateFibonacci,
  findHighLow,
  detectMarketPhase
} from './trading-strategy';
import { logInfo, logDebug, logWarn, logError } from './logger';
import { 
  executeSignal, 
  getPosition, 
  loadWallet,
  TradingConfig,
  TradeResult,
  Position
} from './trading-executor';
import { 
  fetchPumpFunToken, 
  fetchRecentTrades, 
  getAnusMarketData,
  PumpFunTrade,
  formatMarketSummary
} from './data-feed';
import { 
  generateSchizoPost, 
  generateDataDrivenPost, 
  generatePredictionPost,
  AnusMarketData
} from './ai';
import { postTweet, isTwitterConfigured } from './twitter';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParryConfig {
  // Token config
  tokenMint: string;
  walletPrivateKey: string;
  
  // Trading config
  tradingEnabled: boolean;
  tradingConfig: TradingConfig;
  strategyConfig: StrategyConfig;
  
  // Twitter config
  twitterEnabled: boolean;
  tweetIntervalMinutes: number;
  
  // Loop config
  analysisIntervalSeconds: number;
  
  // Debug
  dryRun: boolean;
  verbose: boolean;
}

export interface ParryState {
  isRunning: boolean;
  startTime: number;
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  position: Position;
  marketState: MarketState | null;
  candles: PriceCandle[];
  trades: TradeResult[];
  tweets: string[];
  lastTrade: number;
  lastTweet: number;
  lastAnalysis: number;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_PARRY_CONFIG: Partial<ParryConfig> = {
  tradingEnabled: true,
  tradingConfig: {
    maxSlippage: 5,
    minTradeSize: 0.05,
    maxTradeSize: 2,
    cooldownMs: 60000, // 1 minute between trades
    dryRun: true, // Start with dry run!
  },
  strategyConfig: DEFAULT_STRATEGY_CONFIG,
  twitterEnabled: false, // Enable when ready
  tweetIntervalMinutes: 30,
  analysisIntervalSeconds: 30,
  dryRun: true,
  verbose: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PARRY BRAIN CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ParryBrain {
  private config: ParryConfig;
  private state: ParryState;
  private wallet: Keypair;
  private tokenMint: PublicKey;
  private intervalId: NodeJS.Timeout | null = null;
  private tweetIntervalId: NodeJS.Timeout | null = null;
  
  constructor(config: ParryConfig) {
    this.config = { ...DEFAULT_PARRY_CONFIG, ...config } as ParryConfig;
    
    // Load wallet
    this.wallet = loadWallet(config.walletPrivateKey);
    this.tokenMint = new PublicKey(config.tokenMint);
    
    // Initialize state
    this.state = {
      isRunning: false,
      startTime: 0,
      tokenMint: config.tokenMint,
      tokenName: '',
      tokenSymbol: '',
      position: {
        tokenMint: config.tokenMint,
        tokens: 0,
        avgPrice: 0,
        solBalance: 0,
        lastUpdate: 0,
      },
      marketState: null,
      candles: [],
      trades: [],
      tweets: [],
      lastTrade: 0,
      lastTweet: 0,
      lastAnalysis: 0,
      errors: [],
    };
    
    this.log('PARRY Brain initialized');
    this.log(`Token: ${config.tokenMint}`);
    this.log(`Wallet: ${this.wallet.publicKey.toBase58()}`);
    this.log(`Dry Run: ${config.dryRun}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════════════════════════════════════════
  
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    if (!this.config.verbose && level === 'info') return;
    
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '🧠';
    if (level === 'error') {
      logError(`[${timestamp}] ${prefix} PARRY: ${message}`);
    } else if (level === 'warn') {
      logWarn(`[${timestamp}] ${prefix} PARRY: ${message}`);
    } else {
      logDebug(`[${timestamp}] ${prefix} PARRY: ${message}`);
    }
  }
  
  private logTrade(signal: TradeSignal) {
    logInfo('🔔 TRADE SIGNAL', { signal: formatSignal(signal) });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // START/STOP
  // ═══════════════════════════════════════════════════════════════════════════
  
  async start(): Promise<void> {
    if (this.state.isRunning) {
      this.log('Already running!', 'warn');
      return;
    }
    
    this.log('Starting PARRY Brain...');
    this.state.isRunning = true;
    this.state.startTime = Date.now();
    
    // Fetch initial token data
    await this.fetchTokenInfo();
    
    // Get initial position
    await this.updatePosition();
    
    // Start analysis loop
    this.intervalId = setInterval(
      () => this.runAnalysisCycle(),
      this.config.analysisIntervalSeconds * 1000
    );
    
    // Start tweet loop if enabled
    if (this.config.twitterEnabled && isTwitterConfigured()) {
      this.tweetIntervalId = setInterval(
        () => this.postUpdate(),
        this.config.tweetIntervalMinutes * 60 * 1000
      );
    }
    
    // Run first cycle immediately
    await this.runAnalysisCycle();
    
    this.log('PARRY Brain is now LIVE! 🚀');
  }
  
  stop(): void {
    this.log('Stopping PARRY Brain...');
    this.state.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.tweetIntervalId) {
      clearInterval(this.tweetIntervalId);
      this.tweetIntervalId = null;
    }
    
    this.log('PARRY Brain stopped.');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════════════════════
  
  private async fetchTokenInfo(): Promise<void> {
    try {
      const tokenData = await fetchPumpFunToken(this.config.tokenMint);
      if (tokenData) {
        this.state.tokenName = tokenData.name;
        this.state.tokenSymbol = tokenData.symbol;
        this.log(`Token loaded: ${tokenData.name} ($${tokenData.symbol})`);
      }
    } catch (error) {
      this.log(`Failed to fetch token info: ${error}`, 'error');
    }
  }
  
  private async updatePosition(): Promise<void> {
    try {
      this.state.position = await getPosition(this.wallet.publicKey, this.tokenMint);
      this.log(`Position: ${this.state.position.tokens.toFixed(2)} tokens, ${this.state.position.solBalance.toFixed(4)} SOL`);
    } catch (error) {
      this.log(`Failed to update position: ${error}`, 'error');
    }
  }
  
  private async fetchCandles(): Promise<void> {
    try {
      // Fetch recent trades and build candles
      const trades = await fetchRecentTrades(this.config.tokenMint, 200);
      
      // Convert trades to candles based on timeframe
      const tokenAgeMinutes = (Date.now() - this.state.startTime) / 60000;
      const { seconds: candleSeconds } = getTimeframe(tokenAgeMinutes);
      
      this.state.candles = this.buildCandlesFromTrades(trades, candleSeconds);
      this.log(`Built ${this.state.candles.length} candles (${candleSeconds}s timeframe)`);
      
    } catch (error) {
      this.log(`Failed to fetch candles: ${error}`, 'error');
    }
  }
  
  private buildCandlesFromTrades(trades: PumpFunTrade[], candleSeconds: number): PriceCandle[] {
    if (trades.length === 0) return [];
    
    const candleMs = candleSeconds * 1000;
    const candles: PriceCandle[] = [];
    
    // Sort trades by timestamp
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    
    // Group trades into candles
    let currentCandle: PriceCandle | null = null;
    
    for (const trade of sortedTrades) {
      const candleStart = Math.floor(trade.timestamp / candleMs) * candleMs;
      const price = trade.sol_amount / trade.token_amount; // Price per token
      const volume = trade.sol_amount / 1e9; // Volume in SOL
      
      if (!currentCandle || currentCandle.timestamp !== candleStart) {
        // Start new candle
        if (currentCandle) {
          candles.push(currentCandle);
        }
        currentCandle = {
          timestamp: candleStart,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume,
          buyVolume: trade.is_buy ? volume : 0,
          sellVolume: trade.is_buy ? 0 : volume,
        };
      } else {
        // Update current candle
        currentCandle.high = Math.max(currentCandle.high, price);
        currentCandle.low = Math.min(currentCandle.low, price);
        currentCandle.close = price;
        currentCandle.volume += volume;
        if (trade.is_buy) {
          currentCandle.buyVolume += volume;
        } else {
          currentCandle.sellVolume += volume;
        }
      }
    }
    
    if (currentCandle) {
      candles.push(currentCandle);
    }
    
    return candles;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYSIS CYCLE
  // ═══════════════════════════════════════════════════════════════════════════
  
  private async runAnalysisCycle(): Promise<void> {
    try {
      this.log('Running analysis cycle...');
      this.state.lastAnalysis = Date.now();
      
      // 1. Fetch latest data
      await this.fetchCandles();
      await this.updatePosition();
      
      if (this.state.candles.length < 10) {
        this.log('Not enough candles for analysis yet', 'warn');
        return;
      }
      
      // 2. Build market state
      const tokenAgeMinutes = (Date.now() - this.state.startTime) / 60000;
      this.state.marketState = buildMarketState(this.state.candles, tokenAgeMinutes);
      
      this.log(`Market Phase: ${this.state.marketState.phase}`);
      this.log(`Price: ${this.state.marketState.currentPrice.toFixed(10)}`);
      this.log(`RSI: ${this.state.marketState.rsi14.toFixed(1)}`);
      this.log(`Net Volume 5m: ${this.state.marketState.netVolume5m.toFixed(4)} SOL`);
      
      // 3. Generate trade signal
      const signal = generateTradeSignal(
        this.state.marketState,
        this.config.strategyConfig,
        {
          tokens: this.state.position.tokens,
          avgPrice: this.state.position.avgPrice,
          solBalance: this.state.position.solBalance,
        }
      );
      
      this.logTrade(signal);
      
      // 4. Execute if trading is enabled
      if (this.config.tradingEnabled && signal.action !== 'hold') {
        const timeSinceLastTrade = Date.now() - this.state.lastTrade;
        
        if (timeSinceLastTrade < this.config.tradingConfig.cooldownMs) {
          this.log(`Cooldown active. ${Math.ceil((this.config.tradingConfig.cooldownMs - timeSinceLastTrade) / 1000)}s remaining`);
        } else {
          const result = await executeSignal(
            signal,
            this.wallet,
            this.tokenMint,
            this.config.tradingConfig
          );
          
          if (result) {
            this.state.trades.push(result);
            this.state.lastTrade = Date.now();
            
            if (result.success) {
              this.log(`✅ Trade executed: ${result.signature}`);
            } else {
              this.log(`❌ Trade failed: ${result.error}`, 'error');
            }
          }
        }
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Analysis cycle error: ${errorMsg}`, 'error');
      this.state.errors.push(errorMsg);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TWITTER
  // ═══════════════════════════════════════════════════════════════════════════
  
  private async postUpdate(): Promise<void> {
    try {
      if (!isTwitterConfigured()) {
        this.log('Twitter not configured', 'warn');
        return;
      }
      
      // Get market data for context
      const marketData = await getAnusMarketData(this.config.tokenMint);
      
      // Generate post based on market state
      let post: string;
      
      if (this.state.marketState?.phase === 'euphoria') {
        post = await generateDataDrivenPost(marketData);
      } else if (Math.random() > 0.7) {
        post = await generatePredictionPost(marketData);
      } else {
        post = await generateSchizoPost();
      }
      
      // Post to Twitter
      const result = await postTweet(post);
      
      if (result.success) {
        this.state.tweets.push(post);
        this.state.lastTweet = Date.now();
        this.log(`🐦 Tweet posted: ${post.substring(0, 50)}...`);
      } else {
        this.log(`Tweet failed: ${result.error}`, 'error');
      }
      
    } catch (error) {
      this.log(`Twitter error: ${error}`, 'error');
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  
  getState(): ParryState {
    return { ...this.state };
  }
  
  getConfig(): ParryConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<ParryConfig>): void {
    this.config = { ...this.config, ...updates };
    this.log('Config updated');
  }
  
  async manualTweet(type: 'schizo' | 'data' | 'prediction' = 'schizo'): Promise<string | null> {
    try {
      const marketData = await getAnusMarketData(this.config.tokenMint);
      
      let post: string;
      switch (type) {
        case 'data':
          post = await generateDataDrivenPost(marketData);
          break;
        case 'prediction':
          post = await generatePredictionPost(marketData);
          break;
        default:
          post = await generateSchizoPost();
      }
      
      if (isTwitterConfigured() && !this.config.dryRun) {
        const result = await postTweet(post);
        if (result.success) {
          this.state.tweets.push(post);
          return post;
        }
      }
      
      return post;
    } catch (error) {
      this.log(`Manual tweet error: ${error}`, 'error');
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createParryBrain(config: Partial<ParryConfig> & { tokenMint: string; walletPrivateKey: string }): ParryBrain {
  const fullConfig: ParryConfig = {
    ...DEFAULT_PARRY_CONFIG,
    ...config,
    tradingConfig: {
      ...DEFAULT_PARRY_CONFIG.tradingConfig!,
      ...config.tradingConfig,
    },
    strategyConfig: {
      ...DEFAULT_PARRY_CONFIG.strategyConfig!,
      ...config.strategyConfig,
    },
  } as ParryConfig;
  
  return new ParryBrain(fullConfig);
}

