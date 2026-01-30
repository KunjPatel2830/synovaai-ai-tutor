import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { GlassCard } from "@/components/ui/glass-card";
import { Progress } from "@/components/ui/progress";
import { 
  Lightbulb, 
  Users, 
  Target, 
  Brain,
  BookOpen,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

export function PerformanceStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatItem[]>([
    { label: "Creative", value: 75, icon: Lightbulb, color: "text-amber-500" },
    { label: "Teamwork", value: 60, icon: Users, color: "text-blue-500" },
    { label: "Solving", value: 85, icon: Target, color: "text-emerald-500" },
    { label: "Curiosity", value: 70, icon: Brain, color: "text-purple-500" },
    { label: "Discipline", value: 55, icon: BookOpen, color: "text-rose-500" },
  ]);

  useEffect(() => {
    if (user) {
      fetchPerformanceData();
    }
  }, [user]);

  const fetchPerformanceData = async () => {
    if (!user) return;

    // Fetch learning progress to calculate stats
    const { data: progressData } = await externalSupabase
      .from("learning_progress")
      .select("score, attempts, mastered")
      .eq("user_id", user.id);

    if (progressData && progressData.length > 0) {
      const avgScore = progressData.reduce((sum, p) => sum + (p.score || 0), 0) / progressData.length;
      const masteredCount = progressData.filter(p => p.mastered).length;
      const totalAttempts = progressData.reduce((sum, p) => sum + (p.attempts || 0), 0);

      // Update stats based on actual data
      setStats([
        { label: "Creative", value: Math.min(Math.round(avgScore * 0.8), 100), icon: Lightbulb, color: "text-amber-500" },
        { label: "Teamwork", value: 60, icon: Users, color: "text-blue-500" },
        { label: "Solving", value: Math.min(Math.round(avgScore), 100), icon: Target, color: "text-emerald-500" },
        { label: "Curiosity", value: Math.min(Math.round(totalAttempts * 5), 100), icon: Brain, color: "text-purple-500" },
        { label: "Discipline", value: Math.min(Math.round(masteredCount * 10), 100), icon: BookOpen, color: "text-rose-500" },
      ]);
    }
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-emerald-500" />
        <h3 className="text-lg font-semibold text-foreground font-display">Performance</h3>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex flex-col items-center text-center">
              <div className="relative w-14 h-14 mb-2">
                {/* Circular progress background */}
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-muted/30"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${(stat.value / 100) * 150.8} 150.8`}
                    strokeLinecap="round"
                    className={stat.color}
                  />
                </svg>
                {/* Icon in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className={cn("h-5 w-5", stat.color)} />
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
