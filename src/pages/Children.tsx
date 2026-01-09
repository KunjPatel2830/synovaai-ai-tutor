import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Award, Plus, Loader2 } from "lucide-react";
import { InvitationCodeGenerator } from "@/components/invitation/InvitationCodeGenerator";
import { StudentProgressReport } from "@/components/progress/StudentProgressReport";

interface ChildData {
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

export default function Children() {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [selectedChild, setSelectedChild] = useState<ChildData | null>(null);

  useEffect(() => {
    if (user) {
      fetchChildren();
    }
  }, [user]);

  const fetchChildren = async () => {
    try {
      const { data: links, error } = await externalSupabase
        .from("caregiver_student_links")
        .select("student_id")
        .eq("caregiver_id", user?.id);

      if (error) throw error;

      if (links && links.length > 0) {
        const childrenData: ChildData[] = [];

        for (const link of links) {
          const [profileRes, streakRes] = await Promise.all([
            externalSupabase
              .from("profiles")
              .select("display_name, grade_level")
              .eq("user_id", link.student_id)
              .single(),
            externalSupabase
              .from("learning_streaks")
              .select("current_streak, longest_streak")
              .eq("user_id", link.student_id)
              .single(),
          ]);

          childrenData.push({
            student_id: link.student_id,
            profile: profileRes.data,
            streak: streakRes.data,
          });
        }

        setChildren(childrenData);
      }
    } catch (error) {
      console.error("Error fetching children:", error);
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
            <h1 className="text-2xl font-bold text-foreground">My Children</h1>
            <p className="text-muted-foreground">Monitor your children's learning progress</p>
          </div>
          <Button onClick={() => setShowAddChild(!showAddChild)}>
            <Plus className="h-4 w-4 mr-2" />
            Link Child
          </Button>
        </div>

        {showAddChild && user && (
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle>Link Your Child's Account</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate an invitation code and share it with your child to link their account.
              </p>
              <InvitationCodeGenerator userId={user.id} inviterRole="caregiver" />
            </GlassCardContent>
          </GlassCard>
        )}

        {children.length === 0 ? (
          <GlassCard>
            <GlassCardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Children Linked</h3>
              <p className="text-muted-foreground mb-4">
                Link your child's account to monitor their learning progress.
              </p>
              <Button onClick={() => setShowAddChild(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Link Child
              </Button>
            </GlassCardContent>
          </GlassCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <GlassCard
                key={child.student_id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedChild(child)}
              >
                <GlassCardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {child.profile?.display_name || "Student"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {child.profile?.grade_level || "Grade not set"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Current Streak</p>
                        <p className="font-semibold text-foreground">
                          {child.streak?.current_streak || 0} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Best Streak</p>
                        <p className="font-semibold text-foreground">
                          {child.streak?.longest_streak || 0} days
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

      {selectedChild && (
        <StudentProgressReport
          studentId={selectedChild.student_id}
          studentName={selectedChild.profile?.display_name || "Student"}
          open={!!selectedChild}
          onOpenChange={(open) => !open && setSelectedChild(null)}
        />
      )}
    </AppLayout>
  );
}
