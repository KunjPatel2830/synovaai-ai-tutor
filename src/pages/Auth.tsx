import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthRateLimiter } from "@/hooks/useAuthRateLimiter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap,
  Mail,
  Lock,
  User,
  Sun,
  Moon,
  BookOpen,
  Users,
  Heart,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { z } from "zod";
import synovaLogo from "@/assets/synova-logo.png";

type AppRole = "student" | "teacher" | "caregiver" | "admin";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

interface RoleOption {
  value: AppRole;
  label: string;
  icon: React.ElementType;
  description: string;
}

const roleOptions: RoleOption[] = [
  {
    value: "student",
    label: "Student",
    icon: BookOpen,
    description: "Learn with AI assistance",
  },
  {
    value: "teacher",
    label: "Teacher",
    icon: GraduationCap,
    description: "Monitor student progress",
  },
  {
    value: "caregiver",
    label: "Caregiver",
    icon: Heart,
    description: "Track your child's learning",
  },
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("student");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [lockoutCountdown, setLockoutCountdown] = useState<number>(0);

  const { signIn, signUp, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { checkLockout, recordAttempt, waitForRateLimit, isChecking } = useAuthRateLimiter();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutCountdown <= 0) return;

    const timer = setInterval(() => {
      setLockoutCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutCountdown]);

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Check if currently locked out
    if (lockoutCountdown > 0) {
      toast({
        title: "Account temporarily locked",
        description: `Please wait ${formatCountdown(lockoutCountdown)} before trying again.`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Apply client-side rate limiting
      await waitForRateLimit();

      if (isLogin) {
        // Check server-side lockout status
        const lockoutStatus = await checkLockout(email);
        
        if (lockoutStatus.isLocked) {
          setLockoutCountdown(lockoutStatus.remainingSeconds);
          toast({
            title: "Account temporarily locked",
            description: `Too many failed attempts. Please wait ${formatCountdown(lockoutStatus.remainingSeconds)} before trying again.`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        
        if (error) {
          // Record failed attempt
          await recordAttempt(email, false);
          
          // Check if this failure triggered a lockout
          const newLockoutStatus = await checkLockout(email);
          if (newLockoutStatus.isLocked) {
            setLockoutCountdown(newLockoutStatus.remainingSeconds);
          }

          const remainingAttemptsNote =
            newLockoutStatus.failedAttempts >= 3
              ? ` (${5 - newLockoutStatus.failedAttempts} attempts remaining)`
              : "";

          toast({
            title: "Login failed",
            description:
              error.message === "Invalid login credentials"
                ? `Invalid email or password. If you just signed up, verify your email first, or use “Forgot your password?” to set a new one.${remainingAttemptsNote}`
                : error.message,
            variant: "destructive",
          });
        } else {
          // Record successful attempt
          await recordAttempt(email, true);
          
          toast({
            title: "Welcome back!",
            description: "You have successfully signed in.",
          });
          navigate("/dashboard");
        }
      } else {
        if (!displayName.trim()) {
          toast({
            title: "Name required",
            description: "Please enter your name.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(email, password, displayName, selectedRole);
        if (error) {
          const errorMessage = error.message.includes("already registered")
            ? "This email is already registered. Please sign in instead."
            : error.message;
          toast({
            title: "Signup failed",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome to SYNOVA!",
            description: "Your account has been created successfully.",
          });
          navigate("/dashboard");
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormDisabled = isLoading || isChecking || lockoutCountdown > 0;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20" />
        <div className="relative z-10 flex flex-col justify-center items-center p-12">
          <img src={synovaLogo} alt="Synova" className="h-24 w-24 object-contain mb-8" />
          <h1 className="text-5xl font-bold text-foreground mb-4">SYNOVA</h1>
          <p className="text-xl text-muted-foreground text-center max-w-md">
            AI-powered education platform designed to make learning accessible,
            engaging, and personalized for everyone.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-2">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Adaptive Learning</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-xl bg-secondary/20 flex items-center justify-center mx-auto mb-2">
                <Users className="h-6 w-6 text-secondary" />
              </div>
              <p className="text-sm text-muted-foreground">All Ages</p>
            </div>
            <div className="text-center">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-2">
                <Heart className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Family Friendly</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6">
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
              <div className="lg:hidden mx-auto mb-4">
                <img src={synovaLogo} alt="Synova" className="h-16 w-16 object-contain" />
              </div>
              <GlassCardTitle>
                {isLogin ? "Welcome Back" : "Create Account"}
              </GlassCardTitle>
              <GlassCardDescription>
                {isLogin
                  ? "Sign in to continue your learning journey"
                  : "Join SYNOVA and start learning today"}
              </GlassCardDescription>
            </GlassCardHeader>

            <GlassCardContent>
              {/* Lockout Warning */}
              {lockoutCountdown > 0 && (
                <div className="mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Account temporarily locked</p>
                    <p className="text-sm text-muted-foreground">
                      Too many failed login attempts. Please try again in{" "}
                      <span className="font-mono font-medium text-destructive">
                        {formatCountdown(lockoutCountdown)}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder="Enter your name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="pl-10"
                        disabled={isFormDisabled}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors({ ...errors, email: undefined });
                      }}
                      className="pl-10"
                      disabled={isFormDisabled}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password)
                          setErrors({ ...errors, password: undefined });
                      }}
                      className="pl-10"
                      disabled={isFormDisabled}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                {!isLogin && (
                  <div className="space-y-3">
                    <Label>I am a...</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {roleOptions.map((role) => {
                        const Icon = role.icon;
                        return (
                          <button
                            key={role.value}
                            type="button"
                            onClick={() => setSelectedRole(role.value)}
                            disabled={isFormDisabled}
                            className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                              selectedRole === role.value
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            } ${isFormDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <Icon
                              className={`h-6 w-6 mx-auto mb-1 ${
                                selectedRole === role.value
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <p
                              className={`text-xs font-medium ${
                                selectedRole === role.value
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {role.label}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={isFormDisabled}
                >
                  {isLoading || isChecking ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : lockoutCountdown > 0 ? (
                    `Locked (${formatCountdown(lockoutCountdown)})`
                  ) : isLogin ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              {isLogin && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm text-primary hover:underline transition-colors"
                  >
                    Forgot your password?
                  </button>
                </div>
              )}

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrors({});
                    setLockoutCountdown(0);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isLogin
                    ? "Don't have an account? Sign up"
                    : "Already have an account? Sign in"}
                </button>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
