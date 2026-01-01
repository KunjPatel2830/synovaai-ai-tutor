import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserPlus } from "lucide-react";

export function JoinWithCode() {
  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const { toast } = useToast();

  const handleJoin = async () => {
    const trimmedCode = code.trim();
    
    if (!trimmedCode) {
      toast({
        title: "Please enter a code",
        variant: "destructive",
      });
      return;
    }

    if (trimmedCode.length !== 6) {
      toast({
        title: "Invalid code format",
        description: "The code should be 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);

    // First, validate the code to determine the inviter role
    const { data: validationResult, error: validateError } = await supabase
      .rpc("validate_invitation_code", { _code: trimmedCode });

    if (validateError) {
      toast({
        title: "Failed to validate code",
        description: "Please try again later.",
        variant: "destructive",
      });
      setIsJoining(false);
      return;
    }

    if (!validationResult || validationResult.length === 0) {
      toast({
        title: "Invalid or expired code",
        description: "Please check the code and try again.",
        variant: "destructive",
      });
      setIsJoining(false);
      return;
    }

    const invitation = validationResult[0];
    
    // Use the appropriate secure linking function based on inviter role
    const linkFunction = invitation.inviter_role === "teacher" 
      ? "link_student_to_teacher" 
      : "link_student_to_caregiver";

    const { error: linkError } = await supabase.rpc(linkFunction, { _code: trimmedCode });

    if (linkError) {
      // Handle specific error messages from the secure function
      if (linkError.message.includes("Already linked")) {
        toast({
          title: "Already linked",
          description: `You're already connected with this ${invitation.inviter_role}.`,
        });
      } else if (linkError.message.includes("Invalid or expired")) {
        toast({
          title: "Invalid or expired code",
          description: "Please check the code and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to join",
          description: "An error occurred. Please try again.",
          variant: "destructive",
        });
      }
      setIsJoining(false);
      return;
    }

    toast({
      title: "Successfully joined!",
      description: `You're now connected with your ${invitation.inviter_role}.`,
    });

    setCode("");
    setIsJoining(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the code from your teacher or caregiver to connect with them
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Enter 6-character code..."
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-mono text-lg tracking-wider uppercase"
        />
        <Button onClick={handleJoin} disabled={isJoining || code.length < 6}>
          {isJoining ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
