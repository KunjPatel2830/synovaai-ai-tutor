import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Input validation ──
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_EXAM_TYPES = ["JEE Main", "JEE Advanced", "NEET", "CUET", "BITSAT", "KVPY", "NTSE"];
const MAX_SHIFT_LENGTH = 50;
const MAX_FILENAME_LENGTH = 255;

function isValidUUID(val: unknown): val is string {
  return typeof val === "string" && UUID_RE.test(val);
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

interface ParsedQuestion {
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: string;
  subject: string;
  topic?: string;
  explanation?: string;
  difficulty?: string;
}

function tryParseJsonContent(content: string): ParsedQuestion[] | null {
  try {
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
    return null;
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

function createTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// Single-step: extract AND structure from PDF in one AI call
async function extractAndStructure(
  cleanBase64: string,
  examType: string,
  year: string,
  shift: string | null
): Promise<ParsedQuestion[]> {
  console.log("[parse-pyq-pdf] Starting single-step extraction + structuring...");

  // Attempt with tool calling
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: createTimeoutSignal(150000),
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting JEE/NEET examination questions from PDF documents and outputting structured JSON.

Extract EVERY question from the document. For each question provide:
- question_text: Complete question with LaTeX formulas preserved (e.g. $\\frac{1}{2}mv^2$)
- options: Object with keys A, B, C, D containing option text
- correct_option: A, B, C, or D (guess intelligently if not marked)
- subject: Physics, Chemistry, Mathematics, or Biology
- topic: Specific topic name (e.g. "Electrostatics", "Organic Chemistry")
- explanation: Brief 1-2 sentence explanation
- difficulty: easy, medium, or hard

Be thorough - extract ALL questions. Do NOT skip any.
You MUST respond using the provided tool/function.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:application/pdf;base64,${cleanBase64}` },
            },
            {
              type: "text",
              text: `Extract ALL questions from this ${examType} ${year}${shift ? ` ${shift}` : ""} exam paper. Return structured data for every question.`,
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_questions",
            description: "Save all parsed examination questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question_text: { type: "string" },
                      options: {
                        type: "object",
                        properties: { A: { type: "string" }, B: { type: "string" }, C: { type: "string" }, D: { type: "string" } },
                        required: ["A", "B", "C", "D"],
                      },
                      correct_option: { type: "string", enum: ["A", "B", "C", "D"] },
                      subject: { type: "string", enum: ["Physics", "Chemistry", "Mathematics", "Biology"] },
                      topic: { type: "string" },
                      explanation: { type: "string" },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                    },
                    required: ["question_text", "options", "correct_option", "subject"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_questions" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[parse-pyq-pdf] AI error:", response.status, errText);
    if (response.status === 429) throw new Error("Rate limited - please try again later");
    throw new Error(`AI processing failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  let questions: ParsedQuestion[] | null = null;

  if (toolCall?.function?.arguments) {
    const args = JSON.parse(toolCall.function.arguments);
    questions = args.questions;
    console.log(`[parse-pyq-pdf] Tool call returned ${questions?.length || 0} questions`);
  }

  // Fallback: parse content as JSON
  if (!questions || questions.length === 0) {
    const content = data.choices?.[0]?.message?.content || "";
    if (content) {
      console.log("[parse-pyq-pdf] Tool call missing, parsing content as JSON...");
      questions = tryParseJsonContent(content);
    }
  }

  if (!questions || questions.length === 0) {
    throw new Error("No questions extracted from PDF");
  }

  // Validate
  const valid = questions.filter((q) => {
    if (!q.question_text || q.question_text.length < 5) return false;
    if (!q.options || !q.options.A || !q.options.B) return false;
    if (!q.correct_option || !["A", "B", "C", "D"].includes(q.correct_option)) return false;
    if (!q.subject || !["Physics", "Chemistry", "Mathematics", "Biology"].includes(q.subject)) return false;
    return true;
  });

  console.log(`[parse-pyq-pdf] Validated ${valid.length}/${questions.length} questions`);
  if (valid.length === 0) throw new Error("No valid questions after validation");
  return valid;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let uploadId: string | null = null;

  try {
    const body = await req.json();
    const { pdfBase64, examType, year, shift, userId, fileName } = body;
    uploadId = body.uploadId || null;

    // Validate required fields
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      throw new Error("Missing or invalid pdfBase64");
    }
    if (!examType || typeof examType !== "string" || !VALID_EXAM_TYPES.includes(examType)) {
      throw new Error(`Invalid examType. Must be one of: ${VALID_EXAM_TYPES.join(", ")}`);
    }
    if (!year || isNaN(Number(year)) || Number(year) < 1990 || Number(year) > 2100) {
      throw new Error("Invalid year. Must be between 1990 and 2100");
    }
    if (!isValidUUID(userId)) {
      throw new Error("Invalid userId format");
    }
    if (uploadId && !isValidUUID(uploadId)) {
      throw new Error("Invalid uploadId format");
    }

    // Sanitize optional fields
    const safeShift = shift ? stripHtml(String(shift)).slice(0, MAX_SHIFT_LENGTH) : null;
    const safeFileName = fileName ? stripHtml(String(fileName)).slice(0, MAX_FILENAME_LENGTH) : "upload.pdf";

    if (!uploadId) {
      console.log(`[parse-pyq-pdf] Creating pyq_uploads record internally`);
      const { data: record, error: insertErr } = await supabase
        .from("pyq_uploads")
        .insert({
          uploaded_by: userId,
          exam_type: examType,
          year: parseInt(String(year)),
          shift: safeShift,
          file_name: safeFileName,
          status: "processing",
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`Failed to create upload record: ${insertErr.message}`);
      uploadId = record.id;
    } else {
      await supabase.from("pyq_uploads").update({ status: "processing", error_message: null }).eq("id", uploadId);
    }

    console.log(`[parse-pyq-pdf] Processing upload ${uploadId}, exam: ${examType}, year: ${year}`);

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

    // Single-step extraction + structuring
    const parsedQuestions = await extractAndStructure(cleanBase64, examType, year, shift);
    console.log(`[parse-pyq-pdf] Parsed ${parsedQuestions.length} questions, inserting...`);

    const questionsToInsert = parsedQuestions.map((q) => ({
      exam_type: examType,
      year: parseInt(String(year)),
      shift: safeShift,
      question_text: q.question_text,
      options: q.options,
      correct_option: q.correct_option,
      subject: q.subject,
      topic: q.topic || null,
      explanation: q.explanation || null,
      difficulty: q.difficulty || "medium",
      created_by: userId,
    }));

    let insertedCount = 0;
    for (let i = 0; i < questionsToInsert.length; i += 10) {
      const batch = questionsToInsert.slice(i, i + 10);
      const { error: insertError } = await supabase.from("pyq_questions").insert(batch);
      if (insertError) {
        console.error(`[parse-pyq-pdf] Batch insert error at ${i}:`, insertError.message);
      } else {
        insertedCount += batch.length;
      }
    }

    await supabase.from("pyq_uploads").update({
      status: insertedCount > 0 ? "completed" : "failed",
      questions_count: insertedCount,
      completed_at: new Date().toISOString(),
      error_message: insertedCount < questionsToInsert.length
        ? `Inserted ${insertedCount}/${questionsToInsert.length} questions`
        : null,
    }).eq("id", uploadId);

    console.log(`[parse-pyq-pdf] Done! ${insertedCount}/${questionsToInsert.length} questions inserted`);

    return new Response(
      JSON.stringify({ success: true, uploadId, questionsCount: insertedCount, totalParsed: parsedQuestions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[parse-pyq-pdf] Fatal error:", errorMessage);

    if (uploadId) {
      await supabase.from("pyq_uploads").update({ status: "failed", error_message: errorMessage }).eq("id", uploadId);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
