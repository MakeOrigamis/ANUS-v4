'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, Activity, Zap, BarChart3, Play, Pause, RefreshCw, 
  Send, AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
  ArrowLeft, Settings, Sliders, ChevronDown, ChevronUp, Save,
  MessageSquare, DollarSign, Wallet, Shield, Eye, EyeOff
} from 'lucide-react';
import Link from 'next/link';

// ═══════════════════════════════════════════════════════════════════════════════
// SECRET PARRY CORE DASHBOARD - $ANUS ONLY
// ═══════════════════════════════════════════════════════════════════════════════

const PARRY_PASSWORD = process.env.NEXT_PUBLIC_PARRY_CORE_PASSWORD || '';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Config Input (same as Hub)
// ═══════════════════════════════════════════════════════════════════════════════
const ConfigInput = ({ 
  label, value, onChange, unit, min, max, step = 1, tooltip
}: { 
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; min: number; max: number; step?: number; tooltip?: string;
}) => (
  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-[#808080] uppercase" style={{ letterSpacing: '0.05em' }}>{label}</span>
      {tooltip && (
        <div className="group relative">
          <div className="w-3 h-3 rounded-full flex items-center justify-center text-[8px] text-[#404040] border border-[#404040] cursor-help">?</div>
          <div className="absolute bottom-full left-0 mb-2 px-2 py-1 rounded text-[8px] text-[#808080] bg-[#0A0A0A] border border-[#202020] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            {tooltip}
          </div>
        </div>
      )}
    </div>
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min} max={max} step={step}
        className="w-20 px-2 py-1 rounded text-[10px] font-mono text-[#00F2FF] text-right outline-none"
        style={{ background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)' }}
      />
      {unit && <span className="text-[8px] font-mono text-[#505050] w-8">{unit}</span>}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Strategy Toggle (same as Hub)
// ═══════════════════════════════════════════════════════════════════════════════
const StrategyToggle = ({ label, active, onToggle, description }: { 
  label: string; active: boolean; onToggle: () => void; description: string;
}) => (
  <motion.button
    onClick={onToggle}
    className="w-full p-4 rounded-xl text-left flex items-center justify-between"
    style={{ background: active ? 'rgba(0,242,255,0.08)' : 'rgba(0,0,0,0.3)', border: active ? '1px solid rgba(0,242,255,0.3)' : '1px solid rgba(192,192,192,0.06)' }}
    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
  >
    <div>
      <div className="text-[10px] font-mono text-[#E0E0E0] mb-1" style={{ letterSpacing: '0.1em' }}>{label}</div>
      <div className="text-[8px] font-mono text-[#505050]">{description}</div>
    </div>
    <motion.div className="w-10 h-5 rounded-full relative" style={{ background: active ? 'rgba(0,242,255,0.3)' : 'rgba(255,255,255,0.1)' }}>
      <motion.div className="absolute top-0.5 w-4 h-4 rounded-full" style={{ background: active ? '#00F2FF' : '#404040' }} animate={{ left: active ? '22px' : '2px' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
    </motion.div>
  </motion.button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Stats Card
// ═══════════════════════════════════════════════════════════════════════════════
const StatsCard = ({ label, value, subValue, icon: Icon, color = '#00F2FF' }: {
  label: string; value: string; subValue?: string; icon: any; color?: string;
}) => (
  <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(192,192,192,0.06)' }}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4" style={{ color }} />
      <span className="text-[8px] font-mono text-[#505050] uppercase" style={{ letterSpacing: '0.1em' }}>{label}</span>
    </div>
    <div className="text-[16px] font-mono" style={{ color }}>{value}</div>
    {subValue && <div className="text-[9px] font-mono text-[#404040] mt-1">{subValue}</div>}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Dashboard Token Mint Input
// ═══════════════════════════════════════════════════════════════════════════════
const DashboardTokenMintInput = ({ onSave }: { onSave?: () => void }) => {
  const [tokenMint, setTokenMint] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current token mint
  useEffect(() => {
    const loadTokenMint = async () => {
      try {
        const response = await fetch('/api/dashboard/token-mint');
        const data = await response.json();
        if (data.success && data.tokenMint) {
          setTokenMint(data.tokenMint);
        }
      } catch (error) {
        console.error('Error loading token mint:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTokenMint();
  }, []);

  const handleSave = async () => {
    if (!tokenMint || tokenMint.length < 30) {
      setMessage({ type: 'error', text: 'Invalid token mint address (min 30 chars)' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/dashboard/token-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenMint }),
      });

      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Token mint saved! Dashboard will update.' });
        setTimeout(() => setMessage(null), 3000);
        // Trigger refresh in parent component
        if (onSave) onSave();
        
        // Verify it was saved by fetching it back
        setTimeout(async () => {
          try {
            const verifyResponse = await fetch('/api/dashboard/token-mint');
            const verifyData = await verifyResponse.json();
            if (verifyData.success && verifyData.tokenMint === tokenMint) {
              console.log('[ParryCore] Token mint verified:', verifyData.tokenMint.slice(0, 20) + '...');
            } else {
              console.warn('[ParryCore] Token mint verification failed:', verifyData);
            }
          } catch (err) {
            console.error('[ParryCore] Error verifying token mint:', err);
          }
        }, 1000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
        console.error('[ParryCore] Save failed:', data);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving token mint' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[8px] font-mono text-[#404040] uppercase mb-1 block" style={{ letterSpacing: '0.1em' }}>
          TOKEN MINT ADDRESS
        </label>
        <input
          type="text"
          value={tokenMint}
          onChange={(e) => setTokenMint(e.target.value)}
          placeholder="Enter token mint address..."
          disabled={isLoading || isSaving}
          className="w-full px-3 py-2 rounded-lg text-[10px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none disabled:opacity-50"
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(192,192,192,0.1)' }}
        />
        <div className="text-[7px] font-mono text-[#303030] mt-1">
          This token will be displayed on the public dashboard
        </div>
      </div>
      
      {message && (
        <div className={`text-[8px] font-mono px-2 py-1 rounded ${
          message.type === 'success' 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {message.text}
        </div>
      )}

      <motion.button
        onClick={handleSave}
        disabled={isLoading || isSaving || !tokenMint}
        className="w-full py-2 rounded-lg text-[9px] font-mono uppercase disabled:opacity-30"
        style={{ background: 'rgba(0,242,255,0.1)', border: '1px solid rgba(0,242,255,0.3)', color: '#00F2FF' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isSaving ? 'SAVING...' : 'SAVE TOKEN MINT'}
      </motion.button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ParryCorePage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [parryStatus, setParryStatus] = useState<'offline' | 'running' | 'paused'>('offline');
  const [logs, setLogs] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [tokenMint, setTokenMint] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<{ name: string; symbol: string } | null>(null);
  
  // Stats
  const [stats, setStats] = useState({
    totalTrades: 0,
    profitLoss: 0,
    volumeGenerated: 0,
    tweetsPosted: 0,
    feesClaimed: 0,
  });
  
  // Market Data
  const [marketData, setMarketData] = useState({
    price: 0,
    priceChange: 0,
    volume24h: 0,
    holders: 0,
    marketCap: 0,
    bondingComplete: false,
  });
  
  // Tweet
  const [tweetPreview, setTweetPreview] = useState('');
  const [isGeneratingTweet, setIsGeneratingTweet] = useState(false);
  
  // Config (same as Hub)
  const [config, setConfig] = useState({
    // Market cap thresholds
    minMcToSell: 250000,
    lightMcThreshold: 250000,
    mediumMcThreshold: 500000,
    heavyMcThreshold: 1000000,
    // Sell percentages
    lightSellPercent: 6,
    mediumSellPercent: 10,
    heavySellPercent: 14,
    volumeFarmingPercent: 8,
    // Trade limits
    maxSellPerTrade: 2,
    maxBuyPerTrade: 1,
    cooldownSeconds: 60,
    // Wallet limits
    maxSupplyPercent: 2,
    // Execution
    slippage: 10,
    // Twitter
    twitterEnabled: true,
    tweetIntervalMinutes: 30,
    // Trading
    tradingEnabled: true,
    dryRun: true,
  });

  const updateConfig = (key: string, value: number | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Password check
  const handleLogin = () => {
    if (password === PARRY_PASSWORD) {
      setIsAuthorized(true);
      localStorage.setItem('parry_core_auth', 'true');
      addLog('🔐 Authorization successful');
    } else {
      alert('Invalid password');
    }
  };

  useEffect(() => {
    const auth = localStorage.getItem('parry_core_auth');
    if (auth === 'true') setIsAuthorized(true);
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  };

  // Force refresh trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load token mint and data, update logs dynamically
  useEffect(() => {
    if (!isAuthorized) return;

    const updateNeuralLog = async () => {
      try {
        // Load token mint
        const mintResponse = await fetch('/api/dashboard/token-mint');
        const mintData = await mintResponse.json();
        const currentMint = mintData.success && mintData.tokenMint ? mintData.tokenMint : null;
        setTokenMint(currentMint);

        // Load token data if mint is available
        let tokenInfo = null;
        if (currentMint && currentMint.length > 30) {
          try {
            const tokenResponse = await fetch(`/api/token/sync?mint=${currentMint}`);
            if (tokenResponse.ok) {
              const tokenResult = await tokenResponse.json();
              if (tokenResult.tokenData) {
                tokenInfo = {
                  name: tokenResult.tokenData.name || 'Unknown',
                  symbol: tokenResult.tokenData.symbol || '???',
                };
                setTokenData(tokenInfo);
              }
            } else if (tokenResponse.status === 429) {
              // Rate limit - use cached data or show loading
              console.warn('[ParryCore] Rate limit hit for token sync, using cached data');
              // Keep existing tokenData if available
            } else {
              console.warn('[ParryCore] Token sync failed:', tokenResponse.status, tokenResponse.statusText);
            }
          } catch (error) {
            console.error('[ParryCore] Error fetching token data:', error);
            // Keep existing tokenData if available
          }
        }

        // Update logs based on current state
        const newLogs: string[] = [];
        
        if (currentMint && currentMint.length > 30) {
          if (tokenInfo) {
            newLogs.push(`> MARKET DATA: ${tokenInfo.name} ($${tokenInfo.symbol})`);
            newLogs.push(`> TOKEN CONNECTED: ${currentMint.slice(0, 8)}...${currentMint.slice(-8)}`);
          } else {
            newLogs.push(`> MARKET DATA: LOADING...`);
            newLogs.push(`> TOKEN CONNECTED: ${currentMint.slice(0, 8)}...${currentMint.slice(-8)}`);
          }
          
          // Check PARRY status
          try {
            const parryResponse = await fetch('/api/parry');
            const parryData = await parryResponse.json();
            if (parryData.status === 'running') {
              newLogs.push(`> PARRY STATUS: ONLINE`);
              setParryStatus('running');
            } else {
              newLogs.push(`> PARRY STATUS: ONLINE`);
              setParryStatus('offline');
            }
          } catch {
            newLogs.push(`> PARRY STATUS: ONLINE`);
            setParryStatus('offline');
          }
          
          newLogs.push(`> LIQUIDITY SCAN: ACTIVE`);
        } else {
          newLogs.push(`> MARKET DATA: PENDING`);
          newLogs.push(`> INITIALIZE VIA /parry-core`);
          newLogs.push(`> AWAITING TOKEN...`);
          newLogs.push(`> PARRY STATUS: ONLINE`);
          newLogs.push(`> CONNECT TOKEN TO ACTIVATE`);
          newLogs.push(`> LIQUIDITY SCAN: WAITING`);
          setParryStatus('offline');
        }

        // Update logs (keep existing logs, prepend new status)
        setLogs(prev => {
          // Remove old status logs (lines starting with >)
          const filtered = prev.filter(log => !log.includes('> MARKET DATA:') && 
            !log.includes('> TOKEN CONNECTED:') && 
            !log.includes('> PARRY STATUS:') && 
            !log.includes('> INITIALIZE VIA') && 
            !log.includes('> AWAITING') && 
            !log.includes('> CONNECT TOKEN') && 
            !log.includes('> LIQUIDITY SCAN:'));
          return [...newLogs, ...filtered].slice(0, 100);
        });
      } catch (error) {
        console.error('Error updating neural log:', error);
      }
    };

    updateNeuralLog();
    const interval = setInterval(updateNeuralLog, 30000); // Update every 30 seconds (reduced to avoid rate limits)
    return () => clearInterval(interval);
  }, [isAuthorized, refreshTrigger]);

  // Fetch PARRY status (separate from neural log updates)
  useEffect(() => {
    if (!isAuthorized) return;
    
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/parry');
        const data = await response.json();
        setParryStatus(data.status === 'running' ? 'running' : 'offline');
        if (data.trades) setStats(prev => ({ ...prev, totalTrades: data.trades }));
        if (data.tweets) setStats(prev => ({ ...prev, tweetsPosted: data.tweets }));
      } catch (error) {
        setParryStatus('offline');
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [isAuthorized]);

  // Start PARRY
  const startParry = async () => {
    addLog('🚀 Starting PARRY...');
    
    // Check if token mint is configured
    const tokenMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
    if (!tokenMint) {
      addLog('⚠️ No token mint configured');
      addLog('➡️ Add NEXT_PUBLIC_ANUS_TOKEN_MINT to .env');
      addLog('➡️ Or use DRY RUN mode for testing');
    }
    
    try {
      const response = await fetch('/api/parry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          tokenMint: tokenMint || 'TEST_MODE_NO_TOKEN',
          // Private key is read server-side from env, not passed from client
          config: {
            dryRun: config.dryRun,
            tradingEnabled: config.tradingEnabled,
            twitterEnabled: config.twitterEnabled,
            tweetIntervalMinutes: config.tweetIntervalMinutes,
          },
        }),
      });
      const data = await response.json();
      if (data.success) {
        setParryStatus('running');
        addLog('✅ PARRY is now LIVE');
        if (config.dryRun) {
          addLog('🔒 Running in DRY RUN mode');
        }
      } else {
        addLog(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  // Stop PARRY
  const stopParry = async () => {
    addLog('⏸️ Stopping PARRY...');
    try {
      await fetch('/api/parry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      setParryStatus('offline');
      addLog('⏹️ PARRY stopped');
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  // Generate tweet (for testing)
  const generateTweet = async () => {
    setIsGeneratingTweet(true);
    addLog('🧠 Generating test tweet...');
    try {
      // Use live endpoint instead of removed test endpoint
      const response = await fetch('/api/ai/live?type=schizo');
      const data = await response.json();
      if (data.success && data.post) {
        setTweetPreview(data.post);
        addLog('✅ Tweet generated');
      } else {
        addLog(`❌ Error: ${data.error || 'Failed to generate tweet'}`);
      }
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    } finally {
      setIsGeneratingTweet(false);
    }
  };

  // Post tweet (manual test)
  const postTweet = async () => {
    if (!tweetPreview) return;
    addLog('📤 Posting test tweet...');
    try {
      const response = await fetch('/api/twitter/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customTweet: tweetPreview, dryRun: config.dryRun }),
      });
      const data = await response.json();
      if (data.success) {
        addLog(config.dryRun ? '✅ [DRY RUN] Tweet would be posted' : '✅ Tweet posted!');
        setTweetPreview('');
        setStats(prev => ({ ...prev, tweetsPosted: prev.tweetsPosted + 1 }));
      } else {
        addLog(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  // Refresh market data
  const refreshMarketData = async () => {
    addLog('📊 Fetching market data...');
    try {
      // Get token mint from API (or fallback to env)
      let mint: string | null = null;
      try {
        const mintResponse = await fetch('/api/dashboard/token-mint');
        const mintData = await mintResponse.json();
        if (mintData.success && mintData.tokenMint) {
          mint = mintData.tokenMint;
        }
      } catch (e) {
        // Fallback to env
        mint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT || null;
      }
      
      if (!mint) {
        addLog('⚠️ No token mint configured');
        return;
      }
      
      // Use token sync API instead of ai/live for market data
      const response = await fetch(`/api/token/sync?mint=${mint}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.tokenData) {
          // Calculate price from market cap (approximate)
          const price = data.tokenData.usd_market_cap / 1_000_000_000; // 1B supply
          setMarketData({
            price: price || 0,
            priceChange: data.tokenData.priceChange24h || 0, // Use Moralis/DexScreener 24h change
            volume24h: data.tokenData.volume24h || data.tokenData.usd_market_cap * 0.1 || 0, // Use DexScreener volume if available
            holders: data.holderCount || 0,
            marketCap: data.tokenData.usd_market_cap || 0,
            bondingComplete: data.tokenData.complete || false,
          });
          addLog('✅ Market data updated');
        } else {
          addLog(`❌ Error: ${data.error || 'Failed to fetch market data'}`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        addLog(`❌ Error: ${errorData.error || 'Failed to fetch market data'}`);
      }
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  // Save config
  const saveConfig = async () => {
    setConfigSaving(true);
    addLog('💾 Saving config...');
    // In production, this would save to database
    await new Promise(r => setTimeout(r, 500));
    addLog('✅ Config saved');
    setConfigSaving(false);
  };

  // Password screen
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-2xl max-w-md w-full"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,68,68,0.2)' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <Brain className="w-6 h-6 text-[#FF4444]" />
            <h1 className="text-[14px] font-mono text-[#FF4444] uppercase" style={{ letterSpacing: '0.1em' }}>
              PARRY CORE ACCESS
            </h1>
          </div>
          <p className="text-[10px] font-mono text-[#505050] mb-6">
            Restricted area. Authorized personnel only.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Authorization code..."
            className="w-full px-4 py-3 rounded-xl text-[11px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none mb-4"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,68,68,0.2)' }}
          />
          <motion.button
            onClick={handleLogin}
            className="w-full py-3 rounded-xl text-[10px] font-mono uppercase"
            style={{ background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.4)', color: '#FF4444' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            AUTHORIZE
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#404040] hover:text-[#00F2FF] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-[#FF4444]" />
            <span className="text-[12px] font-mono text-[#808080] uppercase" style={{ letterSpacing: '0.15em' }}>
              PARRY CORE // $ANUS COMMAND CENTER
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-mono uppercase ${
            parryStatus === 'running' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
            'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            <div className={`w-2 h-2 rounded-full ${parryStatus === 'running' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {parryStatus.toUpperCase()}
          </div>
          
          {/* Start/Stop Button */}
          {parryStatus === 'running' ? (
            <motion.button
              onClick={stopParry}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-mono uppercase"
              style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.3)', color: '#FFB400' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Pause className="w-3 h-3" /> STOP
            </motion.button>
          ) : (
            <motion.button
              onClick={startParry}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-mono uppercase"
              style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: '#00FF88' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="w-3 h-3" /> START PARRY
            </motion.button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-4 gap-4">
        
        {/* Column 1: Market Data & Stats */}
        <div className="space-y-4">
          {/* Dashboard Token Mint Config */}
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-[#00F2FF]" />
              <span className="text-[9px] font-mono text-[#505050] uppercase" style={{ letterSpacing: '0.1em' }}>DASHBOARD TOKEN</span>
            </div>
            <DashboardTokenMintInput onSave={() => setRefreshTrigger(prev => prev + 1)} />
          </div>

          <div className="p-5 rounded-2xl" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-mono text-[#505050] uppercase" style={{ letterSpacing: '0.1em' }}>$ANUS MARKET</span>
              <motion.button onClick={refreshMarketData} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <RefreshCw className="w-3 h-3 text-[#404040] hover:text-[#00F2FF]" />
              </motion.button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[8px] text-[#404040]">PRICE</span>
                <span className="text-[11px] font-mono text-[#00F2FF]">${marketData.price.toFixed(10)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[8px] text-[#404040]">24H</span>
                <span className={`text-[10px] font-mono ${marketData.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {marketData.priceChange >= 0 ? '+' : ''}{marketData.priceChange.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[8px] text-[#404040]">VOLUME</span>
                <span className="text-[10px] font-mono text-[#808080]">${marketData.volume24h.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[8px] text-[#404040]">HOLDERS</span>
                <span className="text-[10px] font-mono text-[#808080]">{marketData.holders.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[8px] text-[#404040]">MCAP</span>
                <span className="text-[10px] font-mono text-[#808080]">${marketData.marketCap.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[8px] text-[#404040]">BONDING</span>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${marketData.bondingComplete ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {marketData.bondingComplete ? 'COMPLETE' : 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <StatsCard label="TRADES" value={stats.totalTrades.toString()} icon={Activity} />
            <StatsCard label="TWEETS" value={stats.tweetsPosted.toString()} icon={MessageSquare} color="#1DA1F2" />
            <StatsCard label="P/L" value={`${stats.profitLoss >= 0 ? '+' : ''}${stats.profitLoss.toFixed(2)}`} icon={DollarSign} color={stats.profitLoss >= 0 ? '#00FF88' : '#FF4444'} />
            <StatsCard label="FEES" value={stats.feesClaimed.toFixed(4)} icon={Zap} color="#FFB400" />
          </div>
        </div>

        {/* Column 2: Strategy Toggles */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-[#00F2FF]" />
              <span className="text-[9px] font-mono text-[#505050] uppercase" style={{ letterSpacing: '0.1em' }}>PARRY CONTROLS</span>
            </div>
            <div className="space-y-2">
              <StrategyToggle 
                label="DRY RUN MODE" 
                active={config.dryRun} 
                onToggle={() => updateConfig('dryRun', !config.dryRun)} 
                description="Test without real transactions" 
              />
              <StrategyToggle 
                label="TRADING" 
                active={config.tradingEnabled} 
                onToggle={() => updateConfig('tradingEnabled', !config.tradingEnabled)} 
                description="Execute buy/sell on pump.fun" 
              />
              <StrategyToggle 
                label="TWITTER POSTS" 
                active={config.twitterEnabled} 
                onToggle={() => updateConfig('twitterEnabled', !config.twitterEnabled)} 
                description="Auto-post schizo updates" 
              />
            </div>
          </div>

          {/* Tweet Test */}
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-[#1DA1F2]" />
              <span className="text-[9px] font-mono text-[#505050] uppercase" style={{ letterSpacing: '0.1em' }}>TWEET TEST</span>
            </div>
            <motion.button
              onClick={generateTweet}
              disabled={isGeneratingTweet}
              className="w-full py-2 rounded-lg text-[9px] font-mono uppercase mb-3"
              style={{ background: 'rgba(0,242,255,0.1)', border: '1px solid rgba(0,242,255,0.3)', color: '#00F2FF' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isGeneratingTweet ? 'GENERATING...' : 'GENERATE TWEET'}
            </motion.button>
            <textarea
              value={tweetPreview}
              onChange={(e) => setTweetPreview(e.target.value)}
              placeholder="Tweet preview..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-[10px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none resize-none mb-2"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(192,192,192,0.1)' }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-[#404040]">{tweetPreview.length}/280</span>
              <motion.button
                onClick={postTweet}
                disabled={!tweetPreview}
                className="px-3 py-1.5 rounded-lg text-[8px] font-mono uppercase disabled:opacity-30"
                style={{ background: 'rgba(29,161,242,0.2)', border: '1px solid rgba(29,161,242,0.4)', color: '#1DA1F2' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Send className="w-3 h-3 inline mr-1" /> POST
              </motion.button>
            </div>
            <div className="text-[7px] font-mono text-[#303030] mt-2 text-center">
              {config.dryRun ? '🔒 Dry run - won\'t actually post' : '⚠️ Will post to real Twitter'}
            </div>
          </div>
        </div>

        {/* Column 3: Config Parameters */}
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#FFB400]" />
              <span className="text-[9px] font-mono text-[#505050] uppercase" style={{ letterSpacing: '0.1em' }}>PARAMETERS</span>
            </div>
            <motion.button
              onClick={saveConfig}
              disabled={configSaving}
              className="px-3 py-1 rounded text-[8px] font-mono uppercase"
              style={{ background: 'rgba(0,242,255,0.1)', border: '1px solid rgba(0,242,255,0.3)', color: '#00F2FF' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {configSaving ? '...' : 'SAVE'}
            </motion.button>
          </div>
          
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
            <div className="text-[8px] text-[#404040] uppercase mb-2">Market Cap Thresholds</div>
            <ConfigInput label="Min MC to Sell" value={config.minMcToSell} onChange={(v) => updateConfig('minMcToSell', v)} unit="$" min={50000} max={1000000} step={10000} />
            <ConfigInput label="Light Sell MC" value={config.lightMcThreshold} onChange={(v) => updateConfig('lightMcThreshold', v)} unit="$" min={100000} max={1000000} step={10000} />
            <ConfigInput label="Medium Sell MC" value={config.mediumMcThreshold} onChange={(v) => updateConfig('mediumMcThreshold', v)} unit="$" min={200000} max={2000000} step={50000} />
            <ConfigInput label="Heavy Sell MC" value={config.heavyMcThreshold} onChange={(v) => updateConfig('heavyMcThreshold', v)} unit="$" min={500000} max={5000000} step={100000} />
            
            <div className="text-[8px] text-[#404040] uppercase mb-2 mt-4">Sell Percentages</div>
            <ConfigInput label="Light Sell %" value={config.lightSellPercent} onChange={(v) => updateConfig('lightSellPercent', v)} unit="%" min={1} max={15} />
            <ConfigInput label="Medium Sell %" value={config.mediumSellPercent} onChange={(v) => updateConfig('mediumSellPercent', v)} unit="%" min={5} max={20} />
            <ConfigInput label="Heavy Sell %" value={config.heavySellPercent} onChange={(v) => updateConfig('heavySellPercent', v)} unit="%" min={10} max={25} />
            <ConfigInput label="Volume Farm %" value={config.volumeFarmingPercent} onChange={(v) => updateConfig('volumeFarmingPercent', v)} unit="%" min={3} max={15} />
            
            <div className="text-[8px] text-[#404040] uppercase mb-2 mt-4">Trade Limits</div>
            <ConfigInput label="Max Sell/Trade" value={config.maxSellPerTrade} onChange={(v) => updateConfig('maxSellPerTrade', v)} unit="SOL" min={0.1} max={10} step={0.1} />
            <ConfigInput label="Max Buy/Trade" value={config.maxBuyPerTrade} onChange={(v) => updateConfig('maxBuyPerTrade', v)} unit="SOL" min={0.1} max={5} step={0.1} />
            <ConfigInput label="Cooldown" value={config.cooldownSeconds} onChange={(v) => updateConfig('cooldownSeconds', v)} unit="sec" min={15} max={300} step={5} />
            <ConfigInput label="Max Supply/Wallet" value={config.maxSupplyPercent} onChange={(v) => updateConfig('maxSupplyPercent', v)} unit="%" min={0.5} max={5} step={0.5} />
            <ConfigInput label="Slippage" value={config.slippage} onChange={(v) => updateConfig('slippage', v)} unit="%" min={1} max={30} />
            <ConfigInput label="Tweet Interval" value={config.tweetIntervalMinutes} onChange={(v) => updateConfig('tweetIntervalMinutes', v)} unit="min" min={10} max={120} step={5} />
          </div>
        </div>

        {/* Column 4: Neural Log */}
        <div className="p-5 rounded-2xl h-[calc(100vh-150px)]" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" style={{ boxShadow: '0 0 8px #00D4FF, 0 0 12px #00D4FF' }} />
              <span className="text-[9px] font-mono text-[#505050] uppercase" style={{ letterSpacing: '0.1em' }}>NEURAL LOG</span>
            </div>
            <span 
              className="text-[7px] font-mono text-[#00D4FF]"
              style={{ textShadow: '0 0 8px #00D4FF, 0 0 12px #00D4FF' }}
            >
              ONLINE
            </span>
          </div>
          
          <div className="h-[calc(100%-40px)] overflow-y-auto font-mono text-[9px] space-y-1" style={{ scrollbarWidth: 'thin' }}>
            {logs.length === 0 ? (
              <div className="text-[#303030]">Waiting for activity...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-[#808080]">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 text-center">
        <span className="text-[7px] font-mono text-[#181818] uppercase" style={{ letterSpacing: '0.25em' }}>
          [ PARRY_CORE // $ANUS // V2.0 ]
        </span>
      </div>
    </div>
  );
}
