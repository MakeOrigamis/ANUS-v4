// ═══════════════════════════════════════════════════════════════════════════════
// TRADE AMOUNT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

import { DEFAULT_ADJUSTABLE_CONFIG, type AdjustableConfig } from './parry-config';
import { logError } from './logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WalletBalance {
  sol: number;
  tokens: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface TradeValidationOptions {
  action: 'buy' | 'sell';
  amount: number;
  walletBalance: WalletBalance;
  config?: Partial<AdjustableConfig>;
  tokenPrice?: number; // Token price in SOL (for sell validation)
  estimatedFees?: number; // Estimated transaction fees in SOL
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates trade amount against config limits and wallet balance
 */
export async function validateTradeAmount(
  options: TradeValidationOptions
): Promise<ValidationResult> {
  const {
    action,
    amount,
    walletBalance,
    config,
    tokenPrice = 0,
    estimatedFees = 0.002, // Default: ~0.001 SOL base + 0.001 priority
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Merge config with defaults
  const fullConfig: AdjustableConfig = {
    ...DEFAULT_ADJUSTABLE_CONFIG,
    ...config,
    tradeLimits: {
      ...DEFAULT_ADJUSTABLE_CONFIG.tradeLimits,
      ...config?.tradeLimits,
    },
  };

  const { maxBuyPerTrade, maxSellPerTrade, minTradeSize } = fullConfig.tradeLimits;

  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC VALIDATION: Amount must be positive number
  // ═══════════════════════════════════════════════════════════════════════════

  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return {
      valid: false,
      error: 'Amount must be a valid number',
    };
  }

  if (amount <= 0) {
    return {
      valid: false,
      error: 'Amount must be greater than 0',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUY VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  if (action === 'buy') {
    // Check minimum trade size
    if (amount < minTradeSize) {
      errors.push(
        `Amount must be at least ${minTradeSize} SOL (minimum trade size)`
      );
    }

    // Check maximum buy limit
    if (amount > maxBuyPerTrade) {
      errors.push(
        `Amount exceeds maximum buy limit of ${maxBuyPerTrade} SOL per trade`
      );
    }

    // Check SOL balance (amount + fees)
    const totalRequired = amount + estimatedFees;
    if (walletBalance.sol < totalRequired) {
      errors.push(
        `Insufficient SOL balance. Required: ${totalRequired.toFixed(4)} SOL (${amount.toFixed(4)} SOL + ${estimatedFees.toFixed(4)} SOL fees), Available: ${walletBalance.sol.toFixed(4)} SOL`
      );
    }

    // Warning if balance is low after trade
    const remainingBalance = walletBalance.sol - totalRequired;
    if (remainingBalance < 0.01) {
      warnings.push(
        'Low SOL balance after trade. Consider keeping some SOL for fees.'
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELL VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  if (action === 'sell') {
    // For sell, amount is in tokens, but we need to validate against SOL limits
    // Convert token amount to SOL value if token price is available
    const solValue = tokenPrice > 0 ? amount * tokenPrice : 0;

    // Check minimum trade size (in SOL value)
    if (tokenPrice > 0 && solValue < minTradeSize) {
      errors.push(
        `Trade value must be at least ${minTradeSize} SOL. Current: ${solValue.toFixed(4)} SOL (${amount} tokens × ${tokenPrice.toFixed(8)} SOL)`
      );
    }

    // If we don't have token price, use a conservative estimate
    // Assume minimum trade size in tokens (rough estimate: 0.05 SOL worth)
    if (tokenPrice === 0) {
      const estimatedMinTokens = minTradeSize / 0.0001; // Rough estimate
      if (amount < estimatedMinTokens) {
        warnings.push(
          `Token price unknown. Trade might be below minimum size. Amount: ${amount} tokens`
        );
      }
    }

    // Check maximum sell limit (in SOL value)
    if (tokenPrice > 0 && solValue > maxSellPerTrade) {
      errors.push(
        `Trade value exceeds maximum sell limit of ${maxSellPerTrade} SOL per trade. Current: ${solValue.toFixed(4)} SOL (${amount} tokens × ${tokenPrice.toFixed(8)} SOL)`
      );
    }

    // Check token balance
    if (walletBalance.tokens < amount) {
      errors.push(
        `Insufficient token balance. Required: ${amount} tokens, Available: ${walletBalance.tokens.toFixed(2)} tokens`
      );
    }

    // Check SOL balance for fees
    if (walletBalance.sol < estimatedFees) {
      errors.push(
        `Insufficient SOL for transaction fees. Required: ${estimatedFees.toFixed(4)} SOL, Available: ${walletBalance.sol.toFixed(4)} SOL`
      );
    }

    // Warning if selling all tokens
    if (walletBalance.tokens > 0 && amount >= walletBalance.tokens * 0.99) {
      warnings.push(
        'Selling nearly all tokens. Consider keeping some for future trades.'
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN RESULT
  // ═══════════════════════════════════════════════════════════════════════════

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join('; '),
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Get wallet balance for validation
// ═══════════════════════════════════════════════════════════════════════════════

export interface WalletBalanceOptions {
  walletAddress: string;
  tokenMint: string;
}

/**
 * Fetches wallet balance (SOL and tokens) for validation
 */
export async function getWalletBalanceForValidation(
  options: WalletBalanceOptions
): Promise<WalletBalance> {
  const { getSOLBalance, getTokenBalance } = await import('./solana');
  const { walletAddress, tokenMint } = options;

  try {
    const [solBalance, tokenBalance] = await Promise.all([
      getSOLBalance(walletAddress),
      getTokenBalance(walletAddress, tokenMint),
    ]);

    return {
      sol: solBalance,
      tokens: tokenBalance,
    };
  } catch (error) {
    logError('Error fetching wallet balance', error as Error);
    // Return zeros if fetch fails - validation will catch insufficient balance
    return {
      sol: 0,
      tokens: 0,
    };
  }
}
