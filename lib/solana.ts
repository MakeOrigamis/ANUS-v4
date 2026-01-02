// ═══════════════════════════════════════════════════════════════════════════════
// SOLANA & PUMP.FUN UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

import { 
  PUMPFUN_TOKEN_SUFFIX, 
  PUMPFUN_API_URL, 
  PARRY_TREASURY_ADDRESS,
  PUMPFUN_TOKEN_SUPPLY,
  PROTOCOL_FEE_TOKEN_PERCENT,
  SOLANA_RPC_URL,
  HELIUS_API_URL
} from './constants';
import bs58 from 'bs58';
import { logDebug, logError, logInfo, logWarn } from './logger';
import { 
  Keypair,
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PumpFunTokenData {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  metadata_uri: string;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  bonding_curve: string;
  associated_bonding_curve: string;
  creator: string;
  created_timestamp: number;
  raydium_pool: string | null;
  complete: boolean;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  total_supply: number;
  king_of_the_hill_timestamp: number | null;
  market_cap: number;
  usd_market_cap: number;
  volume24h?: number; // Added from DexScreener
  priceChange24h?: number; // Added from Moralis/DexScreener
  liquidityUsd?: number; // Added from DexScreener
}

export interface WalletBalance {
  sol: number;
  tokens: { mint: string; amount: number; decimals: number }[];
}

export interface TransactionInfo {
  signature: string;
  timestamp: number;
  type: 'deposit' | 'withdrawal' | 'transfer';
  amount: number;
  token?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates if a token address is a valid pump.fun token
 * Must end with "pump"
 */
export function isPumpFunToken(mintAddress: string): boolean {
  if (!mintAddress || mintAddress.length < 32) return false;
  return mintAddress.toLowerCase().endsWith(PUMPFUN_TOKEN_SUFFIX);
}

/**
 * Validates a Solana address format
 */
export function isValidSolanaAddress(address: string): boolean {
  // Base58 characters only, length 32-44
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Validates a Solana private key format
 * Can be base58 string or byte array
 */
export function isValidPrivateKey(privateKey: string): boolean {
  // Base58 private key is typically 87-88 characters
  // Or it could be a JSON array of 64 bytes
  if (!privateKey) return false;
  
  // Check if it's a JSON array
  if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
    try {
      const arr = JSON.parse(privateKey);
      return Array.isArray(arr) && arr.length === 64;
    } catch {
      return false;
    }
  }
  
  // Check if it's a base58 string
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
  return base58Regex.test(privateKey);
}

/**
 * Gets the public address from a private key
 */
export function getPublicKeyFromPrivate(privateKey: string): string | null {
  try {
    let secretKey: Uint8Array;
    
    // Check if it's a JSON array
    if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
      const arr = JSON.parse(privateKey);
      secretKey = new Uint8Array(arr);
    } else {
      // Base58 encoded
      secretKey = bs58.decode(privateKey);
    }
    
    const keypair = Keypair.fromSecretKey(secretKey);
    return keypair.publicKey.toBase58();
  } catch (error) {
    logError('Error deriving public key', error as Error);
    return null;
  }
}

/**
 * Creates a Keypair from a private key string
 */
export function getKeypairFromPrivate(privateKey: string): Keypair | null {
  try {
    let secretKey: Uint8Array;
    
    if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
      const arr = JSON.parse(privateKey);
      secretKey = new Uint8Array(arr);
    } else {
      secretKey = bs58.decode(privateKey);
    }
    
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    logError('Error creating keypair', error as Error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUMP.FUN API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetches token data from Pump.fun API
 * Priority: 1. Moralis (most reliable for price data)  2. DexScreener  3. Pump.fun direct  4. Helius DAS
 */
export async function fetchPumpFunToken(mintAddress: string): Promise<PumpFunTokenData | null> {
  try {
    const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    
    // 1. Try Moralis API FIRST (most reliable for price data and token info)
    const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    if (moralisKey) {
      logDebug('Trying Moralis API', { mint: mintAddress });
      const { fetchPumpFunTokenMoralis } = await import('./moralis');
      const moralisData = await fetchPumpFunTokenMoralis(mintAddress);
      
      if (moralisData && moralisData.name && moralisData.name !== 'Unknown') {
        logDebug('Got data from Moralis', { name: moralisData.name, symbol: moralisData.symbol });
        
        // Get creator from Helius CREATE transaction
        let creator = '';
        if (heliusKey) {
          try {
            const txResponse = await fetch(
              `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${heliusKey}&limit=100`
            );
            if (txResponse.ok) {
              const txData = await txResponse.json();
              const createTx = txData.find((t: any) => t.type === 'CREATE' && t.source === 'PUMP_FUN');
              if (createTx) {
                creator = createTx.feePayer || '';
                logDebug('Found creator from CREATE tx', { creator });
              }
            }
          } catch (e) {
            logDebug('Could not fetch creator from Helius');
          }
        }
        
        return {
          mint: moralisData.mint,
          name: moralisData.name,
          symbol: moralisData.symbol,
          description: moralisData.description,
          image_uri: moralisData.imageUri,
          metadata_uri: moralisData.metadataUri,
          twitter: moralisData.twitter,
          telegram: moralisData.telegram,
          website: moralisData.website,
          bonding_curve: moralisData.bondingCurve,
          associated_bonding_curve: moralisData.associatedBondingCurve,
          creator: creator,
          created_timestamp: moralisData.createdTimestamp,
          raydium_pool: moralisData.raydiumPool,
          complete: moralisData.complete,
          virtual_sol_reserves: moralisData.virtualSolReserves,
          virtual_token_reserves: moralisData.virtualTokenReserves,
          total_supply: moralisData.totalSupply,
          king_of_the_hill_timestamp: moralisData.kingOfTheHillTimestamp,
          market_cap: moralisData.marketCapSol,
          usd_market_cap: moralisData.usdMarketCap,
          volume24h: moralisData.volume24h,
          priceChange24h: moralisData.priceChange24h,
          liquidityUsd: moralisData.liquidityUsd,
        };
      }
    }
    
    // 2. Fallback: Try DexScreener (sometimes returns empty price data)
    logDebug('Trying DexScreener API', { mint: mintAddress });
    try {
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
      
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        const pair = dexData.pairs?.[0];
        
        // Check if pair exists and has required data
        if (pair && pair.baseToken?.name) {
          // Validate that price data exists - DexScreener sometimes returns empty price data
          const priceUsd = parseFloat(pair.priceUsd || '0');
          const marketCap = parseFloat(pair.marketCap || '0');
          
          if (priceUsd === 0 && marketCap === 0) {
            logDebug('DexScreener returned empty price data', { 
              hasPair: !!pair, 
              hasBaseToken: !!pair.baseToken,
              priceUsd: pair.priceUsd,
              marketCap: pair.marketCap 
            });
            // Don't return - fall through to next API
          } else {
            logDebug('Got data from DexScreener', { 
              name: pair.baseToken.name, 
              symbol: pair.baseToken.symbol,
              priceUsd,
              marketCap
            });
            
            // Get creator from Helius
            let creator = '';
            if (heliusKey) {
              try {
                const txResponse = await fetch(
                  `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${heliusKey}&limit=100`
                );
                if (txResponse.ok) {
                  const txData = await txResponse.json();
                  const createTx = txData.find((t: any) => t.type === 'CREATE' && t.source === 'PUMP_FUN');
                  if (createTx) {
                    creator = createTx.feePayer || '';
                    logDebug('Found creator from Helius', { creator });
                  }
                }
              } catch (e) {
                logDebug('Could not fetch creator from Helius');
              }
            }
            
            // Determine bonding status - pumpfun dexId = still bonding
            const isBonded = pair.dexId !== 'pumpfun';
            
            return {
              mint: mintAddress,
              name: pair.baseToken.name,
              symbol: pair.baseToken.symbol,
              description: '',
              image_uri: pair.info?.imageUrl || '',
              metadata_uri: '',
              twitter: pair.info?.socials?.find((s: any) => s.type === 'twitter')?.url || null,
              telegram: pair.info?.socials?.find((s: any) => s.type === 'telegram')?.url || null,
              website: pair.info?.websites?.[0]?.url || null,
              bonding_curve: '',
              associated_bonding_curve: '',
              creator: creator,
              created_timestamp: pair.pairCreatedAt || 0,
              raydium_pool: isBonded ? pair.pairAddress : null,
              complete: isBonded,
              virtual_sol_reserves: 0,
              virtual_token_reserves: 0,
              total_supply: 1_000_000_000,
              king_of_the_hill_timestamp: null,
              market_cap: marketCap,
              usd_market_cap: marketCap,
            };
          }
        } else {
          logDebug('DexScreener returned no valid pair', { 
            hasPairs: !!dexData.pairs, 
            pairsLength: dexData.pairs?.length || 0,
            hasPair: !!pair,
            hasBaseToken: !!pair?.baseToken,
            hasName: !!pair?.baseToken?.name
          });
        }
      } else {
        logDebug('DexScreener API error', { status: dexResponse.status, statusText: dexResponse.statusText });
      }
    } catch (e) {
      logDebug('DexScreener failed', { error: e });
    }
    
    // 3. Try primary pump.fun API (often blocked by Cloudflare, so we skip if disabled)
    // Skip if explicitly disabled via environment variable
    const pumpFunEnabled = process.env.NEXT_PUBLIC_ENABLE_PUMPFUN_API !== 'false';
    
    if (pumpFunEnabled) {
      logDebug('Trying Pump.fun API', { mint: mintAddress });
      try {
        const response = await fetch(`${PUMPFUN_API_URL}/coins/${mintAddress}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://pump.fun/',
            'Origin': 'https://pump.fun',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          cache: 'no-store',
        });
        
        if (response.ok) {
          const data = await response.json();
          logDebug('Got data from Pump.fun API');
          return data as PumpFunTokenData;
        } else {
          // Log detailed error information for 530 and other errors
          const status = response.status;
          const statusText = response.statusText;
          const errorText = await response.text().catch(() => 'Unable to read error response');
          
          if (status === 530) {
            logWarn('Pump.fun API returned 530 (Service Unavailable) - Cloudflare blocking detected', {
              status,
              statusText,
              error: errorText.slice(0, 200),
              note: 'Pump.fun API is often blocked by Cloudflare bot detection. Consider setting NEXT_PUBLIC_ENABLE_PUMPFUN_API=false to skip this API.',
              possibleCauses: [
                'Cloudflare bot detection - automated requests are blocked',
                'Rate limiting - too many requests',
                'Geographic restrictions',
                'Server overload or maintenance',
              ],
            });
          } else {
            logDebug('Pump.fun API error', { status, statusText, error: errorText.slice(0, 200) });
          }
        }
      } catch (e) {
        logDebug('Pump.fun API request failed', { error: e });
      }
    } else {
      logDebug('Pump.fun API disabled via NEXT_PUBLIC_ENABLE_PUMPFUN_API=false');
    }
    
    // 3. Try Helius DAS API (getAsset - better for Token-2022)
    logDebug('Trying Helius DAS', { mint: mintAddress });
    if (heliusKey) {
      // First try getAsset (works better for newer tokens)
      try {
        const assetResponse = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'helius-asset',
            method: 'getAsset',
            params: { id: mintAddress },
          }),
        });
        
        if (assetResponse.ok) {
          const assetData = await assetResponse.json();
          const asset = assetData.result;
          
          if (asset && asset.content?.metadata?.name) {
            logDebug('Got data from Helius getAsset', { name: asset.content.metadata.name });
            
            // Get creator
            let creator = asset.authorities?.find((a: any) => a.scopes?.includes('full'))?.address || '';
            
            // Check bonding status and get price
            let isBonded = false;
            let marketCap = 0;
            
            // Try DexScreener first
            try {
              const dexCheck = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
              if (dexCheck.ok) {
                const dexData = await dexCheck.json();
                const pair = dexData.pairs?.[0];
                if (pair) {
                  isBonded = pair.dexId !== 'pumpfun';
                  marketCap = pair.marketCap || pair.fdv || 0;
                }
              }
            } catch (e) {}
            
            // If no market cap from DexScreener, try Moralis
            if (marketCap === 0) {
              const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
              logDebug('Moralis key available', { hasKey: !!moralisKey, keyLength: moralisKey?.length });
              if (moralisKey) {
                try {
                  const moralisUrl = `https://solana-gateway.moralis.io/token/mainnet/${mintAddress}/price`;
                  logDebug('Fetching Moralis price', { url: moralisUrl });
                  
                  const moralisPrice = await fetch(moralisUrl, {
                    headers: {
                      'Accept': 'application/json',
                      'X-API-Key': moralisKey.trim(), // Trim any whitespace
                    },
                  });
                  
                  logDebug('Moralis response status', { status: moralisPrice.status });
                  
                  if (moralisPrice.ok) {
                    const priceData = await moralisPrice.json();
                    if (priceData.usdPrice) {
                      // Market cap = price * 1B supply
                      marketCap = priceData.usdPrice * 1_000_000_000;
                      logDebug('Got price from Moralis', { price: priceData.usdPrice, marketCap });
                    }
                  } else {
                    const errorText = await moralisPrice.text();
                    logDebug('Moralis error response', { error: errorText.slice(0, 200) });
                  }
                } catch (e) {
                  logDebug('Moralis price fetch error', { error: e });
                }
              }
            }
            
            return {
              mint: mintAddress,
              name: asset.content.metadata.name,
              symbol: asset.content.metadata.symbol || '???',
              description: asset.content.metadata.description || '',
              image_uri: asset.content.files?.[0]?.uri || asset.content.links?.image || '',
              metadata_uri: asset.content.json_uri || '',
              twitter: null,
              telegram: null,
              website: null,
              bonding_curve: '',
              associated_bonding_curve: '',
              creator: creator,
              created_timestamp: 0,
              raydium_pool: isBonded ? 'bonded' : null,
              complete: isBonded,
              virtual_sol_reserves: 0,
              virtual_token_reserves: 0,
              total_supply: 1_000_000_000,
              king_of_the_hill_timestamp: null,
              market_cap: marketCap,
              usd_market_cap: marketCap,
            };
          }
        }
      } catch (e) {
        logDebug('Helius getAsset failed', { error: e });
      }
      
      // Fallback to old token-metadata endpoint
      const heliusResponse = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${heliusKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mintAccounts: [mintAddress] }),
      });
      
      if (heliusResponse.ok) {
        const heliusData = await heliusResponse.json();
        const tokenMeta = heliusData[0];
        
        if (tokenMeta) {
          // Get creator from CREATE transaction (feePayer = creator/deployer)
          let creator = '';
          
          try {
            const txResponse = await fetch(
              `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${heliusKey}&limit=100`
            );
            if (txResponse.ok) {
              const txData = await txResponse.json();
              // Find the CREATE transaction
              const createTx = txData.find((t: any) => t.type === 'CREATE' && t.source === 'PUMP_FUN');
              if (createTx) {
                // The feePayer of the CREATE transaction is the creator/deployer
                creator = createTx.feePayer || '';
                logDebug('Found creator from CREATE tx', { creator });
              }
            }
          } catch (e) {
            logDebug('Could not fetch creator from transactions');
          }
          
          // Check bonding status via DexScreener
          // If dexId is "pumpfun" = NOT bonded, if "raydium/meteora/orca" = BONDED
          let isBonded = false;
          let raydiumPool = null;
          let marketCap = 0;
          try {
            const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
            if (dexResponse.ok) {
              const dexData = await dexResponse.json();
              const pairs = dexData.pairs || [];
              // Check if any pair is on a DEX other than pumpfun
              const bondedPair = pairs.find((p: any) => 
                p.dexId && p.dexId !== 'pumpfun'
              );
              if (bondedPair) {
                isBonded = true;
                raydiumPool = bondedPair.pairAddress;
                marketCap = parseFloat(bondedPair.marketCap) || 0;
                logDebug('Token is BONDED', { dexId: bondedPair.dexId });
              } else if (pairs.length > 0) {
                // Still on pumpfun bonding curve
                isBonded = false;
                marketCap = parseFloat(pairs[0].marketCap) || 0;
                logDebug('Token is still BONDING on pumpfun');
              }
            }
          } catch (e) {
            logDebug('Could not check bonding status');
          }
          
          // Fetch off-chain metadata for image
          let offChainImage = '';
          const metadataUri = tokenMeta.onChainMetadata?.metadata?.uri || tokenMeta.onChainAccountInfo?.accountInfo?.data?.parsed?.info?.uri;
          if (metadataUri) {
            try {
              const offChainResponse = await fetch(metadataUri);
              if (offChainResponse.ok) {
                const offChainData = await offChainResponse.json();
                offChainImage = offChainData.image || '';
              }
            } catch (e) {
              logDebug('Could not fetch off-chain metadata');
            }
          }
          
          logDebug('Got data from Helius DAS', { bonded: isBonded });
          return {
            mint: mintAddress,
            name: tokenMeta.onChainMetadata?.metadata?.name || tokenMeta.legacyMetadata?.name || 'Unknown',
            symbol: tokenMeta.onChainMetadata?.metadata?.symbol || tokenMeta.legacyMetadata?.symbol || '???',
            description: '',
            image_uri: offChainImage || tokenMeta.offChainMetadata?.image || tokenMeta.legacyMetadata?.logoURI || '',
            metadata_uri: metadataUri || '',
            twitter: null,
            telegram: null,
            website: null,
            bonding_curve: '',
            associated_bonding_curve: '',
            creator: creator,
            created_timestamp: 0,
            raydium_pool: raydiumPool,
            complete: isBonded,
            virtual_sol_reserves: 0,
            virtual_token_reserves: 0,
            total_supply: 1_000_000_000,
            king_of_the_hill_timestamp: null,
            market_cap: marketCap,
            usd_market_cap: marketCap,
          };
        }
      }
    }
    
    // 4. Fallback: Try DexScreener API for basic token info
    logDebug('Pump.fun API unavailable, trying DexScreener');
    try {
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
      
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        const pair = dexData.pairs?.[0];
        
        if (pair && pair.baseToken?.name) {
          // Validate that price data exists - DexScreener sometimes returns empty price data
          const priceUsd = parseFloat(pair.priceUsd || '0');
          const marketCap = parseFloat(pair.marketCap || '0');
          
          if (priceUsd === 0 && marketCap === 0) {
            logDebug('DexScreener returned empty price data (fallback)', { 
              hasPair: !!pair, 
              hasBaseToken: !!pair.baseToken,
              priceUsd: pair.priceUsd,
              marketCap: pair.marketCap 
            });
            // Continue to final fallback
          } else {
            // Convert DexScreener data to PumpFunTokenData format
            // If on DEX (Raydium), it's bonded. If on pump.fun DEX only, check URL
            const isBonded = pair.dexId === 'raydium' || pair.url?.includes('raydium');
            logDebug('Got data from DexScreener (fallback)', { 
              name: pair.baseToken?.name, 
              symbol: pair.baseToken?.symbol,
              priceUsd,
              marketCap
            });
            return {
              mint: mintAddress,
              name: pair.baseToken?.name || 'Unknown',
              symbol: pair.baseToken?.symbol || '???',
              description: '',
              image_uri: pair.info?.imageUrl || '',
              metadata_uri: '',
              twitter: null,
              telegram: null,
              website: null,
              bonding_curve: '',
              associated_bonding_curve: '',
              creator: '', // DexScreener doesn't provide creator
              created_timestamp: 0,
              raydium_pool: isBonded ? pair.pairAddress : null,
              complete: isBonded,
              virtual_sol_reserves: 0,
              virtual_token_reserves: 0,
              total_supply: 1_000_000_000,
              king_of_the_hill_timestamp: null,
              market_cap: marketCap,
              usd_market_cap: marketCap,
            };
          }
        }
      }
    } catch (e) {
      logDebug('DexScreener fallback failed', { error: e });
    }
    
    // Final fallback: Return minimal valid data so user can proceed
    // Set complete to false since we can't verify
    logDebug('All APIs unavailable, using minimal token data');
    return {
      mint: mintAddress,
      name: 'Token',
      symbol: 'TOKEN',
      description: 'Token data unavailable - API rate limited',
      image_uri: '',
      metadata_uri: '',
      twitter: null,
      telegram: null,
      website: null,
      bonding_curve: '',
      associated_bonding_curve: '',
      creator: '', // Unknown
      created_timestamp: Date.now(),
      raydium_pool: null,
      complete: false, // Can't verify, assume not bonded
      virtual_sol_reserves: 0,
      virtual_token_reserves: 0,
      total_supply: 1_000_000_000,
      king_of_the_hill_timestamp: null,
      market_cap: 0,
      usd_market_cap: 0,
    };
    
  } catch (error) {
    logError('Error fetching token data', error as Error);
    // Return minimal data on error so user can still proceed
    return {
      mint: mintAddress,
      name: 'Token',
      symbol: 'TOKEN',
      description: 'Unable to fetch token data',
      image_uri: '',
      metadata_uri: '',
      twitter: null,
      telegram: null,
      website: null,
      bonding_curve: '',
      associated_bonding_curve: '',
      creator: '', // Unknown
      created_timestamp: Date.now(),
      raydium_pool: null,
      complete: false, // Can't verify, assume not bonded
      virtual_sol_reserves: 0,
      virtual_token_reserves: 0,
      total_supply: 1_000_000_000,
      king_of_the_hill_timestamp: null,
      market_cap: 0,
      usd_market_cap: 0,
    };
  }
}

