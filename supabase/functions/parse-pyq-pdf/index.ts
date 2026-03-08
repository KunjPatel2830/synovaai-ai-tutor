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
      console.log(`[parse-pyq-pdf] Extraction attempt ${attempt + 1}/${maxRetries + 1}`);

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
                  image_url: {
                    url: `data:application/pdf;base64,${cleanBase64}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!extractionResponse.ok) {
        const errorText = await extractionResponse.text();
        console.error(`[parse-pyq-pdf] Gemini extraction failed:`, extractionResponse.status, errorText);
        if (extractionResponse.status === 429) throw new Error("Rate limited - please try again later");
        if (extractionResponse.status === 402) throw new Error("API credits exhausted - please add funds");
        throw new Error(`Extraction failed: ${extractionResponse.status}`);
      }

      const extractionData = await extractionResponse.json();
      const extractedText = extractionData.choices?.[0]?.message?.content || "";

      console.log(`[parse-pyq-pdf] Raw extraction length: ${extractedText.length} chars`);

      if (!extractedText || extractedText.length < 100) {
        throw new Error("Extracted text too short - PDF may be unreadable or empty");
      }
      if (!extractedText.includes("Q") && !extractedText.includes("Question")) {
        throw new Error("No questions found in extraction output");
      }

      return extractedText;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[parse-pyq-pdf] Attempt ${attempt + 1} failed:`, lastError.message);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("All extraction attempts failed");
}

