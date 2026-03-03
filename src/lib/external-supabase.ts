// Re-export the internal Lovable Cloud Supabase client.
// This file exists for backward-compatibility so that every import of
// `externalSupabase` throughout the codebase keeps working after the
// consolidation to Lovable Cloud.
import { supabase } from '@/integrations/supabase/client';

export const externalSupabase = supabase;

// Export URL for edge function calls
export const EXTERNAL_SUPABASE_URL_PUBLIC = import.meta.env.VITE_SUPABASE_URL as string;
