import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { externalSupabase } from "@/lib/external-supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Sun, Moon, Loader2, RefreshCw, LogOut } from "lucide-react";
import synovaLogo from "@/assets/synova-logo.png";

export default function VerifyEmail() {
  const [isResending, setIsResending] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);

  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  const canResend = !lastSent || Date.now() - lastSent.getTime() > 60000; // 1 minute cooldown

  const handleResendEmail = async () => {
    if (!user?.email || !canResend) return;

    setIsResending(true);

    try {
      const { error } = await externalSupabase.auth.resend({
        type: "signup",
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          title: "Failed to resend",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setLastSent(new Date());
        toast({
          title: "Verification email sent",
          description: "Please check your inbox and spam folder.",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleRefreshStatus = async () => {
    // Refresh the session to check if email was verified
    const { data, error } = await externalSupabase.auth.refreshSession();
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to refresh session. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (data.user?.email_confirmed_at) {
      toast({
        title: "Email verified!",
        description: "Redirecting to dashboard...",
      });
      navigate("/dashboard");
    } else {
      toast({
        title: "Email not verified yet",
        description: "Please check your inbox and click the verification link.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Theme Toggle */}
        <div className="flex justify-end mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-xl"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        </div>

        <GlassCard variant="elevated">
          <GlassCardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img
                src={synovaLogo}
                alt="SYNOVA Learning Platform"
                className="h-16 w-16 object-contain"
              />
            </div>
            <GlassCardTitle>Verify Your Email</GlassCardTitle>
            <GlassCardDescription>
              Please verify your email address to continue
            </GlassCardDescription>
          </GlassCardHeader>

          <GlassCardContent>
            <div className="text-center py-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              
              <p className="text-muted-foreground mb-2">
                We've sent a verification link to:
              </p>
              <p className="font-medium text-foreground mb-6">
                {user?.email}
              </p>
              
              <p className="text-sm text-muted-foreground mb-6">
                Click the link in your email to verify your account. 
                Check your spam folder if you don't see it.
              </p>

              <div className="space-y-3">
                <Button
                  onClick={handleRefreshStatus}
                  className="w-full"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  I've Verified My Email
                </Button>

                <Button
                  onClick={handleResendEmail}
                  disabled={isResending || !canResend}
                  variant="outline"
                  className="w-full"
                >
                  {isResending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  {!canResend
                    ? "Wait 1 minute to resend"
                    : "Resend Verification Email"}
                </Button>

                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  className="w-full"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
}
