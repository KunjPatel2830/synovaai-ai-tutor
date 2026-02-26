import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  BookOpen,
  Star,
  CheckCircle2,
  Brain,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    { id: "sessions", title: "Complete 2 sessions", icon: BookOpen, xpReward: 50, progress: 0, target: 2, completed: false, path: "/curriculum-study" },
    { id: "tutor", title: "Ask AI Tutor", icon: Brain, xpReward: 25, progress: 0, target: 1, completed: false, path: "/tutor" },
    { id: "voice", title: "Voice practice", icon: Mic, xpReward: 30, progress: 0, target: 1, completed: false, path: "/voice-tutor" },
  ]);

  useEffect(() => {
    if (user) fetchQuestProgress();
  }, [user]);

  const fetchQuestProgress = async () => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: sessions } = await externalSupabase
      .from("chat_sessions")
      .select("id, mode")
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());

    if (sessions) {
      const sessionCount = sessions.length;
      const hasTutor = sessions.some(s => s.mode === "tutor" || s.mode === "doubt");
      const hasVoice = sessions.some(s => s.mode === "voice");

      setQuests(prev => prev.map(quest => {
        if (quest.id === "sessions") {
          const p = Math.min(sessionCount, quest.target);
          return { ...quest, progress: p, completed: p >= quest.target };
        }
        if (quest.id === "tutor") return { ...quest, progress: hasTutor ? 1 : 0, completed: hasTutor };
        if (quest.id === "voice") return { ...quest, progress: hasVoice ? 1 : 0, completed: hasVoice };
        return quest;
      }));
    }
  };

  const completedCount = quests.filter(q => q.completed).length;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Daily Goals</h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{completedCount}/{quests.length}</span>
      </div>

      <div className="space-y-2.5">
        {quests.map((quest) => {
          const Icon = quest.icon;
          return (
            <div
              key={quest.id}
              onClick={() => !quest.completed && navigate(quest.path)}
              className={cn(
                "p-3 rounded-lg border transition-all cursor-pointer",
                quest.completed
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                  : "bg-background border-border hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  quest.completed
                    ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}>
                  {quest.completed ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{quest.title}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                      <Star className="h-2.5 w-2.5 mr-0.5" />+{quest.xpReward}
                    </Badge>
                  </div>
                  <Progress value={(quest.progress / quest.target) * 100} className="h-1.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
