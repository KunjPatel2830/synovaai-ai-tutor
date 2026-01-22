import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { externalSupabase } from '@/lib/external-supabase';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'student' | 'teacher' | 'caregiver' | 'admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string, role: AppRole) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await externalSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data && !error) {
      setUserRole(data.role as AppRole);
    }
  };

  const createProfileIfNeeded = async (userId: string, session: Session) => {
    try {
      // Call the edge function to create profile in external Supabase
      const { error } = await supabase.functions.invoke('external-create-profile', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) {
        console.error('Error creating profile:', error);
      }
    } catch (err) {
      console.error('Failed to create profile:', err);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST - using external Supabase
    const { data: { subscription } } = externalSupabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer Supabase calls with setTimeout to prevent deadlock
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
    externalSupabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string, role: AppRole) => {
    try {
      // Create + auto-confirm user in external Supabase via backend function,
      // then set the external session so the app opens immediately.
      const { data, error } = await supabase.functions.invoke('external-signup', {
        body: {
          email,
          password,
          displayName,
          role,
        },
      });

      if (error) {
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
        return { error: setSessionError };
      }

      const nextSession = sessionData.session ?? (await externalSupabase.auth.getSession()).data.session;

      // Update local state immediately to avoid redirect bounce
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setUserRole(role);

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Signup failed') };
    }
  };

  const signIn = async (email: string, password: string) => {
    // Sign in using external Supabase
    const { error } = await externalSupabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    // Sign out from external Supabase
    await externalSupabase.auth.signOut();
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signUp, signIn, signOut }}>
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
