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
    <GlassCard variant="elevated" className="p-6 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <h3 className="text-lg font-semibold text-foreground mb-5 font-display flex items-center gap-2 relative">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
          <Trophy className="h-4 w-4 text-primary-foreground" />
        </div>
        My Progress
      </h3>
      
      <div className="flex flex-col items-center text-center relative">
        {/* Avatar with animated ring */}
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary via-accent to-primary animate-gradient blur-sm scale-110" />
          <Avatar className="h-24 w-24 border-4 border-background shadow-2xl relative">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary via-accent to-primary text-primary-foreground text-2xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-bold shadow-lg border-2 border-background">
            Lv. {stats.level}
          </div>
        </div>

        {/* User name */}
        <h4 className="text-xl font-bold text-foreground mt-2">{displayName}</h4>
        
        {/* Streak badge with flame animation */}
        {stats.streak > 0 && (
          <div className="flex items-center gap-2 mt-2 px-4 py-1.5 rounded-full bg-warning/15 border border-warning/30">
            <Flame className="h-5 w-5 text-warning animate-pulse" />
            <span className="text-sm font-semibold text-warning">{stats.streak} day streak 🔥</span>
          </div>
        )}

        {/* XP Progress with enhanced styling */}
        <div className="w-full mt-5 space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-foreground">Experience Points</span>
            <span className="font-bold text-primary">{stats.points} pts</span>
          </div>
          <Progress value={xpPercentage} className="h-3" />
          <div className="text-xs text-muted-foreground text-center">
            <span className="font-medium">{stats.xp}</span> / {stats.maxXp} XP to Level {stats.level + 1}
          </div>
        </div>

        {/* Rank Badge with enhanced styling */}
        <div className={cn(
          "mt-4 px-5 py-3 rounded-2xl flex items-center gap-3 w-full justify-center border shadow-sm transition-all",
          rankInfo.bgColor,
          "border-border/50"
        )}>
          <RankIcon className={cn("h-6 w-6", rankInfo.color)} />
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Current Rank</p>
            <span className={cn("font-bold", rankInfo.color)}>{stats.rank}</span>
          </div>
        </div>

        <Button 
          className="w-full mt-5 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]" 
          size="lg"
          onClick={() => navigate("/curriculum-study")}
        >
          <Zap className="h-5 w-5 mr-2" />
          Continue Learning
        </Button>
      </div>
    </GlassCard>
  );
}
