import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { BookOpen, Clock, Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  iconColor: string;
}

export function StatsCards() {
  const { user } = useAuth();
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalTopics, setTotalTopics] = useState(0);
  const [masteredTopics, setMasteredTopics] = useState(0);
  const [avgScore, setAvgScore] = useState(0);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    const [sessions, progress] = await Promise.all([
      externalSupabase
        .from("chat_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      externalSupabase
        .from("learning_progress")
        .select("topic, score, mastered")
        .eq("user_id", user.id),
    ]);

    setTotalSessions(sessions.count || 0);

    if (progress.data) {
      setTotalTopics(progress.data.length);
      setMasteredTopics(progress.data.filter(p => p.mastered).length);
      const avg = progress.data.length > 0
        ? Math.round(progress.data.reduce((s, p) => s + (p.score || 0), 0) / progress.data.length)
        : 0;
      setAvgScore(avg);
    }
  };

  const stats: StatCard[] = [
    {
      label: "Sessions",
      value: totalSessions,
      icon: Clock,
      accent: "bg-primary/10 dark:bg-primary/10 border-primary/25 dark:border-primary/15",
      iconColor: "text-primary",
    },
    {
      label: "Topics Studied",
      value: totalTopics,
      icon: BookOpen,
      accent: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Avg Score",
      value: `${avgScore}%`,
      icon: TrendingUp,
      accent: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Mastered",
      value: masteredTopics,
      icon: Trophy,
      accent: "bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/30",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "rounded-xl border p-4 transition-all hover:shadow-sm",
              stat.accent
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center bg-background/60", stat.iconColor)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
