'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { checkUserProjectStatus } from '@/app/actions/auth';
import { logError } from '@/lib/logger-client';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Background Sentinel (Large, Faded, Melts into background)
// ═══════════════════════════════════════════════════════════════════════════════
const BackgroundSentinel = ({ 
  state,
  mouseX, 
  mouseY 
}: { 
  state: 'idle' | 'auth';
  mouseX: any;
  mouseY: any;
}) => {
  const tiltX = useTransform(mouseY, [0, 1], [5, -5]);
  const tiltY = useTransform(mouseX, [0, 1], [-5, 5]);
  const smoothTiltX = useSpring(tiltX, { stiffness: 30, damping: 25 });
  const smoothTiltY = useSpring(tiltY, { stiffness: 30, damping: 25 });

  const getVideoSrc = () => '/parry_fullintro.mp4';

  return (
    <motion.div
      className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-0"
      style={{
        top: '12%',
        rotateX: smoothTiltX,
        rotateY: smoothTiltY,
        transformStyle: 'preserve-3d',
      }}
    >
      <div 
        className="relative overflow-hidden"
        style={{
          width: '550px',
          height: '550px',
          maskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
          background: '#000000',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.video
            key={state}
            src={getVideoSrc()}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            style={{ 
              mixBlendMode: 'screen',
              background: '#000000',
            }}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: state === 'auth' ? 0.6 : 0.45,
              filter: state === 'auth' ? 'brightness(1.2) hue-rotate(15deg)' : 'brightness(1)',
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            onError={(e) => {
              (e.target as HTMLVideoElement).src = '/substrate-core.mp4';
            }}
          />
        </AnimatePresence>
      </div>

      <motion.div 
        className="absolute whitespace-nowrap"
        style={{ bottom: '90px' }}
      >
        <span 
          className="text-[9px] font-mono uppercase"
          style={{ 
            letterSpacing: '0.3em', 
            color: state === 'auth' ? '#FFB400' : '#00F2FF',
            textShadow: `0 0 12px ${state === 'auth' ? 'rgba(255,180,0,0.5)' : 'rgba(0,242,255,0.5)'}`,
            opacity: 0.8,
          }}
        >
          [ {state === 'auth' ? 'AUTHENTICATING' : 'SENTINEL AWAITING'} ]
        </span>
      </motion.div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Glassmorphic Initialize Button
// ═══════════════════════════════════════════════════════════════════════════════
const InitializeButton = ({ 
  icon, 
  label, 
  onClick,
  disabled,
}: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void;
  disabled?: boolean;
}) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    className="w-full flex items-center justify-center gap-4 px-10 py-6 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    style={{
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(192,192,192,0.1)',
    }}
    whileHover={!disabled ? { 
      scale: 1.02,
      background: 'rgba(0,242,255,0.08)',
      borderColor: 'rgba(0,242,255,0.35)',
      boxShadow: '0 0 30px rgba(0,242,255,0.15)',
    } : {}}
    whileTap={!disabled ? { scale: 0.98 } : {}}
  >
    {icon}
    <span className="text-[12px] text-[#C0C0C0] font-mono uppercase" style={{ letterSpacing: '0.15em' }}>
      {label}
    </span>
  </motion.button>
);

