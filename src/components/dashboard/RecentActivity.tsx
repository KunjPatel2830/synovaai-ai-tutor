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
  Sparkles,
  ChevronDown,
  ChevronUp
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
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showAllProgress, setShowAllProgress] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch more sessions for "show more" functionality
      const { data: sessions } = await externalSupabase
        .from("chat_sessions")
        .select("id, mode, subject, topic, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (sessions) {
        setRecentSessions(sessions);
      }

      // Fetch more progress items
      const { data: progress } = await externalSupabase
        .from("learning_progress")
        .select("topic, score")
        .eq("user_id", user.id)
        .order("last_studied_at", { ascending: false })
        .limit(10);

      if (progress) {
        setRecentProgress(progress);
      }
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
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-foreground font-display mb-4">Recent Activity</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="elevated" className="p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-accent/10 to-transparent rounded-full blur-2xl" />
      
      <div className="flex items-center gap-3 mb-5 relative">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-lg">
          <TrendingUp className="h-5 w-5 text-accent-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground font-display">Recent Activity</h3>
          <p className="text-xs text-muted-foreground">Your learning journey</p>
        </div>
      </div>

      {recentSessions.length === 0 && recentProgress.length === 0 ? (
        <div className="text-center py-10 relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-foreground font-semibold mb-1">No activity yet</p>
          <p className="text-sm text-muted-foreground mb-5">Start learning to see your progress here!</p>
          <Button 
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg"
            onClick={() => navigate("/curriculum-study")}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Start Learning
          </Button>
        </div>
      ) : (
        <div className="space-y-5 relative">
          {/* Recent Sessions */}
          {recentSessions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Recent Sessions
              </p>
              {displayedSessions.map((session, index) => {
                const config = modeConfig[session.mode] || modeConfig.tutor;
                const Icon = config.icon;

                return (
                  <div 
                    key={session.id}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/40 transition-all group"
                  >
                    <div className={cn(
                      "h-11 w-11 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shadow-sm transition-transform group-hover:scale-105", 
                      config.color
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {session.topic || session.subject || config.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {/* Show More/Less for Sessions */}
              {recentSessions.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-primary"
                  onClick={() => setShowAllSessions(!showAllSessions)}
                >
                  {showAllSessions ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show More ({recentSessions.length - 3} more)
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Progress */}
          {recentProgress.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border/50">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-success" />
                Topic Progress
              </p>
              {displayedProgress.map((item, index) => (
                <div key={index} className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground truncate max-w-[70%]">
                      {item.topic}
                    </span>
                    <span className={cn(
                      "text-sm font-bold px-2 py-0.5 rounded-md",
                      item.score >= 80 ? "bg-success/20 text-success" :
                      item.score >= 50 ? "bg-warning/20 text-warning" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {item.score}%
                    </span>
                  </div>
                  <Progress value={item.score || 0} className="h-2" />
                </div>
              ))}
              
              {/* Show More/Less for Progress */}
              {recentProgress.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-primary"
                  onClick={() => setShowAllProgress(!showAllProgress)}
                >
                  {showAllProgress ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show More ({recentProgress.length - 3} more)
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
