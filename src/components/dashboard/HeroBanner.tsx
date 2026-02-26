import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { Button } from "@/components/ui/button";
import { Brain, Flame, BookOpen, Trophy } from "lucide-react";

export function HeroBanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("Learner");
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (user) {
      externalSupabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.display_name) setDisplayName(data.display_name);
          else setDisplayName(user.email?.split("@")[0] || "Learner");
        });

      externalSupabase
        .from("learning_streaks")
        .select("current_streak")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setStreak(data.current_streak || 0);
        });
    }
  }, [user]);

  return (
    <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Good to see you again 👋</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">
            Welcome back, {displayName}!
          </h1>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-muted-foreground">
                {streak} day streak
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/tutor")} className="gap-2">
            <Brain className="h-4 w-4" />
            Start Learning
          </Button>
          <Button variant="outline" onClick={() => navigate("/exam-prep")} className="gap-2">
            <Trophy className="h-4 w-4" />
            Practice
          </Button>
        </div>
      </div>
    </div>
  );
}
