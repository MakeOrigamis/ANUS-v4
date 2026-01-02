// ═══════════════════════════════════════════════════════════════════════════════
// MORALIS SOLANA API - Pump.fun Data Integration
// https://docs.moralis.com/web3-data-api/solana/tutorials/pump-fun-api-faq
// ═══════════════════════════════════════════════════════════════════════════════

import { logDebug, logError, logInfo } from './logger';

const MORALIS_API_URL = 'https://solana-gateway.moralis.io';

interface MoralisPumpFunToken {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  metadataUri: string;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  creator: string;
  createdTimestamp: number;
  bondingCurve: string;
  associatedBondingCurve: string;
  complete: boolean; // true = bonded/graduated
  virtualSolReserves: number;
  virtualTokenReserves: number;
  totalSupply: number;
  marketCapSol: number;
  usdMarketCap: number;
  kingOfTheHillTimestamp: number | null;
  raydiumPool: string | null;
  priceUsd: number;
  priceNative: number;
  volume24h?: number; // Added from DexScreener
  priceChange24h?: number; // Added from Moralis/DexScreener
  liquidityUsd?: number; // Added from DexScreener
}

interface MoralisTokenMetadata {
  mint: string;
  standard: string;
  name: string;
  symbol: string;
  logo?: string | null;
  metaplex?: {
    metadataUri: string;
    masterEdition: boolean;
    isMutable: boolean;
    primarySaleHappened: number;
    sellerFeeBasisPoints: number;
    updateAuthority?: string;
  };
  fullyDilutedValue?: string;
  totalSupply?: string;
  totalSupplyFormatted?: string;
}

interface MoralisTokenPrice {
  tokenAddress: string;
  pairAddress: string;
  exchangeName: string;
  exchangeAddress: string;
  usdPrice: number;
  usdPrice24hrPercentChange: number;
  logo: string;
  name: string;
  symbol: string;
  nativePrice?: {
    value: string;
    symbol: string;
    name: string;
    decimals: number;
  };
}

interface MoralisPair {
  exchangeAddress: string;
  exchangeName: string;
  pairAddress: string;
  pairLabel: string;
  usdPrice: number;
  liquidityUsd: number;
  volume24hrUsd: number;
  inactivePair: boolean;
}

/**
 * Get Moralis API key from environment
 */
