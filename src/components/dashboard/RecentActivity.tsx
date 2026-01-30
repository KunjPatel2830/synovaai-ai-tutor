import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  BookOpen, 
  Brain, 
  FileText, 
  ClipboardList,
  TrendingUp,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface RecentSession {
  id: string;
  mode: string;
  subject: string | null;
  topic: string | null;
  created_at: string;
}

interface LearningProgress {
  topic: string;
  score: number;
}

const modeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  tutor: { icon: Brain, label: "AI Tutor", color: "text-accent-foreground" },
  curriculum: { icon: BookOpen, label: "Curriculum", color: "text-primary" },
  homework: { icon: FileText, label: "Homework", color: "text-secondary-foreground" },
  exam: { icon: ClipboardList, label: "Exam Prep", color: "text-success" },
  doubt: { icon: Brain, label: "Doubt Solver", color: "text-warning" },
  voice: { icon: Brain, label: "Voice Tutor", color: "text-destructive" },
};

export function RecentActivity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [recentProgress, setRecentProgress] = useState<LearningProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch recent sessions
      const { data: sessions } = await externalSupabase
        .from("chat_sessions")
        .select("id, mode, subject, topic, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (sessions) {
        setRecentSessions(sessions);
      }

      // Fetch recent progress
      const { data: progress } = await externalSupabase
        .from("learning_progress")
        .select("topic, score")
        .eq("user_id", user.id)
        .order("last_studied_at", { ascending: false })
        .limit(4);

      if (progress) {
        setRecentProgress(progress);
      }
    } catch (error) {
      console.error("Error fetching activity:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-foreground font-display mb-4">Recent Activity</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground font-display flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Recent Activity
        </h3>
      </div>

      {recentSessions.length === 0 && recentProgress.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-1">Start learning to see your progress here!</p>
          <Button 
            className="mt-4"
            onClick={() => navigate("/curriculum-study")}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Start Learning
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Recent Sessions */}
          {recentSessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Sessions</p>
              {recentSessions.slice(0, 3).map((session) => {
                const config = modeConfig[session.mode] || modeConfig.tutor;
                const Icon = config.icon;

                return (
                  <div 
                    key={session.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn("h-8 w-8 rounded-lg bg-muted flex items-center justify-center", config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {session.topic || session.subject || config.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Progress */}
          {recentProgress.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Topic Progress</p>
              {recentProgress.map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground truncate max-w-[70%]">
                      {item.topic}
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      {item.score}%
                    </span>
                  </div>
                  <Progress value={item.score || 0} className="h-1.5" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
