/**
 * Error Handler Utilities
 * Provides user-friendly error messages and error handling utilities
 */

import { logError } from './logger';

export interface UserFriendlyError {
  message: string;
  code?: string;
  statusCode?: number;
  retryable?: boolean;
  action?: string;
}

/**
 * Maps technical errors to user-friendly messages
 */
export function getUserFriendlyError(error: unknown): UserFriendlyError {
  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return {
        message: 'Network connection failed. Please check your internet connection and try again.',
        code: 'NETWORK_ERROR',
        retryable: true,
        action: 'Check your internet connection',
      };
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('401') || message.includes('authentication')) {
      return {
        message: 'Your session has expired. Please log in again.',
        code: 'AUTH_ERROR',
        statusCode: 401,
        retryable: false,
        action: 'Please log in again',
      };
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
      return {
        message: 'Too many requests. Please wait a moment before trying again.',
        code: 'RATE_LIMIT',
        statusCode: 429,
        retryable: true,
        action: 'Wait a few seconds and try again',
      };
    }

    // Server errors
    if (message.includes('500') || message.includes('internal server error')) {
      return {
        message: 'Server error occurred. Our team has been notified. Please try again later.',
        code: 'SERVER_ERROR',
        statusCode: 500,
        retryable: true,
        action: 'Try again in a few moments',
      };
    }

    // Not found errors
    if (message.includes('404') || message.includes('not found')) {
      return {
        message: 'The requested resource was not found.',
        code: 'NOT_FOUND',
        statusCode: 404,
        retryable: false,
        action: 'Check the URL or contact support',
      };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || message.includes('bad request')) {
      return {
        message: 'Invalid input. Please check your data and try again.',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        retryable: false,
        action: 'Check your input and try again',
      };
    }

    // Solana-specific errors
    if (message.includes('solana') || message.includes('transaction') || message.includes('rpc')) {
      return {
        message: 'Blockchain transaction failed. Please check your wallet and try again.',
        code: 'SOLANA_ERROR',
        retryable: true,
        action: 'Check your wallet connection and try again',
      };
    }

    // Default error message
    return {
      message: error.message || 'An unexpected error occurred. Please try again.',
      code: 'UNKNOWN_ERROR',
      retryable: true,
      action: 'Try again',
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      code: 'STRING_ERROR',
      retryable: true,
    };
  }

  // Handle objects with error properties
  if (error && typeof error === 'object' && 'message' in error) {
    return getUserFriendlyError((error as { message: string }).message);
  }

  // Fallback
  return {
    message: 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
    retryable: true,
    action: 'Try again',
  };
}

/**
 * Handles API errors and returns user-friendly messages
 */
export async function handleApiError(response: Response): Promise<UserFriendlyError> {
  let errorData: any = {};
  
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      errorData = await response.json();
    } else {
      errorData = { message: await response.text() };
    }
  } catch (e) {
    errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
  }

  const error = new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  
  const userFriendly = getUserFriendlyError(error);
  
  // Override with status code from response
  if (response.status) {
    userFriendly.statusCode = response.status;
  }

  // Log the technical error
  logError('API Error', error, {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    errorData,
  });

  return userFriendly;
}

/**
 * Wraps async functions with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  onError?: (error: UserFriendlyError) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const userFriendly = getUserFriendlyError(error);
    
    if (onError) {
      onError(userFriendly);
    } else {
      // Default: log to console
      console.error('Error:', userFriendly.message);
    }
    
    return null;
  }
}

/**
 * Creates a user-friendly error message for display in UI
 */
export function formatErrorForDisplay(error: UserFriendlyError): string {
  let message = error.message;
  
  if (error.action) {
    message += ` ${error.action}.`;
  }
  
  return message;
}
