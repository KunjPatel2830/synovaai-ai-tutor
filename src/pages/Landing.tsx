import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import synovaLogo from "@/assets/synova-logo.png";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { 
  Brain, 
  BookOpen, 
  GraduationCap, 
  Users, 
  CheckCircle2, 
  ArrowRight,
  Moon,
  Sun,
  Sparkles,
  Target,
  BarChart3,
  Accessibility,
  Mic,
  Volume2,
  Globe,
  MessageSquare,
  Calendar,
  HelpCircle,
} from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false);

  const handleTryNow = () => {
    navigate("/auth");
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const languages = [
    { code: "en", name: "English" },
    { code: "hi", name: "हिंदी (Hindi)" },
    { code: "es", name: "Español (Spanish)" },
    { code: "fr", name: "Français (French)" },
    { code: "de", name: "Deutsch (German)" },
    { code: "zh", name: "中文 (Chinese)" },
    { code: "ar", name: "العربية (Arabic)" },
    { code: "pt", name: "Português (Portuguese)" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Banner */}
      <div className="bg-primary text-primary-foreground py-2 text-center text-sm font-medium">
        <span className="font-display font-bold">SYNOVA</span> — Education for Every Mind
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass-strong border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src={synovaLogo} alt="SYNOVA" className="h-10 w-10 object-contain" />
              <span className="text-xl font-bold font-display">SYNOVA</span>
            </div>
            <div className="hidden lg:flex items-center gap-4">
              <button 
                onClick={handleTryNow}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Try Now
              </button>
              <button 
                onClick={() => scrollToSection("what-is")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                What It Is
              </button>
              <button 
                onClick={() => scrollToSection("what-it-does")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                What It Does
              </button>
              <button 
                onClick={() => scrollToSection("features")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection("accessibility")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Accessibility
              </button>
              <button 
                onClick={() => scrollToSection("voice-demo")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Language & Voice
              </button>
              <button 
                onClick={() => scrollToSection("reviews")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Reviews
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={toggleTheme}
                className="rounded-full"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              <Button onClick={handleTryNow} size="sm">
                Try SYNOVA
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            AI-Powered Learning Ecosystem
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-tight mb-6">
            Education for{" "}
            <span className="text-primary">Every Mind</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-4xl mx-auto mb-10">
            SYNOVA is an AI-powered learning ecosystem designed for students of all abilities — 
            including normal learners, students with learning challenges, and blind/low-vision users.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              onClick={handleTryNow}
              className="px-8 py-6 text-lg"
            >
              Try SYNOVA Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => scrollToSection("what-it-does")}
              className="px-8 py-6 text-lg"
            >
              See What It Does
            </Button>
          </div>
        </div>
      </section>

      {/* What is SYNOVA Section */}
      <section id="what-is" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-8">
            What is <span className="text-primary">SYNOVA</span>?
          </h2>
          <div className="glass rounded-2xl p-8 sm:p-10 border border-border/50">
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              SYNOVA is not just a chatbot — it's a structured AI learning system designed to teach, guide, 
              and support students using adaptive explanations, accessibility-first design, and progress-aware learning.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Our vision is to make quality education accessible to everyone, regardless of learning style, 
              ability, or language. We believe every student deserves personalized attention that adapts to their unique needs.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                <span className="text-foreground">Adapts teaching style to each student's learning pace and preferences</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                <span className="text-foreground">Built with accessibility as a core feature, not an afterthought</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                <span className="text-foreground">Supports multilingual voice interaction for inclusive learning</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                <span className="text-foreground">Tracks progress and identifies learning gaps automatically</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* What It Does Section */}
      <section id="what-it-does" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
            What Does SYNOVA <span className="text-primary">Do</span>?
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            A complete learning ecosystem with powerful capabilities for every learner.
          </p>
          <div className="glass rounded-2xl p-8 sm:p-10 border border-border/50">
            <ul className="space-y-6">
              <CapabilityItem 
                icon={<Brain className="w-5 h-5" />}
                title="AI Tutor"
                description="Explains concepts step-by-step with adaptive difficulty levels"
              />
              <CapabilityItem 
                icon={<BookOpen className="w-5 h-5" />}
                title="Homework Assistance with Step-by-Step Feedback"
                description="Guides students through problems without giving away answers"
              />
              <CapabilityItem 
                icon={<Globe className="w-5 h-5" />}
                title="Multilingual Voice Interaction"
                description="Learn and interact in your preferred language with natural speech"
              />
              <CapabilityItem 
                icon={<Accessibility className="w-5 h-5" />}
                title="Accessibility & Blind Support"
                description="Voice-first design with screen reader support and high contrast modes"
              />
              <CapabilityItem 
                icon={<Users className="w-5 h-5" />}
                title="Teacher & Caregiver Dashboards"
                description="Track student progress, identify weak areas, and provide targeted support"
              />
              <CapabilityItem 
                icon={<GraduationCap className="w-5 h-5" />}
                title="Exam Preparation"
                description="Timed mock tests, adaptive quizzes, and personalized study plans"
              />
            </ul>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
            Learning <span className="text-primary">Modes</span>
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Nine specialized modes designed for different learning needs.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModeCard 
              icon={<Brain className="w-5 h-5" />}
              title="AI Tutor"
              description="Learn concepts step-by-step"
            />
            <ModeCard 
              icon={<BookOpen className="w-5 h-5" />}
              title="Homework Help"
              description="Guided problem solving"
            />
            <ModeCard 
              icon={<Mic className="w-5 h-5" />}
              title="Voice Tutor"
              description="Voice-first interaction"
            />
            <ModeCard 
              icon={<Globe className="w-5 h-5" />}
              title="Language Practice"
              description="Multilingual learning"
            />
            <ModeCard 
              icon={<BarChart3 className="w-5 h-5" />}
              title="Teacher Dashboard"
              description="Track class progress"
            />
            <ModeCard 
              icon={<Users className="w-5 h-5" />}
              title="Caregiver View"
              description="Monitor child's learning"
            />
            <ModeCard 
              icon={<GraduationCap className="w-5 h-5" />}
              title="Exam Prep"
              description="Timed tests & quizzes"
            />
            <ModeCard 
              icon={<HelpCircle className="w-5 h-5" />}
              title="Doubt Solver"
              description="Quick Q&A"
            />
            <ModeCard 
              icon={<Calendar className="w-5 h-5" />}
              title="Study Planner"
              description="Schedule & reminders"
            />
          </div>
        </div>
      </section>

      {/* Accessibility Section */}
      <section id="accessibility" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
            <span className="text-primary">Accessibility</span> First
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            SYNOVA is built from the ground up to support learners of all abilities.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <AccessibilityCard 
              icon={<Volume2 className="w-8 h-8" />}
              title="Blind & Low Vision"
              description="Full voice navigation, screen reader support, and audio descriptions for all content"
              color="primary"
            />
            <AccessibilityCard 
              icon={<MessageSquare className="w-8 h-8" />}
              title="Dyslexia Support"
              description="Readable fonts, adjustable text size, and audio alternatives for text content"
              color="secondary"
            />
            <AccessibilityCard 
              icon={<Mic className="w-8 h-8" />}
              title="Voice Commands"
              description="Navigate and interact entirely through voice — no keyboard or mouse required"
              color="accent"
            />
            <AccessibilityCard 
              icon={<Volume2 className="w-8 h-8" />}
              title="Subtitles & Captions"
              description="All spoken content is displayed as subtitles for hearing-impaired users"
              color="success"
            />
          </div>
        </div>
      </section>

      {/* Language & Voice Demo Section */}
      <section id="voice-demo" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
            Language & <span className="text-primary">Voice Demo</span>
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Experience SYNOVA's multilingual voice capabilities. Configure your preferences below.
          </p>
          <div className="glass rounded-2xl p-8 sm:p-10 border border-border/50">
            <div className="grid sm:grid-cols-2 gap-8">
              {/* Language Selection */}
              <div className="space-y-4">
                <Label htmlFor="language-select" className="text-lg font-medium flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Select Language
                </Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger id="language-select" className="w-full">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Core content in English. Additional languages for voice output.
                </p>
              </div>

              {/* Voice Settings */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mic className="w-5 h-5 text-primary" />
                    <div>
                      <Label htmlFor="voice-input" className="text-base font-medium">Voice Input</Label>
                      <p className="text-sm text-muted-foreground">Enable microphone capture</p>
                    </div>
                  </div>
                  <Switch 
                    id="voice-input"
                    checked={voiceInputEnabled}
                    onCheckedChange={setVoiceInputEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-5 h-5 text-primary" />
                    <div>
                      <Label htmlFor="auto-speak" className="text-base font-medium">Auto-Speak</Label>
                      <p className="text-sm text-muted-foreground">Read responses automatically</p>
                    </div>
                  </div>
                  <Switch 
                    id="auto-speak"
                    checked={autoSpeakEnabled}
                    onCheckedChange={setAutoSpeakEnabled}
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-border/50 text-center">
              <Button onClick={handleTryNow} size="lg">
                Try Voice Features
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Who Is SYNOVA For Section */}
      <section id="who-for" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-12">
            Who Is SYNOVA <span className="text-primary">For</span>?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <AudienceCard 
              icon={<GraduationCap className="w-8 h-8" />}
              title="Students"
              description="Learn at your own pace without pressure."
              color="primary"
            />
            <AudienceCard 
              icon={<Mic className="w-8 h-8" />}
              title="Visually Impaired Learners"
              description="Study independently using voice-first interaction."
              color="secondary"
            />
            <AudienceCard 
              icon={<Users className="w-8 h-8" />}
              title="Parents & Caregivers"
              description="Track progress without micromanaging."
              color="accent"
            />
            <AudienceCard 
              icon={<Target className="w-8 h-8" />}
              title="Teachers"
              description="Identify learning gaps and support students better."
              color="success"
            />
          </div>
        </div>
      </section>

      {/* Why Different Section */}
      <section id="why-different" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
            Why Not Just Use <span className="text-primary">ChatGPT</span>?
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-12">
            General AI tools answer questions. <strong className="text-foreground">SYNOVA teaches.</strong>
          </p>
          <div className="glass rounded-2xl p-8 border border-border/50">
            <div className="grid sm:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  SYNOVA
                </h3>
                <ul className="space-y-3">
                  <ComparisonItem positive>Structured learning paths</ComparisonItem>
                  <ComparisonItem positive>Accessibility-first design</ComparisonItem>
                  <ComparisonItem positive>Progress tracking & memory</ComparisonItem>
                  <ComparisonItem positive>Designed for education</ComparisonItem>
                  <ComparisonItem positive>Voice-first for blind users</ComparisonItem>
                  <ComparisonItem positive>Multilingual support</ComparisonItem>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-4 text-muted-foreground">
                  General AI Tools
                </h3>
                <ul className="space-y-3">
                  <ComparisonItem>Random answers</ComparisonItem>
                  <ComparisonItem>Optional accessibility</ComparisonItem>
                  <ComparisonItem>No memory of progress</ComparisonItem>
                  <ComparisonItem>General purpose</ComparisonItem>
                  <ComparisonItem>Text-first interaction</ComparisonItem>
                  <ComparisonItem>Limited language support</ComparisonItem>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <ReviewsSection />

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-6">
            Start Learning the <span className="text-primary">Right Way</span>
          </h2>
          <p className="text-muted-foreground mb-8">
            Sign up to experience adaptive learning designed for every mind.
          </p>
          <Button 
            size="lg" 
            onClick={handleTryNow}
            className="px-10 py-6 text-lg"
          >
            Try SYNOVA Now
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border/50 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src={synovaLogo} alt="SYNOVA" className="h-10 w-10 object-contain" />
              <span className="text-xl font-bold font-display">SYNOVA</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Education for every mind.
            </p>
            <div className="flex items-center gap-6">
              <button 
                onClick={handleTryNow}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Try Now
              </button>
              <button 
                onClick={() => scrollToSection("what-is")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                About
              </button>
              <button 
                onClick={() => scrollToSection("accessibility")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Accessibility
              </button>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border/50 text-center">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} SYNOVA. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Capability Item Component
const CapabilityItem = ({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) => (
  <li className="flex items-start gap-4">
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
      {icon}
    </div>
    <div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  </li>
);

// Mode Card Component
const ModeCard = ({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) => (
  <div className="glass rounded-xl p-4 border border-border/50 hover:border-primary/30 transition-all duration-300 group text-center">
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3 mx-auto group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="font-semibold text-sm mb-1">{title}</h3>
    <p className="text-muted-foreground text-xs">{description}</p>
  </div>
);

// Accessibility Card Component
const AccessibilityCard = ({ 
  icon, 
  title, 
  description,
  color
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  color: "primary" | "secondary" | "accent" | "success";
}) => {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary-foreground",
    accent: "bg-accent/10 text-accent-foreground",
    success: "bg-success/10 text-success"
  };

  return (
    <div className="glass rounded-xl p-6 border border-border/50 hover:border-primary/30 transition-all duration-300">
      <div className={`w-14 h-14 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
};

// Audience Card Component
const AudienceCard = ({ 
  icon, 
  title, 
  description,
  color
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  color: "primary" | "secondary" | "accent" | "success";
}) => {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary-foreground",
    accent: "bg-accent/10 text-accent-foreground",
    success: "bg-success/10 text-success"
  };

  return (
    <div className="glass rounded-xl p-6 border border-border/50 text-center hover:border-primary/30 transition-all duration-300">
      <div className={`w-16 h-16 rounded-full ${colorClasses[color]} flex items-center justify-center mx-auto mb-4`}>
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
};

// Comparison Item Component
const ComparisonItem = ({ 
  children, 
  positive = false 
}: { 
  children: React.ReactNode; 
  positive?: boolean;
}) => (
  <li className="flex items-center gap-2">
    {positive ? (
      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
    ) : (
      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
    )}
    <span className={positive ? "text-foreground" : "text-muted-foreground"}>
      {children}
    </span>
  </li>
);

export default Landing;
