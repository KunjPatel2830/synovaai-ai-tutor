import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { History, MessageSquare, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoaderSpinner } from "@/components/ui/loader";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ChatSession {
  id: string;
  mode: string;
  subject: string | null;
  topic: string | null;
  created_at: string;
  messageCount?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatHistoryProps {
  mode: "tutor" | "homework" | "exam" | "doubt" | "language" | "voice";
  onLoadSession: (messages: Message[], session: ChatSession) => void;
}

export function ChatHistory({ mode, onLoadSession }: ChatHistoryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select(`
          id,
          mode,
          subject,
          topic,
          created_at
        `)
        .eq("user_id", user.id)
        .eq("mode", mode)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get message counts for each session
      const sessionsWithCounts = await Promise.all(
        (data || []).map(async (session) => {
          const { count } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("session_id", session.id);
          
          return { ...session, messageCount: count || 0 };
        })
      );

      setSessions(sessionsWithCounts);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, user]);

  const loadSession = async (session: ChatSession) => {
    setLoadingSessionId(session.id);
    try {
      const { data, error } = await externalSupabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const messages: Message[] = (data || []).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      onLoadSession(messages, session);
      setIsOpen(false);
      toast({ title: "Session loaded" });
    } catch (error) {
      toast({ title: "Failed to load session", variant: "destructive" });
    } finally {
      setLoadingSessionId(null);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // Delete messages first (due to foreign key)
      await externalSupabase
        .from("chat_messages")
        .delete()
        .eq("session_id", sessionId);

      // Then delete session
      const { error } = await externalSupabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast({ title: "Session deleted" });
    } catch (error) {
      toast({ title: "Failed to delete session", variant: "destructive" });
    }
  };

  const getModeLabel = () => {
    switch (mode) {
      case "tutor": return "Tutor";
      case "homework": return "Homework";
      case "exam": return "Exam Prep";
      case "doubt": return "Doubt Solver";
      case "language": return "Language Practice";
      case "voice": return "Voice Tutor";
      default: return "Chat";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{getModeLabel()} History</SheetTitle>
        </SheetHeader>
        
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-2 pr-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-3 rounded-lg border border-border">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex items-center gap-2 mt-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No previous sessions</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-8rem)]">
              <div className="space-y-2 pr-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className="p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {session.topic || session.subject || "Untitled Session"}
                        </p>
                        {session.subject && session.topic && (
                          <p className="text-xs text-muted-foreground truncate">
                            {session.subject}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(session.created_at), "MMM d, yyyy h:mm a")}
                          </span>
                          {session.messageCount !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              • {session.messageCount} messages
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {loadingSessionId === session.id ? (
                          <LoaderSpinner size="sm" />
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => deleteSession(session.id, e)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
