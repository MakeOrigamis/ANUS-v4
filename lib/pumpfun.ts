// ═══════════════════════════════════════════════════════════════════════════════
// PUMP.FUN INTEGRATION - Auto-Claim & Trading
// ═══════════════════════════════════════════════════════════════════════════════
// 
// IMPORTANT: Pump.fun has TWO different fee claiming mechanisms:
// 
// 1. BEFORE BONDING COMPLETE (on pump.fun curve):
//    - Token is still on pump.fun bonding curve
//    - Use pump.fun program to claim creator fees
//    - Fees accumulate from trades on the curve
// 
// 2. AFTER BONDING COMPLETE (migrated to Raydium):
//    - Bonding curve hit 100% and migrated to Raydium
//    - Creator fees are in a different account
//    - Need to claim via different method
// 
// ═══════════════════════════════════════════════════════════════════════════════

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { logInfo, logError, logDebug, logWarn } from './logger';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS - PUMP.FUN (Before Migration)
// ═══════════════════════════════════════════════════════════════════════════════

export const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const PUMPFUN_GLOBAL_CONFIG = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
export const PUMPFUN_FEE_PROGRAM = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
export const PUMPFUN_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS - PUMPSWAP (After Migration)
// ═══════════════════════════════════════════════════════════════════════════════

// PumpSwap is pump.fun's own DEX that tokens migrate to after bonding
export const PUMPSWAP_PROGRAM = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'); // PumpSwap AMM
export const PUMPSWAP_FEE_ACCOUNT = new PublicKey('62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV'); // Fee collector

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS - GENERAL
// ═══════════════════════════════════════════════════════════════════════════════

export const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const TOKEN_2022_PROGRAM = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
export const SYSTEM_PROGRAM = new PublicKey('11111111111111111111111111111111');
export const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Instruction discriminators
export const CLAIM_BEFORE_MIGRATION_DISCRIMINATOR = Buffer.from([0x36, 0x13, 0x7d, 0x35, 0x45, 0x59, 0x64, 0xa5]);
export const CLAIM_AFTER_MIGRATION_DISCRIMINATOR = Buffer.from([0x57, 0x49, 0x54, 0x48, 0x44, 0x52, 0x41, 0x57]); // Placeholder

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type BondingState = 'active' | 'completed' | 'migrated_pumpswap';

export interface PumpFunTokenInfo {
  mint: PublicKey;
  bondingCurve: PublicKey;
  creator: PublicKey;
  creatorTokenAccount: PublicKey;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  complete: boolean;
  bondingState: BondingState;
  pumpswapPool?: PublicKey;  // PumpSwap pool after migration
  marketCap: number;
}

export interface ClaimResult {
  success: boolean;
  signature?: string;
  solClaimed?: number;
  tokensClaimed?: number;
  method: 'pumpfun' | 'pumpswap';
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the bonding curve PDA for a token mint
 */
export function getBondingCurvePDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PUMPFUN_PROGRAM_ID
  );
  return pda;
}

/**
 * Get the associated token account for a wallet (Token-2022)
 */
export function getAssociatedTokenAddress2022(mint: PublicKey, owner: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM
  );
  return ata;
}

/**
 * Get the associated token account for a wallet (Standard SPL)
 */
export function getAssociatedTokenAddressSPL(mint: PublicKey, owner: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM
  );
  return ata;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BONDING STATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if token has completed bonding and migrated to PumpSwap
 */
