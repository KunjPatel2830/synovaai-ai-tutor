import { useState } from "react";
import { externalSupabase } from "@/lib/external-supabase";
import { invokeBackendFunction } from "@/lib/backend-invoke";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Upload, FileText, Loader2 } from "lucide-react";

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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        toast({ title: "Please select a PDF file", variant: "destructive" });
        return;
      }
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast({ title: "File size must be less than 20MB", variant: "destructive" });
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
      reader.onerror = (error) => reject(error);
    });
  };

  const handleUpload = async () => {
    if (!examType || !year || !file) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setIsUploading(true);

    try {
      // Create upload record
      const { data: uploadRecord, error: insertError } = await externalSupabase
        .from("pyq_uploads")
        .insert({
          uploaded_by: userId,
          exam_type: examType,
          year: parseInt(year),
          shift: shift || null,
          file_name: file.name,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Convert PDF to base64
      const pdfBase64 = await convertToBase64(file);

      // Call edge function to process PDF with extended timeout for large PDFs
      const result = await invokeBackendFunction("parse-pyq-pdf", {
        uploadId: uploadRecord.id,
        pdfBase64,
        examType,
        year,
        shift: shift || null,
        userId,
      }, { timeoutMs: 120000, retries: 1, label: "pyq-upload" });

      if (!result.ok) {
        const functionError = new Error(result.error || "Processing failed");
        // Update status to failed
        await externalSupabase
          .from("pyq_uploads")
          .update({ status: "failed", error_message: functionError.message })
          .eq("id", uploadRecord.id);
        throw functionError;
      }

      toast({ title: "PDF uploaded and processing started", description: "Check upload history for status" });
      
      // Reset form
      setExamType("");
      setYear("");
      setShift("");
      setFile(null);
      
      onUploadComplete?.();
    } catch (error) {
      console.error("Upload error:", error);
      const msg = error instanceof Error ? error.message 
        : (error as any)?.message || (error as any)?.error_description || JSON.stringify(error) || "Unknown error";
      toast({
        title: "Upload failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
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
              <SelectTrigger>
                <SelectValue placeholder="Select exam" />
              </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Shift (optional)</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
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
            <Input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="flex-1"
            />
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {file.name}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Max file size: 20MB</p>
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={isUploading || !examType || !year || !file}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload & Extract Questions
            </>
          )}
        </Button>
      </GlassCardContent>
    </GlassCard>
  );
}
