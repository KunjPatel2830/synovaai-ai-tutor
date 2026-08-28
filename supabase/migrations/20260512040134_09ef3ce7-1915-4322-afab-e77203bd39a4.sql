-- Restrict permissive ALL policies on study tables to service_role only.
-- Service role bypasses RLS anyway, so these "USING (true)" public policies were
-- inadvertently granting full ALL access to anyone authenticated.

DROP POLICY IF EXISTS "Service role can manage study PDFs" ON public.study_pdfs;
DROP POLICY IF EXISTS "Service role can manage study topics" ON public.study_topics;
DROP POLICY IF EXISTS "Service role can manage study questions" ON public.study_questions;

CREATE POLICY "Service role can manage study PDFs"
  ON public.study_pdfs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage study topics"
  ON public.study_topics FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage study questions"
  ON public.study_questions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Teachers can write to their own study_pdfs (kept narrow).
CREATE POLICY "Teachers can insert own study PDFs"
  ON public.study_pdfs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own study PDFs"
  ON public.study_pdfs FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own study PDFs"
  ON public.study_pdfs FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);