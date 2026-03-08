import { useState } from "react";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle, GlassCardDescription } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, BookOpen, Target, Loader2, Sparkles } from "lucide-react";

const STANDARDS = [
  "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10",
  "Grade 11", "Grade 12", "College",
];

const CURRICULA = [
  "CBSE", "ICSE", "State Board", "IB", "IGCSE", "Other",
];

const TARGET_EXAMS = [
  "JEE", "NEET", "School Exams", "Other",
];

interface Props {
  onComplete: (data: { standard: string; curriculum: string; target_exam: string }) => Promise<void>;
}

export function StudentOnboarding({ onComplete }: Props) {
  const [standard, setStandard] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [targetExam, setTargetExam] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!standard || !curriculum) return;
    setIsSubmitting(true);
    try {
      await onComplete({
        standard,
        curriculum,
        target_exam: targetExam || "School Exams",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <GlassCard className="w-full max-w-md">
        <GlassCardHeader className="text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <GlassCardTitle className="text-2xl">Welcome to SYNOVA!</GlassCardTitle>
          <GlassCardDescription>
            Tell us about your studies so we can personalize your learning experience. You only need to do this once.
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent className="space-y-5">
          {/* Standard / Grade */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              Standard / Grade <span className="text-destructive">*</span>
            </Label>
            <Select value={standard} onValueChange={setStandard}>
              <SelectTrigger>
                <SelectValue placeholder="Select your grade" />
              </SelectTrigger>
              <SelectContent>
                {STANDARDS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Curriculum / Board */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Curriculum / Board <span className="text-destructive">*</span>
            </Label>
            <Select value={curriculum} onValueChange={setCurriculum}>
              <SelectTrigger>
                <SelectValue placeholder="Select your board" />
              </SelectTrigger>
              <SelectContent>
                {CURRICULA.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Exam (Optional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Target Exam <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Select value={targetExam} onValueChange={setTargetExam}>
              <SelectTrigger>
                <SelectValue placeholder="Select target exam" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_EXAMS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!standard || !curriculum || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Start Learning
          </Button>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
