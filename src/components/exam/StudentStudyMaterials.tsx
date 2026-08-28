import { useState, useEffect } from "react";
import { externalSupabase } from "@/lib/external-supabase";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, ChevronDown, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StudyPdf {
  id: string;
  subject: string;
  chapter: string;
  file_name: string;
  questions_count: number;
  teacher_id: string;
}

interface StudyTopic {
  id: string;
  name: string;
  questions: { id: string; question_text: string; solution_text: string | null }[];
}

export function StudentStudyMaterials() {
  const { user } = useAuth();
  const [pdfs, setPdfs] = useState<StudyPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPdf, setExpandedPdf] = useState<string | null>(null);
  const [topics, setTopics] = useState<Record<string, StudyTopic[]>>({});
  const [loadingTopics, setLoadingTopics] = useState<Record<string, boolean>>({});
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchStudyMaterials();
  }, [user]);

  const fetchStudyMaterials = async () => {
    if (!user) return;

    // Get linked teachers
    const { data: links } = await externalSupabase
      .from("teacher_student_links")
      .select("teacher_id")
      .eq("student_id", user.id);

    if (!links || links.length === 0) {
      setLoading(false);
      return;
    }

    const teacherIds = links.map((l) => l.teacher_id);

    // Get completed study PDFs from linked teachers (study tables are in Lovable Cloud DB)
    const { data, error } = await supabase
      .from("study_pdfs")
      .select("id, subject, chapter, file_name, questions_count, teacher_id")
      .in("teacher_id", teacherIds)
      .eq("processing_status", "completed")
      .order("subject, chapter");

    if (!error && data) setPdfs(data as StudyPdf[]);
    setLoading(false);
  };

  const loadTopics = async (pdfId: string) => {
    setLoadingTopics((prev) => ({ ...prev, [pdfId]: true }));

    const { data: topicsData } = await supabase
      .from("study_topics")
      .select("*")
      .eq("pdf_id", pdfId)
      .order("name");

    if (!topicsData) {
      setLoadingTopics((prev) => ({ ...prev, [pdfId]: false }));
      return;
    }

    const topicsWithQuestions = await Promise.all(
      topicsData.map(async (topic: any) => {
        const { data: questions } = await supabase
          .from("study_questions")
          .select("id, question_text, solution_text")
          .eq("topic_id", topic.id);
        return { ...topic, questions: questions || [] };
      })
    );

    setTopics((prev) => ({ ...prev, [pdfId]: topicsWithQuestions }));
    setLoadingTopics((prev) => ({ ...prev, [pdfId]: false }));
  };

  const toggleExpand = (pdfId: string) => {
    if (expandedPdf === pdfId) {
      setExpandedPdf(null);
    } else {
      setExpandedPdf(pdfId);
      if (!topics[pdfId]) loadTopics(pdfId);
    }
  };

  // Group by subject
  const subjects = [...new Set(pdfs.map((p) => p.subject))];
  const filteredPdfs = selectedSubject ? pdfs.filter((p) => p.subject === selectedSubject) : [];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pdfs.length === 0) {
    return (
      <GlassCard>
        <GlassCardContent className="flex flex-col items-center justify-center py-12 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="text-base font-medium text-foreground">No study materials available</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Connect with a teacher to access their study materials.
          </p>
        </GlassCardContent>
      </GlassCard>
    );
  }

  // Subject selection view
  if (!selectedSubject) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground mb-3">Browse study materials from your teacher</p>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {subjects.map((subject) => {
            const count = pdfs.filter((p) => p.subject === subject).length;
            return (
              <GlassCard
                key={subject}
                className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                onClick={() => setSelectedSubject(subject)}
              >
                <GlassCardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{subject}</h4>
                  <p className="text-xs text-muted-foreground">{count} chapter{count !== 1 ? "s" : ""}</p>
                </GlassCardContent>
              </GlassCard>
            );
          })}
        </div>
      </div>
    );
  }

  // Chapter/content view
  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { setSelectedSubject(null); setExpandedPdf(null); }}
        className="text-sm text-primary hover:text-primary/80 gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to subjects
      </Button>

      <h3 className="text-base font-semibold text-foreground">{selectedSubject}</h3>

      <div className="space-y-3">
        {filteredPdfs.map((pdf) => (
          <GlassCard key={pdf.id} className="overflow-hidden">
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleExpand(pdf.id)}
            >
              <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{pdf.chapter}</p>
                <p className="text-xs text-muted-foreground">{pdf.questions_count} questions</p>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedPdf === pdf.id && "rotate-180")} />
            </div>

            {expandedPdf === pdf.id && (
              <div className="border-t border-border/30 bg-muted/20 px-4 py-4">
                {loadingTopics[pdf.id] ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !topics[pdf.id] || topics[pdf.id].length === 0 ? (
                  <p className="text-sm text-muted-foreground">No topics available.</p>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {topics[pdf.id].map((topic) => (
                      <AccordionItem key={topic.id} value={topic.id} className="rounded-lg border border-border/50 bg-background">
                        <AccordionTrigger className="px-4 text-sm font-medium hover:no-underline">
                          {topic.name}
                          <span className="ml-2 text-xs text-muted-foreground">({topic.questions.length} questions)</span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="space-y-4">
                            {topic.questions.map((q, idx) => (
                              <div key={q.id} className="space-y-2">
                                <p className="text-sm font-medium text-foreground">Q{idx + 1}. {q.question_text}</p>
                                {q.solution_text && (
                                  <div className="ml-4 rounded-md border-l-2 border-primary/30 bg-muted/50 p-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Solution:</p>
                                    <p className="text-sm text-foreground whitespace-pre-wrap">{q.solution_text}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
