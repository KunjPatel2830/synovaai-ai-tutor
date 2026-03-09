import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_CONCEPT_LENGTH = 500;
const MAX_SUBJECT_LENGTH = 100;
const MAX_CONTEXT_LENGTH = 1000;

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  return stripHtml(input).slice(0, maxLen);
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth check ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonRes({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonRes({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();

    const concept = sanitizeText(body.concept, MAX_CONCEPT_LENGTH);
    const subject = sanitizeText(body.subject, MAX_SUBJECT_LENGTH);
    const context = sanitizeText(body.context, MAX_CONTEXT_LENGTH);

    if (!concept) {
      return jsonRes({ error: "Missing or empty concept" }, 400);
    }

    console.log(`[generate-concept-image] Generating description for: ${concept}`);

    const prompt = `Create a detailed educational description of: ${concept}.
${subject ? `Subject: ${subject}.` : ""}
${context || ""}

Provide a clear, student-friendly explanation that would help visualize this concept. Include:
1. Key components or parts
2. How they relate to each other
3. Important details to remember
4. A simple analogy if applicable`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI provider is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[generate-concept-image] API error:", response.status, error);
      if (response.status === 429) return jsonRes({ error: "Rate limited. Please try again later." }, 429);
      if (response.status === 402) return jsonRes({ error: "AI credits exhausted." }, 402);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const textResponse = data.choices?.[0]?.message?.content || "";

    console.log("[generate-concept-image] Description generated successfully");

    return jsonRes({ text: textResponse, hasImage: false });
  } catch (error) {
    console.error("[generate-concept-image] Error:", error);
    return jsonRes({ error: "Something went wrong. Please try again." }, 500);
  }
});
