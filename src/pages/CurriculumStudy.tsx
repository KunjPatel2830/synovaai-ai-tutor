import { useState, useRef, useEffect, useCallback } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { externalSupabase } from "@/lib/external-supabase";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useVoice } from "@/hooks/useVoice";
import { useRateLimiter } from "@/hooks/useRateLimiter";
import { useProgressTracker } from "@/hooks/useProgressTracker";
import { useCurriculumStudyProgress } from "@/hooks/useCurriculumStudyProgress";
import { useCurriculumPreference } from "@/hooks/useCurriculumPreference";
import { VoiceControls } from "@/components/voice/VoiceControls";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { 
  BookOpen, Send, ArrowLeft, ArrowRight, CheckCircle2, 
  Clock, ChevronRight, Play, RotateCcw, Loader2, Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Chapter {
  number: number;
  name: string;
  topicsCount: number;
}

interface Topic {
  index: number;
  name: string;
  description: string;
  estimatedMinutes: number;
}

type StudyPhase = "setup" | "select-subject" | "select-chapter" | "studying";

const CURRICULA = [
  { value: "CBSE", label: "CBSE" },
  { value: "NCERT", label: "NCERT" },
  { value: "ICSE", label: "ICSE" },
  { value: "GSEB", label: "GSEB (Gujarat)" },
  { value: "Maharashtra Board", label: "Maharashtra Board" },
  { value: "Cambridge", label: "Cambridge (IGCSE/A-Level)" },
  { value: "IB", label: "International Baccalaureate" },
  { value: "State Board", label: "Other State Board" },
];

const STANDARDS = [
  "6th", "7th", "8th", "9th", "10th", "11th", "12th"
];

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", 
  "Science", "Social Studies", "History", "Geography",
  "Economics", "Computer Science", "English", "Hindi"
];

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function buildCacheKey(parts: Array<string | number | null | undefined>) {
  return [
    "cs-cache",
    ...parts.map((p) => String(p ?? "").trim().replace(/\s+/g, "_")),
  ].join(":");
}

function readCache<T>(key: string): T | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v: T; t: number };
    if (!parsed?.t || Date.now() - parsed.t > CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.v;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify({ v: value, t: Date.now() }));
  } catch {
    // ignore (storage full / blocked)
  }
}

async function getInvokeErrorMessage(error: unknown): Promise<string> {
  // Function returned non-2xx
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      const msg = (body?.error || body?.message || "Function error") as string;
      return typeof msg === "string" ? msg : JSON.stringify(body);
    } catch {
      return "Function error";
    }
  }

  if (error instanceof Error) return error.message;
  return String(error);
}

