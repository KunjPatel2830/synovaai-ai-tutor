import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { externalSupabase } from "@/lib/external-supabase";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, User, Moon, Sun, Save, Loader2, GraduationCap } from "lucide-react";

const STANDARDS = [
  "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10",
  "Grade 11", "Grade 12", "College",
];

const CURRICULA = [
  "CBSE", "ICSE", "State Board", "IB", "IGCSE", "Other",
];

const TARGET_EXAMS = [
  "JEE", "NEET", "School Exams", "Other",
];

export default function Settings() {
  const { user, userRole, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { profile, updateProfile, refetch } = useStudentProfile();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [standard, setStandard] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [targetExam, setTargetExam] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setStandard(profile.standard || "");
      setCurriculum(profile.curriculum || "");
      setTargetExam(profile.target_exam || "");
    }
  }, [profile]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data } = await externalSupabase
      .from("profiles")
      .select("display_name, grade_level")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setDisplayName(data.display_name || "");
      setGradeLevel(data.grade_level || "");
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await externalSupabase
        .from("profiles")
        .update({
          display_name: displayName,
          grade_level: gradeLevel,
          standard,
          curriculum,
          target_exam: targetExam,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      await refetch();
      toast({ title: "Profile updated successfully" });
    } catch (error) {
      toast({ title: "Failed to update profile", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <SettingsIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={userRole || ""} disabled className="bg-muted capitalize" />
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Academic Profile - Only for students */}
          {userRole === "student" && (
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Academic Profile
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Standard / Grade</Label>
                  <Select value={standard} onValueChange={setStandard}>
                    <SelectTrigger><SelectValue placeholder="Select your grade" /></SelectTrigger>
                    <SelectContent>
                      {STANDARDS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Curriculum / Board</Label>
                  <Select value={curriculum} onValueChange={setCurriculum}>
                    <SelectTrigger><SelectValue placeholder="Select your board" /></SelectTrigger>
                    <SelectContent>
                      {CURRICULA.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Exam</Label>
                  <Select value={targetExam} onValueChange={setTargetExam}>
                    <SelectTrigger><SelectValue placeholder="Select target exam" /></SelectTrigger>
                    <SelectContent>
                      {TARGET_EXAMS.map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </GlassCardContent>
            </GlassCard>
          )}

          {/* Save Button */}
          <Button onClick={saveProfile} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>

          {/* Appearance */}
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                Appearance
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">Use dark theme for the interface</p>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Account Actions */}
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle>Account</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <Button variant="destructive" onClick={signOut}>
                Sign Out
              </Button>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    </AppLayout>
  );
}
