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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const SCHEMES: Record<string, { correct: number; incorrect: number }> = {
  JEE: { correct: 4, incorrect: -1 },
  NEET: { correct: 4, incorrect: -1 },
  BOARDS: { correct: 1, incorrect: 0 },
  CUSTOM: { correct: 4, incorrect: -1 },
};
const MIN_POOL = 10;

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const c = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await c.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

async function generateBatch(o: { exam: string; subject: string; difficulty: string; count: number; language: string; seed: number }) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("AI not configured");
  const system = `You write ${o.exam} exam-style multiple-choice questions.
LANGUAGE: ${o.language} (formulas, symbols, units stay standard).
Return ONLY JSON: {"questions":[{"topic":"...","question":"...","options":["...","...","...","..."],"correct":"A","explanation":"..."}]}
Rules:
- Exactly ${o.count} questions, subject: ${o.subject}, difficulty: ${o.difficulty}. Cover different chapters.
- 4 options, exactly one correct. "correct" is A, B, C or D.
- For numericals: solve fully yourself, double-check the arithmetic, and make sure the correct option exactly matches your computed value. Distractors should be common mistakes.
- Explanation: concise step-by-step working, under 80 words. Use $...$ for math.
- No markdown fences, no commentary.`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions: system,
      input: `Generate set #${o.seed} for ${o.subject}.`,
    }),
  });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("CREDITS");
  if (!res.ok) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw: string = data?.output_text ??
    (data?.output ?? []).flatMap((o: any) => o?.content ?? []).map((c: any) => c?.text ?? "").join("");
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(m ? m[0] : cleaned);
  return (Array.isArray(parsed?.questions) ? parsed.questions : [])
    .map((q: any) => ({
      topic: str(q?.topic, 150) || o.subject,
      question: str(q?.question, 3000),
      options: Array.isArray(q?.options) ? q.options.slice(0, 4).map((x: unknown) => str(x, 500)) : [],
      correct: str(q?.correct, 1).toUpperCase(),
      explanation: str(q?.explanation, 2000),
      subject: o.subject,
    }))
    .filter((q: any) => q.question && q.options.length === 4 && "ABCD".includes(q.correct) && q.correct);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const userId = await requireUser(req);
  if (!userId) return json({ error: "Unauthorized" }, 401);
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = str(body?.action, 30);
    const language = str(body?.language, 40) || "english";

    const loadQuestions = async (testId: string) => {
      const { data, error } = await db
        .from("mock_test_questions")
        .select("id, position, subject, topic, question_text, options")
        .eq("test_id", testId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    };

    if (action === "create") {
      const exam = (str(body?.examType, 20) || "JEE").toUpperCase();
      const scheme = SCHEMES[exam] ?? SCHEMES.CUSTOM;
      const subjects: string[] = (Array.isArray(body?.subjects) ? body.subjects : [])
        .map((s: unknown) => str(s, 60)).filter(Boolean).slice(0, 4);
      if (!subjects.length) return json({ error: "Pick at least one subject" }, 400);
      const difficulty = ["easy", "medium", "hard", "mixed"].includes(body?.difficulty) ? body.difficulty : "mixed";
      const count = clamp(Number(body?.questionCount) || 15, 5, 30);
      const duration = clamp(Number(body?.durationMinutes) || 30, 5, 180);

      // Split into parallel batches of up to 10 per subject
      const per = Math.ceil(count / subjects.length);
      const jobs: Promise<any[]>[] = [];
      subjects.forEach((subject) => {
        let left = per;
        let seed = 1;
        while (left > 0) {
          const n = Math.min(10, left);
          jobs.push(generateBatch({ exam, subject, difficulty, count: n, language, seed: seed++ }));
          left -= n;
        }
      });
      let questions: any[];
      try {
        questions = (await Promise.all(jobs)).flat().slice(0, count);
      } catch (e) {
        const msg = (e as Error).message;
        if (msg === "RATE_LIMIT") return json({ error: "Too many requests, please wait a minute and try again." }, 429);
        if (msg === "CREDITS") return json({ error: "AI usage limit reached. Please try again later." }, 402);
        throw e;
      }
      if (questions.length < 3) return json({ error: "Could not generate questions, please try again." }, 502);

      const { data: test, error: tErr } = await db.from("mock_tests").insert({
        user_id: userId, exam_type: exam, subjects, difficulty,
        question_count: questions.length, duration_minutes: duration,
        marks_correct: scheme.correct, marks_incorrect: scheme.incorrect,
      }).select("*").single();
      if (tErr) throw tErr;

      const { error: qErr } = await db.from("mock_test_questions").insert(
        questions.map((q, i) => ({
          test_id: test.id, position: i + 1, subject: q.subject, topic: q.topic,
          question_text: q.question, options: q.options, correct_option: q.correct,
          explanation: q.explanation, difficulty, source: "generated",
        }))
      );
      if (qErr) throw qErr;

      const { data: attempt, error: aErr } = await db.from("mock_test_attempts")
        .insert({ test_id: test.id, user_id: userId }).select("id, started_at").single();
      if (aErr) throw aErr;

      return json({ test, attempt, questions: await loadQuestions(test.id), serverNow: new Date().toISOString() });
    }

    if (action === "resume") {
      const { data: attempt } = await db.from("mock_test_attempts")
        .select("id, test_id, started_at, answers")
        .eq("user_id", userId).is("submitted_at", null)
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (!attempt) return json({ attempt: null });
      const { data: test } = await db.from("mock_tests").select("*").eq("id", attempt.test_id).single();
      return json({ test, attempt, questions: await loadQuestions(attempt.test_id), serverNow: new Date().toISOString() });
    }

    if (action === "discard") {
      const attemptId = str(body?.attemptId, 64);
      await db.from("mock_test_attempts").delete().eq("id", attemptId).eq("user_id", userId).is("submitted_at", null);
      return json({ ok: true });
    }

    if (action === "submit") {
      const attemptId = str(body?.attemptId, 64);
      const answers: Record<string, string> = typeof body?.answers === "object" && body.answers ? body.answers : {};
      const times: Record<string, number> = typeof body?.timePerQuestion === "object" && body.timePerQuestion ? body.timePerQuestion : {};

      const { data: attempt } = await db.from("mock_test_attempts").select("*")
        .eq("id", attemptId).eq("user_id", userId).maybeSingle();
      if (!attempt) return json({ error: "Attempt not found" }, 404);
      if (attempt.submitted_at) return json({ error: "Already submitted" }, 409);

      const { data: test } = await db.from("mock_tests").select("*").eq("id", attempt.test_id).single();
      const { data: qs } = await db.from("mock_test_questions").select("*").eq("test_id", attempt.test_id).order("position");

      let correct = 0, incorrect = 0, unattempted = 0;
      const topics = new Map<string, { subject: string; topic: string; correct: number; incorrect: number; unattempted: number; total: number }>();
      const review: any[] = [];
      for (const q of qs ?? []) {
        const a = str(answers[q.id], 1).toUpperCase();
        const key = `${q.subject}::${q.topic}`;
        const t = topics.get(key) ?? { subject: q.subject, topic: q.topic ?? q.subject, correct: 0, incorrect: 0, unattempted: 0, total: 0 };
        t.total++;
        if (!a) { unattempted++; t.unattempted++; }
        else if (a === q.correct_option) { correct++; t.correct++; }
        else { incorrect++; t.incorrect++; }
        topics.set(key, t);
        review.push({
          id: q.id, position: q.position, subject: q.subject, topic: q.topic,
          question_text: q.question_text, options: q.options, correct_option: q.correct_option,
          explanation: q.explanation, your_answer: a || null, time_seconds: Math.round(Number(times[q.id]) || 0),
        });
      }
      const total = (qs ?? []).length;
      const score = correct * Number(test.marks_correct) + incorrect * Number(test.marks_incorrect);
      const maxScore = total * Number(test.marks_correct);
      const accuracy = correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 1000) / 10 : 0;
      const breakdown = [...topics.values()].sort((a, b) => a.correct / a.total - b.correct / b.total);
      const elapsed = Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
      const durationSeconds = Math.min(elapsed, test.duration_minutes * 60 + 30);

      // Percentile vs. real pool of submitted attempts on the same exam type (normalised score)
      const { data: pool } = await db.from("mock_test_attempts")
        .select("score, max_score, mock_tests!inner(exam_type)")
        .eq("mock_tests.exam_type", test.exam_type)
        .not("submitted_at", "is", null).gt("max_score", 0).limit(5000);
      const mine = maxScore > 0 ? score / maxScore : 0;
      const ratios = (pool ?? []).map((p: any) => Number(p.score) / Number(p.max_score));
      let percentile: number | null = null;
      let basis = `not_enough_data:${ratios.length}`;
      if (ratios.length >= MIN_POOL) {
        const below = ratios.filter((r) => r < mine).length;
        const equal = ratios.filter((r) => r === mine).length;
        percentile = Math.round(((below + equal / 2) / ratios.length) * 1000) / 10;
        basis = `pool:${ratios.length}`;
      }

      await db.from("mock_test_attempts").update({
        answers, time_per_question: times, score, max_score: maxScore,
        correct_count: correct, incorrect_count: incorrect, unattempted_count: unattempted,
        accuracy, percentile, percentile_basis: basis, topic_breakdown: breakdown,
        duration_seconds: durationSeconds, submitted_at: new Date().toISOString(),
      }).eq("id", attemptId);
      await db.from("mock_tests").update({ status: "completed" }).eq("id", test.id);

      // Feed weak topics into the spaced-revision queue (one card per wrong question, max 10)
      const wrong = review.filter((r) => r.your_answer && r.your_answer !== r.correct_option).slice(0, 10);
      if (wrong.length) {
        await db.from("review_items").insert(wrong.map((r) => ({
          user_id: userId, subject: r.subject, topic: r.topic ?? r.subject, source_mode: "mock_test",
          prompt: r.question_text.slice(0, 1000),
          answer: `Correct: ${r.correct_option}) ${r.options?.["ABCD".indexOf(r.correct_option)] ?? ""}\n\n${r.explanation ?? ""}`.slice(0, 2000),
          due_at: new Date().toISOString(),
        })));
      }

      return json({
        result: { score, maxScore, correct, incorrect, unattempted, accuracy, percentile, basis, poolSize: ratios.length, minPool: MIN_POOL, breakdown, durationSeconds, addedToReview: wrong.length },
        review,
      });
    }

    if (action === "history") {
      const { data } = await db.from("mock_test_attempts")
        .select("id, score, max_score, accuracy, percentile, submitted_at, mock_tests!inner(exam_type, subjects, question_count)")
        .eq("user_id", userId).not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false }).limit(10);
      return json({ attempts: data ?? [] });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("mock-test error", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
