import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";

export interface LearningHistoryEntry {
  id: string;
  user_id: string;
  subject: string;
  topic: string | null;
  question: string | null;
  status: "solved" | "stuck" | "in_progress";
  difficulty: "easy" | "medium" | "hard";
  mode: "tutor" | "homework" | "doubt" | "exam" | "curriculum";
  session_duration_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface WeakTopic {
  subject: string;
  topic: string;
  stuckCount: number;
}

export interface LearningRecommendation {
  type: "continue" | "practice" | "revision";
  subject: string;
  topic: string;
  message: string;
  lastStatus: "solved" | "stuck" | "in_progress";
  lastStudied: string;
}

export function useLearningHistory() {
  const { user } = useAuth();
  const [recentHistory, setRecentHistory] = useState<LearningHistoryEntry[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([]);
  const [lastSession, setLastSession] = useState<LearningHistoryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch learning history
  const fetchHistory = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // Get recent 50 entries
      const { data, error } = await externalSupabase
        .from("learning_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const history = (data || []) as LearningHistoryEntry[];
      setRecentHistory(history);
      setLastSession(history[0] || null);

      // Analyze weak topics (topics with multiple "stuck" status)
      const topicStats: Record<string, { subject: string; topic: string; stuckCount: number; totalCount: number }> = {};
      
      history.forEach((entry) => {
        if (!entry.topic) return;
        const key = `${entry.subject}:${entry.topic}`;
        if (!topicStats[key]) {
          topicStats[key] = { subject: entry.subject, topic: entry.topic, stuckCount: 0, totalCount: 0 };
        }
        topicStats[key].totalCount++;
        if (entry.status === "stuck") {
          topicStats[key].stuckCount++;
        }
      });

      // Topics with 2+ stuck instances are weak
      const weak = Object.values(topicStats)
        .filter((stat) => stat.stuckCount >= 2)
        .sort((a, b) => b.stuckCount - a.stuckCount)
        .slice(0, 5);
      setWeakTopics(weak);

      // Generate recommendations
      const recs: LearningRecommendation[] = [];

      // 1. Continue last session if in_progress or stuck
      if (history[0] && (history[0].status === "in_progress" || history[0].status === "stuck")) {
        const lastEntry = history[0];
        recs.push({
          type: "continue",
          subject: lastEntry.subject,
          topic: lastEntry.topic || "General",
          message: lastEntry.status === "stuck"
            ? `Last time you were working on ${lastEntry.topic || lastEntry.subject} and got stuck. Would you like to continue?`
            : `You were learning ${lastEntry.topic || lastEntry.subject}. Ready to pick up where you left off?`,
          lastStatus: lastEntry.status,
          lastStudied: lastEntry.created_at,
        });
      }

      // 2. Suggest practice for weak topics
      weak.slice(0, 2).forEach((w) => {
        recs.push({
          type: "practice",
          subject: w.subject,
          topic: w.topic,
          message: `You've asked several questions about ${w.topic}. Practice a few problems to strengthen this topic?`,
          lastStatus: "stuck",
          lastStudied: new Date().toISOString(),
        });
      });

      // 3. Suggest revision for topics not visited in 7+ days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const oldTopics = history.filter((h) => {
        const createdDate = new Date(h.created_at);
        return createdDate < sevenDaysAgo && h.status === "solved" && h.topic;
      });
      
      const uniqueOldTopics = new Map<string, LearningHistoryEntry>();
      oldTopics.forEach((h) => {
        const key = `${h.subject}:${h.topic}`;
        if (!uniqueOldTopics.has(key)) {
          uniqueOldTopics.set(key, h);
        }
      });

      Array.from(uniqueOldTopics.values()).slice(0, 2).forEach((entry) => {
        // Don't duplicate if already in recommendations
        if (!recs.some((r) => r.subject === entry.subject && r.topic === entry.topic)) {
          recs.push({
            type: "revision",
            subject: entry.subject,
            topic: entry.topic || "General",
            message: `It's been a while since you studied ${entry.topic}. A quick revision might help!`,
            lastStatus: entry.status,
            lastStudied: entry.created_at,
          });
        }
      });

      setRecommendations(recs.slice(0, 4));
    } catch (err) {
      console.error("Failed to fetch learning history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Add or update a learning history entry
  const trackLearning = useCallback(
    async (params: {
      subject: string;
      topic?: string;
      question?: string;
      status?: "solved" | "stuck" | "in_progress";
      difficulty?: "easy" | "medium" | "hard";
      mode?: "tutor" | "homework" | "doubt" | "exam" | "curriculum";
    }) => {
      if (!user) return null;

      try {
        const { data, error } = await externalSupabase
          .from("learning_history")
          .insert({
            user_id: user.id,
            subject: params.subject,
            topic: params.topic || null,
            question: params.question || null,
            status: params.status || "in_progress",
            difficulty: params.difficulty || "medium",
            mode: params.mode || "tutor",
          })
          .select()
          .single();

        if (error) throw error;
        
        // Refresh history
        fetchHistory();
        
        return data;
      } catch (err) {
        console.error("Failed to track learning:", err);
        return null;
      }
    },
    [user, fetchHistory]
  );

  // Update status of an existing entry
  const updateLearningStatus = useCallback(
    async (entryId: string, status: "solved" | "stuck" | "in_progress") => {
      if (!user) return;

      try {
        await externalSupabase
          .from("learning_history")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", entryId)
          .eq("user_id", user.id);

        fetchHistory();
      } catch (err) {
        console.error("Failed to update learning status:", err);
      }
    },
    [user, fetchHistory]
  );

  // Generate AI context string including learning history
  const getMemoryContext = useCallback(() => {
    const parts: string[] = [];

    if (lastSession && lastSession.topic) {
      const statusText = lastSession.status === "stuck" 
        ? "struggled with" 
        : lastSession.status === "solved" 
          ? "successfully completed"
          : "was working on";
      parts.push(`Last session: Student ${statusText} "${lastSession.topic}" in ${lastSession.subject}.`);
    }

    if (weakTopics.length > 0) {
      const weakList = weakTopics.slice(0, 3).map((w) => `${w.topic} (${w.subject})`).join(", ");
      parts.push(`Weak areas needing more practice: ${weakList}.`);
    }

    if (parts.length > 0) {
      return `LEARNING HISTORY: ${parts.join(" ")} Adjust explanations to support these areas.`;
    }

    return "";
  }, [lastSession, weakTopics]);

  return {
    recentHistory,
    weakTopics,
    recommendations,
    lastSession,
    isLoading,
    trackLearning,
    updateLearningStatus,
    getMemoryContext,
    refetch: fetchHistory,
  };
}
