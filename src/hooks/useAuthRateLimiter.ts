import { useState, useRef, useCallback } from 'react';
import { externalSupabase } from '@/lib/external-supabase';

interface LockoutStatus {
  isLocked: boolean;
  lockedUntil: Date | null;
  failedAttempts: number;
  remainingSeconds: number;
}

interface UseAuthRateLimiterReturn {
  checkLockout: (email: string) => Promise<LockoutStatus>;
  recordAttempt: (email: string, success: boolean) => Promise<void>;
  waitForRateLimit: () => Promise<void>;
  lockoutStatus: LockoutStatus | null;
  isChecking: boolean;
}

export function useAuthRateLimiter(): UseAuthRateLimiterReturn {
  const [lockoutStatus, setLockoutStatus] = useState<LockoutStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  
  // Client-side rate limiting
  const lastRequestTime = useRef<number>(0);
  const failedAttemptCount = useRef<number>(0);
  const minDelayMs = 1000; // Minimum 1 second between requests
  const progressiveDelayMs = 2000; // Additional delay per failed attempt after threshold
  const progressiveDelayThreshold = 3; // Start adding delay after this many failures

  const waitForRateLimit = useCallback(async (): Promise<void> => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime.current;
    
    // Calculate required delay based on failed attempts
    let requiredDelay = minDelayMs;
    if (failedAttemptCount.current >= progressiveDelayThreshold) {
      requiredDelay += (failedAttemptCount.current - progressiveDelayThreshold + 1) * progressiveDelayMs;
    }
    
    const waitTime = Math.max(0, requiredDelay - timeSinceLastRequest);
    
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    
    lastRequestTime.current = Date.now();
  }, []);

  const checkLockout = useCallback(async (email: string): Promise<LockoutStatus> => {
    setIsChecking(true);
    
    try {
      // If excessive local failures, enforce client-side lockout
      if (failedAttemptCount.current >= 5) {
        const remainingSeconds = Math.min(300, failedAttemptCount.current * 10);
        const lockedUntil = new Date(Date.now() + remainingSeconds * 1000);
        const status: LockoutStatus = {
          isLocked: true,
          lockedUntil,
          failedAttempts: failedAttemptCount.current,
          remainingSeconds
        };
        setLockoutStatus(status);
        return status;
      }

      // Try server RPC if accessible
      try {
        const { data, error } = await externalSupabase.rpc('check_login_lockout', {
          check_email: email
        });

        if (!error && data?.[0]) {
          const result = data[0];
          const lockedUntil = result.locked_until ? new Date(result.locked_until) : null;
          const remainingSeconds = lockedUntil 
            ? Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000))
            : 0;

          const status: LockoutStatus = {
            isLocked: result.is_locked,
            lockedUntil,
            failedAttempts: result.failed_attempts,
            remainingSeconds
          };

          setLockoutStatus(status);
          return status;
        }
      } catch {
        // Server RPC not accessible directly from client, fallback to client-side state
      }

      return {
        isLocked: false,
        lockedUntil: null,
        failedAttempts: failedAttemptCount.current,
        remainingSeconds: 0
      };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const recordAttempt = useCallback(async (email: string, success: boolean): Promise<void> => {
    // Update client-side counter
    if (success) {
      failedAttemptCount.current = 0;
      setLockoutStatus(null);
    } else {
      failedAttemptCount.current += 1;
    }

    try {
      await externalSupabase.rpc('record_login_attempt', {
        attempt_email: email,
        attempt_success: success,
        attempt_ip: null
      });
    } catch {
      // Ignored if direct client RPC execution is revoked
    }
  }, []);

  return {
    checkLockout,
    recordAttempt,
    waitForRateLimit,
    lockoutStatus,
    isChecking
  };
}
