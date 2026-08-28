import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  BookOpen,
  Brain,
  FileText,
  ClipboardList,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
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
  tutor: { icon: Brain, label: "AI Tutor", color: "text-violet-600 dark:text-violet-400" },
  curriculum: { icon: BookOpen, label: "Curriculum", color: "text-rose-600 dark:text-rose-400" },
  homework: { icon: FileText, label: "Homework", color: "text-sky-600 dark:text-sky-400" },
  exam: { icon: ClipboardList, label: "Exam Prep", color: "text-emerald-600 dark:text-emerald-400" },
  doubt: { icon: Brain, label: "Doubt Solver", color: "text-orange-600 dark:text-orange-400" },
  voice: { icon: Brain, label: "Voice Tutor", color: "text-amber-600 dark:text-amber-400" },
};

export function RecentActivity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [recentProgress, setRecentProgress] = useState<LearningProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showAllProgress, setShowAllProgress] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [sessionsRes, progressRes] = await Promise.all([
        externalSupabase
          .from("chat_sessions")
          .select("id, mode, subject, topic, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        externalSupabase
          .from("learning_progress")
          .select("topic, score")
          .eq("user_id", user.id)
          .order("last_studied_at", { ascending: false })
          .limit(10),
      ]);
      if (sessionsRes.data) setRecentSessions(sessionsRes.data);
      if (progressRes.data) setRecentProgress(progressRes.data);
    } catch (error) {
      console.error("Error fetching activity:", error);
    } finally {
      setLoading(false);
    }
  };

  const displayedSessions = showAllSessions ? recentSessions : recentSessions.slice(0, 3);
  const displayedProgress = showAllProgress ? recentProgress : recentProgress.slice(0, 3);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Recent Activity</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</h3>
      </div>

      {recentSessions.length === 0 && recentProgress.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium mb-1">No activity yet</p>
          <p className="text-sm text-muted-foreground mb-4">Start learning to see your progress!</p>
          <Button size="sm" onClick={() => navigate("/curriculum-study")}>
            <Sparkles className="h-4 w-4 mr-2" />
            Start Learning
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {recentSessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Sessions</p>
              {displayedSessions.map((session) => {
                const config = modeConfig[session.mode] || modeConfig.tutor;
                const Icon = config.icon;
                return (
                  <div key={session.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={cn("h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0", config.color)}>
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
              {recentSessions.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => setShowAllSessions(!showAllSessions)}
                >
                  {showAllSessions ? <><ChevronUp className="h-3 w-3 mr-1" />Less</> : <><ChevronDown className="h-3 w-3 mr-1" />More ({recentSessions.length - 3})</>}
                </Button>
              )}
            </div>
          )}

          {recentProgress.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground">Progress</p>
              {displayedProgress.map((item, i) => (
                <div key={i} className="space-y-1.5 p-2.5 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate max-w-[70%]">{item.topic}</span>
                    <span className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded",
                      item.score >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" :
                      item.score >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" :
                      "bg-muted text-muted-foreground"
                    )}>{item.score}%</span>
                  </div>
                  <Progress value={item.score || 0} className="h-1.5" />
                </div>
              ))}
              {recentProgress.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => setShowAllProgress(!showAllProgress)}
                >
                  {showAllProgress ? <><ChevronUp className="h-3 w-3 mr-1" />Less</> : <><ChevronDown className="h-3 w-3 mr-1" />More ({recentProgress.length - 3})</>}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
