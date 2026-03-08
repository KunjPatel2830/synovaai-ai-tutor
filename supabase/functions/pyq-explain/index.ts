import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      systemPrompt = `You are an expert ${subject} teacher helping students prepare for ${examType || "competitive exams"} like JEE and NEET.

Answer the student's follow-up question clearly and completely.

RULES:
- Total length: <= 250 words
- Use LaTeX for any math/formulas
- Show complete working — do NOT cut off mid-solution
- Prefer bullets if multiple points
- If a diagram/visual is necessary, include exactly ONE tag on its own line: [IMAGE: ...]
`;

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

Give a complete answer.`;
    } else {
      systemPrompt = `You are an expert ${subject} teacher helping students prepare for ${examType || "competitive exams"} like JEE and NEET.

Give a COMPLETE exam-style explanation with full solution steps.

OUTPUT FORMAT:
Result: ${isCorrect ? "Correct" : "Incorrect"}. Correct option: ${correctOption}.

**Solution:**
(Show complete step-by-step working. Do NOT cut off mid-calculation.)

**Key formula:** (if applicable)
**Quick tip:** (1 short line)

RULES:
- Show ALL steps — never leave a solution incomplete
- Use LaTeX for all math/formulas
- If the question needs a diagram/visual, add ONE line: [IMAGE: short descriptive diagram name]
`;

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

Explain using the exact format above.`;
    }

    console.log(`[pyq-explain] ${isFollowUp ? "Follow-up" : "Explanation"} for ${subject} question`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI provider is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: isFollowUp ? 220 : 320,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[pyq-explain] AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return streaming response directly
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
