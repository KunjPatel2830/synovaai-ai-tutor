import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useVoice } from "@/hooks/useVoice";
import { useRateLimiter } from "@/hooks/useRateLimiter";
import { useProgressTracker } from "@/hooks/useProgressTracker";
import { VoiceControls } from "@/components/voice/VoiceControls";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { Brain, Send, Mic, MicOff, Volume2, Plus, Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Tutor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("beginner");
  
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [aiPaused, setAiPaused] = useState(false);
  const [pausedMessages, setPausedMessages] = useState<Message[]>([]);
  const inFlightControllerRef = useRef<AbortController | null>(null);

  const voice = useVoice();
  const { waitForRateLimit } = useRateLimiter({ minDelayMs: 500 });
  const { trackProgress } = useProgressTracker();

  // Profile loaded flag
  useEffect(() => {
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [messages]);

  // Sync voice transcript to input
  useEffect(() => {
    if (voice.transcript) {
      setInput((prev) => prev + voice.transcript);
      voice.clearTranscript();
    }
  }, [voice.transcript, voice.clearTranscript]);

  // Auto-speak new assistant messages
  const lastMessageRef = useRef<string>("");
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      lastMessage.content !== lastMessageRef.current &&
      voice.autoSpeak
    ) {
      lastMessageRef.current = lastMessage.content;
      voice.speak(lastMessage.content);
    }
  }, [messages, voice.autoSpeak, voice.speak]);

  // Create or get session and save messages
  const saveSession = async (newMessages: Message[], sessionTopic: string, sessionSubject: string) => {
    if (!user) return null;
    
    try {
      let currentSessionId = sessionId;
      
      if (!currentSessionId) {
        const { data: session, error: sessionError } = await externalSupabase
          .from("chat_sessions")
          .insert({
            user_id: user.id,
            mode: "tutor",
            subject: sessionSubject,
            topic: sessionTopic,
          })
          .select("id")
          .single();

        if (sessionError) throw sessionError;
        currentSessionId = session.id;
        setSessionId(currentSessionId);
      }

      // Save only the new messages
      const messagesToSave = newMessages.slice(-2).map((msg) => ({
        session_id: currentSessionId!,
        role: msg.role,
        content: msg.content,
      }));

      await externalSupabase.from("chat_messages").insert(messagesToSave);
      
      return currentSessionId;
    } catch (error) {
      console.error("Failed to save session:", error);
      return null;
    }
  };

  const startSession = async () => {
    if (!topic.trim() || !subject) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setSessionStarted(true);
    setIsLoading(true);
    setSessionId(null);
    inFlightControllerRef.current?.abort();
    inFlightControllerRef.current = new AbortController();

    const systemMessage = `I want to learn about "${topic}" in ${subject}. My level is ${level}.`;
    
    try {
      await waitForRateLimit();

      const res = await invokeBackendFunction<{ reply: string }>(
        "ai-tutor",
        {
          messages: [{ role: "user", content: systemMessage }],
          mode: "start",
          subject,
          topic,
        },
        {
          signal: inFlightControllerRef.current.signal,
          timeoutMs: 35000,
          retries: 2,
          label: "tutor:start",
        }
      );

      if (!res.ok) {
        // Surface specific error codes to user
        if (res.status === 401) {
          toast({ title: "Session expired", description: "Please log in again.", variant: "destructive" });
        } else if (res.status === 429) {
          toast({ title: "Rate limit reached", description: "Please wait a moment and try again.", variant: "destructive" });
        } else if (res.status === 402) {
          toast({ title: "Credits exhausted", description: "AI credits are low. Try again later.", variant: "destructive" });
        } else {
          toast({ title: "Failed to start session", description: res.error || "Unknown error", variant: "destructive" });
        }
        setSessionStarted(false);
        return;
      }
      
      const newMessages: Message[] = [
        { role: "user", content: systemMessage },
        { role: "assistant", content: res.data?.reply ?? "" },
      ];
      
      setMessages(newMessages);
      // Save session in background (non-blocking)
      saveSession(newMessages, topic, subject).catch(() => {});
      
      // Track progress in background (non-blocking)
      trackProgress(topic, subject, 10).catch(() => {});
    } catch (error) {
      if ((error as any)?.name !== "AbortError") {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast({ title: "Failed to start session", description: msg, variant: "destructive" });
      }
      setSessionStarted(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSession = (loadedMessages: Message[], session: { topic: string | null; subject: string | null; id: string }) => {
    setMessages(loadedMessages);
    setTopic(session.topic || "");
    setSubject(session.subject || "");
    setSessionId(session.id);
    setSessionStarted(true);
    setAiPaused(false);
    setPausedMessages([]);
  };

  const startNewSession = () => {
    setMessages([]);
    setSessionStarted(false);
    setSessionId(null);
    setTopic("");
    setSubject("");
    setLevel("beginner");
    setAiPaused(false);
    setPausedMessages([]);
  };

  const toggleAiPause = () => {
    if (aiPaused) {
      // Resume AI - process any paused messages
      setAiPaused(false);
      if (pausedMessages.length > 0) {
        toast({
          title: "AI Resumed",
          description: "Processing your messages now...",
        });
        // Send a summary of the discussion to the AI
        const pausedContent = pausedMessages.map(m => `${m.role}: ${m.content}`).join('\n');
        setPausedMessages([]);
        // Add a system context message
        const resumeMessage = `I was thinking/discussing on my own. Here's what I discussed:\n${pausedContent}\n\nPlease continue teaching from where we left off.`;
        setInput(resumeMessage);
      } else {
        toast({
          title: "AI Resumed",
          description: "The AI tutor will continue teaching.",
        });
      }
    } else {
      // Pause AI
      setAiPaused(true);
      voice.stopSpeaking();
      toast({
        title: "AI Paused",
        description: "Take your time to think or discuss. Messages won't be sent to AI.",
      });
    }
  };

  const sendPausedMessage = () => {
    if (!input.trim()) return;
    const userMessage: Message = { role: "user", content: input };
    setPausedMessages(prev => [...prev, userMessage]);
    setMessages(prev => [...prev, userMessage]);
    setInput("");
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user" as const, content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    inFlightControllerRef.current?.abort();
    inFlightControllerRef.current = new AbortController();

    try {
      await waitForRateLimit();

      const res = await invokeBackendFunction<{ reply: string }>(
        "ai-tutor",
        {
          messages: updatedMessages,
          mode: "chat",
          subject,
          topic,
        },
        {
          signal: inFlightControllerRef.current.signal,
          timeoutMs: 35000,
          retries: 2,
          label: "tutor:chat",
        }
      );

      if (!res.ok) {
        if (res.status === 401) {
          toast({ title: "Session expired", description: "Please log in again.", variant: "destructive" });
        } else if (res.status === 429) {
          toast({ title: "Rate limit reached", description: "Please wait and try again.", variant: "destructive" });
        } else if (res.status === 402) {
          toast({ title: "Credits exhausted", description: "AI credits are low.", variant: "destructive" });
        } else {
          toast({ title: "Failed to get response", description: res.error || "Unknown error", variant: "destructive" });
        }
        return;
      }

      const assistantMessage = { role: "assistant" as const, content: res.data?.reply ?? "" };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      
      // Save to database (non-blocking)
      if (sessionId) {
        Promise.resolve(
          externalSupabase.from("chat_messages").insert([
            { session_id: sessionId, role: userMessage.role, content: userMessage.content },
            { session_id: sessionId, role: assistantMessage.role, content: assistantMessage.content },
          ])
        ).catch(() => {});
      }
      
      // Track progress incrementally (non-blocking)
      trackProgress(topic, subject, 10).catch(() => {});
    } catch (error) {
      if ((error as any)?.name !== "AbortError") {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast({ title: "Failed to get response", description: msg, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopRequest = () => {
    inFlightControllerRef.current?.abort();
    setIsLoading(false);
    toast({ title: "Stopped", description: "Request cancelled." });
  };

  if (!sessionStarted) {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-2xl mx-auto lg:max-w-3xl">
          {/* Compact Header Row */}
          <div className="flex items-center justify-between gap-4 mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold text-foreground">AI Learning Tutor</h1>
            </div>
            <VoiceControls
              isListening={voice.isListening}
              isSpeaking={voice.isSpeaking}
              autoSpeak={voice.autoSpeak}
              blindMode={voice.blindMode}
              selectedLanguage={voice.selectedLanguage}
              voices={voice.voices}
              selectedVoice={voice.selectedVoice}
              onStartListening={voice.startListening}
              onStopListening={voice.stopListening}
              onStopSpeaking={voice.stopSpeaking}
              onAutoSpeakChange={voice.setAutoSpeak}
              onBlindModeChange={voice.setBlindMode}
              onLanguageChange={voice.setSelectedLanguage}
              onVoiceChange={voice.setSelectedVoice}
              compact
            />
          </div>

          {/* Setup Form */}
          <GlassCard className="flex-1">
            <GlassCardContent className="p-4 space-y-4">
              <div className="flex justify-end">
                <ChatHistory mode="tutor" onLoadSession={handleLoadSession} />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Subject</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Science">Science</SelectItem>
                    <SelectItem value="Physics">Physics</SelectItem>
                    <SelectItem value="Chemistry">Chemistry</SelectItem>
                    <SelectItem value="Biology">Biology</SelectItem>
                    <SelectItem value="Language Arts">Language Arts</SelectItem>
                    <SelectItem value="Social Studies">Social Studies</SelectItem>
                    <SelectItem value="History">History</SelectItem>
                    <SelectItem value="Geography">Geography</SelectItem>
                    <SelectItem value="Economics">Economics</SelectItem>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Topic</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g., Quadratic equations" 
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)} 
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant={voice.isListening ? "destructive" : "outline"}
                    size="icon"
                    onClick={voice.isListening ? voice.stopListening : voice.startListening}
                    className={cn("shrink-0 h-10 w-10", voice.isListening && "animate-pulse")}
                  >
                    {voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Your Level</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" onClick={startSession}>Start Learning</Button>
            </GlassCardContent>
          </GlassCard>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-1.5rem)]">
        {/* Header with controls */}
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <VoiceControls
              isListening={voice.isListening}
              isSpeaking={voice.isSpeaking}
              autoSpeak={voice.autoSpeak}
              blindMode={voice.blindMode}
              selectedLanguage={voice.selectedLanguage}
              voices={voice.voices}
              selectedVoice={voice.selectedVoice}
              onStartListening={voice.startListening}
              onStopListening={voice.stopListening}
              onStopSpeaking={voice.stopSpeaking}
              onAutoSpeakChange={voice.setAutoSpeak}
              onBlindModeChange={voice.setBlindMode}
              onLanguageChange={voice.setSelectedLanguage}
              onVoiceChange={voice.setSelectedVoice}
              compact
            />
            {/* AI Pause/Resume Button */}
            <Button
              variant={aiPaused ? "default" : "outline"}
              size="sm"
              onClick={toggleAiPause}
              className={cn("gap-1.5 text-xs sm:text-sm", aiPaused && "bg-warning text-warning-foreground hover:bg-warning/90")}
            >
              {aiPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{aiPaused ? "Resume AI" : "Pause AI"}</span>
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <ChatHistory mode="tutor" onLoadSession={handleLoadSession} />
            <Button variant="outline" size="sm" onClick={startNewSession} className="gap-1.5 text-xs sm:text-sm">
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </div>

        {/* Paused Mode Banner */}
        {aiPaused && (
          <div className="mb-3 p-2.5 sm:p-3 rounded-xl bg-warning/10 border border-warning/30 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-warning/20 border-warning text-warning-foreground shrink-0">
                <Pause className="h-3 w-3 mr-1" />
                Thinking Mode
              </Badge>
              <span className="text-xs sm:text-sm text-muted-foreground">
                AI paused. Think or discuss freely.
              </span>
            </div>
            {pausedMessages.length > 0 && (
              <Badge variant="secondary" className="shrink-0">{pausedMessages.length} queued</Badge>
            )}
          </div>
        )}

        {/* Chat container - flex-1 to fill remaining space */}
        <div className="flex-1 flex flex-col min-h-0 bg-card/50 rounded-2xl border border-border overflow-hidden">
          {/* Messages area */}
          <ScrollArea className="flex-1">
            <div className="p-2.5 sm:p-4 space-y-3">
              {messages.map((msg, i) => {
                const isPausedMessage = pausedMessages.some(pm => pm.content === msg.content && pm.role === msg.role);
                return (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={cn(
                      "max-w-[92%] sm:max-w-[80%] p-3 rounded-2xl",
                      msg.role === "user" 
                        ? isPausedMessage 
                          ? "bg-warning/80 text-warning-foreground" 
                          : "bg-primary text-primary-foreground"
                        : "bg-card border border-border"
                    )}>
                      <div className="flex items-start gap-2">
                        {msg.role === "assistant" ? (
                          <MarkdownContent content={msg.content} className="flex-1 overflow-x-auto" />
                        ) : (
                          <div className="flex-1">
                            {isPausedMessage && (
                              <span className="text-xs opacity-75 block mb-1">💭 Thinking...</span>
                            )}
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                          </div>
                        )}
                        {msg.role === "assistant" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => voice.speak(msg.content)}
                          >
                            <Volume2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border p-3 rounded-2xl max-w-[80%] space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input area - fixed at bottom */}
          <div className="flex gap-2 p-3 border-t border-border bg-background shrink-0 items-center">
            <Button
              type="button"
              variant={voice.isListening ? "destructive" : "outline"}
              size="icon"
              onClick={voice.isListening ? voice.stopListening : voice.startListening}
              className={cn("shrink-0 h-10 w-10", voice.isListening && "animate-pulse")}
            >
              {voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={aiPaused ? "Type your thoughts (AI paused)..." : "Type or speak your answer..."}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  aiPaused ? sendPausedMessage() : sendMessage();
                }
              }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 192) + 'px';
              }}
              rows={1}
              disabled={isLoading}
              className={cn("flex-1 min-h-10 max-h-48 resize-none overflow-y-auto", aiPaused && "border-warning/50")}
            />
            {isLoading && !aiPaused && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={stopRequest}
                className="h-10 w-10 shrink-0"
                title="Stop"
              >
                <Square className="h-4 w-4" />
              </Button>
            )}
            <Button 
              onClick={aiPaused ? sendPausedMessage : sendMessage} 
              disabled={isLoading} 
              size="icon" 
              className={cn("h-10 w-10 shrink-0", aiPaused && "bg-warning hover:bg-warning/90")}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