export default function CurriculumStudy() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Phase and selection states
  const [phase, setPhase] = useState<StudyPhase>("setup");
  const { curriculum, setCurriculum } = useCurriculumPreference();
  const [standard, setStandard] = useState("12th");
  const [subject, setSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  
  // Chapter and topic states
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  
  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const voice = useVoice();
  const { waitForRateLimit } = useRateLimiter({ minDelayMs: 500 });
  const { trackProgress } = useProgressTracker();
  const { recentProgress, saveProgress, getChapterProgress, getMostRecentSubject } = useCurriculumStudyProgress();

  // Auto-scroll to latest message
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
  const cleanForSpeech = useCallback((text: string) => {
    // Strip markdown-ish characters so TTS doesn't read "hashtag", "star", etc.
    return text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/[#*_`>]+/g, "")
      .replace(/\$+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

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
      voice.speak(cleanForSpeech(lastMessage.content));
    }
  }, [messages, voice.autoSpeak, voice.speak, cleanForSpeech]);

  // Load chapters for selected subject
  const loadChapters = async () => {
    if (!subject) return;

    const cacheKey = buildCacheKey(["chapters", curriculum, standard, subject]);
    const cached = readCache<Chapter[]>(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setChapters(cached);
      setPhase("select-chapter");
      return;
    }

    setIsLoadingChapters(true);
    try {
      await waitForRateLimit();

      const { data: sessionData } = await externalSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) throw new Error("No session token");

      const response = await supabase.functions.invoke("curriculum-study", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          action: "get_chapters",
          curriculum,
          standard,
          subject,
        },
      });

      if (response.error) throw response.error;

      if (response.data?.data && Array.isArray(response.data.data)) {
        setChapters(response.data.data);
        writeCache(cacheKey, response.data.data);
        setPhase("select-chapter");
      } else {
        throw new Error("Invalid chapter data");
      }
    } catch (error) {
      console.error("Failed to load chapters:", error);
      const msg = await getInvokeErrorMessage(error);
      toast({ title: "Failed to load chapters", description: msg, variant: "destructive" });
    } finally {
      setIsLoadingChapters(false);
    }
  };

  // Load topics for selected chapter
  const loadTopics = async (chapter: Chapter) => {
    setSelectedChapter(chapter);

    const cacheKey = buildCacheKey(["topics", curriculum, standard, subject, chapter.name]);
    const cached = readCache<Topic[]>(cacheKey);

    if (cached && Array.isArray(cached) && cached.length > 0) {
      setTopics(cached);

      // Check for existing progress
      const existingProgress = await getChapterProgress(curriculum, standard, subject, chapter.name);
      if (existingProgress) {
        setCurrentTopicIndex(existingProgress.current_topic_index);
        setCompletedTopics(existingProgress.completed_topics || []);

        toast({
          title: "Resuming from where you left",
          description: `Continuing from topic ${existingProgress.current_topic_index + 1}`,
        });
      } else {
        setCurrentTopicIndex(0);
        setCompletedTopics([]);
      }

      setPhase("studying");
      await teachCurrentTopic(cached, existingProgress?.current_topic_index || 0, chapter.name);
      return;
    }

    setIsLoadingTopics(true);

    try {
      await waitForRateLimit();

      const { data: sessionData } = await externalSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) throw new Error("No session token");

      const response = await supabase.functions.invoke("curriculum-study", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          action: "get_topics",
          curriculum,
          standard,
          subject,
          chapter: chapter.name,
        },
      });

      if (response.error) throw response.error;

      if (response.data?.data && Array.isArray(response.data.data)) {
        setTopics(response.data.data);
        writeCache(cacheKey, response.data.data);

        // Check for existing progress
        const existingProgress = await getChapterProgress(curriculum, standard, subject, chapter.name);
        if (existingProgress) {
          setCurrentTopicIndex(existingProgress.current_topic_index);
          setCompletedTopics(existingProgress.completed_topics || []);

          toast({
            title: "Resuming from where you left",
            description: `Continuing from topic ${existingProgress.current_topic_index + 1}`,
          });
        } else {
          setCurrentTopicIndex(0);
          setCompletedTopics([]);
        }

        setPhase("studying");
        await teachCurrentTopic(response.data.data, existingProgress?.current_topic_index || 0, chapter.name);
      } else {
        throw new Error("Invalid topic data");
      }
    } catch (error) {
      console.error("Failed to load topics:", error);
      const msg = await getInvokeErrorMessage(error);
      toast({ title: "Failed to load topics", description: msg, variant: "destructive" });
      setSelectedChapter(null);
    } finally {
      setIsLoadingTopics(false);
    }
  };

  // Teach the current topic
  const teachCurrentTopic = async (
    topicsList: Topic[] = topics,
    topicIndex: number = currentTopicIndex,
    chapterNameOverride?: string
  ) => {
    if (topicsList.length === 0) return;

    const chapterName = chapterNameOverride ?? selectedChapter?.name;
    if (!chapterName) return;

    const currentTopic = topicsList[topicIndex];
    if (!currentTopic) return;

    setIsLoading(true);
    setMessages([]);

    try {
      await waitForRateLimit();

      const { data: sessionData } = await externalSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) throw new Error("No session token");

      const action = completedTopics.length > 0 ? "continue_learning" : "teach_topic";

      const response = await supabase.functions.invoke("curriculum-study", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          action,
          curriculum,
          standard,
          subject,
          chapter: chapterName,
          currentTopic: currentTopic.name,
          completedTopics,
        },
      });

      if (response.error) throw response.error;

      setMessages([{ role: "assistant", content: response.data.reply }]);

      // Track progress
      await trackProgress(currentTopic.name, subject, 50);
    } catch (error) {
      console.error("Failed to teach topic:", error);
      const msg = await getInvokeErrorMessage(error);
      toast({ title: "Failed to load topic content", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Send a message/question
  const sendMessage = async () => {
    if (!input.trim() || isLoading || !selectedChapter || topics.length === 0) return;
    
    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    
    try {
      await waitForRateLimit();
      
      const { data: sessionData } = await externalSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) throw new Error("No session token");
      
      const response = await supabase.functions.invoke("curriculum-study", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          action: "answer_doubt",
          curriculum,
          standard,
          subject,
          chapter: selectedChapter.name,
          currentTopic: topics[currentTopicIndex]?.name,
          messages: updatedMessages,
        },
      });

      if (response.error) throw response.error;
      
      const assistantMessage: Message = { role: "assistant", content: response.data.reply };
      setMessages([...updatedMessages, assistantMessage]);
    } catch (error) {
      console.error("Failed to get response:", error);
      toast({ title: "Failed to get response", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Mark topic as complete and move to next
  const completeTopicAndNext = async () => {
    if (!selectedChapter || topics.length === 0) return;
    
    const currentTopic = topics[currentTopicIndex];
    const newCompletedTopics = [...completedTopics, currentTopic.name];
    setCompletedTopics(newCompletedTopics);
    
    const nextIndex = currentTopicIndex + 1;
    
    // Save progress
    await saveProgress(
      curriculum,
      standard,
      subject,
      selectedChapter.name,
      nextIndex < topics.length ? nextIndex : currentTopicIndex,
      newCompletedTopics,
      topics.length,
      currentTopic.name
    );
    
    // Track learning progress
    const progressScore = Math.round((newCompletedTopics.length / topics.length) * 100);
    await trackProgress(currentTopic.name, subject, progressScore);
    
    if (nextIndex < topics.length) {
      setCurrentTopicIndex(nextIndex);
      await teachCurrentTopic(topics, nextIndex);
      toast({ title: "Great job! Moving to next topic." });
    } else {
      toast({ 
        title: "🎉 Chapter Complete!", 
        description: `You've completed all ${topics.length} topics in "${selectedChapter.name}"!`
      });
    }
  };

  // Go to previous topic
  const goToPreviousTopic = async () => {
    if (currentTopicIndex > 0) {
      const prevIndex = currentTopicIndex - 1;
      setCurrentTopicIndex(prevIndex);
      await teachCurrentTopic(topics, prevIndex);
    }
  };

  // Reset chapter progress
  const resetChapterProgress = () => {
    setCurrentTopicIndex(0);
    setCompletedTopics([]);
    teachCurrentTopic(topics, 0);
  };

  // Download notes as PDF
  const downloadNotesAsPDF = () => {
    if (messages.length === 0 || !selectedChapter) {
      toast({ title: "No content to download", variant: "destructive" });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - 2 * margin;
    let yPos = margin;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`${subject} - ${selectedChapter.name}`, margin, yPos);
    yPos += 10;

    // Subtitle
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`${curriculum} • ${standard} Standard`, margin, yPos);
    yPos += 5;

    // Topic
    doc.setFontSize(10);
    doc.text(`Topic: ${topics[currentTopicIndex]?.name || "Unknown"}`, margin, yPos);
    yPos += 15;

    // Content
    doc.setFontSize(11);
    const assistantMessages = messages.filter(m => m.role === "assistant");
    
    assistantMessages.forEach(msg => {
      const cleanText = msg.content
        .replace(/\$.*?\$/g, "[formula]") // Replace LaTeX
        .replace(/```[\s\S]*?```/g, "[code block]") // Replace code blocks
        .replace(/[#*_`]+/g, "") // Remove markdown
        .trim();

      const lines = doc.splitTextToSize(cleanText, maxWidth);
      
      lines.forEach((line: string) => {
        if (yPos > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(line, margin, yPos);
        yPos += 6;
      });
      yPos += 5;
    });

    // Footer
    doc.setFontSize(8);
    doc.text(`Generated by SYNOVA on ${new Date().toLocaleDateString()}`, margin, pageHeight - 10);

    const fileName = `${subject}_${selectedChapter.name}_${topics[currentTopicIndex]?.name || "notes"}.pdf`
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    doc.save(fileName);
    toast({ title: "Notes downloaded successfully!" });
  };

  // Resume from recent progress
  const resumeProgress = async (progress: typeof recentProgress[0]) => {
    setCurriculum(progress.curriculum);
    setStandard(progress.standard);
    setSubject(progress.subject);
    
    // Load chapters and then the specific chapter
    setIsLoadingChapters(true);
    try {
      await waitForRateLimit();
      
      const { data: sessionData } = await externalSupabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) throw new Error("No session token");
      
      const response = await supabase.functions.invoke("curriculum-study", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          action: "get_chapters",
          curriculum: progress.curriculum,
          standard: progress.standard,
          subject: progress.subject,
        },
      });

      if (response.error) throw response.error;
      
      if (response.data.data && Array.isArray(response.data.data)) {
        setChapters(response.data.data);
        const chapter = response.data.data.find((c: Chapter) => c.name === progress.chapter);
        if (chapter) {
          await loadTopics(chapter);
        } else {
          setPhase("select-chapter");
        }
      }
    } catch (error) {
      console.error("Failed to resume:", error);
      toast({ title: "Failed to resume progress", variant: "destructive" });
    } finally {
      setIsLoadingChapters(false);
    }
  };

  // Calculate progress percentage
  const progressPercentage = topics.length > 0 
    ? Math.round((completedTopics.length / topics.length) * 100) 
    : 0;

  // Setup phase - select curriculum and standard
  if (phase === "setup") {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-2xl mx-auto lg:max-w-3xl">
          <div className="flex items-center gap-3 mb-4 shrink-0">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Curriculum Study</h1>
              <p className="text-sm text-muted-foreground">Learn chapter by chapter, topic by topic</p>
            </div>
          </div>

          <GlassCard className="flex-1">
            <GlassCardContent className="p-5 space-y-5">
              {/* Recent Progress Section */}
              {recentProgress.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">Continue Learning</h3>
                  <div className="space-y-2">
                    {recentProgress.slice(0, 3).map((progress) => (
                      <Button
                        key={progress.id}
                        variant="outline"
                        className="w-full justify-start gap-3 h-auto py-3"
                        onClick={() => resumeProgress(progress)}
                      >
                        <Play className="h-4 w-4 text-primary" />
                        <div className="text-left flex-1">
                          <div className="font-medium text-sm">{progress.chapter}</div>
                          <div className="text-xs text-muted-foreground">
                            {progress.subject} • {progress.standard} • {progress.curriculum}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress 
                              value={progress.total_topics > 0 ? (progress.completed_topics.length / progress.total_topics) * 100 : 0} 
                              className="h-1 flex-1" 
                            />
                            <span className="text-xs text-muted-foreground">
                              {progress.completed_topics.length}/{progress.total_topics}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                  <div className="border-t border-border my-4" />
                </div>
              )}

              {/* New Study Setup */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Start New Study</h3>
                
                <div className="space-y-2">
                  <Label className="text-sm">Curriculum / Board</Label>
                  <Select value={curriculum} onValueChange={setCurriculum}>
                    <SelectTrigger><SelectValue placeholder="Select your board" /></SelectTrigger>
                    <SelectContent>
                      {CURRICULA.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Standard / Grade</Label>
                  <Select value={standard} onValueChange={setStandard}>
                    <SelectTrigger><SelectValue placeholder="Select your class" /></SelectTrigger>
                    <SelectContent>
                      {STANDARDS.map((s) => (
                        <SelectItem key={s} value={s}>{s} Standard</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => setPhase("select-subject")}
                  disabled={!curriculum || !standard}
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      </AppLayout>
    );
  }

  // Subject selection phase
  if (phase === "select-subject") {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-2xl mx-auto lg:max-w-3xl">
          <div className="flex items-center gap-3 mb-4 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setPhase("setup")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Select Subject</h1>
              <p className="text-sm text-muted-foreground">{standard} • {curriculum}</p>
            </div>
          </div>

          <GlassCard className="flex-1">
            <GlassCardContent className="p-5">
              <div className="grid grid-cols-2 gap-3">
                {SUBJECTS.map((subj) => (
                  <Button
                    key={subj}
                    variant="outline"
                    className={cn(
                      "h-auto py-4 flex-col gap-2",
                      subject === subj && "border-primary bg-primary/5"
                    )}
                    onClick={() => setSubject(subj)}
                  >
                    <span className="font-medium">{subj}</span>
                  </Button>
                ))}
              </div>

              <Button 
                className="w-full mt-5" 
                onClick={loadChapters}
                disabled={!subject || isLoadingChapters}
              >
                {isLoadingChapters ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading Chapters...
                  </>
                ) : (
                  <>
                    View Chapters
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </GlassCardContent>
          </GlassCard>
        </div>
      </AppLayout>
    );
  }

  // Chapter selection phase
  if (phase === "select-chapter") {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-2xl mx-auto lg:max-w-3xl">
          <div className="flex items-center gap-3 mb-4 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setPhase("select-subject")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{subject} Chapters</h1>
              <p className="text-sm text-muted-foreground">{standard} • {curriculum}</p>
            </div>
          </div>

          <GlassCard className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <GlassCardContent className="p-4 space-y-2">
                {chapters.map((chapter) => (
                  <Button
                    key={chapter.number}
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-3"
                    onClick={() => loadTopics(chapter)}
                    disabled={isLoadingTopics}
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {chapter.number}
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{chapter.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        ~{chapter.topicsCount} topics
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ))}
              </GlassCardContent>
            </ScrollArea>
          </GlassCard>
        </div>
      </AppLayout>
    );
  }

  // Studying phase
  const currentTopic = topics[currentTopicIndex];
  const isChapterComplete = completedTopics.length === topics.length && topics.length > 0;

  return (
    <AppLayout>
      <div className="flex gap-4 h-[calc(100vh-5rem)]">
        {/* NCERT Reference Panel - Left Side */}
        <GlassCard className="hidden lg:block w-72 shrink-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                {curriculum} Reference
              </span>
            </div>
            <h3 className="font-bold text-foreground">{subject}</h3>
            <p className="text-sm text-muted-foreground">{standard} Standard</p>
          </div>
          <ScrollArea className="h-[calc(100%-8rem)]">
            <div className="p-4 space-y-3">
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                <p className="text-xs font-medium text-primary mb-1">Chapter {selectedChapter?.number}</p>
                <p className="text-sm font-semibold text-foreground">{selectedChapter?.name}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Topics</p>
                <div className="space-y-1">
                  {topics.map((topic, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "text-xs p-2 rounded-md cursor-pointer transition-colors",
                        idx === currentTopicIndex 
                          ? "bg-primary text-primary-foreground font-medium" 
                          : completedTopics.includes(topic.name)
                          ? "bg-muted text-muted-foreground line-through"
                          : "hover:bg-muted/50 text-foreground"
                      )}
                      onClick={() => {
                        setCurrentTopicIndex(idx);
                        teachCurrentTopic(topics, idx);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {completedTopics.includes(topic.name) && (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        )}
                        <span>{idx + 1}. {topic.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Note:</span> Following {curriculum} syllabus for {standard} {subject}. Content aligned with textbook chapters.
                </p>
              </div>
            </div>
          </ScrollArea>
        </GlassCard>

        {/* Main Content */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => setPhase("select-chapter")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-foreground truncate">{selectedChapter?.name}</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{subject}</span>
                  <span>•</span>
                  <span>Topic {currentTopicIndex + 1}/{topics.length}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={downloadNotesAsPDF} 
                title="Download Notes as PDF"
                disabled={messages.length === 0}
              >
                <Download className="h-4 w-4" />
              </Button>
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
              <Button variant="ghost" size="icon" onClick={resetChapterProgress} title="Reset chapter">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-3 shrink-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="truncate">{currentTopic?.name}</span>
              <span className="shrink-0">{progressPercentage}% complete</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Topic Navigation Pills - Mobile Only */}
          <div className="flex gap-1 overflow-x-auto pb-2 mb-3 shrink-0 lg:hidden">
            {topics.map((topic, idx) => (
              <Badge
                key={idx}
                variant={idx === currentTopicIndex ? "default" : completedTopics.includes(topic.name) ? "secondary" : "outline"}
                className={cn(
                  "shrink-0 cursor-pointer",
                  idx === currentTopicIndex && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
                onClick={() => {
                  setCurrentTopicIndex(idx);
                  teachCurrentTopic(topics, idx);
                }}
              >
                {completedTopics.includes(topic.name) && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {idx + 1}
              </Badge>
            ))}
          </div>

          {/* Messages */}
          <GlassCard className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {messages.length === 0 && !isLoading && (
                  <div className="text-center text-muted-foreground py-8">
                    <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Loading topic explanation...</p>
                  </div>
                )}
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[95%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <MarkdownContent content={message.content} />
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </GlassCard>

          {/* Bottom Controls */}
          <div className="mt-3 space-y-3 shrink-0">
            {/* Navigation Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousTopic}
                disabled={currentTopicIndex === 0 || isLoading}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                size="sm"
                onClick={completeTopicAndNext}
                disabled={isLoading || isChapterComplete}
                className="flex-1 gap-2"
              >
                {isChapterComplete ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Chapter Complete!
                  </>
                ) : (
                  <>
                    Complete & Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about this topic..."
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                disabled={isLoading}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={!input.trim() || isLoading}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
