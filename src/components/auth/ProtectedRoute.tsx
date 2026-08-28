import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
  // For demo/onboarding we don't block the app behind email verification.
  requireEmailVerification = false 
}: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const [redirectReady, setRedirectReady] = useState(false);

  // Grace period: prevents redirect flicker if auth state is briefly null during refresh/reconnect.
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

  if (loading) {
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

  // Check email verification status
  if (requireEmailVerification && !user.email_confirmed_at) {
    return <Navigate to="/verify-email" replace />;
  }

  // If route is role-restricted, wait until userRole is resolved
  if (allowedRoles && userRole === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
