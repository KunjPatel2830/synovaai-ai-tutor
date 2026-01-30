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

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground font-display flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Daily Goals
        </h3>
      </div>

      <div className="space-y-3">
        {quests.map((quest) => {
          const Icon = quest.icon;
          const progressPercent = (quest.progress / quest.target) * 100;

          return (
            <div
              key={quest.id}
              onClick={() => handleQuestClick(quest)}
              className={cn(
                "p-4 rounded-xl border transition-all cursor-pointer",
                quest.completed 
                  ? "bg-success/10 border-success/30" 
                  : "bg-muted/30 border-border hover:border-primary/30 hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                  quest.completed 
                    ? "bg-success text-success-foreground" 
                    : "bg-primary/10 text-primary"
                )}>
                  {quest.completed ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-foreground text-sm truncate">{quest.title}</h4>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      +{quest.xpReward} XP
                    </Badge>
                  </div>

                  {/* Progress */}
                  <div className="mt-2 space-y-1">
                    <Progress value={progressPercent} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {quest.progress}/{quest.target} {quest.completed ? "✓ Complete" : ""}
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
