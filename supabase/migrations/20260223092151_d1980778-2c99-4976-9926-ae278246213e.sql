
-- Study PDFs uploaded by teachers
CREATE TABLE public.study_pdfs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  file_name TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  questions_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.study_pdfs ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own PDFs
CREATE POLICY "Teachers can manage own study PDFs"
  ON public.study_pdfs FOR ALL
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- Students linked to the teacher can view completed PDFs
CREATE POLICY "Students can view linked teacher study PDFs"
  ON public.study_pdfs FOR SELECT
  USING (
    processing_status = 'completed' AND
    EXISTS (
      SELECT 1 FROM teacher_student_links
      WHERE teacher_student_links.teacher_id = study_pdfs.teacher_id
        AND teacher_student_links.student_id = auth.uid()
    )
  );

-- Study Topics extracted from PDFs
CREATE TABLE public.study_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pdf_id UUID NOT NULL REFERENCES public.study_pdfs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_topics ENABLE ROW LEVEL SECURITY;

-- Teachers can manage topics for their PDFs
CREATE POLICY "Teachers can manage own study topics"
  ON public.study_topics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM study_pdfs
      WHERE study_pdfs.id = study_topics.pdf_id
        AND study_pdfs.teacher_id = auth.uid()
    )
  );

-- Students linked to the teacher can view topics
CREATE POLICY "Students can view linked teacher study topics"
  ON public.study_topics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM study_pdfs
      JOIN teacher_student_links ON teacher_student_links.teacher_id = study_pdfs.teacher_id
      WHERE study_pdfs.id = study_topics.pdf_id
        AND study_pdfs.processing_status = 'completed'
        AND teacher_student_links.student_id = auth.uid()
    )
  );

-- Study Questions with solutions
CREATE TABLE public.study_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.study_topics(id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES public.study_pdfs(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  solution_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_questions ENABLE ROW LEVEL SECURITY;

-- Teachers can manage questions for their PDFs
CREATE POLICY "Teachers can manage own study questions"
  ON public.study_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM study_pdfs
      WHERE study_pdfs.id = study_questions.pdf_id
        AND study_pdfs.teacher_id = auth.uid()
    )
  );

-- Students linked to the teacher can view questions
CREATE POLICY "Students can view linked teacher study questions"
  ON public.study_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM study_pdfs
      JOIN teacher_student_links ON teacher_student_links.teacher_id = study_pdfs.teacher_id
      WHERE study_pdfs.id = study_questions.pdf_id
        AND study_pdfs.processing_status = 'completed'
        AND teacher_student_links.student_id = auth.uid()
    )
  );
