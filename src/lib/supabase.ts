import { createClient } from '@supabase/supabase-js';

// External Supabase project client (separate from Lovable Cloud)
const EXTERNAL_SUPABASE_URL = 'https://jpsostiphqqjgwdpioyn.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwc29zdGlwaHFxamd3ZHBpb3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTczNTMsImV4cCI6MjA4Mjc5MzM1M30.R6JYxPy2uVQQqhf_SX7G9MdNBc-tAH2bJi20mdn0NcI';

// Create external Supabase client for auth and data operations
export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Get current session token for API calls
export async function getExternalAuthToken(): Promise<string | null> {
  const { data: { session } } = await externalSupabase.auth.getSession();
  return session?.access_token || null;
}

// Call the external AI tutor edge function
export async function callExternalAiTutor(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  conversationId?: string
): Promise<{ reply: string; conversationId: string; rateLimitRemaining: number }> {
  const token = await getExternalAuthToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-ai-tutor`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ messages, conversationId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    
    if (response.status === 401) {
      throw new Error('Please sign in to use the AI tutor');
    }
    if (response.status === 429) {
      throw new Error(error.error || 'Rate limit exceeded. Please wait a moment.');
    }
    if (response.status === 402) {
      throw new Error('Usage limit reached. Please try again later.');
    }
    
    throw new Error(error.error || 'Failed to get AI response');
  }

  return response.json();
}

// Create profile after signup
export async function createExternalProfile(): Promise<void> {
  const token = await getExternalAuthToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-create-profile`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to create profile:', error);
    // Don't throw - profile creation failure shouldn't block auth
  }
}

// Auth helper functions
export async function signUpExternal(email: string, password: string, displayName: string) {
  const { data, error } = await externalSupabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName }
    }
  });

  if (error) throw error;

  // Create profile server-side after signup
  if (data.user) {
    // Wait for session to be established
    const { data: { session } } = await externalSupabase.auth.getSession();
    if (session) {
      await createExternalProfile();
    }
  }

  return data;
}

export async function signInExternal(email: string, password: string) {
  const { data, error } = await externalSupabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  // Ensure profile exists
  if (data.user) {
    await createExternalProfile();
  }

  return data;
}

export async function signOutExternal() {
  const { error } = await externalSupabase.auth.signOut();
  if (error) throw error;
}

// Get current external user
export async function getExternalUser() {
  const { data: { user }, error } = await externalSupabase.auth.getUser();
  if (error) throw error;
  return user;
}

// Listen to auth state changes
export function onExternalAuthStateChange(callback: (user: any) => void) {
  return externalSupabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
}
