// ═══════════════════════════════════════════════════════════════════════════════
// PINO LOGGER CONFIGURATION
// Production-ready structured logging with sensitive data filtering
// ═══════════════════════════════════════════════════════════════════════════════

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'warn' : 'debug');

// ═══════════════════════════════════════════════════════════════════════════════
// SENSITIVE DATA FILTERING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Masks sensitive data in objects before logging
 */
function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const masked = { ...obj };
  const sensitiveKeys = [
    'privateKey',
    'private_key',
    'private-key',
    'encryptedPrivateKey',
    // Note: apiKey is handled separately below to show first 4 chars
    'accessToken',
    'access_token',
    'access-token',
    'secret',
    'password',
    'encryptionKey',
    'encryption_key',
  ];

  // Mask API keys first (before general sensitive keys, show first 4 chars)
  // Handle all variations of apiKey naming
  if (masked.apiKey && typeof masked.apiKey === 'string') {
    masked.apiKey = `${masked.apiKey.substring(0, 4)}...***`;
  }
  if (masked.api_key && typeof masked.api_key === 'string') {
    masked.api_key = `${masked.api_key.substring(0, 4)}...***`;
  }
  if (masked['api-key'] && typeof masked['api-key'] === 'string') {
    masked['api-key'] = `${masked['api-key'].substring(0, 4)}...***`;
  }

  // Mask sensitive keys
  for (const key of sensitiveKeys) {
    if (masked[key] && typeof masked[key] === 'string' && masked[key] !== '[REDACTED]') {
      masked[key] = '[REDACTED]';
    }
  }

  // Mask wallet addresses (long base58 strings)
  if (masked.wallet && typeof masked.wallet === 'string' && masked.wallet.length > 32) {
    masked.wallet = `${masked.wallet.substring(0, 8)}...${masked.wallet.substring(masked.wallet.length - 8)}`;
  }
  if (masked.address && typeof masked.address === 'string' && masked.address.length > 32) {
    masked.address = `${masked.address.substring(0, 8)}...${masked.address.substring(masked.address.length - 8)}`;
  }
  if (masked.tokenMint && typeof masked.tokenMint === 'string' && masked.tokenMint.length > 32) {
    masked.tokenMint = `${masked.tokenMint.substring(0, 8)}...${masked.tokenMint.substring(masked.tokenMint.length - 8)}`;
  }

  // Mask user IDs (hash them)
  if (masked.userId && typeof masked.userId === 'string') {
    masked.userId = `user_${masked.userId.substring(0, 8)}`;
  }
  if (masked.user?.id) {
    masked.user = { ...masked.user, id: `user_${masked.user.id.substring(0, 8)}` };
  }

  return masked;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PINO SERIALIZERS
// ═══════════════════════════════════════════════════════════════════════════════

const serializers = {
  error: pino.stdSerializers.err,
  req: (req: any) => {
    if (!req) return req;
    return {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers?.['user-agent'],
        // Don't log other headers (might contain tokens)
      },
    };
  },
  res: (res: any) => {
    if (!res) return res;
    return {
      statusCode: res.statusCode,
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGER INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

export const logger = pino({
  level: logLevel,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  serializers,
  base: {
    env: process.env.NODE_ENV,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Logs debug information (only in development)
 */
export function logDebug(message: string, data?: any): void {
  if (isDevelopment) {
    logger.debug(maskSensitiveData(data || {}), message);
  }
}

/**
 * Logs info messages
 */
export function logInfo(message: string, data?: any): void {
  logger.info(maskSensitiveData(data || {}), message);
}

/**
 * Logs warnings
 */
export function logWarn(message: string, data?: any): void {
  logger.warn(maskSensitiveData(data || {}), message);
}

/**
 * Logs errors
 */
export function logError(message: string, error?: Error | any, data?: any): void {
  const maskedData = maskSensitiveData(data || {});
  
  // Build errorData object - extract error properties explicitly for browser console compatibility
  const errorData: any = {
    timestamp: new Date().toISOString(),
    msg: message,
  };
  
  // Always include masked data
  if (maskedData && Object.keys(maskedData).length > 0) {
    Object.assign(errorData, maskedData);
  }
  
  // Add error information - extract properties explicitly to ensure browser console compatibility
  if (error instanceof Error) {
    // Extract error properties explicitly so they're visible in browser console
    // This ensures the error details are always serializable and visible
    errorData.error = {
      name: error.name,
      message: error.message,
      ...(isDevelopment && error.stack ? { stack: error.stack } : {}),
    };
  } else if (error !== undefined && error !== null) {
    // For non-Error objects, include them as-is
    errorData.error = error;
  }

  // Pino expects: logger.error(obj, msg)
  // We always include timestamp and msg to ensure errorData is never empty
  // The error field contains the extracted error properties
  logger.error(errorData, message);
}

/**
 * Creates a child logger with context
 */
export function createChildLogger(context: Record<string, any>): pino.Logger {
  return logger.child(maskSensitiveData(context));
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT DEFAULT LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

export default logger;
