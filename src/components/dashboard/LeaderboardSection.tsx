import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { GlassCard } from "@/components/ui/glass-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, ChevronRight, Users } from "lucide-react";
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
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground font-display">Leaderboard</h3>
      </div>

      {/* Podium - Top 3 */}
      {topThree.length >= 3 && (
        <div className="flex items-end justify-center gap-4 mb-6">
          {/* 2nd Place */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="h-12 w-12 border-2 border-muted">
                <AvatarImage src={topThree[1]?.avatar} />
                <AvatarFallback className="bg-muted text-muted-foreground font-bold text-sm">
                  {topThree[1]?.name.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                2
              </div>
            </div>
            <p className="text-xs font-medium mt-2 text-foreground truncate max-w-16">{topThree[1]?.name || "-"}</p>
            <p className="text-xs text-muted-foreground">{topThree[1]?.points || 0} pts</p>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center -mt-4">
            <Trophy className="h-5 w-5 text-warning mb-1" />
            <div className="relative">
              <Avatar className="h-16 w-16 border-4 border-warning shadow-lg">
                <AvatarImage src={topThree[0]?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-warning to-warning/80 text-warning-foreground text-lg font-bold">
                  {topThree[0]?.name.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-warning flex items-center justify-center text-sm font-bold text-warning-foreground shadow-md">
                1
              </div>
            </div>
            <p className="text-sm font-bold mt-2 text-foreground">{topThree[0]?.name || "-"}</p>
            <p className="text-xs text-muted-foreground">{topThree[0]?.points || 0} pts</p>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="h-10 w-10 border-2 border-muted">
                <AvatarImage src={topThree[2]?.avatar} />
                <AvatarFallback className="bg-muted text-muted-foreground font-bold text-xs">
                  {topThree[2]?.name.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                3
              </div>
            </div>
            <p className="text-xs font-medium mt-2 text-foreground truncate max-w-16">{topThree[2]?.name || "-"}</p>
            <p className="text-xs text-muted-foreground">{topThree[2]?.points || 0} pts</p>
          </div>
        </div>
      )}

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((entry) => (
            <div
              key={entry.userId}
              className={cn(
                "flex items-center gap-3 p-2 rounded-xl transition-colors",
                entry.isCurrentUser ? "bg-primary/10" : "hover:bg-muted/50"
              )}
            >
              <span className="text-xs font-medium text-muted-foreground w-6">{entry.rank}th</span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={entry.avatar} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                  {entry.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", entry.isCurrentUser ? "text-primary" : "text-foreground")}>
                  {entry.name} {entry.isCurrentUser && "(You)"}
                </p>
              </div>
              <span className="text-sm font-semibold text-primary">{entry.points} pts</span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
