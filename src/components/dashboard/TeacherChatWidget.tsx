import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Send, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Teacher {
  id: string;
  display_name: string | null;
}

interface Message {
  id: string;
  message: string;
  sender_id: string;
  student_id: string;
  teacher_id: string;
  created_at: string;
  is_read: boolean;
}

export function TeacherChatWidget() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) fetchTeachers();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchTeachers = async () => {
    if (!user) return;
    setLoading(true);

    // Get linked teachers
    const { data: links } = await externalSupabase
      .from("teacher_student_links")
      .select("teacher_id")
      .eq("student_id", user.id);

    if (!links || links.length === 0) {
      setLoading(false);
      return;
    }

    const teacherIds = links.map((l) => l.teacher_id);

    // Get teacher profiles
    const { data: profiles } = await externalSupabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", teacherIds);

    const teacherList = teacherIds.map((tid) => {
      const profile = profiles?.find((p) => p.user_id === tid);
      return { id: tid, display_name: profile?.display_name || "Teacher" };
    });

    setTeachers(teacherList);

    // Get unread counts
    const { data: unread } = await externalSupabase
      .from("student_teacher_messages")
      .select("teacher_id")
      .eq("student_id", user.id)
      .neq("sender_id", user.id)
      .eq("is_read", false);

    if (unread) {
      const counts: Record<string, number> = {};
      unread.forEach((m) => {
        counts[m.teacher_id] = (counts[m.teacher_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }

    setLoading(false);
  };

  const openChat = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setChatOpen(true);
    setChatLoading(true);

    if (!user) return;

    const { data } = await externalSupabase
      .from("student_teacher_messages")
      .select("*")
      .eq("student_id", user.id)
      .eq("teacher_id", teacher.id)
      .order("created_at", { ascending: true });

    setMessages(data || []);

    // Mark as read
    await externalSupabase
      .from("student_teacher_messages")
      .update({ is_read: true })
      .eq("student_id", user.id)
      .eq("teacher_id", teacher.id)
      .neq("sender_id", user.id);

    setUnreadCounts((prev) => ({ ...prev, [teacher.id]: 0 }));
    setChatLoading(false);

    // Subscribe to new messages
    const channel = externalSupabase
      .channel(`student-chat-${user.id}-${teacher.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "student_teacher_messages",
          filter: `student_id=eq.${user.id}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.teacher_id === teacher.id) {
            setMessages((prev) => [...prev, msg]);
            // Auto mark as read
            if (msg.sender_id !== user.id) {
              externalSupabase
                .from("student_teacher_messages")
                .update({ is_read: true })
                .eq("id", msg.id);
            }
          }
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  };

  const sendMessage = async () => {
    if (!user || !selectedTeacher || !newMessage.trim()) return;
    setSending(true);

    try {
      const { error } = await externalSupabase
        .from("student_teacher_messages")
        .insert({
          student_id: user.id,
          teacher_id: selectedTeacher.id,
          sender_id: user.id,
          message: newMessage.trim(),
        });

      if (error) throw error;
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Teacher Chat</h3>
        </div>
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (teachers.length === 0) {
    return null; // Don't show widget if no teachers connected
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Teacher Chat
          </h3>
          {totalUnread > 0 && (
            <span className="ml-auto text-xs font-bold bg-primary text-primary-foreground rounded-full h-5 min-w-5 flex items-center justify-center px-1.5">
              {totalUnread}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {teachers.map((teacher) => (
            <button
              key={teacher.id}
              onClick={() => openChat(teacher)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {(teacher.display_name || "T").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {teacher.display_name || "Teacher"}
                </p>
                <p className="text-xs text-muted-foreground">Tap to chat</p>
              </div>
              {unreadCounts[teacher.id] > 0 && (
                <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full h-5 min-w-5 flex items-center justify-center px-1.5">
                  {unreadCounts[teacher.id]}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>

      {/* Chat Dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-lg h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {(selectedTeacher?.display_name || "T").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              Chat with {selectedTeacher?.display_name || "Teacher"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            {chatLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-3 py-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No messages yet. Say hi to your teacher!
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex gap-2",
                            isMe ? "justify-end" : "justify-start"
                          )}
                        >
                          {!isMe && (
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                                {(selectedTeacher?.display_name || "T").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={cn(
                              "max-w-[75%] px-3 py-2 rounded-2xl text-sm",
                              isMe
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted text-foreground rounded-bl-md"
                            )}
                          >
                            <p>{msg.message}</p>
                            <p
                              className={cn(
                                "text-[10px] mt-1 opacity-70",
                                isMe ? "text-right" : "text-left"
                              )}
                            >
                              {formatDistanceToNow(new Date(msg.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                          {isMe && (
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                You
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1"
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
