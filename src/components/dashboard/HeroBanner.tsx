import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, BookOpen, Brain } from "lucide-react";

export function HeroBanner() {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-accent p-6 md:p-8">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-background/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-background/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground font-display mb-2">
            Learn Smart, Grow Faster! 🚀
          </h2>
          <p className="text-primary-foreground/90 text-sm md:text-base max-w-md">
            Complete lessons, earn badges, and climb the leaderboard. Your personalized AI tutor is ready!
          </p>
          <div className="flex flex-wrap gap-3 mt-5 justify-center md:justify-start">
            <Button 
              variant="secondary" 
              className="font-semibold shadow-lg"
              onClick={() => navigate("/tutor")}
            >
              <Brain className="h-4 w-4 mr-2" />
              Start Learning
            </Button>
            <Button 
              variant="outline"
              className="bg-background/20 border-primary-foreground/30 text-primary-foreground hover:bg-background/30 font-semibold shadow-lg"
              onClick={() => navigate("/exam-prep")}
            >
              <Trophy className="h-4 w-4 mr-2" />
              Practice Quiz
            </Button>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="hidden md:flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center shadow-lg animate-float">
            <BookOpen className="h-10 w-10 text-secondary-foreground" />
          </div>
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center shadow-lg animate-float" style={{ animationDelay: '0.5s' }}>
            <Sparkles className="h-8 w-8 text-accent-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