export async function getBondingState(
  connection: Connection,
  tokenMint: PublicKey,
): Promise<{ state: BondingState; pumpswapPool?: PublicKey; complete: boolean }> {
  try {
    const bondingCurve = getBondingCurvePDA(tokenMint);
    const accountInfo = await connection.getAccountInfo(bondingCurve);
    
    if (!accountInfo) {
      // Bonding curve doesn't exist - might be migrated to PumpSwap
      const pumpswapPool = await findPumpSwapPool(connection, tokenMint);
      
      if (pumpswapPool) {
        return { state: 'migrated_pumpswap', pumpswapPool, complete: true };
      }
      
      return { state: 'migrated_pumpswap', complete: true };
    }
    
    // Parse bonding curve data to check if complete
    // Bonding curve account layout (approximate):
    // - discriminator: 8 bytes
    // - virtual_sol_reserves: 8 bytes (u64)
    // - virtual_token_reserves: 8 bytes (u64)
    // - real_sol_reserves: 8 bytes (u64)
    // - real_token_reserves: 8 bytes (u64)
    // - token_total_supply: 8 bytes (u64)
    // - complete: 1 byte (bool) - at offset 48
    
    const data = accountInfo.data;
    
    // Check if complete flag is set (this offset may need adjustment)
    const completeOffset = 48;
    const isComplete = data.length > completeOffset && data[completeOffset] === 1;
    
    if (isComplete) {
      // Check for PumpSwap pool
      const pumpswapPool = await findPumpSwapPool(connection, tokenMint);
      return { 
        state: pumpswapPool ? 'migrated_pumpswap' : 'completed', 
        pumpswapPool, 
        complete: true 
      };
    }
    
    return { state: 'active', complete: false };
    
  } catch (error) {
    logError('Error checking bonding state', error as Error);
    return { state: 'active', complete: false };
  }
}

/**
 * Find PumpSwap pool for a token (after bonding completion)
 */
async function findPumpSwapPool(
  connection: Connection,
  tokenMint: PublicKey,
): Promise<PublicKey | undefined> {
  try {
    // Check pump.fun API for pool info
    const response = await fetch(`https://frontend-api.pump.fun/coins/${tokenMint.toBase58()}`);
    if (!response.ok) return undefined;
    
    const data = await response.json();
    
    // After migration, pump.fun stores the PumpSwap pool address
    if (data.pool_address) {
      return new PublicKey(data.pool_address);
    }
    
    // Legacy field name (some tokens might still have raydium_pool field)
    if (data.raydium_pool) {
      return new PublicKey(data.raydium_pool);
    }
    
    // Try to derive PumpSwap pool PDA
    // PumpSwap pools are typically PDAs of the PumpSwap program
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), tokenMint.toBuffer()],
      PUMPSWAP_PROGRAM
    );
    
    // Check if pool exists
    const poolInfo = await connection.getAccountInfo(poolPda);
    if (poolInfo) {
      return poolPda;
    }
    
    return undefined;
  } catch (error) {
    logError('Error finding PumpSwap pool', error as Error);
    return undefined;
  }
}

/**
 * Get token info from pump.fun API
 */
