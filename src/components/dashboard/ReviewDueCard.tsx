import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { Brain, Loader2 } from "lucide-react";

export function ReviewDueCard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ dueCount: 0, totalCount: 0, masteredCount: 0 });

  useEffect(() => {
    let active = true;
    invokeBackendFunction<typeof stats>("review-queue", { action: "stats" }, {
      label: "review-stats",
      timeoutMs: 15000,
    }).then((res) => {
      if (!active) return;
      if (res.ok && res.data) setStats(res.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <GlassCard className="hover:shadow-lg transition-shadow">
      <GlassCardContent className="p-5 flex items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">Spaced revision</p>
          <p className="text-xs text-muted-foreground">
            {loading ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking your deck…
              </span>
            ) : stats.dueCount > 0 ? (
              `${stats.dueCount} card${stats.dueCount === 1 ? "" : "s"} due today`
            ) : stats.totalCount > 0 ? (
              `All caught up • ${stats.masteredCount} mastered`
            ) : (
              "Build a deck that revises itself"
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/review")}>
          {stats.dueCount > 0 ? "Review" : "Open"}
        </Button>
      </GlassCardContent>
    </GlassCard>
  );
}
