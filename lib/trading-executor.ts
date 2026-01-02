// ═══════════════════════════════════════════════════════════════════════════════
// PARRY TRADING EXECUTOR - Execute trades on Pump.fun
// ═══════════════════════════════════════════════════════════════════════════════

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { SOLANA_RPC_URL, PUMPFUN_PROGRAM_ID } from './constants';
import { TradeSignal, PriceCandle } from './trading-strategy';
import { logInfo, logError, logDebug } from './logger';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PUMP_FUN_PROGRAM = new PublicKey(PUMPFUN_PROGRAM_ID);
const PUMP_FUN_GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
const PUMP_FUN_FEE = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJtNJgp8FAnG');

// Instruction discriminators (from reverse engineering)
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TradeResult {
  success: boolean;
  signature?: string;
  error?: string;
  action: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: number;
}

export interface Position {
  tokenMint: string;
  tokens: number;
  avgPrice: number;
  solBalance: number;
  lastUpdate: number;
}

export interface TradingSession {
  tokenMint: string;
  wallet: Keypair;
  position: Position;
  trades: TradeResult[];
  isRunning: boolean;
  startTime: number;
  config: TradingConfig;
}

export interface TradingConfig {
  maxSlippage: number;       // Max slippage % (e.g., 5 = 5%)
  minTradeSize: number;      // Min trade in SOL
  maxTradeSize: number;      // Max trade in SOL
  cooldownMs: number;        // Time between trades
  dryRun: boolean;           // If true, simulate only
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get bonding curve PDA for a token
 */
export async function getBondingCurvePDA(tokenMint: PublicKey): Promise<PublicKey> {
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), tokenMint.toBuffer()],
    PUMP_FUN_PROGRAM
  );
  return bondingCurve;
}

/**
 * Get associated bonding curve (token account for the curve)
 */
export async function getAssociatedBondingCurve(
  bondingCurve: PublicKey,
  tokenMint: PublicKey
): Promise<PublicKey> {
  return getAssociatedTokenAddress(tokenMint, bondingCurve, true);
}

/**
 * Calculate tokens out for SOL in (bonding curve math)
 */
export function calculateBuyAmount(
  solIn: number,
  virtualSolReserves: number,
  virtualTokenReserves: number
): number {
  // Pump.fun uses constant product formula: x * y = k
  // With fees deducted from input
  const fee = solIn * 0.01; // 1% fee
  const solInAfterFee = solIn - fee;
  
  const newSolReserves = virtualSolReserves + solInAfterFee;
  const newTokenReserves = (virtualSolReserves * virtualTokenReserves) / newSolReserves;
  const tokensOut = virtualTokenReserves - newTokenReserves;
  
  return tokensOut;
}

/**
 * Calculate SOL out for tokens in (bonding curve math)
 */
export function calculateSellAmount(
  tokensIn: number,
  virtualSolReserves: number,
  virtualTokenReserves: number
): number {
  const newTokenReserves = virtualTokenReserves + tokensIn;
  const newSolReserves = (virtualSolReserves * virtualTokenReserves) / newTokenReserves;
  const solOut = virtualSolReserves - newSolReserves;
  
  // Apply fee
  const fee = solOut * 0.01;
  return solOut - fee;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a buy on Pump.fun
 */
export async function executeBuy(
  wallet: Keypair,
  tokenMint: PublicKey,
  solAmount: number,
  maxSlippage: number = 5,
  dryRun: boolean = false
): Promise<TradeResult> {
  const timestamp = Date.now();
  
  try {
    logInfo('[TRADE] Buying', { solAmount, tokenMint: tokenMint.toBase58() });
    
    if (dryRun) {
      logDebug('[DRY RUN] Simulating buy');
      return {
        success: true,
        signature: 'DRY_RUN_' + Date.now(),
        action: 'buy',
        amount: solAmount,
        price: 0,
        timestamp,
      };
    }
    
    // Get bonding curve accounts
    const bondingCurve = await getBondingCurvePDA(tokenMint);
    const associatedBondingCurve = await getAssociatedBondingCurve(bondingCurve, tokenMint);
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
    
    // Calculate minimum tokens out (with slippage)
    // In production, fetch current reserves and calculate properly
    const solAmountLamports = Math.floor(solAmount * 1e9);
    const minTokensOut = 0; // Set proper slippage in production
    
    // Build instruction data
    const data = Buffer.alloc(24);
    BUY_DISCRIMINATOR.copy(data, 0);
    data.writeBigUInt64LE(BigInt(solAmountLamports), 8);
    data.writeBigUInt64LE(BigInt(minTokensOut), 16);
    
    // Create instruction
    const instruction = new TransactionInstruction({
      programId: PUMP_FUN_PROGRAM,
      keys: [
        { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_FEE, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // System program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
        { pubkey: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), isSigner: false, isWritable: false }, // Associated token program
      ],
      data,
    });
    
    // Check if user token account exists, if not add create instruction
    const tokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
    const instructions: TransactionInstruction[] = [];
    
    if (!tokenAccountInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userTokenAccount,
          wallet.publicKey,
          tokenMint
        )
      );
    }
    
    instructions.push(instruction);
    
    // Build and send transaction
    const transaction = new Transaction().add(...instructions);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    const signature = await connection.sendTransaction(transaction, [wallet]);
    logInfo('[TRADE] Buy transaction sent', { signature });
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    logInfo('[TRADE] Buy confirmed');
    
    return {
      success: true,
      signature,
      action: 'buy',
      amount: solAmount,
      price: 0, // Would need to calculate from result
      timestamp,
    };
    
  } catch (error) {
    logError('[TRADE] Buy failed', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'buy',
      amount: solAmount,
      price: 0,
      timestamp,
    };
  }
}

