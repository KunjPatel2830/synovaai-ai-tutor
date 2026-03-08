-- Add permissive SELECT policy on pyq_uploads so anon/local client can read uploads
CREATE POLICY "Anyone can read pyq uploads"
  ON public.pyq_uploads
  FOR SELECT
  USING (true);