import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

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
      // Follow-up question: keep it short and directly useful
      systemPrompt = `You are an expert ${subject} teacher helping students prepare for ${examType || "competitive exams"} like JEE and NEET.

Answer the student's follow-up question in an exam-style, VERY SHORT way.

RULES:
- Total length: <= 80 words
- No long theory, no extra sections, no fluff
- Use LaTeX for any math/formulas
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

Reply briefly (<= 80 words).`;
    } else {
      // Initial explanation after answering: short, direct, exam-focused
      systemPrompt = `You are an expert ${subject} teacher helping students prepare for ${examType || "competitive exams"} like JEE and NEET.

Give a SHORT exam-style explanation (not a full lecture).

OUTPUT FORMAT (follow EXACTLY):
Result: ${isCorrect ? "Correct" : "Incorrect"}. Correct option: ${correctOption}.
Why:
- (1 to 3 bullets, max 12 words each)
Key formula: (1 line, omit if not needed)
Quick tip: (1 short line)

RULES:
- Total length: <= 120 words
- No extra headings/emojis/sections beyond the format above
- Use LaTeX for formulas
- If the question needs a diagram/visual (lens rays, circuits, geometry figure, graph, etc.), add EXACTLY ONE line right after the Why bullets:
  [IMAGE: short descriptive diagram name]
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

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://synova.app",
        "X-Title": "SYNOVA PYQ Explain",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
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
