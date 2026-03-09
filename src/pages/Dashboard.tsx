import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Clock,
  AlertCircle,
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
    const { data: profileData } = await externalSupabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData);
    }

    // Fetch streak
    const { data: streakData } = await externalSupabase
      .from("learning_streaks")
      .select("current_streak, longest_streak")
      .eq("user_id", user.id)
      .maybeSingle();

    if (streakData) {
      setStreak(streakData);
    }

    // Fetch recent progress
    const { data: progressData } = await externalSupabase
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

    const { data: links } = await externalSupabase
      .from("teacher_student_links")
      .select("student_id")
      .eq("teacher_id", user.id);

    if (links && links.length > 0) {
      const studentIds = links.map(l => l.student_id);
      const { data: profiles } = await externalSupabase
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
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [childData, setChildData] = useState<Record<string, any>>({});
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (user) {
      fetchChildren();
    }
  }, [user]);

  const fetchChildren = async () => {
    if (!user) return;

    const { data: links } = await externalSupabase
      .from("caregiver_student_links")
      .select("student_id")
      .eq("caregiver_id", user.id);

    if (links && links.length > 0) {
      const studentIds = links.map(l => l.student_id);
      const { data: profiles } = await externalSupabase
        .from("profiles")
        .select("user_id, display_name, grade_level, curriculum, standard")
        .in("user_id", studentIds);

      if (profiles) {
        const childList = profiles.map(p => ({
          student_id: p.user_id,
          display_name: p.display_name,
          grade_level: p.grade_level,
          curriculum: p.curriculum,
          standard: p.standard,
        }));
        setChildren(childList);
        // Auto-select first child
        if (childList.length > 0 && !selectedChild) {
          setSelectedChild(childList[0].student_id);
        }
        // Fetch data for all children
        for (const child of childList) {
          fetchChildData(child.student_id);
        }
      }
    }
  };

  const fetchChildData = async (studentId: string) => {
    setLoadingData(true);
    const [streakRes, progressRes, historyRes, helpRes, teacherLinksRes] = await Promise.all([
      externalSupabase
        .from("learning_streaks")
        .select("current_streak, longest_streak, last_activity_date")
        .eq("user_id", studentId)
        .maybeSingle(),
      externalSupabase
        .from("learning_progress")
        .select("topic, score, mastered, attempts, last_studied_at, difficulty_level")
        .eq("user_id", studentId)
        .order("last_studied_at", { ascending: false }),
      externalSupabase
        .from("learning_history")
        .select("subject, topic, mode, status, session_duration_seconds, created_at, difficulty")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false })
        .limit(50),
      externalSupabase
        .from("student_help_requests")
        .select("subject, topic, question, mode, created_at")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false })
        .limit(20),
      externalSupabase
        .from("teacher_student_links")
        .select("teacher_id")
        .eq("student_id", studentId),
    ]);

    // Fetch teacher profiles if any
    let teachers: any[] = [];
    if (teacherLinksRes.data && teacherLinksRes.data.length > 0) {
      const teacherIds = teacherLinksRes.data.map(t => t.teacher_id);
      const { data: teacherProfiles } = await externalSupabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", teacherIds);
      teachers = teacherProfiles || [];
    }

    // Calculate total study hours from learning_history
    const totalSeconds = (historyRes.data || []).reduce(
      (sum: number, h: any) => sum + (h.session_duration_seconds || 0), 0
    );
    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;

    // Calculate today's study time
    const today = new Date().toISOString().split("T")[0];
    const todaySeconds = (historyRes.data || [])
      .filter((h: any) => h.created_at?.startsWith(today))
      .reduce((sum: number, h: any) => sum + (h.session_duration_seconds || 0), 0);
    const todayHours = Math.round((todaySeconds / 3600) * 10) / 10;

    // Find weak topics (low score, many attempts)
    const weakTopics = (progressRes.data || [])
      .filter((p: any) => (p.score || 0) < 50 && (p.attempts || 0) >= 2)
      .sort((a: any, b: any) => (a.score || 0) - (b.score || 0))
      .slice(0, 5);

    // Subjects studied
    const subjectSet = new Set((historyRes.data || []).map((h: any) => h.subject));

    setChildData(prev => ({
      ...prev,
      [studentId]: {
        streak: streakRes.data,
        progress: progressRes.data || [],
        history: historyRes.data || [],
        helpRequests: helpRes.data || [],
        teachers,
        totalHours,
        todayHours,
        weakTopics,
        subjects: Array.from(subjectSet),
        masteredCount: (progressRes.data || []).filter((p: any) => p.mastered).length,
        avgScore: (progressRes.data || []).length > 0
          ? Math.round((progressRes.data || []).reduce((s: number, p: any) => s + (p.score || 0), 0) / (progressRes.data || []).length)
          : 0,
      }
    }));
    setLoadingData(false);
  };

  const activeChild = children.find(c => c.student_id === selectedChild);
  const data = selectedChild ? childData[selectedChild] : null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-display text-primary">Parent Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Complete overview of your child's learning journey
          </p>
        </div>

        {/* Invitation Code Section */}
        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between">
            <GlassCardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Link Your Child
            </GlassCardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowInvite(!showInvite)}>
              {showInvite ? "Hide" : "Generate Code"}
            </Button>
          </GlassCardHeader>
          {showInvite && user && (
            <GlassCardContent>
              <InvitationCodeGenerator userId={user.id} inviterRole="caregiver" />
            </GlassCardContent>
          )}
        </GlassCard>

        {children.length === 0 ? (
          <GlassCard>
            <GlassCardContent className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">No children linked yet</p>
              <p className="text-muted-foreground mt-2">
                Generate an invitation code above and share it with your child to start monitoring their progress
              </p>
            </GlassCardContent>
          </GlassCard>
        ) : (
          <>
            {/* Child Selector (if multiple) */}
            {children.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {children.map(child => (
                  <Button
                    key={child.student_id}
                    variant={selectedChild === child.student_id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedChild(child.student_id)}
                  >
                    {child.display_name || "Child"}
                  </Button>
                ))}
              </div>
            )}

            {data && activeChild ? (
              <>
                {/* Child Info Bar */}
                <GlassCard>
                  <GlassCardContent className="py-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <h2 className="text-xl font-bold text-foreground">{activeChild.display_name || "Child"}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {activeChild.grade_level && <Badge variant="secondary">{activeChild.grade_level}</Badge>}
                          {activeChild.curriculum && <Badge variant="outline">{activeChild.curriculum}</Badge>}
                          {activeChild.standard && <Badge variant="outline">Class {activeChild.standard}</Badge>}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Last active: {formatTimeAgo(data.streak?.last_activity_date)}
                      </div>
                    </div>
                  </GlassCardContent>
                </GlassCard>

                {/* Key Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <span className="text-xs text-muted-foreground">Streak</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{data.streak?.current_streak || 0}</p>
                    <p className="text-xs text-muted-foreground">days</p>
                  </GlassCard>

                  <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <span className="text-xs text-muted-foreground">Today</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{data.todayHours}</p>
                    <p className="text-xs text-muted-foreground">hours studied</p>
                  </GlassCard>

                  <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-accent" />
                      <span className="text-xs text-muted-foreground">Total</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{data.totalHours}</p>
                    <p className="text-xs text-muted-foreground">hours total</p>
                  </GlassCard>

                  <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <span className="text-xs text-muted-foreground">Avg Score</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{data.avgScore}%</p>
                    <p className="text-xs text-muted-foreground">across topics</p>
                  </GlassCard>

                  <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <span className="text-xs text-muted-foreground">Mastered</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{data.masteredCount}</p>
                    <p className="text-xs text-muted-foreground">topics</p>
                  </GlassCard>

                  <GlassCard className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      <span className="text-xs text-muted-foreground">Needs Help</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{data.helpRequests.length}</p>
                    <p className="text-xs text-muted-foreground">requests</p>
                  </GlassCard>
                </div>

                {/* Detailed Tabs */}
                <Tabs defaultValue="struggling" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="struggling" className="text-xs sm:text-sm">
                      <AlertCircle className="h-3 w-3 mr-1" /> Struggling
                    </TabsTrigger>
                    <TabsTrigger value="progress" className="text-xs sm:text-sm">
                      <TrendingUp className="h-3 w-3 mr-1" /> Progress
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs sm:text-sm">
                      <Clock className="h-3 w-3 mr-1" /> Activity
                    </TabsTrigger>
                    <TabsTrigger value="teachers" className="text-xs sm:text-sm">
                      <Users className="h-3 w-3 mr-1" /> Teachers
                    </TabsTrigger>
                  </TabsList>

                  {/* Struggling Topics Tab */}
                  <TabsContent value="struggling" className="mt-4 space-y-4">
                    <GlassCard>
                      <GlassCardHeader>
                        <GlassCardTitle className="text-base">Where Your Child is Stuck</GlassCardTitle>
                      </GlassCardHeader>
                      <GlassCardContent>
                        {data.weakTopics.length > 0 ? (
                          <div className="space-y-3">
                            {data.weakTopics.map((topic: any, i: number) => (
                              <div key={i} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-foreground">{topic.topic}</span>
                                  <Badge variant="destructive" className="text-xs">{topic.score || 0}%</Badge>
                                </div>
                                <Progress value={topic.score || 0} className="h-2" />
                                <p className="text-xs text-muted-foreground mt-1">
                                  {topic.attempts || 0} attempts • Last studied: {formatDate(topic.last_studied_at)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-6">
                            No struggling topics found — your child is doing great! 🎉
                          </p>
                        )}
                      </GlassCardContent>
                    </GlassCard>

                    {/* Help Requests */}
                    <GlassCard>
                      <GlassCardHeader>
                        <GlassCardTitle className="text-base">Recent Help Requests</GlassCardTitle>
                      </GlassCardHeader>
                      <GlassCardContent>
                        {data.helpRequests.length > 0 ? (
                          <div className="space-y-3">
                            {data.helpRequests.slice(0, 10).map((req: any, i: number) => (
                              <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                                <p className="text-sm font-medium text-foreground line-clamp-2">{req.question}</p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs">{req.subject}</Badge>
                                  {req.topic && <Badge variant="secondary" className="text-xs">{req.topic}</Badge>}
                                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(req.created_at)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-6">No help requests yet</p>
                        )}
                      </GlassCardContent>
                    </GlassCard>
                  </TabsContent>

                  {/* Progress Tab */}
                  <TabsContent value="progress" className="mt-4">
                    <GlassCard>
                      <GlassCardHeader>
                        <GlassCardTitle className="text-base">Topic Progress ({data.progress.length} topics)</GlassCardTitle>
                      </GlassCardHeader>
                      <GlassCardContent>
                        {data.progress.length > 0 ? (
                          <div className="space-y-3">
                            {data.progress.slice(0, 15).map((item: any, i: number) => (
                              <div key={i} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-foreground">
                                    {item.topic} {item.mastered && "⭐"}
                                  </span>
                                  <span className="text-sm font-semibold text-primary">{item.score || 0}%</span>
                                </div>
                                <Progress value={item.score || 0} className="h-2" />
                                <p className="text-xs text-muted-foreground">
                                  {item.attempts || 0} attempts • {formatDate(item.last_studied_at)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-6">No progress data yet</p>
                        )}
                      </GlassCardContent>
                    </GlassCard>
                  </TabsContent>

                  {/* Activity Tab */}
                  <TabsContent value="activity" className="mt-4">
                    <GlassCard>
                      <GlassCardHeader>
                        <GlassCardTitle className="text-base">Recent Study Sessions</GlassCardTitle>
                      </GlassCardHeader>
                      <GlassCardContent>
                        {data.history.length > 0 ? (
                          <div className="space-y-3">
                            {data.history.slice(0, 20).map((session: any, i: number) => {
                              const mins = Math.round((session.session_duration_seconds || 0) / 60);
                              return (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">
                                      {session.topic || session.subject}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs capitalize">{session.mode}</Badge>
                                      <Badge variant="secondary" className="text-xs">{session.subject}</Badge>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-foreground">
                                      {mins > 0 ? `${mins} min` : "<1 min"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{formatDate(session.created_at)}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-6">No study sessions yet</p>
                        )}
                      </GlassCardContent>
                    </GlassCard>

                    {/* Subjects Overview */}
                    <GlassCard className="mt-4">
                      <GlassCardHeader>
                        <GlassCardTitle className="text-base">Subjects Studied</GlassCardTitle>
                      </GlassCardHeader>
                      <GlassCardContent>
                        <div className="flex flex-wrap gap-2">
                          {data.subjects.map((subject: string, i: number) => (
                            <Badge key={i} variant="secondary" className="px-3 py-1">{subject}</Badge>
                          ))}
                          {data.subjects.length === 0 && (
                            <p className="text-muted-foreground">No subjects studied yet</p>
                          )}
                        </div>
                      </GlassCardContent>
                    </GlassCard>
                  </TabsContent>

                  {/* Teachers Tab */}
                  <TabsContent value="teachers" className="mt-4">
                    <GlassCard>
                      <GlassCardHeader>
                        <GlassCardTitle className="text-base">Connected Teachers</GlassCardTitle>
                      </GlassCardHeader>
                      <GlassCardContent>
                        {data.teachers.length > 0 ? (
                          <div className="space-y-3">
                            {data.teachers.map((teacher: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{teacher.display_name || "Teacher"}</p>
                                  <p className="text-xs text-muted-foreground">Connected teacher</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                            <p className="text-muted-foreground">No teachers connected yet</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Your child can connect with a teacher using an invitation code
                            </p>
                          </div>
                        )}
                      </GlassCardContent>
                    </GlassCard>
                  </TabsContent>
                </Tabs>
              </>
            ) : loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </AppLayout>
  );
}
