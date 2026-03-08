import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useNavigationPerf } from "@/hooks/useNavigationPerf";
interface AppLayoutProps {
  children: ReactNode;
}
export function AppLayout({
  children
}: AppLayoutProps) {
  useNavigationPerf();
  return <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pt-16 lg:pt-2 pb-1 px-2 lg:px-4 lg:ml-64 h-screen overflow-y-auto">
        {children}
      </main>
    </div>;
}