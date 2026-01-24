import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { externalSupabase } from '@/lib/external-supabase';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/security';

type AppRole = 'student' | 'teacher' | 'caregiver' | 'admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: AppRole | null;
  loading: boolean;
  sessionExpired: boolean;
  signUp: (email: string, password: string, displayName: string, role: AppRole) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Clear all sensitive data from local state and storage
 */
function clearSensitiveData() {
  // Clear any cached user data from sessionStorage (if used)
  try {
    // Only clear app-specific keys, not the Supabase auth tokens (handled by Supabase)
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('synova_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  } catch (e) {
    // sessionStorage might not be available
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Prevent auth flicker by keeping "latest user" in a ref (avoids effect re-subscribing loops)
  const userRef = useRef<User | null>(null);
  const initializedRef = useRef(false);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await externalSupabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (data && !error) {
        setUserRole(data.role as AppRole);
      } else if (error) {
        logError('Failed to fetch user role', error, { code: 'role_fetch_error' });
      }
    } catch (err) {
      logError('Exception fetching user role', err);
    }
  };

  const createProfileIfNeeded = async (userId: string, session: Session) => {
    try {
      const { error } = await supabase.functions.invoke('external-create-profile', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) {
        logError('Error creating profile', error, { code: 'profile_create_error' });
      }
    } catch (err) {
      logError('Failed to create profile', err);
    }
  };

  /**
   * Handle session expiry - clear state and mark as expired
   */
  const handleSessionExpiry = useCallback(() => {
    setUser(null);
    setSession(null);
    setUserRole(null);
    setSessionExpired(true);
    clearSensitiveData();
  }, []);

  /**
   * Clear the session expired flag (after user acknowledges or navigates to login)
   */
  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  useEffect(() => {
    let active = true;

    // Subscribe once (do NOT re-subscribe when `user` changes)
    const { data: { subscription } } = externalSupabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      // During initialization we rely on the explicit getSession() below to avoid redirect flicker.
      if (!initializedRef.current) return;

      if (event === 'SIGNED_OUT') {
        handleSessionExpiry();
        return;
      }

      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      userRef.current = nextUser;
      setUser(nextUser);
      setSessionExpired(false);

      if (nextUser) {
        fetchUserRole(nextUser.id);
      } else {
        setUserRole(null);
      }
    });

    // Initialize session state once
    (async () => {
      try {
        const { data, error } = await externalSupabase.auth.getSession();
        if (error) {
          logError('Error getting session', error);
          handleSessionExpiry();
          return;
        }

        const nextSession = data.session;

        // Check if session is expired
        if (nextSession?.expires_at) {
          const expiresAt = new Date(nextSession.expires_at * 1000);
          if (expiresAt < new Date()) {
            handleSessionExpiry();
            return;
          }
        }

        setSession(nextSession);
        const nextUser = nextSession?.user ?? null;
        userRef.current = nextUser;
        setUser(nextUser);

        if (nextUser) {
          await fetchUserRole(nextUser.id);
        }
      } catch (err) {
        logError('Exception getting session', err);
        handleSessionExpiry();
      } finally {
        initializedRef.current = true;
        setLoading(false);
      }
    })();

    // Periodic sanity check for unexpected session loss
    const sessionCheckInterval = setInterval(async () => {
      try {
        const { data } = await externalSupabase.auth.getSession();
        if (!data.session && userRef.current) {
          handleSessionExpiry();
        }
      } catch {
        // ignore
      }
    }, 60000);

    return () => {
      active = false;
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, [handleSessionExpiry]);

  const signUp = async (email: string, password: string, displayName: string, role: AppRole) => {
    try {
      const { data, error } = await supabase.functions.invoke('external-signup', {
        body: {
          email,
          password,
          displayName,
          role,
        },
      });

      if (error) {
        logError('Signup edge function error', error);
        return { error: new Error(error.message) };
      }

      if ((data as any)?.error) {
        return { error: new Error((data as any).error) };
      }

      const access_token = (data as any)?.access_token as string | undefined;
      const refresh_token = (data as any)?.refresh_token as string | undefined;

      if (!access_token || !refresh_token) {
        return { error: new Error('Signup failed: no session returned') };
      }

      const { data: sessionData, error: setSessionError } = await externalSupabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (setSessionError) {
        logError('Error setting session', setSessionError);
        return { error: setSessionError };
      }

      const nextSession = sessionData.session ?? (await externalSupabase.auth.getSession()).data.session;

      // Update local state immediately to avoid redirect bounce
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setUserRole(role);
      setSessionExpired(false);

      return { error: null };
    } catch (err) {
      logError('Signup exception', err);
      return { error: err instanceof Error ? err : new Error('Signup failed') };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await externalSupabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        setSessionExpired(false);
      }

      return { error };
    } catch (err) {
      logError('SignIn exception', err);
      return { error: err instanceof Error ? err : new Error('Sign in failed') };
    }
  };

  const signOut = async () => {
    try {
      await externalSupabase.auth.signOut();
    } catch (err) {
      logError('SignOut exception', err);
    }
    // Always clear local state even if signOut fails
    setUser(null);
    setSession(null);
    setUserRole(null);
    setSessionExpired(false);
    clearSensitiveData();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userRole, 
      loading, 
      sessionExpired,
      signUp, 
      signIn, 
      signOut,
      clearSessionExpired,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
