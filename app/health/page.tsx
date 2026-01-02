'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Activity } from 'lucide-react';
import Link from 'next/link';
import { logError } from '@/lib/logger-client';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Status Indicator
// ═══════════════════════════════════════════════════════════════════════════════
const StatusIndicator = ({ status, label }: { status: 'ok' | 'error' | 'warning' | 'not_configured'; label: string }) => {
  const getIcon = () => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="w-4 h-4 text-[#00F2FF]" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-[#FF0040]" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-[#FFA500]" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-[#505050]" />;
    }
  };

  const getColor = () => {
    switch (status) {
      case 'ok':
        return 'text-[#00F2FF]';
      case 'error':
        return 'text-[#FF0040]';
      case 'warning':
        return 'text-[#FFA500]';
      default:
        return 'text-[#505050]';
    }
  };

  return (
    <div className="flex items-center gap-3">
      {getIcon()}
      <span className={`text-sm font-mono ${getColor()}`}>{label}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Status Card
// ═══════════════════════════════════════════════════════════════════════════════
const StatusCard = ({ 
  title, 
  status, 
  responseTime, 
  error, 
  endpoint,
  className = ''
}: { 
  title: string; 
  status: 'ok' | 'error' | 'warning' | 'not_configured';
  responseTime?: number;
  error?: string;
  endpoint?: string;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white/[0.03] backdrop-blur-2xl rounded-[3.5rem] p-6 border border-white/10 ${className}`}
    style={{
      borderTop: '1px solid rgba(192,192,192,0.2)',
      borderLeft: '1px solid rgba(192,192,192,0.15)',
      borderRight: '1px solid rgba(192,192,192,0.05)',
      borderBottom: '1px solid rgba(192,192,192,0.05)',
    }}
  >
    <div className="flex items-center justify-between mb-4">
      <h3 
        className="text-sm font-mono uppercase text-[#C0C0C0]"
        style={{ letterSpacing: '0.2em', textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF' }}
      >
        {title}
      </h3>
      <StatusIndicator status={status} label={status === 'ok' ? 'OPERATIONAL' : status === 'error' ? 'ERROR' : status === 'warning' ? 'WARNING' : 'NOT CONFIGURED'} />
    </div>
    
    {responseTime !== undefined && (
      <div className="text-xs text-[#808080] font-mono mb-2">
        Response Time: <span className="text-[#00F2FF]">{responseTime}ms</span>
      </div>
    )}
    
    {endpoint && (
      <div className="text-xs text-[#808080] font-mono mb-2 break-all">
        Endpoint: <span className="text-[#C0C0C0]">{endpoint}</span>
      </div>
    )}
    
    {error && (
      <div className="text-xs text-[#FF0040] font-mono mt-2">
        Error: {error}
      </div>
    )}
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: Health Check Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function HealthPage() {
  const [healthData, setHealthData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthData(data);
      setLastUpdate(new Date());
    } catch (error) {
      logError('Health check fetch error', error as Error);
      setHealthData({ status: 'error', error: 'Failed to fetch health data' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getOverallStatusColor = () => {
    if (!healthData) return '#505050';
    switch (healthData.status) {
      case 'healthy':
        return '#00F2FF';
      case 'degraded':
        return '#FFA500';
      case 'unhealthy':
        return '#FF0040';
      default:
        return '#505050';
    }
  };

  const getOverallStatusLabel = () => {
    if (!healthData) return 'CHECKING...';
    switch (healthData.status) {
      case 'healthy':
        return 'ALL SYSTEMS OPERATIONAL';
      case 'degraded':
        return 'DEGRADED PERFORMANCE';
      case 'unhealthy':
        return 'SYSTEM ERROR';
      default:
        return 'UNKNOWN';
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#A1A1AA] font-mono relative overflow-hidden">
      {/* Film Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.01] film-grain-inner z-50" />
      
      {/* Background Water Ripple */}
      <div className="fixed inset-0 water-ripple-bg pointer-events-none" />

      <div className="container mx-auto px-6 py-8 max-w-6xl relative z-10">
        {/* Header */}
        <header className="mb-8 border-b border-white/10 pb-6" style={{ borderWidth: '0.5px' }}>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#A1A1AA] hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm uppercase" style={{ fontWeight: 300, letterSpacing: '0.2em' }}>BACK TO HUB</span>
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 
                className="text-4xl md:text-5xl font-light text-white mb-2 uppercase"
                style={{ fontWeight: 300, letterSpacing: '0.1em', textShadow: '-0.5px 0 #FF0040, 0.5px 0 #00D4FF' }}
              >
                SYSTEM HEALTH
              </h1>
              <p className="text-sm text-[#A1A1AA] uppercase tracking-widest" style={{ fontWeight: 300 }}>
                REAL-TIME STATUS MONITORING
              </p>
            </div>
            
            <motion.button
              onClick={fetchHealth}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/10 rounded-full hover:bg-white/[0.05] transition-colors disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RefreshCw className={`w-4 h-4 text-[#00F2FF] ${isLoading ? 'animate-spin' : ''}`} />
              <span className="text-xs uppercase font-mono" style={{ letterSpacing: '0.1em' }}>REFRESH</span>
            </motion.button>
          </div>
        </header>

        {/* Overall Status */}
        {healthData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 bg-white/[0.03] backdrop-blur-2xl rounded-[3.5rem] p-8 border border-white/10"
            style={{
              borderTop: '1px solid rgba(192,192,192,0.2)',
              borderLeft: '1px solid rgba(192,192,192,0.15)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div 
                  className="text-2xl font-mono uppercase mb-2"
                  style={{ 
                    color: getOverallStatusColor(),
                    letterSpacing: '0.2em',
                    textShadow: `0 0 20px ${getOverallStatusColor()}40`
                  }}
                >
                  {getOverallStatusLabel()}
                </div>
                <div className="text-xs text-[#808080] font-mono">
                  Status: <span className="text-[#C0C0C0] uppercase">{healthData.status}</span>
                </div>
                {lastUpdate && (
                  <div className="text-xs text-[#808080] font-mono mt-1">
                    Last Update: {lastUpdate.toLocaleTimeString()}
                  </div>
                )}
              </div>
              
              <div className="text-right">
                <div className="text-xs text-[#808080] font-mono mb-1">
                  Uptime: <span className="text-[#00F2FF]">{Math.floor(healthData.uptime / 1000 / 60)}m {Math.floor((healthData.uptime / 1000) % 60)}s</span>
                </div>
                <div className="text-xs text-[#808080] font-mono">
                  Version: <span className="text-[#C0C0C0]">{healthData.version}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Status Cards */}
        {isLoading && !healthData ? (
          <div className="flex items-center justify-center py-20">
            <Activity className="w-8 h-8 text-[#00F2FF] animate-pulse" />
            <span className="ml-4 text-sm font-mono text-[#C0C0C0]">LOADING SYSTEM STATUS...</span>
          </div>
        ) : healthData?.checks ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Database */}
            <StatusCard
              title="DATABASE"
              status={healthData.checks.database.status}
              responseTime={healthData.checks.database.responseTime}
              error={healthData.checks.database.error}
            />

            {/* RPC */}
            <StatusCard
              title="SOLANA RPC"
              status={healthData.checks.rpc.status}
              responseTime={healthData.checks.rpc.responseTime}
              error={healthData.checks.rpc.error}
              endpoint={healthData.checks.rpc.endpoint}
            />

            {/* Moralis API */}
            <StatusCard
              title="MORALIS API"
              status={healthData.checks.apis.moralis.status}
              error={healthData.checks.apis.moralis.error}
            />

            {/* DexScreener API */}
            <StatusCard
              title="DEXSCREENER API"
              status={healthData.checks.apis.dexscreener.status}
              responseTime={healthData.checks.apis.dexscreener.responseTime}
              error={healthData.checks.apis.dexscreener.error}
            />

            {/* Environment */}
            <div className="md:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.03] backdrop-blur-2xl rounded-[3.5rem] p-6 border border-white/10"
                style={{
                  borderTop: '1px solid rgba(192,192,192,0.2)',
                  borderLeft: '1px solid rgba(192,192,192,0.15)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 
                    className="text-sm font-mono uppercase text-[#C0C0C0]"
                    style={{ letterSpacing: '0.2em', textShadow: '-0.3px 0 #FF0040, 0.3px 0 #00D4FF' }}
                  >
                    ENVIRONMENT
                  </h3>
                  <StatusIndicator 
                    status={healthData.checks.environment.status} 
                    label={healthData.checks.environment.status === 'ok' ? 'CONFIGURED' : 'WARNING'} 
                  />
                </div>
                
                {healthData.checks.environment.missing && healthData.checks.environment.missing.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-[#FFA500] font-mono mb-2">Missing Variables:</div>
                    <div className="flex flex-wrap gap-2">
                      {healthData.checks.environment.missing.map((key: string) => (
                        <span key={key} className="px-3 py-1 bg-[#FFA500]/10 border border-[#FFA500]/30 rounded-full text-xs font-mono text-[#FFA500]">
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {healthData.checks.environment.configured && (
                  <div>
                    <div className="text-xs text-[#808080] font-mono mb-2">Configured Variables:</div>
                    <div className="flex flex-wrap gap-2">
                      {healthData.checks.environment.configured.map((key: string) => (
                        <span key={key} className="px-3 py-1 bg-[#00F2FF]/10 border border-[#00F2FF]/30 rounded-full text-xs font-mono text-[#00F2FF]">
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <XCircle className="w-12 h-12 text-[#FF0040] mx-auto mb-4" />
            <p className="text-sm font-mono text-[#FF0040]">Failed to load health data</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p 
            className="text-[7px] text-[#505050] font-mono uppercase"
            style={{ letterSpacing: '0.2em', textShadow: '-0.2px 0 #FF0040, 0.2px 0 #00D4FF' }}
          >
            SYSTEM HEALTH MONITOR // V8.01
          </p>
        </footer>
      </div>
    </div>
  );
}
