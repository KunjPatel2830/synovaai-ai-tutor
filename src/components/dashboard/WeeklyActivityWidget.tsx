import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/lib/external-supabase";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { BarChart3 } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

interface DayData {
  day: string;
  sessions: number;
}

export function WeeklyActivityWidget() {
  const { user } = useAuth();
  const [data, setData] = useState<DayData[]>([]);

  useEffect(() => {
    if (user) fetchWeeklyData();
  }, [user]);

  const fetchWeeklyData = async () => {
    if (!user) return;
    const weekAgo = subDays(new Date(), 6);

    const { data: sessions } = await externalSupabase
      .from("chat_sessions")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", startOfDay(weekAgo).toISOString());

    const dayMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      dayMap[format(d, "EEE")] = 0;
    }

    sessions?.forEach((s) => {
      const day = format(new Date(s.created_at!), "EEE");
      if (dayMap[day] !== undefined) dayMap[day]++;
    });

    setData(Object.entries(dayMap).map(([day, sessions]) => ({ day, sessions })));
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Weekly Activity</h3>
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={20}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Bar
              dataKey="sessions"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
