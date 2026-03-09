import { getExternalAccessToken } from "@/lib/external-auth";
import { EXTERNAL_SUPABASE_URL_PUBLIC, EXTERNAL_SUPABASE_ANON_KEY_PUBLIC } from "@/lib/external-supabase";

type InvokeOptions = {
  /** Abort signal for user-cancel / page unmount */
  signal?: AbortSignal;
  /** Hard timeout for the request (ms) */
  timeoutMs?: number;
  /** Additional retries after the first attempt (0-2 recommended) */
  retries?: number;
  /** Marks request in perf logs */
  label?: string;
  /** Warn when request exceeds this duration (ms) */
  slowThresholdMs?: number;
  /** Use external Supabase URL instead of Lovable Cloud */
  useExternal?: boolean;
};

export type InvokeResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  durationMs: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

function getBackendBaseUrl() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) throw new Error("Missing backend URL");
  return url.replace(/\/$/, "");
}

function getBackendApiKey() {
  // publishable key (safe for client)
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!key) throw new Error("Missing backend key");
  return key;
}

function recordPerf(entry: {
  name: string;
  label?: string;
  status: number;
  durationMs: number;
  at: number;
}) {
  if (typeof window === "undefined") return;
  const w = window as any;
  w.__synovaPerf = w.__synovaPerf || { calls: [] as any[] };
  w.__synovaPerf.calls.unshift(entry);
  w.__synovaPerf.calls = w.__synovaPerf.calls.slice(0, 50);
}

/**
 * Unified backend function invoker with:
 * - external auth bearer token
 * - AbortController support
 * - timeout
 * - max 0-2 retries
 * - perf timing + slow warnings
 */
export async function invokeBackendFunction<T = any>(
  functionName: string,
  body: unknown,
  opts: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  // Lightweight global signal for UI indicators (no behavioral change)
  // Wrapped in try/catch to avoid any runtime crashes in restrictive environments.
  const dispatchPending = (delta: 1 | -1) => {
    try {
      if (typeof window === "undefined") return;
      if (typeof (window as any).CustomEvent !== "function") return;
      window.dispatchEvent(
        new CustomEvent("synova:backend-pending", {
          detail: { delta, name: functionName, at: Date.now() },
        })
      );
    } catch {
      // ignore
    }
  };

  dispatchPending(1);

  try {
  const {
    signal,
    timeoutMs = 20000,
    retries = 1,
    label,
    slowThresholdMs = 2500,
    useExternal = false,
  } = opts;

  const baseUrl = useExternal ? EXTERNAL_SUPABASE_URL_PUBLIC.replace(/\/$/, "") : getBackendBaseUrl();
  const apiKey = useExternal ? EXTERNAL_SUPABASE_ANON_KEY_PUBLIC : getBackendApiKey();
  const url = `${baseUrl}/functions/v1/${functionName}`;

  const token = await getExternalAccessToken();

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = performance.now();
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const abortListener = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      signal.addEventListener("abort", abortListener, { once: true });
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: apiKey,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });

      const durationMs = Math.round(performance.now() - started);
      const status = res.status;

      const text = await res.text();
      let json: any = undefined;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        // not json
      }

      recordPerf({ name: functionName, label, status, durationMs, at: Date.now() });
      if (durationMs >= slowThresholdMs) {
        // Lightweight slow-call warning
        console.warn(
          `[perf] slow backend call: ${functionName}${label ? ` (${label})` : ""} took ${durationMs}ms (status ${status})`
        );
      }

      if (!res.ok) {
        const msg =
          (json?.error as string | undefined) ||
          (json?.message as string | undefined) ||
          (typeof text === "string" && text.trim() ? text.trim() : `Request failed (${status})`);

        // Retry on transient statuses
        if (attempt < retries && isRetryableStatus(status)) {
          await sleep(350 * (attempt + 1));
          continue;
        }

        return { ok: false, status, error: msg, durationMs };
      }

      return { ok: true, status, data: json as T, durationMs };
    } catch (err) {
      lastError = err;
      const durationMs = Math.round(performance.now() - started);

      if (isAbortError(err)) {
        recordPerf({ name: functionName, label, status: 0, durationMs, at: Date.now() });
        return {
          ok: false,
          status: 0,
          error: timedOut ? "Request timed out" : "Request aborted",
          durationMs,
        };
      }

      // Network error (TypeError: Failed to fetch) is retryable
      if (attempt < retries) {
        await sleep(350 * (attempt + 1));
        continue;
      }

      recordPerf({ name: functionName, label, status: 0, durationMs, at: Date.now() });
      return {
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : "Network error",
        durationMs,
      };
    } finally {
      window.clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", abortListener);
    }
  }

  return {
    ok: false,
    status: 0,
    error: lastError instanceof Error ? lastError.message : "Unknown error",
    durationMs: 0,
  };
  } finally {
    dispatchPending(-1);
  }
}
