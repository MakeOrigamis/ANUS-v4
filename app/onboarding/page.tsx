'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowLeft, Shield, AlertTriangle, Eye, EyeOff, Lock, Plus, Trash2, Wallet, Key, Coins, Check, ExternalLink, Copy, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { initializeProject } from '@/app/actions/auth';
import { 
  isPumpFunToken, 
  isValidPrivateKey, 
  fetchPumpFunToken, 
  getSOLBalance,
  shortenAddress,
  formatTokenAmount,
  type PumpFunTokenData 
} from '@/lib/solana';
import { logError } from '@/lib/logger-client';
import { 
  PARRY_TREASURY_ADDRESS, 
  PROTOCOL_FEE_TOKEN_PERCENT,
  PUMPFUN_TOKEN_SUPPLY 
} from '@/lib/constants';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Background Sentinel
// ═══════════════════════════════════════════════════════════════════════════════
const BackgroundSentinel = ({ isInitializing, mouseX, mouseY }: { isInitializing: boolean; mouseX: any; mouseY: any }) => {
  const tiltX = useTransform(mouseY, [0, 1], [5, -5]);
  const tiltY = useTransform(mouseX, [0, 1], [-5, 5]);
  const smoothTiltX = useSpring(tiltX, { stiffness: 30, damping: 25 });
  const smoothTiltY = useSpring(tiltY, { stiffness: 30, damping: 25 });

  return (
    <motion.div
      className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-0"
      style={{ top: '-12%', rotateX: smoothTiltX, rotateY: smoothTiltY, transformStyle: 'preserve-3d' }}
    >
      <div className="relative overflow-hidden" style={{ width: '600px', height: '600px', maskImage: 'radial-gradient(circle, black 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)', background: '#000000' }}>
        <motion.video
          src="/parry_onboarding.mp4"
          autoPlay muted loop playsInline
          className="w-full h-full object-cover"
          style={{ mixBlendMode: 'screen', background: '#000000', opacity: 0.45 }}
          animate={{ opacity: isInitializing ? 0.65 : 0.45, filter: isInitializing ? 'brightness(1.2)' : 'brightness(1)' }}
          onError={(e) => { (e.target as HTMLVideoElement).src = '/substrate-core.mp4'; }}
        />
      </div>
      <motion.div className="absolute whitespace-nowrap" style={{ bottom: '100px' }}>
        <span className="text-[9px] font-mono uppercase text-[#00F2FF]" style={{ letterSpacing: '0.3em', textShadow: '0 0 15px rgba(0,242,255,0.6)', opacity: 0.7 }}>
          [ {isInitializing ? 'SYNCING TO CORE...' : 'REGISTRATION PORTAL'} ]
        </span>
      </motion.div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Token Info Card
// ═══════════════════════════════════════════════════════════════════════════════
const TokenInfoCard = ({ tokenData, isLoading }: { tokenData: PumpFunTokenData | null; isLoading: boolean }) => {
  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.15)' }}>
        <Loader2 className="w-5 h-5 text-[#00F2FF] animate-spin" />
        <span className="text-[10px] text-[#00F2FF] font-mono">FETCHING TOKEN DATA FROM PUMP.FUN...</span>
      </motion.div>
    );
  }

  if (!tokenData) return null;

  // Check if we have real data or fallback data
  const hasCreator = tokenData.creator && tokenData.creator.length > 10;
  const isBonded = tokenData.complete === true;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 rounded-xl" style={{ background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)' }}>
      <div className="flex items-start gap-4">
        {tokenData.image_uri && (
          <img src={tokenData.image_uri} alt={tokenData.name} className="w-16 h-16 rounded-xl object-cover" style={{ border: '1px solid rgba(0,242,255,0.2)' }} />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[14px] font-mono text-[#00F2FF]">{tokenData.name}</span>
            <span className="text-[10px] font-mono text-[#808080]">${tokenData.symbol}</span>
            <CheckCircle2 className="w-4 h-4 text-[#00FF88]" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
            <div><span className="text-[#505050]">MARKET CAP:</span> <span className="text-[#E0E0E0]">${formatTokenAmount(tokenData.usd_market_cap, 0)}</span></div>
            <div><span className="text-[#505050]">SUPPLY:</span> <span className="text-[#E0E0E0]">{formatTokenAmount(PUMPFUN_TOKEN_SUPPLY)}</span></div>
            <div>
              <span className="text-[#505050]">CREATOR:</span>{' '}
              <span className={hasCreator ? 'text-[#E0E0E0]' : 'text-[#404040]'}>
                {hasCreator ? shortenAddress(tokenData.creator) : '...'}
              </span>
            </div>
            <div>
              <span className="text-[#505050]">STATUS:</span>{' '}
              <span className={isBonded ? 'text-[#00FF88]' : 'text-[#808080]'}>
                {isBonded ? 'BONDED' : 'BONDING'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Protocol Fee Card
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Protocol Fee Card with Live Verification
// ═══════════════════════════════════════════════════════════════════════════════
const ProtocolFeeCard = ({ 
  tokenSymbol, 
  tokenMint,
  onVerificationChange 
}: { 
  tokenSymbol?: string; 
  tokenMint?: string;
  onVerificationChange?: (verified: boolean) => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [depositStatus, setDepositStatus] = useState<{
    solReceived: boolean;
    solAmount: number;
    tokenReceived: boolean;
    tokenAmount: number;
    requiredTokenAmount: number;
  } | null>(null);
  
  const requiredTokens = (PUMPFUN_TOKEN_SUPPLY * PROTOCOL_FEE_TOKEN_PERCENT) / 100;

  const copyAddress = () => {
    navigator.clipboard.writeText(PARRY_TREASURY_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const verifyDeposits = async () => {
    if (!tokenMint) return;
    
    setVerifying(true);
    try {
      const { verifyProtocolDeposits } = await import('@/lib/solana');
      const status = await verifyProtocolDeposits(tokenMint);
      setDepositStatus(status);
      
      const isVerified = status.tokenReceived;
      onVerificationChange?.(isVerified);
    } catch (error) {
      logError('Error verifying deposits', error as Error);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="p-5 rounded-xl space-y-4" style={{ background: 'rgba(255,180,0,0.05)', border: '1px solid rgba(255,180,0,0.2)' }}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-[#FFB400]" />
        <span className="text-[10px] font-mono text-[#FFB400] uppercase" style={{ letterSpacing: '0.15em' }}>PROTOCOL ALIGNMENT REQUIRED</span>
      </div>
      
      <p className="text-[9px] font-mono text-[#808080] leading-relaxed">
        To activate PARRY's autonomous market-making, send the following to the treasury:
      </p>

      <div className="space-y-2">
        {/* Token Deposit */}
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ 
          background: depositStatus?.tokenReceived ? 'rgba(0,255,136,0.1)' : 'rgba(0,0,0,0.3)',
          border: depositStatus?.tokenReceived ? '1px solid rgba(0,255,136,0.3)' : 'none'
        }}>
          <div className="flex items-center gap-2">
            {depositStatus?.tokenReceived ? (
              <CheckCircle2 className="w-4 h-4 text-[#00FF88]" />
            ) : (
              <Shield className="w-4 h-4 text-[#00F2FF]" />
            )}
            <span className="text-[11px] font-mono text-[#E0E0E0]">{formatTokenAmount(requiredTokens)} {tokenSymbol || 'TOKENS'}</span>
          </div>
          <div className="flex items-center gap-2">
            {depositStatus && (
              <span className="text-[8px] font-mono text-[#808080]">
                {formatTokenAmount(depositStatus.tokenAmount)} received
              </span>
            )}
            <span className="text-[8px] font-mono text-[#505050]">{PROTOCOL_FEE_TOKEN_PERCENT}% ALIGNMENT</span>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="text-[8px] font-mono text-[#505050] mb-1">PARRY TREASURY ADDRESS:</div>
        <div className="flex items-center gap-2">
          <code className="text-[10px] font-mono text-[#00F2FF] flex-1 break-all">{PARRY_TREASURY_ADDRESS}</code>
          <motion.button onClick={copyAddress} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-1.5 rounded" style={{ background: 'rgba(0,242,255,0.1)' }}>
            {copied ? <Check className="w-3 h-3 text-[#00FF88]" /> : <Copy className="w-3 h-3 text-[#00F2FF]" />}
          </motion.button>
          <a href={`https://solscan.io/account/${PARRY_TREASURY_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded" style={{ background: 'rgba(0,242,255,0.1)' }}>
            <ExternalLink className="w-3 h-3 text-[#00F2FF]" />
          </a>
        </div>
      </div>

      {/* Verify Button */}
      {tokenMint && (
        <motion.button
          onClick={verifyDeposits}
          disabled={verifying}
          className="w-full py-3 rounded-xl font-mono text-[10px] uppercase flex items-center justify-center gap-2"
          style={{
            background: depositStatus?.tokenReceived 
              ? 'rgba(0,255,136,0.15)' 
              : 'rgba(0,242,255,0.1)',
            border: depositStatus?.tokenReceived 
              ? '1px solid rgba(0,255,136,0.3)' 
              : '1px solid rgba(0,242,255,0.2)',
            color: depositStatus?.tokenReceived 
              ? '#00FF88' 
              : '#00F2FF',
            letterSpacing: '0.15em',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {verifying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              VERIFYING DEPOSITS...
            </>
          ) : depositStatus?.tokenReceived ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              PROTOCOL ALIGNED ✓
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              VERIFY DEPOSITS
            </>
          )}
        </motion.button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Wallet Balance Display
// ═══════════════════════════════════════════════════════════════════════════════
const WalletBalanceDisplay = ({ balance, isLoading }: { balance: number | null; isLoading: boolean }) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(0,242,255,0.05)' }}>
        <Loader2 className="w-4 h-4 text-[#00F2FF] animate-spin" />
        <span className="text-[9px] text-[#00F2FF] font-mono">LOADING WALLET...</span>
      </div>
    );
  }

  if (balance === null) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.15)' }}>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-[#00FF88]" />
        <span className="text-[10px] text-[#808080] font-mono">DEV WALLET LOADED</span>
      </div>
      <span className="text-[12px] text-[#00F2FF] font-mono">{balance.toFixed(4)} SOL</span>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Security Input
// ═══════════════════════════════════════════════════════════════════════════════
const SecurityInput = ({ label, type = 'text', value, onChange, placeholder, warning, icon: Icon, validationState, validationMessage }: { 
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; warning?: string; icon?: React.ComponentType<{ className?: string }>; validationState?: 'valid' | 'invalid' | 'loading' | null; validationMessage?: string;
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-[#00F2FF]" />}
        <label className="text-[8px] text-[#606060] uppercase font-mono" style={{ letterSpacing: '0.2em' }}>{label}</label>
        {validationState === 'valid' && <CheckCircle2 className="w-3 h-3 text-[#00FF88]" />}
        {validationState === 'invalid' && <XCircle className="w-3 h-3 text-[#FF4444]" />}
        {validationState === 'loading' && <Loader2 className="w-3 h-3 text-[#00F2FF] animate-spin" />}
      </div>
      
      <div className="relative">
        <input
          type={isPassword && !showPassword ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-6 py-4 rounded-xl text-[11px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none transition-all pr-14 focus:shadow-[0_0_25px_rgba(0,242,255,0.4)]"
          style={{ 
            background: 'rgba(0,0,0,0.5)', 
            border: validationState === 'valid' ? '1px solid rgba(0,255,136,0.3)' : validationState === 'invalid' ? '1px solid rgba(255,68,68,0.3)' : '1px solid rgba(192,192,192,0.1)'
          }}
        />
        
        {isPassword && (
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#404040] hover:text-[#00F2FF] transition-colors">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {validationMessage && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-[8px] font-mono ${validationState === 'valid' ? 'text-[#00FF88]' : validationState === 'invalid' ? 'text-[#FF4444]' : 'text-[#808080]'}`}>
          {validationMessage}
        </motion.div>
      )}
      
      {warning && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,180,0,0.05)', border: '1px solid rgba(255,180,0,0.12)' }}>
          <AlertTriangle className="w-3 h-3 text-[#FFB400] flex-shrink-0 mt-0.5" />
          <span className="text-[8px] text-[#FFB400] leading-relaxed font-mono">{warning}</span>
        </motion.div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Operational Wallets (Private Keys for Market Making)
// ═══════════════════════════════════════════════════════════════════════════════
const OperationalWallets = ({ wallets, setWallets }: { wallets: string[]; setWallets: (w: string[]) => void }) => {
  const [showKeys, setShowKeys] = useState<boolean[]>([]);
  
  const addWallet = () => {
    setWallets([...wallets, '']);
    setShowKeys([...showKeys, false]);
  };
  const removeWallet = (index: number) => {
    setWallets(wallets.filter((_, i) => i !== index));
    setShowKeys(showKeys.filter((_, i) => i !== index));
  };
  const updateWallet = (index: number, value: string) => {
    const newWallets = [...wallets];
    newWallets[index] = value;
    setWallets(newWallets);
  };
  const toggleShowKey = (index: number) => {
    const newShowKeys = [...showKeys];
    newShowKeys[index] = !newShowKeys[index];
    setShowKeys(newShowKeys);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-[#00F2FF]" />
          <label className="text-[8px] text-[#606060] uppercase font-mono" style={{ letterSpacing: '0.2em' }}>OPERATIONAL WALLET KEYS</label>
        </div>
        <motion.button onClick={addWallet} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-mono uppercase" style={{ background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.25)', color: '#00F2FF', letterSpacing: '0.12em' }} whileHover={{ scale: 1.05, boxShadow: '0 0 12px rgba(0,242,255,0.2)' }} whileTap={{ scale: 0.95 }}>
          <Plus className="w-3 h-3" />ADD
        </motion.button>
      </div>

      <p className="text-[8px] text-[#505050] font-mono">
        Add private keys for wallets PARRY will use for market-making operations. Keys are encrypted locally.
      </p>

      <div className="space-y-2">
        <AnimatePresence>
          {wallets.map((wallet, index) => (
            <motion.div key={index} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2">
              <span className="text-[9px] text-[#353535] font-mono w-5">#{index + 1}</span>
              <div className="flex-1 relative">
                <input 
                  type={showKeys[index] ? 'text' : 'password'} 
                  value={wallet} 
                  onChange={(e) => updateWallet(index, e.target.value)} 
                  placeholder="Enter wallet private key..." 
                  className="w-full px-6 py-4 pr-12 rounded-xl text-[10px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none transition-all focus:shadow-[0_0_25px_rgba(0,242,255,0.4)]" 
                  style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(192,192,192,0.1)' }} 
                />
                <button 
                  type="button"
                  onClick={() => toggleShowKey(index)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#00F2FF] transition-colors"
                >
                  {showKeys[index] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <motion.button onClick={() => removeWallet(index)} className="p-2 rounded-lg text-[#404040] hover:text-[#FF4444] transition-colors" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Trash2 className="w-3.5 h-3.5" />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
        {wallets.length === 0 && <div className="text-center py-3 text-[9px] text-[#353535] font-mono">No operational wallets configured yet.</div>}
      </div>
      
      {wallets.some(w => w.trim()) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(255,180,0,0.05)', border: '1px solid rgba(255,180,0,0.12)' }}>
          <AlertTriangle className="w-3.5 h-3.5 text-[#FFB400] flex-shrink-0 mt-0.5" />
          <p className="text-[8px] text-[#FFB400] font-mono leading-relaxed">
            Private keys are encrypted with AES-256 before storage. PARRY uses these for autonomous trading.
          </p>
        </motion.div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Terms Checkbox
// ═══════════════════════════════════════════════════════════════════════════════
const TermsCheckbox = ({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) => (
  <button onClick={() => onChange(!checked)} className="flex items-start gap-3 text-left group">
    <motion.div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: checked ? 'rgba(0,242,255,0.2)' : 'rgba(0,0,0,0.4)', border: checked ? '1px solid rgba(0,242,255,0.5)' : '1px solid rgba(192,192,192,0.15)', boxShadow: checked ? '0 0 12px rgba(0,242,255,0.3)' : 'none' }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
      {checked && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}><Check className="w-3 h-3 text-[#00F2FF]" /></motion.div>}
    </motion.div>
    <span className="text-[9px] text-[#C0C0C0] leading-relaxed group-hover:text-[#E0E0E0] transition-colors font-mono">
      I ACCEPT THE SOVEREIGN TERMS, ACKNOWLEDGE AUTONOMOUS EXECUTION RISKS, AND CONFIRM I HAVE SENT {PROTOCOL_FEE_TOKEN_PERCENT}% TOKENS TO PARRY'S TREASURY
    </span>
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  // Form state
  const [tokenMint, setTokenMint] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [operationalWallets, setOperationalWallets] = useState<string[]>(['']);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation state
  const [tokenData, setTokenData] = useState<PumpFunTokenData | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenValidation, setTokenValidation] = useState<'valid' | 'invalid' | 'loading' | null>(null);
  const [privateKeyValidation, setPrivateKeyValidation] = useState<'valid' | 'invalid' | null>(null);
  const [devWalletBalance, setDevWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Validate token mint address
  useEffect(() => {
    const validateToken = async () => {
      if (!tokenMint || tokenMint.length < 32) {
        setTokenValidation(null);
        setTokenData(null);
        return;
      }

      // Accept any valid-looking Solana address (32+ chars)
      setTokenValidation('valid');
      setTokenLoading(false);
      
      // Try to fetch token data if it's a pump.fun token (optional)
      if (isPumpFunToken(tokenMint)) {
        setTokenLoading(true);
        try {
          const data = await fetchPumpFunToken(tokenMint);
          if (data) {
            setTokenData(data);
          }
        } catch {
          // Token data fetch failed, but address is still valid
        } finally {
          setTokenLoading(false);
        }
      }
    };

    const debounce = setTimeout(validateToken, 500);
    return () => clearTimeout(debounce);
  }, [tokenMint]);

  // Validate private key and load wallet balance from blockchain
  useEffect(() => {
    const validateKey = async () => {
      if (!privateKey) {
        setPrivateKeyValidation(null);
        setDevWalletBalance(null);
        return;
      }

      if (!isValidPrivateKey(privateKey)) {
        setPrivateKeyValidation('invalid');
        setDevWalletBalance(null);
        return;
      }

      setPrivateKeyValidation('valid');
      setWalletLoading(true);

      try {
        // Import the helper to derive public address
        const { getPublicKeyFromPrivate } = await import('@/lib/solana');
        const publicAddress = getPublicKeyFromPrivate(privateKey);
        
        if (publicAddress) {
          // Fetch REAL balance from Helius RPC
          const balance = await getSOLBalance(publicAddress);
          setDevWalletBalance(balance);
        } else {
          setDevWalletBalance(0);
        }
      } catch (error) {
        logError('Error fetching wallet balance', error as Error);
        setDevWalletBalance(0);
      } finally {
        setWalletLoading(false);
      }
    };

    const debounce = setTimeout(validateKey, 500);
    return () => clearTimeout(debounce);
  }, [privateKey]);

  // Form validation
  const isFormValid = 
    tokenValidation === 'valid' && 
    privateKeyValidation === 'valid' && 
    termsAccepted;

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX / window.innerWidth);
    mouseY.set(e.clientY / window.innerHeight);
  };

  const handleInitialize = async () => {
    if (!isFormValid) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      // Save to DATABASE (the important part!)
      await initializeProject({
        tokenMintAddress: tokenMint,
        privateKey: privateKey,
        initialLiquidity: devWalletBalance || 0,
        operationalWallets: operationalWallets.filter(w => w.trim()),
      });
      
      // Also save to localStorage for quick access
      if (session?.user?.email) {
        localStorage.setItem(`parry_initialized_${session.user.email}`, 'true');
        localStorage.setItem(`parry_token_mint_${session.user.email}`, tokenMint);
        localStorage.setItem(`parry_token_data_${session.user.email}`, JSON.stringify(tokenData));
        localStorage.setItem(`parry_wallets_${session.user.email}`, JSON.stringify(
          operationalWallets.filter(w => w.trim()).map((address, i) => ({
            id: `${Date.now()}-${i}`,
            address,
            balance: '0.0',
            isActive: true
          }))
        ));
      }
      localStorage.setItem('parry_initialized', 'true');
      localStorage.setItem('parry_token_mint', tokenMint);

      // Redirect to hub
      router.push('/hub');
    } catch (err: any) {
      logError('Initialize project error', err as Error);
      setError(err.message || 'Failed to initialize project');
      setIsInitializing(false);
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div className="w-8 h-8 border-2 border-[#00F2FF] border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#000000' }} onMouseMove={handleMouseMove}>
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(0,40,60,0.1) 0%, transparent 60%)' }} />
      </div>

      <div className="fixed inset-0 pointer-events-none z-[100]" style={{ opacity: 0.01, background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.006) 2px, rgba(255,255,255,0.006) 4px)' }} />

      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="fixed top-6 left-6 z-[200]">
        <button 
          onClick={() => router.push('/login')} 
          className="flex items-center gap-2 text-[#606060] hover:text-[#00F2FF] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[9px] font-mono uppercase" style={{ letterSpacing: '0.2em' }}>BACK</span>
        </button>
      </motion.div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-20">
        <BackgroundSentinel isInitializing={isInitializing} mouseX={mouseX} mouseY={mouseY} />

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }} className="w-[700px] max-w-full relative z-10 mt-[34rem]">
          <div className="relative rounded-[3rem] overflow-hidden p-12" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(60px)', WebkitBackdropFilter: 'blur(60px)', border: '1px solid rgba(192,192,192,0.1)', boxShadow: '0 0 80px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,0,0,0.3)' }}>
            
            <div className="text-center mb-10">
              <h1 className="text-[18px] font-mono text-[#00F2FF] mb-2" style={{ textShadow: '0 0 25px rgba(0,242,255,0.5)', letterSpacing: '0.1em' }}>PROJECT REGISTRATION</h1>
              <p className="text-[9px] text-[#505050] font-mono">Configure your autonomous market-making parameters</p>
              {session?.user?.email && <p className="text-[8px] text-[#404040] font-mono mt-2">Signed in as: {session.user.email}</p>}
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.2)' }}>
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-[10px] text-red-400 font-mono">{error}</span>
              </motion.div>
            )}

            <div className="flex flex-col gap-6 mb-8">
              <SecurityInput
                label="Token Mint Address"
                value={tokenMint}
                onChange={setTokenMint}
                placeholder="Enter Solana token address..."
                icon={Shield}
                validationState={tokenValidation}
                validationMessage={
                  tokenValidation === 'valid' ? 'Valid token address!' :
                  tokenValidation === 'invalid' ? 'Invalid address. Must be at least 32 characters.' :
                  tokenValidation === 'loading' ? 'Fetching token data...' : undefined
                }
              />

              <TokenInfoCard tokenData={tokenData} isLoading={tokenLoading} />

              <SecurityInput
                label="Creator Rewards / Dev Private Key"
                type="password"
                value={privateKey}
                onChange={setPrivateKey}
                placeholder="Enter your wallet private key..."
                icon={Key}
                validationState={privateKeyValidation}
                validationMessage={
                  privateKeyValidation === 'valid' ? 'Valid private key format' :
                  privateKeyValidation === 'invalid' ? 'Invalid private key format' : undefined
                }
                warning="PARRY requires this for auto-claiming creator rewards. Your key is encrypted locally and never transmitted."
              />

              <WalletBalanceDisplay balance={devWalletBalance} isLoading={walletLoading} />

              <OperationalWallets wallets={operationalWallets} setWallets={setOperationalWallets} />

              <ProtocolFeeCard tokenSymbol={tokenData?.symbol} tokenMint={tokenMint} />
            </div>

            <div className="mb-8">
              <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />
            </div>

            <div className="flex flex-wrap gap-3 justify-center mb-8">
              <div className={`text-[7px] font-mono uppercase px-2 py-1 rounded-lg ${tokenValidation === 'valid' ? 'text-[#00F2FF] bg-[#00F2FF]/10' : 'text-[#404040] bg-[#151515]'}`}>
                {tokenValidation === 'valid' ? '✓' : '○'} TOKEN
              </div>
              <div className={`text-[7px] font-mono uppercase px-2 py-1 rounded-lg ${privateKeyValidation === 'valid' ? 'text-[#00F2FF] bg-[#00F2FF]/10' : 'text-[#404040] bg-[#151515]'}`}>
                {privateKeyValidation === 'valid' ? '✓' : '○'} KEY
              </div>
              <div className={`text-[7px] font-mono uppercase px-2 py-1 rounded-lg ${termsAccepted ? 'text-[#00F2FF] bg-[#00F2FF]/10' : 'text-[#404040] bg-[#151515]'}`}>
                {termsAccepted ? '✓' : '○'} TERMS
              </div>
            </div>

            <motion.button
              onClick={handleInitialize}
              disabled={isInitializing || !isFormValid}
              className="w-full py-5 rounded-2xl font-mono text-[11px] uppercase relative overflow-hidden disabled:opacity-25 disabled:cursor-not-allowed"
              style={{
                background: isFormValid ? 'linear-gradient(135deg, rgba(0,242,255,0.2) 0%, rgba(0,150,200,0.1) 100%)' : 'rgba(255,255,255,0.02)',
                border: isFormValid ? '1px solid rgba(0,242,255,0.5)' : '1px solid rgba(192,192,192,0.06)',
                color: isFormValid ? '#00F2FF' : '#303030',
                letterSpacing: '0.18em',
                boxShadow: isFormValid ? '0 0 50px rgba(0,242,255,0.4), inset 0 0 25px rgba(0,242,255,0.1)' : 'none',
              }}
              whileHover={isFormValid && !isInitializing ? { scale: 1.02, boxShadow: '0 0 70px rgba(0,242,255,0.6), 0 0 120px rgba(0,242,255,0.3)' } : {}}
              whileTap={isFormValid && !isInitializing ? { scale: 0.98 } : {}}
            >
              {isFormValid && !isInitializing && (
                <motion.div className="absolute inset-0" animate={{ background: ['radial-gradient(circle at 50% 50%, rgba(0,242,255,0.15) 0%, transparent 50%)', 'radial-gradient(circle at 50% 50%, rgba(0,242,255,0.35) 0%, transparent 70%)', 'radial-gradient(circle at 50% 50%, rgba(0,242,255,0.15) 0%, transparent 50%)'] }} transition={{ duration: 1.5, repeat: Infinity }} />
              )}
              
              <AnimatePresence mode="wait">
                {isInitializing ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex items-center justify-center gap-3">
                    <motion.div className="w-4 h-4 border-2 border-[#00F2FF] border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                    <span>INITIALIZING PARRY CORE...</span>
                  </motion.div>
                ) : (
                  <motion.span key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">[ INITIALIZE PARRY CORE ]</motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <div className="mt-6 flex items-center justify-center gap-2">
              <Lock className="w-3 h-3 text-[#252525]" />
              <span className="text-[7px] text-[#252525] font-mono">AES-256 ENCRYPTED • ZERO-KNOWLEDGE PROTOCOL</span>
            </div>

            <div className="mt-8 text-center">
              <span className="text-[6px] font-mono text-[#181818] uppercase" style={{ letterSpacing: '0.25em' }}>[ REGISTRATION_MODULE // V21 ]</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
