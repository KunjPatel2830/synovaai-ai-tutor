CREATE EXTENSION IF NOT EXISTS vector;

-- ============ 1.1 Spaced repetition ============
CREATE TABLE public.review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  topic text NOT NULL,
  source_mode text NOT NULL DEFAULT 'tutor',
  prompt text,
  answer text,
  ease_factor numeric NOT NULL DEFAULT 2.5,
  interval_days numeric NOT NULL DEFAULT 0,
  repetitions integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  due_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX review_items_user_topic_key ON public.review_items (user_id, subject, topic);
CREATE INDEX review_items_due_idx ON public.review_items (user_id, due_at) WHERE is_active;

CREATE TABLE public.review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_item_id uuid NOT NULL REFERENCES public.review_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  grade integer NOT NULL,
  interval_days numeric NOT NULL DEFAULT 0,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_logs_user_idx ON public.review_logs (user_id, reviewed_at DESC);

-- ============ 1.2 Mock tests ============
CREATE TABLE public.mock_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam_type text NOT NULL,
  subjects text[] NOT NULL DEFAULT '{}',
  difficulty text NOT NULL DEFAULT 'mixed',
  question_count integer NOT NULL DEFAULT 20,
  duration_minutes integer NOT NULL DEFAULT 30,
  marks_correct numeric NOT NULL DEFAULT 4,
  marks_incorrect numeric NOT NULL DEFAULT -1,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mock_tests_user_idx ON public.mock_tests (user_id, created_at DESC);

CREATE TABLE public.mock_test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  position integer NOT NULL,
  subject text NOT NULL,
  topic text,
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option text NOT NULL,
  explanation text,
  difficulty text,
  source text NOT NULL DEFAULT 'generated',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mock_test_questions_test_idx ON public.mock_test_questions (test_id, position);

CREATE TABLE public.mock_test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_per_question jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric,
  max_score numeric,
  correct_count integer,
  incorrect_count integer,
  unattempted_count integer,
  accuracy numeric,
  percentile numeric,
  percentile_basis text,
  topic_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_seconds integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);
CREATE INDEX mock_test_attempts_user_idx ON public.mock_test_attempts (user_id, submitted_at DESC);
CREATE INDEX mock_test_attempts_test_idx ON public.mock_test_attempts (test_id);

-- ============ 1.3 Student notes ============
CREATE TABLE public.student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  subject text,
  source_type text NOT NULL DEFAULT 'text',
  char_count integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ready',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_documents_user_idx ON public.student_documents (user_id, created_at DESC);

CREATE TABLE public.student_document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.student_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_document_chunks_doc_idx ON public.student_document_chunks (document_id, chunk_index);
CREATE INDEX student_document_chunks_embedding_idx
  ON public.student_document_chunks USING hnsw (embedding vector_cosine_ops);

-- ============ Grants: backend-only access ============
GRANT ALL ON public.review_items TO service_role;
GRANT ALL ON public.review_logs TO service_role;
GRANT ALL ON public.mock_tests TO service_role;
GRANT ALL ON public.mock_test_questions TO service_role;
GRANT ALL ON public.mock_test_attempts TO service_role;
GRANT ALL ON public.student_documents TO service_role;
GRANT ALL ON public.student_document_chunks TO service_role;

ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages review items" ON public.review_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages review logs" ON public.review_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages mock tests" ON public.mock_tests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages mock test questions" ON public.mock_test_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages mock test attempts" ON public.mock_test_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages student documents" ON public.student_documents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages student document chunks" ON public.student_document_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER review_items_set_updated_at
  BEFORE UPDATE ON public.review_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vector similarity search over one student's own notes
CREATE OR REPLACE FUNCTION public.match_student_chunks(
  _user_id uuid,
  _document_ids uuid[],
  query_embedding vector(1536),
  match_count int DEFAULT 6
)
RETURNS TABLE (id uuid, document_id uuid, chunk_index int, content text, similarity float)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.document_id, c.chunk_index, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.student_document_chunks c
  WHERE c.user_id = _user_id
    AND c.embedding IS NOT NULL
    AND (_document_ids IS NULL OR array_length(_document_ids, 1) IS NULL OR c.document_id = ANY(_document_ids))
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.match_student_chunks(uuid, uuid[], vector, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_student_chunks(uuid, uuid[], vector, int) TO service_role;