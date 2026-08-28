import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Star, Trophy, Zap, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserStats {
  level: number;
  xp: number;
  maxXp: number;
  rank: string;
  points: number;
  streak: number;
}

const XP_PER_LEVEL = 200;

const rankConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType }> = {
  Beginner: { color: "text-muted-foreground", bgColor: "bg-muted", icon: Star },
  Learner: { color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/30", icon: Star },
  Scholar: { color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/30", icon: Trophy },
  Expert: { color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/30", icon: Crown },
  Master: { color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950/30", icon: Crown },
};

export function UserOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [stats, setStats] = useState<UserStats>({
    level: 1, xp: 0, maxXp: XP_PER_LEVEL, rank: "Beginner", points: 0, streak: 0,
  });

  useEffect(() => {
    if (user) fetchUserData();
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    const [profileRes, streakRes, sessionsRes, progressRes, badgeRes] = await Promise.all([
      externalSupabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle(),
      externalSupabase
        .from("learning_streaks")
        .select("current_streak")
        .eq("user_id", user.id)
        .maybeSingle(),
      externalSupabase
        .from("chat_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      externalSupabase
        .from("learning_progress")
        .select("score, attempts, mastered")
        .eq("user_id", user.id),
      externalSupabase
        .from("user_badges")
        .select("badge_id, badges:badges_public(points)")
        .eq("user_id", user.id),
    ]);

    if (profileRes.data) setProfile(profileRes.data);

    // Calculate XP from multiple sources
    const sessionCount = sessionsRes.count || 0;
    const topicData = progressRes.data || [];
    const badgeData = badgeRes.data || [];
    const streak = streakRes.data?.current_streak || 0;

    // XP sources:
    // - Sessions: 10 XP each
    // - Topic attempts: 5 XP per attempt
    // - Mastered topics: 50 XP bonus each
    // - Badge points: as earned
    // - Streak bonus: streak * 5
    const sessionXp = sessionCount * 10;
    const attemptXp = topicData.reduce((s, t) => s + (t.attempts || 0) * 5, 0);
    const masteredXp = topicData.filter(t => t.mastered).length * 50;
    const badgeXp = badgeData.reduce((sum, b) => sum + ((b.badges as any)?.points || 0), 0);
    const streakXp = streak * 5;

    const totalXp = sessionXp + attemptXp + masteredXp + badgeXp + streakXp;

    const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
    const xpInCurrentLevel = totalXp % XP_PER_LEVEL;

    let rank = "Beginner";
    if (level >= 20) rank = "Master";
    else if (level >= 15) rank = "Expert";
    else if (level >= 10) rank = "Scholar";
    else if (level >= 5) rank = "Learner";

    setStats({
      level,
      xp: xpInCurrentLevel,
      maxXp: XP_PER_LEVEL,
      rank,
      points: totalXp,
      streak,
    });
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Learner";
  const rankInfo = rankConfig[stats.rank] || rankConfig.Beginner;
  const RankIcon = rankInfo.icon;
  const xpPercentage = (stats.xp / stats.maxXp) * 100;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">My Progress</h3>

      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border-2 border-border">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-muted text-foreground font-bold">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h4 className="font-bold text-foreground">{displayName}</h4>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", rankInfo.bgColor, rankInfo.color)}>
              <RankIcon className="h-3 w-3 inline mr-1" />
              {stats.rank}
            </span>
            <span className="text-xs text-muted-foreground">Lv. {stats.level}</span>
          </div>
        </div>
      </div>

      {stats.streak > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium text-orange-700 dark:text-orange-400">{stats.streak} day streak 🔥</span>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">XP to next level</span>
          <span className="font-medium text-foreground">{stats.xp}/{stats.maxXp}</span>
        </div>
        <Progress value={xpPercentage} className="h-2" />
      </div>

      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/50 border border-border">
        <span className="text-xs text-muted-foreground">Total XP</span>
        <span className="font-bold text-foreground">{stats.points} XP</span>
      </div>

      <Button
        className="w-full"
        onClick={() => navigate("/curriculum-study")}
      >
        <Zap className="h-4 w-4 mr-2" />
        Continue Learning
      </Button>
    </div>
  );
}
