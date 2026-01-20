import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
    // Set up auth state listener FIRST - using external Supabase
    const { data: { subscription } } = externalSupabase.auth.onAuthStateChange(
      (event, session) => {
        // Handle session loss
        if (event === 'SIGNED_OUT' || (!session && event === 'TOKEN_REFRESHED')) {
          handleSessionExpiry();
          setLoading(false);
          return;
        }
        
        // Normal session update
        setSession(session);
        setUser(session?.user ?? null);
        setSessionExpired(false);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session - using external Supabase
    externalSupabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logError('Error getting session', error);
        handleSessionExpiry();
        setLoading(false);
        return;
      }
      
      // Check if session is expired
      if (session?.expires_at) {
        const expiresAt = new Date(session.expires_at * 1000);
        if (expiresAt < new Date()) {
          handleSessionExpiry();
          setLoading(false);
          return;
        }
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      
      setLoading(false);
    });

    // Set up a periodic check for session expiry
    const sessionCheckInterval = setInterval(() => {
      externalSupabase.auth.getSession().then(({ data: { session } }) => {
        if (!session && user) {
          // Session was lost unexpectedly
          handleSessionExpiry();
        }
      });
    }, 60000); // Check every minute

    return () => {
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, [handleSessionExpiry, user]);

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
