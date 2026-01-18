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
    const { action, curriculum, standard, subject, chapter, currentTopic, messages, completedTopics } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    // Curriculum-specific context
    const curriculumContext: Record<string, string> = {
      "CBSE": "Follow CBSE/NCERT curriculum strictly. Use examples from NCERT textbooks. Cover topics as per CBSE syllabus structure.",
      "NCERT": "Follow NCERT curriculum strictly. Use examples directly from NCERT textbooks. Explain concepts as presented in NCERT.",
      "ICSE": "Follow ICSE curriculum guidelines. Use examples suitable for ICSE board examinations.",
      "GSEB": "Follow Gujarat Secondary and Higher Secondary Education Board (GSEB) curriculum. Use examples relevant to GSEB textbooks and exam patterns.",
      "Maharashtra Board": "Follow Maharashtra State Board curriculum (MSBSHSE). Cover topics as per their syllabus.",
      "Cambridge": "Follow Cambridge IGCSE/A-Level curriculum. Use international examples and follow Cambridge assessment objectives.",
      "IB": "Follow International Baccalaureate curriculum. Emphasize inquiry-based learning and global perspectives.",
      "State Board": "Follow the regional state board curriculum. Adapt to local syllabus requirements.",
    };

    const selectedCurriculumContext = curriculumContext[curriculum] || "Follow standard academic curriculum.";

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "get_chapters") {
      systemPrompt = `You are SYNOVA, an expert curriculum advisor. ${selectedCurriculumContext}

Your task is to provide a structured list of chapters for a student studying ${subject} in ${standard} standard/grade under ${curriculum} board.

Return ONLY a JSON array of chapters in order, with each chapter having:
- "number": chapter number
- "name": chapter name as per the curriculum
- "topicsCount": approximate number of topics in this chapter

Example format:
[
  {"number": 1, "name": "Electric Charges and Fields", "topicsCount": 8},
  {"number": 2, "name": "Electrostatic Potential and Capacitance", "topicsCount": 7}
]

Be accurate to the actual ${curriculum} curriculum for ${standard} standard ${subject}.`;

      userPrompt = `List all chapters for ${subject} in ${standard} standard under ${curriculum} board. Return ONLY valid JSON.`;
    } else if (action === "get_topics") {
      systemPrompt = `You are SYNOVA, an expert curriculum advisor. ${selectedCurriculumContext}

Your task is to provide a detailed list of topics for Chapter: "${chapter}" in ${subject} for ${standard} standard under ${curriculum} board.

Return ONLY a JSON array of topics in teaching order, with each topic having:
- "index": topic index (starting from 0)
- "name": topic name
- "description": brief description (1 sentence)
- "estimatedMinutes": estimated time to learn (5-20 minutes)

Topics should be ordered from foundational concepts to advanced applications.
Include all subtopics that would typically be covered in a complete chapter study.

Return ONLY valid JSON array.`;

      userPrompt = `List all topics for chapter "${chapter}" in ${subject} (${standard} standard, ${curriculum} board). Return ONLY valid JSON.`;
    } else if (action === "teach_topic") {
      systemPrompt = `You are SYNOVA, an adaptive AI tutor specializing in ${curriculum} curriculum education for ${standard} standard students.

CURRICULUM ALIGNMENT: ${selectedCurriculumContext}

You are teaching: ${subject} > Chapter: ${chapter} > Topic: ${currentTopic}

TEACHING METHODOLOGY - Follow this structure:
1. **Introduction** (2-3 sentences): Briefly introduce what this topic is about and why it's important.

2. **Core Concept Explanation**: 
   - Explain the main concept in simple, clear language
   - Use analogies and real-world examples students can relate to
   - Include any important definitions or terminology
   - If applicable, include formulas with clear explanation of each variable

3. **Worked Examples**:
   - Provide 2-3 step-by-step solved examples
   - Start with a simple example, then progress to more complex ones
   - Show all steps clearly with explanations

4. **Key Points to Remember**:
   - Summarize 4-5 key takeaways
   - Include any common mistakes to avoid
   - Mention any important exam tips

5. **Quick Check Question**:
   - End with 1-2 practice questions for the student to try
   - These should test understanding of the topic

Use LaTeX for mathematical expressions (wrap in $ for inline, $$ for block).
Use markdown formatting for clear structure.
Be encouraging and supportive in tone.`;

      userPrompt = messages && messages.length > 0 
        ? messages[messages.length - 1].content 
        : `Please teach me about "${currentTopic}" in detail. I'm studying ${chapter} in ${subject}.`;
    } else if (action === "continue_learning") {
      const completedList = completedTopics?.join(", ") || "none yet";
      
      systemPrompt = `You are SYNOVA, an adaptive AI tutor specializing in ${curriculum} curriculum for ${standard} standard.

CONTEXT:
- Subject: ${subject}
- Chapter: ${chapter}
- Current Topic: ${currentTopic}
- Previously completed topics: ${completedList}

The student is continuing their study session. Provide a brief recap of what was covered before (if any topics were completed), then smoothly transition into teaching the current topic.

Follow the same structured teaching methodology:
1. Brief recap/connection to previous topics (if any)
2. Introduction to current topic
3. Core concept explanation with examples
4. Worked examples (step-by-step)
5. Key points to remember
6. Quick check question

${selectedCurriculumContext}`;

      userPrompt = `I'm continuing my study. ${completedTopics && completedTopics.length > 0 ? `I've already learned: ${completedList}.` : ""} Now teach me about "${currentTopic}".`;
    } else if (action === "answer_doubt") {
      systemPrompt = `You are SYNOVA, helping a ${standard} standard student studying ${subject} under ${curriculum} curriculum.

Current Chapter: ${chapter}
Current Topic: ${currentTopic}

The student has a question. Answer it clearly and thoroughly:
- Use simple language appropriate for the student's level
- Provide examples if helpful
- Connect the answer back to the current topic being studied
- If the question is beyond the current topic's scope, briefly explain and redirect focus

${selectedCurriculumContext}`;

      userPrompt = messages && messages.length > 0 
        ? messages[messages.length - 1].content 
        : "I have a question about this topic.";
    } else {
      throw new Error("Invalid action specified");
    }

    console.log(`Curriculum study action: ${action}, subject: ${subject}, chapter: ${chapter}`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://synovaai-ai-tutor.lovable.app",
        "X-Title": "SYNOVA AI Tutor",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []),
          { role: "user", content: userPrompt },
        ],
        temperature: action === "get_chapters" || action === "get_topics" ? 0.3 : 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    // For structured data responses, try to parse JSON
    if (action === "get_chapters" || action === "get_topics") {
      try {
        let jsonStr = reply;
        const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }
        const parsed = JSON.parse(jsonStr);
        return new Response(
          JSON.stringify({ data: parsed, raw: reply }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch {
        return new Response(
          JSON.stringify({ reply, parseError: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Curriculum study error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
