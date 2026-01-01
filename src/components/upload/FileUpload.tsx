import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Camera, Upload, FileText, Image, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  file: File;
  preview?: string;
  type: "image" | "pdf" | "other";
}

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  onFilesSelected,
  uploadedFiles,
  onRemoveFile,
  disabled,
  className,
}: FileUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsProcessing(true);
    const processed: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      const fileType = getFileType(file);
      let preview: string | undefined;

      if (fileType === "image") {
        preview = await createImagePreview(file);
      }

      processed.push({ file, preview, type: fileType });
    }

    onFilesSelected(processed);
    setIsProcessing(false);
    setIsOpen(false);
  };

  const getFileType = (file: File): "image" | "pdf" | "other" => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type === "application/pdf") return "pdf";
    return "other";
  };

  const createImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={(e) => processFiles(e.target.files)}
        disabled={disabled}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => processFiles(e.target.files)}
        disabled={disabled}
      />

      {/* Upload button with popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled || isProcessing}
            className="shrink-0 h-10 w-10 relative"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {uploadedFiles.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                    {uploadedFiles.length}
                  </span>
                )}
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              className="justify-start gap-2 h-10"
              onClick={handleCameraCapture}
              disabled={disabled}
            >
              <Camera className="h-4 w-4" />
              Take Photo
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2 h-10"
              onClick={handleFileUpload}
              disabled={disabled}
            >
              <Image className="h-4 w-4" />
              Upload Photo
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2 h-10"
              onClick={handleFileUpload}
              disabled={disabled}
            >
              <FileText className="h-4 w-4" />
              Upload PDF/File
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* File previews */}
      {uploadedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {uploadedFiles.map((uploadedFile, index) => (
            <div
              key={index}
              className="relative shrink-0 h-14 w-14 rounded-lg border border-border overflow-hidden bg-muted"
            >
              {uploadedFile.type === "image" && uploadedFile.preview ? (
                <img
                  src={uploadedFile.preview}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
              <span className="absolute bottom-0 left-0 right-0 bg-background/80 text-[10px] truncate px-1 text-foreground">
                {uploadedFile.file.name.slice(0, 8)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
