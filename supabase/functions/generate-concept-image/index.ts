import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { concept, subject, context } = await req.json();

    if (!concept) {
      return new Response(
        JSON.stringify({ error: "Missing concept" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-concept-image] Generating description for: ${concept}`);

    // Since xiaomi/mimo-v2-flash:free is a text model, we'll generate a detailed description instead
    const prompt = `Create a detailed educational description of: ${concept}.
${subject ? `Subject: ${subject}.` : ""}
${context || ""}

Provide a clear, student-friendly explanation that would help visualize this concept. Include:
1. Key components or parts
2. How they relate to each other
3. Important details to remember
4. A simple analogy if applicable`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://synova.app",
        "X-Title": "SYNOVA Concept Image",
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash:free",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[generate-concept-image] API error:", response.status, error);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const textResponse = data.choices?.[0]?.message?.content || "";

    console.log("[generate-concept-image] Description generated successfully");

    // Return text description only (no image generation with this model)
    return new Response(
      JSON.stringify({ 
        text: textResponse,
        hasImage: false 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-concept-image] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
