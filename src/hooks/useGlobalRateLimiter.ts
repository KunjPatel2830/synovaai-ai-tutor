/**
 * Global Rate Limiter for AI requests
 * Prevents abuse and excessive API token usage
 */

import { useRef, useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface RateLimitConfig {
  maxRequestsPerWindow: number;
  windowMs: number;
  minDelayMs: number;
  progressiveDelayEnabled: boolean;
}

interface RateLimitState {
  requestCount: number;
  windowStart: number;
  lastRequestTime: number;
  isLimited: boolean;
  remainingRequests: number;
  resetIn: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerWindow: 30, // 30 requests per window
  windowMs: 60000, // 1 minute window
  minDelayMs: 500, // Minimum 500ms between requests
  progressiveDelayEnabled: true,
};

// Singleton storage for cross-component rate limiting
const globalRateLimitState = {
  requestTimestamps: [] as number[],
  lastRequestTime: 0,
  consecutiveErrors: 0,
};

export function useGlobalRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const { toast } = useToast();
  const configRef = useRef({ ...DEFAULT_CONFIG, ...config });
  const [state, setState] = useState<RateLimitState>({
    requestCount: 0,
    windowStart: Date.now(),
    lastRequestTime: 0,
    isLimited: false,
    remainingRequests: configRef.current.maxRequestsPerWindow,
    resetIn: 0,
  });

  /**
   * Clean up old request timestamps
   */
  const cleanupOldRequests = useCallback(() => {
    const now = Date.now();
    const { windowMs } = configRef.current;
    globalRateLimitState.requestTimestamps = globalRateLimitState.requestTimestamps.filter(
      (timestamp) => now - timestamp < windowMs
    );
  }, []);

  /**
   * Check if a request is allowed
   */
  const checkRateLimit = useCallback((): {
    allowed: boolean;
    waitTime: number;
    remaining: number;
  } => {
    const now = Date.now();
    const { maxRequestsPerWindow, windowMs, minDelayMs, progressiveDelayEnabled } = configRef.current;

    // Clean up old timestamps
    cleanupOldRequests();

    const currentCount = globalRateLimitState.requestTimestamps.length;
    const remaining = Math.max(0, maxRequestsPerWindow - currentCount);

    // Check window limit
    if (currentCount >= maxRequestsPerWindow) {
      const oldestTimestamp = globalRateLimitState.requestTimestamps[0];
      const resetTime = oldestTimestamp + windowMs - now;
      
      setState((prev) => ({
        ...prev,
        isLimited: true,
        remainingRequests: 0,
        resetIn: Math.ceil(resetTime / 1000),
      }));

      return { allowed: false, waitTime: resetTime, remaining: 0 };
    }

    // Check minimum delay
    const timeSinceLastRequest = now - globalRateLimitState.lastRequestTime;
    let requiredDelay = minDelayMs;

    // Apply progressive delay if there have been recent errors
    if (progressiveDelayEnabled && globalRateLimitState.consecutiveErrors > 0) {
      requiredDelay += globalRateLimitState.consecutiveErrors * 1000; // +1s per consecutive error
    }

    const waitTime = Math.max(0, requiredDelay - timeSinceLastRequest);

    setState((prev) => ({
      ...prev,
      isLimited: waitTime > 0,
      remainingRequests: remaining,
      resetIn: 0,
    }));

    return { allowed: waitTime === 0, waitTime, remaining };
  }, [cleanupOldRequests]);

  /**
   * Wait for rate limit to allow a request
   */
  const waitForRateLimit = useCallback(async (): Promise<boolean> => {
    const { allowed, waitTime, remaining } = checkRateLimit();

    if (!allowed) {
      if (waitTime > 5000) {
        // If wait time is significant, notify the user
        toast({
          title: 'Please wait',
          description: `Rate limit reached. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
          variant: 'destructive',
        });
        return false;
      }

      // Wait for the required delay
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    // Record the request
    const now = Date.now();
    globalRateLimitState.requestTimestamps.push(now);
    globalRateLimitState.lastRequestTime = now;

    setState((prev) => ({
      ...prev,
      requestCount: globalRateLimitState.requestTimestamps.length,
      lastRequestTime: now,
      isLimited: false,
      remainingRequests: remaining - 1,
    }));

    return true;
  }, [checkRateLimit, toast]);

  /**
   * Record a successful request (resets error counter)
   */
  const recordSuccess = useCallback(() => {
    globalRateLimitState.consecutiveErrors = 0;
  }, []);

  /**
   * Record a failed request (increases delay)
   */
  const recordError = useCallback((statusCode?: number) => {
    // Only count rate limit errors and server errors
    if (statusCode === 429 || statusCode === 502 || statusCode === 503) {
      globalRateLimitState.consecutiveErrors += 1;
    }
  }, []);

  /**
   * Reset the rate limiter (for testing or manual override)
   */
  const reset = useCallback(() => {
    globalRateLimitState.requestTimestamps = [];
    globalRateLimitState.lastRequestTime = 0;
    globalRateLimitState.consecutiveErrors = 0;
    
    setState({
      requestCount: 0,
      windowStart: Date.now(),
      lastRequestTime: 0,
      isLimited: false,
      remainingRequests: configRef.current.maxRequestsPerWindow,
      resetIn: 0,
    });
  }, []);

  return {
    checkRateLimit,
    waitForRateLimit,
    recordSuccess,
    recordError,
    reset,
    state,
    isLimited: state.isLimited,
    remainingRequests: state.remainingRequests,
  };
}
