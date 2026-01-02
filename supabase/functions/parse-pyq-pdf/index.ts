import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function extractWithRetry(
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
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content: `You are an expert at extracting JEE/NEET examination questions from PDF documents.

Your task is to extract EVERY SINGLE question from the provided PDF. Be extremely thorough.

For EACH question, you MUST extract:
1. The COMPLETE question text (include any equations, formulas in LaTeX format)
2. ALL four answer options (A, B, C, D) with their complete text
3. The correct answer (if marked in the document)
4. The subject (Physics, Chemistry, Mathematics, or Biology)
5. The topic/chapter if identifiable

CRITICAL RULES:
- Extract ALL questions, do not skip any
- Preserve mathematical formulas using LaTeX notation (e.g., $\\frac{1}{2}mv^2$, $\\int_0^\\infty$)
- Keep question numbers for reference
- If correct answer is not marked, make your best educated guess based on the question
- For numerical answer type questions, still format as MCQ with the numerical value as option A

Output format for each question:
---
Q[number]: [Full question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct: [A/B/C/D]
Subject: [Physics/Chemistry/Mathematics/Biology]
Topic: [Topic name]
---`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract ALL questions from this ${examType} ${year}${shift ? ` ${shift}` : ""} exam PDF. Be thorough - I need every single question with all options and correct answers.`,
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
        console.error(`[parse-pyq-pdf] Extraction attempt ${attempt + 1} failed:`, errorText);
        throw new Error(`Extraction failed: ${extractionResponse.status} - ${errorText}`);
      }

      const extractionData = await extractionResponse.json();
      const extractedText = extractionData.choices?.[0]?.message?.content || "";

      if (!extractedText || extractedText.length < 200) {
        throw new Error("Extracted text too short - likely failed to read PDF");
      }

      console.log(`[parse-pyq-pdf] Extracted ${extractedText.length} characters`);
      return extractedText;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[parse-pyq-pdf] Attempt ${attempt + 1} failed:`, lastError.message);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
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
          content: `You are an expert at parsing JEE/NEET examination questions into a structured database format.

Parse ALL questions from the provided text. For each question, extract:
- question_text: The complete question including any LaTeX formulas
- options: An object with keys A, B, C, D and their corresponding option text
- correct_option: The letter of the correct answer (A, B, C, or D)
- subject: One of Physics, Chemistry, Mathematics, Biology
- topic: The specific topic/chapter (e.g., "Mechanics", "Organic Chemistry", "Calculus")
- explanation: A brief explanation of why the answer is correct (generate this if not provided)
- difficulty: easy, medium, or hard based on the complexity

IMPORTANT:
- Parse EVERY question in the text
- If a question doesn't have clear options, try to infer them
- Always provide a correct_option even if you need to determine it yourself
- Generate a brief explanation for each question`,
        },
        {
          role: "user",
          content: `Parse ALL the following ${examType} ${year}${shift ? ` ${shift}` : ""} exam questions into structured format:\n\n${extractedText}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_questions",
            description: "Save all parsed examination questions to the database",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  description: "Array of all parsed questions",
                  items: {
                    type: "object",
                    properties: {
                      question_text: {
                        type: "string",
                        description: "Complete question text with LaTeX formulas preserved",
                      },
                      options: {
                        type: "object",
                        properties: {
                          A: { type: "string", description: "Option A text" },
                          B: { type: "string", description: "Option B text" },
                          C: { type: "string", description: "Option C text" },
                          D: { type: "string", description: "Option D text" },
                        },
                        required: ["A", "B", "C", "D"],
                        additionalProperties: false,
                      },
                      correct_option: {
                        type: "string",
                        enum: ["A", "B", "C", "D"],
                        description: "The correct answer letter",
                      },
                      subject: {
                        type: "string",
                        enum: ["Physics", "Chemistry", "Mathematics", "Biology"],
                        description: "Subject area",
                      },
                      topic: {
                        type: "string",
                        description: "Specific topic or chapter name",
                      },
                      explanation: {
                        type: "string",
                        description: "Brief explanation of the correct answer",
                      },
                      difficulty: {
                        type: "string",
                        enum: ["easy", "medium", "hard"],
                        description: "Question difficulty level",
                      },
                    },
                    required: ["question_text", "options", "correct_option", "subject"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_questions" } },
    }),
  });

  if (!structuringResponse.ok) {
    const errorText = await structuringResponse.text();
    console.error("[parse-pyq-pdf] Structuring failed:", errorText);
    throw new Error(`Structuring failed: ${structuringResponse.status}`);
  }

  const structuringData = await structuringResponse.json();
  const toolCall = structuringData.choices?.[0]?.message?.tool_calls?.[0];

  if (!toolCall || toolCall.function.name !== "save_questions") {
    // Try to extract from content if tool call failed
    console.warn("[parse-pyq-pdf] No tool call, attempting fallback parse");
    throw new Error("Tool call not returned, structuring failed");
  }

  let parsedQuestions: ParsedQuestion[];
  try {
    const args = JSON.parse(toolCall.function.arguments);
    parsedQuestions = args.questions;
  } catch (e) {
    console.error("[parse-pyq-pdf] Failed to parse tool arguments:", e);
    throw new Error("Failed to parse structured questions JSON");
  }

  if (!parsedQuestions || parsedQuestions.length === 0) {
    throw new Error("No questions parsed from the text");
  }

  // Validate and clean questions
  const validQuestions = parsedQuestions.filter((q) => {
    if (!q.question_text || q.question_text.length < 10) return false;
    if (!q.options || !q.options.A || !q.options.B) return false;
    if (!q.correct_option || !["A", "B", "C", "D"].includes(q.correct_option)) return false;
    if (!q.subject || !["Physics", "Chemistry", "Mathematics", "Biology"].includes(q.subject)) return false;
    return true;
  });

  console.log(`[parse-pyq-pdf] Validated ${validQuestions.length}/${parsedQuestions.length} questions`);

  return validQuestions;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // Update status to processing
    await supabase
      .from("pyq_uploads")
      .update({ status: "processing", error_message: null })
      .eq("id", uploadId);

    // Clean base64 - remove data URL prefix if present
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

    // Step 1: Extract text from PDF with retry
    const extractedText = await extractWithRetry(cleanBase64, examType, year, shift);

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

    // Insert in batches to avoid timeouts
    const batchSize = 10;
    let insertedCount = 0;

    for (let i = 0; i < questionsToInsert.length; i += batchSize) {
      const batch = questionsToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase.from("pyq_questions").insert(batch);

      if (insertError) {
        console.error(`[parse-pyq-pdf] Batch insert error at ${i}:`, insertError);
        // Continue with other batches even if one fails
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`[parse-pyq-pdf] Inserted ${insertedCount}/${questionsToInsert.length} questions`);

    // Update upload status to completed
    await supabase
      .from("pyq_uploads")
      .update({
        status: "completed",
        questions_count: insertedCount,
        completed_at: new Date().toISOString(),
        error_message: insertedCount < questionsToInsert.length 
          ? `Partially completed: ${insertedCount}/${questionsToInsert.length} questions inserted`
          : null,
      })
      .eq("id", uploadId);

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
    console.error("[parse-pyq-pdf] Error:", error);

    // Update the upload status to failed
    if (uploadId) {
      await supabase
        .from("pyq_uploads")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error occurred",
        })
        .eq("id", uploadId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
