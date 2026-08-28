import { useState } from "react";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Upload, FileText, Loader2, BookOpen } from "lucide-react";

interface StudyMaterialUploaderProps {
  userId: string;
  onUploadComplete?: () => void;
}

export function StudyMaterialUploader({ userId, onUploadComplete }: StudyMaterialUploaderProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        toast({ title: "Please select a PDF file", variant: "destructive" });
        return;
      }
      if (selectedFile.size > 15 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please use a PDF under 15MB for reliable processing.", variant: "destructive" });
        return;
      }
      setFile(selectedFile);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
    });
  };

  const handleUpload = async () => {
    if (!subject.trim() || !chapter.trim() || !file) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress("Reading file...");

    try {
      const pdfBase64 = await convertToBase64(file);
      setUploadProgress("Uploading & extracting questions with AI... This may take 2-4 minutes.");

      const result = await invokeBackendFunction("process-study-pdf", {
        pdfBase64,
        subject: subject.trim(),
        chapter: chapter.trim(),
        teacherId: userId,
        fileName: file.name,
      }, { timeoutMs: 300000, retries: 0, label: "study-pdf-upload" });

      if (!result.ok) {
        const errorMsg = result.error || "Processing failed";
        if (errorMsg.includes("timed out") || errorMsg.includes("timeout")) {
          throw new Error("Processing timed out. The PDF may be too large or complex. Try a smaller file.");
        }
        if (errorMsg.includes("Rate limited")) {
          throw new Error("Too many requests. Please wait a minute and try again.");
        }
        throw new Error(errorMsg);
      }

      toast({
        title: "✅ PDF processed successfully!",
        description: `Extracted ${result.data?.questionsCount || 0} questions from ${subject} - ${chapter}`,
      });

      setSubject("");
      setChapter("");
      setFile(null);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      onUploadComplete?.();
    } catch (error) {
      console.error("Upload error:", error);
      const msg = error instanceof Error ? error.message : "Unknown error occurred";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Upload Study Material
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics, Physics" disabled={isUploading} />
          </div>
          <div className="space-y-2">
            <Label>Chapter *</Label>
            <Input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="e.g. Algebra, Thermodynamics" disabled={isUploading} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>PDF File *</Label>
          <div className="flex items-center gap-3">
            <Input type="file" accept=".pdf" onChange={handleFileChange} className="flex-1" disabled={isUploading} />
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {file.name}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Max 15MB. AI will extract questions & generate solutions.</p>
        </div>

        {isUploading && uploadProgress && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <p className="text-sm text-primary">{uploadProgress}</p>
          </div>
        )}

        <Button onClick={handleUpload} disabled={isUploading || !subject.trim() || !chapter.trim() || !file} className="w-full">
          {isUploading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing with AI...</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" />Upload & Extract Questions</>
          )}
        </Button>
      </GlassCardContent>
    </GlassCard>
  );
}
