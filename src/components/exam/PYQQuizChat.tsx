import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ArrowRight, RotateCcw, Trophy, Filter, Loader2 } from "lucide-react";
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
  type: "question" | "answer" | "feedback";
  content: string;
  isCorrect?: boolean;
  explanation?: string;
  correctAnswer?: string;
}

export function PYQQuizChat() {
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [questions, setQuestions] = useState<PYQQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isComplete, setIsComplete] = useState(false);

  // Filters
  const [examType, setExamType] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");
  const [year, setYear] = useState<string>("all");
  const [availableYears, setAvailableYears] = useState<number[]>([]);

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

      // Map and type-cast the data properly
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

      // Shuffle questions
      const shuffled = mappedQuestions.sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      setCurrentIndex(0);
      setMessages([]);
      setHasAnswered(false);
      setScore({ correct: 0, total: 0 });
      setIsComplete(false);

      if (shuffled.length > 0) {
        addQuestionMessage(shuffled[0]);
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

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addQuestionMessage = (question: PYQQuestion) => {
    const optionsText = Object.entries(question.options)
      .map(([key, value]) => `**${key}.** ${value}`)
      .join("\n\n");

    const content = `**Question ${currentIndex + 1}** (${question.exam_type} ${question.year})\n\n${question.question_text}\n\n${optionsText}`;

    setMessages((prev) => [...prev, { type: "question", content }]);
  };

  const handleAnswer = (option: string) => {
    if (hasAnswered) return;

    const currentQuestion = questions[currentIndex];
    const isCorrect = option === currentQuestion.correct_option;

    // Add answer message
    setMessages((prev) => [
      ...prev,
      {
        type: "answer",
        content: `You selected: **${option}**`,
      },
    ]);

    // Add feedback message
    setMessages((prev) => [
      ...prev,
      {
        type: "feedback",
        content: isCorrect ? "Correct! Well done! 🎉" : `Incorrect. The correct answer is **${currentQuestion.correct_option}**.`,
        isCorrect,
        explanation: currentQuestion.explanation || undefined,
        correctAnswer: currentQuestion.correct_option,
      },
    ]);

    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    setHasAnswered(true);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setHasAnswered(false);
      addQuestionMessage(questions[nextIndex]);
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

  const currentQuestion = questions[currentIndex];
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
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
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
      <GlassCard className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl p-4",
                  msg.type === "question" && "bg-muted/50",
                  msg.type === "answer" && "bg-primary/10 ml-8",
                  msg.type === "feedback" && (msg.isCorrect ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20")
                )}
              >
                {msg.type === "feedback" && (
                  <div className="flex items-center gap-2 mb-2">
                    {msg.isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                )}
                <MarkdownContent content={msg.content} />
                {msg.explanation && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Explanation:</p>
                    <MarkdownContent content={msg.explanation} />
                  </div>
                )}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Answer buttons */}
        {!isComplete && (
          <div className="p-4 border-t border-border">
            {!hasAnswered ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {["A", "B", "C", "D"].map((option) => (
                  <Button
                    key={option}
                    variant="outline"
                    onClick={() => handleAnswer(option)}
                    className="h-12 text-lg font-medium hover:bg-primary hover:text-primary-foreground"
                  >
                    {option}
                  </Button>
                ))}
              </div>
            ) : (
              <Button onClick={handleNext} className="w-full">
                {currentIndex < questions.length - 1 ? (
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
            )}
          </div>
        )}

        {/* Results */}
        {isComplete && (
          <div className="p-6 border-t border-border text-center">
            <Trophy className={cn(
              "h-12 w-12 mx-auto mb-4",
              scorePercent >= 70 ? "text-yellow-500" : scorePercent >= 50 ? "text-blue-500" : "text-muted-foreground"
            )} />
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
