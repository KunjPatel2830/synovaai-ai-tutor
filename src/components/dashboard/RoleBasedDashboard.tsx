import { lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

// Lazy-load both dashboards so users only download the one for their role.
const GamifiedDashboard = lazy(() => import("@/pages/GamifiedDashboard"));
const TeacherDashboard = lazy(() => import("@/pages/TeacherDashboard"));

const FullScreenSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export default function RoleBasedDashboard() {
  const { userRole, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      {userRole === "teacher" ? <TeacherDashboard /> : <GamifiedDashboard />}
    </Suspense>
  );
}
