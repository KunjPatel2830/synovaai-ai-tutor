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

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function requireUser(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
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

const admin = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** SM-2 scheduling. grade: 0 = again, 3 = hard, 4 = good, 5 = easy */
function sm2(
  item: { ease_factor: number; interval_days: number; repetitions: number; lapses: number },
  grade: number
) {
  let ef = Number(item.ease_factor) || 2.5;
  let reps = Number(item.repetitions) || 0;
  let interval = Number(item.interval_days) || 0;
  let lapses = Number(item.lapses) || 0;

  if (grade < 3) {
    reps = 0;
    lapses += 1;
    interval = 10 / (60 * 24); // ~10 minutes
  } else {
    ef = clamp(ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)), 1.3, 2.8);
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ef * 100) / 100;
    if (grade === 5) interval = Math.round(interval * 1.15 * 100) / 100;
    interval = clamp(interval, 1, 365);
  }

  const dueAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString();
  return { ease_factor: ef, interval_days: interval, repetitions: reps, lapses, due_at: dueAt };
}

async function generateCards(opts: { subject: string; topic: string; language: string; count: number }) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("AI not configured");

  const system = `You generate spaced-repetition flashcards for exam revision.
LANGUAGE: write in ${opts.language} (keep formulas, symbols, units and technical terms standard).
Return ONLY valid JSON: {"cards":[{"prompt":"...","answer":"..."}]}
Rules:
- Exactly ${opts.count} cards on the given subject and topic.
- Each prompt is one precise recall question (definition, formula, derivation step, numeric micro-problem, or common trap).
- Each answer is complete but under 60 words; for numeric cards show the calculation and final value with units.
- No duplicates, no markdown fences, no commentary.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0,
      top_p: 1,
      max_tokens: 2000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Subject: ${opts.subject}\nTopic: ${opts.topic}` },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI error ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : cleaned);
  const cards = Array.isArray(parsed?.cards) ? parsed.cards : [];
  return cards
    .map((c: any) => ({ prompt: str(c?.prompt, 1000), answer: str(c?.answer, 2000) }))
    .filter((c: any) => c.prompt && c.answer)
    .slice(0, opts.count);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const userId = auth.userId;
  const db = admin();

  try {
    const body = await req.json().catch(() => ({}));
    const action = str(body?.action, 40) || "due";
    const language = str(body?.language, 40) || "english";

    if (action === "due") {
      const limit = clamp(Number(body?.limit) || 20, 1, 50);
      const nowIso = new Date().toISOString();

      const [dueRes, countRes, totalRes] = await Promise.all([
        db
          .from("review_items")
          .select("id, subject, topic, prompt, answer, repetitions, interval_days, due_at, source_mode")
          .eq("user_id", userId)
          .eq("is_active", true)
          .lte("due_at", nowIso)
          .order("due_at", { ascending: true })
          .limit(limit),
        db
          .from("review_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_active", true)
          .lte("due_at", nowIso),
        db
          .from("review_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_active", true),
      ]);

      if (dueRes.error) throw dueRes.error;
      return jsonResponse({
        items: dueRes.data ?? [],
        dueCount: countRes.count ?? 0,
        totalCount: totalRes.count ?? 0,
      });
    }

    if (action === "stats") {
      const nowIso = new Date().toISOString();
      const [dueRes, totalRes, masteredRes] = await Promise.all([
        db.from("review_items").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("is_active", true).lte("due_at", nowIso),
        db.from("review_items").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("is_active", true),
        db.from("review_items").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("is_active", true).gte("interval_days", 21),
      ]);
      return jsonResponse({
        dueCount: dueRes.count ?? 0,
        totalCount: totalRes.count ?? 0,
        masteredCount: masteredRes.count ?? 0,
      });
    }

    if (action === "add") {
      const subject = str(body?.subject, 100);
      const topic = str(body?.topic, 200);
      const prompt = str(body?.prompt, 1000);
      const answer = str(body?.answer, 2000);
      const sourceMode = str(body?.sourceMode, 40) || "manual";
      if (!subject || !topic || !prompt) {
        return jsonResponse({ error: "subject, topic and prompt are required" }, { status: 400 });
      }
      const { data, error } = await db
        .from("review_items")
        .insert({
          user_id: userId,
          subject,
          topic,
          source_mode: sourceMode,
          prompt,
          answer,
          due_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return jsonResponse({ id: data.id });
    }

    if (action === "generate") {
      const subject = str(body?.subject, 100);
      const topic = str(body?.topic, 200);
      const count = clamp(Number(body?.count) || 5, 1, 10);
      if (!subject || !topic) {
        return jsonResponse({ error: "subject and topic are required" }, { status: 400 });
      }

      const { data: rl } = await db.rpc("check_rate_limit", {
        _user_id: userId, _endpoint: "review-queue-generate", _max_requests: 10, _window_seconds: 60,
      });
      if (rl && rl.length > 0 && !rl[0].allowed) {
        return jsonResponse({ error: `Too many requests. Try again in ${rl[0].retry_after}s.` }, { status: 429 });
      }

      const cards = await generateCards({ subject, topic, language, count });
      if (cards.length === 0) return jsonResponse({ error: "Could not generate cards" }, { status: 502 });

      const rows = cards.map((c: any) => ({
        user_id: userId,
        subject,
        topic,
        source_mode: str(body?.sourceMode, 40) || "generated",
        prompt: c.prompt,
        answer: c.answer,
        due_at: new Date().toISOString(),
      }));
      const { error } = await db.from("review_items").insert(rows);
      if (error) throw error;
      return jsonResponse({ created: rows.length });
    }

    if (action === "grade") {
      const itemId = str(body?.itemId, 64);
      const grade = clamp(Math.round(Number(body?.grade)), 0, 5);
      if (!itemId) return jsonResponse({ error: "itemId is required" }, { status: 400 });

      const { data: item, error: fetchErr } = await db
        .from("review_items")
        .select("id, ease_factor, interval_days, repetitions, lapses")
        .eq("id", itemId)
        .eq("user_id", userId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!item) return jsonResponse({ error: "Item not found" }, { status: 404 });

      const next = sm2(item as any, grade);
      const { error: updErr } = await db
        .from("review_items")
        .update({ ...next, last_reviewed_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("user_id", userId);
      if (updErr) throw updErr;

      await db.from("review_logs").insert({
        review_item_id: itemId,
        user_id: userId,
        grade,
        interval_days: next.interval_days,
      });

      return jsonResponse({ ok: true, nextDueAt: next.due_at, intervalDays: next.interval_days });
    }

    if (action === "suspend") {
      const itemId = str(body?.itemId, 64);
      if (!itemId) return jsonResponse({ error: "itemId is required" }, { status: 400 });
      const { error } = await db
        .from("review_items")
        .update({ is_active: false })
        .eq("id", itemId)
        .eq("user_id", userId);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("review-queue error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
  }
});
