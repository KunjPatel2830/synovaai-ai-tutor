import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  criteria_type: string;
  criteria_value: number;
  points: number;
}

interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  badge: Badge;
}

interface BadgeProgress {
  badge: Badge;
  current: number;
  target: number;
  earned: boolean;
  earnedAt?: string;
}

export function useBadges() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [badgeProgress, setBadgeProgress] = useState<BadgeProgress[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all badges and user's earned badges
  const fetchBadges = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch all available badges
      const { data: allBadges, error: badgesError } = await supabase
        .from("badges")
        .select("*")
        .order("points", { ascending: true });

      if (badgesError) throw badgesError;

      // Fetch user's earned badges
      const { data: earnedBadges, error: earnedError } = await supabase
        .from("user_badges")
        .select("*, badge:badges(*)")
        .eq("user_id", user.id);

      if (earnedError) throw earnedError;

      setBadges(allBadges || []);
      setUserBadges(earnedBadges || []);

      // Calculate total points
      const points = (earnedBadges || []).reduce((sum, ub) => {
        return sum + (ub.badge?.points || 0);
      }, 0);
      setTotalPoints(points);

      // Calculate progress for each badge
      await calculateProgress(allBadges || [], earnedBadges || []);
    } catch (error) {
      console.error("Error fetching badges:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Calculate progress for each badge
  const calculateProgress = async (allBadges: Badge[], earnedBadges: UserBadge[]) => {
    if (!user) return;

    const earnedBadgeIds = new Set(earnedBadges.map(ub => ub.badge_id));
    const progress: BadgeProgress[] = [];

    for (const badge of allBadges) {
      const earned = earnedBadgeIds.has(badge.id);
      const earnedBadge = earnedBadges.find(ub => ub.badge_id === badge.id);
      
      let current = 0;

      try {
        switch (badge.criteria_type) {
          case "sessions_completed": {
            const { count } = await supabase
              .from("chat_sessions")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id);
            current = count || 0;
            break;
          }
          case "streak_days": {
            const { data } = await supabase
              .from("learning_streaks")
              .select("current_streak, longest_streak")
              .eq("user_id", user.id)
              .maybeSingle();
            current = Math.max(data?.current_streak || 0, data?.longest_streak || 0);
            break;
          }
          case "topics_studied": {
            const { count } = await supabase
              .from("learning_progress")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id);
            current = count || 0;
            break;
          }
          case "topics_mastered": {
            const { count } = await supabase
              .from("learning_progress")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("mastered", true);
            current = count || 0;
            break;
          }
          case "homework_questions": {
            const { count } = await supabase
              .from("student_help_requests")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("mode", "homework");
            current = count || 0;
            break;
          }
          case "voice_sessions": {
            const { count } = await supabase
              .from("chat_sessions")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("mode", "voice");
            current = count || 0;
            break;
          }
          case "perfect_score": {
            const { count } = await supabase
              .from("learning_progress")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .gte("score", 100);
            current = count || 0;
            break;
          }
          default:
            current = 0;
        }
      } catch (error) {
        console.error(`Error calculating progress for ${badge.criteria_type}:`, error);
      }

      progress.push({
        badge,
        current: Math.min(current, badge.criteria_value),
        target: badge.criteria_value,
        earned,
        earnedAt: earnedBadge?.earned_at,
      });
    }

    setBadgeProgress(progress);
  };

  // Check and award new badges
  const checkAndAwardBadges = useCallback(async () => {
    if (!user) return;

    const earnedBadgeIds = new Set(userBadges.map(ub => ub.badge_id));
    const newBadges: Badge[] = [];

    for (const bp of badgeProgress) {
      if (!bp.earned && bp.current >= bp.target) {
        // Award this badge
        try {
          const { error } = await supabase
            .from("user_badges")
            .insert({
              user_id: user.id,
              badge_id: bp.badge.id,
            });

          if (!error) {
            newBadges.push(bp.badge);
          }
        } catch (error) {
          console.error("Error awarding badge:", error);
        }
      }
    }

    if (newBadges.length > 0) {
      // Show toast for each new badge
      for (const badge of newBadges) {
        toast({
          title: "🎉 Badge Earned!",
          description: `You earned the "${badge.name}" badge! +${badge.points} points`,
        });
      }
      // Refresh badges
      await fetchBadges();
    }

    return newBadges;
  }, [user, userBadges, badgeProgress, toast, fetchBadges]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  // Auto-check for new badges when progress changes
  useEffect(() => {
    if (badgeProgress.length > 0 && !isLoading) {
      checkAndAwardBadges();
    }
  }, [badgeProgress.length, isLoading]);

  return {
    badges,
    userBadges,
    badgeProgress,
    totalPoints,
    isLoading,
    refetch: fetchBadges,
    checkAndAwardBadges,
  };
}
