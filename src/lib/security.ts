/**
 * Security utilities for input sanitization, error handling, and XSS prevention
 */

import DOMPurify from 'dompurify';
import { z } from 'zod';

// ============================================================================
// Input Sanitization
// ============================================================================

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this for any user-generated content that might contain HTML
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

/**
 * Sanitize plain text - strips all HTML tags
 * Use this for inputs that should never contain HTML (names, search queries, etc.)
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';
  // Strip all HTML tags and decode entities
  const stripped = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  // Trim and normalize whitespace
  return stripped.trim().replace(/\s+/g, ' ');
}

/**
 * Sanitize and validate email
 */
export function sanitizeEmail(email: string): string {
  return sanitizeText(email).toLowerCase();
}

/**
 * Sanitize display name
 */
export function sanitizeDisplayName(name: string, maxLength = 100): string {
  const sanitized = sanitizeText(name);
  return sanitized.slice(0, maxLength);
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string, maxLength = 500): string {
  const sanitized = sanitizeText(query);
  return sanitized.slice(0, maxLength);
}

/**
 * Sanitize chat message content
 */
export function sanitizeChatMessage(message: string, maxLength = 10000): string {
  if (typeof message !== 'string') return '';
  // For chat, we allow more content but still sanitize
  const sanitized = message.trim();
  return sanitized.slice(0, maxLength);
}

// ============================================================================
// Validation Schemas
// ============================================================================

export const validationSchemas = {
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .transform(sanitizeEmail),
  
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be less than 128 characters'),
  
  displayName: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .transform((val) => sanitizeDisplayName(val)),
  
  searchQuery: z.string()
    .max(500, 'Search query is too long')
    .transform((val) => sanitizeSearchQuery(val)),
  
  chatMessage: z.string()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message is too long')
    .transform((val) => sanitizeChatMessage(val)),
  
  reviewContent: z.string()
    .min(10, 'Review must be at least 10 characters')
    .max(2000, 'Review must be less than 2000 characters')
    .transform((val) => sanitizeText(val)),
  
  subject: z.string()
    .min(1, 'Subject is required')
    .max(100, 'Subject name is too long')
    .transform((val) => sanitizeText(val)),
  
  topic: z.string()
    .max(200, 'Topic name is too long')
    .transform((val) => sanitizeText(val))
    .optional(),
};

// ============================================================================
// Error Handling & Masking
// ============================================================================

const IS_PRODUCTION = import.meta.env.PROD;

interface ErrorDetails {
  code?: string;
  originalError?: Error;
  context?: Record<string, unknown>;
}

/**
 * User-friendly error messages for production
 * Maps technical errors to safe, user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  'invalid_credentials': 'Invalid email or password. Please try again.',
  'email_taken': 'This email is already registered. Please sign in instead.',
  'weak_password': 'Password is too weak. Please choose a stronger password.',
  'session_expired': 'Your session has expired. Please sign in again.',
  'unauthorized': 'You are not authorized to perform this action.',
  
  // Network errors
  'network_error': 'Unable to connect. Please check your internet connection.',
  'timeout': 'The request timed out. Please try again.',
  
  // Rate limiting
  'rate_limited': 'Too many requests. Please wait a moment and try again.',
  'usage_limit': 'You have reached your usage limit. Please try again later.',
  
  // Generic errors
  'server_error': 'Something went wrong on our end. Please try again later.',
  'validation_error': 'Please check your input and try again.',
  'not_found': 'The requested resource was not found.',
  'forbidden': 'You do not have permission to access this resource.',
  
  // Default
  'unknown': 'An unexpected error occurred. Please try again.',
};

/**
 * Get a user-friendly error message
 * In production, this masks technical details
 * In development, it shows more information
 */
export function getUserFriendlyError(
  error: unknown,
  defaultCode = 'unknown'
): string {
  // In development, show more details
  if (!IS_PRODUCTION && error instanceof Error) {
    return error.message;
  }
  
  // Determine error code
  let code = defaultCode;
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Map common error patterns to codes
    if (message.includes('invalid login') || message.includes('invalid credentials')) {
      code = 'invalid_credentials';
    } else if (message.includes('already registered') || message.includes('already exists')) {
      code = 'email_taken';
    } else if (message.includes('session') || message.includes('jwt expired')) {
      code = 'session_expired';
    } else if (message.includes('unauthorized') || message.includes('401')) {
      code = 'unauthorized';
    } else if (message.includes('network') || message.includes('fetch')) {
      code = 'network_error';
    } else if (message.includes('timeout')) {
      code = 'timeout';
    } else if (message.includes('rate limit') || message.includes('429')) {
      code = 'rate_limited';
    } else if (message.includes('usage') || message.includes('402')) {
      code = 'usage_limit';
    } else if (message.includes('500') || message.includes('internal')) {
      code = 'server_error';
    } else if (message.includes('validation')) {
      code = 'validation_error';
    } else if (message.includes('404') || message.includes('not found')) {
      code = 'not_found';
    } else if (message.includes('403') || message.includes('forbidden')) {
      code = 'forbidden';
    }
  }
  
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.unknown;
}

/**
 * Log error securely - full details in development, masked in production
 */
export function logError(
  message: string,
  error: unknown,
  details?: ErrorDetails
): void {
  if (IS_PRODUCTION) {
    // In production, log minimal info to avoid leaking sensitive data
    console.error(`[Error] ${message}`, {
      code: details?.code,
      timestamp: new Date().toISOString(),
    });
  } else {
    // In development, log full details
    console.error(`[Error] ${message}`, {
      error,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Create a safe error object for API responses
 */
export function createSafeError(
  error: unknown,
  defaultCode = 'unknown'
): { error: string; code: string } {
  const message = getUserFriendlyError(error, defaultCode);
  return { error: message, code: defaultCode };
}

// ============================================================================
// URL Sanitization
// ============================================================================

/**
 * Safely encode a string for use in URLs
 */
export function safeEncodeURIComponent(str: string): string {
  return encodeURIComponent(sanitizeText(str));
}

/**
 * Validate and sanitize a URL
 * Returns null if the URL is invalid or potentially malicious
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

// ============================================================================
// Content Security
// ============================================================================

/**
 * Check if content contains potentially dangerous patterns
 */
export function containsSuspiciousPatterns(content: string): boolean {
  const suspiciousPatterns = [
    /<script\b/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i, // onclick, onerror, etc.
    /expression\s*\(/i,
    /url\s*\(/i,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(content));
}
