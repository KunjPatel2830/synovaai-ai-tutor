import { useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Brain, 
  FileText, 
  ClipboardList, 
  Mic,
  Globe,
  HelpCircle,
  Users,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LearningMode {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  gradient: string;
}

const learningModes: LearningMode[] = [
  {
    id: "curriculum",
    title: "Curriculum Study",
    description: "NCERT-aligned lessons",
    icon: BookOpen,
    path: "/curriculum-study",
    gradient: "from-primary to-primary/80",
  },
  {
    id: "tutor",
    title: "AI Tutor",
    description: "Personalized teaching",
    icon: Brain,
    path: "/tutor",
    gradient: "from-accent to-accent/80",
  },
  {
    id: "homework",
    title: "Homework Help",
    description: "Step-by-step solutions",
    icon: FileText,
    path: "/homework",
    gradient: "from-secondary to-secondary/80",
  },
  {
    id: "exam",
    title: "Exam Prep",
    description: "Practice & quizzes",
    icon: ClipboardList,
    path: "/exam-prep",
    gradient: "from-success to-success/80",
  },
];

const additionalModes: LearningMode[] = [
  {
    id: "voice",
    title: "Voice Tutor",
    description: "Speak to learn",
    icon: Mic,
    path: "/voice-tutor",
    gradient: "from-warning to-warning/80",
  },
  {
    id: "language",
    title: "Language Practice",
    description: "Master new languages",
    icon: Globe,
    path: "/language-practice",
    gradient: "from-destructive/70 to-destructive/50",
  },
  {
    id: "doubt",
    title: "Doubt Solver",
    description: "Quick answers",
    icon: HelpCircle,
    path: "/doubt-solver",
    gradient: "from-muted-foreground/50 to-muted-foreground/30",
  },
  {
    id: "peer",
    title: "Peer Mode",
    description: "Study with friends",
    icon: Users,
    path: "/peer-mode",
    gradient: "from-primary/70 to-accent/70",
  },
];

export function LearningModesSection() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Primary Learning Modes */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground font-display">Learning Modes</h3>
            <p className="text-sm text-muted-foreground">Choose how you want to learn today</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {learningModes.map((mode, index) => {
            const Icon = mode.icon;
            return (
              <GlassCard
                key={mode.id}
                variant="elevated"
                className="cursor-pointer group transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl overflow-hidden relative"
                onClick={() => navigate(mode.path)}
              >
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 group-hover:from-primary/5 group-hover:to-accent/10 transition-all duration-500" />
                
                <div className="p-6 relative">
                  {/* Icon with enhanced styling */}
                  <div className={cn(
                    "h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-5 shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl group-hover:rotate-3",
                    mode.gradient
                  )}>
                    <Icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  
                  {/* Title */}
                  <h4 className="font-bold text-foreground text-base mb-2 group-hover:text-primary transition-colors">{mode.title}</h4>
                  
                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">{mode.description}</p>
                  
                  {/* Arrow indicator */}
                  <div className="mt-4 flex items-center text-muted-foreground group-hover:text-primary transition-all">
                    <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Start now</span>
                    <ArrowRight className="h-5 w-5 ml-auto transition-transform group-hover:translate-x-2" />
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Additional Modes with compact cards */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          More Ways to Learn
          <span className="h-px flex-1 bg-border" />
        </h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {additionalModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <GlassCard
                key={mode.id}
                variant="subtle"
                className="cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                onClick={() => navigate(mode.path)}
              >
                <div className="p-4 flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md transition-transform group-hover:scale-110 group-hover:rotate-3",
                    mode.gradient
                  )}>
                    <Icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">{mode.title}</h4>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{mode.description}</p>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
