-- Allow students to insert themselves into teacher_student_links
CREATE POLICY "Students can link themselves to teachers"
ON public.teacher_student_links
FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Allow students to insert themselves into caregiver_student_links
CREATE POLICY "Students can link themselves to caregivers"
ON public.caregiver_student_links
FOR INSERT
WITH CHECK (auth.uid() = student_id);