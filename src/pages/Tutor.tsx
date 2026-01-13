import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Brain, Send, Mic, MicOff, Volume2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

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

  const voice = useVoice();
  const { waitForRateLimit } = useRateLimiter({ minDelayMs: 500 });
  const { trackProgress } = useProgressTracker();

  // Profile loaded flag
  useEffect(() => {
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

    const systemMessage = `I want to learn about "${topic}" in ${subject}. My level is ${level}.`;
    
    try {
      await waitForRateLimit();
      
      // Get access token from external Supabase session
      const { data: sessionData } = await externalSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        throw new Error("No session token");
      }
      
      const response = await supabase.functions.invoke("ai-tutor", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          messages: [{ role: "user", content: systemMessage }],
          mode: "start",
        },
      });

      if (response.error) throw response.error;
      
      const newMessages: Message[] = [
        { role: "user", content: systemMessage },
        { role: "assistant", content: response.data.reply },
      ];
      
      setMessages(newMessages);
      await saveSession(newMessages, topic, subject);
      
      // Track progress when session starts
      await trackProgress(topic, subject, 10);
    } catch (error) {
      toast({ title: "Failed to start session", variant: "destructive" });
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
  };

  const startNewSession = () => {
    setMessages([]);
    setSessionStarted(false);
    setSessionId(null);
    setTopic("");
    setSubject("");
    setLevel("beginner");
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user" as const, content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      await waitForRateLimit();
      
      // Get access token from external Supabase session
      const { data: sessionData } = await externalSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        throw new Error("No session token");
      }
      
      const response = await supabase.functions.invoke("ai-tutor", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: { messages: updatedMessages, mode: "chat" },
      });

      if (response.error) throw response.error;

      const assistantMessage = { role: "assistant" as const, content: response.data.reply };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      
      // Save to database
      if (sessionId) {
        await externalSupabase.from("chat_messages").insert([
          { session_id: sessionId, role: userMessage.role, content: userMessage.content },
          { session_id: sessionId, role: assistantMessage.role, content: assistantMessage.content },
        ]);
      }
      
      // Track progress with each message exchange (incrementally increase score)
      const currentScore = Math.min(80, 10 + messages.length * 5);
      await trackProgress(topic, subject, currentScore);
    } catch (error) {
      toast({ title: "Failed to get response", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
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
                    <SelectItem value="Language Arts">Language Arts</SelectItem>
                    <SelectItem value="Social Studies">Social Studies</SelectItem>
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
      <div className="flex flex-col h-[calc(100vh-5rem)]">
        {/* Header with controls */}
        <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
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
          <div className="flex items-center gap-2">
            <ChatHistory mode="tutor" onLoadSession={handleLoadSession} />
            <Button variant="outline" size="sm" onClick={startNewSession} className="gap-2">
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
        </div>

        {/* Chat container - flex-1 to fill remaining space */}
        <div className="flex-1 flex flex-col min-h-0 bg-card/50 rounded-2xl border border-border overflow-hidden">
          {/* Messages area */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                    <div className="flex items-start gap-2">
                      {msg.role === "assistant" ? (
                        <MarkdownContent content={msg.content} className="flex-1 overflow-x-auto" />
                      ) : (
                        <p className="whitespace-pre-wrap flex-1 text-sm">{msg.content}</p>
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
              ))}
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
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or speak your answer..."
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={isLoading}
              className="flex-1 h-10"
            />
            <Button onClick={sendMessage} disabled={isLoading} size="icon" className="h-10 w-10 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
