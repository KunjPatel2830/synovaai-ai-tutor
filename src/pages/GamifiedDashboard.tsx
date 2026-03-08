import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { externalSupabase } from "@/lib/external-supabase";
import { Brain, BookOpen, FileText, ClipboardList, ArrowRight, Flame, Search, MessageSquare, Zap, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

import { StatsCards } from "@/components/dashboard/StatsCards";
import { DailyQuestSection } from "@/components/dashboard/DailyQuestSection";
import { WeeklyActivityWidget } from "@/components/dashboard/WeeklyActivityWidget";
import { StudyStreakCalendar } from "@/components/dashboard/StudyStreakCalendar";
import { SubjectProgressWidget } from "@/components/dashboard/SubjectProgressWidget";
import { LeaderboardSection } from "@/components/dashboard/LeaderboardSection";
import { BadgesDisplay } from "@/components/badges/BadgesDisplay";
import { QuickNotesWidget } from "@/components/dashboard/QuickNotesWidget";
import { JoinWithCode } from "@/components/invitation/JoinWithCode";
import { UserOverview } from "@/components/dashboard/UserOverview";
import { TeacherChatWidget } from "@/components/dashboard/TeacherChatWidget";

const mainModes = [
  {
    id: "tutor",
    title: "AI Tutor",
    description: "General doubt solving & concept explanations",
    detail: "Your personal AI teacher for any topic",
    icon: Brain,
    path: "/tutor",
  },
  {
    id: "curriculum",
    title: "Curriculum Study",
    description: "Structured chapter-wise learning",
    detail: "NCERT-aligned subject guidance",
    icon: BookOpen,
    path: "/curriculum-study",
  },
  {
    id: "homework",
    title: "Homework Help",
    description: "Step-by-step guided solving",
    detail: "Understand, don't just copy",
    icon: FileText,
    path: "/homework",
  },
  {
    id: "exam",
    title: "Exam Prep",
    description: "PYQ solving & practice questions",
    detail: "JEE, NEET & board revision",
    icon: ClipboardList,
    path: "/exam-prep",
  },
];

interface RecentSession {
  id: string;
  mode: string;
  subject: string | null;
  topic: string | null;
  created_at: string;
}

const modeLabels: Record<string, string> = {
  tutor: "AI Tutor",
  curriculum: "Curriculum",
  homework: "Homework",
  exam: "Exam Prep",
  doubt: "Doubt Solver",
  voice: "Voice Tutor",
};

export default function GamifiedDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("Learner");
  const [streak, setStreak] = useState(0);
  const [questionsSolved, setQuestionsSolved] = useState(0);
  const [todayUsage, setTodayUsage] = useState(0);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [profileRes, streakRes, sessionsRes, todayRes, recentRes, homeworkTotalRes, homeworkTodayRes] = await Promise.all([
      externalSupabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
      externalSupabase.from("learning_streaks").select("current_streak").eq("user_id", user.id).maybeSingle(),
      externalSupabase.from("chat_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      externalSupabase.from("chat_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", today.toISOString()),
      externalSupabase.from("chat_sessions").select("id, mode, subject, topic, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
      externalSupabase.from("homework_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      externalSupabase.from("homework_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", today.toISOString()),
    ]);

    if (profileRes.data?.display_name) setDisplayName(profileRes.data.display_name);
    else if (user.email) setDisplayName(user.email.split("@")[0]);
    setStreak(streakRes.data?.current_streak || 0);
    setQuestionsSolved((sessionsRes.count || 0) + (homeworkTotalRes.count || 0));
    setTodayUsage((todayRes.count || 0) + (homeworkTodayRes.count || 0));
    if (recentRes.data) setRecentSessions(recentRes.data);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate("/tutor", { state: { initialQuery: searchQuery.trim() } });
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
    }),
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-12 px-2">

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="pt-4 space-y-5"
        >
          {/* Top Row: Welcome + Streak + Usage */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Welcome back</p>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">
                {displayName}
              </h1>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Streak */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold text-foreground">{streak} day{streak !== 1 ? "s" : ""}</span>
              </div>
              {/* Questions solved */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{questionsSolved} solved</span>
              </div>
              {/* Daily usage */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border">
                <Zap className="h-4 w-4 text-primary" />
                <div className="w-20 h-1.5 rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min((todayUsage / 50) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-foreground">{todayUsage}/50</span>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative group">
            <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl group-focus-within:bg-primary/10 transition-all duration-300" />
            <div className="relative flex items-center rounded-2xl border-2 border-border bg-card shadow-sm group-focus-within:border-primary/40 group-focus-within:shadow-md transition-all duration-300">
              <Search className="h-5 w-5 text-muted-foreground ml-5 shrink-0" />
              <input
                type="text"
                placeholder="What do you want to understand today?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="flex-1 bg-transparent border-none outline-none px-4 py-4 md:py-5 text-base md:text-lg text-foreground placeholder:text-muted-foreground/60"
              />
              {searchQuery.trim() && (
                <button
                  onClick={handleSearch}
                  className="mr-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Ask
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* My Progress */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12, duration: 0.5 }}>
          <UserOverview />
        </motion.div>

        {/* Stats Row */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18, duration: 0.5 }}>
          <StatsCards />
        </motion.div>

        {/* 4 Main Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mainModes.map((mode, i) => {
            const Icon = mode.icon;
            return (
              <motion.div
                key={mode.id}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                onClick={() => navigate(mode.path)}
                className={cn(
                  "group relative rounded-2xl border border-border bg-card p-6 cursor-pointer",
                  "transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:-translate-y-1",
                  "backdrop-blur-sm"
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">{mode.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{mode.description}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{mode.detail}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Recent Doubts + Daily Goals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Doubts</h3>
            {recentSessions.length > 0 ? (
              <div className="space-y-2">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => navigate(`/${session.mode === "exam" ? "exam-prep" : session.mode}`)}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-muted/50 cursor-pointer transition-all duration-200 group"
                  >
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {session.topic || session.subject || modeLabels[session.mode] || "Chat"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {modeLabels[session.mode] || session.mode} · {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-6 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recent sessions yet</p>
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
            <DailyQuestSection />
          </motion.div>
        </div>

        {/* Insights Grid */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.5 }}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Insights & Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <WeeklyActivityWidget />
            <StudyStreakCalendar />
            <SubjectProgressWidget />
          </div>
        </motion.div>

        {/* Achievements + Leaderboard + Connect */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <BadgesDisplay />
            <LeaderboardSection />
            <div className="space-y-5">
              {/* Teacher Chat */}
              <TeacherChatWidget />
              {/* Teacher Connect */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Connect with Teacher</h3>
                </div>
                {user && <JoinWithCode />}
              </div>
              <QuickNotesWidget />
            </div>
          </div>
        </motion.div>

      </div>
    </AppLayout>
  );
}
