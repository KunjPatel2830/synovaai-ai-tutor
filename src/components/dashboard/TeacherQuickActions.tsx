import { useNavigate } from "react-router-dom";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Users, Plus, ClipboardList, AlertTriangle, MessageCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  gradient: string;
}

const teacherActions: QuickAction[] = [
  {
    id: "students",
    title: "My Students",
    description: "View & manage students",
    icon: Users,
    path: "/students",
    gradient: "from-primary to-primary/80",
  },
  {
    id: "exam-prep",
    title: "Exam Prep (PYQ)",
    description: "Upload & manage PYQs",
    icon: ClipboardList,
    path: "/exam-prep",
    gradient: "from-accent to-accent/80",
  },
];

export function TeacherQuickActions() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Quick Actions Grid */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground font-display">Teacher Tools</h3>
            <p className="text-sm text-muted-foreground">Manage your students and content</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {teacherActions.map((action) => {
            const Icon = action.icon;
            return (
              <GlassCard
                key={action.id}
                variant="elevated"
                className="cursor-pointer group transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl overflow-hidden relative"
                onClick={() => navigate(action.path)}
              >
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 group-hover:from-primary/5 group-hover:to-accent/10 transition-all duration-500" />
                
                <div className="p-6 relative">
                  {/* Icon with enhanced styling */}
                  <div className={cn(
                    "h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-5 shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl group-hover:rotate-3",
                    action.gradient
                  )}>
                    <Icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  
                  {/* Title */}
                  <h4 className="font-bold text-foreground text-lg mb-2 group-hover:text-primary transition-colors">{action.title}</h4>
                  
                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">{action.description}</p>
                  
                  {/* Arrow indicator */}
                  <div className="mt-4 flex items-center text-muted-foreground group-hover:text-primary transition-all">
                    <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Open</span>
                    <ArrowRight className="h-5 w-5 ml-auto transition-transform group-hover:translate-x-2" />
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Add Student CTA with enhanced styling */}
      <GlassCard className="border-2 border-dashed border-primary/40 hover:border-primary/60 transition-all hover:shadow-lg bg-gradient-to-r from-primary/5 to-accent/5">
        <GlassCardContent className="py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shadow-lg">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center sm:text-left">
                <h4 className="font-bold text-foreground text-lg">Add New Student</h4>
                <p className="text-sm text-muted-foreground">Generate an invite code to link students to your account</p>
              </div>
            </div>
            <Button 
              size="lg"
              onClick={() => navigate("/students")} 
              className="shrink-0 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Student
            </Button>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
