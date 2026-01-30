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
    <div className="space-y-6">
      {/* Primary Learning Modes */}
      <div>
        <h3 className="text-lg font-semibold text-foreground font-display mb-4">Learning Modes</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {learningModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <GlassCard
                key={mode.id}
                className="cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg overflow-hidden"
                onClick={() => navigate(mode.path)}
              >
                <div className="p-5">
                  {/* Icon */}
                  <div className={cn(
                    "h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-md transition-transform group-hover:scale-110",
                    mode.gradient
                  )}>
                    <Icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  
                  {/* Title */}
                  <h4 className="font-semibold text-foreground text-sm mb-1">{mode.title}</h4>
                  
                  {/* Description */}
                  <p className="text-xs text-muted-foreground">{mode.description}</p>
                  
                  {/* Arrow indicator */}
                  <ArrowRight className="h-4 w-4 text-muted-foreground mt-3 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Additional Modes */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">More Ways to Learn</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {additionalModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <GlassCard
                key={mode.id}
                variant="subtle"
                className="cursor-pointer group transition-all duration-300 hover:scale-[1.01]"
                onClick={() => navigate(mode.path)}
              >
                <div className="p-4 flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0",
                    mode.gradient
                  )}>
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-foreground text-sm truncate">{mode.title}</h4>
                    <p className="text-xs text-muted-foreground truncate">{mode.description}</p>
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
