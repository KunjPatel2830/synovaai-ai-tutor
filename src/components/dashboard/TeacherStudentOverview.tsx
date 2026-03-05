import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StudentProgressReport } from "@/components/progress/StudentProgressReport";
import { Users, TrendingUp, AlertCircle, Flame, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentSummary {
  userId: string;
  name: string;
  streak: number;
  topicsStudied: number;
  avgScore: number;
  helpRequests: number;
  lastActive: string | null;
}

export function TeacherStudentOverview() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user) fetchStudents();
  }, [user]);

  const fetchStudents = async () => {
    if (!user) return;
    try {
      const { data: links } = await externalSupabase
        .from("teacher_student_links")
        .select("student_id")
        .eq("teacher_id", user.id);

      if (!links || links.length === 0) {
        setLoading(false);
        return;
      }

      const studentIds = links.map(l => l.student_id);

      const [profiles, streaks, progress, helpReqs] = await Promise.all([
        externalSupabase.from("profiles").select("user_id, display_name").in("user_id", studentIds),
        externalSupabase.from("learning_streaks").select("user_id, current_streak, last_activity_date").in("user_id", studentIds),
        externalSupabase.from("learning_progress").select("user_id, score, topic").in("user_id", studentIds),
        externalSupabase.from("student_help_requests").select("user_id").in("user_id", studentIds),
      ]);

      const summaries: StudentSummary[] = studentIds.map(sid => {
        const profile = profiles.data?.find(p => p.user_id === sid);
        const streak = streaks.data?.find(s => s.user_id === sid);
        const studentProgress = progress.data?.filter(p => p.user_id === sid) || [];
        const studentHelp = helpReqs.data?.filter(h => h.user_id === sid) || [];
        const avgScore = studentProgress.length > 0
          ? Math.round(studentProgress.reduce((s, p) => s + (p.score || 0), 0) / studentProgress.length)
          : 0;

        return {
          userId: sid,
          name: profile?.display_name || "Student",
          streak: streak?.current_streak || 0,
          topicsStudied: studentProgress.length,
          avgScore,
          helpRequests: studentHelp.length,
          lastActive: streak?.last_activity_date || null,
        };
      });

      setStudents(summaries.sort((a, b) => b.helpRequests - a.helpRequests));
    } catch (error) {
      console.error("Error fetching student data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Student Overview</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Student Overview</h3>
        </div>
        <div className="text-center py-6">
          <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No students linked yet</p>
          <p className="text-xs text-muted-foreground mt-1">Generate an invitation code to connect students</p>
        </div>
      </div>
    );
  }

  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.streak > 0).length;
  const needsHelp = students.filter(s => s.helpRequests > 0).length;

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Student Overview</h3>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-foreground">{totalStudents}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{activeStudents}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30">
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{needsHelp}</p>
            <p className="text-[10px] text-muted-foreground">Need Help</p>
          </div>
        </div>

        {/* Student list */}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {students.map(student => (
            <button
              key={student.userId}
              onClick={() => setSelectedStudent({ id: student.userId, name: student.name })}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {student.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{student.name}</span>
                  {student.streak > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
                      <Flame className="h-3 w-3" />{student.streak}
                    </span>
                  )}
                  {student.helpRequests > 0 && (
                    <AlertCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={student.avgScore} className="h-1 flex-1" />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{student.avgScore}%</span>
                </div>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {selectedStudent && (
        <StudentProgressReport
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          open={!!selectedStudent}
          onOpenChange={(open) => !open && setSelectedStudent(null)}
        />
      )}
    </>
  );
}
