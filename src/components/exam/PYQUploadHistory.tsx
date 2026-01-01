import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History, RefreshCw, RotateCcw, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Upload {
  id: string;
  file_name: string;
  exam_type: string;
  year: number;
  shift: string | null;
  status: string;
  questions_count: number | null;
  error_message: string | null;
  created_at: string;
}

interface PYQUploadHistoryProps {
  userId: string;
}

export function PYQUploadHistory({ userId }: PYQUploadHistoryProps) {
  const { toast } = useToast();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchUploads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pyq_uploads")
        .select("*")
        .eq("uploaded_by", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUploads(data || []);
    } catch (error) {
      console.error("Failed to fetch uploads:", error);
      toast({ title: "Failed to load upload history", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
    
    // Set up realtime subscription for status updates
    const channel = supabase
      .channel("pyq_uploads_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pyq_uploads",
          filter: `uploaded_by=eq.${userId}`,
        },
        (payload) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === payload.new.id ? (payload.new as Upload) : u))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleRetry = async (upload: Upload) => {
    setRetryingId(upload.id);
    
    try {
      // Reset status to pending
      await supabase
        .from("pyq_uploads")
        .update({ status: "pending", error_message: null })
        .eq("id", upload.id);

      toast({ 
        title: "Retry initiated", 
        description: "Please re-upload the PDF file to retry extraction" 
      });
    } catch (error) {
      toast({ title: "Retry failed", variant: "destructive" });
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Completed</Badge>;
      case "processing":
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Processing</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Failed</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">Pending</Badge>;
    }
  };

  return (
    <GlassCard>
      <GlassCardHeader className="flex flex-row items-center justify-between">
        <GlassCardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Upload History
        </GlassCardTitle>
        <Button variant="outline" size="sm" onClick={fetchUploads} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </GlassCardHeader>
      <GlassCardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : uploads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No uploads yet. Upload a PYQ PDF to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {upload.file_name}
                    </TableCell>
                    <TableCell>
                      {upload.exam_type}
                      {upload.shift && <span className="text-muted-foreground ml-1">({upload.shift})</span>}
                    </TableCell>
                    <TableCell>{upload.year}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(upload.status)}
                        {upload.error_message && (
                          <span className="text-xs text-red-500 max-w-[150px] truncate" title={upload.error_message}>
                            {upload.error_message}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{upload.questions_count || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(upload.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {upload.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(upload)}
                          disabled={retryingId === upload.id}
                        >
                          {retryingId === upload.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Retry
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
