import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useVoice } from "@/hooks/useVoice";
import { useProgressTracker } from "@/hooks/useProgressTracker";
import { useCurriculumPreference } from "@/hooks/useCurriculumPreference";
import { VoiceControls } from "@/components/voice/VoiceControls";
import { ChatHistory } from "@/components/chat/ChatHistory";
import { PYQQuizChat } from "@/components/exam/PYQQuizChat";
import { PYQUploader } from "@/components/exam/PYQUploader";
import { PYQUploadHistory } from "@/components/exam/PYQUploadHistory";
import { NeedsHelpTab } from "@/components/exam/NeedsHelpTab";
import { ClipboardList, Play, CheckCircle, XCircle, RotateCcw, Trophy, Mic, MicOff, Volume2, History, BookOpen, Upload, HelpCircle } from "lucide-react";
import { Loader, LoaderSpinner } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { getExternalAccessToken } from "@/lib/external-auth";

interface Question {
  id: number;
  type: "multiple_choice" | "short_answer";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

interface Answer {
  questionId: number;
  answer: string;
}

type ExamState = "setup" | "quiz" | "results";
type ExamMode = "ai" | "pyq" | "upload" | "help";

export default function ExamPrep() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const isTeacher = userRole === "teacher" || userRole === "admin";
  const [mode, setMode] = useState<ExamMode>(isTeacher ? "upload" : "ai");
  const [state, setState] = useState<ExamState>("setup");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  
  const { curriculum, setCurriculum } = useCurriculumPreference();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [linkedStudentIds, setLinkedStudentIds] = useState<string[]>([]);

  // Fetch linked students for teachers
  useEffect(() => {
    if (isTeacher && user) {
      fetchLinkedStudents();
    }
  }, [isTeacher, user]);

  const fetchLinkedStudents = async () => {
    if (!user) return;
    try {
      const { data } = await externalSupabase
        .from("teacher_student_links")
        .select("student_id")
        .eq("teacher_id", user.id);
      
      setLinkedStudentIds((data || []).map((d) => d.student_id));
    } catch (error) {
      console.error("Failed to fetch linked students:", error);
    }
  };

  const voice = useVoice();
  const { trackProgress, trackHelpRequest } = useProgressTracker();

  // Sync voice transcript to current answer/topic
  useEffect(() => {
    if (voice.transcript) {
      if (state === "setup") {
        setTopic((prev) => prev + voice.transcript);
      } else if (state === "quiz") {
        setCurrentAnswer((prev) => prev + voice.transcript);
      }
      voice.clearTranscript();
    }
  }, [voice.transcript, voice.clearTranscript, state]);

  // Auto-speak questions
  const lastSpokenRef = useRef<string>("");
  useEffect(() => {
    if (state === "quiz" && questions[currentQuestion] && voice.autoSpeak) {
      const q = questions[currentQuestion];
      const textToSpeak = q.type === "multiple_choice" && q.options
        ? `${q.question}. Options: ${q.options.join(". ")}`
        : q.question;
      
      if (textToSpeak !== lastSpokenRef.current) {
        lastSpokenRef.current = textToSpeak;
        voice.speak(textToSpeak);
      }
    }
  }, [currentQuestion, questions, state, voice.autoSpeak, voice.speak]);

  // Auto-speak results
  useEffect(() => {
    if (state === "results" && results && voice.autoSpeak) {
      const resultText = `You scored ${results.score} percent. You got ${results.correct} out of ${results.total} questions correct.`;
      voice.speak(resultText);
    }
  }, [state, results, voice.autoSpeak, voice.speak]);

  // Save exam session to database
  const saveExamSession = async (score: number) => {
    if (!user) return;
    
    try {
      const { data: session, error } = await externalSupabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          mode: "exam",
          subject: subject,
          topic: `${topic} (Score: ${score}%)`,
        })
        .select("id")
        .single();

      if (error) throw error;

