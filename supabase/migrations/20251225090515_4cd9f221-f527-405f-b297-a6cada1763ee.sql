-- Create badges table for badge definitions
CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  criteria_type text NOT NULL,
  criteria_value integer NOT NULL DEFAULT 1,
  points integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_badges table for earned badges
CREATE TABLE public.user_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Badges are readable by all authenticated users
CREATE POLICY "Authenticated users can read badges"
ON public.badges FOR SELECT
USING (true);

-- Users can read their own earned badges
CREATE POLICY "Users can read own badges"
ON public.user_badges FOR SELECT
USING (auth.uid() = user_id);

-- Users can earn badges (insert)
CREATE POLICY "Users can earn badges"
ON public.user_badges FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Teachers can view linked student badges
CREATE POLICY "Teachers can view linked student badges"
ON public.user_badges FOR SELECT
USING (EXISTS (
  SELECT 1 FROM teacher_student_links
  WHERE teacher_id = auth.uid() AND student_id = user_badges.user_id
));

-- Caregivers can view linked student badges
CREATE POLICY "Caregivers can view linked student badges"
ON public.user_badges FOR SELECT
USING (EXISTS (
  SELECT 1 FROM caregiver_student_links
  WHERE caregiver_id = auth.uid() AND student_id = user_badges.user_id
));

-- Insert default badges
INSERT INTO public.badges (name, description, icon, category, criteria_type, criteria_value, points) VALUES
('First Steps', 'Complete your first learning session', 'footprints', 'milestone', 'sessions_completed', 1, 10),
('Curious Mind', 'Complete 5 learning sessions', 'brain', 'milestone', 'sessions_completed', 5, 25),
('Knowledge Seeker', 'Complete 25 learning sessions', 'search', 'milestone', 'sessions_completed', 25, 50),
('Scholar', 'Complete 100 learning sessions', 'graduation-cap', 'milestone', 'sessions_completed', 100, 100),
('Streak Starter', 'Maintain a 3-day learning streak', 'flame', 'streak', 'streak_days', 3, 15),
('Consistent Learner', 'Maintain a 7-day learning streak', 'zap', 'streak', 'streak_days', 7, 30),
('Dedication Master', 'Maintain a 30-day learning streak', 'trophy', 'streak', 'streak_days', 30, 100),
('Topic Explorer', 'Study 5 different topics', 'compass', 'exploration', 'topics_studied', 5, 20),
('Subject Master', 'Master 3 topics (score 80%+)', 'star', 'mastery', 'topics_mastered', 3, 50),
('Quiz Champion', 'Score 100% on an exam', 'medal', 'achievement', 'perfect_score', 1, 40),
('Helping Hand', 'Ask 10 homework help questions', 'hand-helping', 'engagement', 'homework_questions', 10, 25),
('Voice Learner', 'Complete 5 voice tutor sessions', 'mic', 'engagement', 'voice_sessions', 5, 30);