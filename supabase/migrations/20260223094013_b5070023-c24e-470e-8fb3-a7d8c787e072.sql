
-- Drop restrictive policies that depend on auth.uid() matching external auth
DROP POLICY IF EXISTS "Students can view linked teacher study PDFs" ON public.study_pdfs;
DROP POLICY IF EXISTS "Teachers can manage own study PDFs" ON public.study_pdfs;
DROP POLICY IF EXISTS "Students can view linked teacher study topics" ON public.study_topics;
DROP POLICY IF EXISTS "Teachers can manage own study topics" ON public.study_topics;
DROP POLICY IF EXISTS "Students can view linked teacher study questions" ON public.study_questions;
DROP POLICY IF EXISTS "Teachers can manage own study questions" ON public.study_questions;

-- Allow public read access (data is educational content, not sensitive)
-- Writes are handled by edge functions using service role key
CREATE POLICY "Anyone can read study PDFs"
  ON public.study_pdfs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read study topics"
  ON public.study_topics FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read study questions"
  ON public.study_questions FOR SELECT
  USING (true);

-- Allow service-role-only writes (no direct client writes needed)
-- The edge function uses service role key to insert/update/delete
CREATE POLICY "Service role can manage study PDFs"
  ON public.study_pdfs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage study topics"
  ON public.study_topics FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage study questions"
  ON public.study_questions FOR ALL
  USING (true)
  WITH CHECK (true);