/**
 * Fetches creator rewards info from Pump.fun
 */
export async function fetchCreatorRewards(creatorAddress: string): Promise<{
  totalRewards: number;
  claimableRewards: number;
  claimedRewards: number;
} | null> {
  try {
    // Note: This endpoint may need adjustment based on pump.fun's actual API
    const response = await fetch(`${PUMPFUN_API_URL}/creators/${creatorAddress}/rewards`);
    
    if (!response.ok) {
      // Return mock data for now if API doesn't exist
      return {
        totalRewards: 0,
        claimableRewards: 0,
        claimedRewards: 0
      };
    }
    
    return await response.json();
  } catch (error) {
    logError('Error fetching creator rewards', error as Error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOLANA RPC
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetches SOL balance for an address using Helius RPC
 */
export async function getSOLBalance(address: string): Promise<number> {
  try {
    // Build the RPC URL with the API key
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;
    
    logDebug('Fetching SOL balance', { address, rpcUrl: rpcUrl.substring(0, 50) + '...' });
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address]
      })
    });
    
    const data = await response.json();
    logDebug('RPC Response', { data });
    
    if (data.result?.value !== undefined) {
      // Convert lamports to SOL
      return data.result.value / 1e9;
    }
    return 0;
  } catch (error) {
    logError('Error fetching SOL balance', error as Error);
    return 0;
  }
}

