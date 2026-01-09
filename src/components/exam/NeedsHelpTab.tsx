import { useState, useEffect } from "react";
import { externalSupabase } from "@/lib/external-supabase";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle, User, BookOpen, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface HelpRequest {
  id: string;
  user_id: string;
  question: string;
  subject: string;
  topic: string | null;
  mode: string;
  created_at: string;
  student_name?: string;
}

interface NeedsHelpTabProps {
  linkedStudentIds: string[];
}

export function NeedsHelpTab({ linkedStudentIds }: NeedsHelpTabProps) {
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (linkedStudentIds.length > 0) {
      fetchHelpRequests();
    } else {
      setIsLoading(false);
    }
  }, [linkedStudentIds]);

  const fetchHelpRequests = async () => {
    setIsLoading(true);
    try {
      // Fetch help requests for linked students
      const { data: requests, error } = await externalSupabase
        .from("student_help_requests")
        .select("*")
        .in("user_id", linkedStudentIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch student profiles
      const { data: profiles } = await externalSupabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", linkedStudentIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);

      const enrichedRequests = (requests || []).map((r) => ({
        ...r,
        student_name: profileMap.get(r.user_id) || "Student",
      }));

      setHelpRequests(enrichedRequests);
    } catch (error) {
      console.error("Failed to fetch help requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "tutor":
        return "bg-blue-500/20 text-blue-600 border-blue-500/30";
      case "homework":
        return "bg-purple-500/20 text-purple-600 border-purple-500/30";
      case "exam":
        return "bg-orange-500/20 text-orange-600 border-orange-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (linkedStudentIds.length === 0) {
    return (
      <GlassCard className="text-center py-12">
        <GlassCardContent>
          <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No students linked yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Generate an invitation code and share it with your students.
          </p>
        </GlassCardContent>
      </GlassCard>
    );
  }

  if (helpRequests.length === 0) {
    return (
      <GlassCard className="text-center py-12">
        <GlassCardContent>
          <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No help requests from students yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Students' questions and struggles will appear here.
          </p>
        </GlassCardContent>
      </GlassCard>
    );
  }

  // Group by student
  const groupedByStudent = helpRequests.reduce((acc, req) => {
    const key = req.user_id;
    if (!acc[key]) {
      acc[key] = { name: req.student_name || "Student", requests: [] };
    }
    acc[key].requests.push(req);
    return acc;
  }, {} as Record<string, { name: string; requests: HelpRequest[] }>);

  return (
    <div className="space-y-4">
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Students Needing Help ({helpRequests.length})
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-6">
              {Object.entries(groupedByStudent).map(([userId, { name, requests }]) => (
                <div key={userId} className="space-y-3">
                  <div className="flex items-center gap-2 font-medium">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {name}
                    <Badge variant="secondary" className="ml-2">
                      {requests.length} questions
                    </Badge>
                  </div>
                  <div className="space-y-2 ml-6">
                    {requests.slice(0, 5).map((req) => (
                      <div
                        key={req.id}
                        className="p-3 rounded-lg bg-muted/50 border border-border"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getModeColor(req.mode)}>{req.mode}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {req.subject}
                              {req.topic && ` • ${req.topic}`}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(req.created_at), "MMM d")}
                          </span>
                        </div>
                        <p className="text-sm text-foreground line-clamp-2">{req.question}</p>
                      </div>
                    ))}
                    {requests.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{requests.length - 5} more questions
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
