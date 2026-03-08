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
      {/* pt-16 on mobile for header, lg:pt-0 and lg:ml-64 for desktop sidebar */}
      <main className="pt-16 lg:pt-2 pb-1 px-2 lg:px-4 lg:ml-64 min-h-screen">
        {children}
      </main>
    </div>;
}