// Icons
const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#C0C0C0]">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#909090" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#707070" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#606060" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#505050" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: Login Content (with useSearchParams)
// ═══════════════════════════════════════════════════════════════════════════════
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [authState, setAuthState] = useState<'idle' | 'auth'>('idle');
  
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Check if returning from OAuth callback - only auto-redirect on callback
  const isCallback = searchParams.get('callback') === 'true';

  // Handle redirect ONLY after OAuth callback (not on initial page load)
  useEffect(() => {
    // Only auto-redirect if coming back from OAuth callback
    if (isCallback && status === 'authenticated' && session?.user) {
      // Use database status from session (hasProject is set in auth.ts from DB)
      if (session.user.hasProject) {
        router.push('/hub');
      } else {
        router.push('/onboarding');
      }
    }
  }, [session, status, router, isCallback]);

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX / window.innerWidth);
    mouseY.set(e.clientY / window.innerHeight);
  };

  // Handle OAuth Sign In
  const handleSignIn = async (provider: 'twitter' | 'google') => {
    setIsLoading(true);
    setAuthState('auth');
    
    try {
      await signIn(provider, { 
        callbackUrl: '/login?callback=true',
      });
    } catch (error) {
      logError('Auth error', error as Error);
      setIsLoading(false);
      setAuthState('idle');
    }
  };

  // Show loading while checking session or during callback
  if (status === 'loading' || (status === 'authenticated' && isCallback)) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <motion.div
          className="w-8 h-8 border-2 border-[#00F2FF] border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <span className="text-[10px] text-[#00F2FF] font-mono uppercase" style={{ letterSpacing: '0.2em' }}>
          {isCallback ? 'VERIFYING IDENTITY...' : 'LOADING...'}
        </span>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen relative overflow-hidden" 
      style={{ backgroundColor: '#000000' }}
      onMouseMove={handleMouseMove}
    >
      {/* Background - Pure Obsidian */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(0,40,60,0.1) 0%, transparent 60%)' }} />
      </div>

      {/* Scanline */}
      <div 
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{ opacity: 0.01, background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.006) 2px, rgba(255,255,255,0.006) 4px)' }}
      />

      {/* Back Button */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="fixed top-6 left-6 z-50">
        <Link href="/" className="flex items-center gap-2 text-[#404040] hover:text-[#00F2FF] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[9px] font-mono uppercase" style={{ letterSpacing: '0.2em' }}>EXIT</span>
        </Link>
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        
        {/* Background Sentinel */}
        <BackgroundSentinel state={authState} mouseX={mouseX} mouseY={mouseY} />

        {/* Entry Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[480px] relative z-10 mt-[19rem]"
        >
          <div 
            className="relative rounded-[3rem] overflow-hidden p-12"
            style={{
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(60px)',
              WebkitBackdropFilter: 'blur(60px)',
              border: '1px solid rgba(192,192,192,0.08)',
              boxShadow: '0 0 80px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div className="text-center mb-12">
              <h1 
                className="text-[20px] font-mono text-[#00F2FF] mb-3"
                style={{ textShadow: '0 0 30px rgba(0,242,255,0.5)', letterSpacing: '0.12em' }}
              >
                SOVEREIGN COMMAND
              </h1>
              <p className="text-[10px] text-[#505050] font-mono" style={{ letterSpacing: '0.1em' }}>
                Initialize your connection to the ANUS Substrate
              </p>
            </div>

            {/* Show different UI based on auth status */}
            {status === 'authenticated' && session?.user ? (
              // Already logged in - show continue option
              <div className="space-y-6">
                <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.15)' }}>
                  <p className="text-[10px] text-[#00F2FF] font-mono mb-2" style={{ letterSpacing: '0.1em' }}>
                    IDENTITY VERIFIED
                  </p>
                  <p className="text-[12px] text-[#E0E0E0] font-mono">
                    {session.user.name || session.user.email}
                  </p>
                </div>
                
                <motion.button
                  onClick={async () => {
                    // Fresh database check - don't rely on cached session
                    try {
                      const status = await checkUserProjectStatus();
                      router.push(status.redirect);
                    } catch (error) {
                      logError('Error checking status', error as Error);
                      router.push('/onboarding');
                    }
                  }}
                  className="w-full py-4 rounded-xl font-mono text-[11px] uppercase transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,242,255,0.15) 0%, rgba(0,150,200,0.08) 100%)',
                    border: '1px solid rgba(0,242,255,0.3)',
                    color: '#00F2FF',
                    letterSpacing: '0.15em',
                    textShadow: '0 0 15px rgba(0,242,255,0.5)',
                  }}
                  whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(0,242,255,0.3)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  [ CONTINUE TO COMMAND CENTER ]
                </motion.button>

                <div className="text-center">
                  <button 
                    onClick={() => {
                      // Sign out and stay on login page
                      import('next-auth/react').then(({ signOut }) => {
                        signOut({ redirect: false });
                      });
                    }}
                    className="text-[8px] text-[#404040] hover:text-[#00F2FF] font-mono transition-colors"
                    style={{ letterSpacing: '0.1em' }}
                  >
                    USE DIFFERENT ACCOUNT
                  </button>
                </div>
              </div>
            ) : (
              // Not logged in - show login buttons
              <>
                <div className="space-y-4">
                  <InitializeButton 
                    icon={<XIcon />}
                    label="INITIALIZE VIA X"
                    onClick={() => handleSignIn('twitter')}
                    disabled={isLoading}
                  />
                  <InitializeButton 
                    icon={<GoogleIcon />}
                    label="INITIALIZE VIA GMAIL"
                    onClick={() => handleSignIn('google')}
                    disabled={isLoading}
                  />
                </div>

                {/* Loading State */}
                {isLoading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-8 flex items-center justify-center gap-3"
                  >
                    <motion.div
                      className="w-4 h-4 border-2 border-[#00F2FF] border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <span className="text-[10px] text-[#00F2FF] font-mono uppercase" style={{ letterSpacing: '0.2em' }}>
                      CONNECTING...
                    </span>
                  </motion.div>
                )}

                {/* Info Text */}
                <div className="mt-8 text-center">
                  <p className="text-[8px] text-[#353535] font-mono" style={{ letterSpacing: '0.1em' }}>
                    NEW USERS → ONBOARDING PORTAL<br/>
                    RETURNING USERS → PRIVATE HUB
                  </p>
                </div>
              </>
            )}

            {/* Footer */}
            <div className="mt-8 text-center">
              <span className="text-[7px] font-mono text-[#202020] uppercase" style={{ letterSpacing: '0.25em' }}>
                [ SOVEREIGN_GATE // V19 ]
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: Login Page (with Suspense)
// ═══════════════════════════════════════════════════════════════════════════════
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <motion.div
          className="w-8 h-8 border-2 border-[#00F2FF] border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <span className="text-[10px] text-[#00F2FF] font-mono uppercase" style={{ letterSpacing: '0.2em' }}>
          LOADING...
        </span>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
