import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";

interface CurriculumProgress {
  id: string;
  curriculum: string;
  standard: string;
  subject: string;
  chapter: string;
  current_topic_index: number;
  completed_topics: string[];
  total_topics: number;
  last_topic: string | null;
  last_studied_at: string;
}

export function useCurriculumStudyProgress() {
  const { user } = useAuth();
  const [recentProgress, setRecentProgress] = useState<CurriculumProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load recent progress entries on mount
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadRecentProgress = async () => {
      try {
        const { data, error } = await externalSupabase
          .from("curriculum_study_progress")
          .select("*")
          .eq("user_id", user.id)
          .order("last_studied_at", { ascending: false })
          .limit(10);

        if (!error && data) {
          setRecentProgress(data as CurriculumProgress[]);
        }
      } catch (error) {
        console.error("Failed to load curriculum progress:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentProgress();
  }, [user]);

  // Get progress for a specific chapter
  const getChapterProgress = useCallback(
    async (curriculum: string, standard: string, subject: string, chapter: string) => {
      if (!user) return null;

      try {
        const { data, error } = await externalSupabase
          .from("curriculum_study_progress")
          .select("*")
          .eq("user_id", user.id)
          .eq("curriculum", curriculum)
          .eq("standard", standard)
          .eq("subject", subject)
          .eq("chapter", chapter)
          .maybeSingle();

        if (error) throw error;
        return data as CurriculumProgress | null;
      } catch (error) {
        console.error("Failed to get chapter progress:", error);
        return null;
      }
    },
    [user]
  );

  // Save or update progress
  const saveProgress = useCallback(
    async (
      curriculum: string,
      standard: string,
      subject: string,
      chapter: string,
      currentTopicIndex: number,
      completedTopics: string[],
      totalTopics: number,
      lastTopic: string
    ) => {
      if (!user) return null;

      try {
        // Check if progress exists
        const existing = await getChapterProgress(curriculum, standard, subject, chapter);

        if (existing) {
          // Update existing progress
          const { data, error } = await externalSupabase
            .from("curriculum_study_progress")
            .update({
              current_topic_index: currentTopicIndex,
              completed_topics: completedTopics,
              total_topics: totalTopics,
              last_topic: lastTopic,
              last_studied_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .select()
            .single();

          if (error) throw error;
          return data as CurriculumProgress;
        } else {
          // Create new progress entry
          const { data, error } = await externalSupabase
            .from("curriculum_study_progress")
            .insert({
              user_id: user.id,
              curriculum,
              standard,
              subject,
              chapter,
              current_topic_index: currentTopicIndex,
              completed_topics: completedTopics,
              total_topics: totalTopics,
              last_topic: lastTopic,
            })
            .select()
            .single();

          if (error) throw error;
          return data as CurriculumProgress;
        }
      } catch (error) {
        console.error("Failed to save curriculum progress:", error);
        return null;
      }
    },
    [user, getChapterProgress]
  );

  // Get most recent subject studied
  const getMostRecentSubject = useCallback(() => {
    if (recentProgress.length === 0) return null;
    return {
      curriculum: recentProgress[0].curriculum,
      standard: recentProgress[0].standard,
      subject: recentProgress[0].subject,
    };
  }, [recentProgress]);

  return {
    recentProgress,
    isLoading,
    getChapterProgress,
    saveProgress,
    getMostRecentSubject,
  };
}
