import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { NetworkStatusIndicator } from "@/components/status/NetworkStatusIndicator";

// Lazy load pages for code splitting
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Tutor = lazy(() => import("./pages/Tutor"));
const Homework = lazy(() => import("./pages/Homework"));
const ExamPrep = lazy(() => import("./pages/ExamPrep"));
const VoiceTutor = lazy(() => import("./pages/VoiceTutor"));
const LanguagePractice = lazy(() => import("./pages/LanguagePractice"));
const DoubtSolver = lazy(() => import("./pages/DoubtSolver"));
const StudyPlanner = lazy(() => import("./pages/StudyPlanner"));
const PeerMode = lazy(() => import("./pages/PeerMode"));
const CurriculumStudy = lazy(() => import("./pages/CurriculumStudy"));

const Settings = lazy(() => import("./pages/Settings"));
const Children = lazy(() => import("./pages/Children"));
const Students = lazy(() => import("./pages/Students"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <NetworkStatusIndicator />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<ProtectedRoute requireEmailVerification={false}><VerifyEmail /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/tutor" element={<ProtectedRoute><Tutor /></ProtectedRoute>} />
                <Route path="/homework" element={<ProtectedRoute><Homework /></ProtectedRoute>} />
                <Route path="/exam-prep" element={<ProtectedRoute><ExamPrep /></ProtectedRoute>} />
                <Route path="/voice-tutor" element={<ProtectedRoute><VoiceTutor /></ProtectedRoute>} />
                <Route path="/language-practice" element={<ProtectedRoute><LanguagePractice /></ProtectedRoute>} />
                <Route path="/doubt-solver" element={<ProtectedRoute><DoubtSolver /></ProtectedRoute>} />
                <Route path="/study-planner" element={<ProtectedRoute><StudyPlanner /></ProtectedRoute>} />
                <Route path="/peer-mode" element={<ProtectedRoute><PeerMode /></ProtectedRoute>} />
                <Route path="/curriculum-study" element={<ProtectedRoute><CurriculumStudy /></ProtectedRoute>} />
                
                <Route path="/children" element={<ProtectedRoute allowedRoles={['caregiver']}><Children /></ProtectedRoute>} />
                <Route path="/students" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><Students /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
