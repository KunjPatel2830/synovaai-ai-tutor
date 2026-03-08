import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { StudentOnboarding } from "@/components/onboarding/StudentOnboarding";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'student' | 'teacher' | 'caregiver' | 'admin'>;
  requireEmailVerification?: boolean;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  requireEmailVerification = false 
}: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const { needsOnboarding, isLoading: profileLoading, updateProfile } = useStudentProfile();
  const [redirectReady, setRedirectReady] = useState(false);

  useEffect(() => {
    if (loading) {
      setRedirectReady(false);
      return;
    }
    if (user) {
      setRedirectReady(false);
      return;
    }
    const t = window.setTimeout(() => setRedirectReady(true), 700);
    return () => window.clearTimeout(t);
  }, [loading, user]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !redirectReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireEmailVerification && !user.email_confirmed_at) {
    return <Navigate to="/verify-email" replace />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show onboarding for students who haven't set up their profile
  if (needsOnboarding && userRole === "student") {
    return (
      <StudentOnboarding
        onComplete={async (data) => {
          await updateProfile(data);
        }}
      />
    );
  }

  return <>{children}</>;
}
