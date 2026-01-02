// ═══════════════════════════════════════════════════════════════════════════════
// PARRY PROTOCOL CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// PARRY's Treasury Wallet - Receives 1% token supply from each project
// Can be overridden via NEXT_PUBLIC_PARRY_TREASURY_ADDRESS env var, otherwise uses default protocol address
export const PARRY_TREASURY_ADDRESS = process.env.NEXT_PUBLIC_PARRY_TREASURY_ADDRESS || '4VkjfVPFE2mQP9sHhGvUG5tXnbeStJQWeFQ1NVcLN1Sm';

// Protocol Fees
export const PROTOCOL_FEE_TOKEN_PERCENT = 1; // 1% of token supply

// Pump.fun Constants
export const PUMPFUN_TOKEN_SUPPLY = 1_000_000_000; // 1 billion fixed supply
export const PUMPFUN_TOKEN_SUFFIX = 'pump'; // Token addresses must end with this

// Solana RPC - Using Helius for reliable RPC access
// Get your free API key at https://dashboard.helius.dev/
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 
  `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;

// Helius API for enhanced data
export const HELIUS_API_URL = `https://api.helius.xyz/v0`;

// API Endpoints
export const PUMPFUN_API_URL = 'https://frontend-api.pump.fun';
export const PUMPFUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'; // Pump.fun bonding curve program
export const SOLSCAN_API_URL = 'https://api.solscan.io';

// Validation
export const MIN_TOKEN_ADDRESS_LENGTH = 32;
export const MIN_PRIVATE_KEY_LENGTH = 64;

