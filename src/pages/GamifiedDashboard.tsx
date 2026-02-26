import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { HeroBanner } from "@/components/dashboard/HeroBanner";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { UserOverview } from "@/components/dashboard/UserOverview";
import { LearningModesSection } from "@/components/dashboard/LearningModesSection";
import { LeaderboardSection } from "@/components/dashboard/LeaderboardSection";
import { DailyQuestSection } from "@/components/dashboard/DailyQuestSection";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { BadgesDisplay } from "@/components/badges/BadgesDisplay";
import { JoinWithCode } from "@/components/invitation/JoinWithCode";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/glass-card";
import { UserPlus } from "lucide-react";

export default function GamifiedDashboard() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-10 overflow-x-hidden">
        {/* Welcome Banner */}
        <HeroBanner />

        {/* Stats Row */}
        <StatsCards />

        {/* Learning Modes - Full Width on Mobile, shown first */}
        <div className="lg:hidden">
          <LearningModesSection />
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-3 space-y-5">
            <UserOverview />
            <DailyQuestSection />
          </div>

          {/* Middle Column */}
          <div className="lg:col-span-6 space-y-5">
            <div className="hidden lg:block">
              <LearningModesSection />
            </div>
            <RecentActivity />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-3 space-y-5">
            <LeaderboardSection />
            <BadgesDisplay />
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Connect</h3>
              </div>
              {user && <JoinWithCode />}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