/**
 * Fetches token accounts for an address using Helius RPC
 */
export async function getTokenAccounts(address: string): Promise<{ mint: string; amount: number }[]> {
  try {
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;
    
    logDebug('Fetching token accounts', { address });
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          address,
          { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { encoding: 'jsonParsed' }
        ]
      })
    });
    
    const data = await response.json();
    logDebug('Token accounts response', { data });
    
    if (data.result?.value && data.result.value.length > 0) {
      return data.result.value.map((account: any) => ({
        mint: account.account.data.parsed.info.mint,
        amount: account.account.data.parsed.info.tokenAmount.uiAmount || 0
      }));
    }
    
    // Fallback: Try Helius DAS API for token balances
    logDebug('Standard RPC returned no tokens, trying Helius DAS API');
    const dasResponse = await fetch(`https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`);
    
    if (dasResponse.ok) {
      const dasData = await dasResponse.json();
      logDebug('Helius DAS response', { dasData });
      
      if (dasData.tokens && dasData.tokens.length > 0) {
        return dasData.tokens.map((token: any) => ({
          mint: token.mint,
          amount: token.amount / Math.pow(10, token.decimals || 6)
        }));
      }
    }
    
    return [];
  } catch (error) {
    logError('Error fetching token accounts', error as Error);
    return [];
  }
}

