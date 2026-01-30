import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  Users, 
  BookOpen, 
  Star, 
  Gift,
  CheckCircle2,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Quest {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  xpReward: number;
  progress: number;
  target: number;
  completed: boolean;
}

export function DailyQuestSection() {
  const { user } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([
    {
      id: "1",
      title: "Complete 2 Course From Your Class",
      description: "Finish 2 learning sessions",
      icon: BookOpen,
      xpReward: 140,
      progress: 1,
      target: 2,
      completed: false,
    },
    {
      id: "2",
      title: "Challenge 2 Friends",
      description: "Send 2 challenge invites",
      icon: Users,
      xpReward: 250,
      progress: 0,
      target: 2,
      completed: false,
    },
  ]);

  useEffect(() => {
    if (user) {
      fetchQuestProgress();
    }
  }, [user]);

  const fetchQuestProgress = async () => {
    if (!user) return;

    // Fetch today's sessions to update quest progress
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: sessions } = await externalSupabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());

    if (sessions) {
      setQuests(prev => prev.map(quest => {
        if (quest.id === "1") {
          const progress = Math.min(sessions.length, quest.target);
          return {
            ...quest,
            progress,
            completed: progress >= quest.target,
          };
        }
        return quest;
      }));
    }
  };

  const claimReward = (questId: string) => {
    // In production, this would call an API to claim the reward
    setQuests(prev => prev.map(quest => 
      quest.id === questId ? { ...quest, completed: true } : quest
    ));
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground font-display">Daily Quest</h3>
        <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
          Claim all
        </button>
      </div>

      <div className="space-y-4">
        {quests.map((quest) => {
          const Icon = quest.icon;
          const progressPercent = (quest.progress / quest.target) * 100;
          const isClaimable = quest.progress >= quest.target && !quest.completed;

          return (
            <div
              key={quest.id}
              className={cn(
                "p-4 rounded-xl border transition-all",
                quest.completed 
                  ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" 
                  : "bg-muted/30 border-border hover:border-border/80"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                  quest.completed 
                    ? "bg-emerald-500 text-white" 
                    : "bg-gradient-to-br from-violet-400 to-purple-500 text-white"
                )}>
                  {quest.completed ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-foreground text-sm">{quest.title}</h4>
                      <Badge variant="secondary" className="mt-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <Star className="h-3 w-3 mr-1" />
                        +{quest.xpReward} Exp
                      </Badge>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {quest.progress}/{quest.target} Completed
                      </span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>
                </div>

                {/* Claim button */}
                <div className="shrink-0">
                  {quest.completed ? (
                    <Badge className="bg-emerald-500 text-white">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Claimed
                    </Badge>
                  ) : isClaimable ? (
                    <Button 
                      size="sm" 
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={() => claimReward(quest.id)}
                    >
                      <Gift className="h-3 w-3 mr-1" />
                      Claim Reward
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      In Progress
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
