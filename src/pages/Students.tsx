import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Award, Plus, Loader2 } from "lucide-react";
import { InvitationCodeGenerator } from "@/components/invitation/InvitationCodeGenerator";
import { StudentProgressReport } from "@/components/progress/StudentProgressReport";

interface StudentData {
  student_id: string;
  profile: {
    display_name: string | null;
    grade_level: string | null;
  } | null;
  streak: {
    current_streak: number;
    longest_streak: number;
  } | null;
}

export default function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);

  useEffect(() => {
    if (user) {
      fetchStudents();
    }
  }, [user]);

  const fetchStudents = async () => {
    try {
      const { data: links, error } = await supabase
        .from("teacher_student_links")
        .select("student_id")
        .eq("teacher_id", user?.id);

      if (error) throw error;

      if (links && links.length > 0) {
        const studentsData: StudentData[] = [];

        for (const link of links) {
          const [profileRes, streakRes] = await Promise.all([
            supabase
              .from("profiles")
              .select("display_name, grade_level")
              .eq("user_id", link.student_id)
              .single(),
            supabase
              .from("learning_streaks")
              .select("current_streak, longest_streak")
              .eq("user_id", link.student_id)
              .single(),
          ]);

          studentsData.push({
            student_id: link.student_id,
            profile: profileRes.data,
            streak: streakRes.data,
          });
        }

        setStudents(studentsData);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Students</h1>
            <p className="text-muted-foreground">Monitor your students' learning progress</p>
          </div>
          <Button onClick={() => setShowAddStudent(!showAddStudent)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
        </div>

        {showAddStudent && user && (
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle>Invite a Student</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate an invitation code and share it with your student to link their account.
              </p>
              <InvitationCodeGenerator userId={user.id} inviterRole="teacher" />
            </GlassCardContent>
          </GlassCard>
        )}

        {students.length === 0 ? (
          <GlassCard>
            <GlassCardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Students Yet</h3>
              <p className="text-muted-foreground mb-4">
                Invite students to join your class and track their progress.
              </p>
              <Button onClick={() => setShowAddStudent(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Student
              </Button>
            </GlassCardContent>
          </GlassCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => (
              <GlassCard
                key={student.student_id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedStudent(student)}
              >
                <GlassCardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {student.profile?.display_name || "Student"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {student.profile?.grade_level || "Grade not set"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Current Streak</p>
                        <p className="font-semibold text-foreground">
                          {student.streak?.current_streak || 0} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Best Streak</p>
                        <p className="font-semibold text-foreground">
                          {student.streak?.longest_streak || 0} days
                        </p>
                      </div>
                    </div>
                  </div>
                </GlassCardContent>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {selectedStudent && (
        <StudentProgressReport
          studentId={selectedStudent.student_id}
          studentName={selectedStudent.profile?.display_name || "Student"}
          open={!!selectedStudent}
          onOpenChange={(open) => !open && setSelectedStudent(null)}
        />
      )}
    </AppLayout>
  );
}
