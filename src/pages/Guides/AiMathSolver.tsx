import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calculator, Brain, BookOpen, Lightbulb, CheckCircle, ArrowRight } from "lucide-react";
import synovaLogo from "@/assets/synova-landing-logo-optimized.webp";

const AiMathSolver = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={synovaLogo} alt="SYNOVA Learning Platform" className="h-8 w-auto" />
            <span className="font-bold text-lg text-foreground">SYNOVA</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <article>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            How to Use an AI Math Solver for Step-by-Step Learning
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            A math solver should not just hand you the answer. It should teach you how to think. 
            Here is how SYNOVA approaches math problem solving differently from every other math solver on the web.
          </p>

          {/* Table of Contents */}
          <nav aria-label="Table of contents" className="mb-12 p-6 rounded-xl border border-border bg-card">
            <h2 className="font-semibold text-foreground mb-3">What you will learn</h2>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li><a href="#what-is" className="hover:text-primary transition-colors">What a math solver really is</a></li>
              <li><a href="#problem-instant" className="hover:text-primary transition-colors">The problem with instant answers</a></li>
              <li><a href="#step-by-step" className="hover:text-primary transition-colors">Why step-by-step math solvers build real understanding</a></li>
              <li><a href="#how-synova" className="hover:text-primary transition-colors">How SYNOVA's AI math solver works</a></li>
              <li><a href="#topics" className="hover:text-primary transition-colors">Topics our math solver covers</a></li>
              <li><a href="#tips" className="hover:text-primary transition-colors">Tips to get the most from any math solver</a></li>
              <li><a href="#try" className="hover:text-primary transition-colors">Try SYNOVA's math solver today</a></li>
            </ol>
          </nav>

          <div className="grid gap-12">
            {/* Section 1 */}
            <section id="what-is">
              <h2 className="text-2xl font-semibold text-foreground mb-4">What a math solver really is</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                A <strong>math solver</strong> is a tool that takes a mathematical expression, equation, word problem, or diagram and returns a solution. Traditional math solvers fall into two categories: symbolic engines (like computer algebra systems) and AI-powered tutors. Symbolic engines are fast and exact, but they explain nothing. AI tutors can explain, but many still prioritize speed over pedagogy.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The best math solver is the one that acts like a patient teacher: it reads the problem, identifies the underlying concept, shows every logical step, and checks your understanding before moving on. That is exactly what SYNOVA was built to do.
              </p>
            </section>

            {/* Section 2 */}
            <section id="problem-instant">
              <h2 className="text-2xl font-semibold text-foreground mb-4">The problem with instant answers</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Most online math solvers give you a final number in under a second. It feels helpful in the moment, but it creates a dangerous habit. When a student copies the answer without walking through the reasoning, they miss the pattern recognition, formula selection, and error-checking skills that exams actually test.
              </p>
              <div className="p-6 rounded-xl border border-border bg-card mb-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  The hidden cost of instant answers
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />Surface-level memorization instead of deep understanding</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />Inability to adapt when a problem changes slightly</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />Frustration during exams when the tool is not available</li>
                  <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />Missed connections between topics (algebra to calculus, geometry to trigonometry)</li>
                </ul>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Research in educational psychology consistently shows that worked examples with self-explanation prompts outperform mere answer provision. In other words, a math solver that forces you to think is more valuable than one that removes thinking entirely.
              </p>
            </section>

            {/* Section 3 */}
            <section id="step-by-step">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Why step-by-step math solvers build real understanding</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                A step-by-step math solver breaks a complex problem into a logical sequence of smaller decisions. Each step reveals a piece of the reasoning chain: what formula to pick, why it applies, how to substitute values, and how to verify the result. This mirrors how expert mathematicians actually think.
              </p>
              <div className="grid sm:grid-cols-2 gap-6 mb-4">
                {[
                  { icon: Brain, title: "Cognitive Load Management", desc: "Working memory is limited. Breaking problems into steps prevents overload and lets the brain focus on one concept at a time." },
                  { icon: BookOpen, title: "Transferable Skills", desc: "When you see the reasoning behind a solution, you can apply the same logic to new, unseen problems." },
                  { icon: Calculator, title: "Error Detection", desc: "Step-by-step work makes it easy to spot arithmetic mistakes, sign errors, or unit mismatches early." },
                  { icon: CheckCircle, title: "Confidence Building", desc: "Each completed step is a small win. Students who understand the process feel confident even without the tool." },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="p-5 rounded-xl border border-border bg-card">
                    <Icon className="w-7 h-7 text-primary mb-2" />
                    <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground leading-relaxed">
                The key insight is that math is not a collection of answers. It is a language of patterns. A good math solver teaches you to read that language, not just translate it.
              </p>
            </section>

            {/* Section 4 */}
            <section id="how-synova">
              <h2 className="text-2xl font-semibold text-foreground mb-4">How SYNOVA's AI math solver works</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                SYNOVA is not a generic math solver. It is an AI tutor that happens to be excellent at math. When you paste a problem into SYNOVA, here is what happens behind the scenes:
              </p>
              <ol className="space-y-4 text-muted-foreground mb-6 list-decimal list-inside">
                <li><strong>Concept Identification</strong> — The AI reads the problem and classifies the underlying topic (quadratic equations, integration by parts, probability distributions, etc.).</li>
                <li><strong>Method Selection</strong> — It chooses the most appropriate solution path, often mentioning alternative methods when they exist.</li>
                <li><strong>Exhaustive Derivation</strong> — Every algebraic step is shown explicitly. No "it follows that" hand-waving. If a formula is used, it is named and justified.</li>
                <li><strong>Concept Reinforcement</strong> — The explanation connects the current problem to related topics you have studied before, building a knowledge network.</li>
                <li><strong>Self-Check Prompts</strong> — SYNOVA occasionally asks you to verify an intermediate result, ensuring you are following along.</li>
              </ol>
              <div className="p-6 rounded-xl border border-border bg-card mb-4">
                <h3 className="font-semibold text-foreground mb-2">Example: A typical SYNOVA response</h3>
                <p className="text-sm text-muted-foreground italic mb-2">
                  Student asks: Solve x² - 5x + 6 = 0
                </p>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Step 1 — Identify the form.</strong> This is a quadratic equation in standard form ax² + bx + c = 0, where a = 1, b = -5, c = 6.</p>
                  <p><strong>Step 2 — Choose a method.</strong> Since the coefficients are small integers, factoring is faster than the quadratic formula. We look for two numbers that multiply to c = 6 and add to b = -5.</p>
                  <p><strong>Step 3 — Factor.</strong> The numbers are -2 and -3 because (-2) × (-3) = 6 and (-2) + (-3) = -5. So we rewrite: (x - 2)(x - 3) = 0.</p>
                  <p><strong>Step 4 — Solve each factor.</strong> x - 2 = 0 gives x = 2. x - 3 = 0 gives x = 3.</p>
                  <p><strong>Step 5 — Verify.</strong> Plug x = 2 back in: (2)² - 5(2) + 6 = 4 - 10 + 6 = 0. Plug x = 3 back in: (3)² - 5(3) + 6 = 9 - 15 + 6 = 0. Both check.</p>
                  <p><strong>Final answer:</strong> x = 2 and x = 3.</p>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Notice what is missing: no unexplained jumps, no "magic" substitutions, no skipped arithmetic. Notice what is present: verification, justification, and a clear logical thread. That is the SYNOVA difference.
              </p>
            </section>

            {/* Section 5 */}
            <section id="topics">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Topics our math solver covers</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                SYNOVA's AI math solver handles a broad spectrum of mathematics, from school-level arithmetic to competitive exam calculus. Here is a representative list:
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                {[
                  "Arithmetic & Number Theory",
                  "Algebra (linear, quadratic, polynomial)",
                  "Coordinate Geometry",
                  "Trigonometry & Identities",
                  "Calculus (limits, derivatives, integrals)",
                  "Differential Equations",
                  "Probability & Statistics",
                  "Vectors & 3D Geometry",
                  "Matrices & Determinants",
                  "Complex Numbers",
                  "Sequences & Series",
                  "Permutations & Combinations",
                ].map((topic) => (
                  <div key={topic} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    {topic}
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Whether you are preparing for JEE, NEET, CBSE boards, state exams, or international tests like SAT and ACT, SYNOVA adapts its explanations to your syllabus and difficulty level.
              </p>
            </section>

            {/* Section 6 */}
            <section id="tips">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Tips to get the most from any math solver</h2>
              <div className="space-y-6">
                <div className="p-5 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold text-foreground mb-2">1. Write the problem in your own words first</h3>
                  <p className="text-sm text-muted-foreground">
                    Before typing anything into a math solver, paraphrase the question. If you cannot restate it, you do not fully understand what is being asked. This habit alone raises test scores.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold text-foreground mb-2">2. Predict the answer before seeing it</h3>
                  <p className="text-sm text-muted-foreground">
                    Make an educated guess about the magnitude or sign of the result. If the solver returns something wildly different, you have either found a bug in your intuition or a bug in the solver. Either way, you learn.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold text-foreground mb-2">3. Cover the solution and attempt each step yourself</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the solver's step-by-step mode as a worked example. Read the problem, hide the screen, and try to reproduce the first step. Reveal, compare, repeat. Active recall beats passive reading by a wide margin.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold text-foreground mb-2">4. Ask "why" at every step</h3>
                  <p className="text-sm text-muted-foreground">
                    A good math solver should tolerate follow-up questions. In SYNOVA, you can ask "Why did you choose that formula?" or "What if the sign were negative?" and receive a targeted explanation. If your tool cannot do that, it is a calculator, not a tutor.
                  </p>
                </div>
                <div className="p-5 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold text-foreground mb-2">5. Solve a similar problem immediately after</h3>
                  <p className="text-sm text-muted-foreground">
                    Retention decays quickly. Within 24 hours of studying a worked example, attempt a new problem that uses the same technique but different numbers. This is called spaced practice, and it is one of the most robust findings in learning science.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 7 - CTA */}
            <section id="try" className="p-8 rounded-2xl border border-border bg-card text-center">
              <h2 className="text-2xl font-semibold text-foreground mb-3">Ready to learn math the right way?</h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Stop copying answers. Start building understanding. SYNOVA's AI math solver treats every problem as a teaching moment. Sign up free and experience the difference.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">Get Started Free <ArrowRight className="w-4 h-4 ml-2" /></Link>
                </Button>
                <Button variant="outline" asChild size="lg">
                  <Link to="/tutor">Try the AI Tutor</Link>
                </Button>
              </div>
            </section>

            {/* Related links */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Related guides</h2>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/exam-prep">Exam Prep</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/homework">Homework Assistant</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/doubt-solver">Doubt Solver</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/study-planner">Study Planner</Link>
                </Button>
              </div>
            </section>
          </div>
        </article>
      </main>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        <p className="mb-2">© {new Date().getFullYear()} SYNOVA. All rights reserved.</p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
        </div>
      </footer>
    </div>
  );
};

export default AiMathSolver;
