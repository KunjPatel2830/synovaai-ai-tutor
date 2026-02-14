import { lazy, Suspense, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { AnimatedSection, AnimatedCard } from "@/components/landing/AnimatedSection";
import { FloatingElements } from "@/components/landing/FloatingElements";
import synovaLogo from "@/assets/synova-logo.png";
import {
  Brain, BookOpen, GraduationCap, CheckCircle2, ArrowRight,
  Moon, Sun, Sparkles, ClipboardCheck, RefreshCw, Lightbulb,
  MessageSquare, Star, ChevronLeft, ChevronRight, User, Users,
  Twitter, Github, Linkedin, Mail, FileText, Mic, Globe,
  HelpCircle, Calendar,
} from "lucide-react";

const HeroSphere = lazy(() =>
  import("@/components/landing/HeroSphere").then((m) => ({ default: m.HeroSphere }))
);

// Sample testimonials
const testimonials = [
  {
    name: "Aarav Sharma",
    role: "Student, Class 10",
    content: "SYNOVA doesn't just give me answers — it actually makes me understand concepts step by step. My math scores improved by 30% in two months.",
    rating: 5,
  },
  {
    name: "Priya Mehta",
    role: "Parent",
    content: "As a parent, I love being able to track my daughter's progress without hovering. SYNOVA gives her independence while keeping me informed.",
    rating: 5,
  },
  {
    name: "Rajesh Kumar",
    role: "Science Teacher",
    content: "I use SYNOVA to identify which students need help and where. The teacher dashboard saves me hours of individual assessment work.",
    rating: 4,
  },
];

const features = [
  { icon: Brain, title: "AI Tutor", description: "Step-by-step explanations that adapt to your learning pace and style." },
  { icon: BookOpen, title: "Curriculum Study", description: "Follow your syllabus chapter by chapter with structured AI guidance." },
  { icon: FileText, title: "Homework Assist", description: "Guided problem solving — learn the process, not just the answer." },
  { icon: Mic, title: "Voice Tutor", description: "Speak your doubts and hear explanations — fully voice-driven learning." },
  { icon: Globe, title: "Language Practice", description: "Learn and interact in your preferred language with natural speech." },
  { icon: GraduationCap, title: "Exam Prep", description: "PYQ breakdowns, timed mock tests, and adaptive study plans." },
  { icon: HelpCircle, title: "Doubt Solver", description: "Quick Q&A for instant concept clarity when you're stuck." },
  { icon: Calendar, title: "Study Planner", description: "Schedule your study sessions with smart reminders and goals." },
  { icon: Users, title: "Peer Mode", description: "Collaborate with classmates in real-time study rooms." },
  { icon: ClipboardCheck, title: "Practice Mode", description: "Interactive questions with instant feedback to test understanding." },
];

const steps = [
  { icon: MessageSquare, title: "Ask your doubt", description: "Type or speak your question in any subject." },
  { icon: Lightbulb, title: "Get structured explanation", description: "SYNOVA breaks it down step by step for clarity." },
  { icon: Brain, title: "Build real understanding", description: "Reinforce learning with practice and revision." },
];

const Landing = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const { scrollYProgress } = useScroll();
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTryNow = () => navigate("/auth");
  const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Animated gradient background */}
      <motion.div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{ y: bgY }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-accent/[0.05]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-accent/[0.06] blur-[100px]" />
      </motion.div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass-strong border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src={synovaLogo} alt="SYNOVA" className="h-9 w-9 object-contain" />
              <span className="text-xl font-bold font-display">SYNOVA</span>
            </div>
            <div className="hidden lg:flex items-center gap-6">
              {[
                { label: "Features", id: "features" },
                { label: "How It Works", id: "how-it-works" },
                { label: "Why Synova", id: "why-synova" },
                { label: "Reviews", id: "testimonials" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full" aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              <Button onClick={handleTryNow} size="sm">
                Try Synova
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* ==================== HERO ==================== */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <FloatingElements />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              A new way of learning
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-tight mb-6">
              Understanding,{" "}
              <span className="text-primary">Not Just Answers.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mb-8">
              SYNOVA is an AI-powered learning ecosystem designed for students of all abilities — 
              structured teaching, not instant answers.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Button size="lg" onClick={handleTryNow} className="px-8 py-6 text-lg group">
                Try Synova Now
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollToSection("features")} className="px-8 py-6 text-lg">
                Explore Features
              </Button>
            </div>
          </motion.div>

          {/* Right — 3D Sphere */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <Suspense
              fallback={
                <div className="w-full h-[400px] flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-primary/10 animate-pulse" />
                </div>
              }
            >
              <HeroSphere />
            </Suspense>
          </motion.div>
        </div>
      </section>

      {/* ==================== FEATURES ==================== */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
              How Synova Helps You <span className="text-primary">Learn</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Ten specialized learning modes designed to build real understanding.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {features.map((feature, idx) => (
              <AnimatedCard key={feature.title} delay={idx * 0.05}>
                <div className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300 h-full text-center">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3 mx-auto group-hover:scale-110 transition-transform">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1 font-display">{feature.title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{feature.description}</p>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
              How It <span className="text-primary">Works</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Three simple steps to real understanding.</p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <AnimatedCard key={step.title} delay={idx * 0.15}>
                <div className="text-center">
                  <motion.div
                    className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-5"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <step.icon className="w-7 h-7" />
                  </motion.div>
                  <div className="text-xs font-bold text-primary mb-2">Step {idx + 1}</div>
                  <h3 className="font-semibold text-lg mb-2 font-display">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== WHY SYNOVA ==================== */}
      <section id="why-synova" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
              Why <span className="text-primary">Synova</span>?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              General AI tools answer questions. <strong className="text-foreground">Synova teaches.</strong>
            </p>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
              <div className="grid sm:grid-cols-2 gap-10">
                {/* Typical AI */}
                <div>
                  <h3 className="font-semibold text-lg mb-5 text-muted-foreground">Typical AI</h3>
                  <ul className="space-y-4">
                    {["Instant answers", "No structure", "Easy copying", "No progress tracking", "One-size-fits-all"].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                        <span className="text-muted-foreground text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Synova */}
                <div>
                  <h3 className="font-semibold text-lg mb-5 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> Synova
                  </h3>
                  <ul className="space-y-4">
                    {["Step-by-step teaching", "Concept clarity", "Responsible AI", "Progress & memory", "Adaptive to every learner"].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                        <span className="text-foreground text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ==================== TESTIMONIALS ==================== */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
              What Our Users <span className="text-primary">Say</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Hear from students, parents, and teachers who use SYNOVA.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="relative">
              {/* Carousel card */}
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.4 }}
                className="max-w-lg mx-auto"
              >
                <div className="p-8 rounded-2xl border border-border bg-card">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${i < testimonials[currentTestimonial].rating ? "text-warning fill-warning" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <p className="text-foreground leading-relaxed mb-6">
                    "{testimonials[currentTestimonial].content}"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{testimonials[currentTestimonial].name}</p>
                      <p className="text-xs text-muted-foreground">{testimonials[currentTestimonial].role}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="flex gap-2">
                  {testimonials.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentTestimonial(idx)}
                      className={`h-2 rounded-full transition-all ${idx === currentTestimonial ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)}
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Link to full reviews */}
              <div className="text-center mt-6">
                <Button variant="outline" size="sm" onClick={() => navigate("/reviews")}>
                  See All Reviews
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ==================== CTA ==================== */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <AnimatedSection className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display mb-6">
            Ready to Learn the <span className="text-primary">Right Way</span>?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of students building real understanding with SYNOVA.
          </p>
          <Button size="xl" onClick={handleTryNow} className="group">
            Start Learning Now
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </AnimatedSection>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={synovaLogo} alt="SYNOVA" className="h-8 w-8 object-contain" />
                <span className="text-lg font-bold font-display">SYNOVA</span>
              </div>
              <p className="text-sm text-muted-foreground">Understanding, not just answers.</p>
            </div>
            {/* Links */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <ul className="space-y-2">
                {[
                  { label: "Features", action: () => scrollToSection("features") },
                  { label: "How It Works", action: () => scrollToSection("how-it-works") },
                  { label: "Reviews", action: () => navigate("/reviews") },
                ].map((link) => (
                  <li key={link.label}>
                    <button onClick={link.action} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Company</h4>
              <ul className="space-y-2">
                {["About", "Privacy Policy", "Contact"].map((label) => (
                  <li key={label}>
                    <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {/* Social */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Connect</h4>
              <div className="flex gap-3">
                {[Twitter, Github, Linkedin, Mail].map((Icon, i) => (
                  <button key={i} className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-border/50 text-center">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} SYNOVA. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
