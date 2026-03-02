import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ParsedQuestion {
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: string;
  subject: string;
  topic?: string;
  explanation?: string;
  difficulty?: string;
}

async function extractWithGemini(
  cleanBase64: string,
  examType: string,
  year: string,
  shift: string | null,
  maxRetries = 2
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are an expert at extracting JEE/NEET examination questions from PDF documents.

This is a ${examType} ${year}${shift ? ` ${shift}` : ""} exam paper.

Your task is to extract EVERY SINGLE question from this PDF. Be extremely thorough.

For EACH question, extract:
1. The COMPLETE question text (include any equations, formulas in LaTeX format like $\\frac{1}{2}mv^2$)
2. ALL four answer options (A, B, C, D) with their complete text
3. The correct answer (if marked, otherwise write "Unknown")
4. The subject (Physics, Chemistry, Mathematics, or Biology)
5. The topic/chapter if identifiable

Output format for EACH question (follow EXACTLY):
---
Q[number]: [Full question text]
A) [Option A text]
B) [Option B text]
C) [Option C text]
D) [Option D text]
Correct: [A/B/C/D or Unknown]
Subject: [Physics/Chemistry/Mathematics/Biology]
Topic: [Topic name or General]
---

Extract ALL questions. Do NOT skip any. Be thorough.`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:application/pdf;base64,${cleanBase64}` },
                },
              ],
            },
          ],
        }),
      });

      if (!extractionResponse.ok) {
        const errorText = await extractionResponse.text();
        if (extractionResponse.status === 429) throw new Error("Rate limited - please try again later");
        if (extractionResponse.status === 402) throw new Error("API credits exhausted");
        throw new Error(`Extraction failed: ${extractionResponse.status}`);
      }

      const extractionData = await extractionResponse.json();
      const extractedText = extractionData.choices?.[0]?.message?.content || "";

      if (!extractedText || extractedText.length < 100) throw new Error("Extracted text too short");
      if (!extractedText.includes("Q") && !extractedText.includes("Question")) throw new Error("No questions found");

      return extractedText;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }

  throw lastError || new Error("All extraction attempts failed");
}

async function structureQuestions(extractedText: string, examType: string, year: string, shift: string | null): Promise<ParsedQuestion[]> {
  const structuringResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an expert at parsing JEE/NEET examination questions into structured JSON format.

Parse ALL questions from the provided text. For each question:
- question_text: Complete question with LaTeX formulas preserved
- options: Object with A, B, C, D keys
- correct_option: A, B, C, or D (guess intelligently if "Unknown")
- subject: Physics, Chemistry, Mathematics, or Biology
- topic: Specific topic name
- explanation: Brief explanation (generate if not provided)
- difficulty: easy, medium, or hard

IMPORTANT: Parse EVERY question. Do not skip any.`,
        },
        {
          role: "user",
          content: `Parse ALL questions from this ${examType} ${year}${shift ? ` ${shift}` : ""} exam:\n\n${extractedText}`,
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

  if (!structuringResponse.ok) throw new Error(`Structuring failed: ${structuringResponse.status}`);

  const structuringData = await structuringResponse.json();
  const toolCall = structuringData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== "save_questions") throw new Error("Tool call not returned");

  const args = JSON.parse(toolCall.function.arguments);
  const parsedQuestions: ParsedQuestion[] = args.questions;

  if (!parsedQuestions || parsedQuestions.length === 0) throw new Error("No questions parsed");

  return parsedQuestions.filter((q) => {
    if (!q.question_text || q.question_text.length < 5) return false;
    if (!q.options || !q.options.A || !q.options.B) return false;
    if (!q.correct_option || !["A", "B", "C", "D"].includes(q.correct_option)) return false;
    if (!q.subject || !["Physics", "Chemistry", "Mathematics", "Biology"].includes(q.subject)) return false;
    return true;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let uploadId: string | null = null;

  try {
    const body = await req.json();
    const { pdfBase64, examType, year, shift, userId, fileName } = body;
    uploadId = body.uploadId || null;

    if (!pdfBase64 || !examType || !year || !userId) {
      throw new Error("Missing required fields: pdfBase64, examType, year, userId");
    }

    if (!uploadId) {
      const { data: record, error: insertErr } = await supabaseAdmin
        .from("pyq_uploads")
        .insert({
          uploaded_by: userId,
          exam_type: examType,
          year: parseInt(year),
          shift: shift || null,
          file_name: fileName || "upload.pdf",
          status: "processing",
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`Failed to create upload record: ${insertErr.message}`);
      uploadId = record.id;
    } else {
      await supabaseAdmin.from("pyq_uploads").update({ status: "processing", error_message: null }).eq("id", uploadId);
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const extractedText = await extractWithGemini(cleanBase64, examType, year, shift);
    const parsedQuestions = await structureQuestions(extractedText, examType, year, shift);

    const questionsToInsert = parsedQuestions.map((q) => ({
      exam_type: examType,
      year: parseInt(year),
      shift: shift || null,
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
      const { error: insertError } = await supabaseAdmin.from("pyq_questions").insert(batch);
      if (!insertError) insertedCount += batch.length;
    }

    await supabaseAdmin.from("pyq_uploads").update({
      status: insertedCount > 0 ? "completed" : "failed",
      questions_count: insertedCount,
      completed_at: new Date().toISOString(),
      error_message: insertedCount < questionsToInsert.length
        ? `Inserted ${insertedCount}/${questionsToInsert.length} questions`
        : null,
    }).eq("id", uploadId);

    return new Response(
      JSON.stringify({ success: true, uploadId, questionsCount: insertedCount, totalParsed: parsedQuestions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    if (uploadId) {
      await supabaseAdmin.from("pyq_uploads").update({ status: "failed", error_message: errorMessage }).eq("id", uploadId);
    }
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
