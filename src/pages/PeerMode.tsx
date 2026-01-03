import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, LogIn, Send, Loader2, PenTool, X, Copy, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeerWhiteboard } from "@/components/peer/PeerWhiteboard";

interface Room {
  id: string;
  name: string;
  room_code: string;
  subject: string | null;
  topic: string | null;
  created_by: string;
  is_active: boolean;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

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

  // Create a new room
  const createRoom = async () => {
    if (!user || !roomName.trim()) {
      toast({ title: "Please enter a room name", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Generate room code
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: room, error } = await supabase
        .from("peer_rooms")
        .insert({
          name: roomName.trim(),
          created_by: user.id,
          room_code: roomCode,
          subject: roomSubject.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Join as creator
      await supabase.from("peer_room_participants").insert({
        room_id: room.id,
        user_id: user.id,
        role: userRole === "teacher" ? "teacher" : "student",
      });

      // Create whiteboard entry
      await supabase.from("peer_whiteboard_data").insert({
        room_id: room.id,
        data: [],
      });

      setActiveRoom(room);
      toast({ title: "Room created!", description: `Share code: ${roomCode}` });
      setRoomName("");
      setRoomSubject("");
    } catch (error: any) {
      console.error("Create room error:", error);
      toast({ title: "Failed to create room", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Join a room by code
  const joinRoom = async () => {
    if (!user || !joinCode.trim()) {
      toast({ title: "Please enter a room code", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: room, error: roomError } = await supabase
        .from("peer_rooms")
        .select("*")
        .eq("room_code", joinCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (roomError || !room) {
        toast({ title: "Room not found or inactive", variant: "destructive" });
        return;
      }

      // Check if already a participant
      const { data: existing } = await supabase
        .from("peer_room_participants")
        .select("*")
        .eq("room_id", room.id)
        .eq("user_id", user.id)
        .single();

      if (existing && !existing.left_at) {
        setActiveRoom(room);
        setJoinCode("");
        return;
      }

      // Join room
      await supabase.from("peer_room_participants").upsert({
        room_id: room.id,
        user_id: user.id,
        role: userRole === "teacher" ? "teacher" : "student",
        left_at: null,
      });

      setActiveRoom(room);
      toast({ title: "Joined room!" });
      setJoinCode("");
    } catch (error: any) {
      console.error("Join room error:", error);
      toast({ title: "Failed to join room", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Leave room
  const leaveRoom = async () => {
    if (!user || !activeRoom) return;

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

    if (!error) {
      setNewMessage("");
    }
  };

  // Load participants and messages when room is active
  useEffect(() => {
    if (!activeRoom) return;

    const loadRoomData = async () => {
      // Load participants
      const { data: parts } = await supabase
        .from("peer_room_participants")
        .select("*")
        .eq("room_id", activeRoom.id)
        .is("left_at", null);

      if (parts) {
        setParticipants(parts);
        await fetchDisplayNames(parts.map((p) => p.user_id));
      }

      // Load messages
      const { data: msgs } = await supabase
        .from("peer_room_messages")
        .select("*")
        .eq("room_id", activeRoom.id)
        .order("created_at", { ascending: true });

      if (msgs) {
        setMessages(msgs);
        const userIds = [...new Set(msgs.map((m) => m.user_id))];
        await fetchDisplayNames(userIds);
      }
    };

    loadRoomData();

    // Subscribe to realtime messages
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoom?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        <div className="flex items-center justify-center h-[calc(100vh-5rem)]">
          <p className="text-muted-foreground">Please sign in to use Peer Mode</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
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
                <Button className="w-full" onClick={joinRoom} disabled={isLoading || joinCode.length < 6}>
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Join Room
                </Button>
              </GlassCardContent>
            </GlassCard>
          </div>
        ) : (
          /* Active Room */
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
            {/* Chat Area */}
            <div className={cn("flex-1 flex flex-col min-h-0", showWhiteboard && "md:w-1/2")}>
              <GlassCard className="flex-1 flex flex-col min-h-0">
                {/* Room Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{activeRoom.name}</h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="cursor-pointer" onClick={copyRoomCode}>
                        <Copy className="h-3 w-3 mr-1" />
                        {activeRoom.room_code}
                      </Badge>
                      {activeRoom.subject && <span>• {activeRoom.subject}</span>}
                      <span>• {participants.length} online</span>
                    </div>
                  </div>
                  <Button
                    variant={showWhiteboard ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowWhiteboard(!showWhiteboard)}
                  >
                    <PenTool className="h-4 w-4 mr-2" />
                    Whiteboard
                  </Button>
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
