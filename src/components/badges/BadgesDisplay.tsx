import { useState } from "react";
import { useBadges } from "@/hooks/useBadges";
import { BadgeCard } from "./BadgeCard";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Medal, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function BadgesDisplay() {
  const { badgeProgress, totalPoints, isLoading } = useBadges();
  const [isOpen, setIsOpen] = useState(false);

  const earnedBadges = badgeProgress.filter(bp => bp.earned);
  const inProgressBadges = badgeProgress.filter(bp => !bp.earned);

  // Get the 4 most recently earned or closest to completion
  const displayBadges = [...earnedBadges, ...inProgressBadges.sort((a, b) => 
    (b.current / b.target) - (a.current / a.target)
  )].slice(0, 4);

  if (isLoading) {
    return (
      <GlassCard>
        <GlassCardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <GlassCardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <GlassCardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span>Achievements</span>
          </GlassCardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10">
              <Medal className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">{totalPoints} pts</span>
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ChevronRight className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    All Achievements
                    <span className="ml-auto text-sm font-normal text-muted-foreground">
                      {earnedBadges.length}/{badgeProgress.length} earned • {totalPoints} points
                    </span>
                  </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="earned" className="mt-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="earned">
                      Earned ({earnedBadges.length})
                    </TabsTrigger>
                    <TabsTrigger value="progress">
                      In Progress ({inProgressBadges.length})
                    </TabsTrigger>
                  </TabsList>
                  <ScrollArea className="h-[50vh] mt-4">
                    <TabsContent value="earned" className="space-y-3 mt-0">
                      {earnedBadges.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
                          <p>No badges earned yet.</p>
                          <p className="text-sm">Keep learning to unlock achievements!</p>
                        </div>
                      ) : (
                        earnedBadges.map(bp => (
                          <BadgeCard
                            key={bp.badge.id}
                            name={bp.badge.name}
                            description={bp.badge.description}
                            icon={bp.badge.icon}
                            points={bp.badge.points}
                            earned={true}
                            earnedAt={bp.earnedAt}
                          />
                        ))
                      )}
                    </TabsContent>
                    <TabsContent value="progress" className="space-y-3 mt-0">
                      {inProgressBadges.map(bp => (
                        <BadgeCard
                          key={bp.badge.id}
                          name={bp.badge.name}
                          description={bp.badge.description}
                          icon={bp.badge.icon}
                          points={bp.badge.points}
                          earned={false}
                          progress={bp.current}
                          target={bp.target}
                        />
                      ))}
                    </TabsContent>
                  </ScrollArea>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </GlassCardHeader>
      <GlassCardContent className="pt-2">
        <div className="grid grid-cols-4 gap-3">
          {displayBadges.map(bp => (
            <BadgeCard
              key={bp.badge.id}
              name={bp.badge.name}
              description={bp.badge.description}
              icon={bp.badge.icon}
              points={bp.badge.points}
              earned={bp.earned}
              compact
            />
          ))}
        </div>
        {earnedBadges.length === 0 && (
          <p className="text-xs text-center text-muted-foreground mt-3">
            Complete activities to earn badges and points!
          </p>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
