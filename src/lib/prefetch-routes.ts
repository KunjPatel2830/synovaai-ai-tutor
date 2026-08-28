/**
 * Prefetches lazy-loaded learning-mode pages during browser idle time
 * so that switching between modes from the dashboard feels instant
 * (no waiting for the chunk to download on first visit).
 *
 * Uses requestIdleCallback when available; falls back to a 1.5s timeout.
 */
let prefetched = false;

export function prefetchLearningModes() {
  if (prefetched) return;
  prefetched = true;

  const tasks: Array<() => Promise<unknown>> = [
    () => import("@/pages/Tutor"),
    () => import("@/pages/Homework"),
    () => import("@/pages/ExamPrep"),
    () => import("@/pages/CurriculumStudy"),
    () => import("@/pages/DoubtSolver"),
    () => import("@/pages/VoiceTutor"),
    () => import("@/pages/LanguagePractice"),
    () => import("@/pages/StudyPlanner"),
    () => import("@/pages/PeerMode"),
    () => import("@/pages/Settings"),
  ];

  const runQueue = (i = 0) => {
    if (i >= tasks.length) return;
    const next = () => runQueue(i + 1);
    tasks[i]().then(next, next);
  };

  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };

  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(() => runQueue(), { timeout: 3000 });
  } else {
    setTimeout(() => runQueue(), 1500);
  }
}
