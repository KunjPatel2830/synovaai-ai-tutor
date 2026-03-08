import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { HelpCircle, Send, Mic, MicOff, Volume2, BookOpen, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useLearningHistory } from "@/hooks/useLearningHistory";
import { cn } from "@/lib/utils";
import { TypingMarkdown } from "@/components/chat/TypingMarkdown";
import { Badge } from "@/components/ui/badge";

interface Message {
  role: "user" | "assistant";
  content: string;
  detectedSubject?: string;
  detectedTopic?: string;
}

export default function DoubtSolver() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your Doubt Solver. Ask me any question and I'll give you a clear, concise answer. Need an example? Just ask!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { getAIContext } = useStudentProfile();
  const { trackLearning, getMemoryContext } = useLearningHistory();

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [messages]);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleSubmit = async () => {
    const userMessage = input.trim();
    if (!userMessage || isLoading) return;

    setInput("");
    const updatedMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(updatedMessages);
    setIsLoading(true);
    const controller = new AbortController();

    try {
      const res = await invokeBackendFunction<{ reply: string; detectedSubject?: string; detectedTopic?: string }>(
        "ai-tutor",
        {
          messages: updatedMessages.map((msg) => ({ role: msg.role, content: msg.content })),
          mode: "doubt",
          studentContext: getAIContext(),
          memoryContext: getMemoryContext(),
        },
        { signal: controller.signal, timeoutMs: 20000, retries: 1, label: "doubt:chat" }
      );

      if (!res.ok) throw new Error(res.error || "Failed");
      
      const reply = res.data?.reply || "I understand your question. Let me help you with that.";
      const detectedSubject = res.data?.detectedSubject || "";
      const detectedTopic = res.data?.detectedTopic || "";
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: reply,
        detectedSubject,
        detectedTopic,
      }]);

      // Track learning in background
      if (detectedSubject && detectedSubject !== "General") {
        trackLearning({
          subject: detectedSubject,
          topic: detectedTopic || undefined,
          question: userMessage,
          status: "solved",
          mode: "doubt",
        }).catch(() => {});
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process that. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-1rem)] flex flex-col w-full">
        {/* Header */}
        <GlassCard className="mb-2 shrink-0">
          <GlassCardHeader className="py-4">
            <GlassCardTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-xl">Doubt Solver</span>
                <p className="text-sm text-muted-foreground font-normal">Quick answers to your questions</p>
              </div>
            </GlassCardTitle>
          </GlassCardHeader>
        </GlassCard>

        {/* Chat Area */}
        <GlassCard className="flex-1 flex flex-col overflow-hidden min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-2.5 sm:p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] sm:max-w-[85%] rounded-2xl ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground p-3 sm:p-4"
                        : "bg-muted/50 border border-border"
                    }`}
                  >
                    {/* Subject/Topic tags for assistant messages */}
                    {message.role === "assistant" && (message.detectedSubject || message.detectedTopic) && (
                      <div className="flex flex-wrap gap-1.5 px-3 pt-3 pb-0 sm:px-4 sm:pt-3">
                        {message.detectedSubject && message.detectedSubject !== "General" && (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs gap-1 font-medium">
                            <BookOpen className="h-3 w-3" />
                            {message.detectedSubject}
                          </Badge>
                        )}
                        {message.detectedTopic && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs gap-1 font-medium">
                            <Tag className="h-3 w-3" />
                            {message.detectedTopic}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className={cn(
                      "flex items-start gap-2",
                      message.role === "assistant" ? "p-3 sm:p-4" : ""
                    )}>
                      {message.role === "user" ? (
                        <p className="whitespace-pre-line flex-1">{message.content}</p>
                      ) : (
                        <MarkdownContent content={message.content} className="flex-1" enableImageGeneration={true} />
                      )}
                      {message.role === "assistant" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => speakText(message.content)}
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
                  <div className="bg-muted/50 border border-border p-4 rounded-2xl max-w-[80%] space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t border-border/50 shrink-0">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={handleVoiceInput}
                className={cn("shrink-0 h-10 w-10", isListening && "animate-pulse")}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your doubt..."
                className="min-h-10 max-h-48 resize-none flex-1 overflow-y-auto"
                rows={1}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 192) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className="h-auto"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppLayout>
  );
}
