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
const MAX_SUBJECT_LENGTH = 100;
const MAX_CHAPTER_LENGTH = 200;
const MAX_FILENAME_LENGTH = 255;

function isValidUUID(val: unknown): val is string {
  return typeof val === "string" && UUID_RE.test(val);
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  return stripHtml(input).slice(0, maxLen);
}

function tryParseContent(text: string): { topics: any[] } | null {
  if (!text) return null;
  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.topics && Array.isArray(parsed.topics)) return parsed;
    return null;
  } catch {
    const match = cleaned.match(/\{[\s\S]*"topics"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.topics && Array.isArray(parsed.topics)) return parsed;
      } catch { /* ignore */ }
    }
    return null;
  }
}

function createTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let pdfId: string | null = null;

  try {
    const body = await req.json();
    const { pdfBase64 } = body;
    pdfId = body.pdfId || null;

    // Validate and sanitize inputs
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      throw new Error("Missing or invalid pdfBase64");
    }

    const subject = sanitizeText(body.subject, MAX_SUBJECT_LENGTH);
    const chapter = sanitizeText(body.chapter, MAX_CHAPTER_LENGTH);
    const teacherId = body.teacherId;
    const fileName = sanitizeText(body.fileName, MAX_FILENAME_LENGTH) || "upload.pdf";

    if (!subject) throw new Error("Missing subject");
    if (!chapter) throw new Error("Missing chapter");
    if (!isValidUUID(teacherId)) throw new Error("Invalid teacherId format");
    if (pdfId && !isValidUUID(pdfId)) throw new Error("Invalid pdfId format");

    if (!pdfId) {
      console.log(`[process-study-pdf] Creating study_pdfs record internally`);
      const { data: record, error: insertErr } = await supabase
        .from("study_pdfs")
        .insert({
          teacher_id: teacherId,
          subject,
          chapter,
          file_name: fileName || "upload.pdf",
          processing_status: "processing",
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`Failed to create PDF record: ${insertErr.message}`);
      pdfId = record.id;
    } else {
      await supabase.from("study_pdfs").update({ processing_status: "processing", error_message: null }).eq("id", pdfId);
    }

    console.log(`[process-study-pdf] Processing PDF ${pdfId}, subject: ${subject}, chapter: ${chapter}`);

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

    // AI call with 55s timeout
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an expert educational content analyzer. Extract ALL questions from the document, classify each into a topic, and generate step-by-step solutions. If no clear questions exist, extract key concepts as questions with explanatory answers. You MUST respond using the provided tool/function.`,
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${cleanBase64}` } },
              { type: "text", text: `Analyze this PDF from subject "${subject}", chapter "${chapter}". Extract all questions, classify by topic, and generate step-by-step solutions.` },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_extracted_content",
              description: "Save the extracted questions, topics, and solutions from the PDF",
              parameters: {
                type: "object",
                properties: {
                  topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic_name: { type: "string" },
                        questions: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              question_text: { type: "string" },
                              solution_text: { type: "string" },
                            },
                            required: ["question_text", "solution_text"],
                          },
                        },
                      },
                      required: ["topic_name", "questions"],
                    },
                  },
                },
                required: ["topics"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_extracted_content" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[process-study-pdf] AI error:", aiResponse.status, errText);
      throw new Error(`AI processing failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let extracted: { topics: any[] } | null = null;

    if (toolCall?.function?.arguments) {
      extracted = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiResult.choices?.[0]?.message?.content || "";
      console.log("[process-study-pdf] Tool call not returned, trying fallback parse...");
      extracted = tryParseContent(content);
    }

    if (!extracted || !extracted.topics || extracted.topics.length === 0) {
      throw new Error("No topics extracted from PDF");
    }

    console.log(`[process-study-pdf] Extracted ${extracted.topics.length} topics`);

    let totalQuestions = 0;
    for (const topicData of extracted.topics) {
      const { data: topic, error: topicError } = await supabase
        .from("study_topics")
        .insert({ pdf_id: pdfId, name: topicData.topic_name })
        .select("id")
        .single();

      if (topicError || !topic) {
        console.error("[process-study-pdf] Failed to create topic:", topicError);
        continue;
      }

      const questionsToInsert = topicData.questions.map((q: any) => ({
        topic_id: topic.id,
        pdf_id: pdfId,
        question_text: q.question_text,
        solution_text: q.solution_text || null,
      }));

      for (let i = 0; i < questionsToInsert.length; i += 10) {
        const batch = questionsToInsert.slice(i, i + 10);
        const { error: qError } = await supabase.from("study_questions").insert(batch);
        if (qError) {
          console.error("[process-study-pdf] Question insert error:", qError.message);
        } else {
          totalQuestions += batch.length;
        }
      }
    }

    await supabase.from("study_pdfs").update({
      processing_status: "completed",
      questions_count: totalQuestions,
      completed_at: new Date().toISOString(),
    }).eq("id", pdfId);

    console.log(`[process-study-pdf] Done! ${extracted.topics.length} topics, ${totalQuestions} questions`);

    return new Response(
      JSON.stringify({ success: true, pdfId, topicsCount: extracted.topics.length, questionsCount: totalQuestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[process-study-pdf] Fatal error:", errorMessage);

    if (pdfId) {
      await supabase.from("study_pdfs").update({ processing_status: "failed", error_message: errorMessage }).eq("id", pdfId);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
