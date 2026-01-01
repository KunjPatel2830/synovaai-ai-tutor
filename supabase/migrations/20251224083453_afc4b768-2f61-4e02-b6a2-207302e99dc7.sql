-- Add INSERT, UPDATE, DELETE policies for subjects table (admin only)
CREATE POLICY "Only admins can insert subjects"
  ON public.subjects FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update subjects"
  ON public.subjects FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete subjects"
  ON public.subjects FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));