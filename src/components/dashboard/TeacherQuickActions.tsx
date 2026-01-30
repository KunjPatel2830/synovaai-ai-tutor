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
    <div className="space-y-6">
      {/* Quick Actions Grid */}
      <div>
        <h3 className="text-lg font-semibold text-foreground font-display mb-4">Teacher Tools</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teacherActions.map((action) => {
            const Icon = action.icon;
            return (
              <GlassCard
                key={action.id}
                className="cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg overflow-hidden"
                onClick={() => navigate(action.path)}
              >
                <div className="p-5">
                  {/* Icon */}
                  <div className={cn(
                    "h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-md transition-transform group-hover:scale-110",
                    action.gradient
                  )}>
                    <Icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  
                  {/* Title */}
                  <h4 className="font-semibold text-foreground text-base mb-1">{action.title}</h4>
                  
                  {/* Description */}
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                  
                  {/* Arrow indicator */}
                  <ArrowRight className="h-4 w-4 text-muted-foreground mt-3 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Add Student CTA */}
      <GlassCard className="border-dashed border-2 border-primary/30 hover:border-primary/50 transition-colors">
        <GlassCardContent className="py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Add New Student</h4>
                <p className="text-sm text-muted-foreground">Generate an invite code to link students</p>
              </div>
            </div>
            <Button onClick={() => navigate("/students")} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
