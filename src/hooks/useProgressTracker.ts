import { useCallback } from "react";
import { externalSupabase } from "@/lib/external-supabase";
import { useAuth } from "@/contexts/AuthContext";

export function useProgressTracker() {
  const { user } = useAuth();

  const updateStreak = useCallback(async () => {
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];

    const { data: streakData } = await externalSupabase
      .from("learning_streaks")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!streakData) {
      await externalSupabase.from("learning_streaks").insert({
        user_id: user.id,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: today,
      });
      return;
    }

    const lastActivity = streakData.last_activity_date;
    if (lastActivity === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newStreak = 1;
    if (lastActivity === yesterdayStr) {
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

  /**
   * Track progress for a topic. Score is incremental:
   * - Each interaction adds points based on quality (scoreIncrement)
   * - Score caps at 100 and grows gradually over multiple interactions
   * - mastered = true when score reaches 80+
   */
  const trackProgress = useCallback(
    async (topic: string, subject: string, scoreIncrement: number = 10) => {
      if (!user) return;

      await updateStreak();

      // Clamp increment to reasonable range
      const increment = Math.max(1, Math.min(scoreIncrement, 25));

      const { data: existingProgress } = await externalSupabase
        .from("learning_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("topic", topic)
        .maybeSingle();

      if (existingProgress) {
        const newAttempts = (existingProgress.attempts || 0) + 1;
        // Gradual increase: add increment but cap at 100
        const currentScore = existingProgress.score || 0;
        const newScore = Math.min(100, currentScore + increment);

        await externalSupabase
          .from("learning_progress")
          .update({
            score: newScore,
            attempts: newAttempts,
            last_studied_at: new Date().toISOString(),
            mastered: newScore >= 80,
            difficulty_level: Math.min(5, Math.floor(newAttempts / 3) + 1),
          })
          .eq("id", existingProgress.id);
      } else {
        // First interaction: start low, not at 50%
        await externalSupabase.from("learning_progress").insert({
          user_id: user.id,
          topic,
          score: increment,
          attempts: 1,
          last_studied_at: new Date().toISOString(),
          mastered: false,
          difficulty_level: 1,
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
