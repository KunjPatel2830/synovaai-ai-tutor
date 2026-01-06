import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { InvitationCodeGenerator } from "@/components/invitation/InvitationCodeGenerator";
import { JoinWithCode } from "@/components/invitation/JoinWithCode";
import { StudentProgressReport } from "@/components/progress/StudentProgressReport";
import { BadgesDisplay } from "@/components/badges/BadgesDisplay";
import { PYQUploader } from "@/components/exam/PYQUploader";
import { PYQUploadHistory } from "@/components/exam/PYQUploadHistory";
import { NeedsHelpTab } from "@/components/exam/NeedsHelpTab";
import {
  Brain,
  FileText,
  ClipboardList,
  Flame,
  TrendingUp,
  BookOpen,
  ArrowRight,
  Calculator,
  FlaskConical,
  Globe,
  Users,
  Link,
  Sparkles,
} from "lucide-react";

interface LearningStreak {
  current_streak: number;
  longest_streak: number;
}

interface LearningProgress {
  topic: string;
  score: number;
  subject_id: string;
}

interface Profile {
  display_name: string | null;
}

export default function Dashboard() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [streak, setStreak] = useState<LearningStreak | null>(null);
  const [recentProgress, setRecentProgress] = useState<LearningProgress[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData);
    }

    // Fetch streak
    const { data: streakData } = await supabase
      .from("learning_streaks")
      .select("current_streak, longest_streak")
      .eq("user_id", user.id)
      .maybeSingle();

    if (streakData) {
      setStreak(streakData);
    }

    // Fetch recent progress
    const { data: progressData } = await supabase
      .from("learning_progress")
      .select("topic, score, subject_id")
      .eq("user_id", user.id)
      .order("last_studied_at", { ascending: false })
      .limit(5);

    if (progressData) {
      setRecentProgress(progressData);
    }
  };

  const quickActions = [
    {
      title: "AI Tutor",
      description: "Learn any topic with adaptive AI guidance",
      icon: Brain,
      color: "primary",
      path: "/tutor",
    },
    {
      title: "Homework Help",
      description: "Get step-by-step explanations",
      icon: FileText,
      color: "secondary",
      path: "/homework",
    },
    {
      title: "Exam Prep",
      description: "Practice with personalized quizzes",
      icon: ClipboardList,
      color: "accent",
      path: "/exam-prep",
    },
  ];

  const subjectIcons: { [key: string]: React.ElementType } = {
    Mathematics: Calculator,
    Science: FlaskConical,
    "Language Arts": BookOpen,
    "Social Studies": Globe,
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Learner";

  if (userRole === "teacher") {
    return <TeacherDashboard />;
  }

  if (userRole === "caregiver") {
    return <CaregiverDashboard />;
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold font-display text-primary">
              Welcome back, {displayName}!
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Ready to continue your learning journey?
            </p>
          </div>

          {/* Streak Card */}
          {streak && (
            <GlassCard className="flex items-center gap-4 px-6 py-4 animate-slide-up">
              <div className="h-14 w-14 rounded-2xl bg-warning flex items-center justify-center shadow-lg">
                <Flame className="h-7 w-7 text-warning-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold font-display text-foreground">
                  {streak.current_streak} days
                </p>
                <p className="text-sm text-muted-foreground">Current streak</p>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            const colorClasses = {
              primary: "bg-primary shadow-primary/20",
              secondary: "bg-secondary shadow-secondary/20",
              accent: "bg-accent shadow-accent/20",
            };
            return (
              <GlassCard
                key={action.title}
                variant="elevated"
                className="cursor-pointer group hover:scale-[1.02] transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => navigate(action.path)}
              >
                <GlassCardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        "h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 duration-300",
                        colorClasses[action.color as keyof typeof colorClasses]
                      )}
                    >
                      <Icon className="h-7 w-7 text-background" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                  <h3 className="text-xl font-semibold font-display text-foreground mt-5">
                    {action.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {action.description}
                  </p>
                </GlassCardContent>
              </GlassCard>
            );
          })}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Progress */}
          <GlassCard variant="elevated" className="animate-slide-up" style={{ animationDelay: '300ms' }}>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                Recent Progress
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              {recentProgress.length > 0 ? (
                <div className="space-y-5">
                  {recentProgress.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          {item.topic}
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          {item.score}%
                        </span>
                      </div>
                      <Progress value={item.score || 0} className="h-2.5" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No progress yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Start learning to track your progress</p>
                  <Button
                    variant="default"
                    className="mt-5"
                    onClick={() => navigate("/tutor")}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start Learning
                  </Button>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Achievements / Badges */}
          <BadgesDisplay />
        </div>

        {/* Join with Code Section */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Connect with Teacher or Caregiver
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            {user && <JoinWithCode />}
          </GlassCardContent>
        </GlassCard>
      </div>
    </AppLayout>
  );
}

// Teacher Dashboard Component
function TeacherDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"students" | "pyq" | "help">("students");

  useEffect(() => {
    if (user) {
      fetchStudents();
    }
  }, [user]);

  const fetchStudents = async () => {
    if (!user) return;

    const { data: links } = await supabase
      .from("teacher_student_links")
      .select("student_id")
      .eq("teacher_id", user.id);

    if (links && links.length > 0) {
      const studentIds = links.map(l => l.student_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", studentIds);

      if (profiles) {
        setStudents(profiles.map(p => ({
          student_id: p.user_id,
          display_name: p.display_name
        })));
      }
    }
  };

  const studentIds = students.map(s => s.student_id);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your students' learning progress
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-border pb-2">
          <Button
            variant={activeTab === "students" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("students")}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            My Students
          </Button>
          <Button
            variant={activeTab === "pyq" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("pyq")}
            className="gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            PYQ Management
          </Button>
          <Button
            variant={activeTab === "help" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("help")}
            className="gap-2"
          >
            <Brain className="h-4 w-4" />
            Needs Help
          </Button>
        </div>

        {/* Students Tab */}
        {activeTab === "students" && (
          <>
            {/* Invitation Code Section */}
            <GlassCard>
              <GlassCardHeader className="flex flex-row items-center justify-between">
                <GlassCardTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5 text-primary" />
                  Invite Students
                </GlassCardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowInvite(!showInvite)}>
                  {showInvite ? "Hide" : "Show Codes"}
                </Button>
              </GlassCardHeader>
              {showInvite && user && (
                <GlassCardContent>
                  <InvitationCodeGenerator userId={user.id} inviterRole="teacher" />
                </GlassCardContent>
              )}
            </GlassCard>

            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle>My Students ({students.length})</GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent>
                {students.length > 0 ? (
                  <div className="space-y-4">
                    {students.map((student) => (
                      <div
                        key={student.student_id}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                      >
                        <span className="font-medium">
                          {student.display_name || "Student"}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedStudent({
                            id: student.student_id,
                            name: student.display_name || "Student"
                          })}
                        >
                          View Progress
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No students linked yet</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Generate an invitation code above and share it with your students
                    </p>
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>
          </>
        )}

        {/* PYQ Management Tab */}
        {activeTab === "pyq" && user && (
          <div className="space-y-6">
            <PYQUploader userId={user.id} onUploadComplete={() => {}} />
            <PYQUploadHistory userId={user.id} />
          </div>
        )}

        {/* Needs Help Tab */}
        {activeTab === "help" && (
          <NeedsHelpTab linkedStudentIds={studentIds} />
        )}
      </div>

      {selectedStudent && (
        <StudentProgressReport
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          open={!!selectedStudent}
          onOpenChange={(open) => !open && setSelectedStudent(null)}
        />
      )}
    </AppLayout>
  );
}

// Caregiver Dashboard Component
function CaregiverDashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [selectedChild, setSelectedChild] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchChildren();
    }
  }, [user]);

  const fetchChildren = async () => {
    if (!user) return;

    const { data: links } = await supabase
      .from("caregiver_student_links")
      .select("student_id")
      .eq("caregiver_id", user.id);

    if (links && links.length > 0) {
      const studentIds = links.map(l => l.student_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", studentIds);

      if (profiles) {
        setChildren(profiles.map(p => ({
          student_id: p.user_id,
          display_name: p.display_name
        })));
      }
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Caregiver Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track your child's learning journey
          </p>
        </div>

        {/* Invitation Code Section */}
        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between">
            <GlassCardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Invite Your Child
            </GlassCardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowInvite(!showInvite)}>
              {showInvite ? "Hide" : "Show Codes"}
            </Button>
          </GlassCardHeader>
          {showInvite && user && (
            <GlassCardContent>
              <InvitationCodeGenerator userId={user.id} inviterRole="caregiver" />
            </GlassCardContent>
          )}
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>My Children ({children.length})</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            {children.length > 0 ? (
              <div className="space-y-4">
                {children.map((child) => (
                  <div
                    key={child.student_id}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                  >
                    <span className="font-medium">
                      {child.display_name || "Child"}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedChild({
                        id: child.student_id,
                        name: child.display_name || "Child"
                      })}
                    >
                      View Progress
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No children linked yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Generate an invitation code above and share it with your child
                </p>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>
      </div>

      {selectedChild && (
        <StudentProgressReport
          studentId={selectedChild.id}
          studentName={selectedChild.name}
          open={!!selectedChild}
          onOpenChange={(open) => !open && setSelectedChild(null)}
        />
      )}
    </AppLayout>
  );
}
