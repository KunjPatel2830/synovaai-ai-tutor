
-- Allow teachers to see active rooms created by their linked students
CREATE POLICY "Teachers can view linked student rooms"
ON public.peer_rooms
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_student_links
    WHERE teacher_student_links.teacher_id = auth.uid()
      AND teacher_student_links.student_id = peer_rooms.created_by
  )
  AND is_active = true
);
