
-- ============================================================
-- FIX 1: CRITICAL - Privilege Escalation in user_roles
-- Restrict INSERT to only 'student' role from public signup
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;

CREATE POLICY "Users can insert own student role on signup"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'student'::app_role);

-- ============================================================
-- FIX 2: Remove public SELECT on reviews (use reviews_public view)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;

-- ============================================================
-- FIX 3: Remove overly broad public SELECT on pyq_uploads
-- (keep "Users can view own uploads" policy)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read pyq uploads" ON public.pyq_uploads;

-- ============================================================
-- FIX 4: Scope study_pdfs reads to teachers + linked students
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read study PDFs" ON public.study_pdfs;

CREATE POLICY "Teachers can read own study PDFs"
  ON public.study_pdfs FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Linked students can read teacher study PDFs"
  ON public.study_pdfs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM teacher_student_links
    WHERE teacher_student_links.student_id = auth.uid()
      AND teacher_student_links.teacher_id = study_pdfs.teacher_id
  ));

-- Also scope study_topics and study_questions to linked users
-- (they reference study_pdfs via pdf_id)
DROP POLICY IF EXISTS "Anyone can read study topics" ON public.study_topics;

CREATE POLICY "Users can read study topics for accessible PDFs"
  ON public.study_topics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM study_pdfs
    WHERE study_pdfs.id = study_topics.pdf_id
      AND (
        study_pdfs.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM teacher_student_links
          WHERE teacher_student_links.student_id = auth.uid()
            AND teacher_student_links.teacher_id = study_pdfs.teacher_id
        )
      )
  ));

DROP POLICY IF EXISTS "Anyone can read study questions" ON public.study_questions;

CREATE POLICY "Users can read study questions for accessible PDFs"
  ON public.study_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM study_pdfs
    WHERE study_pdfs.id = study_questions.pdf_id
      AND (
        study_pdfs.teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM teacher_student_links
          WHERE teacher_student_links.student_id = auth.uid()
            AND teacher_student_links.teacher_id = study_pdfs.teacher_id
        )
      )
  ));