/**
 * Get balance of a specific token for an address
 */
export async function getTokenBalance(address: string, tokenMint: string): Promise<number> {
  try {
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;
    
    // Query specifically for this token mint
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          address,
          { mint: tokenMint }, // Filter by specific mint
          { encoding: 'jsonParsed' }
        ]
      })
    });
    
    const data = await response.json();
    logDebug('Specific token query response', { data });
    
    if (data.result?.value?.[0]) {
      const tokenAmount = data.result.value[0].account.data.parsed.info.tokenAmount;
      return tokenAmount.uiAmount || 0;
    }
    
    // Fallback: Try Helius balances API
    const dasResponse = await fetch(`https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`);
    
    if (dasResponse.ok) {
      const dasData = await dasResponse.json();
      const token = dasData.tokens?.find((t: any) => t.mint === tokenMint);
      if (token) {
        return token.amount / Math.pow(10, token.decimals || 6);
      }
    }
    
    return 0;
  } catch (error) {
    logError('Error fetching token balance', error as Error);
    return 0;
  }
}

/**
 * Get the number of holders for a token
 * Prioritizes Moralis API (most accurate), then falls back to Helius RPC
 */
export async function getTokenHolderCount(tokenMint: string): Promise<number> {
  try {
    // 1. Try Moralis API first (most accurate holder count)
    const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    if (moralisKey) {
      try {
        const { getTokenHoldersMoralis } = await import('./moralis');
        const moralisCount = await getTokenHoldersMoralis(tokenMint);
        if (moralisCount > 0) {
          logDebug('Got holder count from Moralis', { count: moralisCount, mint: tokenMint.slice(0, 20) + '...' });
          return moralisCount;
        }
      } catch (error) {
        logDebug('Moralis holder count failed, trying fallback', { error });
      }
    }

    // 2. Fallback: Use Helius RPC to get all token accounts (accurate but slower)
    const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!heliusKey) {
      logDebug('No Helius API key for holder count');
      return 0;
    }

    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    
    // Use getProgramAccounts to get ALL token accounts (not just top 20)
    const accountsResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'all-holders',
        method: 'getProgramAccounts',
        params: [
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          {
            encoding: 'jsonParsed',
            filters: [
              { dataSize: 165 }, // Token account size
              { 
                memcmp: { 
                  offset: 0, 
                  bytes: tokenMint 
                } 
              }
            ]
          }
        ]
      })
    });

    if (accountsResponse.ok) {
      const accountsData = await accountsResponse.json();
      if (accountsData.result && Array.isArray(accountsData.result)) {
        // Filter for accounts with balance > 0
        const activeHolders = accountsData.result.filter((acc: any) => {
          const amount = acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
          return amount > 0;
        });
        logDebug('Total token holders from Helius', { count: activeHolders.length, mint: tokenMint.slice(0, 20) + '...' });
        return activeHolders.length;
      }
    }

    // 3. Last resort: Use getTokenLargestAccounts (only returns top 20, but better than 0)
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'holder-count',
        method: 'getTokenLargestAccounts',
        params: [tokenMint]
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result?.value) {
        // This returns top 20 largest holders (not accurate, but better than 0)
        const holders = data.result.value.filter((h: any) => 
          parseFloat(h.uiAmountString || '0') > 0
        );
        logDebug('Token holders (top 20 only - not accurate)', { count: holders.length, mint: tokenMint.slice(0, 20) + '...' });
        return holders.length;
      }
    }

    return 0;
  } catch (error) {
    logError('Error fetching holder count', error as Error);
    return 0;
  }
}

