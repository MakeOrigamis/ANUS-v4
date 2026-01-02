import { NextAuthOptions } from 'next-auth';
import TwitterProvider from 'next-auth/providers/twitter';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import { logDebug, logError } from './logger';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  
  providers: [
    // Twitter/X OAuth 2.0
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: '2.0',
    }),
    
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow all sign ins - be permissive
      try {
        logDebug('SignIn attempt', { userId: user?.id, provider: account?.provider });
        return true;
      } catch (error) {
        logError('SignIn callback error', error as Error);
        return true; // Still allow sign in even on error
      }
    },
    
    async jwt({ token, user, account }) {
      // On initial sign in, add user info to token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.userId = user.id;
      }
      
      // Check if user has a project in the database
      // Use userId first (more reliable), fall back to email
      const lookupId = token.userId || token.id;
      if (lookupId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: lookupId as string },
            include: { project: true },
          });
          if (dbUser) {
            token.hasProject = dbUser.project?.isInitialized ?? false;
            token.userId = dbUser.id;
          } else {
            token.hasProject = false;
          }
        } catch (error) {
          logError('Error checking project status', error as Error, { lookupId });
          token.hasProject = false;
        }
      } else if (token.email) {
        // Fallback to email lookup
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            include: { project: true },
          });
          if (dbUser) {
            token.hasProject = dbUser.project?.isInitialized ?? false;
            token.userId = dbUser.id;
          } else {
            token.hasProject = false;
          }
        } catch (error) {
          logError('Error checking project status by email', error as Error, { email: token.email });
          token.hasProject = false;
        }
      } else {
        token.hasProject = false;
      }
      
      return token;
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string || token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        session.user.hasProject = token.hasProject as boolean || false;
        session.user.isInitialized = token.hasProject as boolean || false;
      }
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      // After sign in, redirect to login page which will check status
      if (url.includes('/api/auth/callback')) {
        return `${baseUrl}/login?callback=true`;
      }
      // If it's a relative URL, make it absolute
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // If same origin, allow
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return baseUrl;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Extend the default session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      hasProject: boolean;
      isInitialized: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    userId?: string;
    hasProject?: boolean;
  }
}