      await externalSupabase.from("chat_messages").insert([
        { session_id: session.id, role: "user", content: `Exam: ${topic} - ${difficulty}` },
        { session_id: session.id, role: "assistant", content: `Score: ${score}%` },
      ]);
    } catch (error) {
      console.error("Failed to save exam session:", error);
    }
  };

  const startQuiz = async () => {
    if (!subject || !topic.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await invokeBackendFunction<{ questions: Question[] }>(
        "exam-prep",
        { action: "generate_questions", subject, topic, difficulty, curriculum },
        { timeoutMs: 30000, retries: 1, label: "exam:generate" }
      );

      if (!res.ok) throw new Error(res.error || "Failed");

      if (res.data?.questions) {
        setQuestions(res.data.questions);
        setState("quiz");
        setCurrentQuestion(0);
        setAnswers([]);
        lastSpokenRef.current = "";
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      toast({ title: "Failed to generate questions", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = () => {
    if (!currentAnswer.trim()) {
      toast({ title: "Please provide an answer", variant: "destructive" });
      return;
    }

    const newAnswers = [...answers, { questionId: questions[currentQuestion].id, answer: currentAnswer }];
    setAnswers(newAnswers);
    setCurrentAnswer("");

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      evaluateQuiz(newAnswers);
    }
  };

  const evaluateQuiz = async (finalAnswers: Answer[]) => {
    setIsLoading(true);
    try {
      let correct = 0;
      const feedback = questions.map((q, i) => {
        const userAnswer = finalAnswers.find(a => a.questionId === q.id)?.answer || "";
        const isCorrect = userAnswer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim() ||
          (q.type === "multiple_choice" && userAnswer.toUpperCase() === q.correctAnswer.toUpperCase());
        if (isCorrect) correct++;
        return {
          questionId: q.id,
          correct: isCorrect,
          userAnswer,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        };
      });

      const score = Math.round((correct / questions.length) * 100);
      
      // Track progress with the exam score
      await trackProgress(`Exam: ${topic}`, subject, score);
      
      // Track help request for questions they got wrong
      const wrongQuestions = feedback.filter(f => !f.correct);
      for (const wrong of wrongQuestions) {
        const q = questions.find(q => q.id === wrong.questionId);
        if (q) {
          await trackHelpRequest(q.question, subject, topic, "exam");
        }
      }

      setResults({
        score,
        feedback,
        correct,
        total: questions.length,
      });
      
      // Save exam session
      await saveExamSession(score);
      
      setState("results");
    } catch (error) {
      toast({ title: "Failed to evaluate", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const resetQuiz = () => {
    setState("setup");
    setQuestions([]);
    setCurrentQuestion(0);
    setAnswers([]);
    setResults(null);
    setCurrentAnswer("");
    lastSpokenRef.current = "";
  };

  if (state === "setup") {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
          {/* Compact Header Row */}
          <div className="flex items-center justify-between gap-4 mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold text-foreground">Exam Prep</h1>
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

          {/* Tabs for different modes - Different UI for Teachers vs Students */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as ExamMode)} className="flex-1 flex flex-col min-h-0">
            {isTeacher ? (
              /* Teacher View: Upload PYQ and Needs Help tabs */
              <>
                <TabsList className="grid w-full grid-cols-2 shrink-0">
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload PYQ
                  </TabsTrigger>
                  <TabsTrigger value="help" className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Needs Help
                  </TabsTrigger>
                </TabsList>

                {/* Upload Tab */}
                <TabsContent value="upload" className="flex-1 mt-4 overflow-auto space-y-4">
                  {user && (
                    <>
                      <PYQUploader userId={user.id} />
                      <PYQUploadHistory userId={user.id} />
                    </>
                  )}
                </TabsContent>

                {/* Needs Help Tab */}
                <TabsContent value="help" className="flex-1 mt-4 overflow-auto">
                  <NeedsHelpTab linkedStudentIds={linkedStudentIds} />
                </TabsContent>
              </>
            ) : (
              /* Student View: AI Quiz and PYQ Practice tabs */
              <>
                <TabsList className="grid w-full grid-cols-2 shrink-0">
                  <TabsTrigger value="ai" className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    AI Quiz
                  </TabsTrigger>
                  <TabsTrigger value="pyq" className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    JEE/NEET PYQ
                  </TabsTrigger>
                </TabsList>

                {/* AI Quiz Tab */}
                <TabsContent value="ai" className="flex-1 mt-4 overflow-visible">
                  <GlassCard>
                    <GlassCardContent className="p-4 space-y-4">
                      <div className="flex justify-end">
                        <ChatHistory mode="exam" onLoadSession={() => {}} />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Curriculum</Label>
                        <Select value={curriculum} onValueChange={setCurriculum}>
                          <SelectTrigger><SelectValue placeholder="Select curriculum" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CBSE">CBSE</SelectItem>
                            <SelectItem value="NCERT">NCERT</SelectItem>
                            <SelectItem value="ICSE">ICSE</SelectItem>
                            <SelectItem value="Cambridge">Cambridge (IGCSE/A-Level)</SelectItem>
                            <SelectItem value="IB">International Baccalaureate (IB)</SelectItem>
                            <SelectItem value="State Board">State Board</SelectItem>
                            <SelectItem value="General">General / Other</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <Label className="text-sm">Topic / Chapter</Label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="e.g., Photosynthesis, Thermodynamics" 
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
                        <Label className="text-sm">Difficulty</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button className="w-full" onClick={startQuiz} disabled={isLoading}>
                        {isLoading ? <LoaderSpinner size="sm" className="mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                        Start AI Practice Test
                      </Button>
                    </GlassCardContent>
                  </GlassCard>
                </TabsContent>

                {/* PYQ Practice Tab */}
                <TabsContent value="pyq" className="flex-1 mt-4 flex flex-col min-h-0">
                  <PYQQuizChat />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </AppLayout>
    );
  }

  if (state === "quiz") {
    const question = questions[currentQuestion];
    const progress = ((currentQuestion) / questions.length) * 100;

    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                Q{currentQuestion + 1}/{questions.length}
              </span>
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

          {/* Progress */}
          <div className="mb-3 shrink-0">
            <Progress value={progress} className="h-2" />
          </div>

          {/* Question Card - fills remaining space */}
          <div className="flex-1 flex flex-col min-h-0 bg-card/50 rounded-2xl border border-border overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                      {question.type === "multiple_choice" ? "Multiple Choice" : "Short Answer"}
                    </span>
                    <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">
                      {difficulty}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => voice.speak(question.question)}
                    className="h-8 w-8"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-lg font-medium text-foreground mb-6">{question.question}</p>

                {question.type === "multiple_choice" && question.options ? (
                  <RadioGroup value={currentAnswer} onValueChange={setCurrentAnswer} className="space-y-2">
                    {question.options.map((option, i) => (
                      <div key={i} className="flex items-center space-x-3 p-3 rounded-xl border border-border hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value={option} id={`option-${i}`} />
                        <Label htmlFor={`option-${i}`} className="flex-1 cursor-pointer text-sm">{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      placeholder="Type or speak your answer..."
                      className="h-10 flex-1"
                    />
                    <Button
                      type="button"
                      variant={voice.isListening ? "destructive" : "outline"}
                      size="icon"
                      onClick={voice.isListening ? voice.stopListening : voice.startListening}
                      className={cn("h-10 w-10 shrink-0", voice.isListening && "animate-pulse")}
                    >
                      {voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Submit button - fixed at bottom */}
            <div className="p-3 border-t border-border bg-background shrink-0">
              <Button className="w-full" onClick={submitAnswer} disabled={isLoading}>
                {currentQuestion < questions.length - 1 ? "Next Question" : "Submit Quiz"}
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (state === "results" && results) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                results.score >= 70 ? "bg-green-500/20" : results.score >= 50 ? "bg-yellow-500/20" : "bg-red-500/20"
              }`}>
                <Trophy className={`h-5 w-5 ${
                  results.score >= 70 ? "text-green-500" : results.score >= 50 ? "text-yellow-500" : "text-red-500"
                }`} />
              </div>
              <div>
                <span className="text-2xl font-bold text-foreground">{results.score}%</span>
                <p className="text-xs text-muted-foreground">{results.correct}/{results.total} correct</p>
              </div>
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

          {/* Answers Review - scrollable */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="bg-card/50 rounded-2xl border border-border p-4 space-y-3">
              <h3 className="font-semibold text-foreground mb-2">Review Answers</h3>
              {results.feedback.map((item: any, i: number) => (
                <div key={i} className={`p-3 rounded-xl border ${
                  item.correct ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
                }`}>
                  <div className="flex items-start gap-2">
                    {item.correct ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-foreground text-sm mb-1">{questions[i]?.question}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => voice.speak(`${questions[i]?.question}. ${item.explanation}`)}
                        >
                          <Volume2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Your answer: <span className={item.correct ? "text-green-600" : "text-red-600"}>{item.userAnswer}</span>
                      </p>
                      {!item.correct && (
                        <p className="text-xs text-muted-foreground">
                          Correct: <span className="text-green-600">{item.correctAnswer}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 italic">{item.explanation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Action buttons - fixed at bottom */}
          <div className="flex gap-3 pt-3 shrink-0">
            <Button variant="outline" className="flex-1" onClick={resetQuiz}>
              <RotateCcw className="h-4 w-4 mr-2" />
              New Quiz
            </Button>
            <Button className="flex-1" onClick={() => { resetQuiz(); startQuiz(); }}>
              <Play className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return null;
}
