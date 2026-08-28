-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'caregiver', 'admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  grade_level TEXT,
  language_preference TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table (secure role management)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default subjects
INSERT INTO public.subjects (name, icon) VALUES
  ('Mathematics', 'calculator'),
  ('Science', 'flask'),
  ('Language Arts', 'book-open'),
  ('Social Studies', 'globe');

-- Create learning_progress table
CREATE TABLE public.learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic TEXT NOT NULL,
  difficulty_level INTEGER DEFAULT 1,
  score NUMERIC(5,2),
  attempts INTEGER DEFAULT 0,
  mastered BOOLEAN DEFAULT false,
  last_studied_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chat_sessions table
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('tutor', 'homework', 'exam')),
  subject TEXT,
  topic TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create homework_sessions table
CREATE TABLE public.homework_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT,
  file_url TEXT,
  feedback TEXT,
  concepts_to_revise TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create exam_preparations table
CREATE TABLE public.exam_preparations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  target_date DATE,
  study_plan JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create practice_tests table
CREATE TABLE public.practice_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_prep_id UUID REFERENCES public.exam_preparations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  questions JSONB NOT NULL,
  answers JSONB,
  score NUMERIC(5,2),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create teacher_student_links table
CREATE TABLE public.teacher_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(teacher_id, student_id)
);

-- Create caregiver_student_links table
CREATE TABLE public.caregiver_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(caregiver_id, student_id)
);

-- Create learning_streaks table
CREATE TABLE public.learning_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_streaks ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  
  INSERT INTO public.learning_streaks (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_learning_progress_updated_at
  BEFORE UPDATE ON public.learning_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_exam_preparations_updated_at
  BEFORE UPDATE ON public.exam_preparations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_learning_streaks_updated_at
  BEFORE UPDATE ON public.learning_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies

-- Subjects: public read
CREATE POLICY "Anyone can read subjects"
  ON public.subjects FOR SELECT
  TO authenticated
  USING (true);

-- Profiles: users can read/update their own
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Teachers/caregivers can view linked student profiles
CREATE POLICY "Teachers can view linked student profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_student_links
      WHERE teacher_id = auth.uid() AND student_id = profiles.user_id
    )
  );

CREATE POLICY "Caregivers can view linked student profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_student_links
      WHERE caregiver_id = auth.uid() AND student_id = profiles.user_id
    )
  );

-- User roles: users can read their own, insert is handled via service role
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own role on signup"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Learning progress: users can CRUD their own
CREATE POLICY "Users can manage own learning progress"
  ON public.learning_progress FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Teachers can view linked student progress
CREATE POLICY "Teachers can view linked student progress"
  ON public.learning_progress FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_student_links
      WHERE teacher_id = auth.uid() AND student_id = learning_progress.user_id
    )
  );

-- Caregivers can view linked student progress
CREATE POLICY "Caregivers can view linked student progress"
  ON public.learning_progress FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_student_links
      WHERE caregiver_id = auth.uid() AND student_id = learning_progress.user_id
    )
  );

-- Chat sessions: users can manage their own
CREATE POLICY "Users can manage own chat sessions"
  ON public.chat_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Chat messages: users can manage messages in their sessions
CREATE POLICY "Users can manage own chat messages"
  ON public.chat_messages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE id = chat_messages.session_id AND user_id = auth.uid()
    )
  );

-- Homework sessions: users can manage their own
CREATE POLICY "Users can manage own homework sessions"
  ON public.homework_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Exam preparations: users can manage their own
CREATE POLICY "Users can manage own exam preparations"
  ON public.exam_preparations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Practice tests: users can manage their own
CREATE POLICY "Users can manage own practice tests"
  ON public.practice_tests FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Teacher-student links
CREATE POLICY "Teachers can manage their student links"
  ON public.teacher_student_links FOR ALL
  TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view their teacher links"
  ON public.teacher_student_links FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Caregiver-student links
CREATE POLICY "Caregivers can manage their student links"
  ON public.caregiver_student_links FOR ALL
  TO authenticated
  USING (auth.uid() = caregiver_id);

CREATE POLICY "Students can view their caregiver links"
  ON public.caregiver_student_links FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Learning streaks: users can manage their own
CREATE POLICY "Users can manage own learning streaks"
  ON public.learning_streaks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Teachers can view linked student streaks
CREATE POLICY "Teachers can view linked student streaks"
  ON public.learning_streaks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_student_links
      WHERE teacher_id = auth.uid() AND student_id = learning_streaks.user_id
    )
  );

-- Caregivers can view linked student streaks
CREATE POLICY "Caregivers can view linked student streaks"
  ON public.learning_streaks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_student_links
      WHERE caregiver_id = auth.uid() AND student_id = learning_streaks.user_id
    )
  );