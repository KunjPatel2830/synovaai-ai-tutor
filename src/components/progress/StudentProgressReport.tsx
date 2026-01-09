import { useState, useEffect } from "react";
import { externalSupabase } from "@/lib/external-supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Flame,
  Trophy,
  BookOpen,
  TrendingUp,
  Calendar,
  Target,
  Clock,
  Star,
  HelpCircle,
  AlertCircle,
} from "lucide-react";

interface StudentProgressReportProps {
  studentId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LearningProgress {
  id: string;
  topic: string;
  score: number | null;
  mastered: boolean | null;
  attempts: number | null;
  difficulty_level: number | null;
  last_studied_at: string | null;
}

interface LearningStreak {
  current_streak: number | null;
  longest_streak: number | null;
  last_activity_date: string | null;
}

interface ChatSession {
  id: string;
  mode: string;
  subject: string | null;
  topic: string | null;
  created_at: string | null;
}

interface HomeworkSession {
  id: string;
  subject: string;
  topic: string | null;
  feedback: string | null;
  created_at: string | null;
}

interface HelpRequest {
  id: string;
  subject: string;
  topic: string | null;
  question: string;
  mode: string;
  created_at: string | null;
}

export function StudentProgressReport({
  studentId,
  studentName,
  open,
  onOpenChange,
}: StudentProgressReportProps) {
  const [progress, setProgress] = useState<LearningProgress[]>([]);
  const [streak, setStreak] = useState<LearningStreak | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [homeworkSessions, setHomeworkSessions] = useState<HomeworkSession[]>([]);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && studentId) {
      fetchStudentData();
    }
  }, [open, studentId]);

  const fetchStudentData = async () => {
    setIsLoading(true);

    const [progressRes, streakRes, chatRes, homeworkRes, helpRes] = await Promise.all([
      externalSupabase
        .from("learning_progress")
        .select("*")
        .eq("user_id", studentId)
        .order("last_studied_at", { ascending: false }),
      externalSupabase
        .from("learning_streaks")
        .select("current_streak, longest_streak, last_activity_date")
        .eq("user_id", studentId)
        .maybeSingle(),
      externalSupabase
        .from("chat_sessions")
        .select("id, mode, subject, topic, created_at")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false })
        .limit(10),
      externalSupabase
        .from("homework_sessions")
        .select("id, subject, topic, feedback, created_at")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false })
        .limit(10),
      externalSupabase
        .from("student_help_requests")
        .select("*")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (progressRes.data) setProgress(progressRes.data);
    if (streakRes.data) setStreak(streakRes.data);
    if (chatRes.data) setChatSessions(chatRes.data);
    if (homeworkRes.data) setHomeworkSessions(homeworkRes.data);
    if (helpRes.data) setHelpRequests(helpRes.data as HelpRequest[]);

    setIsLoading(false);
  };

  const masteredTopics = progress.filter((p) => p.mastered).length;
  const averageScore =
    progress.length > 0
      ? Math.round(
          progress.reduce((sum, p) => sum + (p.score || 0), 0) / progress.length
        )
      : 0;
  const totalAttempts = progress.reduce((sum, p) => sum + (p.attempts || 0), 0);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDifficultyLabel = (level: number | null) => {
    if (!level) return "Beginner";
    if (level <= 2) return "Beginner";
    if (level <= 4) return "Intermediate";
    return "Advanced";
  };

  const getDifficultyColor = (level: number | null) => {
    if (!level) return "bg-green-500/20 text-green-400";
    if (level <= 2) return "bg-green-500/20 text-green-400";
    if (level <= 4) return "bg-yellow-500/20 text-yellow-400";
    return "bg-red-500/20 text-red-400";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Progress Report: {studentName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <Flame className="h-5 w-5 text-orange-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {streak?.current_streak || 0}
                </p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <Trophy className="h-5 w-5 text-primary mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {masteredTopics}
                </p>
                <p className="text-xs text-muted-foreground">Topics Mastered</p>
              </div>
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {averageScore}%
                </p>
                <p className="text-xs text-muted-foreground">Average Score</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Target className="h-5 w-5 text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {totalAttempts}
                </p>
                <p className="text-xs text-muted-foreground">Total Attempts</p>
              </div>
            </div>

            <Tabs defaultValue="needs-help" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="needs-help" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Needs Help
                </TabsTrigger>
                <TabsTrigger value="progress">Progress</TabsTrigger>
                <TabsTrigger value="sessions">Sessions</TabsTrigger>
                <TabsTrigger value="homework">Homework</TabsTrigger>
              </TabsList>

              <TabsContent value="needs-help" className="mt-4 space-y-3">
                {helpRequests.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      Recent questions and topics where {studentName} may need additional support:
                    </p>
                    {helpRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20"
                      >
                        <div className="flex items-start gap-3">
                          <HelpCircle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium text-foreground line-clamp-2">
                              {request.question}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline">{request.subject}</Badge>
                              {request.topic && (
                                <Badge variant="secondary">{request.topic}</Badge>
                              )}
                              <Badge 
                                variant="secondary" 
                                className={
                                  request.mode === "exam" 
                                    ? "bg-red-500/20 text-red-400" 
                                    : request.mode === "homework"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "bg-green-500/20 text-green-400"
                                }
                              >
                                {request.mode}
                              </Badge>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {formatDate(request.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No help requests recorded yet</p>
                    <p className="text-sm mt-1">Questions from homework, tutoring, and failed exam questions will appear here</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="progress" className="mt-4 space-y-3">
                {progress.length > 0 ? (
                  progress.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {item.topic}
                          </span>
                          {item.mastered && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className={getDifficultyColor(item.difficulty_level)}
                        >
                          {getDifficultyLabel(item.difficulty_level)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <span>Score: {item.score || 0}%</span>
                        <span>•</span>
                        <span>Attempts: {item.attempts || 0}</span>
                        <span>•</span>
                        <span>Last studied: {formatDate(item.last_studied_at)}</span>
                      </div>
                      <Progress value={item.score || 0} className="h-2" />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No learning progress recorded yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sessions" className="mt-4 space-y-3">
                {chatSessions.length > 0 ? (
                  chatSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 rounded-xl bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {session.topic || session.subject || "General Session"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Badge variant="outline" className="capitalize">
                              {session.mode}
                            </Badge>
                            {session.subject && <span>{session.subject}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(session.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No tutor sessions recorded yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="homework" className="mt-4 space-y-3">
                {homeworkSessions.length > 0 ? (
                  homeworkSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 rounded-xl bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-foreground">
                            {session.topic || session.subject}
                          </p>
                          <Badge variant="outline" className="mt-1">
                            {session.subject}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDate(session.created_at)}
                        </div>
                      </div>
                      {session.feedback && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {session.feedback}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No homework sessions recorded yet</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
