import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { GlassCard } from "@/components/ui/glass-card";
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

const rankConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType }> = {
  Beginner: { color: "text-muted-foreground", bgColor: "bg-muted", icon: Star },
  Learner: { color: "text-success", bgColor: "bg-success/10", icon: Star },
  Scholar: { color: "text-primary", bgColor: "bg-primary/10", icon: Trophy },
  Expert: { color: "text-warning", bgColor: "bg-warning/10", icon: Crown },
  Master: { color: "text-accent-foreground", bgColor: "bg-accent", icon: Crown },
};

export function UserOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [stats, setStats] = useState<UserStats>({
    level: 1,
    xp: 0,
    maxXp: 1000,
    rank: "Beginner",
    points: 0,
    streak: 0,
  });

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    // Fetch profile
    const { data: profileData } = await externalSupabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData);
    }

    // Fetch streak
    const { data: streakData } = await externalSupabase
      .from("learning_streaks")
      .select("current_streak")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fetch badges/points for stats calculation
    const { data: badgeData } = await externalSupabase
      .from("user_badges")
      .select("badge_id, badges:badges_public(points)")
      .eq("user_id", user.id);

    const totalPoints = badgeData?.reduce((sum, b) => {
      const points = (b.badges as any)?.points || 0;
      return sum + points;
    }, 0) || 0;

    // Calculate level and rank based on points
    const level = Math.floor(totalPoints / 100) + 1;
    const xp = (totalPoints % 100) * 10;
    let rank = "Beginner";
    if (level >= 20) rank = "Master";
    else if (level >= 15) rank = "Expert";
    else if (level >= 10) rank = "Scholar";
    else if (level >= 5) rank = "Learner";

    setStats({
      level,
      xp,
      maxXp: 1000,
      rank,
      points: totalPoints,
      streak: streakData?.current_streak || 0,
    });
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Learner";
  const rankInfo = rankConfig[stats.rank] || rankConfig.Beginner;
  const RankIcon = rankInfo.icon;
  const xpPercentage = (stats.xp / stats.maxXp) * 100;

  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 font-display">My Progress</h3>
      
      <div className="flex flex-col items-center text-center">
        {/* Avatar with level badge */}
        <div className="relative mb-4">
          <Avatar className="h-20 w-20 border-4 border-primary shadow-lg">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md">
            Lv. {stats.level}
          </div>
        </div>

        {/* User name */}
        <h4 className="text-lg font-bold text-foreground">{displayName}</h4>
        
        {/* Streak badge */}
        {stats.streak > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <Flame className="h-4 w-4 text-warning" />
            <span className="text-sm text-muted-foreground">{stats.streak} day streak</span>
          </div>
        )}

        {/* XP Progress */}
        <div className="w-full mt-4 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Experience</span>
            <span>{stats.points} pts</span>
          </div>
          <Progress value={xpPercentage} className="h-2" />
          <div className="text-xs text-muted-foreground text-right">
            {stats.xp} / {stats.maxXp} XP to next level
          </div>
        </div>

        {/* Rank Badge */}
        <div className={cn(
          "mt-4 px-4 py-2 rounded-xl flex items-center gap-2 w-full justify-center",
          rankInfo.bgColor
        )}>
          <RankIcon className={cn("h-5 w-5", rankInfo.color)} />
          <span className={cn("font-semibold text-sm", rankInfo.color)}>{stats.rank}</span>
        </div>

        <Button 
          className="w-full mt-4" 
          onClick={() => navigate("/curriculum-study")}
        >
          <Zap className="h-4 w-4 mr-2" />
          Continue Learning
        </Button>
      </div>
    </GlassCard>
  );
}
