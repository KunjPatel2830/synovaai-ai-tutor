import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { GlassCard } from "@/components/ui/glass-card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Star, Trophy, Zap, Heart, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserStats {
  level: number;
  xp: number;
  maxXp: number;
  rank: string;
  points: number;
  hearts: number;
}

const rankConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType }> = {
  Beginner: { color: "text-slate-600", bgColor: "bg-slate-100", icon: Star },
  Amateur: { color: "text-emerald-600", bgColor: "bg-emerald-100", icon: Star },
  Expert: { color: "text-blue-600", bgColor: "bg-blue-100", icon: Trophy },
  Master: { color: "text-amber-600", bgColor: "bg-amber-100", icon: Crown },
  "Grand Master": { color: "text-purple-600", bgColor: "bg-purple-100", icon: Crown },
};

export function UserOverview() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [stats, setStats] = useState<UserStats>({
    level: 1,
    xp: 0,
    maxXp: 1000,
    rank: "Beginner",
    points: 0,
    hearts: 5,
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

    // Fetch badges/points for stats calculation
    const { data: badgeData } = await externalSupabase
      .from("user_badges")
      .select("badge_id, badges:badges_public(points)")
      .eq("user_id", user.id);

    if (badgeData) {
      const totalPoints = badgeData.reduce((sum, b) => {
        const points = (b.badges as any)?.points || 0;
        return sum + points;
      }, 0);

      // Calculate level and rank based on points
      const level = Math.floor(totalPoints / 100) + 1;
      const xp = totalPoints % 100;
      let rank = "Beginner";
      if (level >= 20) rank = "Grand Master";
      else if (level >= 15) rank = "Master";
      else if (level >= 10) rank = "Expert";
      else if (level >= 5) rank = "Amateur";

      setStats({
        level,
        xp: xp * 10,
        maxXp: 1000,
        rank,
        points: totalPoints,
        hearts: 5,
      });
    }
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Learner";
  const rankInfo = rankConfig[stats.rank] || rankConfig.Beginner;
  const RankIcon = rankInfo.icon;
  const xpPercentage = (stats.xp / stats.maxXp) * 100;

  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 font-display">Overview</h3>
      
      <div className="flex flex-col items-center text-center">
        {/* Avatar with level badge */}
        <div className="relative mb-4">
          <Avatar className="h-24 w-24 border-4 border-emerald-500 shadow-lg">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-2xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-md">
            Lv. {stats.level}
          </div>
        </div>

        {/* User name */}
        <h4 className="text-lg font-bold text-foreground">{displayName}</h4>
        
        {/* Points badge */}
        <div className="flex items-center gap-1.5 mt-1">
          <Heart className="h-4 w-4 text-red-500 fill-red-500" />
          <span className="text-sm text-muted-foreground">{stats.points.toLocaleString()} PTS</span>
        </div>

        {/* XP Progress */}
        <div className="w-full mt-4 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Exp Level</span>
            <span>{stats.level}</span>
          </div>
          <Progress value={xpPercentage} className="h-2" />
          <div className="text-xs text-muted-foreground text-right">
            {stats.xp.toLocaleString()} / {stats.maxXp.toLocaleString()} ({Math.round(xpPercentage)}%)
          </div>
        </div>

        {/* Rank Badge */}
        <div className={cn(
          "mt-4 px-6 py-3 rounded-xl flex items-center gap-3 w-full",
          rankInfo.bgColor
        )}>
          <RankIcon className={cn("h-8 w-8", rankInfo.color)} />
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Rank Point</p>
            <p className={cn("font-bold text-lg", rankInfo.color)}>{stats.rank.toUpperCase()}</p>
          </div>
        </div>

        <Button className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
          <Zap className="h-4 w-4 mr-2" />
          Play Now
        </Button>
      </div>
    </GlassCard>
  );
}
