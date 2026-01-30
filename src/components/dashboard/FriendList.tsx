import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  UserPlus, 
  Crown, 
  Trophy, 
  Star,
  Circle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Friend {
  id: string;
  name: string;
  avatar?: string;
  rank: "Grand Master" | "Master" | "Expert" | "Amateur" | "Beginner";
  isOnline: boolean;
}

// Mock data
const mockFriends: Friend[] = [
  { id: "1", name: "Syahru M", rank: "Grand Master", isOnline: true },
  { id: "2", name: "Zizi Handayani", rank: "Beginner", isOnline: true },
  { id: "3", name: "Andrean Syah S", rank: "Expert", isOnline: false },
  { id: "4", name: "Salsabila Purwanti", rank: "Grand Master", isOnline: true },
  { id: "5", name: "Arya Haliki", rank: "Amateur", isOnline: false },
  { id: "6", name: "Ari Fianto", rank: "Amateur", isOnline: true },
  { id: "7", name: "Aditya Anugrah", rank: "Expert", isOnline: false },
  { id: "8", name: "Cornelia Astuti", rank: "Expert", isOnline: true },
];

const rankConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType }> = {
  "Grand Master": { color: "text-purple-600", bgColor: "bg-purple-100", icon: Crown },
  "Master": { color: "text-amber-600", bgColor: "bg-amber-100", icon: Trophy },
  "Expert": { color: "text-blue-600", bgColor: "bg-blue-100", icon: Trophy },
  "Amateur": { color: "text-emerald-600", bgColor: "bg-emerald-100", icon: Star },
  "Beginner": { color: "text-slate-600", bgColor: "bg-slate-100", icon: Star },
};

export function FriendList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [friends] = useState<Friend[]>(mockFriends);

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <GlassCard className="p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground font-display flex items-center gap-2">
          Friend List
          <UserPlus className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-emerald-500 transition-colors" />
        </h3>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search username or email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Friends list */}
      <ScrollArea className="h-[300px] pr-2">
        <div className="space-y-2">
          {filteredFriends.map((friend) => {
            const rankInfo = rankConfig[friend.rank];
            const RankIcon = rankInfo.icon;
            
            return (
              <div
                key={friend.id}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
              >
                {/* Avatar with online indicator */}
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={friend.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-sm font-medium">
                      {friend.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {friend.isOnline && (
                    <Circle className="absolute bottom-0 right-0 h-3 w-3 text-emerald-500 fill-emerald-500" />
                  )}
                </div>

                {/* Name and rank */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{friend.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <RankIcon className={cn("h-3 w-3", rankInfo.color)} />
                    <span className={cn("text-xs", rankInfo.color)}>{friend.rank}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </GlassCard>
  );
}
