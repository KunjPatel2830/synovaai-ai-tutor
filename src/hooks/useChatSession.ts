import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function useChatSession(mode: string) {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const saveMessages = useCallback(async (
    newMessages: Message[],
    subject?: string,
    topic?: string
  ) => {
    if (!user) return null;

    try {
      let currentSessionId = sessionId;

      if (!currentSessionId) {
        const { data: session, error } = await supabase
          .from("chat_sessions")
          .insert({
            user_id: user.id,
            mode,
            subject: subject || null,
            topic: topic || null,
          })
          .select("id")
          .single();

        if (error) throw error;
        currentSessionId = session.id;
        setSessionId(currentSessionId);
      }

      const messagesToSave = newMessages.slice(-2).map((msg) => ({
        session_id: currentSessionId!,
        role: msg.role,
        content: msg.content,
      }));

      await supabase.from("chat_messages").insert(messagesToSave);
      return currentSessionId;
    } catch (error) {
      console.error("Failed to save session:", error);
      return null;
    }
  }, [user, sessionId, mode]);

  const resetSession = useCallback(() => {
    setSessionId(null);
  }, []);

  const loadSession = useCallback((messages: Message[], session: { id: string; subject?: string | null; topic?: string | null }) => {
    setSessionId(session.id);
    return messages;
  }, []);

  return { sessionId, saveMessages, resetSession, loadSession };
}
