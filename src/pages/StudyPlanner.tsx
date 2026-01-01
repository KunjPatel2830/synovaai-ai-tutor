import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { Calendar, Clock, Plus, Trash2, CheckCircle2, Target, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LoaderSpinner } from "@/components/ui/loader";

interface StudyTask {
  id: string;
  subject: string;
  topic: string;
  duration: number;
  completed: boolean;
  time?: string;
}

interface DayPlan {
  day: string;
  tasks: StudyTask[];
}

const subjects = [
  "Mathematics",
  "Science",
  "English",
  "History",
  "Geography",
  "Physics",
  "Chemistry",
  "Biology",
];

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function StudyPlanner() {
  const { toast } = useToast();
  const [studyHours, setStudyHours] = useState("3");
  const [weeklyPlan, setWeeklyPlan] = useState<DayPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newTask, setNewTask] = useState({ subject: "", topic: "", duration: 30 });
  const [selectedDay, setSelectedDay] = useState("Monday");

  const generatePlan = async () => {
    setIsGenerating(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const hoursPerDay = parseInt(studyHours);
      const minutesPerDay = hoursPerDay * 60;
      
      const generatedPlan: DayPlan[] = daysOfWeek.map((day, dayIndex) => {
        const tasksForDay: StudyTask[] = [];
        let remainingMinutes = minutesPerDay;
        const subjectsForDay = [...subjects].sort(() => Math.random() - 0.5).slice(0, 3);
        
        subjectsForDay.forEach((subject, index) => {
          const duration = Math.min(remainingMinutes, 45 + Math.floor(Math.random() * 30));
          if (duration > 0) {
            tasksForDay.push({
              id: `${day}-${index}`,
              subject,
              topic: `${subject} Practice Session`,
              duration,
              completed: false,
              time: `${9 + index * 2}:00`,
            });
            remainingMinutes -= duration;
          }
        });
        
        return { day, tasks: tasksForDay };
      });
      
      setWeeklyPlan(generatedPlan);
      toast({
        title: "Study Plan Generated!",
        description: `Your ${studyHours}-hour daily study plan is ready.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const addTask = () => {
    if (!newTask.subject || !newTask.topic) {
      toast({
        title: "Missing Information",
        description: "Please select a subject and enter a topic.",
        variant: "destructive",
      });
      return;
    }

    setWeeklyPlan(prev => {
      const updated = [...prev];
      const dayIndex = updated.findIndex(d => d.day === selectedDay);
      
      if (dayIndex === -1) {
        updated.push({
          day: selectedDay,
          tasks: [{
            id: `${selectedDay}-${Date.now()}`,
            subject: newTask.subject,
            topic: newTask.topic,
            duration: newTask.duration,
            completed: false,
          }],
        });
      } else {
        updated[dayIndex].tasks.push({
          id: `${selectedDay}-${Date.now()}`,
          subject: newTask.subject,
          topic: newTask.topic,
          duration: newTask.duration,
          completed: false,
        });
      }
      
      return updated;
    });

    setNewTask({ subject: "", topic: "", duration: 30 });
    toast({
      title: "Task Added",
      description: `Added "${newTask.topic}" to ${selectedDay}`,
    });
  };

  const toggleTask = (day: string, taskId: string) => {
    setWeeklyPlan(prev => 
      prev.map(d => 
        d.day === day 
          ? {
              ...d,
              tasks: d.tasks.map(t => 
                t.id === taskId ? { ...t, completed: !t.completed } : t
              ),
            }
          : d
      )
    );
  };

  const deleteTask = (day: string, taskId: string) => {
    setWeeklyPlan(prev => 
      prev.map(d => 
        d.day === day 
          ? { ...d, tasks: d.tasks.filter(t => t.id !== taskId) }
          : d
      )
    );
  };

  const completedTasks = weeklyPlan.reduce((acc, day) => acc + day.tasks.filter(t => t.completed).length, 0);
  const totalTasks = weeklyPlan.reduce((acc, day) => acc + day.tasks.length, 0);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-5rem)] overflow-auto space-y-4">
        {/* Header */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-xl">Study Planner</span>
                <p className="text-sm text-muted-foreground font-normal">Plan your study schedule</p>
              </div>
            </GlassCardTitle>
          </GlassCardHeader>
          
          <GlassCardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="w-full sm:w-auto">
                <Label htmlFor="study-hours" className="text-sm mb-2 block">Hours per day</Label>
                <Select value={studyHours} onValueChange={setStudyHours}>
                  <SelectTrigger id="study-hours" className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                      <SelectItem key={h} value={h.toString()}>{h} hour{h > 1 ? "s" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={generatePlan} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <LoaderSpinner size="sm" />
                    <span className="ml-2">Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Weekly Plan
                  </>
                )}
              </Button>
            </div>
            
            {totalTasks > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    Progress: {completedTasks} / {totalTasks} tasks completed
                  </span>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>

        {/* Add Task */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="text-lg">Add Study Task</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {daysOfWeek.map(day => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={newTask.subject} onValueChange={(v) => setNewTask(prev => ({ ...prev, subject: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(subj => (
                    <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                placeholder="Topic"
                value={newTask.topic}
                onChange={(e) => setNewTask(prev => ({ ...prev, topic: e.target.value }))}
              />
              
              <Select 
                value={newTask.duration.toString()} 
                onValueChange={(v) => setNewTask(prev => ({ ...prev, duration: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Duration" />
                </SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90, 120].map(d => (
                    <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button onClick={addTask}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Weekly Plan */}
        {weeklyPlan.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {weeklyPlan.map(dayPlan => (
              <GlassCard key={dayPlan.day}>
                <GlassCardHeader className="py-3">
                  <GlassCardTitle className="text-base">{dayPlan.day}</GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent className="space-y-2">
                  {dayPlan.tasks.length > 0 ? (
                    dayPlan.tasks.map(task => (
                      <div 
                        key={task.id}
                        className={`p-3 rounded-lg border ${task.completed ? 'bg-success/10 border-success/30' : 'bg-muted/30 border-border'}`}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={() => toggleTask(dayPlan.day, task.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                              {task.topic}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {task.subject} • {task.duration} min
                              {task.time && ` • ${task.time}`}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteTask(dayPlan.day, task.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No tasks scheduled
                    </p>
                  )}
                </GlassCardContent>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
