import { useEffect, useMemo, useRef, useState } from "react";
import { externalSupabase } from "@/lib/external-supabase";

type UiStatus =
  | { kind: "hidden" }
  | { kind: "offline" }
  | { kind: "auth-refresh" }
  | { kind: "backend-pending" };

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}

export function NetworkStatusIndicator() {
  const online = useOnline();
  const [backendPending, setBackendPending] = useState(0);
  const [authRefreshing, setAuthRefreshing] = useState(false);
  const authRefreshHideTimer = useRef<number | null>(null);

  useEffect(() => {
    const onPending = (e: Event) => {
      const detail = (e as CustomEvent).detail as { delta?: number } | undefined;
      const delta = typeof detail?.delta === "number" ? detail.delta : 0;
      if (!delta) return;
      setBackendPending((v) => Math.max(0, v + delta));
    };
    window.addEventListener("synova:backend-pending", onPending);
    return () => window.removeEventListener("synova:backend-pending", onPending);
  }, []);

  useEffect(() => {
    const { data } = externalSupabase.auth.onAuthStateChange((event) => {
      if (event !== "TOKEN_REFRESHED") return;

      setAuthRefreshing(true);
      if (authRefreshHideTimer.current) window.clearTimeout(authRefreshHideTimer.current);
      authRefreshHideTimer.current = window.setTimeout(() => setAuthRefreshing(false), 2000);
    });

    return () => {
      if (authRefreshHideTimer.current) window.clearTimeout(authRefreshHideTimer.current);
      data.subscription.unsubscribe();
    };
  }, []);

  const status: UiStatus = useMemo(() => {
    if (!online) return { kind: "offline" };
    if (authRefreshing) return { kind: "auth-refresh" };
    if (backendPending > 0) return { kind: "backend-pending" };
    return { kind: "hidden" };
  }, [online, authRefreshing, backendPending]);

  if (status.kind === "hidden") return null;

  const label =
    status.kind === "offline"
      ? "Offline — reconnecting…"
      : status.kind === "auth-refresh"
        ? "Refreshing session…"
        : "Connecting…";

  return (
    <div className="fixed right-3 top-3 z-[60]">
      <div className="glass-strong border border-border/60 rounded-full px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
        <span className="text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
