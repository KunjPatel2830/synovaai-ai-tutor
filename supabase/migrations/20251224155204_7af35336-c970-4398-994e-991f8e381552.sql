-- Allow students to view invitation codes they have used
CREATE POLICY "Users can view codes they used"
ON public.invitation_codes
FOR SELECT
TO authenticated
USING (auth.uid() = used_by);