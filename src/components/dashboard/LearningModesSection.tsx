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
    color: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    id: "tutor",
    title: "AI Tutor",
    description: "Personalized teaching",
    icon: Brain,
    path: "/tutor",
    color: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "homework",
    title: "Homework Help",
    description: "Step-by-step solutions",
    icon: FileText,
    path: "/homework",
    color: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "exam",
    title: "Exam Prep",
    description: "Practice & quizzes",
    icon: ClipboardList,
    path: "/exam-prep",
    color: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "voice",
    title: "Voice Tutor",
    description: "Speak to learn",
    icon: Mic,
    path: "/voice-tutor",
    color: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "language",
    title: "Language Practice",
    description: "Master new languages",
    icon: Globe,
    path: "/language-practice",
    color: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
  {
    id: "doubt",
    title: "Doubt Solver",
    description: "Quick answers",
    icon: HelpCircle,
    path: "/doubt-solver",
    color: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  {
    id: "planner",
    title: "Study Planner",
    description: "Plan your schedule",
    icon: Calendar,
    path: "/study-planner",
    color: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "peer",
    title: "Peer Mode",
    description: "Study with friends",
    icon: Users,
    path: "/peer-mode",
    color: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800",
    iconColor: "text-pink-600 dark:text-pink-400",
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
