import { useState, useEffect } from "react";
import { externalSupabase } from "@/lib/external-supabase";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, ChevronDown, Trash2, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface StudyPdf {
  id: string;
  subject: string;
  chapter: string;
  file_name: string;
  processing_status: string;
  questions_count: number;
  created_at: string;
  error_message: string | null;
}

interface StudyTopic {
  id: string;
  name: string;
  questions: { id: string; question_text: string; solution_text: string | null }[];
}

interface StudyMaterialManagerProps {
  userId: string;
  refreshKey?: number;
}

export function StudyMaterialManager({ userId, refreshKey }: StudyMaterialManagerProps) {
  const { toast } = useToast();
  const [pdfs, setPdfs] = useState<StudyPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPdf, setExpandedPdf] = useState<string | null>(null);
  const [topics, setTopics] = useState<Record<string, StudyTopic[]>>({});
  const [loadingTopics, setLoadingTopics] = useState<Record<string, boolean>>({});

  const fetchPdfs = async () => {
    const { data, error } = await externalSupabase
      .from("study_pdfs")
      .select("*")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) setPdfs(data as StudyPdf[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPdfs();
  }, [userId, refreshKey]);

  const loadTopics = async (pdfId: string) => {
    setLoadingTopics((prev) => ({ ...prev, [pdfId]: true }));
    const { data: topicsData } = await externalSupabase
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
        const { data: questions } = await externalSupabase
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

  const handleDelete = async (pdfId: string) => {
    const { error } = await externalSupabase.from("study_pdfs").delete().eq("id", pdfId);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Study material deleted" });
    setPdfs((prev) => prev.filter((p) => p.id !== pdfId));
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "processing": return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Group by subject
  const grouped = pdfs.reduce<Record<string, StudyPdf[]>>((acc, pdf) => {
    if (!acc[pdf.subject]) acc[pdf.subject] = [];
    acc[pdf.subject].push(pdf);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pdfs.length === 0) {
    return (
      <GlassCard>
        <GlassCardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="text-base font-medium text-foreground">No study materials yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Upload your first PDF above to get started.</p>
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([subject, subjectPdfs]) => (
        <div key={subject}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">{subject}</h3>
          <div className="space-y-3">
            {subjectPdfs.map((pdf) => (
              <GlassCard key={pdf.id} className="overflow-hidden">
                <div
                  className={cn(
                    "flex items-center justify-between p-4 cursor-pointer",
                    pdf.processing_status === "completed" && "hover:bg-muted/30"
                  )}
                  onClick={() => pdf.processing_status === "completed" && toggleExpand(pdf.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {statusIcon(pdf.processing_status)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{pdf.chapter}</p>
                      <p className="text-xs text-muted-foreground">{pdf.file_name} · {pdf.questions_count || 0} questions</p>
                      {pdf.error_message && (
                        <p className="text-xs text-destructive mt-0.5">{pdf.error_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDelete(pdf.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {pdf.processing_status === "completed" && (
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedPdf === pdf.id && "rotate-180")} />
                    )}
                  </div>
                </div>

                {expandedPdf === pdf.id && (
                  <div className="border-t border-border/30 bg-muted/20 px-4 py-4">
                    {loadingTopics[pdf.id] ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : !topics[pdf.id] || topics[pdf.id].length === 0 ? (
                      <p className="text-sm text-muted-foreground">No topics extracted.</p>
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
      ))}
    </div>
  );
}
