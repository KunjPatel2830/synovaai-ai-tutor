import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  BookOpen, 
  Star, 
  CheckCircle2,
  Clock,
  Brain,
  Mic
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Quest {
  id: string;
  title: string;
  icon: React.ElementType;
  xpReward: number;
  progress: number;
  target: number;
  completed: boolean;
  path: string;
}

export function DailyQuestSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quests, setQuests] = useState<Quest[]>([
    {
      id: "sessions",
      title: "Complete 2 learning sessions",
      icon: BookOpen,
      xpReward: 50,
      progress: 0,
      target: 2,
      completed: false,
      path: "/curriculum-study",
    },
    {
      id: "tutor",
      title: "Ask AI Tutor a question",
      icon: Brain,
      xpReward: 25,
      progress: 0,
      target: 1,
      completed: false,
      path: "/tutor",
    },
    {
      id: "voice",
      title: "Practice with Voice Tutor",
      icon: Mic,
      xpReward: 30,
      progress: 0,
      target: 1,
      completed: false,
      path: "/voice-tutor",
    },
  ]);

  useEffect(() => {
    if (user) {
      fetchQuestProgress();
    }
  }, [user]);

  const fetchQuestProgress = async () => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch today's sessions
    const { data: sessions } = await externalSupabase
      .from("chat_sessions")
      .select("id, mode")
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());

    if (sessions) {
      const sessionCount = sessions.length;
      const hasTutorSession = sessions.some(s => s.mode === "tutor" || s.mode === "doubt");
      const hasVoiceSession = sessions.some(s => s.mode === "voice");

      setQuests(prev => prev.map(quest => {
        if (quest.id === "sessions") {
          const progress = Math.min(sessionCount, quest.target);
          return { ...quest, progress, completed: progress >= quest.target };
        }
        if (quest.id === "tutor") {
          return { ...quest, progress: hasTutorSession ? 1 : 0, completed: hasTutorSession };
        }
        if (quest.id === "voice") {
          return { ...quest, progress: hasVoiceSession ? 1 : 0, completed: hasVoiceSession };
        }
        return quest;
      }));
    }
  };

  const handleQuestClick = (quest: Quest) => {
    if (!quest.completed) {
      navigate(quest.path);
    }
  };

  const completedCount = quests.filter(q => q.completed).length;

  return (
    <GlassCard variant="elevated" className="p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-warning/10 to-transparent rounded-full blur-2xl" />
      
      <div className="flex items-center justify-between mb-5 relative">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-warning to-warning/80 flex items-center justify-center shadow-lg">
            <Target className="h-5 w-5 text-warning-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground font-display">Daily Goals</h3>
            <p className="text-xs text-muted-foreground">{completedCount}/{quests.length} completed</p>
          </div>
        </div>
        
        {/* Progress ring */}
        <div className="relative h-12 w-12">
          <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="hsl(var(--success))"
              strokeWidth="3"
              strokeDasharray={`${(completedCount / quests.length) * 100}, 100`}
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
            {Math.round((completedCount / quests.length) * 100)}%
          </span>
        </div>
      </div>

      <div className="space-y-3 relative">
        {quests.map((quest, index) => {
          const Icon = quest.icon;
          const progressPercent = (quest.progress / quest.target) * 100;

          return (
            <div
              key={quest.id}
              onClick={() => handleQuestClick(quest)}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all cursor-pointer group",
                quest.completed 
                  ? "bg-gradient-to-r from-success/10 to-success/5 border-success/40 shadow-sm" 
                  : "bg-muted/20 border-border/50 hover:border-primary/40 hover:bg-muted/40 hover:shadow-md"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-md transition-all group-hover:scale-105",
                  quest.completed 
                    ? "bg-gradient-to-br from-success to-success/80 text-success-foreground" 
                    : "bg-gradient-to-br from-primary/20 to-accent/20 text-primary"
                )}>
                  {quest.completed ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="font-semibold text-foreground text-sm">{quest.title}</h4>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "shrink-0 text-xs font-bold px-3",
                        quest.completed && "bg-success/20 text-success border-success/30"
                      )}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      +{quest.xpReward} XP
                    </Badge>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <Progress value={progressPercent} className="h-2" />
                    <p className={cn(
                      "text-xs font-medium",
                      quest.completed ? "text-success" : "text-muted-foreground"
                    )}>
                      {quest.progress}/{quest.target} {quest.completed && "✓ Complete!"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
