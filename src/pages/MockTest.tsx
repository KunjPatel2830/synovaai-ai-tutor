import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Clock, Flag, Loader2, ChevronLeft, ChevronRight, Trophy } from "lucide-react";

type Q = { id: string; position: number; subject: string; topic: string | null; question_text: string; options: string[] };
type Test = { id: string; exam_type: string; duration_minutes: number; marks_correct: number; marks_incorrect: number; question_count: number };
type Attempt = { id: string; started_at: string; answers?: Record<string, string> };
type ReviewQ = Q & { correct_option: string; explanation: string | null; your_answer: string | null; time_seconds: number };
type Result = {
  score: number; maxScore: number; correct: number; incorrect: number; unattempted: number; accuracy: number;
  percentile: number | null; poolSize: number; minPool: number; durationSeconds: number; addedToReview: number;
  breakdown: { subject: string; topic: string; correct: number; incorrect: number; unattempted: number; total: number }[];
};

const EXAMS = [
  { id: "JEE", label: "JEE", subjects: ["Physics", "Chemistry", "Mathematics"], scheme: "+4 / -1" },
  { id: "NEET", label: "NEET", subjects: ["Physics", "Chemistry", "Biology"], scheme: "+4 / -1" },
  { id: "BOARDS", label: "Boards", subjects: ["Physics", "Chemistry", "Mathematics", "Biology"], scheme: "+1 / 0" },
];
const LETTERS = ["A", "B", "C", "D"];
const store = (id: string) => `synova_mock_${id}`;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, "0")}`;

export default function MockTest() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<"setup" | "loading" | "running" | "submitting" | "result">("loading");

  // setup
  const [exam, setExam] = useState("JEE");
  const [subjects, setSubjects] = useState<string[]>(["Physics"]);
  const [difficulty, setDifficulty] = useState("mixed");
  const [count, setCount] = useState(15);
  const [duration, setDuration] = useState(30);

  // running
  const [test, setTest] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [times, setTimes] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const submittedRef = useRef(false);

  // result
  const [result, setResult] = useState<Result | null>(null);
  const [review, setReview] = useState<ReviewQ[]>([]);

  const examCfg = EXAMS.find((e) => e.id === exam)!;

  const startRunning = (data: { test: Test; attempt: Attempt; questions: Q[]; serverNow: string }) => {
    const skew = Date.now() - new Date(data.serverNow).getTime();
    const end = new Date(data.attempt.started_at).getTime() + data.test.duration_minutes * 60000 + skew;
    const saved = JSON.parse(localStorage.getItem(store(data.attempt.id)) || "{}");
    setTest(data.test); setAttempt(data.attempt); setQuestions(data.questions);
    setAnswers(saved.answers || {}); setMarked(saved.marked || {}); setTimes(saved.times || {});
    setIdx(saved.idx || 0); setEndsAt(end); submittedRef.current = false;
    setPhase("running");
  };

  useEffect(() => {
    (async () => {
      const res = await invokeBackendFunction<any>("mock-test", { action: "resume" }, { label: "mock-resume", timeoutMs: 20000 });
      if (res.ok && res.data?.attempt) startRunning(res.data);
      else setPhase("setup");
    })();
  }, []);

  // persist progress locally so a refresh keeps answers
  useEffect(() => {
    if (phase === "running" && attempt) localStorage.setItem(store(attempt.id), JSON.stringify({ answers, marked, times, idx }));
  }, [answers, marked, times, idx, phase, attempt]);

  const currentId = questions[idx]?.id;
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (currentId) setTimes((p) => ({ ...p, [currentId]: (p[currentId] || 0) + 1 }));
    }, 1000);
    return () => clearInterval(t);
  }, [phase, currentId]);

  const remaining = Math.round((endsAt - now) / 1000);

  const submit = useCallback(async () => {
    if (!attempt || submittedRef.current) return;
    submittedRef.current = true;
    setPhase("submitting");
    const res = await invokeBackendFunction<{ result: Result; review: ReviewQ[] }>(
      "mock-test", { action: "submit", attemptId: attempt.id, answers, timePerQuestion: times },
      { label: "mock-submit", timeoutMs: 30000 }
    );
    if (!res.ok || !res.data) {
      submittedRef.current = false;
      setPhase("running");
      toast({ title: "Could not submit", description: res.error, variant: "destructive" });
      return;
    }
    localStorage.removeItem(store(attempt.id));
    setResult(res.data.result); setReview(res.data.review); setPhase("result");
  }, [attempt, answers, times, toast]);

  useEffect(() => {
    if (phase === "running" && endsAt && remaining <= 0) submit();
  }, [phase, remaining, endsAt, submit]);

  const create = async () => {
    setPhase("loading");
    const res = await invokeBackendFunction<any>(
      "mock-test",
      { action: "create", examType: exam, subjects, difficulty, questionCount: count, durationMinutes: duration },
      { label: "mock-create", timeoutMs: 150000 }
    );
    if (!res.ok || !res.data?.test) {
      setPhase("setup");
      toast({ title: "Could not create the test", description: res.error, variant: "destructive" });
      return;
    }
    startRunning(res.data);
  };

  const discard = async () => {
    if (!attempt) return;
    await invokeBackendFunction("mock-test", { action: "discard", attemptId: attempt.id }, { label: "mock-discard" });
    localStorage.removeItem(store(attempt.id));
    setPhase("setup");
  };

  const answeredCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);

  if (phase === "loading" || phase === "submitting") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>{phase === "submitting" ? "Scoring your test..." : "Preparing your test. This can take up to a minute."}</p>
        </div>
      </AppLayout>
    );
  }

  if (phase === "setup") {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6 pb-8">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2"><ClipboardCheck className="h-6 w-6 text-primary" /> Mock Test</h1>
            <p className="text-muted-foreground text-sm">Timed, exam-style test with real marking and a topic-wise report.</p>
          </div>
          <GlassCard><GlassCardContent className="p-6 space-y-5">
            <Field label="Exam">
              {EXAMS.map((e) => (
                <Chip key={e.id} active={exam === e.id} onClick={() => { setExam(e.id); setSubjects([e.subjects[0]]); }}>{e.label}</Chip>
              ))}
              <span className="text-xs text-muted-foreground self-center">Marking {examCfg.scheme}</span>
            </Field>
            <Field label="Subjects">
              {examCfg.subjects.map((s) => (
                <Chip key={s} active={subjects.includes(s)}
                  onClick={() => setSubjects((p) => p.includes(s) ? (p.length > 1 ? p.filter((x) => x !== s) : p) : [...p, s])}>{s}</Chip>
              ))}
            </Field>
            <Field label="Difficulty">
              {["easy", "medium", "hard", "mixed"].map((d) => <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>{d}</Chip>)}
            </Field>
            <Field label="Questions">
              {[10, 15, 20, 30].map((n) => <Chip key={n} active={count === n} onClick={() => setCount(n)}>{n}</Chip>)}
            </Field>
            <Field label="Duration (minutes)">
              {[15, 30, 45, 60, 90].map((n) => <Chip key={n} active={duration === n} onClick={() => setDuration(n)}>{n}</Chip>)}
            </Field>
            <Button size="lg" className="w-full" onClick={create}>Start test</Button>
          </GlassCardContent></GlassCard>
        </div>
      </AppLayout>
    );
  }

  if (phase === "result" && result) {
    const pct = result.maxScore ? Math.max(0, (result.score / result.maxScore) * 100) : 0;
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6 pb-8">
          <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Trophy className="h-6 w-6 text-primary" /> Your result</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Score" value={`${result.score} / ${result.maxScore}`} />
            <Stat label="Accuracy" value={`${result.accuracy}%`} />
            <Stat label="Correct / Wrong / Skipped" value={`${result.correct} / ${result.incorrect} / ${result.unattempted}`} />
            <Stat label="Percentile" value={result.percentile !== null ? `${result.percentile}` : "—"}
              hint={result.percentile !== null ? `vs ${result.poolSize} attempts` : `Shown after ${result.minPool} attempts on SYNOVA (${result.poolSize} so far)`} />
          </div>
          <Progress value={pct} />
          {result.addedToReview > 0 && (
            <p className="text-sm text-muted-foreground">
              {result.addedToReview} wrong answers were added to your <Link to="/review" className="text-primary underline">Spaced Revision</Link> queue.
            </p>
          )}
          <GlassCard><GlassCardContent className="p-5">
            <h2 className="font-semibold mb-3">Topic-wise breakdown (weakest first)</h2>
            <div className="space-y-2">
              {result.breakdown.map((b) => (
                <div key={b.subject + b.topic} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate">{b.subject} · {b.topic}</span>
                  <span className="text-muted-foreground">{b.correct}/{b.total}</span>
                  <Progress value={(b.correct / b.total) * 100} className="w-28" />
                </div>
              ))}
            </div>
          </GlassCardContent></GlassCard>
          <div className="space-y-3">
            <h2 className="font-semibold">Solutions</h2>
            {review.map((q) => (
              <GlassCard key={q.id}><GlassCardContent className="p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">Q{q.position}</Badge>
                  <span className="text-muted-foreground">{q.subject} · {q.topic}</span>
                  <span className="text-muted-foreground ml-auto">{q.time_seconds}s</span>
                  <Badge variant={!q.your_answer ? "secondary" : q.your_answer === q.correct_option ? "default" : "destructive"}>
                    {!q.your_answer ? "Skipped" : q.your_answer === q.correct_option ? "Correct" : `You chose ${q.your_answer}`}
                  </Badge>
                </div>
                <MarkdownContent content={q.question_text} />
                <div className="grid gap-1.5">
                  {q.options.map((o, i) => (
                    <div key={i} className={cn("rounded-lg border px-3 py-2 text-sm",
                      LETTERS[i] === q.correct_option && "border-primary bg-primary/10",
                      LETTERS[i] === q.your_answer && q.your_answer !== q.correct_option && "border-destructive bg-destructive/10")}>
                      <b>{LETTERS[i]}.</b> <MarkdownContent content={o} className="inline" />
                    </div>
                  ))}
                </div>
                {q.explanation && <div className="text-sm bg-muted/50 rounded-lg p-3"><MarkdownContent content={q.explanation} /></div>}
              </GlassCardContent></GlassCard>
            ))}
          </div>
          <Button onClick={() => { setResult(null); setPhase("setup"); }}>Take another test</Button>
        </div>
      </AppLayout>
    );
  }

  // running
  const q = questions[idx];
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto pb-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{test?.exam_type} mock · {answeredCount}/{questions.length} answered</h1>
          <span className={cn("ml-auto flex items-center gap-1.5 font-mono text-lg font-semibold", remaining < 120 && "text-destructive")}>
            <Clock className="h-5 w-5" /> {fmt(remaining)}
          </span>
          <Button variant="ghost" size="sm" onClick={discard}>Quit</Button>
          <Button onClick={() => { if (confirm("Submit the test now?")) submit(); }}>Submit</Button>
        </div>
        <div className="grid lg:grid-cols-12 gap-4">
          <GlassCard className="lg:col-span-9"><GlassCardContent className="p-5 space-y-4">
            {q && <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Q{q.position}</Badge> {q.subject} · +{test?.marks_correct} / {test?.marks_incorrect}
              </div>
              <MarkdownContent content={q.question_text} />
              <div className="grid gap-2">
                {q.options.map((o, i) => {
                  const L = LETTERS[i];
                  const sel = answers[q.id] === L;
                  return (
                    <button key={i} onClick={() => setAnswers((p) => ({ ...p, [q.id]: sel ? "" : L }))}
                      className={cn("text-left rounded-xl border px-4 py-3 transition-colors",
                        sel ? "border-primary bg-primary/10" : "border-border hover:bg-muted/60")}>
                      <b className="mr-2">{L}.</b><MarkdownContent content={o} className="inline" />
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
                <Button variant="outline" onClick={() => setMarked((p) => ({ ...p, [q.id]: !p[q.id] }))}>
                  <Flag className="h-4 w-4" /> {marked[q.id] ? "Unmark" : "Mark for review"}
                </Button>
                <Button className="ml-auto" disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
              </div>
            </>}
          </GlassCardContent></GlassCard>
          <GlassCard className="lg:col-span-3"><GlassCardContent className="p-4">
            <Label className="mb-3 block">Question palette</Label>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((x, i) => (
                <button key={x.id} onClick={() => setIdx(i)}
                  className={cn("h-9 rounded-lg text-sm font-medium border",
                    i === idx && "ring-2 ring-primary",
                    marked[x.id] ? "bg-accent text-accent-foreground" : answers[x.id] ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <p><span className="inline-block h-3 w-3 rounded bg-primary mr-2" />Answered</p>
              <p><span className="inline-block h-3 w-3 rounded bg-accent mr-2" />Marked for review</p>
              <p><span className="inline-block h-3 w-3 rounded bg-muted border mr-2" />Not answered</p>
            </div>
          </GlassCardContent></GlassCard>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label><div className="flex flex-wrap gap-2">{children}</div></div>;
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("px-4 py-1.5 rounded-full border text-sm capitalize transition-colors",
      active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>{children}</button>
  );
}
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <GlassCard><GlassCardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </GlassCardContent></GlassCard>
  );
}
