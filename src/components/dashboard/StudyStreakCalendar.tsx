import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { CalendarDays, Flame } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

export function StudyStreakCalendar() {
  const { user } = useAuth();
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const thirtyDaysAgo = subDays(new Date(), 29);

    const [sessionsRes, streakRes] = await Promise.all([
      externalSupabase
        .from("chat_sessions")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", startOfDay(thirtyDaysAgo).toISOString()),
      externalSupabase
        .from("learning_streaks")
        .select("current_streak")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (sessionsRes.data) {
      const days = new Set<string>();
      sessionsRes.data.forEach((s) => {
        days.add(format(new Date(s.created_at!), "yyyy-MM-dd"));
      });
      setActiveDays(days);
    }
    setStreak(streakRes.data?.current_streak || 0);
  };

  // Generate last 28 days (4 weeks)
  const days = [];
  for (let i = 27; i >= 0; i--) {
    const d = subDays(new Date(), i);
    days.push({
      date: format(d, "yyyy-MM-dd"),
      label: format(d, "d"),
      dayName: format(d, "EEEEE"),
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Study Calendar</h3>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 text-xs font-medium text-warning">
            <Flame className="h-3.5 w-3.5" />
            {streak} days
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-muted-foreground font-medium pb-1">{d}</div>
        ))}
        {days.map((day) => {
          const isActive = activeDays.has(day.date);
          const isToday = day.date === format(new Date(), "yyyy-MM-dd");
          return (
            <div
              key={day.date}
              className={cn(
                "aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground",
                isToday && !isActive && "ring-1 ring-primary/40"
              )}
              title={day.date}
            >
              {day.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