export async function getTokenInfo(tokenMint: string): Promise<PumpFunTokenInfo | null> {
  try {
    const response = await fetch(`https://frontend-api.pump.fun/coins/${tokenMint}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    const mint = new PublicKey(tokenMint);
    const bondingCurve = getBondingCurvePDA(mint);
    
    // Determine bonding state
    let bondingState: BondingState = 'active';
    let pumpswapPool: PublicKey | undefined;
    
    if (data.complete) {
      // Check for PumpSwap pool (or legacy raydium_pool field)
      const poolAddress = data.pool_address || data.raydium_pool;
      if (poolAddress) {
        bondingState = 'migrated_pumpswap';
        pumpswapPool = new PublicKey(poolAddress);
      } else {
        bondingState = 'completed';
      }
    }
    
    return {
      mint,
      bondingCurve,
      creator: new PublicKey(data.creator),
      creatorTokenAccount: getAssociatedTokenAddress2022(mint, new PublicKey(data.creator)),
      virtualSolReserves: data.virtual_sol_reserves || 0,
      virtualTokenReserves: data.virtual_token_reserves || 0,
      complete: data.complete || false,
      bondingState,
      pumpswapPool,
      marketCap: data.usd_market_cap || 0,
    };
  } catch (error) {
    logError('Error fetching token info', error as Error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLAIM CREATOR FEES - UNIFIED
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Claim creator fees - automatically detects if bonding is complete
 * and uses the appropriate method
 */
export async function claimCreatorFees(
  connection: Connection,
  wallet: Keypair,
  tokenMint: PublicKey,
): Promise<ClaimResult> {
  try {
    logDebug('Checking bonding state', { tokenMint: tokenMint.toBase58() });
    
    // Check if bonding is complete
    const { state, pumpswapPool } = await getBondingState(connection, tokenMint);
    
    logDebug('Bonding state', { state });
    
    if (state === 'migrated_pumpswap' && pumpswapPool) {
      // Token migrated to PumpSwap - use PumpSwap claim method
      logInfo('Token migrated to PumpSwap, using PumpSwap claim');
      return await claimAfterMigration(connection, wallet, tokenMint, pumpswapPool);
    } else {
      // Token still on pump.fun curve - use pump.fun claim method
      logInfo('Token on pump.fun curve, using pump.fun claim');
      return await claimBeforeMigration(connection, wallet, tokenMint);
    }
    
  } catch (error) {
    logError('Claim failed', error as Error);
    return {
      success: false,
      method: 'pumpfun',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLAIM BEFORE MIGRATION (Pump.fun Bonding Curve)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build pump.fun claim instruction (before migration)
 */
async function buildPumpFunClaimInstruction(
  userWallet: PublicKey,
  tokenMint: PublicKey,
): Promise<TransactionInstruction> {
  const bondingCurve = getBondingCurvePDA(tokenMint);
  const userTokenAccount = getAssociatedTokenAddress2022(tokenMint, userWallet);
  const creatorTokenAccount = getAssociatedTokenAddress2022(tokenMint, bondingCurve);

  const keys = [
    { pubkey: PUMPFUN_GLOBAL_CONFIG, isSigner: false, isWritable: false },
    { pubkey: tokenMint, isSigner: false, isWritable: true },
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userWallet, isSigner: true, isWritable: true },
    { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: PUMPFUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
    { pubkey: PUMPFUN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: PUMPFUN_FEE_PROGRAM, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: PUMPFUN_PROGRAM_ID,
    data: CLAIM_BEFORE_MIGRATION_DISCRIMINATOR,
  });
}

/**
 * Claim fees while token is on pump.fun bonding curve
 */
async function claimBeforeMigration(
  connection: Connection,
  wallet: Keypair,
  tokenMint: PublicKey,
): Promise<ClaimResult> {
  try {
    const instruction = await buildPumpFunClaimInstruction(wallet.publicKey, tokenMint);
    const transaction = new Transaction().add(instruction);
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    logInfo('Sending pump.fun claim transaction');
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );

    logInfo('Pump.fun claim successful', { signature });
    
    return {
      success: true,
      signature,
      method: 'pumpfun',
    };
  } catch (error) {
    return {
      success: false,
      method: 'pumpfun',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLAIM AFTER MIGRATION (PumpSwap)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build PumpSwap claim instruction (after migration)
 * 
 * After pump.fun bonding completes and token migrates to PumpSwap:
 * - Creator fees are stored in a fee vault
 * - Need to interact with pump.fun fee program
 */
async function buildPumpSwapClaimInstruction(
  connection: Connection,
  userWallet: PublicKey,
  tokenMint: PublicKey,
  pumpswapPool: PublicKey,
): Promise<TransactionInstruction> {
  // After migration to PumpSwap, creator fees are in fee vault
  const userTokenAccount = getAssociatedTokenAddressSPL(tokenMint, userWallet);
  
  // Fee vault PDA
  const [feeVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('fee-vault'), tokenMint.toBuffer()],
    PUMPFUN_FEE_PROGRAM
  );
  
  // Creator vault PDA (where creator fees accumulate)
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('creator-vault'), tokenMint.toBuffer(), userWallet.toBuffer()],
    PUMPFUN_FEE_PROGRAM
  );

  const keys = [
    { pubkey: PUMPFUN_GLOBAL_CONFIG, isSigner: false, isWritable: false },
    { pubkey: tokenMint, isSigner: false, isWritable: false },
    { pubkey: pumpswapPool, isSigner: false, isWritable: false },
    { pubkey: feeVault, isSigner: false, isWritable: true },
    { pubkey: creatorVault, isSigner: false, isWritable: true },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userWallet, isSigner: true, isWritable: true },
    { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: PUMPSWAP_PROGRAM, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: PUMPFUN_FEE_PROGRAM,
    data: CLAIM_AFTER_MIGRATION_DISCRIMINATOR,
  });
}

/**
 * Claim fees after token migrated to PumpSwap
 */
async function claimAfterMigration(
  connection: Connection,
  wallet: Keypair,
  tokenMint: PublicKey,
  pumpswapPool: PublicKey,
): Promise<ClaimResult> {
  try {
    const instruction = await buildPumpSwapClaimInstruction(
      connection, 
      wallet.publicKey, 
      tokenMint, 
      pumpswapPool
    );
    
    const transaction = new Transaction().add(instruction);
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    logInfo('Sending PumpSwap claim transaction');
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { commitment: 'confirmed' }
    );

    logInfo('PumpSwap claim successful', { signature });
    
    return {
      success: true,
      signature,
      method: 'pumpswap',
    };
  } catch (error) {
    return {
      success: false,
      method: 'pumpswap',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK CLAIMABLE REWARDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check claimable creator fees for a token
 */
export async function getClaimableRewards(
  connection: Connection,
  tokenMint: PublicKey,
  creatorWallet: PublicKey,
): Promise<{ sol: number; tokens: number; state: BondingState }> {
  try {
    const { state } = await getBondingState(connection, tokenMint);
    const bondingCurve = getBondingCurvePDA(tokenMint);
    
    // Fetch bonding curve account data
    const accountInfo = await connection.getAccountInfo(bondingCurve);
    
    if (!accountInfo) {
      // Token might be migrated - check fee vault
      const [feeVault] = PublicKey.findProgramAddressSync(
        [Buffer.from('fee-vault'), tokenMint.toBuffer()],
        PUMPFUN_FEE_PROGRAM
      );
      
      const feeVaultInfo = await connection.getAccountInfo(feeVault);
      if (feeVaultInfo) {
        // Parse fee vault for claimable amounts
        // TODO: Parse actual fee vault structure
      }
      
      return { sol: 0, tokens: 0, state };
    }

    // Parse the bonding curve account data for creator fees
    // Account layout needs to be verified, but typically:
    // - Creator fee accumulator is stored in the bonding curve
    // - Or in a separate creator fee account
    
    // For now, return estimated based on account lamports
    const accountLamports = accountInfo.lamports;
    const estimatedFees = accountLamports / 1e9 * 0.01; // Rough estimate
    
    return { sol: estimatedFees, tokens: 0, state };
  } catch (error) {
    logError('Error fetching claimable rewards', error as Error);
    return { sol: 0, tokens: 0, state: 'active' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUY/SELL ON PUMP.FUN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Buy tokens on pump.fun bonding curve
 */
export async function buyTokens(
  connection: Connection,
  wallet: Keypair,
  tokenMint: PublicKey,
  solAmount: number,
  slippageBps: number = 500, // 5% default slippage
): Promise<{ success: boolean; signature?: string; tokensReceived?: number; error?: string }> {
  // TODO: Implement buy instruction
  // This will require decoding a buy transaction to get the instruction format
  return { success: false, error: 'Not implemented yet' };
}

/**
 * Sell tokens on pump.fun bonding curve
 */
export async function sellTokens(
  connection: Connection,
  wallet: Keypair,
  tokenMint: PublicKey,
  tokenAmount: number,
  slippageBps: number = 500,
): Promise<{ success: boolean; signature?: string; solReceived?: number; error?: string }> {
  // TODO: Implement sell instruction
  return { success: false, error: 'Not implemented yet' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-CLAIM SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════════

export interface AutoClaimConfig {
  intervalMinutes: number;
  minClaimThreshold: number;  // Min SOL to trigger claim
  onClaim?: (result: ClaimResult) => void;
  onError?: (error: string) => void;
}

/**
 * Set up auto-claim for a wallet
 * Automatically detects bonding state and uses appropriate method
 */
export function setupAutoClaim(
  connection: Connection,
  wallet: Keypair,
  tokenMints: PublicKey[],
  config: AutoClaimConfig = { intervalMinutes: 60, minClaimThreshold: 0.01 },
): { stop: () => void; getStats: () => AutoClaimStats } {
  const stats: AutoClaimStats = {
    totalClaimed: 0,
    claimCount: 0,
    lastClaim: 0,
    errors: [],
    tokenStates: new Map(),
  };

  logInfo('Auto-claim started', { tokenCount: tokenMints.length, intervalMinutes: config.intervalMinutes });
  
  const claim = async () => {
    logDebug('Running auto-claim cycle');
    
    for (const mint of tokenMints) {
      try {
        // Check claimable amount
        const claimable = await getClaimableRewards(connection, mint, wallet.publicKey);
        
        // Update token state tracking
        stats.tokenStates.set(mint.toBase58(), claimable.state);
        
        logDebug('Token claimable', { mint: mint.toBase58().slice(0, 8), state: claimable.state, sol: claimable.sol.toFixed(4) });
        
        if (claimable.sol >= config.minClaimThreshold) {
          logInfo('Claiming SOL', { amount: claimable.sol.toFixed(4) });
          
          const result = await claimCreatorFees(connection, wallet, mint);
          
          if (result.success) {
            stats.totalClaimed += claimable.sol;
            stats.claimCount++;
            stats.lastClaim = Date.now();
            logInfo('Claimed successfully', { method: result.method, signature: result.signature?.slice(0, 20) });
            config.onClaim?.(result);
          } else {
            stats.errors.push(`${mint.toBase58().slice(0, 8)}: ${result.error}`);
            logError('Claim failed', new Error(result.error || 'Unknown error'));
            config.onError?.(result.error || 'Unknown error');
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`${mint.toBase58().slice(0, 8)}: ${errorMsg}`);
        logError(`Error for token`, new Error(errorMsg), { mint: mint.toBase58().slice(0, 8) });
      }
    }
    
    logInfo('Cycle complete', { totalClaimed: stats.totalClaimed.toFixed(4) });
  };

  // Run immediately
  claim();
  
  // Then run on interval
  const intervalId = setInterval(claim, config.intervalMinutes * 60 * 1000);
  
  return {
    stop: () => {
      clearInterval(intervalId);
      logInfo('Auto-claim stopped');
    },
    getStats: () => ({ ...stats }),
  };
}

export interface AutoClaimStats {
  totalClaimed: number;
  claimCount: number;
  lastClaim: number;
  errors: string[];
  tokenStates: Map<string, BondingState>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANUAL CLAIM HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Manually claim fees with detailed logging
 */
export async function manualClaim(
  rpcUrl: string,
  privateKey: string,
  tokenMint: string,
): Promise<ClaimResult> {
  const connection = new Connection(rpcUrl, 'confirmed');
  
  // Parse private key
  let wallet: Keypair;
  try {
    if (privateKey.startsWith('[')) {
      wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKey)));
    } else {
      wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
    }
  } catch (error) {
    return {
      success: false,
      method: 'pumpfun',
      error: 'Invalid private key format',
    };
  }
  
  logInfo('Manual claim started', { token: tokenMint, wallet: wallet.publicKey.toBase58() });
  
  const mint = new PublicKey(tokenMint);
  
  // Check state first
  const { state, pumpswapPool } = await getBondingState(connection, mint);
  logDebug('Bonding state', { state });
  if (pumpswapPool) {
    logDebug('PumpSwap pool', { pool: pumpswapPool.toBase58() });
  }
  
  // Check claimable
  const claimable = await getClaimableRewards(connection, mint, wallet.publicKey);
  logInfo('Estimated claimable', { sol: claimable.sol.toFixed(4) });
  
  if (claimable.sol < 0.001) {
    logWarn('Very low claimable amount, proceeding anyway');
  }
  
  // Execute claim
  const result = await claimCreatorFees(connection, wallet, mint);
  
  if (result.success) {
    logInfo('SUCCESS', { method: result.method, signature: result.signature });
  } else {
    logError('FAILED', new Error(result.error || 'Unknown error'));
  }
  
  return result;
}

