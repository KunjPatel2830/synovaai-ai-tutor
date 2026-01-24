-- First create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create curriculum study progress table to track where student left off
CREATE TABLE public.curriculum_study_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  curriculum TEXT NOT NULL,
  standard TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  current_topic_index INTEGER NOT NULL DEFAULT 0,
  completed_topics TEXT[] DEFAULT '{}',
  total_topics INTEGER DEFAULT 0,
  last_topic TEXT,
  last_studied_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, curriculum, standard, subject, chapter)
);

-- Enable Row Level Security
ALTER TABLE public.curriculum_study_progress ENABLE ROW LEVEL SECURITY;

-- Users can manage their own curriculum study progress
CREATE POLICY "Users can manage own curriculum study progress"
ON public.curriculum_study_progress
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Caregivers can view linked student progress
CREATE POLICY "Caregivers can view linked student curriculum progress"
ON public.curriculum_study_progress
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM caregiver_student_links
  WHERE caregiver_student_links.caregiver_id = auth.uid()
  AND caregiver_student_links.student_id = curriculum_study_progress.user_id
));

-- Teachers can view linked student progress
CREATE POLICY "Teachers can view linked student curriculum progress"
ON public.curriculum_study_progress
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM teacher_student_links
  WHERE teacher_student_links.teacher_id = auth.uid()
  AND teacher_student_links.student_id = curriculum_study_progress.user_id
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_curriculum_study_progress_updated_at
BEFORE UPDATE ON public.curriculum_study_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();