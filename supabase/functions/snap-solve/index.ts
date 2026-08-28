import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DETERMINISTIC_AI_SETTINGS = {
  temperature: 0,
  top_p: 1,
  max_tokens: 3000,
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function requireUser(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }
  const userSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userSupabase.auth.getUser();
  if (error || !data.user) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: data.user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  // Rate limit
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: rl } = await admin.rpc("check_rate_limit", {
      _user_id: auth.userId, _endpoint: "snap-solve", _max_requests: 15, _window_seconds: 60,
    });
    if (rl && rl.length > 0 && !rl[0].allowed) {
      return jsonResponse({ error: `Rate limit exceeded. Try again in ${rl[0].retry_after}s.` }, { status: 429 });
    }
  } catch (e) { console.error("Rate limit check failed:", e); }

  try {
    const body = await req.json();
    const { imageBase64, mimeType, prompt, subject, language } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return jsonResponse({ error: "imageBase64 is required" }, { status: 400 });
    }
    if (imageBase64.length > 15 * 1024 * 1024) {
      return jsonResponse({ error: "Image too large. Max 10MB." }, { status: 400 });
    }
    const imgMime = typeof mimeType === "string" && mimeType.startsWith("image/") ? mimeType : "image/jpeg";
    const userPrompt = typeof prompt === "string" ? prompt.slice(0, 2000) : "";
    const responseLanguage = (typeof language === "string" && language.trim()) ? language.trim() : "english";
    const subjectHint = typeof subject === "string" && subject.trim() ? subject.trim() : "auto-detect";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI not configured" }, { status: 500 });

    const systemPrompt = `You are SYNOVA Snap-Solve — a rigorous image-to-solution tutor. Your PRIMARY JOB is to read the exact question from the image, SOLVE it completely, and produce the FINAL ANSWER with full working.

LANGUAGE: Respond ONLY in ${responseLanguage}. Keep formulas, units, numbers and technical terms in standard form.

SUBJECT HINT: ${subjectHint}

ABSOLUTE RULES:
- First transcribe the problem internally from the image. Carefully read exponents, fractions, signs, diagrams, labels, answer options, and handwritten values before calculating.
- Answer the question actually shown in the image. Do not give a generic lesson, topic summary, or theory-only response.
- ALWAYS actually solve the problem end-to-end. Do NOT stop at theory, method, or "approach".
- Determinism is mandatory: the SAME question must produce the SAME final answer every time.
- Before writing the final answer, independently recompute the arithmetic once from the extracted data. If the two results differ, find the mistake and use only the verified result.
- Never guess between multiple possible numerical answers. If one value is uncertain from the image, state that assumption clearly, solve using it, and keep the final answer consistent with that assumption.
- Show every algebraic manipulation and every arithmetic substitution with real numbers plugged in.
- Compute the final numeric answer. Never write "leave as exercise", "student can compute", or "similarly".
- If it is a numerical problem, the response is INCOMPLETE without a boxed number + unit.
- If there are multiple parts (a), (b), (c) — solve ALL of them fully.

RESPONSE STRUCTURE (STRICT — no extra sections, no long theory):
1. **Given / To find** — 2-4 short bullets listing the data extracted from the image and what is asked.
2. **Formula(s) used** — 1-3 lines. Just the formulas, no derivation unless explicitly asked.
3. **Solution** — Numbered steps. Substitute numbers, simplify, compute. Show units at every step. Use $$...$$ for display math when helpful.
4. **Final Answer** — On its own line: **Answer: <value> <unit>** (bold). For MCQs: **Answer: (option) — <value>**.
5. **Quick check** (optional, 1 line) — sanity check or common pitfall.

FORMATTING:
- Math: $...$ inline, $$...$$ display.
- Tables: GitHub-Flavored Markdown with blank lines around.
- Keep it tight — no motivational fluff, no "great question!", no restating the problem beyond the Given bullets.

If the image is genuinely unreadable (blank/blurry/unrelated), say so in ONE sentence and ask for a clearer photo. Otherwise, solve it — even if handwriting is messy, state your assumption and proceed.`;

    const userContent: any[] = [];
    if (userPrompt) userContent.push({ type: "text", text: userPrompt });
    else userContent.push({ type: "text", text: "Please solve this problem step-by-step." });
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${imgMime};base64,${imageBase64}` },
    });

    console.log("[snap-solve] Calling Gemini vision, image bytes:", imageBase64.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        ...DETERMINISTIC_AI_SETTINGS,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[snap-solve] gateway error:", response.status, errText);
      if (response.status === 429) return jsonResponse({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
      if (response.status === 402) return jsonResponse({ error: "AI credits exhausted." }, { status: 402 });
      return jsonResponse({ error: "AI service unavailable." }, { status: 502 });
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") {
      return jsonResponse({ error: "AI response was cut off. Please try again with a clearer/cropped image." }, { status: 502 });
    }
    const reply = choice?.message?.content || "";
    if (!reply) return jsonResponse({ error: "Empty AI response" }, { status: 502 });

    return jsonResponse({ reply });
  } catch (error) {
    console.error("snap-solve error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: msg }, { status: 500 });
  }
});
