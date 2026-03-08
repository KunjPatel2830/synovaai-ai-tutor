// Re-export the internal Lovable Cloud client for backward compatibility
// All infrastructure is now consolidated on Lovable Cloud
import { supabase } from "@/integrations/supabase/client";

export const externalSupabase = supabase;

// Export URL for edge function calls
export const EXTERNAL_SUPABASE_URL_PUBLIC = import.meta.env.VITE_SUPABASE_URL as string;