/**
 * Checks if PARRY treasury received the required deposits from a project
 */
export async function verifyProtocolDeposits(
  tokenMint: string
): Promise<{
  solReceived: boolean;
  solAmount: number;
  tokenReceived: boolean;
  tokenAmount: number;
  requiredTokenAmount: number;
}> {
  try {
    logDebug('Verifying deposits', { tokenMint, treasury: PARRY_TREASURY_ADDRESS });
    
    // Get specific token balance (more reliable than searching all tokens)
    const tokenAmount = await getTokenBalance(PARRY_TREASURY_ADDRESS, tokenMint);
    const requiredTokenAmount = (PUMPFUN_TOKEN_SUPPLY * PROTOCOL_FEE_TOKEN_PERCENT) / 100; // 1% = 10,000,000 tokens
    logDebug('Deposit verification', { tokenBalance: tokenAmount, required: requiredTokenAmount });
    
    return {
      solReceived: true, // No longer required
      solAmount: 0,
      tokenReceived: tokenAmount >= requiredTokenAmount,
      tokenAmount,
      requiredTokenAmount
    };
  } catch (error) {
    logError('Error verifying protocol deposits', error as Error);
    return {
      solReceived: true, // No longer required
      solAmount: 0,
      tokenReceived: false,
      tokenAmount: 0,
      requiredTokenAmount: (PUMPFUN_TOKEN_SUPPLY * PROTOCOL_FEE_TOKEN_PERCENT) / 100
    };
  }
}

