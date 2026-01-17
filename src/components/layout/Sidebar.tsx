import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  BookOpen,
  FileText,
  ClipboardList,
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Sun,
  Moon,
  Brain,
  Menu,
  X,
  Sparkles,
  Mic,
  Globe,
  HelpCircle,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import synovaLogo from "@/assets/synova-logo.png";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

function NavItem({ to, icon: Icon, label, onClick }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <NavLink to={to} onClick={onClick}>
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group",
          isActive
            ? "bg-primary text-primary-foreground shadow-md"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        )}
      >
        <Icon className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-300",
          !isActive && "group-hover:scale-110"
        )} />
        <span className="font-medium text-sm">{label}</span>
        {isActive && (
          <Sparkles className="h-3 w-3 ml-auto animate-pulse" />
        )}
      </div>
    </NavLink>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const { userRole, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const studentLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/curriculum-study", icon: BookOpen, label: "Curriculum Study" },
    { to: "/tutor", icon: Brain, label: "AI Tutor" },
    { to: "/homework", icon: FileText, label: "Homework Help" },
    { to: "/voice-tutor", icon: Mic, label: "Voice Tutor" },
    { to: "/language-practice", icon: Globe, label: "Language Practice" },
    { to: "/exam-prep", icon: ClipboardList, label: "Exam Prep" },
    { to: "/doubt-solver", icon: HelpCircle, label: "Doubt Solver" },
    { to: "/study-planner", icon: Calendar, label: "Study Planner" },
    { to: "/peer-mode", icon: Users, label: "Peer Mode" },
  ];

  const teacherLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/students", icon: Users, label: "My Students" },
  ];

  const caregiverLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/children", icon: Users, label: "My Children" },
  ];

  const getLinks = () => {
    switch (userRole) {
      case "teacher":
        return teacherLinks;
      case "caregiver":
        return caregiverLinks;
      case "admin":
        return [...studentLinks, ...teacherLinks];
      default:
        return studentLinks;
    }
  };

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 mb-2">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg" />
          <img src={synovaLogo} alt="Synova" className="relative h-11 w-11 object-contain" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-display text-primary">SYNOVA</h1>
          <p className="text-xs text-muted-foreground">AI Education</p>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2">
        <nav className="space-y-1">
          {getLinks().map((link) => (
            <NavItem key={link.to} {...link} onClick={onClose} />
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom Actions */}
      <div className="space-y-1 pt-4 px-2 border-t border-border/30">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl h-11 text-sm"
          onClick={toggleTheme}
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </Button>

        <NavItem to="/settings" icon={Settings} label="Settings" onClick={onClose} />

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl h-11 text-sm"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  );
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 glass-strong border-b border-border/30 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 rounded-lg blur-md" />
            <img src={synovaLogo} alt="Synova" className="relative h-9 w-9 object-contain" />
          </div>
          <h1 className="text-lg font-bold font-display text-primary">SYNOVA</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-10 w-10 rounded-xl"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/60 backdrop-blur-md z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed top-16 left-0 bottom-0 w-72 glass-strong border-r border-border/30 flex flex-col py-4 z-50 transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent onClose={() => setIsOpen(false)} />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 glass-strong border-r border-border/30 flex-col py-4 z-50">
        <SidebarContent onClose={() => {}} />
      </aside>
    </>
  );
}
