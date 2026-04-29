import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";

export const SUPPORTED_LANGUAGES = [
  { code: "english", name: "English", bcp47: "en-US" },
  { code: "hindi", name: "Hindi", bcp47: "hi-IN" },
  { code: "hinglish", name: "Hinglish", bcp47: "en-IN" },
  { code: "spanish", name: "Spanish", bcp47: "es-ES" },
  { code: "french", name: "French", bcp47: "fr-FR" },
  { code: "german", name: "German", bcp47: "de-DE" },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];

const STORAGE_KEY = "synova_language_preference";
const DEFAULT_LANGUAGE: LanguageCode = "english";

export function bcp47For(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.bcp47 ?? "en-US";
}

export function languageName(code: string): string {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name ?? "English";
}

/**
 * Global language preference for ALL learning modes and voice output.
 * Reads from profiles.tutor_language, falls back to localStorage, then English.
 */
export function useLanguagePreference() {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE;
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await externalSupabase
        .from("profiles")
        .select("tutor_language")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const lang = (data?.tutor_language as string) || DEFAULT_LANGUAGE;
      const normalized = SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.code || DEFAULT_LANGUAGE;
      setLanguageState(normalized);
      try { localStorage.setItem(STORAGE_KEY, normalized); } catch {}
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const setLanguage = async (code: LanguageCode) => {
    setLanguageState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
    if (user) {
      await externalSupabase
        .from("profiles")
        .update({ tutor_language: code })
        .eq("user_id", user.id);
    }
  };

  return {
    language,
    languageName: languageName(language),
    bcp47: bcp47For(language),
    setLanguage,
    loaded,
  };
}
