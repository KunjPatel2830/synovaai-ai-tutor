import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";

export function useCurriculumPreference() {
  const { user } = useAuth();
  const [curriculum, setCurriculumState] = useState("CBSE");
  const [isLoading, setIsLoading] = useState(true);

  // Load curriculum from profile on mount
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadCurriculum = async () => {
      try {
        const { data, error } = await externalSupabase
          .from("profiles")
          .select("curriculum")
          .eq("user_id", user.id)
          .single();

        if (!error && data?.curriculum) {
          setCurriculumState(data.curriculum);
        }
      } catch (error) {
        console.error("Failed to load curriculum preference:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCurriculum();
  }, [user]);

  // Save curriculum to profile when it changes
  const setCurriculum = async (newCurriculum: string) => {
    setCurriculumState(newCurriculum);

    if (!user) return;

    try {
      await externalSupabase
        .from("profiles")
        .update({ curriculum: newCurriculum })
        .eq("user_id", user.id);
    } catch (error) {
      console.error("Failed to save curriculum preference:", error);
    }
  };

  return {
    curriculum,
    setCurriculum,
    isLoading,
  };
}