/**
 * Formats a token amount with proper decimals
 */
export function formatTokenAmount(amount: number, decimals: number = 6): string {
  if (amount >= 1_000_000_000) {
    return (amount / 1_000_000_000).toFixed(2) + 'B';
  }
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(2) + 'M';
  }
  if (amount >= 1_000) {
    return (amount / 1_000).toFixed(2) + 'K';
  }
  return amount.toFixed(decimals);
}

/**
 * Shortens a Solana address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECT SOLANA TRADING - NO PUMPPORTAL NEEDED
// ═══════════════════════════════════════════════════════════════════════════════

// Pump.fun Program IDs
const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_FUN_GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
const PUMP_FUN_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');

// PumpSwap (Pump.fun's AMM after bonding) - for post-bonding trades
const PUMP_SWAP_PROGRAM_ID = new PublicKey('pswapkJHPPNFbmxgHtXiDewfiYdhyWDC7VJvLtmW7Cq');

// Jupiter Aggregator (alternative for post-bonding)
const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';

export interface TradeResult {
  success: boolean;
  signature?: string;
  error?: string;
  amountIn?: number;
  amountOut?: number;
}

export interface ClaimResult {
  success: boolean;
  signature?: string;
  error?: string;
  amountClaimed?: number;
  pool?: 'bonding_curve' | 'pumpswap';
}

/**
 * Get a Solana connection using Helius RPC
 */
