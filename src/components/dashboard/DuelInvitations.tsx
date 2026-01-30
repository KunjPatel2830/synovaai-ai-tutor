import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Swords, Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DuelInvitation {
  id: string;
  fromUser: {
    name: string;
    avatar?: string;
  };
  points: number;
  message: string;
  timeAgo: string;
}

// Mock data
const mockInvitations: DuelInvitation[] = [
  {
    id: "1",
    fromUser: { name: "Taswir Januar" },
    points: 400,
    message: "I want to challenge you to play some...",
    timeAgo: "1m ago",
  },
  {
    id: "2",
    fromUser: { name: "Erik Irawan" },
    points: 180,
    message: "I want to challenge you to play some...",
    timeAgo: "3m ago",
  },
];

export function DuelInvitations() {
  const [invitations, setInvitations] = useState<DuelInvitation[]>(mockInvitations);

  const handleAccept = (id: string) => {
    toast.success("Challenge accepted! Get ready to play.");
    setInvitations(prev => prev.filter(inv => inv.id !== id));
  };

  const handleDecline = (id: string) => {
    toast.info("Challenge declined.");
    setInvitations(prev => prev.filter(inv => inv.id !== id));
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Swords className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold text-foreground font-display">Duel Invitation</h3>
      </div>

      {invitations.length === 0 ? (
        <div className="text-center py-8">
          <Swords className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">No pending challenges</p>
          <p className="text-xs text-muted-foreground mt-1">Challenge your friends to earn points!</p>
        </div>
      ) : (
        <ScrollArea className="h-[180px]">
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border"
              >
                {/* Avatar */}
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={invitation.fromUser.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-orange-400 to-red-500 text-white text-sm font-medium">
                    {invitation.fromUser.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">{invitation.fromUser.name}</span>
                    <span className="text-xs text-muted-foreground">{invitation.timeAgo}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{invitation.message}</p>
                  
                  {/* Points badge */}
                  <Badge className="mt-2 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    <Star className="h-3 w-3 mr-1" />
                    +{invitation.points} Points
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDecline(invitation.id)}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-7 bg-emerald-500 hover:bg-emerald-600 text-white"
                    onClick={() => handleAccept(invitation.id)}
                  >
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </GlassCard>
  );
}
