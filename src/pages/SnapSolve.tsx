import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { useToast } from "@/hooks/use-toast";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { Camera, Upload, Sparkles, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, base64] = result.split(",");
      const mime = meta.match(/data:(.+);base64/)?.[1] || file.type || "image/jpeg";
      resolve({ base64, mime });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SnapSolve() {
  const { toast } = useToast();
  const { language } = useLanguagePreference();
  const [preview, setPreview] = useState<string | null>(null);
  const [imgData, setImgData] = useState<{ base64: string; mime: string } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 10MB", variant: "destructive" });
      return;
    }
    const { base64, mime } = await fileToBase64(file);
    setImgData({ base64, mime });
    setPreview(`data:${mime};base64,${base64}`);
    setReply("");
    setError("");
  };

  const clear = () => {
    setPreview(null);
    setImgData(null);
    setReply("");
    setError("");
    setPrompt("");
  };

  const solve = async () => {
    if (!imgData) {
      toast({ title: "Add a photo first", variant: "destructive" });
      return;
    }
    setLoading(true);
    setReply("");
    setError("");
    try {
      const res = await invokeBackendFunction<{ reply: string }>(
        "snap-solve",
        {
          imageBase64: imgData.base64,
          mimeType: imgData.mime,
          prompt: prompt.trim(),
          subject: subject === "auto" ? undefined : subject,
          language,
        },
        { timeoutMs: 120000, retries: 0, label: "snap-solve" }
      );
      if (!res.ok) {
        const message = res.error || "Please try again with a clear, tightly cropped photo.";
        setError(message);
        toast({
          title: res.status === 429 ? "Rate limit" : res.status === 402 ? "Credits exhausted" : "Failed to solve",
          description: message,
          variant: "destructive",
        });
        return;
      }
      setReply(res.data?.reply || "");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to solve this image.";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Camera className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Snap-to-Solve</h1>
            <p className="text-xs text-muted-foreground">Photograph any problem — get a step-by-step solution.</p>
          </div>
        </div>

        <GlassCard>
          <GlassCardContent className="p-4 space-y-4">
            {!preview ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-32 flex-col gap-2"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera className="h-8 w-8" />
                  <span>Take Photo</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-32 flex-col gap-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-8 w-8" />
                  <span>Upload Image</span>
                </Button>
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            ) : (
              <div className="relative">
                <img
                  src={preview}
                  alt="Problem to solve"
                  className="w-full max-h-80 object-contain rounded-lg border border-border bg-muted/30"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={clear}
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label className="text-xs">Subject</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Physics">Physics</SelectItem>
                    <SelectItem value="Chemistry">Chemistry</SelectItem>
                    <SelectItem value="Biology">Biology</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Extra instructions (optional)</Label>
                <Textarea
                  placeholder="e.g., Solve part (b) only, or explain in more detail"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[44px] max-h-32"
                  rows={2}
                />
              </div>
            </div>

            <Button
              className={cn("w-full gap-2")}
              onClick={solve}
              disabled={!imgData || loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Solving..." : "Solve this"}
            </Button>
          </GlassCardContent>
        </GlassCard>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {reply && (
          <GlassCard>
            <GlassCardContent className="p-4">
              <MarkdownContent content={reply} />
            </GlassCardContent>
          </GlassCard>
        )}
      </div>
    </AppLayout>
  );
}