export function getConnection(): Connection {
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Claim creator fees from Pump.fun
 * Works for both bonding curve (pre-bonding) and PumpSwap (post-bonding)
 */
export async function claimCreatorFees(
  privateKey: string,
  tokenMint: string,
  isBonded: boolean = false
): Promise<ClaimResult> {
  try {
    const keypair = getKeypairFromPrivate(privateKey);
    if (!keypair) {
      return { success: false, error: 'Invalid private key' };
    }

    const connection = getConnection();
    const mintPubkey = new PublicKey(tokenMint);
    const creatorPubkey = keypair.publicKey;

    logInfo('Claiming fees', { tokenMint, creator: creatorPubkey.toBase58(), bonded: isBonded });

    if (isBonded) {
      // Post-bonding: Claim from PumpSwap AMM
      return await claimFromPumpSwap(connection, keypair, mintPubkey);
    } else {
      // Pre-bonding: Claim from Pump.fun bonding curve
      return await claimFromBondingCurve(connection, keypair, mintPubkey);
    }
  } catch (error) {
    logError('Error claiming creator fees', error as Error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Claim fees from Pump.fun bonding curve (pre-bonding)
 * Note: Pump.fun creator fees are claimed via their API, not direct instruction
 */
async function claimFromBondingCurve(
  connection: Connection,
  keypair: Keypair,
  mintPubkey: PublicKey
): Promise<ClaimResult> {
  try {
    const creatorAddress = keypair.publicKey.toBase58();
    const mintAddress = mintPubkey.toBase58();
    
    logInfo('Attempting to claim creator fees via Pump.fun API', { creator: creatorAddress, token: mintAddress });

    // Method 1: Try Pump.fun's claim endpoint
    // Pump.fun uses a signed message approach for claiming
    const timestamp = Date.now();
    const signedMessage = bs58.encode(keypair.secretKey.slice(0, 64));
    
    try {
      const claimResponse = await fetch('https://frontend-api.pump.fun/creator-rewards/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          mint: mintAddress,
          creator: creatorAddress,
          timestamp,
          signature: signedMessage,
        }),
      });

      if (claimResponse.ok) {
        const result = await claimResponse.json();
        logDebug('[Claim] API response', { result });
        if (result.success || result.txSignature) {
          return {
            success: true,
            signature: result.txSignature || result.signature,
            amountClaimed: result.amount || 0,
          };
        }
      }
    } catch (apiError) {
      logDebug('[Claim] API method failed, trying direct transaction');
    }

    // Method 2: Try direct on-chain claim
    // Use the correct Pump.fun withdraw instruction discriminator
    // withdraw = Anchor discriminator sha256("global:withdraw")[0:8]
    const discriminator = Buffer.from([0xb7, 0x12, 0x46, 0x9c, 0x94, 0x6d, 0xa1, 0x22]);

    // Derive bonding curve PDA
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mintPubkey.toBuffer()],
      PUMP_FUN_PROGRAM_ID
    );

    // Derive creator fee account PDA
    const [creatorFeeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('creator-fee'), mintPubkey.toBuffer(), keypair.publicKey.toBuffer()],
      PUMP_FUN_PROGRAM_ID
    );

    const associatedBondingCurve = await getAssociatedTokenAddress(
      mintPubkey,
      bondingCurve,
      true
    );

    // Check if there are fees to claim
    const feeAccountInfo = await connection.getAccountInfo(creatorFeeAccount);
    if (!feeAccountInfo) {
      return {
        success: false,
        error: 'No creator fees available to claim. Fees accumulate as people trade your token.',
      };
    }

    const instruction = new TransactionInstruction({
      programId: PUMP_FUN_PROGRAM_ID,
      keys: [
        { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: creatorFeeAccount, isSigner: false, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: discriminator,
    });

    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 100000,
    });

    const transaction = new Transaction()
      .add(priorityFeeIx)
      .add(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;

    // Sign and send
    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      { commitment: 'confirmed' }
    );

    logInfo('Claimed from bonding curve', { signature: txSignature });
    return {
      success: true,
      signature: txSignature,
      pool: 'bonding_curve',
    };
  } catch (error) {
    logError('Error claiming from bonding curve', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to claim from bonding curve',
      pool: 'bonding_curve',
    };
  }
}

/**
 * Claim fees from PumpSwap (post-bonding)
 */
async function claimFromPumpSwap(
  connection: Connection,
  keypair: Keypair,
  mintPubkey: PublicKey
): Promise<ClaimResult> {
  try {
    // For PumpSwap, we need to find the pool and claim LP fees
    // This is more complex as it involves the AMM
    
    // Derive pool address
    const [poolAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), mintPubkey.toBuffer()],
      PUMP_SWAP_PROGRAM_ID
    );

    // Build claim instruction for PumpSwap
    // Discriminator for "collect_creator_fee"
    const discriminator = Buffer.from([167, 138, 78, 149, 223, 194, 6, 126]);

    const instruction = new TransactionInstruction({
      programId: PUMP_SWAP_PROGRAM_ID,
      keys: [
        { pubkey: poolAddress, isSigner: false, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator,
    });

    // Add priority fee
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 50000,
    });

    const transaction = new Transaction()
      .add(priorityFeeIx)
      .add(instruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      { commitment: 'confirmed' }
    );

    logInfo('Claimed from PumpSwap', { signature });
    return {
      success: true,
      signature,
      pool: 'pumpswap',
    };
  } catch (error) {
    logError('Error claiming from PumpSwap', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to claim from PumpSwap',
      pool: 'pumpswap',
    };
  }
}

/**
 * Buy tokens on Pump.fun bonding curve (pre-bonding)
 */
export async function buyOnBondingCurve(
  privateKey: string,
  tokenMint: string,
  solAmount: number,
  slippageBps: number = 500 // 5% default slippage
): Promise<TradeResult> {
  try {
    const keypair = getKeypairFromPrivate(privateKey);
    if (!keypair) {
      return { success: false, error: 'Invalid private key' };
    }

    const connection = getConnection();
    const mintPubkey = new PublicKey(tokenMint);
    const buyerPubkey = keypair.publicKey;

    // Derive bonding curve PDA
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mintPubkey.toBuffer()],
      PUMP_FUN_PROGRAM_ID
    );

    const associatedBondingCurve = await getAssociatedTokenAddress(
      mintPubkey,
      bondingCurve,
      true
    );

    // Get or create buyer's token account
    const buyerTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      buyerPubkey
    );

    // Check if token account exists
    let createAtaIx: TransactionInstruction | null = null;
    try {
      await getAccount(connection, buyerTokenAccount);
    } catch {
      // Account doesn't exist, need to create it
      createAtaIx = createAssociatedTokenAccountInstruction(
        buyerPubkey,
        buyerTokenAccount,
        buyerPubkey,
        mintPubkey
      );
    }

    // Build buy instruction
    const discriminator = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]); // buy instruction
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    const maxSolCost = Math.floor(lamports * (1 + slippageBps / 10000));

    const data = Buffer.alloc(24);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(0), 8); // tokenAmount (0 = use SOL amount)
    data.writeBigUInt64LE(BigInt(maxSolCost), 16); // maxSolCost

    const buyInstruction = new TransactionInstruction({
      programId: PUMP_FUN_PROGRAM_ID,
      keys: [
        { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: buyerPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });

    // Build transaction
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 100000, // Higher priority for buys
    });

    const transaction = new Transaction().add(priorityFeeIx);
    if (createAtaIx) transaction.add(createAtaIx);
    transaction.add(buyInstruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = buyerPubkey;

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      { commitment: 'confirmed' }
    );

    logInfo('Buy successful', { signature });
    return {
      success: true,
      signature,
      amountIn: solAmount,
    };
  } catch (error) {
    logError('Error buying on bonding curve', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to buy tokens',
    };
  }
}

