import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const EXTERNAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;

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

      // Use Gemini 2.5 Flash for faster PDF extraction (Pro times out on large PDFs)
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
        
        if (extractionResponse.status === 429) {
          throw new Error("Rate limited - please try again later");
        }
        if (extractionResponse.status === 402) {
          throw new Error("API credits exhausted - please add funds");
        }
        
        throw new Error(`Extraction failed: ${extractionResponse.status}`);
      }

      const extractionData = await extractionResponse.json();
      const extractedText = extractionData.choices?.[0]?.message?.content || "";

      console.log(`[parse-pyq-pdf] Raw extraction length: ${extractedText.length} chars`);

      if (!extractedText || extractedText.length < 100) {
        throw new Error("Extracted text too short - PDF may be unreadable or empty");
      }

      // Check if we got actual questions
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
  console.log("[parse-pyq-pdf] Structuring questions with tool calling...");

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
                        properties: {
                          A: { type: "string" },
                          B: { type: "string" },
                          C: { type: "string" },
                          D: { type: "string" },
                        },
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

  if (!structuringResponse.ok) {
    const errorText = await structuringResponse.text();
    console.error("[parse-pyq-pdf] Structuring API error:", structuringResponse.status, errorText);
    throw new Error(`Structuring failed: ${structuringResponse.status}`);
  }

  const structuringData = await structuringResponse.json();
  const toolCall = structuringData.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall || toolCall.function.name !== "save_questions") {
    console.error("[parse-pyq-pdf] No tool call in response:", JSON.stringify(structuringData));
    throw new Error("Tool call not returned - structuring failed");
  }

  let parsedQuestions: ParsedQuestion[];
  try {
    const args = JSON.parse(toolCall.function.arguments);
    parsedQuestions = args.questions;
    console.log(`[parse-pyq-pdf] Parsed ${parsedQuestions?.length || 0} questions from tool call`);
  } catch (e) {
    console.error("[parse-pyq-pdf] Failed to parse tool arguments:", e);
    throw new Error("Failed to parse structured questions JSON");
  }

  if (!parsedQuestions || parsedQuestions.length === 0) {
    throw new Error("No questions parsed from the extracted text");
  }

  // Validate and clean questions
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_SERVICE_ROLE_KEY);
  let uploadId: string | null = null;

  try {
    const body = await req.json();
    uploadId = body.uploadId;
    const { pdfBase64, examType, year, shift, userId } = body;

    if (!uploadId || !pdfBase64 || !examType || !year || !userId) {
      throw new Error("Missing required fields: uploadId, pdfBase64, examType, year, userId");
    }

    console.log(`[parse-pyq-pdf] Starting extraction for upload ${uploadId}`);
    console.log(`[parse-pyq-pdf] Exam: ${examType}, Year: ${year}, Shift: ${shift || "N/A"}`);
    console.log(`[parse-pyq-pdf] PDF base64 length: ${pdfBase64.length} chars`);

    // Update status to processing
    await supabase
      .from("pyq_uploads")
      .update({ status: "processing", error_message: null })
      .eq("id", uploadId);

    // Clean base64 - remove data URL prefix if present
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    console.log(`[parse-pyq-pdf] Clean base64 length: ${cleanBase64.length} chars`);

    // Step 1: Extract text from PDF
    const extractedText = await extractWithGemini(cleanBase64, examType, year, shift);
    console.log(`[parse-pyq-pdf] Extraction complete, got ${extractedText.length} chars`);

    // Step 2: Structure the questions using tool calling
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

    // Insert in batches
    const batchSize = 10;
    let insertedCount = 0;

    for (let i = 0; i < questionsToInsert.length; i += batchSize) {
      const batch = questionsToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase.from("pyq_questions").insert(batch);

      if (insertError) {
        console.error(`[parse-pyq-pdf] Batch insert error at ${i}:`, insertError.message);
      } else {
        insertedCount += batch.length;
        console.log(`[parse-pyq-pdf] Inserted batch ${Math.floor(i / batchSize) + 1}, total: ${insertedCount}`);
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
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", uploadId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
