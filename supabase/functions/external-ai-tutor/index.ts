import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 10;
const rateLimit = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userLimit = rateLimit.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimit.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetIn: userLimit.resetTime - now };
  }

  userLimit.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - userLimit.count, resetIn: userLimit.resetTime - now };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!openRouterApiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    const rateLimitResult = checkRateLimit(userId);
    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded', resetIn: Math.ceil(rateLimitResult.resetIn / 1000) }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, conversationId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return new Response(JSON.stringify({ error: 'Each message must have role and content' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!['user', 'assistant', 'system'].includes(msg.role)) {
        return new Response(JSON.stringify({ error: 'Invalid message role' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (msg.content.length > 10000) {
        return new Response(JSON.stringify({ error: 'Message content too long' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const userMessage = messages[messages.length - 1];
    let activeConversationId = conversationId;

    if (!activeConversationId) {
      const { data: newConversation, error: convError } = await adminClient
        .from('chat_sessions')
        .insert({ user_id: userId, mode: 'tutor' })
        .select('id')
        .single();

      if (convError) {
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      activeConversationId = newConversation.id;
    } else {
      const { data: existingConv, error: verifyError } = await adminClient
        .from('chat_sessions')
        .select('id')
        .eq('id', activeConversationId)
        .eq('user_id', userId)
        .single();

      if (verifyError || !existingConv) {
        return new Response(JSON.stringify({ error: 'Conversation not found or access denied' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    await adminClient.from('chat_messages').insert({
      session_id: activeConversationId, role: 'user', content: userMessage.content
    });

    const systemPrompt = `You are SYNOVA, a friendly and encouraging AI tutor. Your role is to help students learn by:
- Explaining concepts clearly with examples
- Breaking down complex topics into simpler parts
- Encouraging critical thinking with guiding questions
- Providing positive reinforcement
- Adapting explanations to the student's level

Always be patient, supportive, and focus on helping the student understand rather than just giving answers.`;

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
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    });

    if (!aiResponse.ok) {
      const errorStatus = aiResponse.status;
      if (errorStatus === 429) {
        return new Response(JSON.stringify({ error: 'AI rate limit exceeded. Please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const assistantContent = aiData.choices?.[0]?.message?.content;

    if (!assistantContent) {
      return new Response(JSON.stringify({ error: 'Invalid AI response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient.from('chat_messages').insert({
      session_id: activeConversationId, role: 'assistant', content: assistantContent
    });

    return new Response(JSON.stringify({
      reply: assistantContent,
      conversationId: activeConversationId,
      rateLimitRemaining: rateLimitResult.remaining
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[external-ai-tutor] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
