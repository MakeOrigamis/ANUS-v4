'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowLeft, Wallet, Activity, Settings, TrendingUp, Shield, Zap, BarChart3, RefreshCw, LogOut, Trash2, Power, Edit2, Plus, X, AlertTriangle, Sliders, EyeOff, ChevronDown, ChevronUp, Save, Key, MessageSquare, Bot, Eye, EyeOff as EyeOffIcon, DollarSign, Clock, Users, Loader2, Play, Square, Brain, CheckCircle2, XCircle } from 'lucide-react';
import { getUserProject, saveParryConfig, getParryConfig, deleteProject, updateProjectSettings, addOperationalWallet, removeOperationalWallet, toggleWalletActive, saveApiKeys, saveCustomPersonality, saveAutoClaimSettings, getFullProjectData } from '@/app/actions/auth';
import { fetchPumpFunToken, getSOLBalance, getTokenHolderCount, type PumpFunTokenData } from '@/lib/solana';
import { PublicKey } from '@solana/web3.js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { logError, logWarn, logInfo, logDebug } from '@/lib/logger-client';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Floating Sentinel (Central Hologram)
// ═══════════════════════════════════════════════════════════════════════════════
const FloatingSentinel = ({ mouseX, mouseY }: { mouseX: any; mouseY: any }) => {  const tiltX = useTransform(mouseY, [0, 1], [8, -8]);
  const tiltY = useTransform(mouseX, [0, 1], [-8, 8]);
  const smoothTiltX = useSpring(tiltX, { stiffness: 35, damping: 25 });
  const smoothTiltY = useSpring(tiltY, { stiffness: 35, damping: 25 });

  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{ rotateX: smoothTiltX, rotateY: smoothTiltY, transformStyle: 'preserve-3d' }}
    >
      <div 
        className="relative overflow-hidden"
        style={{
          width: '320px', height: '320px',
          maskImage: 'radial-gradient(circle, black 35%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(circle, black 35%, transparent 75%)',
          background: '#000000',
        }}
      >
        <video
          src="/substrate-core.mp4"
          autoPlay muted loop playsInline
          className="w-full h-full object-cover"
          style={{ mixBlendMode: 'screen', background: '#000000', opacity: 0.85 }}
        />
      </div>
      <motion.div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="text-[9px] font-mono uppercase text-[#00F2FF]" style={{ letterSpacing: '0.3em', textShadow: '0 0 15px rgba(0,242,255,0.6)' }}>
          [ SOVEREIGN HUB ACTIVE ]
        </span>
      </motion.div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Stats Card