function getMoralisApiKey(): string | null {
  let key = process.env.NEXT_PUBLIC_MORALIS_API_KEY || null;
  if (key) {
    // Remove any quotes or whitespace that might have been added
    key = key.trim().replace(/^["']|["']$/g, '');
    logDebug('[Moralis] API key found', { keyLength: key.length });
  }
  return key;
}

/**
 * Fetch Pump.fun token data from Moralis with full details
 */
export async function fetchPumpFunTokenMoralis(mintAddress: string): Promise<MoralisPumpFunToken | null> {
  const apiKey = getMoralisApiKey();
  
  if (!apiKey) {
    logDebug('[Moralis] API key not set in environment');
    return null;
  }
  
  try {
    // Fetch both Moralis and DexScreener in parallel
    const url = `${MORALIS_API_URL}/token/mainnet/${mintAddress}/price`;
    logDebug('[Moralis] Fetching', { url });
    
    const [priceResponse, dexResponse] = await Promise.allSettled([
      fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
      }),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`)
    ]);
    
    // Process Moralis response
    let priceData: any = null;
    if (priceResponse.status === 'fulfilled' && priceResponse.value.ok) {
      priceData = await priceResponse.value.json();
      
      // Log full JSON response for debugging
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[Moralis] FULL PRICE RESPONSE JSON:');
      console.log(JSON.stringify(priceData, null, 2));
      console.log('═══════════════════════════════════════════════════════════════');
      
      logInfo('[Moralis] Full price response', { 
        fullResponse: JSON.stringify(priceData, null, 2),
        parsed: priceData 
      });
    } else {
      const errorText = priceResponse.status === 'fulfilled' 
        ? await priceResponse.value.text().catch(() => 'Unknown error')
        : priceResponse.reason?.message || 'Request failed';
      logError('[Moralis] Price fetch failed', new Error(`HTTP ${priceResponse.status === 'fulfilled' ? priceResponse.value.status : 'N/A'}: ${errorText.slice(0, 100)}`));
    }
    
    // Process DexScreener response
    let dexData: any = null;
    if (dexResponse.status === 'fulfilled' && dexResponse.value.ok) {
      dexData = await dexResponse.value.json();
      
      // Log full JSON response for debugging
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[DexScreener] FULL RESPONSE JSON:');
      console.log(JSON.stringify(dexData, null, 2));
      console.log('═══════════════════════════════════════════════════════════════');
      
      logInfo('[DexScreener] Full response', { 
        fullResponse: JSON.stringify(dexData, null, 2),
        parsed: dexData 
      });
    } else {
      logDebug('[DexScreener] Fetch failed', { 
        error: dexResponse.status === 'rejected' ? dexResponse.reason : 'Request failed' 
      });
    }
    
    // If Moralis failed, return null
    if (!priceData) {
      return null;
    }
    
    logDebug('Moralis price data', { name: priceData.name, symbol: priceData.symbol, price: priceData.usdPrice });
    
    // Create metadata from price response (it includes name/symbol/logo)
    const metadata: MoralisTokenMetadata = {
      mint: mintAddress,
      standard: 'token-2022',
      name: priceData.name || 'Unknown',
      symbol: priceData.symbol || '???',
      logo: priceData.logo || null,
      metaplex: {
        metadataUri: '',
        masterEdition: false,
        isMutable: true,
        primarySaleHappened: 0,
        sellerFeeBasisPoints: 0,
      },
      fullyDilutedValue: '0',
      totalSupply: '1000000000000000', // 1B with 6 decimals
      totalSupplyFormatted: '1000000000',
    };
    // Extract price data from the response we already have
    let priceUsd = priceData.usdPrice || 0;
    let priceNative = parseFloat(priceData.nativePrice?.value || '0');
    let liquidityUsd = 0;
    let volume24h = 0;
    let priceChange24h = priceData.usdPrice24hrPercentChange || 0;
    
    // Extract additional data from DexScreener if available
    const dexPair = dexData?.pairs?.[0];
    if (dexPair) {
      // Use DexScreener volume if available (more accurate)
      if (dexPair.volume24h) {
        volume24h = parseFloat(dexPair.volume24h) || 0;
        logDebug('Using DexScreener volume', { volume24h });
      }
      
      // Use DexScreener price change if Moralis doesn't have it
      if (!priceChange24h && dexPair.priceChange24h) {
        priceChange24h = parseFloat(dexPair.priceChange24h) || 0;
        logDebug('Using DexScreener 24h change', { priceChange24h });
      }
      
      // Use DexScreener liquidity if available
      if (dexPair.liquidity?.usd) {
        liquidityUsd = parseFloat(dexPair.liquidity.usd) || 0;
        logDebug('Using DexScreener liquidity', { liquidityUsd });
      }
      
      // Use DexScreener market cap if available and Moralis doesn't have accurate one
      if (dexPair.marketCap) {
        const dexMarketCap = parseFloat(dexPair.marketCap) || 0;
        logDebug('DexScreener market cap', { dexMarketCap });
      }
    }
    
    // Determine bonding status from exchange name (prioritize DexScreener if available)
    let isBonded = false;
    let bondingCurveAddress = priceData.pairAddress || '';
    let pumpSwapAddress = '';
    
    if (dexPair) {
      // DexScreener is more reliable for bonding status
      isBonded = dexPair.dexId !== 'pumpfun';
      if (isBonded) {
        pumpSwapAddress = dexPair.pairAddress || '';
        bondingCurveAddress = dexPair.pairAddress || '';
      }
      logDebug('Bonding status from DexScreener', { isBonded, dexId: dexPair.dexId });
    } else {
      // Fallback to Moralis exchange name
      const exchangeName = priceData.exchangeName || '';
      if (exchangeName === 'Pump.Fun') {
        isBonded = false;
        logDebug('Token is BONDING on Pump.Fun');
      } else if (exchangeName) {
        isBonded = true;
        pumpSwapAddress = priceData.pairAddress || '';
        logDebug('Token is BONDED', { exchange: exchangeName });
      }
    }
    
    // Parse native price correctly (it's already a decimal string)
    priceNative = parseFloat(priceData.nativePrice?.value || '0');
    
    // Fetch off-chain metadata for description, image, socials
    let offChainData: any = null;
    if (metadata.metaplex?.metadataUri) {
      try {
        const offChainResponse = await fetch(metadata.metaplex.metadataUri);
        if (offChainResponse.ok) {
          offChainData = await offChainResponse.json();
        }
      } catch (e) {
        logDebug('Off-chain metadata not available');
      }
    }
    
    // Calculate market cap (use DexScreener if available, otherwise calculate)
    const totalSupply = parseFloat(metadata.totalSupplyFormatted || '1000000000');
    let usdMarketCap = priceUsd * totalSupply;
    
    // Prefer DexScreener market cap if available (more accurate)
    if (dexPair?.marketCap) {
      const dexMarketCap = parseFloat(dexPair.marketCap) || 0;
      if (dexMarketCap > 0) {
        usdMarketCap = dexMarketCap;
        logDebug('Using DexScreener market cap', { usdMarketCap });
      }
    }
    
    return {
      mint: mintAddress,
      name: metadata.name || offChainData?.name || dexPair?.baseToken?.name || 'Unknown',
      symbol: metadata.symbol || offChainData?.symbol || dexPair?.baseToken?.symbol || '???',
      description: offChainData?.description || '',
      imageUri: metadata.logo || offChainData?.image || dexPair?.info?.imageUrl || '',
      metadataUri: metadata.metaplex?.metadataUri || '',
      twitter: offChainData?.twitter || dexPair?.info?.socials?.find((s: any) => s.type === 'twitter')?.url || null,
      telegram: offChainData?.telegram || dexPair?.info?.socials?.find((s: any) => s.type === 'telegram')?.url || null,
      website: offChainData?.website || dexPair?.info?.websites?.[0]?.url || null,
      creator: '', // Will be fetched from Helius CREATE transaction
      createdTimestamp: dexPair?.pairCreatedAt || 0,
      bondingCurve: bondingCurveAddress,
      associatedBondingCurve: '',
      complete: isBonded,
      virtualSolReserves: liquidityUsd / 2, // Approximate
      virtualTokenReserves: 0,
      totalSupply: totalSupply,
      marketCapSol: 0,
      usdMarketCap: usdMarketCap,
      kingOfTheHillTimestamp: null,
      raydiumPool: pumpSwapAddress || null,
      priceUsd: priceUsd,
      priceNative: priceNative,
      volume24h: volume24h,
      priceChange24h: priceChange24h,
      liquidityUsd: liquidityUsd,
    };
    
  } catch (error) {
    logError('Moralis API error', error as Error);
    return null;
  }
}

/**
 * Get SOL balance using Moralis
 */
export async function getSOLBalanceMoralis(address: string): Promise<number> {
  const apiKey = getMoralisApiKey();
  
  if (!apiKey) {
    return 0;
  }
  
  try {
    const response = await fetch(
      `${MORALIS_API_URL}/account/mainnet/${address}/balance`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return parseFloat(data.solana) || 0;
    }
    
    return 0;
  } catch (error) {
    logError('Moralis balance error', error as Error);
    return 0;
  }
}

/**
 * Get SPL token balances using Moralis
 */
export async function getTokenBalancesMoralis(address: string): Promise<{ mint: string; amount: number }[]> {
  const apiKey = getMoralisApiKey();
  
  if (!apiKey) {
    return [];
  }
  
  try {
    const response = await fetch(
      `${MORALIS_API_URL}/account/mainnet/${address}/tokens`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.map((token: any) => ({
        mint: token.mint,
        amount: parseFloat(token.amount) / Math.pow(10, token.decimals || 6),
      }));
    }
    
    return [];
  } catch (error) {
    logError('Moralis tokens error', error as Error);
    return [];
  }
}

/**
 * Get specific token balance using Moralis
 */
export async function getTokenBalanceMoralis(address: string, tokenMint: string): Promise<number> {
  const tokens = await getTokenBalancesMoralis(address);
  const token = tokens.find(t => t.mint === tokenMint);
  return token?.amount || 0;
}

/**
 * Get token price from Moralis
 */
export async function getTokenPriceMoralis(mintAddress: string): Promise<{ usd: number; sol: number } | null> {
  const apiKey = getMoralisApiKey();
  
  if (!apiKey) {
    return null;
  }
  
  try {
    const response = await fetch(
      `${MORALIS_API_URL}/token/mainnet/${mintAddress}/price`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey,
        },
      }
    );
    
    if (response.ok) {
      const data: MoralisTokenPrice = await response.json();
      return {
        usd: data.usdPrice || 0,
        sol: parseFloat(data.nativePrice?.value || '0') / 1e9,
      };
    }
    
    return null;
  } catch (error) {
    logError('Moralis price error', error as Error);
    return null;
  }
}

/**
 * Get token holders from Moralis (useful for analytics)
 */
export interface HolderDistribution {
  whales: number;
  sharks: number;
  dolphins: number;
  fish: number;
  octopus: number;
  crabs: number;
  shrimps: number;
}

export interface MoralisHoldersData {
  totalHolders: number;
  holderDistribution?: HolderDistribution;
}

/**
 * Get token holders with distribution from Moralis
 */
export async function getTokenHoldersDataMoralis(mintAddress: string): Promise<MoralisHoldersData | null> {
  const apiKey = getMoralisApiKey();
  
  if (!apiKey) {
    return null;
  }
  
  try {
    // Use the correct Moralis endpoint: /token/mainnet/holders/{mintAddress}
    const url = `${MORALIS_API_URL}/token/mainnet/holders/${mintAddress}`;
    logDebug('[Moralis] Fetching holders data', { url });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-Key': apiKey,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Log full JSON response for debugging
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[Moralis] FULL HOLDERS RESPONSE JSON:');
      console.log(JSON.stringify(data, null, 2));
      console.log('═══════════════════════════════════════════════════════════════');
      
      logInfo('[Moralis] Full holders response', { 
        fullResponse: JSON.stringify(data, null, 2),
        parsed: data 
      });
      
      // Extract holder count
      const totalHolders = 
        data.totalHolders || 
        data.total || 
        (Array.isArray(data) ? data.length : 0) ||
        (data.result?.total || data.result?.length || 0) ||
        0;
      
      // Extract holder distribution
      const distribution = data.holderDistribution || data.distribution || null;
      
      logDebug('[Moralis] Holder data extracted', { 
        totalHolders, 
        hasDistribution: !!distribution,
        whales: distribution?.whales || 0,
        mint: mintAddress.slice(0, 20) + '...' 
      });
      
      return {
        totalHolders,
        holderDistribution: distribution || undefined,
      };
    } else {
      const errorText = await response.text();
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('[Moralis] HOLDERS ERROR RESPONSE:');
      console.log(`Status: ${response.status}`);
      console.log(`Error: ${errorText.slice(0, 500)}`);
      console.log('═══════════════════════════════════════════════════════════════');
      
      logError('Moralis holders API error', new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`));
    }
    
    return null;
  } catch (error) {
    logError('Moralis holders error', error as Error);
    return null;
  }
}

/**
 * Get token holder count from Moralis (backward compatibility)
 */
export async function getTokenHoldersMoralis(mintAddress: string): Promise<number> {
  const data = await getTokenHoldersDataMoralis(mintAddress);
  return data?.totalHolders || 0;
}

export type { MoralisPumpFunToken, MoralisTokenMetadata, MoralisTokenPrice };