/**
 * Sell tokens on Pump.fun bonding curve (pre-bonding)
 */
export async function sellOnBondingCurve(
  privateKey: string,
  tokenMint: string,
  tokenAmount: number,
  slippageBps: number = 500
): Promise<TradeResult> {
  try {
    const keypair = getKeypairFromPrivate(privateKey);
    if (!keypair) {
      return { success: false, error: 'Invalid private key' };
    }

    const connection = getConnection();
    const mintPubkey = new PublicKey(tokenMint);
    const sellerPubkey = keypair.publicKey;

    // Derive bonding curve PDA
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mintPubkey.toBuffer()],
      PUMP_FUN_PROGRAM_ID
    );

    const associatedBondingCurve = await getAssociatedTokenAddress(
      mintPubkey,
      bondingCurve,
      true
    );

    const sellerTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      sellerPubkey
    );

    // Build sell instruction
    const discriminator = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]); // sell instruction
    const tokenAmountRaw = BigInt(Math.floor(tokenAmount * 1e6)); // 6 decimals for pump.fun tokens
    const minSolOutput = BigInt(0); // Will be calculated based on slippage

    const data = Buffer.alloc(24);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(tokenAmountRaw, 8);
    data.writeBigUInt64LE(minSolOutput, 16);

    const sellInstruction = new TransactionInstruction({
      programId: PUMP_FUN_PROGRAM_ID,
      keys: [
        { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: sellerPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });

    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 100000,
    });

    const transaction = new Transaction()
      .add(priorityFeeIx)
      .add(sellInstruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = sellerPubkey;

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      { commitment: 'confirmed' }
    );

    logInfo('Sell successful', { signature });
    return {
      success: true,
      signature,
      amountIn: tokenAmount,
    };
  } catch (error) {
    logError('Error selling on bonding curve', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sell tokens',
    };
  }
}

/**
 * Buy/Sell tokens using Jupiter (post-bonding, any DEX)
 * More reliable for bonded tokens as it aggregates all liquidity
 */
export async function swapWithJupiter(
  privateKey: string,
  inputMint: string, // SOL mint or token mint
  outputMint: string, // Token mint or SOL mint
  amount: number, // In input token's smallest unit
  slippageBps: number = 500
): Promise<TradeResult> {
  try {
    const keypair = getKeypairFromPrivate(privateKey);
    if (!keypair) {
      return { success: false, error: 'Invalid private key' };
    }

    const connection = getConnection();
    const userPubkey = keypair.publicKey;

    // SOL mint address
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const actualInputMint = inputMint === 'SOL' ? SOL_MINT : inputMint;
    const actualOutputMint = outputMint === 'SOL' ? SOL_MINT : outputMint;

    // Get quote from Jupiter
    const quoteResponse = await fetch(
      `${JUPITER_API_URL}/quote?inputMint=${actualInputMint}&outputMint=${actualOutputMint}&amount=${amount}&slippageBps=${slippageBps}`
    );

    if (!quoteResponse.ok) {
      const error = await quoteResponse.text();
      return { success: false, error: `Jupiter quote failed: ${error}` };
    }

    const quoteData = await quoteResponse.json();

    // Get swap transaction
    const swapResponse = await fetch(`${JUPITER_API_URL}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: userPubkey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 50000,
      }),
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      return { success: false, error: `Jupiter swap failed: ${error}` };
    }

    const { swapTransaction } = await swapResponse.json();

    // Deserialize and sign
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = Transaction.from(swapTransactionBuf);
    transaction.sign(keypair);

    // Send transaction
    const rawTransaction = transaction.serialize();
    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 3,
    });

    // Confirm
    await connection.confirmTransaction(signature, 'confirmed');

    logInfo('Jupiter swap successful', { signature });
    return {
      success: true,
      signature,
      amountIn: amount,
      amountOut: parseInt(quoteData.outAmount),
    };
  } catch (error) {
    logError('Error with Jupiter swap', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to swap',
    };
  }
}

/**
 * Smart trade function - automatically chooses the right method
 * Uses bonding curve for pre-bonding, Jupiter for post-bonding
 */
export async function smartBuy(
  privateKey: string,
  tokenMint: string,
  solAmount: number,
  isBonded: boolean
): Promise<TradeResult> {
  if (isBonded) {
    // Use Jupiter for bonded tokens (more liquidity)
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    return swapWithJupiter(privateKey, SOL_MINT, tokenMint, lamports);
  } else {
    // Use bonding curve for pre-bonding
    return buyOnBondingCurve(privateKey, tokenMint, solAmount);
  }
}

export async function smartSell(
  privateKey: string,
  tokenMint: string,
  tokenAmount: number,
  isBonded: boolean
): Promise<TradeResult> {
  if (isBonded) {
    // Use Jupiter for bonded tokens
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const rawAmount = Math.floor(tokenAmount * 1e6); // 6 decimals
    return swapWithJupiter(privateKey, tokenMint, SOL_MINT, rawAmount);
  } else {
    // Use bonding curve for pre-bonding
    return sellOnBondingCurve(privateKey, tokenMint, tokenAmount);
  }
}

