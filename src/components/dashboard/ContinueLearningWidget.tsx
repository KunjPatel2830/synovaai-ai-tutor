import { useNavigate } from "react-router-dom";
import { useLearningHistory, LearningRecommendation } from "@/hooks/useLearningHistory";
import { ArrowRight, BookOpen, RefreshCw, Target, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const typeConfig: Record<string, { icon: typeof BookOpen; label: string; color: string }> = {
  continue: { icon: BookOpen, label: "Continue", color: "bg-primary/10 text-primary" },
  practice: { icon: Target, label: "Practice", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  revision: { icon: RefreshCw, label: "Revision", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
};

export function ContinueLearningWidget() {
  const { recommendations, isLoading } = useLearningHistory();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  const handleClick = (rec: LearningRecommendation) => {
    // Navigate to appropriate mode with topic context
    if (rec.type === "continue" || rec.type === "practice") {
      navigate("/tutor", { state: { initialQuery: `Help me with ${rec.topic} in ${rec.subject}` } });
    } else {
      navigate("/tutor", { state: { initialQuery: `Quick revision of ${rec.topic} in ${rec.subject}` } });
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Recommended for You
        </h3>
      </div>
      <div className="space-y-2">
        {recommendations.map((rec, i) => {
          const config = typeConfig[rec.type] || typeConfig.continue;
          const Icon = config.icon;
          return (
            <button
              key={i}
              onClick={() => handleClick(rec)}
              className="w-full flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-all duration-200 text-left group"
            >
              <div className={`h-9 w-9 rounded-lg ${config.color} flex items-center justify-center shrink-0 mt-0.5`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{rec.subject}</span>
                </div>
                <p className="text-sm text-foreground leading-snug line-clamp-2">
                  {rec.message}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
