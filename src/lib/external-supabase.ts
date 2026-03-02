// Migrated: now uses internal Lovable Cloud database instead of external project
import { supabase } from "@/integrations/supabase/client";

// Re-export internal client as externalSupabase for backward compatibility
export const externalSupabase = supabase;

// Export URL for edge function calls
export const EXTERNAL_SUPABASE_URL_PUBLIC = import.meta.env.VITE_SUPABASE_URL;
