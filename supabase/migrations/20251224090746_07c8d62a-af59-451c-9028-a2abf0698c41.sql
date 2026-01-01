-- Create a table to track student help requests / questions for teacher visibility
CREATE TABLE public.student_help_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT,
  question TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('tutor', 'homework', 'exam')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_help_requests ENABLE ROW LEVEL SECURITY;

-- Students can insert and view their own requests
CREATE POLICY "Users can manage own help requests"
ON public.student_help_requests
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Teachers can view linked student help requests
CREATE POLICY "Teachers can view linked student help requests"
ON public.student_help_requests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM teacher_student_links
  WHERE teacher_student_links.teacher_id = auth.uid()
  AND teacher_student_links.student_id = student_help_requests.user_id
));

-- Caregivers can view linked student help requests
CREATE POLICY "Caregivers can view linked student help requests"
ON public.student_help_requests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM caregiver_student_links
  WHERE caregiver_student_links.caregiver_id = auth.uid()
  AND caregiver_student_links.student_id = student_help_requests.user_id
));