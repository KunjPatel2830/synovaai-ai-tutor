import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { Brain, Loader2, RotateCcw, Sparkles, CheckCircle2, EyeOff } from "lucide-react";

type ReviewItem = {
  id: string;
  subject: string;
  topic: string;
  prompt: string;
  answer: string | null;
  repetitions: number;
  interval_days: number;
  due_at: string;
  source_mode: string;
};

const GRADES = [
  { grade: 0, label: "Again", hint: "Forgot it", variant: "destructive" as const },
  { grade: 3, label: "Hard", hint: "Struggled", variant: "outline" as const },
  { grade: 4, label: "Good", hint: "Recalled", variant: "secondary" as const },
  { grade: 5, label: "Easy", hint: "Instant", variant: "default" as const },
];

export default function Review() {
  const { toast } = useToast();
  const { language } = useLanguagePreference();

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [reviewedToday, setReviewedToday] = useState(0);

  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    const res = await invokeBackendFunction<{ items: ReviewItem[]; dueCount: number; totalCount: number }>(
      "review-queue",
      { action: "due", limit: 20 },
      { label: "review-due", timeoutMs: 20000 }
    );
    setLoading(false);
    if (!res.ok) {
      toast({ title: "Could not load your review queue", description: res.error, variant: "destructive" });
      return;
    }
    setItems(res.data?.items ?? []);
    setTotalCount(res.data?.totalCount ?? 0);
    setIndex(0);
    setRevealed(false);
  }, [toast]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const current = items[index];

  const grade = async (value: number) => {
    if (!current || grading) return;
    setGrading(true);
    const res = await invokeBackendFunction<{ intervalDays: number }>(
      "review-queue",
      { action: "grade", itemId: current.id, grade: value },
      { label: "review-grade", timeoutMs: 15000 }
    );
    setGrading(false);
    if (!res.ok) {
      toast({ title: "Could not save your answer", description: res.error, variant: "destructive" });
      return;
    }
    setReviewedToday((n) => n + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  const generate = async () => {
    if (!subject.trim() || !topic.trim()) {
      toast({ title: "Add a subject and topic first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    const res = await invokeBackendFunction<{ created: number }>(
      "review-queue",
      { action: "generate", subject: subject.trim(), topic: topic.trim(), count: 5, language },
      { label: "review-generate", timeoutMs: 90000, retries: 0 }
    );
    setGenerating(false);
    if (!res.ok) {
      toast({ title: "Could not create cards", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: `Added ${res.data?.created ?? 0} cards`, description: `${subject} — ${topic}` });
    setTopic("");
    loadQueue();
  };

  const done = !loading && (!current || index >= items.length);
  const progress = items.length > 0 ? Math.min(100, (index / items.length) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-6 pb-10">
        <header className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Spaced Revision
          </h1>
          <p className="text-muted-foreground text-sm">
            Cards come back exactly when you're about to forget them. {totalCount} card{totalCount === 1 ? "" : "s"} in your deck.
          </p>
        </header>

        <GlassCard>
          <GlassCardContent className="p-4 md:p-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="rev-subject">Subject</Label>
                <Input
                  id="rev-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Physics"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rev-topic">Topic</Label>
                <Input
                  id="rev-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Rotational motion"
                />
              </div>
              <Button onClick={generate} disabled={generating} className="w-full md:w-auto">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span className="ml-2">Add 5 cards</span>
              </Button>
            </div>
          </GlassCardContent>
        </GlassCard>

        {loading ? (
          <GlassCard>
            <GlassCardContent className="p-10 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading your queue…
            </GlassCardContent>
          </GlassCard>
        ) : done ? (
          <GlassCard>
            <GlassCardContent className="p-10 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <h2 className="text-xl font-semibold">
                {reviewedToday > 0 ? "Session complete" : "Nothing due right now"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {reviewedToday > 0
                  ? `You reviewed ${reviewedToday} card${reviewedToday === 1 ? "" : "s"}. Come back when the next batch is due.`
                  : "Generate cards above, or study a topic and revisit this page later."}
              </p>
              <Button variant="outline" onClick={loadQueue}>
                <RotateCcw className="h-4 w-4 mr-2" /> Refresh queue
              </Button>
            </GlassCardContent>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Card {index + 1} of {items.length}
                </span>
                <span>
                  {current.subject} • {current.topic}
                </span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            <GlassCard>
              <GlassCardContent className="p-5 md:p-8 space-y-6 min-h-[240px]">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Question</p>
                  <MarkdownContent content={current.prompt} />
                </div>

                {revealed ? (
                  <div className="border-t border-border pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Answer</p>
                    <MarkdownContent content={current.answer || "_No answer stored for this card._"} />
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setRevealed(true)} className="w-full">
                    <EyeOff className="h-4 w-4 mr-2" /> Show answer
                  </Button>
                )}
              </GlassCardContent>
            </GlassCard>

            {revealed && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {GRADES.map((g) => (
                  <Button
                    key={g.grade}
                    variant={g.variant}
                    disabled={grading}
                    onClick={() => grade(g.grade)}
                    className="flex-col h-auto py-3"
                  >
                    <span className="font-semibold">{g.label}</span>
                    <span className="text-[11px] opacity-75">{g.hint}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
