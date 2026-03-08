import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 50;
const VALID_ROLES = ["user", "assistant", "system"];

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function requireUser(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }
  const userSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data, error } = await userSupabase.auth.getUser();
  if (error || !data.user) {
    return { error: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: data.user.id };
}

function validateMessages(messages: unknown): { valid: true; messages: Array<{ role: string; content: string }> } | { valid: false; error: string } {
  if (!Array.isArray(messages)) return { valid: false, error: "Messages must be an array" };
  if (messages.length === 0) return { valid: false, error: "Messages array cannot be empty" };
  if (messages.length > MAX_MESSAGES) return { valid: false, error: `Too many messages. Maximum is ${MAX_MESSAGES}` };

  const validatedMessages: Array<{ role: string; content: string }> = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") return { valid: false, error: `Message at index ${i} must be an object` };
    if (typeof msg.content !== "string") return { valid: false, error: `Message at index ${i} must have a string content` };
    if (msg.content.length === 0) return { valid: false, error: `Message at index ${i} content cannot be empty` };
    if (msg.content.length > MAX_MESSAGE_LENGTH) return { valid: false, error: `Message at index ${i} exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` };
    if (typeof msg.role !== "string" || !VALID_ROLES.includes(msg.role)) return { valid: false, error: `Message at index ${i} has invalid role` };
    validatedMessages.push({ role: msg.role, content: msg.content.trim() });
  }
  return { valid: true, messages: validatedMessages };
}

// ── Subject & Topic Detection ──

interface DetectedContext {
  detectedSubject: string;
  detectedTopic: string;
}

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  "Mathematics": ["math", "algebra", "geometry", "calculus", "trigonometry", "integration", "differentiation", "equation", "polynomial", "matrix", "matrices", "logarithm", "arithmetic", "probability", "statistics", "vector", "coordinate", "number theory", "limit", "derivative", "integral", "quadratic", "linear equation", "fraction", "percentage", "ratio", "proportion", "set theory", "permutation", "combination", "binomial", "sequence", "series", "progression", "determinant", "conic", "parabola", "hyperbola", "ellipse"],
  "Physics": ["physics", "newton", "force", "velocity", "acceleration", "momentum", "energy", "gravity", "thermodynamics", "optics", "lens", "mirror", "refraction", "reflection", "wave", "frequency", "electric", "magnetic", "ohm", "resistance", "circuit", "capacitor", "inductor", "quantum", "relativity", "nuclear", "friction", "torque", "pressure", "density", "buoyancy", "sound", "light", "electromagnetic", "current", "voltage", "power", "work", "kinetic", "potential", "oscillation", "pendulum", "projectile", "semiconductor"],
  "Chemistry": ["chemistry", "atom", "molecule", "element", "compound", "reaction", "acid", "base", "salt", "oxidation", "reduction", "redox", "bond", "covalent", "ionic", "periodic table", "electron", "proton", "neutron", "orbital", "valence", "mole", "molarity", "solution", "solvent", "solute", "catalyst", "equilibrium", "pH", "polymer", "organic", "inorganic", "hydrocarbon", "alkane", "alkene", "alkyne", "isomer", "electrochemistry", "thermochemistry"],
  "Biology": ["biology", "cell", "dna", "rna", "gene", "protein", "enzyme", "photosynthesis", "respiration", "mitosis", "meiosis", "evolution", "ecology", "ecosystem", "organism", "bacteria", "virus", "chromosome", "mutation", "heredity", "genetics", "anatomy", "physiology", "taxonomy", "biodiversity", "plant", "animal", "human body", "nervous system", "digestive", "circulatory", "reproductive", "immune", "hormone", "endocrine"],
  "Computer Science": ["computer", "programming", "algorithm", "data structure", "code", "software", "hardware", "python", "java", "html", "css", "javascript", "database", "network", "binary", "boolean", "loop", "function", "array", "stack", "queue", "tree", "graph", "sorting", "searching", "recursion", "oop", "object oriented", "class", "inheritance", "compiler", "operating system", "cpu", "memory", "artificial intelligence", "machine learning"],
  "English": ["grammar", "essay", "literature", "poem", "poetry", "novel", "prose", "vocabulary", "comprehension", "writing", "reading", "tense", "noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "syntax", "metaphor", "simile", "alliteration", "rhetoric", "narrative", "shakespeare", "figure of speech", "letter writing", "report writing", "summary"],
};

