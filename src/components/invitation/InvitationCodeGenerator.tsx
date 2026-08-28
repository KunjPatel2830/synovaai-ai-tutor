import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { externalSupabase } from "@/lib/external-supabase";
import { Copy, Plus, Loader2 } from "lucide-react";

interface InvitationCodeGeneratorProps {
  userId: string;
  inviterRole: "teacher" | "caregiver";
}

interface InvitationCode {
  id: string;
  code: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

export function InvitationCodeGenerator({ userId, inviterRole }: InvitationCodeGeneratorProps) {
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCodes();
  }, [userId]);

  const fetchCodes = async () => {
    const { data, error } = await externalSupabase
      .from("invitation_codes")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (data) {
      setCodes(data as InvitationCode[]);
    }
    setIsLoading(false);
  };

  const generateCode = async () => {
    setIsGenerating(true);
    
    // Generate a cryptographically secure random 6-character code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const randomBytes = new Uint8Array(6);
    crypto.getRandomValues(randomBytes);
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(randomBytes[i] % chars.length);
    }

    const { data, error } = await externalSupabase
      .from("invitation_codes")
      .insert({
        code,
        created_by: userId,
        inviter_role: inviterRole,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Duplicate code, try again
        generateCode();
        return;
      }
      toast({
        title: "Failed to generate code",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      setCodes([data as InvitationCode, ...codes]);
      toast({
        title: "Invitation code generated!",
        description: `Share this code with your ${inviterRole === "teacher" ? "student" : "child"}: ${code}`,
      });
    }
    
    setIsGenerating(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copied!",
      description: "Share this code with your student.",
    });
  };

  const activeCodes = codes.filter(c => !c.used_at && new Date(c.expires_at) > new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Generate a code to share with {inviterRole === "teacher" ? "students" : "your child"}
        </p>
        <Button onClick={generateCode} disabled={isGenerating} size="sm">
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Generate Code
        </Button>
      </div>

      {activeCodes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Active Codes</p>
          {activeCodes.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div>
                <code className="text-lg font-mono font-bold tracking-wider">
                  {invitation.code}
                </code>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(invitation.expires_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyCode(invitation.code)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
