import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  is_active: boolean | null;
}

interface Message {
  id: string;
  user_id: string;
  message: string;
  message_type: string;
  created_at: string;
}

export default function PeerMode() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

  const [roomName, setRoomName] = useState("");
  const [roomSubject, setRoomSubject] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageTime = useRef<string | null>(null);

  const voiceChat = usePeerVoiceChat(activeRoom?.id || null, user?.id || null);

  // ── Room Action Helper ──
  const roomAction = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    if (!activeRoom) return null;
    const res = await invokeBackendFunction("peer-room-action", {
      action,
      room_id: activeRoom.id,
      ...extra,
    }, { timeoutMs: 15000, retries: 1, label: `peer:${action}` });
    if (!res.ok) throw new Error(res.error || "Failed");
    return res.data;
  }, [activeRoom]);

  // ── Create Room ──
  const createRoom = async () => {
    if (!user || !roomName.trim()) {
      toast({ title: "Please enter a room name", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await invokeBackendFunction<{ room: Room }>(
        "peer-create-room",
        { name: roomName.trim(), subject: roomSubject.trim() || null, role: userRole === "teacher" ? "teacher" : "student" },
        { timeoutMs: 20000, retries: 1, label: "peer:create" }
      );
      if (!res.ok) throw new Error(res.error || "Failed");
      const room = res.data?.room;
      if (!room) throw new Error("Failed to create room");
      setActiveRoom(room);
      toast({ title: "Room created!", description: `Share code: ${room.room_code}` });
      setRoomName("");
      setRoomSubject("");
    } catch (error: any) {
      toast({ title: "Failed to create room", description: error?.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Join Room ──
  const joinRoom = async () => {
    if (!user || !joinCode.trim()) {
      toast({ title: "Please enter a room code", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await invokeBackendFunction<{ room: Room }>(
        "peer-join-room",
        { code: joinCode.toUpperCase(), role: userRole === "teacher" ? "teacher" : "student" },
        { timeoutMs: 20000, retries: 1, label: "peer:join" }
      );
      if (!res.ok) throw new Error(res.error || "Failed");
      const room = res.data?.room;
      if (!room) {
        toast({ title: "Room not found or inactive", variant: "destructive" });
        return;
      }
      setActiveRoom(room);
      toast({ title: "Joined room!" });
      setJoinCode("");
    } catch (error: any) {
      toast({ title: "Failed to join room", description: error?.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Leave Room ──
  const leaveRoom = async () => {
    if (!user || !activeRoom) return;
    if (voiceChat.isVoiceEnabled) await voiceChat.stopVoiceChat();
    try {
      await roomAction("leave-room");
    } catch { /* ignore */ }
    setActiveRoom(null);
    setMessages([]);
    setParticipantCount(0);
    setDisplayNames({});
    setShowWhiteboard(false);
  };

  // ── Send Message ──
  const sendMessage = async () => {
    if (!user || !activeRoom || !newMessage.trim() || isSending) return;
    setIsSending(true);
    try {
      const data = await roomAction("send-message", { message: newMessage.trim() });
      if (data?.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        lastMessageTime.current = data.message.created_at;
      }
      setNewMessage("");
    } catch (error: any) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  // ── Load Initial Data ──
  useEffect(() => {
    if (!activeRoom) return;

    const loadInitial = async () => {
      try {
        const data = await roomAction("load-data");
        if (data) {
          setMessages(data.messages || []);
          setParticipantCount((data.participants || []).length);
          setDisplayNames(prev => ({ ...prev, ...(data.displayNames || {}) }));
          const msgs = data.messages || [];
          if (msgs.length > 0) {
            lastMessageTime.current = msgs[msgs.length - 1].created_at;
          }
        }
      } catch (err) {
        console.error("Failed to load room data:", err);
      }
    };

    loadInitial();
  }, [activeRoom?.id]);

  // ── Poll for new messages ──
  useEffect(() => {
    if (!activeRoom) return;

    const poll = async () => {
      try {
        const res = await invokeBackendFunction("peer-room-action", {
          action: "poll-messages",
          room_id: activeRoom.id,
          since: lastMessageTime.current,
        }, { timeoutMs: 10000, retries: 0, label: "peer:poll" });

        if (res.ok && res.data) {
          const newMsgs = res.data.messages || [];
          if (newMsgs.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map((m: Message) => m.id));
              const unique = newMsgs.filter((m: Message) => !existingIds.has(m.id));
              if (unique.length === 0) return prev;
              return [...prev, ...unique];
            });
            lastMessageTime.current = newMsgs[newMsgs.length - 1].created_at;
          }
          if (res.data.displayNames) {
            setDisplayNames(prev => ({ ...prev, ...res.data.displayNames }));
          }
          if (typeof res.data.participantCount === "number") {
            setParticipantCount(res.data.participantCount);
          }
        }
      } catch { /* ignore polling errors */ }
    };

    pollingRef.current = setInterval(poll, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeRoom?.id]);

  // ── Scroll to bottom ──
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
                  <Input placeholder="e.g., Physics Study Group" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Subject (Optional)</Label>
                  <Input placeholder="e.g., Physics, Chemistry" value={roomSubject} onChange={(e) => setRoomSubject(e.target.value)} />
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
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
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
                      <span>• {participantCount} online</span>
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
                    <Button variant={showWhiteboard ? "default" : "outline"} size="sm" onClick={() => setShowWhiteboard(!showWhiteboard)}>
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
                          msg.user_id === user.id ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
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
                  <Button onClick={sendMessage} disabled={!newMessage.trim() || isSending}>
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </GlassCard>
            </div>

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
