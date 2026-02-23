import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { useToast } from "@/hooks/use-toast";
import { AnimatedSection, AnimatedCard } from "@/components/landing/AnimatedSection";
import { FloatingElements } from "@/components/landing/FloatingElements";
import synovaLogo from "@/assets/synova-logo.png";
import {
  Brain, BookOpen, GraduationCap, CheckCircle2, ArrowRight,
  Moon, Sun, Sparkles, ClipboardCheck, RefreshCw, Lightbulb,
  MessageSquare, Star, User, Users, LogIn, PenLine,
  Twitter, Github, Linkedin, Mail, FileText, Mic, Globe,
  HelpCircle, Calendar,
} from "lucide-react";


// Fallback testimonials (shown while DB reviews load)
const fallbackTestimonials = [
  { display_name: "Aarav Sharma", content: "SYNOVA doesn't just give me answers — it actually makes me understand concepts step by step. My math scores improved by 30% in two months.", rating: 5 },
  { display_name: "Priya Mehta", content: "As a parent, I love being able to track my daughter's progress without hovering. SYNOVA gives her independence while keeping me informed.", rating: 5 },
  { display_name: "Rajesh Kumar", content: "I use SYNOVA to identify which students need help and where. The teacher dashboard saves me hours of individual assessment work.", rating: 4 },
];

