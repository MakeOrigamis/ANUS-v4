// ═══════════════════════════════════════════════════════════════════════════════
// PARRY ADJUSTABLE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
// 
// These are the parameters that can be adjusted without breaking the core algo.
// Core strategy (EMA, Fibonacci, RSI logic) should NOT be changed.
// 
// ═══════════════════════════════════════════════════════════════════════════════

export interface AdjustableConfig {
  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET CAP THRESHOLDS (when to start/stop selling)
  // ═══════════════════════════════════════════════════════════════════════════
  marketCap: {
    minToSell: number;              // Min MC to start selling (default: $250k)
    lightSellThreshold: number;     // Light selling starts (default: $250k)
    mediumSellThreshold: number;    // Medium selling starts (default: $500k)
    heavySellThreshold: number;     // Heavy selling starts (default: $1M)
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SELL PERCENTAGES (% of incoming buys to sell back)
  // ═══════════════════════════════════════════════════════════════════════════
  sellPercents: {
    light: number;                  // Light sell % (default: 6%)
    medium: number;                 // Medium sell % (default: 10%)
    heavy: number;                  // Heavy sell % (default: 14%)
    volumeFarming: number;          // Volume farming % (default: 8%)
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TRADE LIMITS (per transaction)
  // ═══════════════════════════════════════════════════════════════════════════
  tradeLimits: {
    maxSellPerTrade: number;        // Max SOL per sell (default: 2)
    maxBuyPerTrade: number;         // Max SOL per buy (default: 1)
    minTradeSize: number;           // Min trade size SOL (default: 0.05)
    cooldownSeconds: number;        // Seconds between trades (default: 60)
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // WALLET LIMITS (anti-whale)
  // ═══════════════════════════════════════════════════════════════════════════
  walletLimits: {
    maxSupplyPercent: number;       // Max % supply per wallet (default: 2%)
    maxSolValue: number;            // Max SOL value per wallet (default: 10)
    minWallets: number;             // Min wallets (default: 10)
    maxWallets: number;             // Max wallets (default: 25)
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // VOLUME REQUIREMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  volume: {
    minNetVolumeToSell: number;     // Min net positive vol to trigger sell (default: 0.5 SOL)
    minNetVolumeToFarm: number;     // Min net vol for farming (default: 0.3 SOL)
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SLIPPAGE & PRIORITY
  // ═══════════════════════════════════════════════════════════════════════════
  execution: {
    defaultSlippage: number;        // Default slippage % (default: 10)
    priorityFee: number;            // Priority fee SOL (default: 0.00005)
    useVanishTrade: boolean;        // Use vanish.trade for hidden txs (default: false)
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TWITTER/POSTING
  // ═══════════════════════════════════════════════════════════════════════════
  twitter: {
    enabled: boolean;               // Enable Twitter posting (default: false)
    intervalMinutes: number;        // Minutes between posts (default: 30)
    postOnTrade: boolean;           // Post when making trades (default: false)
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_ADJUSTABLE_CONFIG: AdjustableConfig = {
  marketCap: {
    minToSell: 250_000,
    lightSellThreshold: 250_000,
    mediumSellThreshold: 500_000,
    heavySellThreshold: 1_000_000,
  },
  sellPercents: {
    light: 6,
    medium: 10,
    heavy: 14,
    volumeFarming: 8,
  },
  tradeLimits: {
    maxSellPerTrade: 2,
    maxBuyPerTrade: 1,
    minTradeSize: 0.05,
    cooldownSeconds: 60,
  },
  walletLimits: {
    maxSupplyPercent: 2,
    maxSolValue: 10,
    minWallets: 10,
    maxWallets: 25,
  },
  volume: {
    minNetVolumeToSell: 0.5,
    minNetVolumeToFarm: 0.3,
  },
  execution: {
    defaultSlippage: 10,
    priorityFee: 0.00005,
    useVanishTrade: false,
  },
  twitter: {
    enabled: false,
    intervalMinutes: 30,
    postOnTrade: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfig(config: AdjustableConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Market cap validations
  if (config.marketCap.minToSell < 50_000) {
    warnings.push('Min market cap to sell is very low ($50k). Consider higher.');
  }
  if (config.marketCap.lightSellThreshold > config.marketCap.mediumSellThreshold) {
    errors.push('Light sell threshold must be <= medium threshold');
  }
  if (config.marketCap.mediumSellThreshold > config.marketCap.heavySellThreshold) {
    errors.push('Medium sell threshold must be <= heavy threshold');
  }
  
  // Sell percent validations
  if (config.sellPercents.light > 15) {
    warnings.push('Light sell % > 15% may cause price impact');
  }
  if (config.sellPercents.heavy > 20) {
    warnings.push('Heavy sell % > 20% may cause significant dumps');
  }
  
  // Wallet limits
  if (config.walletLimits.maxSupplyPercent > 5) {
    errors.push('Max supply % per wallet should not exceed 5%');
  }
  if (config.walletLimits.minWallets < 5) {
    warnings.push('Using < 5 wallets looks suspicious');
  }
  
  // Trade limits
  if (config.tradeLimits.maxSellPerTrade > 5) {
    warnings.push('Max sell > 5 SOL per trade may cause slippage');
  }
  if (config.tradeLimits.cooldownSeconds < 30) {
    warnings.push('Cooldown < 30s may look like bot activity');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const CONFIG_PRESETS = {
  // Conservative - for new tokens, slow and steady
  conservative: {
    ...DEFAULT_ADJUSTABLE_CONFIG,
    marketCap: {
      minToSell: 500_000,           // Wait for $500k
      lightSellThreshold: 500_000,
      mediumSellThreshold: 1_000_000,
      heavySellThreshold: 2_000_000,
    },
    sellPercents: {
      light: 4,
      medium: 7,
      heavy: 10,
      volumeFarming: 5,
    },
    tradeLimits: {
      ...DEFAULT_ADJUSTABLE_CONFIG.tradeLimits,
      cooldownSeconds: 120,         // 2 min between trades
    },
  } as AdjustableConfig,
  
  // Aggressive - for pumping tokens, faster action
  aggressive: {
    ...DEFAULT_ADJUSTABLE_CONFIG,
    marketCap: {
      minToSell: 150_000,           // Start at $150k
      lightSellThreshold: 150_000,
      mediumSellThreshold: 300_000,
      heavySellThreshold: 500_000,
    },
    sellPercents: {
      light: 8,
      medium: 12,
      heavy: 16,
      volumeFarming: 10,
    },
    tradeLimits: {
      ...DEFAULT_ADJUSTABLE_CONFIG.tradeLimits,
      cooldownSeconds: 30,          // 30s between trades
    },
  } as AdjustableConfig,
  
  // Stealth - with vanish.trade, hidden activity
  stealth: {
    ...DEFAULT_ADJUSTABLE_CONFIG,
    execution: {
      defaultSlippage: 15,          // Higher slippage for hidden txs
      priorityFee: 0.0001,          // Higher priority
      useVanishTrade: true,         // Enable vanish.trade
    },
    tradeLimits: {
      ...DEFAULT_ADJUSTABLE_CONFIG.tradeLimits,
      cooldownSeconds: 90,          // Slower to be less detectable
    },
  } as AdjustableConfig,
};

