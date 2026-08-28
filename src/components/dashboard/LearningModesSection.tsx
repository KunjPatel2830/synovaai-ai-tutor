import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Brain,
  FileText,
  ClipboardList,
  Mic,
  Globe,
  HelpCircle,
  Users,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LearningMode {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  color: string;
  iconColor: string;
}

const learningModes: LearningMode[] = [
  {
    id: "curriculum",
    title: "Curriculum Study",
    description: "NCERT-aligned lessons",
    icon: BookOpen,
    path: "/curriculum-study",
    color: "bg-accent/60 dark:bg-accent/30 border-accent dark:border-accent/50",
    iconColor: "text-accent-foreground",
  },
  {
    id: "tutor",
    title: "AI Tutor",
    description: "Personalized teaching",
    icon: Brain,
    path: "/tutor",
    color: "bg-primary/10 dark:bg-primary/10 border-primary/30 dark:border-primary/20",
    iconColor: "text-primary",
  },
  {
    id: "homework",
    title: "Homework Help",
    description: "Step-by-step solutions",
    icon: FileText,
    path: "/homework",
    color: "bg-secondary dark:bg-secondary border-border dark:border-border",
    iconColor: "text-secondary-foreground",
  },
  {
    id: "exam",
    title: "Exam Prep",
    description: "Practice & quizzes",
    icon: ClipboardList,
    path: "/exam-prep",
    color: "bg-success/10 dark:bg-success/10 border-success/30 dark:border-success/20",
    iconColor: "text-success",
  },
  {
    id: "voice",
    title: "Voice Tutor",
    description: "Speak to learn",
    icon: Mic,
    path: "/voice-tutor",
    color: "bg-warning/10 dark:bg-warning/10 border-warning/30 dark:border-warning/20",
    iconColor: "text-warning",
  },
  {
    id: "language",
    title: "Language Practice",
    description: "Master new languages",
    icon: Globe,
    path: "/language-practice",
    color: "bg-accent/40 dark:bg-accent/20 border-accent/60 dark:border-accent/30",
    iconColor: "text-accent-foreground",
  },
  {
    id: "doubt",
    title: "Doubt Solver",
    description: "Quick answers",
    icon: HelpCircle,
    path: "/doubt-solver",
    color: "bg-destructive/20 dark:bg-destructive/15 border-destructive/30 dark:border-destructive/20",
    iconColor: "text-destructive-foreground",
  },
  {
    id: "planner",
    title: "Study Planner",
    description: "Plan your schedule",
    icon: Calendar,
    path: "/study-planner",
    color: "bg-muted dark:bg-muted border-border dark:border-border",
    iconColor: "text-muted-foreground",
  },
  {
    id: "peer",
    title: "Peer Mode",
    description: "Study with friends",
    icon: Users,
    path: "/peer-mode",
    color: "bg-primary/8 dark:bg-primary/8 border-primary/20 dark:border-primary/15",
    iconColor: "text-primary",
  },
];

export function LearningModesSection() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground font-display">Learning Modes</h3>
        <span className="text-xs text-muted-foreground">{learningModes.length} modes</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {learningModes.map((mode) => {
          const Icon = mode.icon;
          return (
            <div
              key={mode.id}
              onClick={() => navigate(mode.path)}
              className={cn(
                "rounded-xl border p-4 cursor-pointer group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                mode.color
              )}
            >
              <div className={cn("h-10 w-10 rounded-lg bg-background/60 flex items-center justify-center mb-3", mode.iconColor)}>
                <Icon className="h-5 w-5" />
              </div>
              <h4 className="font-semibold text-foreground text-sm leading-tight mb-1">{mode.title}</h4>
              <p className="text-xs text-muted-foreground leading-tight">{mode.description}</p>
              <ArrowRight className="h-4 w-4 mt-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
