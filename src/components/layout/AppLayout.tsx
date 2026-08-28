import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { useNavigationPerf } from "@/hooks/useNavigationPerf";
import { prefetchLearningModes } from "@/lib/prefetch-routes";
interface AppLayoutProps {
  children: ReactNode;
}
export function AppLayout({
  children
}: AppLayoutProps) {
  useNavigationPerf();
  useEffect(() => {
    // Warm up the chunks for other learning modes so switching feels instant.
    prefetchLearningModes();
  }, []);
  return <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pt-16 lg:pt-2 pb-1 px-2 lg:px-4 lg:ml-64 h-screen overflow-y-auto">
        {children}
      </main>
    </div>;
}
