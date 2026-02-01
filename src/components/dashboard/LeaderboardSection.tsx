import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { GlassCard } from "@/components/ui/glass-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, ChevronRight, Users, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  avatar?: string;
  isCurrentUser?: boolean;
  userId: string;
}

export function LeaderboardSection() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  const fetchLeaderboard = async () => {
    try {
      // Fetch all user badges with points
      const { data: badgeData } = await externalSupabase
        .from("user_badges")
        .select("user_id, badges:badges_public(points)");

      if (badgeData) {
        // Aggregate points by user
        const userPoints: Record<string, number> = {};
        badgeData.forEach((b) => {
          const points = (b.badges as any)?.points || 0;
          userPoints[b.user_id] = (userPoints[b.user_id] || 0) + points;
        });

        // Get user profiles
        const userIds = Object.keys(userPoints);
        if (userIds.length > 0) {
          const { data: profiles } = await externalSupabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", userIds);

          // Create leaderboard entries
          const entries: LeaderboardEntry[] = userIds
            .map((userId) => {
              const profile = profiles?.find((p) => p.user_id === userId);
              return {
                rank: 0,
                name: profile?.display_name || "Anonymous",
                points: userPoints[userId],
                avatar: profile?.avatar_url || undefined,
                isCurrentUser: userId === user?.id,
                userId,
              };
            })
            .sort((a, b) => b.points - a.points)
            .slice(0, 10)
            .map((entry, index) => ({ ...entry, rank: index + 1 }));

          setLeaderboard(entries);
        }
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3, 7);

  if (loading) {
    return (
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-foreground font-display mb-4">Leaderboard</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </GlassCard>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-foreground font-display mb-4">Leaderboard</h3>
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">No rankings yet</p>
          <p className="text-xs text-muted-foreground mt-1">Complete lessons to earn badges and climb the leaderboard!</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="elevated" className="p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-warning/10 to-transparent rounded-full blur-3xl" />
      
      <div className="flex items-center gap-3 mb-6 relative">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-warning to-warning/80 flex items-center justify-center shadow-lg">
          <Trophy className="h-5 w-5 text-warning-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground font-display">Leaderboard</h3>
          <p className="text-xs text-muted-foreground">Top learners this week</p>
        </div>
      </div>

      {/* Enhanced Podium - Top 3 */}
      {topThree.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-6 py-4 px-2 rounded-2xl bg-gradient-to-b from-muted/30 to-transparent relative">
          {/* 2nd Place */}
          <div className="flex flex-col items-center group">
            <div className="relative transition-transform group-hover:scale-105">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-muted-foreground/30 to-muted-foreground/20 blur-sm scale-110" />
              <Avatar className="h-14 w-14 border-3 border-muted-foreground/40 shadow-lg relative">
                <AvatarImage src={topThree[1]?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-muted to-muted/80 text-muted-foreground font-bold">
                  {topThree[1]?.name.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-muted-foreground/60 to-muted-foreground/40 flex items-center justify-center text-xs font-bold text-background shadow-md border-2 border-background">
                2
              </div>
            </div>
            <p className="text-xs font-semibold mt-2 text-foreground truncate max-w-16">{topThree[1]?.name || "-"}</p>
            <p className="text-xs text-muted-foreground font-medium">{topThree[1]?.points || 0} pts</p>
          </div>

          {/* 1st Place - Crown */}
          <div className="flex flex-col items-center -mt-6 group">
            <div className="mb-1 animate-bounce">
              <Crown className="h-6 w-6 text-warning drop-shadow-lg" />
            </div>
            <div className="relative transition-transform group-hover:scale-105">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-warning via-warning/80 to-warning blur-md scale-110 animate-pulse" />
              <Avatar className="h-18 w-18 border-4 border-warning shadow-2xl relative" style={{ width: '72px', height: '72px' }}>
                <AvatarImage src={topThree[0]?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-warning to-warning/80 text-warning-foreground text-xl font-bold">
                  {topThree[0]?.name.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-gradient-to-br from-warning to-warning/80 flex items-center justify-center text-sm font-bold text-warning-foreground shadow-lg border-2 border-background">
                1
              </div>
            </div>
            <p className="text-sm font-bold mt-2 text-foreground">{topThree[0]?.name || "-"}</p>
            <p className="text-xs text-warning font-bold">{topThree[0]?.points || 0} pts 🏆</p>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center group">
            <div className="relative transition-transform group-hover:scale-105">
              <Avatar className="h-12 w-12 border-2 border-accent/40 shadow-md">
                <AvatarImage src={topThree[2]?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-accent/50 to-accent/30 text-accent-foreground font-bold text-sm">
                  {topThree[2]?.name.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-accent/60 to-accent/40 flex items-center justify-center text-xs font-bold text-accent-foreground shadow border-2 border-background">
                3
              </div>
            </div>
            <p className="text-xs font-semibold mt-2 text-foreground truncate max-w-16">{topThree[2]?.name || "-"}</p>
            <p className="text-xs text-muted-foreground font-medium">{topThree[2]?.points || 0} pts</p>
          </div>
        </div>
      )}

      {/* Rest of leaderboard with enhanced styling */}
      {rest.length > 0 && (
        <div className="space-y-2 relative">
          {rest.map((entry, index) => (
            <div
              key={entry.userId}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-all",
                entry.isCurrentUser 
                  ? "bg-gradient-to-r from-primary/15 to-accent/10 border border-primary/30 shadow-sm" 
                  : "hover:bg-muted/50"
              )}
            >
              <span className={cn(
                "text-sm font-bold w-8 h-8 rounded-lg flex items-center justify-center",
                entry.isCurrentUser ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {entry.rank}
              </span>
              <Avatar className="h-10 w-10 shadow-sm">
                <AvatarImage src={entry.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-muted to-muted/80 text-muted-foreground text-sm font-semibold">
                  {entry.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-semibold truncate", 
                  entry.isCurrentUser ? "text-primary" : "text-foreground"
                )}>
                  {entry.name} {entry.isCurrentUser && <span className="text-xs">(You)</span>}
                </p>
              </div>
              <span className={cn(
                "text-sm font-bold px-3 py-1 rounded-lg",
                entry.isCurrentUser ? "bg-primary/20 text-primary" : "bg-muted text-foreground"
              )}>
                {entry.points} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
