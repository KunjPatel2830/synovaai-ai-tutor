import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";

export interface StudentProfile {
  standard: string | null;
  curriculum: string | null;
  target_exam: string | null;
  display_name: string | null;
}

export function useStudentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await externalSupabase
        .from("profiles")
        .select("standard, curriculum, target_exam, display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as StudentProfile);
        // Need onboarding if standard is not set
        setNeedsOnboarding(!data.standard);
      } else {
        setNeedsOnboarding(true);
      }
    } catch (err) {
      console.error("Failed to load student profile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (updates: Partial<StudentProfile>) => {
    if (!user) return;

    try {
      const { error } = await externalSupabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);

      if (!error) {
        setProfile((prev) => (prev ? { ...prev, ...updates } : (updates as StudentProfile)));
        if (updates.standard) {
          setNeedsOnboarding(false);
        }
      }
      return { error };
    } catch (err) {
      console.error("Failed to update profile:", err);
      return { error: err };
    }
  };

  /** Build context string for AI prompts */
  const getAIContext = useCallback(() => {
    if (!profile) return "";
    const parts: string[] = [];
    if (profile.standard) parts.push(`Student is in ${profile.standard}`);
    if (profile.curriculum) parts.push(`studying under ${profile.curriculum} curriculum`);
    if (profile.target_exam) parts.push(`preparing for ${profile.target_exam}`);
    return parts.length > 0
      ? `STUDENT PROFILE: ${parts.join(", ")}. Tailor explanations to this level and board.`
      : "";
  }, [profile]);

  return {
    profile,
    isLoading,
    needsOnboarding,
    updateProfile,
    getAIContext,
    refetch: fetchProfile,
  };
}
