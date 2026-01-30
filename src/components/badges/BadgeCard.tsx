import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  Footprints,
  Brain,
  Search,
  GraduationCap,
  Flame,
  Zap,
  Trophy,
  Compass,
  Star,
  Medal,
  HandHelping,
  Mic,
  Award,
} from "lucide-react";

interface BadgeCardProps {
  name: string;
  description: string;
  icon: string;
  points: number;
  earned: boolean;
  progress?: number;
  target?: number;
  earnedAt?: string;
  compact?: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  footprints: Footprints,
  brain: Brain,
  search: Search,
  "graduation-cap": GraduationCap,
  flame: Flame,
  zap: Zap,
  trophy: Trophy,
  compass: Compass,
  star: Star,
  medal: Medal,
  "hand-helping": HandHelping,
  mic: Mic,
};

export function BadgeCard({
  name,
  description,
  icon,
  points,
  earned,
  progress = 0,
  target = 1,
  earnedAt,
  compact = false,
}: BadgeCardProps) {
  const IconComponent = iconMap[icon] || Award;
  const progressPercent = Math.min((progress / target) * 100, 100);

  if (compact) {
    return (
      <div
        className={cn(
          "relative flex flex-col items-center p-3 rounded-xl border transition-all duration-300",
          earned
            ? "bg-primary/10 border-primary/30 animate-fade-in hover:scale-105"
            : "bg-muted/30 border-border opacity-50 grayscale"
        )}
      >
        {/* Glow effect for earned badges */}
        {earned && (
          <div className="absolute inset-0 rounded-xl bg-primary/20 blur-xl animate-pulse-slow -z-10" />
        )}
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300",
            earned 
              ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg ring-2 ring-primary/30" 
              : "bg-muted text-muted-foreground"
          )}
        >
          <IconComponent className={cn("h-5 w-5", earned && "animate-bounce")} />
        </div>
        <p className="text-xs font-medium text-center line-clamp-1">{name}</p>
        {earned && (
          <span className="text-[10px] text-primary font-medium mt-1 animate-fade-in">+{points} pts</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative p-4 rounded-xl border transition-all duration-300",
        earned
          ? "bg-primary/5 border-primary/20 shadow-md hover:shadow-lg animate-fade-in"
          : "bg-muted/20 border-border"
      )}
    >
      {/* Glow effect for earned badges */}
      {earned && (
        <div className="absolute inset-0 rounded-xl bg-primary/10 blur-xl animate-pulse-slow -z-10" />
      )}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "h-14 w-14 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300",
            earned
              ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg ring-2 ring-primary/20 hover:scale-110"
              : "bg-muted text-muted-foreground"
          )}
        >
          <IconComponent className={cn("h-7 w-7", earned && "drop-shadow-lg")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={cn("font-semibold", earned ? "text-foreground" : "text-muted-foreground")}>
              {name}
            </h4>
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                earned ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {points} pts
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
          
          {!earned && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progress}/{target}</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          )}
          
          {earned && earnedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Earned {new Date(earnedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
