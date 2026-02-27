import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { Progress } from "@/components/ui/progress";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubjectProgress {
  subject: string;
  avgScore: number;
  count: number;
}

export function SubjectProgressWidget() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectProgress[]>([]);

  useEffect(() => {
    if (user) fetchProgress();
  }, [user]);

  const fetchProgress = async () => {
    if (!user) return;

    const { data } = await externalSupabase
      .from("chat_sessions")
      .select("subject")
      .eq("user_id", user.id)
      .not("subject", "is", null);

    if (data) {
      const subjectMap: Record<string, number> = {};
      data.forEach((s) => {
        if (s.subject) subjectMap[s.subject] = (subjectMap[s.subject] || 0) + 1;
      });

      const total = Object.values(subjectMap).reduce((a, b) => a + b, 0);
      const result = Object.entries(subjectMap)
        .map(([subject, count]) => ({
          subject,
          avgScore: Math.round((count / total) * 100),
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setSubjects(result);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Subject Focus</h3>
      </div>

      {subjects.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Start studying to see your subject breakdown!</p>
      ) : (
        <div className="space-y-3">
          {subjects.map((s) => (
            <div key={s.subject} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground capitalize">{s.subject}</span>
                <span className="text-xs text-muted-foreground">{s.count} sessions</span>
              </div>
              <Progress value={s.avgScore} className="h-1.5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
