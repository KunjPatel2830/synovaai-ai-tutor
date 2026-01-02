import { createClient } from '@supabase/supabase-js';

// External Supabase project client (separate from Lovable Cloud)
const EXTERNAL_SUPABASE_URL = 'https://jpsostiphqqjgwdpioyn.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwc29zdGlwaHFxamd3ZHBpb3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTczNTMsImV4cCI6MjA4Mjc5MzM1M30.R6JYxPy2uVQQqhf_SX7G9MdNBc-tAH2bJi20mdn0NcI';

// Create external Supabase client
export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Test function to fetch current authenticated user from external Supabase
export async function testExternalAuth() {
  try {
    const { data: { user }, error } = await externalSupabase.auth.getUser();
    
    if (error) {
      console.log('[External Supabase] Auth error:', error.message);
      return null;
    }
    
    if (user) {
      console.log('[External Supabase] Current user:', user);
    } else {
      console.log('[External Supabase] No authenticated user');
    }
    
    return user;
  } catch (err) {
    console.error('[External Supabase] Test failed:', err);
    return null;
  }
}
