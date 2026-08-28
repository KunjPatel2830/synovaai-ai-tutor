import { useRef, useCallback } from 'react';

interface RateLimiterOptions {
  minDelayMs?: number; // Minimum delay between requests (default: 1000ms)
}

export function useRateLimiter(options: RateLimiterOptions = {}) {
  const { minDelayMs = 1000 } = options;
  const lastRequestTime = useRef<number>(0);
  const pendingRequest = useRef<Promise<void> | null>(null);

  const waitForRateLimit = useCallback(async (): Promise<void> => {
    // If there's a pending wait, chain onto it
    if (pendingRequest.current) {
      await pendingRequest.current;
    }

    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime.current;
    const waitTime = Math.max(0, minDelayMs - timeSinceLastRequest);

    if (waitTime > 0) {
      pendingRequest.current = new Promise((resolve) => {
        setTimeout(() => {
          lastRequestTime.current = Date.now();
          pendingRequest.current = null;
          resolve();
        }, waitTime);
      });
      await pendingRequest.current;
    } else {
      lastRequestTime.current = now;
    }
  }, [minDelayMs]);

  return { waitForRateLimit };
}
