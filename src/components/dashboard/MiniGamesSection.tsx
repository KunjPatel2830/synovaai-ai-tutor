import { useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Languages, 
  HelpCircle, 
  Calculator, 
  Play,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MiniGame {
  id: string;
  title: string;
  icon: React.ElementType;
  bgColor: string;
  iconColor: string;
  playing: number;
  path: string;
}

const miniGames: MiniGame[] = [
  {
    id: "history",
    title: "History Heroes",
    icon: BookOpen,
    bgColor: "bg-gradient-to-br from-orange-400 to-orange-600",
    iconColor: "text-white",
    playing: 742,
    path: "/tutor",
  },
  {
    id: "language",
    title: "Language War",
    icon: Languages,
    bgColor: "bg-gradient-to-br from-teal-400 to-teal-600",
    iconColor: "text-white",
    playing: 192,
    path: "/language-practice",
  },
  {
    id: "questopia",
    title: "Questopia",
    icon: HelpCircle,
    bgColor: "bg-gradient-to-br from-violet-400 to-violet-600",
    iconColor: "text-white",
    playing: 219,
    path: "/exam-prep",
  },
  {
    id: "math",
    title: "Math Master",
    icon: Calculator,
    bgColor: "bg-gradient-to-br from-sky-400 to-sky-600",
    iconColor: "text-white",
    playing: 145,
    path: "/tutor",
  },
];

export function MiniGamesSection() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground font-display">Mini Games</h3>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {miniGames.map((game) => {
          const Icon = game.icon;
          return (
            <GlassCard
              key={game.id}
              className={cn(
                "relative overflow-hidden cursor-pointer group transition-all duration-300 hover:scale-105",
                game.bgColor
              )}
              onClick={() => navigate(game.path)}
            >
              <div className="p-4 text-white">
                {/* Icon */}
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                
                {/* Title */}
                <h4 className="font-semibold text-sm mb-2">{game.title}</h4>
                
                {/* Playing count */}
                <div className="flex items-center gap-1 text-white/80 text-xs mb-3">
                  <Users className="h-3 w-3" />
                  <span>{game.playing} Playing</span>
                </div>
                
                {/* Play button */}
                <Button 
                  size="sm" 
                  className="w-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Play Now
                </Button>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
