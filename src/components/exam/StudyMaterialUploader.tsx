import { useState } from "react";
import { externalSupabase } from "@/lib/external-supabase";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Upload, FileText, Loader2, BookOpen } from "lucide-react";
import { getExternalAccessToken } from "@/lib/external-auth";

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
    if (!subject.trim() || !chapter.trim() || !file) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setIsUploading(true);

    try {
      // Create upload record
      const { data: pdfRecord, error: insertError } = await externalSupabase
        .from("study_pdfs")
        .insert({
          teacher_id: userId,
          subject: subject.trim(),
          chapter: chapter.trim(),
          file_name: file.name,
          processing_status: "pending",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Convert PDF to base64
      const pdfBase64 = await convertToBase64(file);

      // Call edge function to process PDF
      const accessToken = await getExternalAccessToken();
      const { error: functionError } = await supabase.functions.invoke("process-study-pdf", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: {
          pdfId: pdfRecord.id,
          pdfBase64,
          subject: subject.trim(),
          chapter: chapter.trim(),
          teacherId: userId,
        },
      });

      if (functionError) {
        await externalSupabase
          .from("study_pdfs")
          .update({ processing_status: "failed", error_message: functionError.message })
          .eq("id", pdfRecord.id);
        throw functionError;
      }

      toast({ title: "PDF uploaded & processed!", description: "Questions extracted successfully." });
      setSubject("");
      setChapter("");
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
          <BookOpen className="h-5 w-5 text-primary" />
          Upload Study Material
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics, Physics"
            />
          </div>
          <div className="space-y-2">
            <Label>Chapter *</Label>
            <Input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Algebra, Thermodynamics"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>PDF File *</Label>
          <div className="flex items-center gap-3">
            <Input type="file" accept=".pdf" onChange={handleFileChange} className="flex-1" />
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {file.name}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Max file size: 20MB. AI will extract questions & generate solutions.</p>
        </div>

        <Button
          onClick={handleUpload}
          disabled={isUploading || !subject.trim() || !chapter.trim() || !file}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing with AI...
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
