import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useVoice } from "@/hooks/useVoice";
import { useProgressTracker } from "@/hooks/useProgressTracker";
import { VoiceControls } from "@/components/voice/VoiceControls";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { FileUpload } from "@/components/upload/FileUpload";
import { FileText, Send, Lightbulb, AlertTriangle, CheckCircle, Mic, MicOff, Volume2, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Square } from "lucide-react";

interface UploadedFile {
  file: File;
  preview?: string;
  type: "image" | "pdf" | "other";
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Homework() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inFlightControllerRef = useRef<AbortController | null>(null);

  const voice = useVoice();
  const { trackProgress, trackHelpRequest } = useProgressTracker();

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

  // Save session and messages to database
  const saveToSession = async (userMsg: Message, assistantMsg: Message) => {
    if (!user) return;
    
    try {
      let currentSessionId = sessionId;
      
      if (!currentSessionId) {
        const { data: session, error } = await externalSupabase
          .from("chat_sessions")
          .insert({
            user_id: user.id,
            mode: "homework",
            subject: subject,
          })
          .select("id")
          .single();

        if (error) throw error;
        currentSessionId = session.id;
        setSessionId(currentSessionId);
      }

      await externalSupabase.from("chat_messages").insert([
        { session_id: currentSessionId, role: userMsg.role, content: userMsg.content },
        { session_id: currentSessionId, role: assistantMsg.role, content: assistantMsg.content },
      ]);
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  };

  const handleFilesSelected = (files: UploadedFile[]) => {
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const sendMessage = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    if (!subject) {
      toast({ title: "Please select a subject first", variant: "destructive" });
      return;
    }

    // Build message content with file info
    let messageContent = input;
    const fileDescriptions: string[] = [];
    const fileData: { name: string; type: string; base64: string }[] = [];

    for (const uploadedFile of uploadedFiles) {
      fileDescriptions.push(`[Attached: ${uploadedFile.file.name}]`);
      const base64 = await fileToBase64(uploadedFile.file);
      fileData.push({
        name: uploadedFile.file.name,
        type: uploadedFile.file.type,
        base64,
      });
    }

    if (fileDescriptions.length > 0) {
      messageContent = `${messageContent}\n\n${fileDescriptions.join("\n")}`;
    }

    const userMessage = { role: "user" as const, content: messageContent };
    const questionText = input || "Please help me with the attached file(s)";
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setUploadedFiles([]);
    setIsLoading(true);
    inFlightControllerRef.current?.abort();
    inFlightControllerRef.current = new AbortController();

    try {
      // Track the help request for teachers/caregivers (non-blocking)
      trackHelpRequest(questionText, subject, null, "homework").catch(() => {});
      
      const res = await invokeBackendFunction<{ reply: string }>(
        "homework-assist",
        {
          question: questionText,
          subject,
          files: fileData.length > 0 ? fileData : undefined,
        },
        {
          signal: inFlightControllerRef.current.signal,
          timeoutMs: 40000,
          retries: 2,
          label: "homework:assist",
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
          toast({ title: "Failed to get help", description: res.error || "Unknown error", variant: "destructive" });
        }
        return;
      }

      const assistantMessage = { role: "assistant" as const, content: res.data?.reply ?? "" };
      setMessages([...updatedMessages, assistantMessage]);
      
      // Save to database (non-blocking)
      saveToSession(userMessage, assistantMessage).catch(() => {});

      // Track progress (non-blocking)
      trackProgress(`Homework: ${subject}`, subject, 20).catch(() => {});
    } catch (error) {
      if ((error as any)?.name !== "AbortError") {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast({ title: "Failed to get help", description: msg, variant: "destructive" });
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

  const handleLoadSession = (loadedMessages: Message[], session: { subject: string | null; id: string }) => {
    setMessages(loadedMessages);
    setSubject(session.subject || "");
    setSessionId(session.id);
  };

  const startNewSession = () => {
    setMessages([]);
    setSessionId(null);
    setSubject("");
    setInput("");
  };

  const renderMessage = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("📋") || line.startsWith("💡") || line.startsWith("📝") || line.startsWith("⚠️") || line.startsWith("✏️")) {
        return <p key={i} className="font-semibold mt-3 mb-1">{line}</p>;
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
      }
      if (line.startsWith("- ")) {
        return <li key={i} className="ml-4">{line.slice(2)}</li>;
      }
      return <p key={i}>{line}</p>;
    });
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)]">
        {/* Compact Header Row */}
        <div className="flex items-center justify-between gap-4 mb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center">
              <FileText className="h-4 w-4 text-secondary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">Homework Help</h1>
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

        {/* Subject Selection */}
        <div className="flex items-center justify-between gap-4 mb-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Subject:</span>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
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
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ChatHistory mode="homework" onLoadSession={handleLoadSession} />
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={startNewSession} className="gap-2">
                <Plus className="h-4 w-4" />
                New
              </Button>
            )}
          </div>
        </div>

        {/* Info Cards - only when no messages */}
        {messages.length === 0 && (
          <div className="grid grid-cols-3 gap-3 mb-3 shrink-0">
            <GlassCard variant="subtle">
              <GlassCardContent className="p-3 text-center">
                <Lightbulb className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                <h3 className="font-medium text-xs">Step-by-Step Help</h3>
              </GlassCardContent>
            </GlassCard>
            <GlassCard variant="subtle">
              <GlassCardContent className="p-3 text-center">
                <AlertTriangle className="h-6 w-6 text-orange-500 mx-auto mb-1" />
                <h3 className="font-medium text-xs">No Direct Answers</h3>
              </GlassCardContent>
            </GlassCard>
            <GlassCard variant="subtle">
              <GlassCardContent className="p-3 text-center">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
                <h3 className="font-medium text-xs">Build Understanding</h3>
              </GlassCardContent>
            </GlassCard>
          </div>
        )}

        {/* Chat Area - flex-1 to fill remaining space */}
        <div className="flex-1 flex flex-col min-h-0 bg-card/50 rounded-2xl border border-border overflow-hidden">
          {/* Messages area */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">Type, paste, or speak your homework question below</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl ${
                        msg.role === "user" 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-card border border-border"
                      }`}>
                        <div className="flex items-start gap-2">
                          <div className="text-sm leading-relaxed flex-1 overflow-x-auto">
                            {msg.role === "assistant" ? <MarkdownContent content={msg.content} /> : msg.content}
                          </div>
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
                </>
              )}
            </div>
          </ScrollArea>

          {/* Input Area - fixed at bottom */}
          <div className="p-3 border-t border-border bg-background shrink-0">
            {/* File previews row */}
            {uploadedFiles.length > 0 && (
              <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                {uploadedFiles.map((uploadedFile, index) => (
                  <div
                    key={index}
                    className="relative shrink-0 h-14 w-14 rounded-lg border border-border overflow-hidden bg-muted"
                  >
                    {uploadedFile.type === "image" && uploadedFile.preview ? (
                      <img
                        src={uploadedFile.preview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="absolute top-0 right-0 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <FileUpload
                onFilesSelected={handleFilesSelected}
                uploadedFiles={[]}
                onRemoveFile={() => {}}
                disabled={isLoading}
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
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type, paste, or speak your homework question..."
                className="min-h-10 max-h-32 resize-none flex-1 py-2"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
              {isLoading && (
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
              <Button onClick={sendMessage} disabled={isLoading} size="icon" className="h-10 w-10 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
