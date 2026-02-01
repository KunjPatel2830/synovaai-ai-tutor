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
      <div className="max-w-7xl mx-auto space-y-8 pb-10 overflow-x-hidden animate-fade-in">
        {/* Hero Banner */}
        <HeroBanner />

        {/* Learning Modes - Full Width on Mobile, shown first */}
        <div className="lg:hidden animate-fade-in" style={{ animationDelay: '100ms' }}>
          <LearningModesSection />
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - User Stats */}
          <div className="lg:col-span-3 space-y-6">
            <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
              <UserOverview />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
              <DailyQuestSection />
            </div>
          </div>

          {/* Middle Column - Main Content */}
          <div className="lg:col-span-6 space-y-6">
            {/* Learning Modes - Only show on desktop in grid */}
            <div className="hidden lg:block animate-fade-in" style={{ animationDelay: '150ms' }}>
              <LearningModesSection />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '250ms' }}>
              <RecentActivity />
            </div>
          </div>

          {/* Right Column - Leaderboard & Badges */}
          <div className="lg:col-span-3 space-y-6">
            <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
              <LeaderboardSection />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
              <BadgesDisplay />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
