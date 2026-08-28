import { createClient } from '@supabase/supabase-js';

// External Supabase project credentials (publishable/anon key is safe for client-side)
const EXTERNAL_SUPABASE_URL = 'https://hyechbxffbgnukgfrfyi.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZWNoYnhmZmJnbnVrZ2ZyZnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NDE0MzAsImV4cCI6MjA4MzUxNzQzMH0.ip0gQwK9x5mvlNHq_ge9xlt8yfz5O_AZpz8YPLei3rw';

// External Supabase client for all auth and data operations
export const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export URL and anon key for edge function calls
export const EXTERNAL_SUPABASE_URL_PUBLIC = EXTERNAL_SUPABASE_URL;
export const EXTERNAL_SUPABASE_ANON_KEY_PUBLIC = EXTERNAL_SUPABASE_ANON_KEY;
