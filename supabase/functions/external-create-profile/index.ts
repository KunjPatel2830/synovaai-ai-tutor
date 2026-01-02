import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get external Supabase credentials from secrets
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const externalServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');

    if (!externalUrl || !externalServiceKey) {
      console.error('Missing external Supabase credentials');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the authorization header from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create external Supabase client with service role for server operations
    const externalSupabase = createClient(externalUrl, externalServiceKey, {
      auth: { persistSession: false }
    });

    // Create client with user's token to verify their identity
    const externalSupabaseUser = createClient(externalUrl, externalServiceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    // Verify user authentication against external Supabase
    const { data: { user }, error: authError } = await externalSupabaseUser.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth verification failed:', authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const userEmail = user.email;
    const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Student';

    console.log(`[external-create-profile] Creating profile for user: ${userId}`);

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await externalSupabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing profile:', checkError);
    }

    if (existingProfile) {
      console.log(`[external-create-profile] Profile already exists for user: ${userId}`);
      return new Response(JSON.stringify({ 
        message: 'Profile already exists',
        profile: existingProfile
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create profile with id = auth.uid() and default role = 'student'
    // This runs server-side with service role, so user_id is set securely
    const { data: newProfile, error: insertError } = await externalSupabase
      .from('profiles')
      .insert({
        id: userId,  // id = auth.uid()
        email: userEmail,
        display_name: displayName,
        role: 'student',  // Default role
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create profile:', insertError);
      
      // Handle unique constraint violation (profile already exists)
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ 
          message: 'Profile already exists'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Failed to create profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[external-create-profile] Successfully created profile for user: ${userId}`);

    return new Response(JSON.stringify({
      message: 'Profile created successfully',
      profile: newProfile
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[external-create-profile] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
