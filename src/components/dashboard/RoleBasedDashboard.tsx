import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import GamifiedDashboard from "@/pages/GamifiedDashboard";
import TeacherDashboard from "@/pages/TeacherDashboard";

export default function RoleBasedDashboard() {
  const { userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Teacher gets their own specialized dashboard
  if (userRole === "teacher") {
    return <TeacherDashboard />;
  }

  // Students, caregivers, and others get the gamified dashboard
  return <GamifiedDashboard />;
}