async function structureQuestions(
  extractedText: string,
  examType: string,
  year: string,
  shift: string | null
): Promise<ParsedQuestion[]> {
  console.log("[parse-pyq-pdf] Structuring questions with JSON mode...");

  // Try tool calling first, fall back to JSON parsing
  let parsedQuestions: ParsedQuestion[] | null = null;

  // Attempt 1: Tool calling
  try {
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

    if (structuringResponse.ok) {
      const structuringData = await structuringResponse.json();
      const toolCall = structuringData.choices?.[0]?.message?.tool_calls?.[0];

      if (toolCall && toolCall.function.name === "save_questions") {
        const args = JSON.parse(toolCall.function.arguments);
        parsedQuestions = args.questions;
        console.log(`[parse-pyq-pdf] Tool calling succeeded: ${parsedQuestions?.length || 0} questions`);
      } else {
        // Check if model returned content instead of tool call
        const content = structuringData.choices?.[0]?.message?.content;
        if (content) {
          console.log("[parse-pyq-pdf] Tool call not used, trying to parse content as JSON...");
          parsedQuestions = tryParseJsonContent(content);
        }
      }
    }
  } catch (e) {
    console.warn("[parse-pyq-pdf] Tool calling attempt failed:", e instanceof Error ? e.message : e);
  }

  // Attempt 2: Direct JSON response (fallback)
  if (!parsedQuestions || parsedQuestions.length === 0) {
    console.log("[parse-pyq-pdf] Falling back to direct JSON parsing...");

    const fallbackResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Parse ALL questions from this ${examType} ${year}${shift ? ` ${shift}` : ""} exam paper into a JSON array.

For EACH question return an object with these exact keys:
- "question_text": string (complete question)
- "options": {"A": "...", "B": "...", "C": "...", "D": "..."}
- "correct_option": "A" or "B" or "C" or "D"
- "subject": "Physics" or "Chemistry" or "Mathematics" or "Biology"
- "topic": string
- "explanation": string (brief)
- "difficulty": "easy" or "medium" or "hard"

Return ONLY a raw JSON array, no markdown, no code fences, no explanation. Start with [ and end with ].

Exam text:
${extractedText}`,
          },
        ],
      }),
    });

    if (!fallbackResponse.ok) {
      throw new Error(`Fallback structuring failed: ${fallbackResponse.status}`);
    }

    const fallbackData = await fallbackResponse.json();
    const content = fallbackData.choices?.[0]?.message?.content || "";
    parsedQuestions = tryParseJsonContent(content);
  }

  if (!parsedQuestions || parsedQuestions.length === 0) {
    throw new Error("No questions parsed from the extracted text");
  }

  const validQuestions = parsedQuestions.filter((q) => {
    if (!q.question_text || q.question_text.length < 5) return false;
    if (!q.options || !q.options.A || !q.options.B) return false;
    if (!q.correct_option || !["A", "B", "C", "D"].includes(q.correct_option)) return false;
    if (!q.subject || !["Physics", "Chemistry", "Mathematics", "Biology"].includes(q.subject)) return false;
    return true;
  });

  console.log(`[parse-pyq-pdf] Validated ${validQuestions.length}/${parsedQuestions.length} questions`);

  if (validQuestions.length === 0) {
    throw new Error("No valid questions after validation");
  }

  return validQuestions;
}

function tryParseJsonContent(content: string): ParsedQuestion[] | null {
  try {
    // Strip markdown code fences if present
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    // Try parsing as array directly
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
    return null;
  } catch {
    // Try to find JSON array in content
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
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

    // Support both new (no uploadId) and legacy (with uploadId) calls
    uploadId = body.uploadId || null;

    if (!pdfBase64 || !examType || !year || !userId) {
      throw new Error("Missing required fields: pdfBase64, examType, year, userId");
    }

    // If no uploadId provided, create the record internally
    if (!uploadId) {
      console.log(`[parse-pyq-pdf] Creating pyq_uploads record internally`);
      const { data: record, error: insertErr } = await supabase
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

      if (insertErr) {
        console.error("[parse-pyq-pdf] Failed to create upload record:", insertErr.message);
        throw new Error(`Failed to create upload record: ${insertErr.message}`);
      }
      uploadId = record.id;
    } else {
      // Legacy path: update existing record
      await supabase
        .from("pyq_uploads")
        .update({ status: "processing", error_message: null })
        .eq("id", uploadId);
    }

    console.log(`[parse-pyq-pdf] Processing upload ${uploadId}`);
    console.log(`[parse-pyq-pdf] Exam: ${examType}, Year: ${year}, Shift: ${shift || "N/A"}`);

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

    // Step 1: Extract text from PDF
    const extractedText = await extractWithGemini(cleanBase64, examType, year, shift);

    // Step 2: Structure the questions
    const parsedQuestions = await structureQuestions(extractedText, examType, year, shift);
    console.log(`[parse-pyq-pdf] Successfully parsed ${parsedQuestions.length} questions`);

    // Step 3: Insert questions into database
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

    const batchSize = 10;
    let insertedCount = 0;

    for (let i = 0; i < questionsToInsert.length; i += batchSize) {
      const batch = questionsToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase.from("pyq_questions").insert(batch);
      if (insertError) {
        console.error(`[parse-pyq-pdf] Batch insert error at ${i}:`, insertError.message);
      } else {
        insertedCount += batch.length;
      }
    }

    // Update upload status
    await supabase
      .from("pyq_uploads")
      .update({
        status: insertedCount > 0 ? "completed" : "failed",
        questions_count: insertedCount,
        completed_at: new Date().toISOString(),
        error_message: insertedCount < questionsToInsert.length
          ? `Inserted ${insertedCount}/${questionsToInsert.length} questions`
          : null,
      })
      .eq("id", uploadId);

    console.log(`[parse-pyq-pdf] Complete! Inserted ${insertedCount}/${questionsToInsert.length} questions`);

    return new Response(
      JSON.stringify({
        success: true,
        uploadId,
        questionsCount: insertedCount,
        totalParsed: parsedQuestions.length,
        message: `Successfully extracted ${insertedCount} questions`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[parse-pyq-pdf] Fatal error:", errorMessage);

    if (uploadId) {
      await supabase
        .from("pyq_uploads")
        .update({ status: "failed", error_message: errorMessage })
        .eq("id", uploadId);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