/**
 * Execute a sell on Pump.fun
 */
export async function executeSell(
  wallet: Keypair,
  tokenMint: PublicKey,
  tokenAmount: number,
  maxSlippage: number = 5,
  dryRun: boolean = false
): Promise<TradeResult> {
  const timestamp = Date.now();
  
  try {
    logInfo('[TRADE] Selling', { tokenAmount, tokenMint: tokenMint.toBase58() });
    
    if (dryRun) {
      logDebug('[DRY RUN] Simulating sell');
      return {
        success: true,
        signature: 'DRY_RUN_' + Date.now(),
        action: 'sell',
        amount: tokenAmount,
        price: 0,
        timestamp,
      };
    }
    
    // Get bonding curve accounts
    const bondingCurve = await getBondingCurvePDA(tokenMint);
    const associatedBondingCurve = await getAssociatedBondingCurve(bondingCurve, tokenMint);
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);
    
    // Token amount in smallest units (assuming 6 decimals for pump.fun tokens)
    const tokenAmountUnits = Math.floor(tokenAmount * 1e6);
    const minSolOut = 0; // Set proper slippage in production
    
    // Build instruction data
    const data = Buffer.alloc(24);
    SELL_DISCRIMINATOR.copy(data, 0);
    data.writeBigUInt64LE(BigInt(tokenAmountUnits), 8);
    data.writeBigUInt64LE(BigInt(minSolOut), 16);
    
    // Create instruction
    const instruction = new TransactionInstruction({
      programId: PUMP_FUN_PROGRAM,
      keys: [
        { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_FEE, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
        { pubkey: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
    
    // Build and send transaction
    const transaction = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    const signature = await connection.sendTransaction(transaction, [wallet]);
    logInfo('[TRADE] Sell transaction sent', { signature });
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    logInfo('[TRADE] Sell confirmed');
    
    return {
      success: true,
      signature,
      action: 'sell',
      amount: tokenAmount,
      price: 0,
      timestamp,
    };
    
  } catch (error) {
    logError('[TRADE] Sell failed', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'sell',
      amount: tokenAmount,
      price: 0,
      timestamp,
    };
  }
}

/**
 * Execute a trade signal
 */
export async function executeSignal(
  signal: TradeSignal,
  wallet: Keypair,
  tokenMint: PublicKey,
  config: TradingConfig
): Promise<TradeResult | null> {
  if (signal.action === 'hold') {
    logDebug('[TRADE] Signal: HOLD - no action');
    return null;
  }
  
  // Check confidence threshold
  if (signal.confidence < 60) {
    logDebug('[TRADE] Confidence too low, skipping', { confidence: signal.confidence });
    return null;
  }
  
  // Apply limits
  const amount = Math.min(
    Math.max(signal.amount, config.minTradeSize),
    config.maxTradeSize
  );
  
  if (signal.action === 'buy') {
    return executeBuy(wallet, tokenMint, amount, config.maxSlippage, config.dryRun);
  } else {
    return executeSell(wallet, tokenMint, amount, config.maxSlippage, config.dryRun);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POSITION TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current position for a wallet
 */
export async function getPosition(
  wallet: PublicKey,
  tokenMint: PublicKey
): Promise<Position> {
  try {
    // Get SOL balance
    const solBalance = await connection.getBalance(wallet);
    
    // Get token balance
    const tokenAccount = await getAssociatedTokenAddress(tokenMint, wallet);
    let tokens = 0;
    
    try {
      const tokenAccountInfo = await connection.getTokenAccountBalance(tokenAccount);
      tokens = tokenAccountInfo.value.uiAmount || 0;
    } catch {
      // Token account doesn't exist
    }
    
    return {
      tokenMint: tokenMint.toBase58(),
      tokens,
      avgPrice: 0, // Would need to track from trades
      solBalance: solBalance / 1e9,
      lastUpdate: Date.now(),
    };
  } catch (error) {
    logError('Error getting position', error as Error);
    return {
      tokenMint: tokenMint.toBase58(),
      tokens: 0,
      avgPrice: 0,
      solBalance: 0,
      lastUpdate: Date.now(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load wallet from private key
 */
export function loadWallet(privateKey: string): Keypair {
  try {
    // Handle both base58 and JSON array formats
    if (privateKey.startsWith('[')) {
      const secret = Uint8Array.from(JSON.parse(privateKey));
      return Keypair.fromSecretKey(secret);
    } else {
      const secret = bs58.decode(privateKey);
      return Keypair.fromSecretKey(secret);
    }
  } catch (error) {
    throw new Error('Invalid private key format');
  }
}

/**
 * Check if market is open (pump.fun is 24/7)
 */
export function isMarketOpen(): boolean {
  return true; // Crypto never sleeps
}

