import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use external Supabase project
const EXTERNAL_SUPABASE_URL = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY') ?? '';
const EXTERNAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_ANON_KEY) {
      console.error('Missing external Supabase credentials');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!openRouterApiKey) {
      console.error('Missing OPENROUTER_API_KEY');
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
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

    // Create client with user's token to verify their identity
    const externalSupabaseAnon = createClient(
      EXTERNAL_SUPABASE_URL,
      EXTERNAL_SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    // Verify user authentication against external Supabase
    const { data: { user }, error: authError } = await externalSupabaseAnon.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth verification failed:', authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    console.log(`[external-ai-tutor] Authenticated user: ${userId}`);

    // Check rate limit via persistent database RPC
    try {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: rl } = await admin.rpc("check_rate_limit", {
        _user_id: userId,
        _endpoint: "external-ai-tutor",
        _max_requests: 15,
        _window_seconds: 60,
      });
      if (rl && rl.length > 0 && !rl[0].allowed) {
        return new Response(JSON.stringify({
          error: `Rate limit exceeded. Try again in ${rl[0].retry_after} seconds.`,
          resetIn: rl[0].retry_after,
        }), {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rl[0].retry_after),
          },
        });
      }
    } catch (e) {
      console.error("Rate limit check failed, allowing request:", e);
    }

    // Parse request body
    const { messages, conversationId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate messages (disallow client-supplied 'system' role to prevent prompt injection)
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return new Response(JSON.stringify({ error: 'Each message must have role and content' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        return new Response(JSON.stringify({ error: 'Invalid message role. Must be user or assistant.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (msg.content.length > 10000) {
        return new Response(JSON.stringify({ error: 'Message content too long' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create external Supabase client with service role for server operations
    const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    // Get user's latest message
    const userMessage = messages[messages.length - 1];

    // Create or get conversation
    let activeConversationId = conversationId;
    
    if (!activeConversationId) {
      // Create new conversation
      const { data: newConversation, error: convError } = await externalSupabase
        .from('chat_sessions')
        .insert({ user_id: userId, mode: 'tutor' })
        .select('id')
        .single();

      if (convError) {
        console.error('Failed to create conversation:', convError);
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      activeConversationId = newConversation.id;
    } else {
      // Verify conversation belongs to user
      const { data: existingConv, error: verifyError } = await externalSupabase
        .from('chat_sessions')
        .select('id')
        .eq('id', activeConversationId)
        .eq('user_id', userId)
        .single();

      if (verifyError || !existingConv) {
        console.error('Conversation verification failed:', verifyError?.message);
        return new Response(JSON.stringify({ error: 'Conversation not found or access denied' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Save user message to external Supabase
    const { error: saveUserMsgError } = await externalSupabase
      .from('chat_messages')
      .insert({
        session_id: activeConversationId,
        role: 'user',
        content: userMessage.content
      });

    if (saveUserMsgError) {
      console.error('Failed to save user message:', saveUserMsgError);
    }

    // Build system prompt
    const systemPrompt = `You are SYNOVA, a friendly and encouraging AI tutor. Your role is to help students learn by:
- Explaining concepts clearly with examples
- Breaking down complex topics into simpler parts
- Encouraging critical thinking with guiding questions
- Providing positive reinforcement
- Adapting explanations to the student's level

Always be patient, supportive, and focus on helping the student understand rather than just giving answers.`;
    const deterministicTutorRule = `

Numerical consistency is mandatory: for any math/science numerical question, extract the given values first, solve only from those values, recompute the arithmetic once before replying, and keep the same verified final answer for the same question.`;

    // Call OpenRouter API
    console.log(`[external-ai-tutor] Calling AI for user: ${userId}`);
    
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://synova.app',
        'X-Title': 'SYNOVA AI Tutor',
      },
      body: JSON.stringify({
        model: 'xiaomi/mimo-v2-flash:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'system', content: deterministicTutorRule },
          ...messages
        ],
        temperature: 0,
        top_p: 1,
        max_tokens: 3000,
      }),
    });

    if (!aiResponse.ok) {
      const errorStatus = aiResponse.status;
      console.error(`OpenRouter error: ${errorStatus}`);
      
      if (errorStatus === 429) {
        return new Response(JSON.stringify({ error: 'AI rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (errorStatus === 402) {
        return new Response(JSON.stringify({ error: 'AI usage limit reached. Please try again later.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const assistantContent = aiData.choices?.[0]?.message?.content;

    if (!assistantContent) {
      console.error('No content in AI response');
      return new Response(JSON.stringify({ error: 'Invalid AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save assistant message to external Supabase
    const { error: saveAiMsgError } = await externalSupabase
      .from('chat_messages')
      .insert({
        session_id: activeConversationId,
        role: 'assistant',
        content: assistantContent
      });

    if (saveAiMsgError) {
      console.error('Failed to save AI message:', saveAiMsgError);
    }

    console.log(`[external-ai-tutor] Successfully processed request for user: ${userId}`);

    return new Response(JSON.stringify({
      reply: assistantContent,
      conversationId: activeConversationId,
      rateLimitRemaining: rateLimitResult.remaining
    }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(rateLimitResult.remaining)
      },
    });

  } catch (error) {
    console.error('[external-ai-tutor] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
