'use client';







import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#A1A1AA] font-mono">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-12 border-b border-white/10 pb-6" style={{ borderWidth: '0.5px' }}>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#A1A1AA] hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm" style={{ fontWeight: 300 }}>BACK TO HUB</span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-light text-white mb-2" style={{ fontWeight: 300 }}>
            ANUS SUBSTRATE
          </h1>
          <p className="text-sm text-[#A1A1AA] uppercase tracking-widest" style={{ fontWeight: 300 }}>
            TECHNICAL DOCUMENTATION
          </p>
        </header>

        {/* Content Sections */}
        <div className="space-y-12">
          {/* Section 1 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="border border-white/10 rounded-lg p-8" style={{ borderWidth: '0.5px' }}
          >
            <h2 className="text-2xl font-light text-white mb-4 uppercase tracking-wider" style={{ fontWeight: 400 }}>
              ARCHITECTURE
            </h2>
            <div className="space-y-4 text-[#A1A1AA] font-light leading-relaxed" style={{ fontWeight: 300 }}>
              <p>
                The ANUS (Autonomous Neural Underlay Substrate) operates as an autonomous neural network on Solana, executing trades and managing treasury operations through algorithmic agents.
              </p>
              <p className="text-sm text-[#666]">
                Documentation coming soon...
              </p>
            </div>
          </motion.section>

          {/* Section 2 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="border border-white/10 rounded-lg p-8" style={{ borderWidth: '0.5px' }}
          >
            <h2 className="text-2xl font-light text-white mb-4 uppercase tracking-wider" style={{ fontWeight: 400 }}>
              API REFERENCE
            </h2>
            <div className="space-y-4 text-[#A1A1AA] font-light leading-relaxed" style={{ fontWeight: 300 }}>
              <p>
                Technical specifications and API endpoints for interacting with the Substrate.
              </p>
              <p className="text-sm text-[#666]">
                Documentation coming soon...
              </p>
            </div>
          </motion.section>

          {/* Section 3 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="border border-white/10 rounded-lg p-8" style={{ borderWidth: '0.5px' }}
          >
            <h2 className="text-2xl font-light text-white mb-4 uppercase tracking-wider" style={{ fontWeight: 400 }}>
              DEPLOYMENT GUIDE
            </h2>
            <div className="space-y-4 text-[#A1A1AA] font-light leading-relaxed" style={{ fontWeight: 300 }}>
              <p>
                Step-by-step instructions for deploying agents on the Substrate network.
              </p>
              <p className="text-sm text-[#666]">
                Documentation coming soon...
              </p>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

