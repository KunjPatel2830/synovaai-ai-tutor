import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { HeroBanner } from "@/components/dashboard/HeroBanner";
import { UserOverview } from "@/components/dashboard/UserOverview";
import { MiniGamesSection } from "@/components/dashboard/MiniGamesSection";
import { LeaderboardSection } from "@/components/dashboard/LeaderboardSection";
import { DailyQuestSection } from "@/components/dashboard/DailyQuestSection";
import { PerformanceStats } from "@/components/dashboard/PerformanceStats";
import { DuelInvitations } from "@/components/dashboard/DuelInvitations";
import { FriendList } from "@/components/dashboard/FriendList";

export default function GamifiedDashboard() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-8">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-9 space-y-6">
            {/* Hero Banner */}
            <HeroBanner />

            {/* Overview and Performance Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* User Overview Card */}
              <UserOverview />
              
              {/* Performance Stats */}
              <div className="md:col-span-2">
                <PerformanceStats />
              </div>
            </div>

            {/* Mini Games Section */}
            <MiniGamesSection />

            {/* Leaderboard and Daily Quest Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LeaderboardSection />
              <DailyQuestSection />
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            {/* Duel Invitations */}
            <DuelInvitations />
            
            {/* Friend List */}
            <FriendList />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
