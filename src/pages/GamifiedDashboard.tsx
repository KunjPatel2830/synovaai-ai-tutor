import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { HeroBanner } from "@/components/dashboard/HeroBanner";
import { UserOverview } from "@/components/dashboard/UserOverview";
import { LearningModesSection } from "@/components/dashboard/LearningModesSection";
import { LeaderboardSection } from "@/components/dashboard/LeaderboardSection";
import { DailyQuestSection } from "@/components/dashboard/DailyQuestSection";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { BadgesDisplay } from "@/components/badges/BadgesDisplay";

export default function GamifiedDashboard() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-8">
        {/* Hero Banner */}
        <HeroBanner />

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - User Stats */}
          <div className="lg:col-span-3 space-y-6">
            <UserOverview />
            <DailyQuestSection />
          </div>

          {/* Middle Column - Main Content */}
          <div className="lg:col-span-6 space-y-6">
            <LearningModesSection />
            <RecentActivity />
          </div>

          {/* Right Column - Leaderboard & Badges */}
          <div className="lg:col-span-3 space-y-6">
            <LeaderboardSection />
            <BadgesDisplay />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
