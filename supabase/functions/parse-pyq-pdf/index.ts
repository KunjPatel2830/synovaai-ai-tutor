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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { uploadId, pdfBase64, examType, year, shift, userId } = await req.json();

    if (!uploadId || !pdfBase64 || !examType || !year || !userId) {
      throw new Error("Missing required fields: uploadId, pdfBase64, examType, year, userId");
    }

    console.log(`[parse-pyq-pdf] Starting extraction for upload ${uploadId}`);

    // Update status to processing
    await supabase
      .from("pyq_uploads")
      .update({ status: "processing", error_message: null })
      .eq("id", uploadId);

    // Step 1: Extract text from PDF using Gemini Vision
    console.log("[parse-pyq-pdf] Step 1: Extracting text from PDF with Gemini...");
    
    // Clean base64 - remove data URL prefix if present
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

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
            role: "system",
            content: `You are an expert at extracting examination questions from PDF documents.
Extract ALL questions from the provided PDF. For each question, extract:
- The complete question text
- All answer options (A, B, C, D)
- The correct answer if marked
- The subject area (Physics, Chemistry, Mathematics, Biology)
- The topic if identifiable

Format your response as a structured list of questions. Be thorough and extract every single question visible in the document.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all ${examType} ${year}${shift ? ` ${shift}` : ""} exam questions from this PDF. List each question with its options and correct answer.`,
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
      console.error("[parse-pyq-pdf] Extraction failed:", errorText);
      throw new Error(`PDF extraction failed: ${extractionResponse.status}`);
    }

    const extractionData = await extractionResponse.json();
    const extractedText = extractionData.choices?.[0]?.message?.content || "";

    if (!extractedText || extractedText.length < 100) {
      throw new Error("Failed to extract meaningful text from PDF");
    }

    console.log(`[parse-pyq-pdf] Extracted ${extractedText.length} chars of text`);

    // Step 2: Structure the extracted content using tool calling
    console.log("[parse-pyq-pdf] Step 2: Structuring questions with tool calling...");

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
            content: "You are an expert at parsing examination questions into structured format. Parse the provided text into individual questions with all required fields.",
          },
          {
            role: "user",
            content: `Parse the following extracted exam content into structured questions. This is from ${examType} ${year}${shift ? ` ${shift}` : ""} exam.\n\n${extractedText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_questions",
              description: "Save parsed examination questions to the database",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question_text: {
                          type: "string",
                          description: "The complete question text",
                        },
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
                        correct_option: {
                          type: "string",
                          enum: ["A", "B", "C", "D"],
                          description: "The correct answer option letter",
                        },
                        subject: {
                          type: "string",
                          enum: ["Physics", "Chemistry", "Mathematics", "Biology"],
                          description: "The subject area of the question",
                        },
                        topic: {
                          type: "string",
                          description: "The specific topic or chapter",
                        },
                        explanation: {
                          type: "string",
                          description: "Explanation of the correct answer",
                        },
                        difficulty: {
                          type: "string",
                          enum: ["easy", "medium", "hard"],
                          description: "Difficulty level of the question",
                        },
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
      console.error("[parse-pyq-pdf] Structuring failed:", errorText);
      throw new Error(`Question structuring failed: ${structuringResponse.status}`);
    }

    const structuringData = await structuringResponse.json();
    const toolCall = structuringData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "save_questions") {
      console.error("[parse-pyq-pdf] No valid tool call in response");
      throw new Error("Failed to structure questions properly");
    }

    let parsedQuestions: ParsedQuestion[];
    try {
      const args = JSON.parse(toolCall.function.arguments);
      parsedQuestions = args.questions;
    } catch (e) {
      console.error("[parse-pyq-pdf] Failed to parse tool arguments:", e);
      throw new Error("Failed to parse structured questions");
    }

    if (!parsedQuestions || parsedQuestions.length === 0) {
      throw new Error("No questions could be extracted from the PDF");
    }

    console.log(`[parse-pyq-pdf] Parsed ${parsedQuestions.length} questions`);

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

    const { error: insertError } = await supabase
      .from("pyq_questions")
      .insert(questionsToInsert);

    if (insertError) {
      console.error("[parse-pyq-pdf] Failed to insert questions:", insertError);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    // Update upload status to completed
    await supabase
      .from("pyq_uploads")
      .update({
        status: "completed",
        questions_count: parsedQuestions.length,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", uploadId);

    console.log(`[parse-pyq-pdf] Successfully processed ${parsedQuestions.length} questions`);

    return new Response(
      JSON.stringify({
        success: true,
        questionsCount: parsedQuestions.length,
        message: `Successfully extracted ${parsedQuestions.length} questions`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[parse-pyq-pdf] Error:", error);

    // Try to update the upload status to failed
    try {
      const { uploadId } = await req.clone().json();
      if (uploadId) {
        await supabase
          .from("pyq_uploads")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", uploadId);
      }
    } catch (e) {
      console.error("[parse-pyq-pdf] Failed to update error status:", e);
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
