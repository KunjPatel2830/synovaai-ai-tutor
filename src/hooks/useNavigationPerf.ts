import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Lightweight navigation performance logger (route switch -> next paint).
 * Writes into window.__synovaPerf.calls and console.warn on slow nav.
 */
export function useNavigationPerf(slowThresholdMs: number = 600) {
  const location = useLocation();

  useEffect(() => {
    const started = performance.now();
    // wait for next paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const ms = Math.round(performance.now() - started);
        const w = window as any;
        w.__synovaPerf = w.__synovaPerf || { calls: [] as any[] };
        w.__synovaPerf.calls.unshift({
          name: "navigation",
          label: location.pathname,
          status: 200,
          durationMs: ms,
          at: Date.now(),
        });
        w.__synovaPerf.calls = w.__synovaPerf.calls.slice(0, 50);

        if (ms >= slowThresholdMs) {
          console.warn(`[perf] slow navigation to ${location.pathname}: ${ms}ms`);
        }
      });
    });
  }, [location.pathname]);
}