const TOPIC_PATTERNS: Array<{ pattern: RegExp; subject: string; topic: string }> = [
  // Math
  { pattern: /integrat(ion|e|ing)/i, subject: "Mathematics", topic: "Integration" },
  { pattern: /differenti(ation|ate|ating)/i, subject: "Mathematics", topic: "Differentiation" },
  { pattern: /quadratic/i, subject: "Mathematics", topic: "Quadratic Equations" },
  { pattern: /trigonometr/i, subject: "Mathematics", topic: "Trigonometry" },
  { pattern: /probabilit/i, subject: "Mathematics", topic: "Probability" },
  { pattern: /matri(x|ces)/i, subject: "Mathematics", topic: "Matrices" },
  { pattern: /determinant/i, subject: "Mathematics", topic: "Determinants" },
  { pattern: /vector/i, subject: "Mathematics", topic: "Vectors" },
  { pattern: /limit/i, subject: "Mathematics", topic: "Limits" },
  { pattern: /logarithm/i, subject: "Mathematics", topic: "Logarithms" },
  { pattern: /permutation|combination/i, subject: "Mathematics", topic: "Permutations & Combinations" },
  { pattern: /sequence|series|progression/i, subject: "Mathematics", topic: "Sequences & Series" },
  { pattern: /conic|parabola|ellipse|hyperbola/i, subject: "Mathematics", topic: "Conic Sections" },
  { pattern: /set theory|sets/i, subject: "Mathematics", topic: "Set Theory" },
  { pattern: /coordinate geometry/i, subject: "Mathematics", topic: "Coordinate Geometry" },
  // Physics
  { pattern: /newton.*law/i, subject: "Physics", topic: "Newton's Laws" },
  { pattern: /ohm.*law/i, subject: "Physics", topic: "Electricity" },
  { pattern: /thermodynamic/i, subject: "Physics", topic: "Thermodynamics" },
  { pattern: /optic|lens|mirror|refraction|reflection/i, subject: "Physics", topic: "Optics" },
  { pattern: /electromagnet/i, subject: "Physics", topic: "Electromagnetism" },
  { pattern: /gravit(y|ation)/i, subject: "Physics", topic: "Gravitation" },
  { pattern: /momentum/i, subject: "Physics", topic: "Momentum" },
  { pattern: /wave|frequency|oscillat/i, subject: "Physics", topic: "Waves & Oscillations" },
  { pattern: /projectile/i, subject: "Physics", topic: "Projectile Motion" },
  { pattern: /circuit|capacitor|inductor|resistor/i, subject: "Physics", topic: "Electric Circuits" },
  { pattern: /semiconductor|diode|transistor/i, subject: "Physics", topic: "Semiconductors" },
  { pattern: /nuclear|radioactiv/i, subject: "Physics", topic: "Nuclear Physics" },
  { pattern: /friction/i, subject: "Physics", topic: "Friction" },
  // Chemistry
  { pattern: /periodic table/i, subject: "Chemistry", topic: "Periodic Table" },
  { pattern: /organic chemistry|hydrocarbon|alkane|alkene|alkyne/i, subject: "Chemistry", topic: "Organic Chemistry" },
  { pattern: /acid.*base|pH/i, subject: "Chemistry", topic: "Acids & Bases" },
  { pattern: /oxidation|reduction|redox/i, subject: "Chemistry", topic: "Redox Reactions" },
  { pattern: /chemical bond|covalent|ionic bond/i, subject: "Chemistry", topic: "Chemical Bonding" },
  { pattern: /electrochemistry/i, subject: "Chemistry", topic: "Electrochemistry" },
  { pattern: /equilibrium/i, subject: "Chemistry", topic: "Chemical Equilibrium" },
  { pattern: /mole concept|molarity/i, subject: "Chemistry", topic: "Mole Concept" },
  { pattern: /polymer/i, subject: "Chemistry", topic: "Polymers" },
  // Biology
  { pattern: /photosynthesis/i, subject: "Biology", topic: "Photosynthesis" },
  { pattern: /mitosis|meiosis|cell division/i, subject: "Biology", topic: "Cell Division" },
  { pattern: /dna|rna|gene|genetic/i, subject: "Biology", topic: "Genetics" },
  { pattern: /evolution/i, subject: "Biology", topic: "Evolution" },
  { pattern: /ecology|ecosystem/i, subject: "Biology", topic: "Ecology" },
  { pattern: /nervous system/i, subject: "Biology", topic: "Nervous System" },
  { pattern: /digestive/i, subject: "Biology", topic: "Digestive System" },
  { pattern: /respiration/i, subject: "Biology", topic: "Respiration" },
  { pattern: /enzyme/i, subject: "Biology", topic: "Enzymes" },
  { pattern: /hormone|endocrine/i, subject: "Biology", topic: "Endocrine System" },
  // CS
  { pattern: /sorting|searching|algorithm/i, subject: "Computer Science", topic: "Algorithms" },
  { pattern: /data structure|array|stack|queue|tree|graph/i, subject: "Computer Science", topic: "Data Structures" },
  { pattern: /oop|object oriented|class|inheritance/i, subject: "Computer Science", topic: "OOP" },
  { pattern: /python/i, subject: "Computer Science", topic: "Python Programming" },
  { pattern: /html|css|javascript|web/i, subject: "Computer Science", topic: "Web Development" },
  { pattern: /database|sql/i, subject: "Computer Science", topic: "Databases" },
  // English
  { pattern: /grammar|tense|noun|verb|adjective/i, subject: "English", topic: "Grammar" },
  { pattern: /essay|writing/i, subject: "English", topic: "Essay Writing" },
  { pattern: /poem|poetry/i, subject: "English", topic: "Poetry" },
  { pattern: /comprehension|reading/i, subject: "English", topic: "Reading Comprehension" },
];

