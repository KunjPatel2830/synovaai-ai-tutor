import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { HeroBanner } from "@/components/dashboard/HeroBanner";
import { TeacherQuickActions } from "@/components/dashboard/TeacherQuickActions";
import { TeacherStudentOverview } from "@/components/dashboard/TeacherStudentOverview";
import { LeaderboardSection } from "@/components/dashboard/LeaderboardSection";

export default function TeacherDashboard() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-8 overflow-x-hidden">
        <HeroBanner />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <TeacherQuickActions />
          </div>

          <div className="lg:col-span-4 space-y-6">
            <TeacherStudentOverview />
            <LeaderboardSection />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