interface ReviewData {
  id?: string;
  display_name: string;
  content: string;
  rating: number;
  created_at?: string;
}
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
  const { user } = useAuth();
  const { toast } = useToast();
  const { scrollYProgress } = useScroll();
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  const [reviews, setReviews] = useState<ReviewData[]>(fallbackTestimonials);
  const [newReview, setNewReview] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      const { data } = await externalSupabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (data && data.length > 0) setReviews(data);
    };
    fetchReviews();
  }, []);

  const handleSubmitReview = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!newReview.trim()) { toast({ title: "Please write a review", variant: "destructive" }); return; }
    setIsSubmitting(true);
    const { data: profile } = await externalSupabase
      .from("profiles").select("display_name").eq("user_id", user.id).single();
    const displayName = profile?.display_name || user.email?.split("@")[0] || "Anonymous";
    const { error } = await externalSupabase.from("reviews").insert({
      user_id: user.id, display_name: displayName, content: newReview.trim(), rating: newRating,
    });
    if (error) { toast({ title: "Failed to submit review", variant: "destructive" }); }
    else {
      toast({ title: "Review submitted! Thank you." });
      setNewReview(""); setNewRating(5); setShowReviewForm(false);
      const { data } = await externalSupabase.from("reviews").select("*").order("created_at", { ascending: false });
      if (data && data.length > 0) setReviews(data);
    }
    setIsSubmitting(false);
  };

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
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
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
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              SYNOVA is an AI-powered learning ecosystem designed for students of all abilities — 
              structured teaching, not instant answers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={handleTryNow} className="px-8 py-6 text-lg group">
                Try Synova Now
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollToSection("features")} className="px-8 py-6 text-lg">
                Explore Features
              </Button>
            </div>
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
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
              What Our Users <span className="text-primary">Say</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">
              Hear from students, parents, and teachers who use SYNOVA.
            </p>
            {/* Write Review button */}
            {!showReviewForm && (
              <Button onClick={() => user ? setShowReviewForm(true) : navigate("/auth")} className="gap-2">
                <PenLine className="w-4 h-4" />
                {user ? "Write a Review" : "Sign in to Review"}
              </Button>
            )}
          </AnimatedSection>

          {/* Inline Review Form */}
          {showReviewForm && (
            <AnimatedSection className="max-w-md mx-auto mb-10">
              <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
                <h3 className="font-semibold text-foreground text-center">Share Your Experience</h3>
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Rating</label>
                  <div className="flex gap-1 justify-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => setNewRating(star)} className="p-0.5 hover:scale-110 transition-transform">
                        <Star className={`w-6 h-6 ${star <= newRating ? "text-warning fill-warning" : "text-muted-foreground/30"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Your Review</label>
                  <Textarea value={newReview} onChange={(e) => setNewReview(e.target.value)} placeholder="Share your experience with SYNOVA..." rows={3} maxLength={500} className="text-sm" />
                  <p className="text-xs text-muted-foreground mt-1 text-right">{newReview.length}/500</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={handleSubmitReview} disabled={isSubmitting} size="sm">
                    {isSubmitting ? "Submitting..." : "Submit Review"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowReviewForm(false)}>Cancel</Button>
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Marquee Reviews */}
          <div className="relative overflow-hidden">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            
            <motion.div
              className="flex gap-5 w-max"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: reviews.length * 6, ease: "linear", repeat: Infinity }}
            >
              {[...reviews, ...reviews].map((review, idx) => (
                <div
                  key={`${review.id || idx}-${idx}`}
                  className="w-[320px] shrink-0 p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all duration-300 flex flex-col"
                >
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < review.rating ? "text-warning fill-warning" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <p className="text-foreground text-sm leading-relaxed mb-4 flex-1">"{review.content}"</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{review.display_name}</p>
                      {review.created_at && (
                        <p className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <img src={synovaLogo} alt="SYNOVA" className="h-8 w-8 object-contain" />
                <span className="text-lg font-bold font-display">SYNOVA</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Understanding, not just answers. AI-powered learning for every student.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-semibold text-sm mb-4 text-foreground">Product</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Features", action: () => scrollToSection("features") },
                  { label: "How It Works", action: () => scrollToSection("how-it-works") },
                  { label: "Why Synova", action: () => scrollToSection("why-synova") },
                  { label: "Reviews", action: () => scrollToSection("testimonials") },
                ].map((link) => (
                  <li key={link.label}>
                    <button onClick={link.action} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="font-semibold text-sm mb-4 text-foreground">Company</h4>
              <ul className="space-y-2.5">
                {["About", "Privacy Policy", "Terms of Service", "Contact"].map((label) => (
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
              <h4 className="font-semibold text-sm mb-4 text-foreground">Connect</h4>
              <div className="flex gap-4">
                {[
                  { label: "Instagram", svg: <svg xmlns="http://www.w3.org/2000/svg" fill="none" width="20px" viewBox="0 0 24 24"><path fill="currentColor" d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" clipRule="evenodd" fillRule="evenodd" /><path fill="currentColor" d="M18 5C17.4477 5 17 5.44772 17 6C17 6.55228 17.4477 7 18 7C18.5523 7 19 6.55228 19 6C19 5.44772 18.5523 5 18 5Z" /><path fill="currentColor" d="M1.65396 4.27606C1 5.55953 1 7.23969 1 10.6V13.4C1 16.7603 1 18.4405 1.65396 19.7239C2.2292 20.8529 3.14708 21.7708 4.27606 22.346C5.55953 23 7.23969 23 10.6 23H13.4C16.7603 23 18.4405 23 19.7239 22.346C20.8529 21.7708 21.7708 20.8529 22.346 19.7239C23 18.4405 23 16.7603 23 13.4V10.6C23 7.23969 23 5.55953 22.346 4.27606C21.7708 3.14708 20.8529 2.2292 19.7239 1.65396C18.4405 1 16.7603 1 13.4 1H10.6C7.23969 1 5.55953 1 4.27606 1.65396C3.14708 2.2292 2.2292 3.14708 1.65396 4.27606ZM13.4 3H10.6C8.88684 3 7.72225 3.00156 6.82208 3.0751C5.94524 3.14674 5.49684 3.27659 5.18404 3.43597C4.43139 3.81947 3.81947 4.43139 3.43597 5.18404C3.27659 5.49684 3.14674 5.94524 3.0751 6.82208C3.00156 7.72225 3 8.88684 3 10.6V13.4C3 15.1132 3.00156 16.2777 3.0751 17.1779C3.14674 18.0548 3.27659 18.5032 3.43597 18.816C3.81947 19.5686 4.43139 20.1805 5.18404 20.564C5.49684 20.7234 5.94524 20.8533 6.82208 20.9249C7.72225 20.9984 8.88684 21 10.6 21H13.4C15.1132 21 16.2777 20.9984 17.1779 20.9249C18.0548 20.8533 18.5032 20.7234 18.816 20.564C19.5686 20.1805 20.1805 19.5686 20.564 18.816C20.7234 18.5032 20.8533 18.0548 20.9249 17.1779C20.9984 16.2777 21 15.1132 21 13.4V10.6C21 8.88684 20.9984 7.72225 20.9249 6.82208C20.8533 5.94524 20.7234 5.49684 20.564 5.18404C20.1805 4.43139 19.5686 3.81947 18.816 3.43597C18.5032 3.27659 18.0548 3.14674 17.1779 3.0751C16.2777 3.00156 15.1132 3 13.4 3Z" clipRule="evenodd" fillRule="evenodd" /></svg> },
                  { label: "Twitter", svg: <svg viewBox="0 -2 20 20" width="20px" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M6.29,13 C13.837,13 17.965,6.84365 17.965,1.50546 C17.965,1.33021 17.965,1.15595 17.953,0.98267 C18.756,0.41163 19.449,-0.29724 20,-1.1085 C19.252,-0.78163 18.457,-0.567 17.644,-0.47249 C18.5,-0.97756 19.141,-1.7711 19.448,-2.7074 C18.642,-2.23679 17.761,-1.905 16.842,-1.72679 C15.288,-3.35326 12.689,-3.43202 11.036,-1.90204 C9.971,-0.91553 9.518,0.55538 9.849,1.95835 C6.55,1.79492 3.476,0.261 1.392,-2.26238 C0.303,-0.41637 0.86,1.94457 2.663,3.12996 C2.01,3.11125 1.371,2.93797 0.8,2.62489 L0.8,2.67608 C0.801,4.5989 2.178,6.2549 4.092,6.63591 C3.488,6.79836 2.854,6.82199 2.24,6.70483 C2.777,8.35099 4.318,9.47829 6.073,9.51078 C4.62,10.63513 2.825,11.24554 0.977,11.24358 C0.651,11.24259 0.325,11.22388 0,11.18549 C1.877,12.37088 4.06,13 6.29,12.99705" /></svg> },
                  { label: "LinkedIn", svg: <svg xmlns="http://www.w3.org/2000/svg" width="20px" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg> },
                  { label: "YouTube", svg: <svg viewBox="0 -3 20 20" width="20px" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M7.988432,9.58588 L7.988432,3.97425 C9.980638,4.91168 11.523602,5.8172 13.348463,6.79353 C11.843351,7.62824 9.980638,8.56468 7.988432,9.58588 M19.090998,1.18289 C18.747343,0.73013 18.161634,0.37809 17.538073,0.26141 C15.705243,-0.08664 4.270974,-0.08763 2.439141,0.26141 C1.939097,0.35515 1.493839,0.58153 1.111335,0.93357 C-0.50036,2.42947 0.004664,10.45151 0.393145,11.75096 C0.556505,12.31342 0.767679,12.71931 1.033639,12.98558 C1.376298,13.33761 1.845463,13.57995 2.384355,13.68865 C3.893451,14.0008 11.668037,14.17532 17.506198,13.73552 C18.044094,13.64178 18.520231,13.39147 18.895762,13.02447 C20.385932,11.53455 20.28433,3.06174 19.090998,1.18289" /></svg> },
                ].map(({ label, svg }) => (
                  <button
                    key={label}
                    aria-label={label}
                    className="w-10 h-10 rounded-full bg-foreground/90 text-background border-2 border-foreground/90 flex items-center justify-center transition-all duration-500 hover:rotate-[360deg] hover:bg-background hover:text-foreground"
                  >
                    {svg}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">hello@synova.ai</p>
            </div>
          </div>

          <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} SYNOVA. All rights reserved.
            </p>
            <div className="flex gap-4">
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</button>
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
