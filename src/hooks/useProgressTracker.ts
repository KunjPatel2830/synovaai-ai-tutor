import { useCallback } from "react";
import { externalSupabase } from "@/lib/external-supabase";
import { useAuth } from "@/contexts/AuthContext";

export function useProgressTracker() {
  const { user } = useAuth();

  const updateStreak = useCallback(async () => {
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    // Get current streak data
    const { data: streakData } = await externalSupabase
      .from("learning_streaks")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!streakData) {
      // Create streak record if it doesn't exist
      await externalSupabase.from("learning_streaks").insert({
        user_id: user.id,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: today,
      });
      return;
    }

    const lastActivity = streakData.last_activity_date;
    
    // Already updated today
    if (lastActivity === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newStreak = 1;
    if (lastActivity === yesterdayStr) {
      // Consecutive day - increment streak
      newStreak = (streakData.current_streak || 0) + 1;
    }

    const newLongest = Math.max(newStreak, streakData.longest_streak || 0);

    await externalSupabase
      .from("learning_streaks")
      .update({
        current_streak: newStreak,
        longest_streak: newLongest,
        last_activity_date: today,
      })
      .eq("user_id", user.id);
  }, [user]);

  const trackProgress = useCallback(
    async (topic: string, subject: string, score: number = 50) => {
      if (!user) return;

      // Update streak first
      await updateStreak();

      // Check if progress for this topic exists
      const { data: existingProgress } = await externalSupabase
        .from("learning_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("topic", topic)
        .maybeSingle();

      if (existingProgress) {
        // Update existing progress
        const newAttempts = (existingProgress.attempts || 0) + 1;
        const newScore = Math.min(100, Math.max(score, existingProgress.score || 0));
        
        await externalSupabase
          .from("learning_progress")
          .update({
            score: newScore,
            attempts: newAttempts,
            last_studied_at: new Date().toISOString(),
            mastered: newScore >= 80,
          })
          .eq("id", existingProgress.id);
      } else {
        // Create new progress record
        await externalSupabase.from("learning_progress").insert({
          user_id: user.id,
          topic,
          score,
          attempts: 1,
          last_studied_at: new Date().toISOString(),
          mastered: score >= 80,
        });
      }
    },
    [user, updateStreak]
  );

  const trackHelpRequest = useCallback(
    async (question: string, subject: string, topic: string | null, mode: "tutor" | "homework" | "exam") => {
      if (!user) return;

      await externalSupabase.from("student_help_requests").insert({
        user_id: user.id,
        subject,
        topic,
        question,
        mode,
      });
    },
    [user]
  );

  return { trackProgress, updateStreak, trackHelpRequest };
}
