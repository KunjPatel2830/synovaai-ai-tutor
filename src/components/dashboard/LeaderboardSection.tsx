import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  avatar?: string;
  isCurrentUser?: boolean;
}

// Mock data - in production this would come from Supabase
const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, name: "Salsabila P", points: 19520 },
  { rank: 2, name: "Syahru M", points: 19520 },
  { rank: 3, name: "Aditya A", points: 8900 },
  { rank: 4, name: "M. Rafit A", points: 8888 },
];

const podiumConfig = {
  1: { bgColor: "bg-yellow-400", textColor: "text-yellow-700", icon: Trophy, size: "h-16 w-16" },
  2: { bgColor: "bg-gray-300", textColor: "text-gray-600", icon: Medal, size: "h-14 w-14" },
  3: { bgColor: "bg-amber-600", textColor: "text-amber-800", icon: Award, size: "h-12 w-12" },
};

export function LeaderboardSection() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(mockLeaderboard);

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground font-display">Leaderboard</h3>
        <button className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
          View All <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Podium - Top 3 */}
      <div className="flex items-end justify-center gap-4 mb-6">
        {/* 2nd Place */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar className="h-14 w-14 border-2 border-gray-300">
              <AvatarFallback className="bg-gradient-to-br from-gray-200 to-gray-300 text-gray-600 font-bold">
                {topThree[1]?.name.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700">
              2
            </div>
          </div>
          <p className="text-xs font-medium mt-2 text-foreground">{topThree[1]?.name || "-"}</p>
          <p className="text-xs text-muted-foreground">{topThree[1]?.points.toLocaleString()} PTS</p>
        </div>

        {/* 1st Place */}
        <div className="flex flex-col items-center -mt-4">
          <Trophy className="h-6 w-6 text-yellow-500 mb-1" />
          <div className="relative">
            <Avatar className="h-20 w-20 border-4 border-yellow-400 shadow-lg">
              <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-amber-500 text-white text-xl font-bold">
                {topThree[0]?.name.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-yellow-400 flex items-center justify-center text-sm font-bold text-yellow-800 shadow-md">
              1
            </div>
          </div>
          <p className="text-sm font-bold mt-2 text-foreground">{topThree[0]?.name || "-"}</p>
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Master</Badge>
          <p className="text-xs text-muted-foreground mt-1">{topThree[0]?.points.toLocaleString()} PTS</p>
        </div>

        {/* 3rd Place */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar className="h-12 w-12 border-2 border-amber-600">
              <AvatarFallback className="bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold">
                {topThree[2]?.name.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-amber-600 flex items-center justify-center text-xs font-bold text-white">
              3
            </div>
          </div>
          <p className="text-xs font-medium mt-2 text-foreground">{topThree[2]?.name || "-"}</p>
          <p className="text-xs text-muted-foreground">{topThree[2]?.points.toLocaleString()} PTS</p>
        </div>
      </div>

      {/* Rest of leaderboard */}
      <div className="space-y-2">
        {rest.map((entry) => (
          <div
            key={entry.rank}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-colors",
              entry.isCurrentUser ? "bg-emerald-50 dark:bg-emerald-900/20" : "hover:bg-muted/50"
            )}
          >
            <span className="text-sm font-medium text-muted-foreground w-6">{entry.rank}th</span>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted text-foreground text-xs font-medium">
                {entry.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{entry.name}</p>
            </div>
            <span className="text-sm font-semibold text-emerald-600">{entry.points.toLocaleString()} PTS</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