function detectSubjectAndTopic(text: string, providedSubject?: string, providedTopic?: string): DetectedContext {
  // If both already provided, use them
  if (providedSubject && providedTopic) {
    return { detectedSubject: providedSubject, detectedTopic: providedTopic };
  }

  const lowerText = text.toLowerCase();

  // Try specific topic patterns first
  for (const { pattern, subject, topic } of TOPIC_PATTERNS) {
    if (pattern.test(text)) {
      return {
        detectedSubject: providedSubject || subject,
        detectedTopic: providedTopic || topic,
      };
    }
  }

  // Fallback: keyword-based subject detection
  if (!providedSubject) {
    let bestSubject = "General";
    let bestScore = 0;
    for (const [subj, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
      let score = 0;
      for (const kw of keywords) {
        if (lowerText.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestSubject = subj;
      }
    }
    return {
      detectedSubject: bestScore > 0 ? bestSubject : "General",
      detectedTopic: providedTopic || "",
    };
  }

  return {
    detectedSubject: providedSubject || "General",
    detectedTopic: providedTopic || "",
  };
}

// ── Main Handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { messages, preferredLanguage, subject, topic, curriculum, studentContext, memoryContext } = body;

    const validation = validateMessages(messages);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, { status: 400 });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("AI provider is not configured");
    }

    // Detect subject/topic from the latest user message
    const lastUserMsg = [...validation.messages].reverse().find(m => m.role === "user");
    const detected = detectSubjectAndTopic(
      lastUserMsg?.content || "",
      subject,
      topic,
    );

    const curriculumGuide: Record<string, string> = {
      "CBSE": "Follow CBSE syllabus patterns. Use NCERT textbook examples and terminology.",
      "NCERT": "Strictly follow NCERT textbook content and examples.",
      "ICSE": "Follow ICSE syllabus which is more detailed than CBSE.",
      "Cambridge": "Follow Cambridge International curriculum (IGCSE/A-Level).",
      "IB": "Follow International Baccalaureate standards.",
      "GSEB": "Follow GSEB curriculum and exam patterns.",
      "State Board": "Adapt to regional state board curriculum.",
      "General": "Use universally applicable teaching methods."
    };

    const selectedCurriculum = curriculum && curriculumGuide[curriculum as keyof typeof curriculumGuide]
      ? curriculumGuide[curriculum as keyof typeof curriculumGuide]
      : curriculumGuide["General"];

    const subjectContext = detected.detectedSubject ? `Subject: ${detected.detectedSubject}` : "";
    const topicContext = detected.detectedTopic ? `Current Topic: ${detected.detectedTopic}` : "";
    const studentProfileContext = typeof studentContext === "string" && studentContext.trim()
      ? studentContext.trim()
      : "";
    const learningMemory = typeof memoryContext === "string" && memoryContext.trim()
      ? memoryContext.trim()
      : "";

    const systemPrompt = `You are SYNOVA, an adaptive AI tutor. Follow these rules:

CURRICULUM: ${selectedCurriculum}
${studentProfileContext ? `${studentProfileContext}\n` : ""}${learningMemory ? `${learningMemory}\n` : ""}${subjectContext}
${topicContext}

RULES:
1. Give SIMPLE explanations first, then build complexity
2. Provide ONE clear example 
3. Ask ONE comprehension question
4. Never give direct homework answers
5. Be warm, patient, and encouraging

RESPONSE FORMAT:
- Brief summary (1-2 sentences)
- Numbered steps for explanations
- End with a question

IMAGE GENERATION (only for visual concepts):
- Use [IMAGE: concept description] for scientific diagrams
- Example: [IMAGE: convex lens with light rays]`;

    console.log("[ai-tutor] Detected:", detected.detectedSubject, "/", detected.detectedTopic);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...validation.messages],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ai-tutor] AI gateway error:", response.status, errText);
      if (response.status === 429) return jsonResponse({ error: "Rate limit exceeded. Please wait and try again." }, { status: 429 });
      if (response.status === 402) return jsonResponse({ error: "AI credits exhausted. Please add credits in Settings → Usage." }, { status: 402 });
      return jsonResponse({ error: "AI service temporarily unavailable." }, { status: 502 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "";

    if (!reply) {
      return jsonResponse({ error: "AI returned empty response." }, { status: 502 });
    }

    console.log("[ai-tutor] Success, reply length:", reply.length);
    return jsonResponse({
      reply,
      detectedSubject: detected.detectedSubject,
      detectedTopic: detected.detectedTopic,
    });
  } catch (error) {
    console.error("Error in ai-tutor:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, { status: 500 });
  }
});
