import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { Globe, Send, Volume2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { TypingMarkdown } from "@/components/chat/TypingMarkdown";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const languages = [
  { code: "Hindi", name: "हिंदी (Hindi)" },
  { code: "Spanish", name: "Español (Spanish)" },
  { code: "French", name: "Français (French)" },
  { code: "German", name: "Deutsch (German)" },
  { code: "Chinese", name: "中文 (Mandarin Chinese)" },
  { code: "Arabic", name: "العربية (Arabic)" },
  { code: "Portuguese", name: "Português (Portuguese)" },
  { code: "Japanese", name: "日本語 (Japanese)" },
  { code: "Korean", name: "한국어 (Korean)" },
  { code: "Italian", name: "Italiano (Italian)" },
  { code: "Russian", name: "Русский (Russian)" },
  { code: "Tamil", name: "தமிழ் (Tamil)" },
  { code: "Telugu", name: "తెలుగు (Telugu)" },
  { code: "Bengali", name: "বাংলা (Bengali)" },
  { code: "Marathi", name: "मराठी (Marathi)" },
];

const levels = [
  { value: "absolute_beginner", label: "Absolute Beginner (Zero knowledge)" },
  { value: "beginner", label: "Beginner (Know basics)" },
  { value: "intermediate", label: "Intermediate (Can form sentences)" },
  { value: "advanced", label: "Advanced (Conversational)" },
];

export default function LanguagePractice() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("Spanish");
  const [selectedLevel, setSelectedLevel] = useState("absolute_beginner");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      // Strip markdown for speech
      const clean = text.replace(/[*#_~`>|[\]()!]/g, "").replace(/\n+/g, ". ");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 0.75;
      window.speechSynthesis.speak(utterance);
    }
  };

  const sendMessage = async (userContent: string) => {
    const conversationHistory = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userContent },
    ];

    setMessages((prev) => [...prev, { role: "user", content: userContent }]);
    setIsLoading(true);

    const result = await invokeBackendFunction<{ reply: string }>(
      "language-practice",
      {
        messages: conversationHistory,
        targetLanguage: selectedLanguage,
        level: selectedLevel,
      },
      { timeoutMs: 30000, label: "language-practice" }
    );

    setIsLoading(false);

    if (result.ok && result.data?.reply) {
      const reply = result.data.reply;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (autoSpeak) speakText(reply);
    } else {
      toast.error(result.error || "Failed to get response. Please try again.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    }
  };

  const handleStart = async () => {
    setHasStarted(true);
    setMessages([]);
    await sendMessage(
      `I want to learn ${selectedLanguage} from scratch. I'm an ${selectedLevel.replace(/_/g, " ")}. Please start teaching me from the very beginning — start with the alphabet/script and basic sounds.`
    );
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    await sendMessage(text);
  };

  const handleReset = () => {
    setHasStarted(false);
    setMessages([]);
    window.speechSynthesis?.cancel();
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-1rem)] flex flex-col w-full">
        {/* Header */}
        <GlassCard className="mb-2 shrink-0">
          <GlassCardHeader className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <GlassCardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="text-xl">Language Practice</span>
                  <p className="text-sm text-muted-foreground font-normal">
                    Learn from alphabets to fluency
                  </p>
                </div>
              </GlassCardTitle>

              <div className="flex items-center gap-3 flex-wrap">
                <Select value={selectedLanguage} onValueChange={(v) => { setSelectedLanguage(v); if (hasStarted) handleReset(); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasStarted && (
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </GlassCardHeader>

          <GlassCardContent className="pt-0 pb-4">
            <div className="flex items-center gap-6 flex-wrap">
              <Select value={selectedLevel} onValueChange={(v) => { setSelectedLevel(v); if (hasStarted) handleReset(); }}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select your level" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Switch id="auto-speak" checked={autoSpeak} onCheckedChange={setAutoSpeak} />
                <Label htmlFor="auto-speak" className="text-sm">Auto-Speak</Label>
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Chat / Start Screen */}
        <GlassCard className="flex-1 flex flex-col overflow-hidden">
          {!hasStarted ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-md space-y-6">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Globe className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Learn {selectedLanguage}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Start from the very basics — alphabets, sounds, pronunciation, and build up to words and sentences step by step.
                  </p>
                </div>
                <Button size="lg" onClick={handleStart} className="px-8">
                  Start Learning
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 p-2.5 sm:p-4">
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[92%] sm:max-w-[85%] p-3 sm:p-4 rounded-2xl ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 border border-border"
                        }`}
                      >
                        {message.role === "assistant" ? (
                          idx === messages.length - 1 && !loading ? (
                            <TypingMarkdown content={message.content} />
                          ) : (
                            <MarkdownContent content={message.content} />
                          )
                        ) : (
                          <p className="text-base leading-relaxed">{message.content}</p>
                        )}
                        {message.role === "assistant" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => speakText(message.content)}
                          >
                            <Volume2 className="h-4 w-4 mr-2" />
                            Listen
                          </Button>
                        )}
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
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 border-t border-border/50">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your answer or ask a question..."
                    className="min-h-10 max-h-48 resize-none overflow-y-auto"
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
                    className="h-full"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </AppLayout>
  );
}
