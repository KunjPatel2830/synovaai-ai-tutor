import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let pdfId: string | null = null;

  try {
    const body = await req.json();
    const { pdfBase64, subject, chapter, teacherId, fileName } = body;

    // Support both new (no pdfId) and legacy (with pdfId) calls
    pdfId = body.pdfId || null;

    if (!pdfBase64 || !subject || !chapter || !teacherId) {
      throw new Error("Missing required fields: pdfBase64, subject, chapter, teacherId");
    }

    // If no pdfId provided, create the record internally
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

      if (insertErr) {
        console.error("[process-study-pdf] Failed to create PDF record:", insertErr.message);
        throw new Error(`Failed to create PDF record: ${insertErr.message}`);
      }
      pdfId = record.id;
    } else {
      await supabase
        .from("study_pdfs")
        .update({ processing_status: "processing", error_message: null })
        .eq("id", pdfId);
    }

    console.log(`[process-study-pdf] Processing PDF ${pdfId}, subject: ${subject}, chapter: ${chapter}`);

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

    // Call AI to extract questions, topics, and solutions
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an expert educational content analyzer. Your job is to:
1. Extract ALL questions from the document
2. Classify each question into a topic (e.g., "Electric Charges", "Coulomb's Law", "Thermodynamics")
3. Generate a clear, step-by-step solution for each question
If no clear questions exist, extract key concepts as questions with explanatory answers.
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
                text: `Analyze this PDF from subject "${subject}", chapter "${chapter}". Extract all questions, classify them by topic, and generate step-by-step solutions.`,
              },
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
    let extracted: { topics: any[] };

    if (toolCall?.function?.arguments) {
      extracted = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try to parse the content as JSON
      const content = aiResult.choices?.[0]?.message?.content || "";
      console.log("[process-study-pdf] Tool call not returned, attempting JSON fallback...");
      extracted = tryParseContent(content);
      if (!extracted) {
        // Second attempt: ask AI to re-format as JSON
        console.log("[process-study-pdf] Fallback parse failed, retrying with JSON-only prompt...");
        const retryResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: "Convert the following educational content into a JSON object with this exact structure: {\"topics\":[{\"topic_name\":\"...\",\"questions\":[{\"question_text\":\"...\",\"solution_text\":\"...\"}]}]}. Return ONLY valid JSON, no markdown.",
              },
              { role: "user", content: content.slice(0, 30000) },
            ],
          }),
        });
        if (retryResp.ok) {
          const retryResult = await retryResp.json();
          const retryContent = retryResult.choices?.[0]?.message?.content || "";
          extracted = tryParseContent(retryContent);
        }
        if (!extracted) {
          throw new Error("AI did not return structured content after fallback");
        }
      }
    }

    if (!extracted.topics || !Array.isArray(extracted.topics) || extracted.topics.length === 0) {
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

      const batchSize = 10;
      for (let i = 0; i < questionsToInsert.length; i += batchSize) {
        const batch = questionsToInsert.slice(i, i + batchSize);
        const { error: qError } = await supabase.from("study_questions").insert(batch);
        if (qError) {
          console.error("[process-study-pdf] Question insert error:", qError.message);
        } else {
          totalQuestions += batch.length;
        }
      }
    }

    await supabase
      .from("study_pdfs")
      .update({
        processing_status: "completed",
        questions_count: totalQuestions,
        completed_at: new Date().toISOString(),
      })
      .eq("id", pdfId);

    console.log(`[process-study-pdf] Done! ${extracted.topics.length} topics, ${totalQuestions} questions`);

    return new Response(
      JSON.stringify({
        success: true,
        pdfId,
        topicsCount: extracted.topics.length,
        questionsCount: totalQuestions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[process-study-pdf] Fatal error:", errorMessage);

    if (pdfId) {
      await supabase
        .from("study_pdfs")
        .update({ processing_status: "failed", error_message: errorMessage })
        .eq("id", pdfId);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