// ═══════════════════════════════════════════════════════════════════════════════
const StatsCard = ({ icon: Icon, label, value, change, positive = true }: { 
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; change?: string; positive?: boolean;
}) => (
  <motion.div
    className="p-6 rounded-2xl"
    style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}
    whileHover={{ scale: 1.02, borderColor: 'rgba(0,242,255,0.2)', boxShadow: '0 0 30px rgba(0,242,255,0.1)' }}
  >
    <div className="flex items-start justify-between mb-4">
      <Icon className="w-5 h-5 text-[#00F2FF]" />
      {change && <span className={`text-[9px] font-mono ${positive ? 'text-[#00FF88]' : 'text-[#FF4444]'}`}>{positive ? '↑' : '↓'} {change}</span>}
    </div>
    <div className="text-[20px] font-mono text-[#E0E0E0] mb-1" style={{ letterSpacing: '0.05em' }}>{value}</div>
    <div className="text-[8px] font-mono text-[#505050] uppercase" style={{ letterSpacing: '0.2em' }}>{label}</div>
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Strategy Toggle
// ═══════════════════════════════════════════════════════════════════════════════
const StrategyToggle = ({ label, active, onToggle, description }: { label: string; active: boolean; onToggle: () => void; description: string }) => (
  <motion.button
    onClick={onToggle}
    className="w-full p-5 rounded-xl text-left flex items-center justify-between"
    style={{ background: active ? 'rgba(0,242,255,0.08)' : 'rgba(0,0,0,0.3)', border: active ? '1px solid rgba(0,242,255,0.3)' : '1px solid rgba(192,192,192,0.06)' }}
    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
  >
    <div>
      <div className="text-[11px] font-mono text-[#E0E0E0] mb-1" style={{ letterSpacing: '0.1em' }}>{label}</div>
      <div className="text-[8px] font-mono text-[#505050]">{description}</div>
    </div>
    <motion.div className="w-10 h-5 rounded-full relative" style={{ background: active ? 'rgba(0,242,255,0.3)' : 'rgba(255,255,255,0.1)' }}>
      <motion.div className="absolute top-0.5 w-4 h-4 rounded-full" style={{ background: active ? '#00F2FF' : '#404040' }} animate={{ left: active ? '22px' : '2px' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
    </motion.div>
  </motion.button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Config Slider Input
// ═══════════════════════════════════════════════════════════════════════════════
const ConfigInput = ({ 
  label, 
  value, 
  onChange, 
  unit,
  min,
  max,
  step = 1,
  tooltip
}: { 
  label: string; 
  value: number; 
  onChange: (v: number) => void;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  tooltip?: string;
}) => (
  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)' }}>
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-[#808080] uppercase" style={{ letterSpacing: '0.05em' }}>{label}</span>
      {tooltip && (
        <div className="group relative">
          <div className="w-3 h-3 rounded-full flex items-center justify-center text-[8px] text-[#404040] border border-[#404040] cursor-help">?</div>
          <div className="absolute bottom-full left-0 mb-2 px-2 py-1 rounded text-[8px] text-[#808080] bg-[#0A0A0A] border border-[#202020] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
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
        min={min}
        max={max}
        step={step}
        className="w-20 px-2 py-1 rounded text-[10px] font-mono text-[#00F2FF] text-right outline-none"
        style={{ background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)' }}
      />
      {unit && <span className="text-[8px] font-mono text-[#505050]">{unit}</span>}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Wallet Row with Actions
// ═══════════════════════════════════════════════════════════════════════════════
interface WalletData {
  id: string;
  address: string;
  balance: string;
  isActive: boolean;
}

const WalletRow = ({ 
  wallet, 
  onToggleActive, 
  onDelete, 
  onEdit 
}: { 
  wallet: WalletData;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}) => (
  <motion.div 
    className="flex items-center justify-between p-4 rounded-xl group"
    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(192,192,192,0.04)' }}
    whileHover={{ borderColor: 'rgba(0,242,255,0.15)' }}
  >
    <div className="flex items-center gap-3">
      <div 
        className="w-2 h-2 rounded-full transition-colors"
        style={{ background: wallet.isActive ? '#00F2FF' : '#404040' }}
      />
      <span className="text-[10px] font-mono text-[#808080]">
        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
      </span>
    </div>
    
    <div className="flex items-center gap-4">
      <div className="text-right mr-4">
        <div className="text-[11px] font-mono text-[#E0E0E0]">{wallet.balance} SOL</div>
        <div className="text-[7px] font-mono text-[#505050] uppercase">{wallet.isActive ? 'active' : 'inactive'}</div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <motion.button
          onClick={() => onToggleActive(wallet.id)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)' }}
          whileHover={{ scale: 1.1, background: wallet.isActive ? 'rgba(255,180,0,0.2)' : 'rgba(0,242,255,0.2)' }}
          whileTap={{ scale: 0.9 }}
          title={wallet.isActive ? 'Deactivate' : 'Activate'}
        >
          <Power className={`w-3 h-3 ${wallet.isActive ? 'text-[#FFB400]' : 'text-[#00F2FF]'}`} />
        </motion.button>
        
        <motion.button
          onClick={() => onEdit(wallet.id)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)' }}
          whileHover={{ scale: 1.1, background: 'rgba(0,242,255,0.2)' }}
          whileTap={{ scale: 0.9 }}
          title="Edit"
        >
          <Edit2 className="w-3 h-3 text-[#00F2FF]" />
        </motion.button>
        
        <motion.button
          onClick={() => onDelete(wallet.id)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)' }}
          whileHover={{ scale: 1.1, background: 'rgba(255,68,68,0.2)' }}
          whileTap={{ scale: 0.9 }}
          title="Delete"
        >
          <Trash2 className="w-3 h-3 text-[#FF4444]" />
        </motion.button>
      </div>
    </div>
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Delete Confirmation Modal
// ═══════════════════════════════════════════════════════════════════════════════
const DeleteConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void;
  title: string;
  message: string;
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.8)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="p-8 rounded-2xl max-w-md"
          style={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,68,68,0.3)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-[#FF4444]" />
            <h3 className="text-[14px] font-mono text-[#FF4444] uppercase" style={{ letterSpacing: '0.1em' }}>{title}</h3>
          </div>
          
          <p className="text-[11px] font-mono text-[#808080] mb-6">{message}</p>
          
          <div className="flex gap-3">
            <motion.button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-[10px] font-mono uppercase"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(192,192,192,0.1)', color: '#808080' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={onConfirm}
              className="flex-1 py-3 rounded-xl text-[10px] font-mono uppercase"
              style={{ background: 'rgba(255,68,68,0.2)', border: '1px solid rgba(255,68,68,0.5)', color: '#FF4444' }}
              whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(255,68,68,0.3)' }}
              whileTap={{ scale: 0.98 }}
            >
              Delete
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Add/Edit Wallet Modal
// ═══════════════════════════════════════════════════════════════════════════════
const WalletModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editWallet 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (privateKey: string) => void;
  editWallet?: WalletData | null;
}) => {
  const [privateKey, setPrivateKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setPrivateKey('');
  }, [editWallet, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="p-8 rounded-2xl w-full max-w-md"
            style={{ background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(0,242,255,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[14px] font-mono text-[#00F2FF] uppercase" style={{ letterSpacing: '0.1em' }}>
                {editWallet ? 'Edit Wallet' : 'Add Operational Wallet'}
              </h3>
              <button onClick={onClose} className="text-[#404040] hover:text-[#808080]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.2)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Key className="w-3 h-3 text-[#FFB400]" />
                <span className="text-[9px] font-mono text-[#FFB400] uppercase">PRIVATE KEY REQUIRED</span>
              </div>
              <p className="text-[8px] font-mono text-[#808080]">
                PARRY needs the private key to execute trades. Keys are encrypted with AES-256 before storage.
              </p>
            </div>
            
            <div className="relative mb-6">
              <input
                type={showKey ? 'text' : 'password'}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="Enter wallet private key (base58)..."
                className="w-full px-6 py-4 pr-12 rounded-xl text-[11px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none"
                style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(192,192,192,0.1)' }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#808080]"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            <motion.button
              onClick={() => { onSave(privateKey); setPrivateKey(''); }}
              disabled={privateKey.length < 60}
              className="w-full py-3 rounded-xl text-[10px] font-mono uppercase disabled:opacity-30"
              style={{ background: 'rgba(0,242,255,0.15)', border: '1px solid rgba(0,242,255,0.4)', color: '#00F2FF' }}
              whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0,242,255,0.3)' }}
              whileTap={{ scale: 0.98 }}
            >
              {editWallet ? 'Update Wallet' : 'Add Wallet'}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: Private Operations Hub
// ═══════════════════════════════════════════════════════════════════════════════
export default function HubPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [tokenMint, setTokenMint] = useState('');
  const [tokenData, setTokenData] = useState<PumpFunTokenData | null>(null);
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [volumeBot, setVolumeBot] = useState(false);
  const [priceStabilizer, setPriceStabilizer] = useState(false);
  const [volumeFarmer, setVolumeFarmer] = useState(false);
  
  // Loading states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  
  // Auto-sync settings
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [autoSyncInterval, setAutoSyncInterval] = useState(120); // seconds
  
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  
  // Edit mode for token/wallet
  const [editTokenMint, setEditTokenMint] = useState('');
  const [editDevWallet, setEditDevWallet] = useState('');
  const [showDevWallet, setShowDevWallet] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Auto-claim settings
  const [autoClaimEnabled, setAutoClaimEnabled] = useState(false);
  const [autoClaimInterval, setAutoClaimInterval] = useState(60); // minutes
  
  // Stats (will be fetched from chain/API)
  const [stats, setStats] = useState({
    volume24h: 0,
    holders: 0,
    winRate: 0,
    totalProfit: 0,
  });
  
  // PARRY Engine state
  const [parryRunning, setParryRunning] = useState(false);
  const [parryStarting, setParryStarting] = useState(false);
  const [parryLogs, setParryLogs] = useState<Array<{ timestamp: Date; type: string; message: string }>>([]);
  const [parryStatus, setParryStatus] = useState<{ uptime: number; timeframe: number; dataPoints: number } | null>(null);
  
  // PARRY Config state (adjustable parameters)
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
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
    minTradeSize: 0.05,
    cooldownSeconds: 60,
    // Wallet limits
    maxSupplyPercent: 2,
    maxSolPerWallet: 10,
    // Execution
    slippage: 10,
    priorityFee: 0.00005,
    useVanishTrade: false,
    // Twitter
    twitterEnabled: false,
    tweetIntervalMinutes: 30,
  });

  const [configSaving, setConfigSaving] = useState(false);
  
  // API Keys state (user provides their own)
  const [apiKeys, setApiKeys] = useState({
    deepseekApiKey: '',
    twitterApiKey: '',
    twitterApiSecret: '',
    twitterAccessToken: '',
    twitterAccessSecret: '',
  });
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [apiKeysSaving, setApiKeysSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  // Custom AI personality
  const [customPersonality, setCustomPersonality] = useState('');
  
  const updateConfig = (key: string, value: number | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };
  
  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const handleSaveApiKeys = async () => {
    setApiKeysSaving(true);
    try {
      // Only save keys that aren't placeholder values
      const keysToSave: Record<string, string> = {};
      if (apiKeys.deepseekApiKey && !apiKeys.deepseekApiKey.includes('•')) {
        keysToSave.deepseekApiKey = apiKeys.deepseekApiKey;
      }
      if (apiKeys.twitterApiKey && !apiKeys.twitterApiKey.includes('•')) {
        keysToSave.twitterApiKey = apiKeys.twitterApiKey;
      }
      if (apiKeys.twitterApiSecret && !apiKeys.twitterApiSecret.includes('•')) {
        keysToSave.twitterApiSecret = apiKeys.twitterApiSecret;
      }
      if (apiKeys.twitterAccessToken && !apiKeys.twitterAccessToken.includes('•')) {
        keysToSave.twitterAccessToken = apiKeys.twitterAccessToken;
      }
      if (apiKeys.twitterAccessSecret && !apiKeys.twitterAccessSecret.includes('•')) {
        keysToSave.twitterAccessSecret = apiKeys.twitterAccessSecret;
      }
      
      if (Object.keys(keysToSave).length > 0) {
        await saveApiKeys(keysToSave);
        alert('API Keys saved securely!');
      } else {
        alert('No new keys to save');
      }
    } catch (error) {
      logError('Error saving API keys', error as Error);
      alert('Error saving API keys');
    } finally {
      setApiKeysSaving(false);
    }
  };
  
  // Save config to database (call this when user is done editing)
  const saveConfigToDb = async () => {
    setConfigSaving(true);
    try {
      // Include strategy toggles in config
      const fullConfig = {
        ...config,
        volumeBot,
        priceStabilizer,
        volumeFarmer,
      };
      await saveParryConfig(fullConfig);
      
      // Also save auto-claim settings
      await saveAutoClaimSettings(autoClaimEnabled, autoClaimInterval);
      
      // Save custom personality if changed
      if (customPersonality) {
        await saveCustomPersonality(customPersonality);
      }
    } catch (error) {
      logError('Error saving config', error as Error);
    } finally {
      setConfigSaving(false);
    }
  };
  
  // Modal states
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [showDeleteWalletModal, setShowDeleteWalletModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);
  const [walletToDelete, setWalletToDelete] = useState<string | null>(null);
  
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Load data and check auth
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    // Use session.user.id (works for all auth providers including Twitter)
    if (status === 'authenticated' && session?.user?.id) {
      // Load ALL project data from database
      const loadProjectData = async () => {
        try {
          logDebug('Loading project data', { userId: session.user.id });
          const project = await getFullProjectData();
          logDebug('Loaded project', { projectId: project?.id });
          
          // If no project exists, redirect to onboarding
          if (!project) {
            logDebug('No project found, redirecting to onboarding');
            router.push('/onboarding');
            return;
          }
          
          // Project exists - load ALL the data
          logDebug('Setting token mint', { mint: project.tokenMintAddress });
          setTokenMint(project.tokenMintAddress);
          setEditTokenMint(project.tokenMintAddress);
          
          // Map wallets from database
          setWallets(project.wallets.map((w: { id: string; address: string; label: string | null; isActive: boolean }) => ({
            id: w.id,
            address: w.address,
            balance: '0.0', // Will be fetched from chain via SYNC
            isActive: w.isActive,
          })));
          
          // Load auto-claim settings
          setAutoClaimEnabled(project.autoClaimEnabled || false);
          setAutoClaimInterval(project.autoClaimInterval || 60);
          
          // Load custom personality
          if (project.customPersonality) {
            setCustomPersonality(project.customPersonality);
          }
          
          // Load API key status
          setApiKeys(prev => ({
            ...prev,
            // Just indicate if keys are set (not actual values for security)
            deepseekApiKey: project.hasDeepseekKey ? '••••••••••••••••' : '',
            twitterApiKey: project.hasTwitterKeys ? '••••••••••••••••' : '',
            twitterApiSecret: project.hasTwitterKeys ? '••••••••••••••••' : '',
            twitterAccessToken: project.hasTwitterKeys ? '••••••••••••••••' : '',
            twitterAccessSecret: project.hasTwitterKeys ? '••••••••••••••••' : '',
          }));
          
          // Load PARRY config (strategy toggles, thresholds, etc.)
          if (project.parryConfig) {
            setConfig(prev => ({ ...prev, ...project.parryConfig }));
            // Also set strategy toggles from config
            if (project.parryConfig.volumeBot !== undefined) setVolumeBot(project.parryConfig.volumeBot);
            if (project.parryConfig.priceStabilizer !== undefined) setPriceStabilizer(project.parryConfig.priceStabilizer);
            if (project.parryConfig.volumeFarmer !== undefined) setVolumeFarmer(project.parryConfig.volumeFarmer);
          }
          
          // Auto-sync after loading (via API endpoint for rate limiting)
          logDebug('Auto-syncing token data');
          try {
            const syncResponse = await fetch('/api/token/sync', { method: 'POST' });
            if (syncResponse.ok) {
              const syncData = await syncResponse.json();
              if (syncData.success && syncData.tokenData) {
                logDebug('Token data loaded', { tokenName: syncData.tokenData?.name });
                setTokenData(syncData.tokenData);
                if (syncData.holderCount) {
                  setStats(prev => ({ ...prev, holders: syncData.holderCount }));
                }
              }
            }
          } catch (error) {
            logError('Token sync error', error as Error);
          }
        } catch (error) {
          logError('Error loading project data', error as Error);
        }
      };
      
      loadProjectData();
    }
  }, [status, session, router]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // VALIDATION FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Validates if a string is a valid Solana public key
   */
  const isValidSolanaAddress = (address: string): boolean => {
    if (!address || address.length < 32 || address.length > 44) {
      return false;
    }
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Rate-limited batch processing for wallet balances
   * Processes wallets in batches to avoid rate limiting
   */
  const processWalletsInBatches = async (
    wallets: WalletData[],
    batchSize: number = 5,
    delayMs: number = 200
  ): Promise<{ success: WalletData[]; failed: Array<{ wallet: WalletData; error: string }> }> => {
    const success: WalletData[] = [];
    const failed: Array<{ wallet: WalletData; error: string }> = [];
    
    // Process wallets in batches
    for (let i = 0; i < wallets.length; i += batchSize) {
      const batch = wallets.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (wallet) => {
          // Validate wallet address first
          if (!isValidSolanaAddress(wallet.address)) {
            throw new Error(`Invalid wallet address: ${wallet.address.slice(0, 8)}...`);
          }
          
          const balance = await getSOLBalance(wallet.address);
          return { ...wallet, balance: balance.toFixed(4) };
        })
      );
      
      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          success.push(result.value);
        } else {
          const wallet = batch[index];
          const error = result.reason?.message || 'Unknown error';
          failed.push({ wallet, error });
          logError('Error fetching balance', error as Error, { wallet: wallet.address });
        }
      });
      
      // Delay between batches to avoid rate limiting
      if (i + batchSize < wallets.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return { success, failed };
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // SYNC FUNCTION - IMPROVED WITH ERROR HANDLING, VALIDATION & RATE LIMITING
  // ═══════════════════════════════════════════════════════════════════════════════
  
  const handleSync = async () => {
    setIsSyncing(true);
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // ═══════════════════════════════════════════════════════════════════════════
      // 1. VALIDATE & FETCH TOKEN DATA
      // ═══════════════════════════════════════════════════════════════════════════
      
      if (tokenMint) {
        // Validate token mint address
        if (!isValidSolanaAddress(tokenMint)) {
          errors.push(`Invalid token mint address: ${tokenMint.slice(0, 20)}...`);
          showToast('Invalid token mint address', 'error');
        } else {
          try {
            // Use API endpoint for rate limiting protection
            const syncResponse = await fetch('/api/token/sync', { method: 'POST' });
            
            if (syncResponse.ok) {
              const syncData = await syncResponse.json();
              
              if (syncData.success && syncData.tokenData) {
                setTokenData(syncData.tokenData);
                
                // Update stats
                setStats(prev => ({
                  ...prev,
                  volume24h: syncData.tokenData.usd_market_cap * 0.1, // Estimate 10% of MC as volume
                  holders: syncData.holderCount || prev.holders,
                }));
              } else {
                warnings.push('Token data not found - token may not exist on Pump.fun');
              }
            } else {
              const errorData = await syncResponse.json().catch(() => ({ error: 'Unknown error' }));
              if (syncResponse.status === 429) {
                errors.push('Rate limit exceeded - please wait before syncing again');
                showToast('Rate limit exceeded. Please wait.', 'error');
              } else {
                errors.push(`Token sync failed: ${errorData.error || 'Unknown error'}`);
                logError('Token sync API error', new Error(errorData.error || 'Unknown error'));
              }
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to fetch token data';
            errors.push(`Token data: ${errorMsg}`);
            logError('Token data fetch error', err as Error);
          }
        }
      } else {
        warnings.push('No token mint configured - skipping token sync');
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // 2. VALIDATE & FETCH WALLET BALANCES (WITH RATE LIMITING)
      // ═══════════════════════════════════════════════════════════════════════════
      
      if (wallets.length > 0) {
        // Validate all wallet addresses first
        const invalidWallets = wallets.filter(w => !isValidSolanaAddress(w.address));
        if (invalidWallets.length > 0) {
          invalidWallets.forEach(w => {
            errors.push(`Invalid wallet address: ${w.address.slice(0, 8)}...`);
          });
        }
        
        // Process valid wallets in batches
        const validWallets = wallets.filter(w => isValidSolanaAddress(w.address));
        
        if (validWallets.length > 0) {
          try {
            const { success, failed } = await processWalletsInBatches(validWallets, 5, 200);
            
            // Update successfully synced wallets
            if (success.length > 0) {
              // Merge with existing wallets (keep failed ones with old balance)
              setWallets(prev => {
                const walletMap = new Map(prev.map(w => [w.address, w]));
                success.forEach(w => walletMap.set(w.address, w));
                return Array.from(walletMap.values());
              });
            }
            
            // Report failed wallets
            if (failed.length > 0) {
              failed.forEach(({ wallet, error }) => {
                warnings.push(`${wallet.address.slice(0, 8)}...: ${error}`);
              });
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to sync wallet balances';
            errors.push(`Wallet sync: ${errorMsg}`);
            logError('Wallet sync error', err as Error);
          }
        }
      } else {
        warnings.push('No wallets configured - skipping wallet sync');
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // 3. USER FEEDBACK
      // ═══════════════════════════════════════════════════════════════════════════
      
      if (errors.length > 0) {
        showToast(`Sync completed with ${errors.length} error(s). Check console for details.`, 'error');
        logError('Sync errors', new Error('Multiple sync errors occurred'), { errors });
      } else if (warnings.length > 0) {
        showToast(`Sync completed with ${warnings.length} warning(s).`, 'info');
        if (warnings.length <= 3) {
          warnings.forEach(w => logWarn('Sync warning', { warning: w }));
        }
      } else {
        showToast('Sync completed successfully!', 'success');
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      logError('Sync error', error as Error);
      showToast(`Sync failed: ${errorMsg}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTO-SYNC: Sync data every 120 seconds (configurable)
  // ═══════════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    // Only auto-sync if enabled, user is authenticated, and we have a token mint
    if (!autoSyncEnabled || status !== 'authenticated' || !tokenMint || !session?.user?.id) {
      return;
    }

    // Set up interval for periodic syncs
    const interval = setInterval(() => {
      // Only sync if not already syncing and tab is visible
      if (!isSyncing && document.visibilityState === 'visible') {
        handleSync();
      }
    }, autoSyncInterval * 1000); // Convert seconds to milliseconds

    // Cleanup
    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncEnabled, autoSyncInterval, status, session?.user?.id, tokenMint]);

  // Auto-save strategy toggles when they change
  useEffect(() => {
    // Don't save on initial load (when tokenMint is empty)
    if (!tokenMint) return;
    
    const saveStrategies = async () => {
      try {
        const fullConfig = {
          ...config,
          volumeBot,
          priceStabilizer,
          volumeFarmer,
        };
        await saveParryConfig(fullConfig);
        logDebug('Strategy toggles auto-saved');
      } catch (error) {
        logError('Error auto-saving strategies', error as Error);
      }
    };
    
    // Debounce the save
    const timeoutId = setTimeout(saveStrategies, 1000);
    return () => clearTimeout(timeoutId);
  }, [volumeBot, priceStabilizer, volumeFarmer, tokenMint]);

  // Auto-save auto-claim settings when they change
  useEffect(() => {
    if (!tokenMint) return;
    
    const saveAutoClaim = async () => {
      try {
        await saveAutoClaimSettings(autoClaimEnabled, autoClaimInterval);
        logDebug('Auto-claim settings saved');
      } catch (error) {
        logError('Error saving auto-claim', error as Error);
      }
    };
    
    const timeoutId = setTimeout(saveAutoClaim, 1000);
    return () => clearTimeout(timeoutId);
  }, [autoClaimEnabled, autoClaimInterval, tokenMint]);

  // Claim creator fees
  const handleClaimFees = async () => {
    setIsClaiming(true);
    try {
      const response = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', dryRun: false }),
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`Fees claimed! TX: ${result.signature?.slice(0, 20)}...`);
        // Refresh balances after claim
        handleSync();
      } else {
        alert(`Claim failed: ${result.error}`);
      }
    } catch (error) {
      logError('Claim error', error as Error);
      alert('Claim failed - check console');
    } finally {
      setIsClaiming(false);
    }
  };

  // Initialize edit fields when tokenMint changes
  useEffect(() => {
    setEditTokenMint(tokenMint);
  }, [tokenMint]);

  // Start editing
  const handleStartEditing = () => {
    setEditTokenMint(tokenMint);
    setEditDevWallet(''); // Don't show existing private key for security
    setIsEditing(true);
  };

  // Save project settings
  const handleSaveProjectSettings = async () => {
    setIsSavingProject(true);
    try {
      const updateData: { tokenMintAddress?: string; privateKey?: string } = {};
      
      if (editTokenMint && editTokenMint !== tokenMint) {
        updateData.tokenMintAddress = editTokenMint;
      }
      if (editDevWallet && editDevWallet.length > 60) {
        updateData.privateKey = editDevWallet;
      }
      
      if (Object.keys(updateData).length > 0) {
        await updateProjectSettings(updateData);
        setTokenMint(editTokenMint);
        // Refresh token data
        if (updateData.tokenMintAddress) {
          const data = await fetchPumpFunToken(editTokenMint);
          if (data) setTokenData(data);
        }
      }
      
      setIsEditing(false);
      setEditDevWallet('');
    } catch (error) {
      logError('Error saving project', error as Error);
      alert('Failed to save project settings');
    } finally {
      setIsSavingProject(false);
    }
  };

  // Add new operational wallet
  const handleAddNewWallet = async (privateKey: string) => {
    try {
      const result = await addOperationalWallet(privateKey);
      setWallets(prev => [...prev, { ...result, balance: '0.0', isActive: result.isActive }]);
      setShowWalletModal(false);
    } catch (error) {
      logError('Error adding wallet', error as Error);
      alert('Failed to add wallet - check private key format');
    }
  };

  // Toggle wallet active in database
  const handleToggleWalletActiveDb = async (walletId: string) => {
    try {
      const result = await toggleWalletActive(walletId);
      setWallets(prev => prev.map(w => w.id === walletId ? { ...w, isActive: result.isActive } : w));
    } catch (error) {
      logError('Error toggling wallet', error as Error);
    }
  };

  // Delete wallet from database
  const handleDeleteWalletDb = async (walletId: string) => {
    try {
      await removeOperationalWallet(walletId);
      setWallets(prev => prev.filter(w => w.id !== walletId));
      setShowDeleteWalletModal(false);
      setWalletToDelete(null);
    } catch (error) {
      logError('Error deleting wallet', error as Error);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX / window.innerWidth);
    mouseY.set(e.clientY / window.innerHeight);
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  // Wallet actions - use database functions
  const handleToggleWalletActive = async (id: string) => {
    await handleToggleWalletActiveDb(id);
  };

  const handleDeleteWallet = (id: string) => {
    setWalletToDelete(id);
    setShowDeleteWalletModal(true);
  };

  const confirmDeleteWallet = async () => {
    if (walletToDelete) {
      await handleDeleteWalletDb(walletToDelete);
    }
  };

  const handleEditWallet = (id: string) => {
    const wallet = wallets.find(w => w.id === id);
    if (wallet) {
      setSelectedWallet(wallet);
      setShowWalletModal(true);
    }
  };

  const handleAddWallet = () => {
    setSelectedWallet(null);
    setShowWalletModal(true);
  };

  const handleSaveWallet = async (privateKey: string) => {
    if (selectedWallet) {
      // Edit existing - for now just close (would need new server action)
      setShowWalletModal(false);
      setSelectedWallet(null);
    } else {
      // Add new via database
      await handleAddNewWallet(privateKey);
    }
    setShowWalletModal(false);
    setSelectedWallet(null);
  };

  // Delete entire project
  const handleDeleteProject = () => {
    setShowDeleteProjectModal(true);
  };

  const confirmDeleteProject = async () => {
    try {
      // Delete project from database
      await deleteProject();
      setShowDeleteProjectModal(false);
      router.push('/onboarding');
    } catch (error) {
      logError('Error deleting project', error as Error);
      setShowDeleteProjectModal(false);
    }
  };

  // Handle strategy toggle - starts/stops trading bots
  const handleToggleStrategy = async (strategy: 'volumeBot' | 'priceStabilizer' | 'volumeFarmer', enabled: boolean) => {
    // Update local state immediately
    switch (strategy) {
      case 'volumeBot':
        setVolumeBot(enabled);
        break;
      case 'priceStabilizer':
        setPriceStabilizer(enabled);
        break;
      case 'volumeFarmer':
        setVolumeFarmer(enabled);
        break;
    }

    // Call trading API to start/stop the bot
    try {
      const response = await fetch('/api/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: enabled ? 'start' : 'stop',
          strategy,
          config: {
            tokenMint,
            volumeBotEnabled: strategy === 'volumeBot' ? enabled : volumeBot,
            priceStabilizerEnabled: strategy === 'priceStabilizer' ? enabled : priceStabilizer,
            volumeFarmerEnabled: strategy === 'volumeFarmer' ? enabled : volumeFarmer,
            buyAmountSol: config.maxBuyPerTrade,
            sellSplitCount: 5,
            slippageBps: config.slippage * 100,
            cooldownMs: config.cooldownSeconds * 1000,
            maxSupplyPercent: config.maxSupplyPercent,
            maxSolPerWallet: config.maxSolPerWallet,
          },
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        logInfo(`[Hub] ${strategy} ${enabled ? 'started' : 'stopped'}`, { message: result.message });
      } else {
        logError(`[Hub] Failed to ${enabled ? 'start' : 'stop'} ${strategy}`, new Error(result.error || 'Unknown error'));
        // Revert state on error
        switch (strategy) {
          case 'volumeBot':
            setVolumeBot(!enabled);
            break;
          case 'priceStabilizer':
            setPriceStabilizer(!enabled);
            break;
          case 'volumeFarmer':
            setVolumeFarmer(!enabled);
            break;
        }
      }
    } catch (error) {
      logError(`[Hub] Error toggling ${strategy}`, error as Error);
      // Revert state on error
      switch (strategy) {
        case 'volumeBot':
          setVolumeBot(!enabled);
          break;
        case 'priceStabilizer':
          setPriceStabilizer(!enabled);
          break;
        case 'volumeFarmer':
          setVolumeFarmer(!enabled);
          break;
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // PARRY ENGINE CONTROL
  // ═══════════════════════════════════════════════════════════════════════════════
  
  const startParry = async () => {
    if (!tokenMint) {
      alert('Configure token first');
      return;
    }
    if (wallets.filter(w => w.isActive).length === 0) {
      alert('Add and activate at least one operational wallet');
      return;
    }

    setParryStarting(true);
    try {
      const response = await fetch('/api/parry-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await response.json();
      
      if (data.success) {
        setParryRunning(true);
        // Start polling for status
        pollParryStatus();
      } else {
        alert(data.error || 'Failed to start PARRY');
      }
    } catch (error) {
      logError('Error starting PARRY', error as Error);
      alert('Failed to start PARRY');
    } finally {
      setParryStarting(false);
    }
  };

  const stopParry = async () => {
    try {
      await fetch('/api/parry-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      setParryRunning(false);
      setParryStatus(null);
    } catch (error) {
      logError('Error stopping PARRY', error as Error);
    }
  };

  const pollParryStatus = async () => {
    try {
      const response = await fetch('/api/parry-engine');
      const data = await response.json();
      
      if (data.success) {
        setParryRunning(data.running);
        setParryStatus(data.status);
        setParryLogs(data.logs || []);
        
        // Continue polling if running
        if (data.running) {
          setTimeout(pollParryStatus, 2000);
        }
      }
    } catch (error) {
      logError('Error polling PARRY status', error as Error);
    }
  };

  // Poll status on mount
  useEffect(() => {
    if (session?.user?.id) {
      pollParryStatus();
    }
  }, [session?.user?.id]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div className="w-8 h-8 border-2 border-[#00F2FF] border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      </div>
    );
  }

  return (
    <>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 z-[9999] pointer-events-none"
          >
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-lg text-[11px] font-mono shadow-lg ${
                toast.type === 'success'
                  ? 'bg-[#00FF88]/20 border border-[#00FF88]/40 text-[#00FF88]'
                  : toast.type === 'error'
                  ? 'bg-[#FF4444]/20 border border-[#FF4444]/40 text-[#FF4444]'
                  : 'bg-[#00F2FF]/20 border border-[#00F2FF]/40 text-[#00F2FF]'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {toast.type === 'error' && <XCircle className="w-4 h-4" />}
              {toast.type === 'info' && <AlertTriangle className="w-4 h-4" />}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#000000' }} onMouseMove={handleMouseMove}>
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(0,40,60,0.08) 0%, transparent 60%)' }} />
      </div>

      {/* Scanline */}
      <div className="fixed inset-0 pointer-events-none z-[100]" style={{ opacity: 0.008, background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.005) 2px, rgba(255,255,255,0.005) 4px)' }} />

      {/* Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-[#404040] hover:text-[#00F2FF] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[9px] font-mono uppercase" style={{ letterSpacing: '0.2em' }}>EXIT</span>
          </Link>
          <div className="h-4 w-px bg-[#202020]" />
          <span className="text-[9px] font-mono text-[#606060] uppercase" style={{ letterSpacing: '0.15em' }}>PRIVATE OPERATIONS HUB</span>
          {session?.user?.email && (
            <>
              <div className="h-4 w-px bg-[#202020]" />
              <span className="text-[8px] font-mono text-[#404040]">{session.user.email}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-[9px] font-mono text-[#505050] hover:text-[#00F2FF] transition-colors uppercase" style={{ letterSpacing: '0.15em' }}>
            PUBLIC DASHBOARD →
          </Link>
          <button onClick={handleSignOut} className="flex items-center gap-2 text-[#404040] hover:text-[#FF4444] transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="text-[9px] font-mono uppercase" style={{ letterSpacing: '0.2em' }}>SIGN OUT</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen pt-20 pb-12 px-6">
        <div className="max-w-[1400px] mx-auto">
          
          {/* Top Section: Sentinel + Live Stats */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-8 items-start mb-12">
            <div className="grid grid-cols-2 gap-4 pt-8">
              <StatsCard icon={TrendingUp} label="24H Volume" value={`$${stats.volume24h.toLocaleString()}`} change="--" positive />
              <StatsCard icon={Users} label="Holders" value={stats.holders.toLocaleString()} change="--" positive />
            </div>

            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col items-center">
              <FloatingSentinel mouseX={mouseX} mouseY={mouseY} />
            </motion.div>

            <div className="grid grid-cols-2 gap-4 pt-8">
              <StatsCard icon={Zap} label="Win Rate" value={`${stats.winRate}%`} change="--" positive />
              <StatsCard icon={BarChart3} label="Total Profit" value={`$${stats.totalProfit.toLocaleString()}`} change="--" positive />
            </div>
          </div>

          {/* Token Info Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8 p-4 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(192,192,192,0.06)' }}
          >
            {/* Edit Mode */}
            {isEditing ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#808080] uppercase">EDIT PROJECT SETTINGS</span>
                  <button onClick={() => setIsEditing(false)} className="text-[#505050] hover:text-[#808080]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Token Mint Input */}
                <div>
                  <label className="text-[8px] font-mono text-[#505050] uppercase block mb-2">TOKEN MINT ADDRESS</label>
                  <input
                    type="text"
                    value={editTokenMint}
                    onChange={(e) => setEditTokenMint(e.target.value)}
                    placeholder="Enter token mint address..."
                    className="w-full px-4 py-3 rounded-lg text-[11px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none"
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,242,255,0.2)' }}
                  />
                </div>
                
                {/* Dev Wallet Input */}
                <div>
                  <label className="text-[8px] font-mono text-[#505050] uppercase block mb-2">DEV WALLET PRIVATE KEY (leave empty to keep current)</label>
                  <div className="relative">
                    <input
                      type={showDevWallet ? 'text' : 'password'}
                      value={editDevWallet}
                      onChange={(e) => setEditDevWallet(e.target.value)}
                      placeholder="Enter new private key to change..."
                      className="w-full px-4 py-3 pr-12 rounded-lg text-[11px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none"
                      style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,180,0,0.2)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowDevWallet(!showDevWallet)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#808080]"
                    >
                      {showDevWallet ? <EyeOffIcon className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                {/* Save Button */}
                <motion.button
                  onClick={handleSaveProjectSettings}
                  disabled={isSavingProject}
                  className="w-full py-3 rounded-lg text-[10px] font-mono uppercase disabled:opacity-50"
                  style={{ background: 'rgba(0,242,255,0.15)', border: '1px solid rgba(0,242,255,0.4)', color: '#00F2FF' }}
                  whileHover={{ scale: 1.01, boxShadow: '0 0 20px rgba(0,242,255,0.2)' }}
                  whileTap={{ scale: 0.99 }}
                >
                  {isSavingProject ? 'SAVING...' : 'SAVE CHANGES'}
                </motion.button>
              </div>
            ) : (
              /* Normal View */
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <Shield className="w-4 h-4 text-[#00F2FF]" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-mono text-[#00F2FF]">{tokenData?.name || 'Click SYNC to load'}</span>
                        <span className="text-[10px] font-mono text-[#606060]">${tokenData?.symbol || '...'}</span>
                        {tokenData?.complete === false && <span className="text-[7px] font-mono px-2 py-0.5 rounded-full bg-[#FFB400]/20 text-[#FFB400]">BONDING</span>}
                        {tokenData?.complete === true && <span className="text-[7px] font-mono px-2 py-0.5 rounded-full bg-[#00FF88]/20 text-[#00FF88]">BONDED</span>}
                      </div>
                      <div className="text-[9px] font-mono text-[#505050]">
                        {tokenMint ? `${tokenMint.slice(0, 20)}...${tokenMint.slice(-8)}` : 'No token configured - click EDIT'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Market Cap */}
                    <div className="text-right mr-4">
                      <div className="text-[8px] font-mono text-[#505050] uppercase">MARKET CAP</div>
                      <div className="text-[14px] font-mono text-[#00F2FF]">${tokenData?.usd_market_cap?.toLocaleString() || '...'}</div>
                    </div>
                    
                    {/* Edit Button */}
                    <motion.button
                      onClick={handleStartEditing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-mono uppercase"
                      style={{ background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.3)', color: '#FFB400' }}
                      whileHover={{ scale: 1.02, boxShadow: '0 0 15px rgba(255,180,0,0.2)' }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Edit2 className="w-3 h-3" />
                      EDIT
                    </motion.button>
                    
                    {/* Claim Fees Button */}
                    <motion.button
                      onClick={handleClaimFees}
                      disabled={isClaiming || !tokenMint}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-mono uppercase disabled:opacity-50"
                      style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)', color: '#00FF88' }}
                      whileHover={{ scale: 1.02, boxShadow: '0 0 15px rgba(0,255,136,0.2)' }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                      {isClaiming ? 'CLAIMING...' : 'CLAIM FEES'}
                    </motion.button>
                    
                    {/* Sync Button */}
                    <motion.button
                      onClick={handleSync}
                      disabled={isSyncing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-mono uppercase disabled:opacity-50"
                      style={{ background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.2)', color: '#00F2FF' }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'SYNCING...' : 'SYNC'}
                    </motion.button>
                    
                    {/* Delete Project Button */}
                    <motion.button
                      onClick={handleDeleteProject}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-mono uppercase"
                      style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', color: '#FF4444' }}
                      whileHover={{ scale: 1.02, boxShadow: '0 0 15px rgba(255,68,68,0.2)' }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Trash2 className="w-3 h-3" />
                      DELETE
                    </motion.button>
                  </div>
                </div>
              </>
            )}
            
            {/* Auto-Claim Row */}
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'rgba(192,192,192,0.06)' }}>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setAutoClaimEnabled(!autoClaimEnabled)}
                  className="flex items-center gap-2"
                >
                  <div className="w-8 h-4 rounded-full relative" style={{ background: autoClaimEnabled ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.1)' }}>
                    <motion.div 
                      className="absolute top-0.5 w-3 h-3 rounded-full" 
                      style={{ background: autoClaimEnabled ? '#00FF88' : '#404040' }} 
                      animate={{ left: autoClaimEnabled ? '16px' : '2px' }} 
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[#808080] uppercase">AUTO-CLAIM</span>
                </button>
                
                {autoClaimEnabled && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-[#505050]" />
                    <span className="text-[8px] font-mono text-[#505050]">EVERY</span>
                    <input
                      type="number"
                      value={autoClaimInterval}
                      onChange={(e) => setAutoClaimInterval(Number(e.target.value))}
                      min={5}
                      max={1440}
                      className="w-16 px-2 py-1 rounded text-[9px] font-mono text-[#00F2FF] text-center outline-none"
                      style={{ background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)' }}
                    />
                    <span className="text-[8px] font-mono text-[#505050]">MIN</span>
                  </div>
                )}
              </div>
              
              <div className="text-[8px] font-mono text-[#404040]">
                Creator: {tokenData?.creator ? `${tokenData.creator.slice(0, 8)}...${tokenData.creator.slice(-4)}` : '...'}
              </div>
            </div>
            
            {/* Auto-Sync Row */}
            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'rgba(192,192,192,0.06)' }}>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                  className="flex items-center gap-2"
                >
                  <div className="w-8 h-4 rounded-full relative" style={{ background: autoSyncEnabled ? 'rgba(0,242,255,0.3)' : 'rgba(255,255,255,0.1)' }}>
                    <motion.div 
                      className="absolute top-0.5 w-3 h-3 rounded-full" 
                      style={{ background: autoSyncEnabled ? '#00F2FF' : '#404040' }} 
                      animate={{ left: autoSyncEnabled ? '16px' : '2px' }} 
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[#808080] uppercase">AUTO-SYNC</span>
                </button>
                
                {autoSyncEnabled && (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 text-[#505050]" />
                    <span className="text-[8px] font-mono text-[#505050]">EVERY</span>
                    <input
                      type="number"
                      value={autoSyncInterval}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (value >= 10 && value <= 3600) {
                          setAutoSyncInterval(value);
                        }
                      }}
                      min={10}
                      max={3600}
                      className="w-20 px-2 py-1 rounded text-[9px] font-mono text-[#00F2FF] text-center outline-none"
                      style={{ background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)' }}
                    />
                    <span className="text-[8px] font-mono text-[#505050]">SEC</span>
                  </div>
                )}
              </div>
              
              <div className="text-[8px] font-mono text-[#404040]">
                {autoSyncEnabled ? `Next sync in ~${Math.floor(autoSyncInterval / 60)}m ${autoSyncInterval % 60}s` : 'Disabled'}
              </div>
            </div>
          </motion.div>

          {/* PARRY ENGINE CONTROL */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="p-6 rounded-2xl mb-6"
            style={{ 
              background: parryRunning 
                ? 'linear-gradient(135deg, rgba(0,242,255,0.08) 0%, rgba(0,0,0,0.4) 100%)' 
                : 'rgba(0,0,0,0.3)', 
              backdropFilter: 'blur(20px)', 
              border: parryRunning 
                ? '1px solid rgba(0,242,255,0.3)' 
                : '1px solid rgba(192,192,192,0.06)' 
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center ${parryRunning ? 'bg-[#00F2FF]/20' : 'bg-white/5'}`}>
                  <Brain className={`w-6 h-6 ${parryRunning ? 'text-[#00F2FF]' : 'text-[#606060]'}`} />
                  {parryRunning && (
                    <motion.div 
                      className="absolute inset-0 rounded-xl" 
                      style={{ border: '1px solid rgba(0,242,255,0.5)' }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[#C0C0C0] uppercase" style={{ letterSpacing: '0.15em' }}>
                      PARRY ENGINE
                    </span>
                    <span className={`text-[7px] font-mono px-2 py-0.5 rounded-full ${parryRunning ? 'bg-[#00F2FF]/20 text-[#00F2FF]' : 'bg-white/5 text-[#606060]'}`}>
                      {parryRunning ? 'RUNNING' : 'STOPPED'}
                    </span>
                  </div>
                  {parryStatus && parryRunning && (
                    <div className="text-[8px] font-mono text-[#505050] mt-1">
                      Uptime: {Math.floor(parryStatus.uptime / 60000)}m | TF: {parryStatus.timeframe}s | Data: {parryStatus.dataPoints} pts
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Log Preview */}
                {parryRunning && parryLogs.length > 0 && (
                  <div className="max-w-xs text-right">
                    <div className="text-[7px] font-mono text-[#00FF41] truncate">
                      {parryLogs[0]?.message?.slice(0, 50)}...
                    </div>
                  </div>
                )}
                
                {/* Start/Stop Button */}
                <motion.button
                  onClick={parryRunning ? stopParry : startParry}
                  disabled={parryStarting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-mono uppercase"
                  style={{
                    background: parryRunning 
                      ? 'rgba(255,77,77,0.15)' 
                      : 'rgba(0,242,255,0.15)',
                    border: `1px solid ${parryRunning ? 'rgba(255,77,77,0.4)' : 'rgba(0,242,255,0.4)'}`,
                    color: parryRunning ? '#FF4D4D' : '#00F2FF',
                    letterSpacing: '0.1em',
                  }}
                  whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${parryRunning ? 'rgba(255,77,77,0.3)' : 'rgba(0,242,255,0.3)'}` }}
                  whileTap={{ scale: 0.98 }}
                >
                  {parryStarting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : parryRunning ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {parryStarting ? 'STARTING...' : parryRunning ? 'STOP PARRY' : 'START PARRY'}
                </motion.button>
              </div>
            </div>
            
            {/* Live Log Feed */}
            {parryRunning && parryLogs.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-4 p-3 rounded-lg max-h-32 overflow-y-auto"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,65,0.1)' }}
              >
                <div className="space-y-1">
                  {parryLogs.slice(0, 8).map((log, i) => (
                    <div key={i} className="text-[8px] font-mono flex items-start gap-2">
                      <span className="text-[#505050]">
                        {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                      <span className={
                        log.type === 'trade' ? 'text-[#00FF41]' :
                        log.type === 'ai' ? 'text-[#FF00FF]' :
                        log.type === 'error' ? 'text-[#FF4D4D]' :
                        log.type === 'decision' ? 'text-[#00F2FF]' :
                        'text-[#808080]'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Bottom Grid: Strategies + Wallets */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Market-Making Strategies */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="p-6 rounded-2xl"
              style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-[#00F2FF]" />
                  <span className="text-[10px] font-mono text-[#808080] uppercase" style={{ letterSpacing: '0.15em' }}>STRATEGY TOGGLES</span>
                </div>
              </div>
              <div className="space-y-3">
                <StrategyToggle label="VOLUME BOTS" active={volumeBot} onToggle={() => handleToggleStrategy('volumeBot', !volumeBot)} description="Automated volume generation with Jito bundles" />
                <StrategyToggle label="PRICE STABILIZER" active={priceStabilizer} onToggle={() => handleToggleStrategy('priceStabilizer', !priceStabilizer)} description="Maintains price floor via strategic buys" />
                <StrategyToggle label="VOLUME FARMER" active={volumeFarmer} onToggle={() => handleToggleStrategy('volumeFarmer', !volumeFarmer)} description="Sells into net positive volume (anti-dump)" />
                {/* VANISH.TRADE - Coming Soon */}
                <div 
                  className="w-full p-5 rounded-xl text-left flex items-center justify-between opacity-50 cursor-not-allowed"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(192,192,192,0.06)' }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-[#606060] mb-1" style={{ letterSpacing: '0.1em' }}>VANISH.TRADE</span>
                      <span className="text-[7px] font-mono px-2 py-0.5 rounded-full bg-[#00F2FF]/10 text-[#00F2FF]">COMING SOON</span>
                    </div>
                    <div className="text-[8px] font-mono text-[#404040]">Hidden transactions via vanish.trade (anti-frontrun)</div>
                  </div>
                  <div className="w-10 h-5 rounded-full relative" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="absolute top-0.5 left-[2px] w-4 h-4 rounded-full" style={{ background: '#303030' }} />
                  </div>
                </div>
                <StrategyToggle 
                  label="TWITTER POSTS" 
                  active={config.twitterEnabled} 
                  onToggle={() => updateConfig('twitterEnabled', !config.twitterEnabled)} 
                  description="Auto-post schizo updates to X/Twitter" 
                />
              </div>
            </motion.div>

            {/* Wallet Management */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="p-6 rounded-2xl"
              style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Wallet className="w-4 h-4 text-[#00F2FF]" />
                  <span className="text-[10px] font-mono text-[#808080] uppercase" style={{ letterSpacing: '0.15em' }}>OPERATIONAL WALLETS</span>
                </div>
                <motion.button
                  onClick={handleAddWallet}
                  className="flex items-center gap-1 text-[8px] font-mono text-[#00F2FF] uppercase px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.2)', letterSpacing: '0.1em' }}
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(0,242,255,0.2)' }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Plus className="w-3 h-3" /> ADD
                </motion.button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#303030 transparent' }}>
                {wallets.map((wallet) => (
                  <WalletRow 
                    key={wallet.id} 
                    wallet={wallet}
                    onToggleActive={handleToggleWalletActive}
                    onDelete={handleDeleteWallet}
                    onEdit={handleEditWallet}
                  />
                ))}
                {wallets.length === 0 && (
                  <div className="text-center py-8 text-[10px] text-[#404040] font-mono">No wallets configured</div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(192,192,192,0.06)' }}>
                <span className="text-[8px] font-mono text-[#505050] uppercase">TOTAL BALANCE</span>
                <span className="text-[14px] font-mono text-[#00F2FF]">
                  {wallets.filter(w => w.isActive).reduce((sum, w) => sum + parseFloat(w.balance), 0).toFixed(1)} SOL
                </span>
              </div>
            </motion.div>
          </div>

          {/* API Keys Configuration Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-6 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}
          >
            <button
              onClick={() => setShowApiKeys(!showApiKeys)}
              className="w-full p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Key className="w-4 h-4 text-[#FFB400]" />
                <span className="text-[10px] font-mono text-[#808080] uppercase" style={{ letterSpacing: '0.15em' }}>
                  API KEYS & CREDENTIALS
                </span>
                <span className="text-[8px] font-mono text-[#404040]">(Your own keys - encrypted)</span>
              </div>
              {showApiKeys ? <ChevronUp className="w-4 h-4 text-[#505050]" /> : <ChevronDown className="w-4 h-4 text-[#505050]" />}
            </button>
            
            <AnimatePresence>
              {showApiKeys && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 pt-0 space-y-6">
                    
                    {/* DeepSeek AI */}
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.04)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <Bot className="w-3 h-3 text-[#00F2FF]" />
                        <span className="text-[9px] font-mono text-[#606060] uppercase" style={{ letterSpacing: '0.1em' }}>DEEPSEEK AI</span>
                        <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-[8px] font-mono text-[#00F2FF] hover:underline">Get API Key →</a>
                      </div>
                      <div className="relative">
                        <input
                          type={showPasswords.deepseek ? 'text' : 'password'}
                          value={apiKeys.deepseekApiKey}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, deepseekApiKey: e.target.value }))}
                          placeholder="sk-your-deepseek-api-key"
                          className="w-full px-4 py-3 pr-10 rounded-lg text-[10px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none"
                          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(192,192,192,0.1)' }}
                        />
                        <button
                          onClick={() => togglePasswordVisibility('deepseek')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#808080]"
                        >
                          {showPasswords.deepseek ? <EyeOffIcon className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Twitter API */}
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.04)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="w-3 h-3 text-[#1DA1F2]" />
                        <span className="text-[9px] font-mono text-[#606060] uppercase" style={{ letterSpacing: '0.1em' }}>TWITTER/X API</span>
                        <a href="https://developer.twitter.com/" target="_blank" rel="noopener noreferrer" className="text-[8px] font-mono text-[#00F2FF] hover:underline">Get API Keys →</a>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <input
                            type={showPasswords.twitterKey ? 'text' : 'password'}
                            value={apiKeys.twitterApiKey}
                            onChange={(e) => setApiKeys(prev => ({ ...prev, twitterApiKey: e.target.value }))}
                            placeholder="API Key"
                            className="w-full px-4 py-3 pr-10 rounded-lg text-[10px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(192,192,192,0.1)' }}
                          />
                          <button onClick={() => togglePasswordVisibility('twitterKey')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#808080]">
                            {showPasswords.twitterKey ? <EyeOffIcon className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPasswords.twitterSecret ? 'text' : 'password'}
                            value={apiKeys.twitterApiSecret}
                            onChange={(e) => setApiKeys(prev => ({ ...prev, twitterApiSecret: e.target.value }))}
                            placeholder="API Secret"
                            className="w-full px-4 py-3 pr-10 rounded-lg text-[10px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(192,192,192,0.1)' }}
                          />
                          <button onClick={() => togglePasswordVisibility('twitterSecret')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#808080]">
                            {showPasswords.twitterSecret ? <EyeOffIcon className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPasswords.twitterAccess ? 'text' : 'password'}
                            value={apiKeys.twitterAccessToken}
                            onChange={(e) => setApiKeys(prev => ({ ...prev, twitterAccessToken: e.target.value }))}
                            placeholder="Access Token"
                            className="w-full px-4 py-3 pr-10 rounded-lg text-[10px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(192,192,192,0.1)' }}
                          />
                          <button onClick={() => togglePasswordVisibility('twitterAccess')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#808080]">
                            {showPasswords.twitterAccess ? <EyeOffIcon className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPasswords.twitterAccessSecret ? 'text' : 'password'}
                            value={apiKeys.twitterAccessSecret}
                            onChange={(e) => setApiKeys(prev => ({ ...prev, twitterAccessSecret: e.target.value }))}
                            placeholder="Access Secret"
                            className="w-full px-4 py-3 pr-10 rounded-lg text-[10px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(192,192,192,0.1)' }}
                          />
                          <button onClick={() => togglePasswordVisibility('twitterAccessSecret')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#808080]">
                            {showPasswords.twitterAccessSecret ? <EyeOffIcon className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Custom AI Personality */}
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.04)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <Bot className="w-3 h-3 text-[#9B59B6]" />
                        <span className="text-[9px] font-mono text-[#606060] uppercase" style={{ letterSpacing: '0.1em' }}>CUSTOM AI PERSONALITY</span>
                      </div>
                      <textarea
                        value={customPersonality}
                        onChange={(e) => setCustomPersonality(e.target.value)}
                        placeholder="Define your AI's personality... (leave empty for default schizo style)"
                        rows={4}
                        className="w-full px-4 py-3 rounded-lg text-[10px] text-[#E0E0E0] placeholder-[#404040] font-mono outline-none resize-none"
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(192,192,192,0.1)' }}
                      />
                      <div className="text-[8px] font-mono text-[#404040] mt-2">
                        Tip: Describe how you want the AI to sound - casual, professional, meme-style, etc.
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <motion.button
                        onClick={handleSaveApiKeys}
                        disabled={apiKeysSaving}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-mono uppercase"
                        style={{ 
                          background: 'rgba(255,180,0,0.15)', 
                          border: '1px solid rgba(255,180,0,0.4)', 
                          color: '#FFB400' 
                        }}
                        whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(255,180,0,0.2)' }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Key className="w-3 h-3" />
                        {apiKeysSaving ? 'ENCRYPTING...' : 'SAVE API KEYS'}
                      </motion.button>
                    </div>

                    <div className="text-[8px] font-mono text-[#303030] text-center">
                      🔐 All keys are encrypted with AES-256-CBC before storage
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Advanced Config Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,192,192,0.06)' }}
          >
            <button
              onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
              className="w-full p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Sliders className="w-4 h-4 text-[#00F2FF]" />
                <span className="text-[10px] font-mono text-[#808080] uppercase" style={{ letterSpacing: '0.15em' }}>
                  ADVANCED PARRY CONFIG
                </span>
                <span className="text-[8px] font-mono text-[#404040]">(Adjustable Parameters)</span>
              </div>
              {showAdvancedConfig ? <ChevronUp className="w-4 h-4 text-[#505050]" /> : <ChevronDown className="w-4 h-4 text-[#505050]" />}
            </button>
            
            <AnimatePresence>
              {showAdvancedConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 pt-0 grid grid-cols-3 gap-6">
                    
                    {/* Market Cap Thresholds */}
                    <div className="space-y-3">
                      <div className="text-[9px] font-mono text-[#505050] uppercase mb-3" style={{ letterSpacing: '0.1em' }}>
                        MARKET CAP THRESHOLDS
                      </div>
                      <ConfigInput 
                        label="Min MC to Sell" 
                        value={config.minMcToSell} 
                        onChange={(v) => updateConfig('minMcToSell', v)} 
                        unit="$" 
                        min={50000} 
                        max={1000000} 
                        step={10000}
                        tooltip="Don't sell below this market cap"
                      />
                      <ConfigInput 
                        label="Light Sell MC" 
                        value={config.lightMcThreshold} 
                        onChange={(v) => updateConfig('lightMcThreshold', v)} 
                        unit="$" 
                        min={100000} 
                        max={1000000} 
                        step={10000}
                        tooltip="Start light selling here"
                      />
                      <ConfigInput 
                        label="Medium Sell MC" 
                        value={config.mediumMcThreshold} 
                        onChange={(v) => updateConfig('mediumMcThreshold', v)} 
                        unit="$" 
                        min={200000} 
                        max={2000000} 
                        step={50000}
                        tooltip="Medium selling intensity"
                      />
                      <ConfigInput 
                        label="Heavy Sell MC" 
                        value={config.heavyMcThreshold} 
                        onChange={(v) => updateConfig('heavyMcThreshold', v)} 
                        unit="$" 
                        min={500000} 
                        max={5000000} 
                        step={100000}
                        tooltip="Full selling intensity"
                      />
                    </div>

                    {/* Sell Percentages */}
                    <div className="space-y-3">
                      <div className="text-[9px] font-mono text-[#505050] uppercase mb-3" style={{ letterSpacing: '0.1em' }}>
                        SELL PERCENTAGES
                      </div>
                      <ConfigInput 
                        label="Light Sell %" 
                        value={config.lightSellPercent} 
                        onChange={(v) => updateConfig('lightSellPercent', v)} 
                        unit="%" 
                        min={1} 
                        max={15}
                        tooltip="% of buys to sell back (light)"
                      />
                      <ConfigInput 
                        label="Medium Sell %" 
                        value={config.mediumSellPercent} 
                        onChange={(v) => updateConfig('mediumSellPercent', v)} 
                        unit="%" 
                        min={5} 
                        max={20}
                        tooltip="% of buys to sell back (medium)"
                      />
                      <ConfigInput 
                        label="Heavy Sell %" 
                        value={config.heavySellPercent} 
                        onChange={(v) => updateConfig('heavySellPercent', v)} 
                        unit="%" 
                        min={10} 
                        max={25}
                        tooltip="% of buys to sell back (heavy)"
                      />
                      <ConfigInput 
                        label="Volume Farm %" 
                        value={config.volumeFarmingPercent} 
                        onChange={(v) => updateConfig('volumeFarmingPercent', v)} 
                        unit="%" 
                        min={3} 
                        max={15}
                        tooltip="% to sell into net positive volume"
                      />
                    </div>

                    {/* Trade & Wallet Limits */}
                    <div className="space-y-3">
                      <div className="text-[9px] font-mono text-[#505050] uppercase mb-3" style={{ letterSpacing: '0.1em' }}>
                        TRADE & WALLET LIMITS
                      </div>
                      <ConfigInput 
                        label="Max Sell/Trade" 
                        value={config.maxSellPerTrade} 
                        onChange={(v) => updateConfig('maxSellPerTrade', v)} 
                        unit="SOL" 
                        min={0.1} 
                        max={10}
                        step={0.1}
                        tooltip="Max SOL per sell transaction"
                      />
                      <ConfigInput 
                        label="Max Buy/Trade" 
                        value={config.maxBuyPerTrade} 
                        onChange={(v) => updateConfig('maxBuyPerTrade', v)} 
                        unit="SOL" 
                        min={0.1} 
                        max={5}
                        step={0.1}
                        tooltip="Max SOL per buy transaction"
                      />
                      <ConfigInput 
                        label="Cooldown" 
                        value={config.cooldownSeconds} 
                        onChange={(v) => updateConfig('cooldownSeconds', v)} 
                        unit="sec" 
                        min={15} 
                        max={300}
                        step={5}
                        tooltip="Seconds between trades"
                      />
                      <ConfigInput 
                        label="Max Supply/Wallet" 
                        value={config.maxSupplyPercent} 
                        onChange={(v) => updateConfig('maxSupplyPercent', v)} 
                        unit="%" 
                        min={0.5} 
                        max={5}
                        step={0.5}
                        tooltip="Max % supply per wallet (anti-whale)"
                      />
                    </div>

                  </div>

                  {/* Execution Settings */}
                  <div className="px-6 pb-6">
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(192,192,192,0.04)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <EyeOff className="w-3 h-3 text-[#808080]" />
                        <span className="text-[9px] font-mono text-[#505050] uppercase" style={{ letterSpacing: '0.1em' }}>EXECUTION SETTINGS</span>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <ConfigInput 
                          label="Slippage" 
                          value={config.slippage} 
                          onChange={(v) => updateConfig('slippage', v)} 
                          unit="%" 
                          min={1} 
                          max={30}
                          tooltip="Transaction slippage tolerance"
                        />
                        <ConfigInput 
                          label="Priority Fee" 
                          value={config.priorityFee} 
                          onChange={(v) => updateConfig('priorityFee', v)} 
                          unit="SOL" 
                          min={0.00001} 
                          max={0.001}
                          step={0.00001}
                          tooltip="Priority fee for faster txs"
                        />
                        <ConfigInput 
                          label="Max SOL/Wallet" 
                          value={config.maxSolPerWallet} 
                          onChange={(v) => updateConfig('maxSolPerWallet', v)} 
                          unit="SOL" 
                          min={1} 
                          max={50}
                          tooltip="Max SOL value per wallet"
                        />
                        <ConfigInput 
                          label="Tweet Interval" 
                          value={config.tweetIntervalMinutes} 
                          onChange={(v) => updateConfig('tweetIntervalMinutes', v)} 
                          unit="min" 
                          min={10} 
                          max={120}
                          step={5}
                          tooltip="Minutes between Twitter posts"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Button & Config Info */}
                  <div className="px-6 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[8px] font-mono text-[#303030]">
                        * Core strategy (EMA, Fib, RSI) cannot be changed
                      </div>
                      <motion.button
                        onClick={saveConfigToDb}
                        disabled={configSaving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-mono uppercase"
                        style={{ 
                          background: 'rgba(0,242,255,0.1)', 
                          border: '1px solid rgba(0,242,255,0.3)', 
                          color: '#00F2FF' 
                        }}
                        whileHover={{ scale: 1.02, boxShadow: '0 0 15px rgba(0,242,255,0.2)' }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Save className="w-3 h-3" />
                        {configSaving ? 'SAVING...' : 'SAVE CONFIG'}
                      </motion.button>
                    </div>
                    <div className="text-[8px] font-mono text-[#303030] text-right">
                      Config encrypted & saved to Supabase
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <span className="text-[7px] font-mono text-[#181818] uppercase" style={{ letterSpacing: '0.25em' }}>[ SOVEREIGN_HUB // V20 ]</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <DeleteConfirmModal
        isOpen={showDeleteProjectModal}
        onClose={() => setShowDeleteProjectModal(false)}
        onConfirm={confirmDeleteProject}
        title="Delete Project"
        message="This will delete your entire project configuration including token mint and all wallets. You'll be redirected to onboarding to set up a new project. This action cannot be undone."
      />

      <DeleteConfirmModal
        isOpen={showDeleteWalletModal}
        onClose={() => setShowDeleteWalletModal(false)}
        onConfirm={confirmDeleteWallet}
        title="Delete Wallet"
        message="Are you sure you want to remove this wallet from your operational wallets?"
      />

      <WalletModal
        isOpen={showWalletModal}
        onClose={() => { setShowWalletModal(false); setSelectedWallet(null); }}
        onSave={handleSaveWallet}
        editWallet={selectedWallet}
      />
    </div>
    </>
  );
}
