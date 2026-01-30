import { Button } from "@/components/ui/button";
import { Gift, Sparkles } from "lucide-react";

export function HeroBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-6 md:p-8">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <h2 className="text-2xl md:text-3xl font-bold text-white font-display mb-2">
            Learn, Play and Earn Free Gifts!
          </h2>
          <p className="text-white/90 text-sm md:text-base max-w-md">
            Challenge your friends in quiz games and increase rank points to get exclusive prizes from us
          </p>
          <div className="flex flex-wrap gap-3 mt-5 justify-center md:justify-start">
            <Button 
              variant="secondary" 
              className="bg-white text-emerald-600 hover:bg-white/90 font-semibold shadow-lg"
            >
              <Gift className="h-4 w-4 mr-2" />
              View Rewards
            </Button>
            <Button 
              className="bg-emerald-700 text-white hover:bg-emerald-800 font-semibold shadow-lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Get Started
            </Button>
          </div>
        </div>
        
        {/* Illustration placeholder - decorative elements */}
        <div className="hidden md:flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg animate-float">
            <Gift className="h-10 w-10 text-yellow-700" />
          </div>
          <div className="w-16 h-16 rounded-full bg-orange-400 flex items-center justify-center shadow-lg animate-float" style={{ animationDelay: '0.5s' }}>
            <Sparkles className="h-8 w-8 text-orange-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
