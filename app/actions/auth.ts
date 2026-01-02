'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { redirect } from 'next/navigation';
import { logError } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Check User Project Status
// ═══════════════════════════════════════════════════════════════════════════════
export async function checkUserProjectStatus() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return { hasProject: false, isInitialized: false, redirect: '/login' };
    }

    const project = await prisma.project.findUnique({
      where: { userId: session.user.id },
    });

    if (project?.isInitialized) {
      return { hasProject: true, isInitialized: true, redirect: '/hub' };
    } else if (project) {
      return { hasProject: true, isInitialized: false, redirect: '/onboarding' };
    } else {
      return { hasProject: false, isInitialized: false, redirect: '/onboarding' };
    }
  } catch (error) {
    logError('Error checking project status', error as Error);
    // On database error, still allow access to onboarding
    // This prevents users from being locked out
    return { hasProject: false, isInitialized: false, redirect: '/onboarding' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Initialize Project (Onboarding)
// ═══════════════════════════════════════════════════════════════════════════════
export async function initializeProject(formData: {
  tokenMintAddress: string;
  privateKey: string;
  initialLiquidity: number;
  operationalWallets: string[];
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Please sign in first');
  }

  const { tokenMintAddress, privateKey, initialLiquidity, operationalWallets } = formData;

  // Validate inputs
  if (!tokenMintAddress || tokenMintAddress.length < 32) {
    throw new Error('Invalid token mint address');
  }
  if (!privateKey) {
    throw new Error('Private key is required');
  }
  if (initialLiquidity <= 0) {
    throw new Error('Initial liquidity must be greater than 0');
  }

  // Encrypt the private key before storage
  const encryptedPrivateKey = encrypt(privateKey);

  // Create or update the project
  const project = await prisma.project.upsert({
    where: { userId: session.user.id },
    update: {
      tokenMintAddress,
      encryptedPrivateKey,
      initialLiquidity,
      isInitialized: true,
    },
    create: {
      userId: session.user.id,
      tokenMintAddress,
      encryptedPrivateKey,
      initialLiquidity,
      isInitialized: true,
    },
  });

  // Create operational wallets (now with private keys)
  if (operationalWallets.length > 0) {
    // Delete existing wallets first
    await prisma.wallet.deleteMany({
      where: { projectId: project.id },
    });

    // Create new wallets with encrypted private keys
    const validWallets = operationalWallets.filter(w => w.trim().length > 0);
    if (validWallets.length > 0) {
      // Import the helper to derive public address
      const { getPublicKeyFromPrivate } = await import('@/lib/solana');
      
      await prisma.wallet.createMany({
        data: validWallets.map((privateKey, index) => {
          const publicAddress = getPublicKeyFromPrivate(privateKey.trim()) || 'invalid-key';
          return {
            projectId: project.id,
            address: publicAddress,
            encryptedPrivateKey: encrypt(privateKey.trim()),
            label: `Wallet ${index + 1}`,
          };
        }),
      });
    }
  }

  return { success: true, projectId: project.id };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Get User Project Data
// ═══════════════════════════════════════════════════════════════════════════════
export async function getUserProject() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return null;
    }

    // Optimized query - only fetch needed fields
    const project = await prisma.project.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        tokenMintAddress: true,
        initialLiquidity: true,
        isInitialized: true,
        createdAt: true,
        updatedAt: true,
        wallets: {
          select: {
            id: true,
            address: true,
            label: true,
            isActive: true,
          },
        },
      },
    });

    if (!project) return null;

    // Don't return the encrypted private key to the client
    return {
      id: project.id,
      tokenMintAddress: project.tokenMintAddress,
      initialLiquidity: project.initialLiquidity,
      isInitialized: project.isInitialized,
      wallets: project.wallets.map((w) => ({
        id: w.id,
        address: w.address,
        label: w.label,
        isActive: w.isActive,
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  } catch (error) {
    logError('Error getting user project', error as Error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Add Operational Wallet (with private key)
// ═══════════════════════════════════════════════════════════════════════════════
export async function addOperationalWallet(privateKey: string, label?: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const project = await prisma.project.findUnique({
    where: { userId: session.user.id },
  });

  if (!project) {
    throw new Error('No project found');
  }

  // Derive public address from private key
  const { getPublicKeyFromPrivate } = await import('@/lib/solana');
  const address = getPublicKeyFromPrivate(privateKey.trim()) || 'invalid-key';
  
  // Encrypt the private key
  const encryptedPrivateKey = encrypt(privateKey.trim());

  const wallet = await prisma.wallet.create({
    data: {
      projectId: project.id,
      address,
      encryptedPrivateKey,
      label,
    },
  });

  return { id: wallet.id, address: wallet.address, label: wallet.label, isActive: wallet.isActive };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Remove Operational Wallet
// ═══════════════════════════════════════════════════════════════════════════════
export async function removeOperationalWallet(walletId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // Verify wallet belongs to user's project
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    include: { project: true },
  });

  if (!wallet || wallet.project.userId !== session.user.id) {
    throw new Error('Wallet not found or unauthorized');
  }

  await prisma.wallet.delete({
    where: { id: walletId },
  });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Save PARRY Config (encrypted in DB)
// ═══════════════════════════════════════════════════════════════════════════════
export async function saveParryConfig(config: Record<string, unknown>) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const project = await prisma.project.findUnique({
    where: { userId: session.user.id },
  });

  if (!project) {
    throw new Error('No project found');
  }

  // Encrypt and save config as JSON
  const configJson = JSON.stringify(config);
  const encryptedConfig = encrypt(configJson);

  await prisma.project.update({
    where: { id: project.id },
    data: { parryConfig: encryptedConfig },
  });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Get PARRY Config (decrypted from DB)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getParryConfig() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { userId: session.user.id },
    select: { parryConfig: true },
  });

  if (!project?.parryConfig) {
    return null; // Return null, client will use defaults
  }

  try {
    const { decrypt } = await import('@/lib/encryption');
    const decryptedConfig = decrypt(project.parryConfig);
    return JSON.parse(decryptedConfig);
  } catch (error) {
    logError('Error decrypting PARRY config', error as Error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Update Project Settings (Token Mint and/or Dev Wallet)
// ═══════════════════════════════════════════════════════════════════════════════
export async function updateProjectSettings(data: {
  tokenMintAddress?: string;
  privateKey?: string;
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const project = await prisma.project.findUnique({
    where: { userId: session.user.id },
  });

  if (!project) {
    throw new Error('No project found');
  }

  const updateData: { tokenMintAddress?: string; encryptedPrivateKey?: string } = {};
  
  if (data.tokenMintAddress) {
    updateData.tokenMintAddress = data.tokenMintAddress;
  }
  
  if (data.privateKey) {
    updateData.encryptedPrivateKey = encrypt(data.privateKey);
  }

  await prisma.project.update({
    where: { id: project.id },
    data: updateData,
  });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Toggle Wallet Active Status
// ═══════════════════════════════════════════════════════════════════════════════
export async function toggleWalletActive(walletId: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    include: { project: true },
  });

  if (!wallet || wallet.project.userId !== session.user.id) {
    throw new Error('Wallet not found or unauthorized');
  }

  const updated = await prisma.wallet.update({
    where: { id: walletId },
    data: { isActive: !wallet.isActive },
  });

  return { id: updated.id, isActive: updated.isActive };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Save API Keys (encrypted)
// ═══════════════════════════════════════════════════════════════════════════════
export async function saveApiKeys(keys: {
  deepseekApiKey?: string;
  twitterApiKey?: string;
  twitterApiSecret?: string;
  twitterAccessToken?: string;
  twitterAccessSecret?: string;
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const project = await prisma.project.findUnique({
    where: { userId: session.user.id },
  });

  if (!project) {
    throw new Error('No project found');
  }

  const updateData: Record<string, string> = {};
  
  if (keys.deepseekApiKey) {
    updateData.encryptedDeepseekKey = encrypt(keys.deepseekApiKey);
  }
  if (keys.twitterApiKey) {
    updateData.encryptedTwitterApiKey = encrypt(keys.twitterApiKey);
  }
  if (keys.twitterApiSecret) {
    updateData.encryptedTwitterSecret = encrypt(keys.twitterApiSecret);
  }
  if (keys.twitterAccessToken) {
    updateData.encryptedTwitterAccessToken = encrypt(keys.twitterAccessToken);
  }
  if (keys.twitterAccessSecret) {
    updateData.encryptedTwitterAccessSecret = encrypt(keys.twitterAccessSecret);
  }

  await prisma.project.update({
    where: { id: project.id },
    data: updateData,
  });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Save Custom Personality
// ═══════════════════════════════════════════════════════════════════════════════
export async function saveCustomPersonality(personality: string) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  await prisma.project.update({
    where: { userId: session.user.id },
    data: { customPersonality: personality },
  });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Save Auto-Claim Settings
// ═══════════════════════════════════════════════════════════════════════════════
export async function saveAutoClaimSettings(enabled: boolean, interval: number) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  await prisma.project.update({
    where: { userId: session.user.id },
    data: { 
      autoClaimEnabled: enabled,
      autoClaimInterval: interval,
    },
  });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Get Full Project Data (including all settings)
// ═══════════════════════════════════════════════════════════════════════════════
export async function getFullProjectData() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }

  try {
    // Optimized query - only fetch needed fields
    const project = await prisma.project.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        tokenMintAddress: true,
        initialLiquidity: true,
        isInitialized: true,
        createdAt: true,
        updatedAt: true,
        autoClaimEnabled: true,
        autoClaimInterval: true,
        customPersonality: true,
        parryConfig: true,
        encryptedDeepseekKey: true,
        encryptedTwitterApiKey: true,
        encryptedTwitterSecret: true,
        wallets: {
          select: {
            id: true,
            address: true,
            label: true,
            isActive: true,
          },
        },
      },
    });

    if (!project) return null;

    // Decrypt PARRY config
    let parryConfig = null;
    if (project.parryConfig) {
      try {
        const { decrypt } = await import('@/lib/encryption');
        parryConfig = JSON.parse(decrypt(project.parryConfig));
      } catch {
        parryConfig = null;
      }
    }

    // Check if API keys are set (don't return the actual keys)
    const hasDeepseekKey = !!project.encryptedDeepseekKey;
    const hasTwitterKeys = !!(project.encryptedTwitterApiKey && project.encryptedTwitterSecret);

    return {
      id: project.id,
      tokenMintAddress: project.tokenMintAddress,
      initialLiquidity: project.initialLiquidity,
      isInitialized: project.isInitialized,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      // Auto-claim
      autoClaimEnabled: project.autoClaimEnabled,
      autoClaimInterval: project.autoClaimInterval,
      // Custom personality
      customPersonality: project.customPersonality,
      // API key status (not the actual keys)
      hasDeepseekKey,
      hasTwitterKeys,
      // PARRY config
      parryConfig,
      // Wallets
      wallets: project.wallets.map((w) => ({
        id: w.id,
        address: w.address,
        label: w.label,
        isActive: w.isActive,
      })),
    };
  } catch (error) {
    logError('Error getting full project data', error as Error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Action: Delete Project (full reset)
// ═══════════════════════════════════════════════════════════════════════════════
export async function deleteProject() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const project = await prisma.project.findUnique({
    where: { userId: session.user.id },
  });

  if (!project) {
    throw new Error('No project found');
  }

  // Delete project (wallets cascade automatically)
  await prisma.project.delete({
    where: { id: project.id },
  });

  return { success: true };
}

