// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT-SIDE LOGGER
// Reduced logging for React components (only errors/warnings)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Client-side logger for React components
 * Only logs errors and warnings to avoid cluttering browser console
 * Never logs sensitive data
 */

const isDevelopment = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';

/**
 * Logs errors (always logged)
 */
export function logError(message: string, error?: Error | any, data?: any): void {
  if (error instanceof Error) {
    console.error(`[ERROR] ${message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: isDevelopment ? error.stack : undefined,
      },
      ...(data || {}),
    });
  } else {
    console.error(`[ERROR] ${message}`, { error, ...(data || {}) });
  }
}

/**
 * Logs warnings (always logged)
 */
export function logWarn(message: string, data?: any): void {
  console.warn(`[WARN] ${message}`, data || {});
}

/**
 * Logs info (only in development)
 */
export function logInfo(message: string, data?: any): void {
  if (isDevelopment) {
    console.info(`[INFO] ${message}`, data || {});
  }
}

/**
 * Logs debug (only in development)
 */
export function logDebug(message: string, data?: any): void {
  if (isDevelopment) {
    console.debug(`[DEBUG] ${message}`, data || {});
  }
}

export default {
  error: logError,
  warn: logWarn,
  info: logInfo,
  debug: logDebug,
};
