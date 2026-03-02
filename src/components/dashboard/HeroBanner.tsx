import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, BookOpen, Brain, Rocket, Stars } from "lucide-react";

export function HeroBanner() {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/95 to-accent p-8 md:p-10 shadow-2xl">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-accent/30 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 animate-pulse-slow" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-secondary/20 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-warning/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2 animate-float" />
        
        {/* Sparkle effects */}
        <Stars className="absolute top-6 right-1/4 h-4 w-4 text-primary-foreground/40 animate-pulse" />
        <Sparkles className="absolute bottom-8 left-1/3 h-3 w-3 text-primary-foreground/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="text-center md:text-left flex-1">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/15 backdrop-blur-sm mb-4 border border-primary-foreground/20">
            <Rocket className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-primary-foreground">Welcome back, Learner!</span>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground font-display mb-3 leading-tight">
            Learn Smart, Grow Faster! 
            <span className="inline-block ml-2 animate-bounce">🚀</span>
          </h2>
          <p className="text-primary-foreground/85 text-base md:text-lg max-w-lg leading-relaxed">
            Complete lessons, earn badges, and climb the leaderboard. Your personalized AI tutor is ready to help you succeed!
          </p>
          
          <div className="flex flex-wrap gap-4 mt-6 justify-center md:justify-start">
            <Button 
              size="lg"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105 px-6"
              onClick={() => navigate("/tutor")}
            >
              <Brain className="h-5 w-5 mr-2" />
              Start Learning
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="bg-primary-foreground/10 border-2 border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/20 hover:border-primary-foreground/60 font-bold shadow-lg transition-all hover:scale-105 px-6"
              onClick={() => navigate("/exam-prep")}
            >
              <Trophy className="h-5 w-5 mr-2" />
              Practice Quiz
            </Button>
          </div>
        </div>
        
        {/* Decorative floating elements */}
        <div className="hidden lg:flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center shadow-2xl animate-float rotate-6">
              <BookOpen className="h-12 w-12 text-secondary-foreground" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-warning flex items-center justify-center shadow-lg animate-bounce">
              <span className="text-sm font-bold text-warning-foreground">✓</span>
            </div>
          </div>
          
          <div className="relative -mt-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-2xl animate-float -rotate-6" style={{ animationDelay: '0.5s' }}>
              <Sparkles className="h-10 w-10 text-accent-foreground" />
            </div>
          </div>
          
          <div className="relative mt-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-warning to-warning/80 flex items-center justify-center shadow-xl animate-float rotate-12" style={{ animationDelay: '1s' }}>
              <Trophy className="h-8 w-8 text-warning-foreground" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
