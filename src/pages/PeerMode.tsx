import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePeerVoiceChat } from "@/hooks/usePeerVoiceChat";
import { VoiceChatControls } from "@/components/peer/VoiceChatControls";
import { Users, Plus, LogIn, Send, Loader2, PenTool, X, Copy, UserPlus, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeerWhiteboard } from "@/components/peer/PeerWhiteboard";

interface Room {
  id: string;
  name: string;
  room_code: string;
  subject: string | null;
  topic: string | null;
  created_by: string;
  is_active: boolean | null;
}

interface Participant {
  id: string;
  user_id: string;
  role: string;
  display_name?: string;
}

interface Message {
  id: string;
  user_id: string;
  message: string;
  message_type: string;
  created_at: string;
  display_name?: string;
}

interface StudentRoom extends Room {
  student_name?: string;
  participant_count?: number;
}

export default function PeerMode() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  // Room creation/joining
  const [roomName, setRoomName] = useState("");
  const [roomSubject, setRoomSubject] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // Teacher: linked students' active rooms
  const [studentRooms, setStudentRooms] = useState<StudentRoom[]>([]);
  const [loadingStudentRooms, setLoadingStudentRooms] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

  // Voice chat hook
  const voiceChat = usePeerVoiceChat(activeRoom?.id || null, user?.id || null);

  // Fetch display names for participants
  const fetchDisplayNames = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    if (data) {
      const names: Record<string, string> = {};
      data.forEach((p) => {
        names[p.user_id] = p.display_name || "Anonymous";
      });
      setDisplayNames((prev) => ({ ...prev, ...names }));
    }
  };

  // Fetch active rooms of linked students (for teachers)
  const fetchStudentRooms = async () => {
    if (!user || userRole !== "teacher") return;
    
    setLoadingStudentRooms(true);
    try {
      // Get linked student IDs
      const { data: links } = await supabase
        .from("teacher_student_links")
        .select("student_id")
        .eq("teacher_id", user.id);

      if (!links || links.length === 0) {
        setStudentRooms([]);
        return;
      }

      const studentIds = links.map((l) => l.student_id);

      // Fetch active rooms created by those students
      const { data: rooms } = await supabase
        .from("peer_rooms")
        .select("id, name, room_code, subject, topic, created_by, is_active")
        .in("created_by", studentIds)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (!rooms || rooms.length === 0) {
        setStudentRooms([]);
        return;
      }

      // Fetch student names
      const creatorIds = [...new Set(rooms.map((r) => r.created_by))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", creatorIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach((p) => {
        nameMap[p.user_id] = p.display_name || "Student";
      });

      setStudentRooms(
        rooms.map((r) => ({
          ...r,
          student_name: nameMap[r.created_by] || "Student",
        }))
      );
    } catch (error) {
      console.error("Failed to fetch student rooms:", error);
    } finally {
      setLoadingStudentRooms(false);
    }
  };

  // Load student rooms for teachers on mount
  useEffect(() => {
    if (userRole === "teacher" && !activeRoom) {
      fetchStudentRooms();
    }
  }, [userRole, activeRoom, user]);

  // Create a new room
  const createRoom = async () => {
    if (!user || !roomName.trim()) {
      toast({ title: "Please enter a room name", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await invokeBackendFunction<{ room: Room }>(
        "peer-create-room",
        {
          name: roomName.trim(),
          subject: roomSubject.trim() || null,
          role: userRole === "teacher" ? "teacher" : "student",
        },
        { timeoutMs: 20000, retries: 1, label: "peer:create" }
      );

      if (!res.ok) throw new Error(res.error || "Failed");

      const room = res.data?.room as Room | undefined;
      if (!room) throw new Error("Failed to create room");

      setActiveRoom(room);
      toast({ title: "Room created!", description: `Share code: ${room.room_code}` });
      setRoomName("");
      setRoomSubject("");
    } catch (error: any) {
      console.error("Create room error:", error);
      toast({ title: "Failed to create room", description: error?.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Join a room by code
  const joinRoom = async (code?: string) => {
    const roomCode = code || joinCode.trim().toUpperCase();
    if (!user || !roomCode) {
      toast({ title: "Please enter a room code", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await invokeBackendFunction<{ room: Room }>(
        "peer-join-room",
        {
          code: roomCode,
          role: userRole === "teacher" ? "teacher" : "student",
        },
        { timeoutMs: 20000, retries: 1, label: "peer:join" }
      );

      if (!res.ok) throw new Error(res.error || "Failed");

      const room = res.data?.room as Room | undefined;
      if (!room) {
        toast({ title: "Room not found or inactive", variant: "destructive" });
        return;
      }

      setActiveRoom(room);
      toast({ title: "Joined room!" });
      setJoinCode("");
    } catch (error: any) {
      console.error("Join room error:", error);
      toast({ title: "Failed to join room", description: error?.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Leave room
  const leaveRoom = async () => {
    if (!user || !activeRoom) return;

    if (voiceChat.isVoiceEnabled) {
      await voiceChat.stopVoiceChat();
    }

    await supabase
      .from("peer_room_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("room_id", activeRoom.id)
      .eq("user_id", user.id);

    setActiveRoom(null);
    setMessages([]);
    setParticipants([]);
    setShowWhiteboard(false);
  };

  // Send message
  const sendMessage = async () => {
    if (!user || !activeRoom || !newMessage.trim()) return;

    const { error } = await supabase.from("peer_room_messages").insert({
      room_id: activeRoom.id,
      user_id: user.id,
      message: newMessage.trim(),
      message_type: "text",
    });

    if (!error) setNewMessage("");
  };

  // Load participants and messages when room is active
  useEffect(() => {
    if (!activeRoom) return;

    const loadRoomData = async () => {
      const { data: parts } = await supabase
        .from("peer_room_participants")
        .select("*")
        .eq("room_id", activeRoom.id)
        .is("left_at", null);

      if (parts) {
        setParticipants(parts);
        await fetchDisplayNames(parts.map((p: Participant) => p.user_id));
      }

      const { data: msgs } = await supabase
        .from("peer_room_messages")
        .select("*")
        .eq("room_id", activeRoom.id)
        .order("created_at", { ascending: true });

      if (msgs) {
        setMessages(msgs);
        const userIds = [...new Set(msgs.map((m: Message) => m.user_id))];
        await fetchDisplayNames(userIds);
      }
    };

    loadRoomData();

    const channel = supabase
      .channel(`room-${activeRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "peer_room_messages",
          filter: `room_id=eq.${activeRoom.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          if (!displayNames[newMsg.user_id]) {
            await fetchDisplayNames([newMsg.user_id]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRoom?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [messages]);

  const copyRoomCode = () => {
    if (activeRoom) {
      navigator.clipboard.writeText(activeRoom.room_code);
      toast({ title: "Room code copied!" });
    }
  };

  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-1rem)]">
          <p className="text-muted-foreground">Please sign in to use Peer Mode</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-1rem)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Peer Mode</h1>
              <p className="text-sm text-muted-foreground">Collaborate with classmates and teachers</p>
            </div>
          </div>
          {activeRoom && (
            <Button variant="destructive" size="sm" onClick={leaveRoom}>
              <X className="h-4 w-4 mr-2" />
              Leave Room
            </Button>
          )}
        </div>

        {!activeRoom ? (
          /* Room Selection */
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Create Room */}
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Create Study Room
                  </GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Room Name</Label>
                    <Input
                      placeholder="e.g., Physics Study Group"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject (Optional)</Label>
                    <Input
                      placeholder="e.g., Physics, Chemistry"
                      value={roomSubject}
                      onChange={(e) => setRoomSubject(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={createRoom} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Create Room
                  </Button>
                </GlassCardContent>
              </GlassCard>

              {/* Join Room */}
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle className="flex items-center gap-2">
                    <LogIn className="h-5 w-5" />
                    Join Study Room
                  </GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Room Code</Label>
                    <Input
                      placeholder="Enter 6-character code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="uppercase"
                    />
                  </div>
                  <Button className="w-full" onClick={() => joinRoom()} disabled={isLoading || joinCode.length < 6}>
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                    Join Room
                  </Button>
                </GlassCardContent>
              </GlassCard>
            </div>

            {/* Teacher: Active Student Rooms */}
            {userRole === "teacher" && (
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Your Students' Active Rooms
                  </GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent>
                  {loadingStudentRooms ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : studentRooms.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No active student rooms right now</p>
                      <p className="text-xs mt-1">When your linked students create rooms, they'll appear here</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {studentRooms.map((room) => (
                        <div
                          key={room.id}
                          className="p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{room.name}</p>
                              <p className="text-xs text-muted-foreground">by {room.student_name}</p>
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {room.room_code}
                            </Badge>
                          </div>
                          {room.subject && (
                            <Badge variant="outline" className="text-[10px] mb-3">{room.subject}</Badge>
                          )}
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => joinRoom(room.room_code)}
                            disabled={isLoading}
                          >
                            <LogIn className="h-3.5 w-3.5 mr-1.5" />
                            Join Room
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCardContent>
              </GlassCard>
            )}
          </div>
        ) : (
          /* Active Room */
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
            {/* Chat Area */}
            <div className={cn("flex-1 flex flex-col min-h-0", showWhiteboard && "md:w-1/2")}>
              <GlassCard className="flex-1 flex flex-col min-h-0">
                {/* Room Header */}
                <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="font-semibold">{activeRoom.name}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <Badge variant="secondary" className="cursor-pointer" onClick={copyRoomCode}>
                        <Copy className="h-3 w-3 mr-1" />
                        {activeRoom.room_code}
                      </Badge>
                      {activeRoom.subject && <span>• {activeRoom.subject}</span>}
                      <span>• {participants.length} online</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <VoiceChatControls
                      isVoiceEnabled={voiceChat.isVoiceEnabled}
                      isMuted={voiceChat.isMuted}
                      isConnecting={voiceChat.isConnecting}
                      connectedPeers={voiceChat.connectedPeers}
                      onStartVoice={voiceChat.startVoiceChat}
                      onStopVoice={voiceChat.stopVoiceChat}
                      onToggleMute={voiceChat.toggleMute}
                    />
                    <Button
                      variant={showWhiteboard ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowWhiteboard(!showWhiteboard)}
                    >
                      <PenTool className="h-4 w-4 mr-2" />
                      Whiteboard
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col max-w-[80%] rounded-xl p-3",
                          msg.user_id === user.id
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {msg.user_id !== user.id && (
                          <span className="text-xs font-medium mb-1 opacity-70">
                            {displayNames[msg.user_id] || "Anonymous"}
                          </span>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <span className="text-xs opacity-50 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="p-4 border-t border-border flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </GlassCard>
            </div>

            {/* Whiteboard */}
            {showWhiteboard && (
              <div className="flex-1 md:w-1/2 min-h-[400px]">
                <PeerWhiteboard roomId={activeRoom.id} />
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
