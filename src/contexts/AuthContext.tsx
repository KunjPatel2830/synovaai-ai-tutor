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
    const redirectUrl = `${window.location.origin}/`;
    
    // Sign up using external Supabase
    const { data, error } = await externalSupabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
        }
      }
    });

    if (error) {
      return { error };
    }

    // Insert user role after successful signup - in external Supabase
    if (data.user) {
      // Create profile
      const { data: sessionData } = await externalSupabase.auth.getSession();
      if (sessionData.session) {
        await createProfileIfNeeded(data.user.id, sessionData.session);
      }

      const { error: roleError } = await externalSupabase
        .from('user_roles')
        .insert({ user_id: data.user.id, role });
      
      if (roleError) {
        console.error('Failed to set user role:', roleError);
        return { error: roleError };
      }
      
      setUserRole(role);
    }

    return { error: null };
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
