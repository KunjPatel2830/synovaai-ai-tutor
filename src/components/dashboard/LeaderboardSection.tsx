import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Users, Crown } from "lucide-react";
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
      const { data: badgeData } = await externalSupabase
        .from("user_badges")
        .select("user_id, badges:badges(points)");

      if (badgeData) {
        const userPoints: Record<string, number> = {};
        badgeData.forEach((b) => {
          const points = (b.badges as any)?.points || 0;
          userPoints[b.user_id] = (userPoints[b.user_id] || 0) + points;
        });

        const userIds = Object.keys(userPoints);
        if (userIds.length > 0) {
          const { data: profiles } = await externalSupabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", userIds);

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
            .slice(0, 7)
            .map((entry, i) => ({ ...entry, rank: i + 1 }));

          setLeaderboard(entries);
        }
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Leaderboard</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Leaderboard</h3>
        <div className="text-center py-6">
          <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No rankings yet</p>
        </div>
      </div>
    );
  }

  const medalColors = [
    "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800",
    "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
    "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800",
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Leaderboard</h3>
      </div>

      <div className="space-y-1.5">
        {leaderboard.map((entry) => (
          <div
            key={entry.userId}
            className={cn(
              "flex items-center gap-2.5 p-2.5 rounded-lg transition-colors",
              entry.isCurrentUser ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50"
            )}
          >
            <span className={cn(
              "text-xs font-bold w-6 h-6 rounded-md flex items-center justify-center border shrink-0",
              entry.rank <= 3 ? medalColors[entry.rank - 1] : "bg-muted text-muted-foreground border-border"
            )}>
              {entry.rank <= 3 ? <Crown className="h-3 w-3" /> : entry.rank}
            </span>
            <Avatar className="h-7 w-7">
              <AvatarImage src={entry.avatar} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                {entry.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className={cn("text-sm flex-1 truncate", entry.isCurrentUser ? "font-semibold text-primary" : "text-foreground")}>
              {entry.name}{entry.isCurrentUser && " (You)"}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{entry.points}pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}
