import { createClient } from '@supabase/supabase-js';

// External Supabase project credentials (publishable/anon key is safe for client-side)
const EXTERNAL_SUPABASE_URL = 'https://jpsostiphqqjgwdpioyn.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwc29zdGlwaHFxamd3ZHBpb3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTczNTMsImV4cCI6MjA4Mjc5MzM1M30.R6JYxPy2uVQQqhf_SX7G9MdNBc-tAH2bJi20mdn0NcI';

// External Supabase client for all auth and data operations
export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export URL for edge function calls
export const EXTERNAL_SUPABASE_URL_PUBLIC = EXTERNAL_SUPABASE_URL;
