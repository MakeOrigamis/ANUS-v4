'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { logError, logDebug } from '@/lib/logger-client';

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: useInterval
// ═══════════════════════════════════════════════════════════════════════════════
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current?.(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Hardware Bolt (CSS radial-gradient 3D silver)
// ═══════════════════════════════════════════════════════════════════════════════
const HardwareBolt = ({ className = '', size = 10 }: { className?: string; size?: number }) => (
  <div
    className={className}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 30% 30%, #F0F0F0 0%, #B0B0B0 25%, #606060 60%, #303030 100%)',
      boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.7)',
    }}
  />
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Chromatic Text (CRT Aberration Effect)
// ═══════════════════════════════════════════════════════════════════════════════
const ChromaticText = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span 
    className={`relative ${className}`}
    style={{
      textShadow: '-0.5px 0 #FF0040, 0.5px 0 #00D4FF',
    }}
  >
    {children}
  </span>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Module Status Header (with Chromatic Aberration)
// ═══════════════════════════════════════════════════════════════════════════════
const ModuleStatus = ({ label = 'OPTIMAL' }: { label?: string }) => (
  <div 
    className="absolute top-6 right-8 text-[8px] font-mono text-[#C0C0C0] opacity-50" 
    style={{ 
      letterSpacing: '0.2em',
      textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF',
    }}
  >
    [ MODULE_STATUS: {label} ]
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Rim Light Panel (rounded-[3.5rem])
// ═══════════════════════════════════════════════════════════════════════════════
const RimLightPanel = ({ 
  children, 
  className = '',
  withBolts = false,
  statusLabel = 'OPTIMAL',
}: { 
  children: React.ReactNode; 
  className?: string;
  withBolts?: boolean;
  statusLabel?: string;
}) => (
  <div 
    className={`relative bg-white/[0.03] backdrop-blur-2xl rounded-[3.5rem] overflow-hidden ${className}`}
    style={{
      borderTop: '1px solid rgba(192,192,192,0.2)',
      borderLeft: '1px solid rgba(192,192,192,0.15)',
      borderRight: '1px solid rgba(192,192,192,0.05)',
      borderBottom: '1px solid rgba(192,192,192,0.05)',
    }}
  >
    <ModuleStatus label={statusLabel} />
    {withBolts && (
      <>
        <HardwareBolt className="absolute top-5 left-5" size={10} />
        <HardwareBolt className="absolute top-5 right-5" size={10} />
        <HardwareBolt className="absolute bottom-5 left-5" size={10} />
        <HardwareBolt className="absolute bottom-5 right-5" size={10} />
      </>
    )}
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Hardware Sidebar (140px)
// ═══════════════════════════════════════════════════════════════════════════════
const HardwareSidebar = ({ 
  activeView, 
  setActiveView,
  navItems,
}: { 
  activeView: string;
  setActiveView: (view: 'dashboard' | 'reserve' | 'terminal' | 'docs') => void;
  navItems: Array<{ id: 'dashboard' | 'reserve' | 'terminal' | 'docs'; icon: string; label: string; href?: string }>;
}) => {
  const activeIndex = navItems.findIndex(item => item.id === activeView);

  return (
    <motion.div
      initial={{ x: -140, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="h-full w-[140px]"
    >
      <div 
        className="relative h-full flex flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.02) 50%, transparent 100%), rgba(0,0,0,0.6)',
          backdropFilter: 'blur(60px)',
          WebkitBackdropFilter: 'blur(60px)',
          borderRight: '1px solid rgba(192,192,192,0.15)',
          borderTopLeftRadius: '3.5rem',
          borderBottomLeftRadius: '3.5rem',
        }}
      >
        {/* Brushed Interface Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.02) 30%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.02) 70%, transparent 100%)',
          }}
        />

        {/* Vertical Scanner Laser Beam */}
        <div 
          className="absolute left-[30px] top-0 bottom-0 w-[2px] pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to bottom, transparent 5%, rgba(0,242,255,0.1) 15%, rgba(0,242,255,0.15) 50%, rgba(0,242,255,0.1) 85%, transparent 95%)',
          }}
        />
        
        {/* Active Position Pulse */}
        <motion.div 
          className="absolute left-[30px] w-[2px] h-16 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to bottom, transparent, #00F2FF, transparent)',
            boxShadow: '0 0 20px #00F2FF, 0 0 40px rgba(0,242,255,0.5)',
          }}
          animate={{
            top: `${130 + activeIndex * 90}px`,
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            top: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          }}
        />

        {/* Hardware Bolts */}
        <HardwareBolt className="absolute top-5 left-5" size={8} />
        <HardwareBolt className="absolute top-5 right-3" size={8} />
        <HardwareBolt className="absolute bottom-5 left-5" size={8} />
        <HardwareBolt className="absolute bottom-5 right-3" size={8} />

        {/* Back Button */}
        <Link
          href="/"
          className="flex items-center justify-center mx-auto mt-8 mb-6 w-10 h-10 rounded-full text-[#606060] hover:text-[#00F2FF] hover:bg-white/5 transition-all border border-white/10 hover:border-[#00F2FF]/30 z-10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Navigation Items */}
        <div className="flex flex-col items-center gap-2 px-2 flex-1 z-10">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            
            const handleClick = (e: React.MouseEvent) => {
              if (item.href) return;
              e.preventDefault();
              setActiveView(item.id);
            };

            const content = (
              <motion.div 
                className="relative flex flex-col items-center gap-2 py-4 px-2 w-full cursor-pointer"
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div 
                  className="relative z-10"
                  animate={{
                    filter: isActive ? 'drop-shadow(0 0 25px rgba(0,242,255,0.9))' : 'none',
                  }}
                >
                  <Image
                    src={item.icon}
                    alt={item.label}
                    width={40}
                    height={40}
                    className="object-contain transition-all duration-300"
                    style={{
                      opacity: isActive ? 1 : 0.35,
                      filter: isActive ? 'brightness(1.2)' : 'grayscale(40%)',
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full -z-10"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 1 }}
                      style={{
                        background: 'radial-gradient(circle, rgba(0,242,255,0.5) 0%, transparent 70%)',
                      }}
                    />
                  )}
                </motion.div>
                
                <div className="flex items-center gap-1.5">
                  <motion.div
                    className="rounded-full"
                    style={{
                      width: 4,
                      height: 4,
                      backgroundColor: isActive ? '#00F2FF' : '#B87333',
                      boxShadow: isActive 
                        ? '0 0 10px #00F2FF, 0 0 20px rgba(0,242,255,0.5)' 
                        : '0 0 4px rgba(184,115,51,0.4)',
                    }}
                    animate={isActive ? {
                      opacity: [1, 0.5, 1],
                      scale: [1, 1.2, 1],
                    } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  
                  <span 
                    className="text-[9px] uppercase font-mono"
                    style={{ 
                      color: isActive ? '#00F2FF' : '#C0C0C0',
                      letterSpacing: '0.3em',
                      textShadow: isActive ? '0 0 12px rgba(0,242,255,0.6)' : 'none',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </motion.div>
            );

            return item.href ? (
              <Link key={item.id} href={item.href} className="w-full">
                {content}
              </Link>
            ) : (
              <div key={item.id} onClick={handleClick} className="w-full">
                {content}
              </div>
            );
          })}
        </div>

        {/* Footer Technical Text with Chromatic Aberration */}
        <div className="px-2 pb-6 pt-4 z-10">
          <div className="text-center font-mono space-y-1" style={{ opacity: 0.3 }}>
            <div 
              className="text-[7px] text-[#C0C0C0] tracking-wider"
              style={{ textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF' }}
            >
              [SYS.NAV // V.8.01]
            </div>
            <div 
              className="text-[6px] text-[#C0C0C0] tracking-wider"
              style={{ textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF' }}
            >
              [SOVEREIGN: ACTIVE]
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Explanation Node (+) with FIXED Popover (z-[9999], solid bg)
// ═══════════════════════════════════════════════════════════════════════════════
const ExplanationNode = ({ 
  title, 
  explanation 
}: { 
  title: string; 
  explanation: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center gap-2">
      <span>{title}</span>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="relative w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
        style={{
          background: 'rgba(0,242,255,0.15)',
          border: '1px solid rgba(0,242,255,0.4)',
        }}
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.95 }}
      >
        <Plus className="w-3 h-3 text-[#00F2FF]" />
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 8px rgba(0,242,255,0.4)',
              '0 0 18px rgba(0,242,255,0.7)',
              '0 0 8px rgba(0,242,255,0.4)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 top-full mt-3 w-80"
            style={{ zIndex: 9999 }}
          >
            <div 
              className="p-5 rounded-[2rem]"
              style={{
                backgroundColor: '#050505',
                border: '1px solid rgba(0,242,255,0.5)',
                boxShadow: '0 25px 80px rgba(0,0,0,0.9), 0 0 60px rgba(0,242,255,0.25)',
              }}
            >
              {/* Header in Digital Cyan */}
              <div 
                className="text-[10px] font-mono uppercase mb-3 text-[#00F2FF]"
                style={{ 
                  letterSpacing: '0.3em',
                  textShadow: '0 0 10px rgba(0,242,255,0.5), -0.3px 0 #FF0040, 0.3px 0 #00D4FF',
                }}
              >
                PARRY_INTEL
              </div>
              <p className="text-[11px] font-mono text-[#C0C0C0] leading-relaxed" style={{ fontWeight: 500 }}>
                {explanation}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Plasma Strike (EMA Cross - Vertical Beam with Radial Ripple)
// ═══════════════════════════════════════════════════════════════════════════════
const PlasmaStrike = ({ x }: { x: number }) => {
  const [rippleKey, setRippleKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRippleKey(k => k + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <g>
      {/* Outer Glow (30px) */}
      <line x1={x} y1="0" x2={x} y2="260" stroke="#00F2FF" strokeWidth="30" opacity="0.08" />
      {/* Mid Glow */}
      <line x1={x} y1="0" x2={x} y2="260" stroke="#00F2FF" strokeWidth="10" opacity="0.15" />
      {/* Bright Core (1px) */}
      <line x1={x} y1="0" x2={x} y2="260" stroke="#00F2FF" strokeWidth="1" opacity="0.9" style={{ filter: 'drop-shadow(0 0 4px #00F2FF)' }} />
      
      {/* Radial Ripple Effect */}
      <motion.circle
        key={rippleKey}
        cx={x}
        cy="130"
        r="5"
        fill="none"
        stroke="#00F2FF"
        strokeWidth="1"
        initial={{ r: 5, opacity: 0.8 }}
        animate={{ r: 40, opacity: 0 }}
        transition={{ duration: 2, ease: 'easeOut' }}
      />
      <motion.circle
        key={`${rippleKey}-2`}
        cx={x}
        cy="130"
        r="5"
        fill="none"
        stroke="#00F2FF"
        strokeWidth="0.5"
        initial={{ r: 5, opacity: 0.6 }}
        animate={{ r: 60, opacity: 0 }}
        transition={{ duration: 2.5, ease: 'easeOut', delay: 0.3 }}
      />
    </g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Fibonacci Probability Field
// ═══════════════════════════════════════════════════════════════════════════════
const FibonacciField = ({ y, level }: { y: number; level: number }) => {
  return (
    <g>
      <defs>
        <pattern id={`hexPattern${level}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="1" fill="#00F2FF" opacity="0.3" />
          <circle cx="20" cy="0" r="1" fill="#00F2FF" opacity="0.3" />
          <circle cx="10" cy="10" r="1" fill="#00F2FF" opacity="0.4" />
          <circle cx="0" cy="20" r="1" fill="#00F2FF" opacity="0.3" />
          <circle cx="20" cy="20" r="1" fill="#00F2FF" opacity="0.3" />
          <line x1="0" y1="0" x2="10" y2="10" stroke="#00F2FF" strokeWidth="0.3" opacity="0.2" />
          <line x1="20" y1="0" x2="10" y2="10" stroke="#00F2FF" strokeWidth="0.3" opacity="0.2" />
          <line x1="0" y1="20" x2="10" y2="10" stroke="#00F2FF" strokeWidth="0.3" opacity="0.2" />
          <line x1="20" y1="20" x2="10" y2="10" stroke="#00F2FF" strokeWidth="0.3" opacity="0.2" />
        </pattern>
      </defs>
      
      <motion.rect
        x="0"
        y={y - 25}
        width="340"
        height="50"
        fill={`url(#hexPattern${level})`}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      <motion.line
        x1="0" y1={y} x2="340" y2={y}
        stroke="#00F2FF"
        strokeWidth="0.5"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: 'drop-shadow(0 0 4px #00F2FF)' }}
      />
      
      <text x="12" y={y - 8} fill="#00F2FF" fontSize="9" fontFamily="monospace" opacity="0.7">
        FIB {level}
      </text>
    </g>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Market Heat Bar (ICE COLORS - Cyan/Blue/Silver/Grey)
// Calculates real sentiment from trades and market data
// ═══════════════════════════════════════════════════════════════════════════════
const MarketHeatBar = () => {
  const [tokenMint, setTokenMint] = useState<string | null>(null);
  const [sentiment, setSentiment] = useState(0.5); // Start neutral
  const [isLoading, setIsLoading] = useState(true);

  // Get token mint from API (fallback to env)
  useEffect(() => {
    const loadTokenMint = async () => {
      try {
        const response = await fetch('/api/dashboard/token-mint');
        const data = await response.json();
        if (data.success && data.tokenMint && data.tokenMint.length > 30) {
          setTokenMint(data.tokenMint);
        } else {
          const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
          if (envMint && envMint.length > 30) {
            setTokenMint(envMint);
          }
        }
      } catch (error) {
        const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
        if (envMint && envMint.length > 30) {
          setTokenMint(envMint);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadTokenMint();
  }, []);

  // Calculate sentiment from real trades
  useEffect(() => {
    if (!tokenMint) return;

    const calculateSentiment = async () => {
      try {
        // Fetch trades, DexScreener, and Moralis holder data in parallel
        const [tradesResponse, dexResponse, holdersResponse] = await Promise.allSettled([
          fetch(`/api/trades?mint=${tokenMint}&limit=50`),
          fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`),
          fetch(`/api/token/sync?mint=${tokenMint}`).then(res => res.ok ? res.json() : null).then(data => {
            // Extract holder data from token sync (which uses Moralis)
            return data?.holderCount ? { totalHolders: data.holderCount } : null;
          }).catch(() => null)
        ]);

        // Process trades (fallback if DexScreener fails)
        let buyCount = 0;
        let sellCount = 0;
        let buyVolume = 0;
        let sellVolume = 0;
        
        if (tradesResponse.status === 'fulfilled' && tradesResponse.value.ok) {
          const tradesData = await tradesResponse.value.json();
          if (tradesData.success && tradesData.trades) {
            const recentTrades = tradesData.trades.slice(0, 20);
            recentTrades.forEach((trade: any) => {
              const solAmount = (trade.sol_amount || 0) / 1e9;
              if (trade.is_buy) {
                buyCount++;
                buyVolume += solAmount;
              } else {
                sellCount++;
                sellVolume += solAmount;
              }
            });
          }
        }

        // Process DexScreener data (PRIORITY: long-term data)
        let dexSentiment = 0.5; // Default neutral
        let hasDexData = false;
        let dexData: any = null; // Store parsed data for reuse

        if (dexResponse.status === 'fulfilled' && dexResponse.value.ok) {
          dexData = await dexResponse.value.json(); // Parse once
          const pair = dexData.pairs?.[0];
          
          if (pair && pair.txns && pair.volume && pair.priceChange) {
            hasDexData = true;
            
            // Extract long-term data (h24, h6) - heavily weighted
            const txns24h = pair.txns.h24 || { buys: 0, sells: 0 };
            const txns6h = pair.txns.h6 || { buys: 0, sells: 0 };
            const txns1h = pair.txns.h1 || { buys: 0, sells: 0 };
            const txns5m = pair.txns.m5 || { buys: 0, sells: 0 };
            
            // Calculate buy/sell ratios for each timeframe
            const total24h = txns24h.buys + txns24h.sells || 1;
            const total6h = txns6h.buys + txns6h.sells || 1;
            const total1h = txns1h.buys + txns1h.sells || 1;
            const total5m = txns5m.buys + txns5m.sells || 1;
            
            const buyRatio24h = txns24h.buys / total24h;
            const buyRatio6h = txns6h.buys / total6h;
            const buyRatio1h = txns1h.buys / total1h;
            const buyRatio5m = txns5m.buys / total5m;
            
            // Weighted buy ratio: 50% h24, 30% h6, 15% h1, 5% m5 (long-term focus)
            const weightedBuyRatio = (
              buyRatio24h * 0.5 +
              buyRatio6h * 0.3 +
              buyRatio1h * 0.15 +
              buyRatio5m * 0.05
            );
            
            // Price change: 60% h24, 30% h6, 10% h1 (ignore m5 for price)
            const priceChange24h = pair.priceChange.h24 || 0;
            const priceChange6h = pair.priceChange.h6 || 0;
            const priceChange1h = pair.priceChange.h1 || 0;
            
            // Normalize price change to 0-1 scale (positive = bullish)
            const priceChangeScore = Math.max(0, Math.min(1, 
              (priceChange24h * 0.6 + priceChange6h * 0.3 + priceChange1h * 0.1) / 100 + 0.5
            ));
            
            // Volume activity: 70% h24, 20% h6, 10% h1 (long-term volume is key)
            const volume24h = pair.volume.h24 || 0;
            const volume6h = pair.volume.h6 || 0;
            const volume1h = pair.volume.h1 || 0;
            const totalVolume = volume24h + volume6h + volume1h;
            
            // Volume score: higher volume = more activity = higher sentiment
            const volumeScore = Math.min(1, totalVolume / 1000000); // Normalize to 1M volume = max
            
            // Combine DexScreener factors:
            // - Buy/Sell Ratio: 40% (long-term weighted)
            // - Price Change: 35% (long-term weighted)
            // - Volume Activity: 25% (long-term weighted)
            dexSentiment = (
              weightedBuyRatio * 0.4 +
              priceChangeScore * 0.35 +
              volumeScore * 0.25
            );
            
            // Long-term bias: if 24h data is positive, boost sentiment
            if (buyRatio24h > 0.5 || priceChange24h > 0) {
              dexSentiment = Math.min(1, dexSentiment + 0.1); // +10% boost for positive long-term trend
            }
          }
        }

        // Use DexScreener data if available (more reliable), otherwise fallback to trades
        // Default to neutral (0.5) if no data available
        let calculatedSentiment: number = 0.5;
        
        if (hasDexData) {
          // Use DexScreener as primary source (long-term focused)
          calculatedSentiment = dexSentiment;
        } else if (buyCount > 0 || sellCount > 0) {
          // Fallback to trades analysis (only if we have trade data)
          const totalTrades = buyCount + sellCount || 1;
          const buyRatio = buyCount / totalTrades;
          const totalVolume = buyVolume + sellVolume || 1;
          const volumeRatio = buyVolume / totalVolume;
          const activityScore = Math.min(1, (buyCount + sellCount) / 20);
          
          calculatedSentiment = (
            buyRatio * 0.4 +
            volumeRatio * 0.4 +
            activityScore * 0.2
          );
        } else {
          // No data available - keep neutral (0.5)
          logDebug('[Market Heat] No data available, using neutral sentiment');
        }

        // Process holder distribution data (from Moralis) - WHALE BOOST
        let whaleBoost = 0;
        let holderDistribution: any = null;
        
        // Only try to fetch if we have an API key (client-side env var)
        const moralisApiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
        if (moralisApiKey && moralisApiKey.length > 0) {
          try {
            const moralisResponse = await fetch(
              `https://solana-gateway.moralis.io/token/mainnet/holders/${tokenMint}`,
              {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'X-API-Key': moralisApiKey,
                },
              }
            );
            
            if (moralisResponse.ok) {
              const moralisData = await moralisResponse.json();
              holderDistribution = moralisData.holderDistribution || moralisData.distribution;
              
              // WHALE BOOST: If more than 15 whales hold, it's a very good sign
              if (holderDistribution?.whales && holderDistribution.whales > 15) {
                // Calculate whale boost: more whales = bigger boost (max +15%)
                const whaleCount = holderDistribution.whales;
                whaleBoost = Math.min(0.15, (whaleCount - 15) * 0.01); // +1% per whale above 15, max +15%
                logDebug('[Market Heat] Whale boost applied', { 
                  whales: whaleCount, 
                  boost: whaleBoost 
                });
              }
            } else {
              // Non-critical error - just log it
              logDebug('[Market Heat] Moralis holders API not OK', { 
                status: moralisResponse.status 
              });
            }
          } catch (e) {
            // Non-critical error - don't break the sentiment calculation
            logDebug('[Market Heat] Could not fetch holder distribution', { 
              error: e instanceof Error ? e.message : String(e) 
            });
          }
        } else {
          logDebug('[Market Heat] Moralis API key not available for holder distribution');
        }

        // OPTIMISTIC BIAS: Make it harder to be bearish
        // Minimum floor: 0.35 (always at least "COPE" level)
        calculatedSentiment = Math.max(0.35, calculatedSentiment);
        
        // Long-term protection: if 24h data exists and is positive, prevent bearish sentiment
        if (hasDexData && dexData) {
          const pair = dexData.pairs?.[0];
          
          if (pair?.txns?.h24) {
            const txns24h = pair.txns.h24;
            const buyRatio24h = txns24h.buys / (txns24h.buys + txns24h.sells || 1);
            const priceChange24h = pair.priceChange?.h24 || 0;
            
            // If 24h trend is positive, ensure sentiment stays high
            if (buyRatio24h > 0.5 || priceChange24h > 0) {
              calculatedSentiment = Math.max(calculatedSentiment, 0.5); // Minimum 50% if long-term is positive
            }
          }
        }
        
        // WHALE BOOST: Apply whale boost (whales > 15 = very bullish signal)
        if (whaleBoost > 0) {
          calculatedSentiment = Math.min(1, calculatedSentiment + whaleBoost);
          logDebug('[Market Heat] Sentiment boosted by whales', { 
            before: calculatedSentiment - whaleBoost, 
            after: calculatedSentiment,
            whales: holderDistribution?.whales 
          });
        }
        
        // Boost sentiment if there's any positive activity
        if (buyCount > 0 || buyVolume > 0 || (hasDexData && dexSentiment > 0.5)) {
          calculatedSentiment = Math.min(1, calculatedSentiment + 0.1); // +10% boost
        }

        // Smooth transition (avoid sudden jumps from short-term fluctuations)
      setSentiment(prev => {
          const diff = calculatedSentiment - prev;
          // Use smaller step (20%) to prevent short-term volatility from affecting long-term sentiment
          return prev + diff * 0.2;
        });
        
        setIsLoading(false);
      } catch (error) {
        // Log error with more details
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        logError('Error calculating market sentiment', error as Error, {
          errorMessage,
          errorStack,
          tokenMint: tokenMint?.slice(0, 20) + '...',
        });
        
        // Set a default neutral sentiment on error to prevent UI breaking
        setSentiment(0.5);
        setIsLoading(false);
      }
    };

    calculateSentiment();
    const interval = setInterval(calculateSentiment, 15000); // Update every 15 seconds
    return () => clearInterval(interval);
  }, [tokenMint]);

  // Meme labels - ICE COLORS ONLY (cyan/blue/silver/grey)
  // Adjusted thresholds to make bearish harder to reach
  const getMemeLabel = (value: number) => {
    if (value < 0.15) return { text: 'ROPES', color: '#404040' };      // Dark grey (fear) - very rare now
    if (value < 0.35) return { text: 'BEARISH', color: '#606060' };    // Medium grey - harder to reach
    if (value < 0.6) return { text: 'COPE', color: '#C0C0C0' };       // Silver (neutral)
    if (value < 0.8) return { text: 'COMFY', color: '#00B8D4' };      // Light cyan
    return { text: 'MOON', color: '#00F2FF' };                         // Bright cyan (greed)
  };

  const label = getMemeLabel(sentiment);
  const percentage = (sentiment * 100).toFixed(0);

  return (
    <div className="w-full px-4">
      {/* Header Label */}
      <div className="flex items-center justify-between mb-4">
        <div 
          className="text-[9px] text-[#C0C0C0] uppercase font-mono"
          style={{ letterSpacing: '0.4em', textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF' }}
        >
          MARKET HEAT
        </div>
        {isLoading ? (
          <div className="text-[10px] text-[#606060] font-mono">
            LOADING...
          </div>
        ) : (
        <motion.div
          className="text-[14px] font-mono uppercase font-bold"
          style={{ 
            color: label.color,
            textShadow: `0 0 20px ${label.color}, -0.5px 0 #FF0040, 0.5px 0 #00D4FF`,
          }}
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          [ {label.text} ]
        </motion.div>
        )}
      </div>
      
      {/* Heat Bar Container */}
      <div 
        className="relative h-8 rounded-full overflow-hidden"
        style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
        }}
      >
        {/* ICE Liquid Gradient Background - Dark Grey to Cyan */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #202020 0%, #404040 20%, #808080 40%, #C0C0C0 50%, #00B8D4 75%, #00F2FF 100%)',
            opacity: 0.7,
          }}
        />
        
        {/* Glass Overlay */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)',
          }}
        />
        
        {/* Vertical Laser Indicator */}
        <motion.div
          className="absolute top-0 bottom-0 w-1"
          style={{
            left: `${sentiment * 100}%`,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, transparent, #FFFFFF, transparent)',
            boxShadow: `0 0 15px #FFFFFF, 0 0 30px #00F2FF, 0 0 50px #00F2FF`,
          }}
          animate={{
            opacity: [0.8, 1, 0.8],
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
        
        {/* Indicator Glow Circle */}
        <motion.div
          className="absolute top-1/2 w-4 h-4 rounded-full"
          style={{
            left: `${sentiment * 100}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#FFFFFF',
            boxShadow: `0 0 20px #00F2FF, 0 0 40px #00F2FF`,
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </div>
      
      {/* Scale Labels - ICE COLORS */}
      <div className="flex justify-between mt-2 text-[8px] font-mono" style={{ opacity: 0.5 }}>
        <span className="text-[#606060]">FEAR</span>
        <span className="text-[#C0C0C0]">NEUTRAL</span>
        <span className="text-[#00F2FF]">GREED</span>
      </div>
      
      {/* Percentage Display */}
      <div className="text-center mt-3">
        <span 
          className="text-[24px] font-mono font-bold"
          style={{ 
            color: label.color,
            textShadow: `0 0 30px ${label.color}`,
          }}
        >
          {percentage}%
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Central Neural Core (HERO - h-[55vh] scale)
// ═══════════════════════════════════════════════════════════════════════════════
const NeuralCore = ({ 
  mouseX, 
  mouseY, 
  isPulsing,
  distanceToCenter,
}: { 
  mouseX: any; 
  mouseY: any; 
  isPulsing: boolean;
  distanceToCenter: number;
}) => {
  const rotateX = useTransform(mouseY, [0, 1], [15, -15]);
  const rotateY = useTransform(mouseX, [0, 1], [-15, 15]);
  const smoothRotateX = useSpring(rotateX, { stiffness: 25, damping: 25 });
  const smoothRotateY = useSpring(rotateY, { stiffness: 25, damping: 25 });
  const glowIntensity = Math.max(0.3, 1 - distanceToCenter);

  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        style={{ 
          width: '55vh', 
          height: '55vh',
          minWidth: '400px',
          minHeight: '400px',
          maxWidth: '600px',
          maxHeight: '600px',
          rotateX: smoothRotateX, 
          rotateY: smoothRotateY, 
          transformStyle: 'preserve-3d',
        }}
        animate={{ scale: isPulsing ? 1.02 : 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative flex-shrink-0"
      >
        {/* Massive Cyan Shadow */}
        <motion.div 
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: isPulsing 
              ? `0 0 ${200 * glowIntensity}px rgba(0,242,255,${0.6 * glowIntensity}), 0 0 ${350 * glowIntensity}px rgba(0,242,255,${0.3 * glowIntensity})`
              : `0 0 ${150 * glowIntensity}px rgba(0,242,255,${0.4 * glowIntensity}), 0 0 ${280 * glowIntensity}px rgba(0,242,255,${0.2 * glowIntensity})`,
          }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Glass Sphere */}
        <div 
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 50%)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: 'inset 0 0 100px rgba(0,242,255,0.1)',
          }}
        >
          <video
            src="/substrate-core.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover rounded-full"
            style={{ filter: 'saturate(1.15) contrast(1.05) brightness(0.9)' }}
            onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
          />
          
          <div 
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, rgba(0,0,0,0.25) 100%)',
            }}
          />
        </div>
        
        {/* Hardware Bolts */}
        <HardwareBolt className="absolute -top-1 left-1/2 -translate-x-1/2" size={12} />
        <HardwareBolt className="absolute -bottom-1 left-1/2 -translate-x-1/2" size={12} />
        <HardwareBolt className="absolute top-1/2 -left-1 -translate-y-1/2" size={12} />
        <HardwareBolt className="absolute top-1/2 -right-1 -translate-y-1/2" size={12} />
      </motion.div>
      
      {/* Neural Hub Label with Chromatic Aberration */}
      <div className="mt-4 text-center">
        <span 
          className="text-[9px] font-mono uppercase text-[#C0C0C0]"
          style={{ 
            letterSpacing: '0.5em', 
            opacity: 0.6,
            textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF',
          }}
        >
          RADIAL NEURAL HUB
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Global Trades Panel (FULL HEIGHT - Real $ANUS trades)
// Fetches real trades from pump.fun when token is configured
// ═══════════════════════════════════════════════════════════════════════════════
const GlobalTradesPanel = () => {
  const [trades, setTrades] = useState<Array<{
    time: string;
    type: 'BUY' | 'SELL';
    volume: string;
    usd: string;
  }>>([]);
  const [isWaiting, setIsWaiting] = useState(true);
  const [tokenMint, setTokenMint] = useState<string | null>(null);

  // Check for token mint address (from API, fallback to env)
  useEffect(() => {
    const loadTokenMint = async () => {
      try {
        // Try to get from API first (database)
        const response = await fetch('/api/dashboard/token-mint');
        const data = await response.json();
        
        if (data.success && data.tokenMint && data.tokenMint.length > 30) {
          console.log('[Dashboard] Token mint from', data.source, ':', data.tokenMint.slice(0, 20) + '...');
          setTokenMint(data.tokenMint);
          setIsWaiting(false);
          return;
        }
        
        // Fallback to environment variable
        const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
        if (envMint && envMint.length > 30) {
          console.log('[Dashboard] Token mint from environment:', envMint.slice(0, 20) + '...');
          setTokenMint(envMint);
      setIsWaiting(false);
    } else {
          console.warn('[Dashboard] No valid token mint found');
      setIsWaiting(true);
    }
      } catch (error) {
        console.error('[Dashboard] Error loading token mint:', error);
        // Fallback to env
        const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
        if (envMint && envMint.length > 30) {
          setTokenMint(envMint);
          setIsWaiting(false);
        } else {
          setIsWaiting(true);
        }
      }
    };
    
    loadTokenMint();
  }, []);

  // Fetch real trades from pump.fun
  useEffect(() => {
    if (!tokenMint) return;

    const fetchTrades = async () => {
      try {
        console.log('[Dashboard] Fetching trades for token:', tokenMint);
        
        // Use our API endpoint with fallbacks
        const response = await fetch(`/api/trades?mint=${tokenMint}&limit=20`);
        console.log('[Dashboard] Trade fetch response:', { status: response.status, ok: response.ok });
        
        if (response.ok) {
          const result = await response.json();
          console.log('[Dashboard] Received trades data:', { 
            success: result.success, 
            count: result.trades?.length || 0, 
            source: result.source 
          });
          
          if (result.success && result.trades && result.trades.length > 0) {
            const formattedTrades = result.trades.map((trade: any) => ({
            time: new Date(trade.timestamp).toLocaleTimeString('en-US', { hour12: false }),
            type: trade.is_buy ? 'BUY' : 'SELL' as 'BUY' | 'SELL',
            volume: (trade.token_amount / 1e6).toFixed(0),
            usd: `$${((trade.sol_amount / 1e9) * 180).toFixed(2)}`, // Approximate SOL price
          }));
          setTrades(formattedTrades);
          } else if (result.message) {
            console.warn('[Dashboard]', result.message);
            // Show empty state or message
            setTrades([]);
          } else {
            console.warn('[Dashboard] No trades in response');
            setTrades([]);
          }
        } else {
          const errorText = await response.text().catch(() => 'Unable to read error response');
          let errorData: any = {};
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || 'Unknown error' };
          }
          console.error('[Dashboard] Trade fetch failed:', { 
            status: response.status, 
            statusText: response.statusText,
            error: errorData.error || errorData.message || errorText,
            fullError: errorData
          });
          setTrades([]);
        }
      } catch (error) {
        console.error('[Dashboard] Trade fetch error:', error);
        logError('Error fetching trades', error as Error);
        setTrades([]);
      }
    };

    fetchTrades();
    const interval = setInterval(fetchTrades, 10000); // Refresh every 10 seconds (to avoid Helius rate limits)
    return () => clearInterval(interval);
  }, [tokenMint]);

  // Show waiting state placeholder trades
  useEffect(() => {
    if (isWaiting) {
      setTrades([
        { time: '--:--:--', type: 'BUY', volume: '---', usd: '$---' },
        { time: '--:--:--', type: 'SELL', volume: '---', usd: '$---' },
        { time: '--:--:--', type: 'BUY', volume: '---', usd: '$---' },
      ]);
    }
  }, [isWaiting]);

  return (
    <RimLightPanel className="h-full p-6" withBolts statusLabel={isWaiting ? 'AWAITING TOKEN' : 'STREAMING'}>
      <h3 className="text-[10px] text-[#C0C0C0] uppercase tracking-[0.4em] mb-4 mt-4">
        <ExplanationNode 
          title="MARKET NEXUS"
          explanation={isWaiting 
            ? "Waiting for $ANUS token address. Add NEXT_PUBLIC_ANUS_TOKEN_MINT to .env to enable live trading data."
            : "Real-time trade aggregation from pump.fun. Green (#00FF41) indicates buys, magenta indicates sells. Live $ANUS trading activity."
          }
        />
      </h3>
      
      {isWaiting && (
        <div className="text-center py-8 text-[10px] text-[#404040] font-mono">
          <div className="mb-2">⏳ AWAITING $ANUS TOKEN</div>
          <div className="text-[8px]">Set NEXT_PUBLIC_ANUS_TOKEN_MINT in .env</div>
        </div>
      )}
      
      {/* Header labels with Chromatic Aberration */}
      <div 
        className="grid grid-cols-4 gap-2 text-[8px] text-[#C0C0C0] uppercase mb-3 pb-2 border-b border-white/5" 
        style={{ letterSpacing: '0.3em', textShadow: '-0.2px 0 #FF0040, 0.2px 0 #00D4FF' }}
      >
        <span>TIME</span>
        <span>TYPE</span>
        <span>VOLUME</span>
        <span>USD</span>
      </div>
      
      {/* Full Height Trade Feed */}
      <div className="space-y-1.5 overflow-hidden flex-1" style={{ maxHeight: 'calc(100% - 80px)' }}>
        {trades.map((trade, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1 - (i * 0.03), x: 0 }}
            className="grid grid-cols-4 gap-2 text-[9px] font-mono"
          >
            <span className="text-[#808080]">{trade.time}</span>
            <span className={trade.type === 'BUY' ? 'text-[#00FF41]' : 'text-[#FF00FF]'}>
              {trade.type}
            </span>
            <span className="text-[#00F2FF]" style={{ textShadow: '0 0 8px rgba(0,242,255,0.3)' }}>{trade.volume}</span>
            <span className="text-[#00F2FF]" style={{ textShadow: '0 0 8px rgba(0,242,255,0.3)' }}>{trade.usd}</span>
          </motion.div>
        ))}
      </div>
    </RimLightPanel>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Strategy Chart Panel (Real Technical Indicators)
// ═══════════════════════════════════════════════════════════════════════════════
const StrategyChartPanel = () => {
  const [tokenMint, setTokenMint] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get token mint from API (fallback to env)
  useEffect(() => {
    const loadTokenMint = async () => {
      try {
        const response = await fetch('/api/dashboard/token-mint');
        const data = await response.json();
        if (data.success && data.tokenMint && data.tokenMint.length > 30) {
          setTokenMint(data.tokenMint);
        } else {
          const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
          if (envMint && envMint.length > 30) {
            setTokenMint(envMint);
          } else {
            setIsLoading(false);
            setError('No token configured');
          }
        }
      } catch (error) {
        const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
        if (envMint && envMint.length > 30) {
          setTokenMint(envMint);
        } else {
          setIsLoading(false);
          setError('No token configured');
        }
      }
    };
    loadTokenMint();
  }, []);

  // Fetch indicators
  useEffect(() => {
    if (!tokenMint) return;

    const fetchIndicators = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/indicators?mint=${tokenMint}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.indicators) {
            setIndicators(data.indicators);
          } else {
            setError(data.error || 'No indicators available');
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          setError(errorData.error || 'Failed to fetch indicators');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch indicators');
        logError('Error fetching indicators', err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIndicators();
    const interval = setInterval(fetchIndicators, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [tokenMint]);

  // Calculate chart dimensions and scaling
  const chartWidth = 340;
  const chartHeight = 260;
  const padding = 20;

  // Helper function to calculate EMA array (for each candle)
  const calculateEMAArray = useCallback((prices: number[], period: number): number[] => {
    if (prices.length === 0) return [];
    if (prices.length < period) {
      // Not enough data, return SMA for available data
      const sma = prices.reduce((a, b) => a + b, 0) / prices.length;
      return prices.map(() => sma);
    }
    
    const multiplier = 2 / (period + 1);
    const emaArray: number[] = [];
    
    // Start with SMA for first period
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    // Fill first period-1 values with first EMA value
    for (let i = 0; i < period - 1; i++) {
      emaArray.push(ema);
    }
    
    // Calculate EMA for each subsequent price
    for (let i = period - 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
      emaArray.push(ema);
    }
    
    return emaArray;
  }, []);

  // Prepare chart data from indicators
  const chartData = useMemo(() => {
    if (!indicators || !indicators.rawCandles || indicators.rawCandles.length === 0) {
      return null;
    }

    const candles = indicators.rawCandles.slice(-50); // Last 50 candles
    const prices = candles.map((c: any) => c.close);
    
    // Calculate EMA arrays for each candle
    const ema9Array = calculateEMAArray(prices, 9);
    const ema21Array = calculateEMAArray(prices, 21);
    const ema50Array = calculateEMAArray(prices, 50);
    
    // Include EMAs in price range calculation
    const allPrices = [
      ...prices,
      ...ema9Array,
      ...ema21Array,
      ...ema50Array,
      indicators.fibLow || prices[0],
      indicators.fibHigh || prices[prices.length - 1],
    ];
    
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;

    return {
      candles,
      prices,
      ema9Array,
      ema21Array,
      ema50Array,
      minPrice,
      maxPrice,
      priceRange,
      // Scale prices to chart coordinates
      scaleY: (price: number) => {
        const normalized = (price - minPrice) / priceRange;
        return chartHeight - padding - (normalized * (chartHeight - padding * 2));
      },
      scaleX: (index: number) => {
        return padding + (index / (candles.length - 1)) * (chartWidth - padding * 2);
      },
    };
  }, [indicators, calculateEMAArray]);

  // Calculate Fibonacci levels
  const fibLevels = useMemo(() => {
    if (!chartData || !indicators) return [];

    const { scaleY } = chartData;
    return [
      { level: 0.382, y: scaleY(indicators.fib382), label: '38.2%' },
      { level: 0.618, y: scaleY(indicators.fib618), label: '61.8%' },
    ];
  }, [chartData, indicators]);

  // Detect EMA crossovers for plasma strikes (find actual crossover points)
  const plasmaStrikes = useMemo(() => {
    if (!chartData || !chartData.ema9Array || !chartData.ema21Array) return [];

    const strikes: number[] = [];
    
    // Find where EMA9 crosses EMA21
    for (let i = 1; i < chartData.ema9Array.length; i++) {
      const prevEma9Above = chartData.ema9Array[i - 1] > chartData.ema21Array[i - 1];
      const currEma9Above = chartData.ema9Array[i] > chartData.ema21Array[i];
      
      // Crossover detected
      if (prevEma9Above !== currEma9Above) {
        const x = chartData.scaleX(i);
        strikes.push(x);
      }
    }

    return strikes;
  }, [chartData]);

  return (
    <RimLightPanel className="h-full p-6" withBolts statusLabel={isLoading ? 'LOADING' : indicators ? 'ANALYZING' : 'WAITING'}>
      <h3 className="text-[10px] text-[#C0C0C0] uppercase tracking-[0.4em] mb-4 mt-4">
        <ExplanationNode 
          title="TECHNICAL STRATEGY"
          explanation={indicators 
            ? `EMA9: $${indicators.ema9?.toFixed(8) || '---'}, EMA21: $${indicators.ema21?.toFixed(8) || '---'}, RSI: ${indicators.rsi14?.toFixed(1) || '---'}. Golden Pocket: ${indicators.inGoldenPocket ? 'YES' : 'NO'}. Trend: ${indicators.trend || 'UNKNOWN'}.`
            : "PLASMA STRIKES: Vertical beams mark EMA convergence events. FIBONACCI FIELDS: Hexagonal interference patterns at 0.382 and 0.618 Golden Ratio zones derived from natural mathematical harmony."
          }
        />
      </h3>
      
      {isLoading && (
        <div className="flex items-center justify-center h-[260px] text-[10px] text-[#606060] font-mono">
          LOADING INDICATORS...
        </div>
      )}

      {error && !isLoading && (
        <div className="flex items-center justify-center h-[260px] text-[10px] text-red-400 font-mono">
          {error}
        </div>
      )}

      {!isLoading && !error && chartData && indicators && (
        <>
      <div className="relative h-[260px] mt-2">
            <svg className="w-full h-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
          <defs>
                <filter id="glow-strategy" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
              {/* Fibonacci Fields */}
          {fibLevels.map((fib, i) => (
            <FibonacciField key={i} y={fib.y} level={fib.level} />
          ))}
          
              {/* Candlesticks */}
              {chartData.candles.map((candle: any, i: number) => {
                const x = chartData.scaleX(i);
                const candleWidth = (chartWidth - padding * 2) / chartData.candles.length * 0.8;
                const openY = chartData.scaleY(candle.open);
                const closeY = chartData.scaleY(candle.close);
                const highY = chartData.scaleY(candle.high);
                const lowY = chartData.scaleY(candle.low);
                const isBullish = candle.close >= candle.open;
                
                return (
                  <g key={i}>
                    {/* Wick */}
                    <line
                      x1={x}
                      y1={highY}
                      x2={x}
                      y2={lowY}
                      stroke={isBullish ? "#00FF41" : "#FF00FF"}
                      strokeWidth="1"
                      opacity="0.6"
                    />
                    {/* Body */}
                    <rect
                      x={x - candleWidth / 2}
                      y={Math.min(openY, closeY)}
                      width={candleWidth}
                      height={Math.abs(closeY - openY) || 1}
                      fill={isBullish ? "#00FF41" : "#FF00FF"}
                      opacity="0.4"
                    />
                  </g>
                );
              })}
              
              {/* EMA9 Line (Curve) */}
              {chartData.ema9Array.length > 0 && (
          <path
                  d={`M ${chartData.ema9Array.map((ema: number, i: number) => {
                    const x = chartData.scaleX(i);
                    const y = chartData.scaleY(ema);
                    return `${x} ${y}`;
                  }).join(' L ')}`}
                  fill="none"
                  stroke="#00FF88"
                  strokeWidth="1.5"
                  opacity="0.8"
                  strokeDasharray="3,3"
                />
              )}
              
              {/* EMA21 Line (Curve) */}
              {chartData.ema21Array.length > 0 && (
                <path
                  d={`M ${chartData.ema21Array.map((ema: number, i: number) => {
                    const x = chartData.scaleX(i);
                    const y = chartData.scaleY(ema);
                    return `${x} ${y}`;
                  }).join(' L ')}`}
                  fill="none"
                  stroke="#FFA500"
                  strokeWidth="1.5"
                  opacity="0.8"
                  strokeDasharray="4,4"
                />
              )}
              
              {/* EMA50 Line (Curve) */}
              {chartData.ema50Array.length > 0 && (
                <path
                  d={`M ${chartData.ema50Array.map((ema: number, i: number) => {
                    const x = chartData.scaleX(i);
                    const y = chartData.scaleY(ema);
                    return `${x} ${y}`;
                  }).join(' L ')}`}
                  fill="none"
                  stroke="#FF00FF"
                  strokeWidth="1.5"
                  opacity="0.7"
                  strokeDasharray="6,6"
                />
              )}
              
              {/* Price Line (overlay for visibility) */}
              <path
                d={`M ${chartData.candles.map((candle: any, i: number) => {
                  const x = chartData.scaleX(i);
                  const y = chartData.scaleY(candle.close);
                  return `${x} ${y}`;
                }).join(' L ')}`}
            fill="none" 
            stroke="#00F2FF" 
                strokeWidth="1.5" 
                opacity="0.6" 
                filter="url(#glow-strategy)"
              />
              
              {/* Plasma Strikes (EMA Crossovers) */}
          {plasmaStrikes.map((x, i) => (
            <PlasmaStrike key={i} x={x} />
          ))}
        </svg>
      </div>
      
          {/* Indicator Stats */}
          <div className="mt-3 space-y-2">
      <div 
              className="flex items-center justify-between text-[8px] text-[#606060] uppercase tracking-wider mb-2"
        style={{ textShadow: '-0.2px 0 #FF0040, 0.2px 0 #00D4FF' }}
      >
        <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-[#00FF88]" style={{ boxShadow: '0 0 8px rgba(0,255,136,0.6)' }} />
                <span>EMA9</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-[#FFA500]" style={{ boxShadow: '0 0 8px rgba(255,165,0,0.6)' }} />
                <span>EMA21</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-[#FF00FF]" style={{ boxShadow: '0 0 8px rgba(255,0,255,0.6)' }} />
                <span>EMA50</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 relative">
            <svg viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="2" fill="#00F2FF" opacity="0.5" />
              <line x1="5" y1="5" x2="10" y2="10" stroke="#00F2FF" strokeWidth="0.5" opacity="0.4" />
              <line x1="15" y1="5" x2="10" y2="10" stroke="#00F2FF" strokeWidth="0.5" opacity="0.4" />
            </svg>
          </div>
                <span>FIB</span>
        </div>
      </div>
            
            {indicators && (
              <div className="grid grid-cols-3 gap-2 text-[7px] text-[#808080] font-mono">
                <div>
                  <span className="text-[#606060]">RSI:</span> <span className={indicators.rsi14 > 70 ? 'text-red-400' : indicators.rsi14 < 30 ? 'text-green-400' : ''}>{indicators.rsi14?.toFixed(1) || '---'}</span>
                </div>
                <div>
                  <span className="text-[#606060]">TREND:</span> <span className={
                    indicators.trend === 'strong_bull' ? 'text-green-400' :
                    indicators.trend === 'bull' ? 'text-green-300' :
                    indicators.trend === 'strong_bear' ? 'text-red-400' :
                    indicators.trend === 'bear' ? 'text-red-300' : ''
                  }>{(indicators.trend || 'UNKNOWN').toUpperCase().replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-[#606060]">GOLDEN:</span> <span className={indicators.inGoldenPocket ? 'text-[#FFA500]' : ''}>{indicators.inGoldenPocket ? 'YES' : 'NO'}</span>
                </div>
              </div>
            )}
            
            {indicators && chartData && (
              <div className="text-[6px] text-[#606060] font-mono mt-1 pt-1 border-t border-white/5">
                <div className="grid grid-cols-2 gap-1">
                  <div>Price: <span className="text-[#00F2FF]">${indicators.currentPrice?.toExponential(3) || '---'}</span></div>
                  <div>vs EMA9: <span className={indicators.priceVsEma9 > 0 ? 'text-green-400' : 'text-red-400'}>{indicators.priceVsEma9 > 0 ? '+' : ''}{indicators.priceVsEma9?.toFixed(2) || '---'}%</span></div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </RimLightPanel>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Reserve View
// ═══════════════════════════════════════════════════════════════════════════════
const ReserveView = () => {
  const [tokenMint, setTokenMint] = useState<string | null>(null);
  const [holderCount, setHolderCount] = useState<number | null>(null);
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null);
  const [marketCap, setMarketCap] = useState<number | null>(null);
  const [liquidity, setLiquidity] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get token mint from API (fallback to env)
  useEffect(() => {
    const loadTokenMint = async () => {
      try {
        const response = await fetch('/api/dashboard/token-mint');
        const data = await response.json();
        if (data.success && data.tokenMint && data.tokenMint.length > 30) {
          setTokenMint(data.tokenMint);
        } else {
          const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
          if (envMint && envMint.length > 30) {
            setTokenMint(envMint);
          } else {
            setIsLoading(false);
          }
        }
      } catch (error) {
        const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
        if (envMint && envMint.length > 30) {
          setTokenMint(envMint);
        } else {
          setIsLoading(false);
        }
      }
    };
    loadTokenMint();
  }, []);

  // Fetch token data (holders, price change, market cap)
  useEffect(() => {
    if (!tokenMint) return;

    const fetchTokenData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/token/sync?mint=${tokenMint}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Set holder count
            if (data.holderCount !== undefined) {
              setHolderCount(data.holderCount);
            }
            
            // Set 24h price change from tokenData
            if (data.tokenData?.priceChange24h !== undefined) {
              setPriceChange24h(data.tokenData.priceChange24h);
            }
            
            // Set market cap from tokenData
            if (data.tokenData?.usd_market_cap !== undefined) {
              setMarketCap(data.tokenData.usd_market_cap);
            }
            
            // Set liquidity from tokenData
            if (data.tokenData?.liquidityUsd !== undefined) {
              setLiquidity(data.tokenData.liquidityUsd);
            }
          }
        }
      } catch (error) {
        logError('Error fetching reserve data', error as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokenData();
    const interval = setInterval(fetchTokenData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [tokenMint]);

  // Format market cap for display
  const formatMarketCap = (mc: number | null): string => {
    if (mc === null || mc === undefined) return '---';
    if (mc >= 1000000) return `$${(mc / 1000000).toFixed(2)}M`;
    if (mc >= 1000) return `$${(mc / 1000).toFixed(2)}K`;
    return `$${mc.toFixed(2)}`;
  };

  // Format 24h price change for display
  const formatPriceChange = (change: number | null): string => {
    if (change === null || change === undefined) return '---';
    const sign = change >= 0 ? '+' : '';
    const color = change >= 0 ? '#00FF41' : '#FF00FF';
    return `${sign}${change.toFixed(2)}%`;
  };

  // Format holder count
  const formatHolders = (count: number | null): string => {
    if (count === null || count === undefined) return '---';
    return count.toLocaleString();
  };

  // Format liquidity for display
  const formatLiquidity = (liq: number | null): string => {
    if (liq === null || liq === undefined || liq === 0) return '---';
    if (liq >= 1000000) return `$${(liq / 1000000).toFixed(2)}M`;
    if (liq >= 1000) return `$${(liq / 1000).toFixed(2)}K`;
    return `$${liq.toFixed(2)}`;
  };

  return (
    <RimLightPanel className="w-full max-w-3xl p-10" withBolts statusLabel={isLoading ? 'LOADING' : 'SECURED'}>
    <h2 
      className="text-[12px] text-[#C0C0C0] uppercase mb-8 mt-4" 
      style={{ letterSpacing: '0.5em', textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF' }}
    >
      DETERMINISTIC RESERVE
    </h2>
    <div className="grid grid-cols-2 gap-6">
      {[
          { label: 'HOLDERS', value: formatHolders(holderCount), color: '#00F2FF' },
          { label: '24H CHANGE', value: formatPriceChange(priceChange24h), color: priceChange24h !== null && priceChange24h >= 0 ? '#00FF41' : priceChange24h !== null ? '#FF00FF' : '#00F2FF' },
          { label: 'MARKET CAP', value: formatMarketCap(marketCap), color: '#00F2FF' },
          { label: 'LIQUIDITY POOLS', value: formatLiquidity(liquidity), color: '#00F2FF' },
      ].map((item, i) => (
        <div key={i} className="p-5 bg-white/[0.02] rounded-[2.5rem]">
          <div className="text-[9px] text-[#606060] uppercase tracking-wider mb-2">{item.label}</div>
            <div className="text-3xl font-mono" style={{ color: item.color, textShadow: `0 0 25px ${item.color}80` }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  </RimLightPanel>
);
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Terminal View
// ═══════════════════════════════════════════════════════════════════════════════
const TerminalView = () => {
  const [commands] = useState<string[]>([
    '$ parry --status',
    'PARRY_SYSTEM: ONLINE',
    '$ parry --check-alignment',
    'PROTOCOL_ALIGNMENT: READY',
    '$ parry --treasury-balance',
  ]);

  return (
    <RimLightPanel className="w-full max-w-3xl p-8" withBolts statusLabel="TERMINAL">
      <h2 
        className="text-[12px] text-[#C0C0C0] uppercase mb-6 mt-4" 
        style={{ letterSpacing: '0.5em', textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF' }}
      >
        SUBSTRATE TERMINAL
      </h2>
      <div className="bg-black/40 rounded-[2.5rem] p-6 font-mono text-[11px] text-[#C0C0C0] h-[300px] overflow-y-auto">
        {commands.map((cmd, i) => (
          <div key={i} className={cmd.startsWith('$') ? 'text-[#00F2FF]' : 'text-[#808080]'}>
            {cmd}
          </div>
        ))}
        <div className="flex items-center gap-1 mt-3">
          <span className="text-[#00F2FF]">$</span>
          <motion.span
            className="w-2 h-4 bg-[#00F2FF]"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </div>
      </div>
    </RimLightPanel>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Holographic Terminal (Right Panel - FIXED 280px)
// Real-time PARRY neural log - fetches from /api/parry and token data
// ═══════════════════════════════════════════════════════════════════════════════
const HolographicTerminal = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [parryStatus, setParryStatus] = useState<'offline' | 'running' | 'waiting'>('waiting');
  const [tokenMint, setTokenMint] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<any>(null);
  const [largeTrades, setLargeTrades] = useState<Array<{type: 'BUY' | 'SELL', amount: number, time: string}>>([]);
  const [lastTradeTimestamp, setLastTradeTimestamp] = useState<number>(0);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Get token mint from API (fallback to env)
  useEffect(() => {
    const loadTokenMint = async () => {
      try {
        const response = await fetch('/api/dashboard/token-mint');
        const data = await response.json();
        if (data.success && data.tokenMint && data.tokenMint.length > 30) {
          setTokenMint(data.tokenMint);
        } else {
          const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
          if (envMint && envMint.length > 30) {
            setTokenMint(envMint);
          }
        }
      } catch (error) {
        const envMint = process.env.NEXT_PUBLIC_ANUS_TOKEN_MINT;
        if (envMint && envMint.length > 30) {
          setTokenMint(envMint);
        }
      }
    };
    loadTokenMint();
  }, []);

  // Fetch token data
  useEffect(() => {
    if (!tokenMint) return;

    const fetchTokenData = async () => {
      try {
        const response = await fetch(`/api/token/sync?mint=${tokenMint}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.tokenData) {
            setTokenData(data.tokenData);
          }
        }
      } catch (error) {
        // Ignore errors
      }
    };

    fetchTokenData();
    const interval = setInterval(fetchTokenData, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [tokenMint]);

  // Fetch large trades
  useEffect(() => {
    if (!tokenMint) return;

    const fetchLargeTrades = async () => {
      try {
        const response = await fetch(`/api/trades?mint=${tokenMint}&limit=50`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.trades && data.trades.length > 0) {
            // Initialize lastTradeTimestamp on first load (use newest trade timestamp)
            if (lastTradeTimestamp === 0) {
              const newestTrade = data.trades.reduce((newest: any, current: any) => 
                (current.timestamp || 0) > (newest.timestamp || 0) ? current : newest
              );
              if (newestTrade.timestamp) {
                setLastTradeTimestamp(newestTrade.timestamp);
                return; // Don't show old trades on first load
              }
            }

            // Filter for large trades (> 0.5 SOL) and only new ones
            const large = data.trades
              .filter((trade: any) => {
                const solAmount = (trade.sol_amount || 0) / 1e9;
                const isNew = trade.timestamp > lastTradeTimestamp;
                return solAmount >= 0.5 && isNew;
              })
              .map((trade: any) => {
                const solAmount = (trade.sol_amount || 0) / 1e9;
                const time = new Date(trade.timestamp).toLocaleTimeString('en-US', { 
                  hour12: false, 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit'
                });
                return {
                  type: trade.is_buy ? 'BUY' as const : 'SELL' as const,
                  amount: solAmount,
                  time,
                  timestamp: trade.timestamp,
                };
              })
              .sort((a: any, b: any) => b.timestamp - a.timestamp); // Newest first

            if (large.length > 0) {
              // Update last trade timestamp
              const newestTimestamp = Math.max(...large.map((t: any) => t.timestamp));
              setLastTradeTimestamp(newestTimestamp);
              
              // Add to logs with better formatting
              large.forEach((trade: any) => {
                const amountFormatted = trade.amount >= 10 
                  ? `${trade.amount.toFixed(1)} SOL` 
                  : trade.amount >= 1 
                  ? `${trade.amount.toFixed(2)} SOL` 
                  : `${trade.amount.toFixed(3)} SOL`;
                
                const log = `> ${trade.type === 'BUY' ? '🟢 BUY' : '🔴 SELL'}: ${amountFormatted} @ ${trade.time}`;
                setLogs(prev => [...prev, log].slice(-40));
              });
            }
          }
        }
      } catch (error) {
        // Ignore errors
      }
    };

    fetchLargeTrades();
    const interval = setInterval(fetchLargeTrades, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [tokenMint, lastTradeTimestamp]);

  // Fetch real PARRY status
  useEffect(() => {
    const fetchParryStatus = async () => {
      try {
        const response = await fetch('/api/parry');
        const data = await response.json();
        
        if (data.status === 'running') {
          setParryStatus('running');
          // Add real logs from PARRY
          if (data.marketState) {
            const newLogs = [
              `> PHASE: ${data.marketState.phase?.toUpperCase() || 'ANALYZING'}`,
              `> PRICE: ${data.marketState.price?.toFixed(10) || '---'}`,
              `> RSI: ${data.marketState.rsi?.toFixed(1) || '---'}`,
              `> NET_VOL: ${data.marketState.netVolume5m?.toFixed(4) || '---'} SOL`,
            ];
            setLogs(prev => [...prev, ...newLogs].slice(-40));
          }
        } else {
          setParryStatus('offline');
        }
      } catch (error) {
        // PARRY not running, show waiting state
        setParryStatus('waiting');
      }
    };

    // Fetch immediately and then every 3 seconds
    fetchParryStatus();
    const interval = setInterval(fetchParryStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Generate dynamic logs based on token data and PARRY status
  useEffect(() => {
    if (parryStatus === 'running') return; // Don't add logs when PARRY is running (it has its own)

    let logIndex = 0;
    const availableLogs: string[] = [];

    if (tokenMint && tokenData) {
      // Build available logs from token data
      if (tokenData.name) {
        availableLogs.push(`> TOKEN: ${tokenData.name} (${tokenData.symbol || '---'})`);
      }
      
      if (tokenData.usd_market_cap) {
        const mc = tokenData.usd_market_cap;
        const mcFormatted = mc >= 1000000 
          ? `$${(mc / 1000000).toFixed(2)}M` 
          : mc >= 1000 
          ? `$${(mc / 1000).toFixed(2)}K` 
          : `$${mc.toFixed(2)}`;
        availableLogs.push(`> MARKET CAP: ${mcFormatted}`);
      }

      if (tokenData.priceChange24h !== undefined && tokenData.priceChange24h !== null) {
        const change = tokenData.priceChange24h;
        const sign = change >= 0 ? '+' : '';
        const color = change >= 0 ? '↑' : '↓';
        availableLogs.push(`> 24H CHANGE: ${sign}${change.toFixed(2)}% ${color}`);
      }

      if (tokenData.volume24h) {
        const vol = tokenData.volume24h;
        const volFormatted = vol >= 1000000 
          ? `$${(vol / 1000000).toFixed(2)}M` 
          : vol >= 1000 
          ? `$${(vol / 1000).toFixed(2)}K` 
          : `$${vol.toFixed(2)}`;
        availableLogs.push(`> 24H VOLUME: ${volFormatted}`);
      }

      if (tokenData.liquidityUsd && tokenData.liquidityUsd > 0) {
        const liq = tokenData.liquidityUsd;
        const liqFormatted = liq >= 1000000 
          ? `$${(liq / 1000000).toFixed(2)}M` 
          : liq >= 1000 
          ? `$${(liq / 1000).toFixed(2)}K` 
          : `$${liq.toFixed(2)}`;
        availableLogs.push(`> LIQUIDITY: ${liqFormatted}`);
      }

      availableLogs.push(`> PARRY STATUS: ONLINE`);
      availableLogs.push(`> STRATEGY ENGINE: READY`);
      availableLogs.push(`> NEURAL CORE: ACTIVE`);
      availableLogs.push(`> MARKET DATA: SYNCED`);
    } else {
      // No token configured - show waiting messages
      availableLogs.push('> AWAITING TOKEN...');
      availableLogs.push('> NEURAL CORE: STANDBY');
      availableLogs.push('> PARRY STATUS: ONLINE');
      availableLogs.push('> INITIALIZE VIA /parry-core');
      availableLogs.push('> MARKET DATA: PENDING');
      availableLogs.push('> STRATEGY ENGINE: READY');
      availableLogs.push('> LIQUIDITY SCAN: WAITING');
      availableLogs.push('> CONNECT TOKEN TO ACTIVATE');
    }

    const generateLog = () => {
      if (availableLogs.length === 0) return;
      
      const log = availableLogs[logIndex % availableLogs.length];
      logIndex++;
      
      setLogs(prev => {
        const updated = [...prev, log];
        return updated.slice(-40); // Keep last 40 logs
      });
    };

    // Add initial logs
    if (availableLogs.length > 0) {
      const initialLogs = availableLogs.slice(0, Math.min(5, availableLogs.length));
      setLogs(initialLogs);
    }

    // Rotate through logs every 3 seconds
    const interval = setInterval(generateLog, 3000);
    return () => clearInterval(interval);
  }, [tokenMint, tokenData, parryStatus]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <motion.div
      initial={{ x: 280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="h-full w-[280px] flex-shrink-0"
    >
      <div 
        className="h-full flex flex-col rounded-l-[3.5rem] overflow-hidden relative"
        style={{
          background: 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderLeft: '1px solid rgba(192,192,192,0.15)',
        }}
      >
        {/* Hardware Bolts */}
        <HardwareBolt className="absolute top-5 left-5" size={8} />
        <HardwareBolt className="absolute bottom-5 left-5" size={8} />
        <HardwareBolt className="absolute bottom-5 right-5" size={8} />

        {/* Header with Status Indicator */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-2.5 h-2.5 bg-[#00F2FF] rounded-full"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ boxShadow: '0 0 12px #00F2FF' }}
            />
            <span 
              className="text-[10px] text-[#00F2FF] font-mono uppercase" 
              style={{ letterSpacing: '0.25em', textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF' }}
            >
              NEURAL_LOG
            </span>
          </div>
          <span 
            className="text-[7px] font-mono uppercase text-[#00D4FF]"
            style={{ letterSpacing: '0.15em', textShadow: '0 0 8px #00D4FF, 0 0 12px #00D4FF' }}
          >
            ONLINE
          </span>
        </div>
        
        {/* Log Content with Signal Flicker - ICE COLORS */}
        <div
          ref={terminalRef}
          className="flex-1 overflow-y-auto space-y-1.5 p-5 pt-2 text-[10px] font-mono"
          style={{ scrollbarWidth: 'thin' }}
        >
          {logs.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[#C0C0C0]"
              style={{ textShadow: '0 0 8px rgba(192,192,192,0.3)' }}
            >
              <motion.span
                animate={{ opacity: [0.7, 1, 0.8, 1, 0.85] }}
                transition={{ 
                  duration: 0.3, 
                  repeat: Infinity, 
                  repeatDelay: Math.random() * 3 + 1,
                  ease: 'linear' 
                }}
              >
                {log}
              </motion.span>
            </motion.div>
          ))}
        </div>
        
        {/* Footer with Chromatic Aberration */}
        <div 
          className="p-4 border-t border-white/5 text-[7px] text-[#505050] font-mono uppercase text-center" 
          style={{ letterSpacing: '0.2em', textShadow: '-0.2px 0 #FF0040, 0.2px 0 #00D4FF' }}
        >
          HOLOGRAPHIC_PROJECTION // V8.01
        </div>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Substrate Dock (Bottom Navigation)
// ═══════════════════════════════════════════════════════════════════════════════
const SubstrateDock = ({ 
  activeModule, 
  setActiveModule 
}: { 
  activeModule: 'nexus' | 'strategy' | 'sentiment';
  setActiveModule: (m: 'nexus' | 'strategy' | 'sentiment') => void;
}) => {
  const modules = [
    { id: 'nexus' as const, label: 'MARKET NEXUS' },
    { id: 'strategy' as const, label: 'TECHNICAL STRATEGY' },
    { id: 'sentiment' as const, label: 'MARKET HEAT' },
  ];

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="flex justify-center mb-4"
    >
      <div 
        className="flex items-center gap-1 px-3 py-2 rounded-full"
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(60px)',
          WebkitBackdropFilter: 'blur(60px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {modules.map((mod) => (
          <motion.button
            key={mod.id}
            onClick={() => setActiveModule(mod.id)}
            className="relative px-4 py-2 rounded-full transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {activeModule === mod.id && (
              <motion.div
                layoutId="dockIndicator"
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'rgba(0,242,255,0.15)',
                  border: '1px solid rgba(0,242,255,0.3)',
                }}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span 
              className="relative text-[9px] font-mono uppercase"
              style={{
                color: activeModule === mod.id ? '#00F2FF' : '#808080',
                letterSpacing: '0.2em',
                textShadow: activeModule === mod.id ? '0 0 10px rgba(0,242,255,0.5), -0.3px 0 #FF0040, 0.3px 0 #00D4FF' : 'none',
              }}
            >
              [ {mod.label} ]
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Lower Stage Module (Single Panel View)
// ═══════════════════════════════════════════════════════════════════════════════
const LowerStageModule = ({ activeModule }: { activeModule: 'nexus' | 'strategy' | 'sentiment' }) => {
  return (
    <div className="h-[35vh] min-h-[300px] max-h-[400px]">
      <AnimatePresence mode="wait">
        {activeModule === 'nexus' && (
          <motion.div
            key="nexus"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            <GlobalTradesPanel />
          </motion.div>
        )}
        {activeModule === 'strategy' && (
          <motion.div
            key="strategy"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            <StrategyChartPanel />
          </motion.div>
        )}
        {activeModule === 'sentiment' && (
          <motion.div
            key="sentiment"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="h-full"
          >
            <RimLightPanel className="h-full p-8" withBolts statusLabel="PROCESSING">
              <h3 className="text-[10px] text-[#C0C0C0] uppercase tracking-[0.4em] mb-6 mt-4">
                <ExplanationNode 
                  title="MARKET HEAT"
                  explanation="PARRY's meme-culture sentiment analysis. ROPES = extreme fear, BEARISH = pessimism, COPE = neutral coping, COMFY = bullish confidence, MOON = extreme greed. Powered by decentralized psychological topology."
                />
              </h3>
              <div className="flex items-center justify-center h-[200px]">
                <MarketHeatBar />
              </div>
            </RimLightPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: Dashboard Sovereign V8
// ═══════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [activeView, setActiveView] = useState<'dashboard' | 'reserve' | 'terminal' | 'docs'>('dashboard');
  const [activeModule, setActiveModule] = useState<'nexus' | 'strategy' | 'sentiment'>('nexus');
  const [isPulsing, setIsPulsing] = useState(false);
  const [distanceToCenter, setDistanceToCenter] = useState(1);
  
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const smoothMouseX = useSpring(mouseX, { stiffness: 40, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 40, damping: 20 });

  useInterval(() => {
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 500);
  }, 4000);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    mouseX.set(x);
    mouseY.set(y);
    const dist = Math.sqrt(Math.pow(x - 0.5, 2) + Math.pow(y - 0.5, 2));
    setDistanceToCenter(Math.min(1, dist * 2));
  }, [mouseX, mouseY]);

  const navItems = [
    { id: 'dashboard' as const, icon: '/icons/icon-dashboard.png', label: 'HUB' },
    { id: 'reserve' as const, icon: '/icons/icon-reserve.png', label: 'RESERVE' },
    { id: 'terminal' as const, icon: '/icons/icon-terminal.png', label: 'TERMINAL' },
    { id: 'docs' as const, icon: '/icons/icon-docs.png', label: 'DOCS', href: '/docs' },
  ];

  return (
    <div 
      className="relative h-screen overflow-hidden"
      style={{ backgroundColor: '#030303', perspective: '1500px' }}
      onMouseMove={handleMouseMove}
    >
      {/* Scanline Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{
          opacity: 0.02,
          background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.01) 2px, rgba(255,255,255,0.01) 4px)',
        }}
      />

      {/* SOVEREIGN V8 GRID: grid-cols-[140px_1fr_280px] */}
      <div className="h-full grid grid-cols-[140px_1fr_280px]">
        
        {/* LEFT: Hardware Sidebar (140px) */}
        <HardwareSidebar 
          activeView={activeView}
          setActiveView={setActiveView}
          navItems={navItems}
        />

        {/* CENTER: Main Content Area */}
        <div className="h-full flex flex-col py-2 px-4 overflow-hidden">
          {/* Header with Chromatic Aberration */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-2 flex items-center justify-between flex-shrink-0"
          >
            <h1 
              className="text-[11px] text-[#C0C0C0] uppercase" 
              style={{ letterSpacing: '0.4em', textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF' }}
            >
              <ExplanationNode 
                title="SUBSTRATE CORE"
                explanation="The Neural Hub is PARRY's central quantum-entangled liquidity engine. Mouse proximity modulates the containment field's electromagnetic resonance frequency."
              />
            </h1>
            <div 
              className="text-[7px] text-[#505050] font-mono uppercase" 
              style={{ letterSpacing: '0.2em', textShadow: '-0.2px 0 #FF0040, 0.2px 0 #00D4FF' }}
            >
              [SYSTEM_AUTH: PARRY_01] // [SOVEREIGN: V8]
            </div>
          </motion.header>

          {/* Main Views */}
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 flex flex-col min-h-0"
              >
                {/* Central Core (h-[55vh] hero) */}
                <div className="flex-1 flex items-center justify-center min-h-0">
                  <NeuralCore 
                    mouseX={smoothMouseX} 
                    mouseY={smoothMouseY} 
                    isPulsing={isPulsing}
                    distanceToCenter={distanceToCenter}
                  />
                </div>
                
                {/* Substrate Dock */}
                <SubstrateDock 
                  activeModule={activeModule} 
                  setActiveModule={setActiveModule} 
                />
                
                {/* Lower Stage Module */}
                <LowerStageModule activeModule={activeModule} />
              </motion.div>
            )}

            {activeView === 'reserve' && (
              <motion.div
                key="reserve"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 flex items-center justify-center"
              >
                <ReserveView />
              </motion.div>
            )}

            {activeView === 'terminal' && (
              <motion.div
                key="terminal"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 flex items-center justify-center"
              >
                <TerminalView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: Holographic Terminal (FIXED 280px) */}
        <HolographicTerminal />
      </div>
    </div>
  );
}


