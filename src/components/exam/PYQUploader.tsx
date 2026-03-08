import { useState } from "react";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";

interface PYQUploaderProps {
  userId: string;
  onUploadComplete?: () => void;
}

export function PYQUploader({ userId, onUploadComplete }: PYQUploaderProps) {
  const { toast } = useToast();
  const [examType, setExamType] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [shift, setShift] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

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
    if (!examType || !year || !file) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress("Reading file...");

    try {
      const pdfBase64 = await convertToBase64(file);
      setUploadProgress("Uploading & extracting questions with AI... This may take 2-4 minutes.");

      const result = await invokeBackendFunction("parse-pyq-pdf", {
        pdfBase64,
        examType,
        year,
        shift: shift || null,
        userId,
        fileName: file.name,
      }, { timeoutMs: 300000, retries: 0, label: "pyq-upload", useExternal: true });

      if (!result.ok) {
        const errorMsg = result.error || "Processing failed";
        // Provide user-friendly error messages
        if (errorMsg.includes("timed out") || errorMsg.includes("timeout")) {
          throw new Error("Processing timed out. The PDF may be too large or complex. Try a smaller file or split into parts.");
        }
        if (errorMsg.includes("Rate limited")) {
          throw new Error("Too many requests. Please wait a minute and try again.");
        }
        if (errorMsg.includes("credits")) {
          throw new Error("AI processing credits exhausted. Please try again later.");
        }
        throw new Error(errorMsg);
      }

      toast({
        title: "✅ PDF processed successfully!",
        description: `Extracted ${result.data?.questionsCount || 0} questions from ${examType} ${year}`,
      });

      setExamType("");
      setYear("");
      setShift("");
      setFile(null);
      // Reset file input
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
          <Upload className="h-5 w-5 text-primary" />
          Upload PYQ PDF
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Exam Type *</Label>
            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="JEE Main">JEE Main</SelectItem>
                <SelectItem value="JEE Advanced">JEE Advanced</SelectItem>
                <SelectItem value="NEET">NEET</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Year *</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Shift (optional)</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Morning">Morning</SelectItem>
                <SelectItem value="Afternoon">Afternoon</SelectItem>
                <SelectItem value="Evening">Evening</SelectItem>
              </SelectContent>
            </Select>
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
          <p className="text-xs text-muted-foreground">Max 15MB. Clear, text-based PDFs work best.</p>
        </div>

        {isUploading && uploadProgress && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <p className="text-sm text-primary">{uploadProgress}</p>
          </div>
        )}

        <Button onClick={handleUpload} disabled={isUploading || !examType || !year || !file} className="w-full">
          {isUploading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" />Upload & Extract Questions</>
          )}
        </Button>
      </GlassCardContent>
    </GlassCard>
  );
}
