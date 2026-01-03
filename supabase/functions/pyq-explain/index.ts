import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, options, correctOption, studentAnswer, subject, topic, examType, followUpQuery } = await req.json();

    if (!question || !options || !correctOption) {
      throw new Error("Missing required fields");
    }

    const isCorrect = studentAnswer === correctOption;
    const isFollowUp = !!followUpQuery;

    let systemPrompt: string;
    let userPrompt: string;

    if (isFollowUp) {
      // Handle follow-up questions from students
      systemPrompt = `You are an expert ${subject} teacher helping students prepare for ${examType || "competitive exams"} like JEE and NEET.

A student is asking a follow-up question about a ${subject} problem. Answer their specific question clearly and concisely.

GUIDELINES:
- Address their exact question directly
- Use LaTeX for all mathematical expressions (e.g., $E = mc^2$, $\\int_0^\\infty$)
- Provide step-by-step explanations when needed
- If they're confused about a concept, explain it in simpler terms
- Relate your answer back to the original question when relevant
- Be encouraging and supportive

Keep your response focused on what they asked.`;

      userPrompt = `Original Question: ${question}

Options:
A) ${options.A}
B) ${options.B}
C) ${options.C}
D) ${options.D}

Correct Answer: ${correctOption}
Subject: ${subject}
${topic ? `Topic: ${topic}` : ""}

Student's Follow-up Question: ${followUpQuery}

Please answer their question.`;

    } else {
      // Handle initial explanation after answering
      systemPrompt = `You are an expert ${subject} teacher helping students prepare for ${examType || "competitive exams"} like JEE and NEET.

Your task is to provide a detailed, educational explanation for a question the student just answered.

ALWAYS structure your response with these sections:

## ${isCorrect ? "✅ Correct!" : "❌ Incorrect"}

${!isCorrect ? `The correct answer is **${correctOption}**.` : "Well done!"}

## 📚 Concept Used
Explain the core concept(s) tested in this question. Be specific about the topic/chapter.

## 🧮 Formula & Approach
- List the relevant formula(s) in LaTeX format
- Show the step-by-step approach to solve this problem
- Explain why option ${correctOption} is correct

## 💡 Key Insight
Provide a memorable tip or insight that helps students solve similar problems quickly.

## 🔗 Related Topics
Mention 2-3 related topics the student should revise for a complete understanding.

MANDATORY IMAGE GENERATION (VERY IMPORTANT):
- You MUST include [IMAGE: concept_name] tags for EVERY visual concept
- This is REQUIRED for: ray diagrams, lens/mirrors, electric circuits, cell structures, chemical structures, graphs, energy diagrams, vector diagrams, free body diagrams, wave patterns, molecular structures, anatomy, geometry figures
- Format: [IMAGE: descriptive name] - place IMMEDIATELY after introducing the concept
- Examples:
  * "The refraction through convex lens... [IMAGE: convex lens ray diagram with focal point]"
  * "The structure of chloroplast shows... [IMAGE: chloroplast labeled diagram]"
  * "In this circuit diagram... [IMAGE: parallel circuit with resistors]"
- NEVER skip this for visual/diagram-based questions!

Keep your explanation clear, concise, and exam-focused. Use LaTeX for all mathematical expressions (e.g., $E = mc^2$, $\\int_0^\\infty$).`;

      userPrompt = `Question: ${question}

Options:
A) ${options.A}
B) ${options.B}
C) ${options.C}
D) ${options.D}

Correct Answer: ${correctOption}
Student's Answer: ${studentAnswer}
Subject: ${subject}
${topic ? `Topic: ${topic}` : ""}

Provide a detailed explanation.`;
    }

    console.log(`[pyq-explain] ${isFollowUp ? "Follow-up" : "Explanation"} for ${subject} question`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[pyq-explain] API error:", response.status, error);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI API error: ${response.status}`);
    }

    // Return streaming response
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[pyq-explain] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
