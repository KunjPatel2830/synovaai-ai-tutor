import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, RotateCcw, Trophy, Filter, Loader2, Sparkles, Send, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/ui/markdown-content";

interface PYQQuestion {
  id: string;
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: string;
  subject: string;
  topic: string | null;
  explanation: string | null;
  difficulty: string | null;
  exam_type: string;
  year: number;
}

interface ChatMessage {
  type: "question" | "answer" | "feedback" | "ai-explanation" | "user-query" | "ai-response";
  content: string;
  isCorrect?: boolean;
  isStreaming?: boolean;
}

export function PYQQuizChat() {
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  const [questions, setQuestions] = useState<PYQQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isComplete, setIsComplete] = useState(false);

  // Follow-up question state
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);

  // Filters
  const [examType, setExamType] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");
  const [year, setYear] = useState<string>("all");
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const scrollToBottom = useCallback(() => {
    if (shouldScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, []);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from("pyq_questions").select("*");

      if (examType !== "all") query = query.eq("exam_type", examType);
      if (subject !== "all") query = query.eq("subject", subject);
      if (year !== "all") query = query.eq("year", parseInt(year));

      query = query.limit(20).order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      const mappedQuestions: PYQQuestion[] = (data || []).map((q) => ({
        id: q.id,
        question_text: q.question_text,
        options: q.options as unknown as { A: string; B: string; C: string; D: string },
        correct_option: q.correct_option,
        subject: q.subject,
        topic: q.topic,
        explanation: q.explanation,
        difficulty: q.difficulty,
        exam_type: q.exam_type,
        year: q.year,
      }));

      const shuffled = mappedQuestions.sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setCurrentIndex(0);
      setMessages([]);
      setHasAnswered(false);
      setIsExplaining(false);
      setScore({ correct: 0, total: 0 });
      setIsComplete(false);
      setFollowUpQuery("");

      if (shuffled.length > 0) {
        addQuestionMessage(shuffled[0], 0);
      }
    } catch (error) {
      console.error("Failed to fetch questions:", error);
      toast({ title: "Failed to load questions", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableYears = async () => {
    const { data } = await supabase
      .from("pyq_questions")
      .select("year")
      .order("year", { ascending: false });

    if (data) {
      const uniqueYears = [...new Set(data.map((d) => d.year))];
      setAvailableYears(uniqueYears);
    }
  };

  useEffect(() => {
    fetchQuestions();
    fetchAvailableYears();
  }, []);

  // Scroll to bottom when new messages are added (but not during streaming updates)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && !lastMessage.isStreaming) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const addQuestionMessage = (question: PYQQuestion, index: number) => {
    const optionsText = Object.entries(question.options)
      .map(([key, value]) => `**${key}.** ${value}`)
      .join("\n\n");

    const difficultyBadge = question.difficulty
      ? `\`${question.difficulty.toUpperCase()}\``
      : "";

    const content = `### Question ${index + 1} ${difficultyBadge}
**${question.exam_type} ${question.year}** • ${question.subject}${question.topic ? ` • ${question.topic}` : ""}

${question.question_text}

${optionsText}`;

    setMessages((prev) => [...prev, { type: "question", content }]);
  };

  const streamAIResponse = async (
    endpoint: string,
    body: Record<string, unknown>,
    messageType: "ai-explanation" | "ai-response",
    isCorrect?: boolean
  ) => {
    // Add placeholder for streaming response
    setMessages((prev) => [
      ...prev,
      {
        type: messageType,
        content: "",
        isStreaming: true,
        isCorrect,
      },
    ]);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast({ title: "Rate limited", description: "Please wait a moment and try again.", variant: "destructive" });
        } else if (response.status === 402) {
          toast({ title: "Credits exhausted", description: "Please add more credits.", variant: "destructive" });
        }
        throw new Error("Failed to get AI response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      if (reader) {
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulatedContent += content;
                // Use requestAnimationFrame for smoother updates
                requestAnimationFrame(() => {
                  setMessages((prev) =>
                    prev.map((m, i) =>
                      i === prev.length - 1
                        ? { ...m, content: accumulatedContent }
                        : m
                    )
                  );
                });
              }
            } catch {
              // Partial JSON, continue
            }
          }
        }
      }

      // Finalize streaming
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, isStreaming: false, content: accumulatedContent }
            : m
        )
      );

      // Scroll to bottom after streaming completes
      setTimeout(scrollToBottom, 100);

      return accumulatedContent;
    } catch (error) {
      console.error("AI response error:", error);
      // Show error in message
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? {
                ...m,
                content: "Sorry, I couldn't generate a response. Please try again.",
                isStreaming: false,
              }
            : m
        )
      );
      return null;
    }
  };

  const streamExplanation = async (question: PYQQuestion, studentAnswer: string, isCorrect: boolean) => {
    setIsExplaining(true);

    await streamAIResponse(
      "pyq-explain",
      {
        question: question.question_text,
        options: question.options,
        correctOption: question.correct_option,
        studentAnswer,
        subject: question.subject,
        topic: question.topic,
        examType: question.exam_type,
      },
      "ai-explanation",
      isCorrect
    );

    setIsExplaining(false);
  };

  const handleAskFollowUp = async () => {
    if (!followUpQuery.trim() || isAskingFollowUp) return;

    const currentQuestion = questions[currentIndex];
    const query = followUpQuery.trim();
    setFollowUpQuery("");
    setIsAskingFollowUp(true);

    // Add user's question to chat
    setMessages((prev) => [
      ...prev,
      { type: "user-query", content: query },
    ]);

    await streamAIResponse(
      "pyq-explain",
      {
        question: currentQuestion.question_text,
        options: currentQuestion.options,
        correctOption: currentQuestion.correct_option,
        studentAnswer: "follow-up",
        subject: currentQuestion.subject,
        topic: currentQuestion.topic,
        examType: currentQuestion.exam_type,
        followUpQuery: query,
      },
      "ai-response"
    );

    setIsAskingFollowUp(false);
  };

  const handleAnswer = async (option: string) => {
    if (hasAnswered || isExplaining) return;

    const currentQuestion = questions[currentIndex];
    const isCorrect = option === currentQuestion.correct_option;

    // Add answer message
    setMessages((prev) => [
      ...prev,
      {
        type: "answer",
        content: `Your answer: **${option}. ${currentQuestion.options[option as keyof typeof currentQuestion.options]}**`,
      },
    ]);

    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    setHasAnswered(true);

    // Stream AI explanation
    await streamExplanation(currentQuestion, option, isCorrect);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setHasAnswered(false);
      setIsExplaining(false);
      setFollowUpQuery("");
      shouldScrollRef.current = true;
      addQuestionMessage(questions[nextIndex], nextIndex);
    } else {
      setIsComplete(true);
    }
  };

  const handleRestart = () => {
    fetchQuestions();
  };

  const handleApplyFilters = () => {
    fetchQuestions();
  };

  // Handle scroll events to detect manual scrolling
  const handleScroll = useCallback(() => {
    if (scrollAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      shouldScrollRef.current = isNearBottom;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <GlassCard className="text-center py-12">
        <GlassCardContent>
          <p className="text-muted-foreground mb-4">No PYQ questions available yet.</p>
          <p className="text-sm text-muted-foreground">
            Ask your teacher to upload previous year question papers.
          </p>
        </GlassCardContent>
      </GlassCard>
    );
  }

  const scorePercent = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={examType} onValueChange={setExamType}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Exam Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exams</SelectItem>
            <SelectItem value="JEE">JEE</SelectItem>
            <SelectItem value="JEE Main">JEE Main</SelectItem>
            <SelectItem value="JEE Advanced">JEE Advanced</SelectItem>
            <SelectItem value="NEET">NEET</SelectItem>
          </SelectContent>
        </Select>

        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            <SelectItem value="Physics">Physics</SelectItem>
            <SelectItem value="Chemistry">Chemistry</SelectItem>
            <SelectItem value="Mathematics">Mathematics</SelectItem>
            <SelectItem value="Biology">Biology</SelectItem>
          </SelectContent>
        </Select>

        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleApplyFilters}>
          Apply
        </Button>
      </div>

      {/* Score display */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-sm">
          Score: {score.correct}/{score.total} ({scorePercent}%)
        </Badge>
        <span className="text-sm text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </span>
      </div>

      {/* Chat area */}
      <GlassCard className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ScrollArea 
          className="flex-1 p-4"
          onScrollCapture={handleScroll}
        >
          <div 
            ref={scrollAreaRef}
            className="space-y-4"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl p-4",
                  msg.type === "question" && "bg-muted/50 border border-border",
                  msg.type === "answer" && "bg-primary/10 ml-8 border border-primary/20",
                  msg.type === "user-query" && "bg-secondary/30 ml-8 border border-secondary/30",
                  (msg.type === "ai-explanation" || msg.type === "ai-response") &&
                    "bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/20"
                )}
              >
                {msg.type === "user-query" && (
                  <div className="flex items-center gap-2 mb-2 text-secondary-foreground">
                    <HelpCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Your Question</span>
                  </div>
                )}
                {(msg.type === "ai-explanation" || msg.type === "ai-response") && (
                  <div className="flex items-center gap-2 mb-3 text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {msg.type === "ai-explanation" ? "AI Explanation" : "AI Response"}
                    </span>
                    {msg.isStreaming && <Loader2 className="h-3 w-3 animate-spin" />}
                  </div>
                )}
                <MarkdownContent content={msg.content || (msg.isStreaming ? "Generating response..." : "")} />
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Answer buttons or follow-up input */}
        {!isComplete && (
          <div className="p-4 border-t border-border space-y-3">
            {!hasAnswered ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {["A", "B", "C", "D"].map((option) => (
                  <Button
                    key={option}
                    variant="outline"
                    onClick={() => handleAnswer(option)}
                    disabled={isExplaining}
                    className="h-12 text-lg font-medium hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    {option}
                  </Button>
                ))}
              </div>
            ) : (
              <>
                {/* Follow-up question input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Still confused? Ask a follow-up question..."
                    value={followUpQuery}
                    onChange={(e) => setFollowUpQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAskFollowUp()}
                    disabled={isExplaining || isAskingFollowUp}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleAskFollowUp}
                    disabled={!followUpQuery.trim() || isExplaining || isAskingFollowUp}
                  >
                    {isAskingFollowUp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Next button */}
                <Button
                  onClick={handleNext}
                  className="w-full"
                  disabled={isExplaining || isAskingFollowUp}
                >
                  {isExplaining || isAskingFollowUp ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isAskingFollowUp ? "Answering..." : "Generating explanation..."}
                    </>
                  ) : currentIndex < questions.length - 1 ? (
                    <>
                      Next Question
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    <>
                      See Results
                      <Trophy className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Results */}
        {isComplete && (
          <div className="p-6 border-t border-border text-center">
            <Trophy
              className={cn(
                "h-12 w-12 mx-auto mb-4",
                scorePercent >= 70
                  ? "text-yellow-500"
                  : scorePercent >= 50
                  ? "text-blue-500"
                  : "text-muted-foreground"
              )}
            />
            <h3 className="text-2xl font-bold mb-2">Quiz Complete!</h3>
            <p className="text-lg text-muted-foreground mb-4">
              You scored {score.correct} out of {score.total} ({scorePercent}%)
            </p>
            <Button onClick={handleRestart}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Practice Again
            </Button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
