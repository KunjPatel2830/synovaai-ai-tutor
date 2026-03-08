-- Learning history table for session memory
CREATE TABLE public.learning_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT,
  question TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('solved', 'stuck', 'in_progress')),
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  mode TEXT NOT NULL DEFAULT 'tutor' CHECK (mode IN ('tutor', 'homework', 'doubt', 'exam', 'curriculum')),
  session_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for quick user history lookups
CREATE INDEX idx_learning_history_user_id ON public.learning_history(user_id);
CREATE INDEX idx_learning_history_created_at ON public.learning_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.learning_history ENABLE ROW LEVEL SECURITY;

-- Users can manage their own learning history
CREATE POLICY "Users can manage own learning history"
  ON public.learning_history
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Teachers can view linked student history
CREATE POLICY "Teachers can view linked student learning history"
  ON public.learning_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teacher_student_links
      WHERE teacher_student_links.teacher_id = auth.uid()
      AND teacher_student_links.student_id = learning_history.user_id
    )
  );

-- Caregivers can view linked student history
CREATE POLICY "Caregivers can view linked student learning history"
  ON public.learning_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM caregiver_student_links
      WHERE caregiver_student_links.caregiver_id = auth.uid()
      AND caregiver_student_links.student_id = learning_history.user_id
    )
  );

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_history;