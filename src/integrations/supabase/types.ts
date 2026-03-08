export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          category: string
          created_at: string
          criteria_type: string
          criteria_value: number
          description: string
          icon: string
          id: string
          name: string
          points: number
        }
        Insert: {
          category?: string
          created_at?: string
          criteria_type: string
          criteria_value?: number
          description: string
          icon: string
          id?: string
          name: string
          points?: number
        }
        Update: {
          category?: string
          created_at?: string
          criteria_type?: string
          criteria_value?: number
          description?: string
          icon?: string
          id?: string
          name?: string
          points?: number
        }
        Relationships: []
      }
      caregiver_student_links: {
        Row: {
          caregiver_id: string
          created_at: string | null
          id: string
          invitation_code_id: string | null
          student_id: string
        }
        Insert: {
          caregiver_id: string
          created_at?: string | null
          id?: string
          invitation_code_id?: string | null
          student_id: string
        }
        Update: {
          caregiver_id?: string
          created_at?: string | null
          id?: string
          invitation_code_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_student_links_invitation_code_id_fkey"
            columns: ["invitation_code_id"]
            isOneToOne: false
            referencedRelation: "invitation_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          mode: string
          started_at: string | null
          subject: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          mode: string
          started_at?: string | null
          subject?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          mode?: string
          started_at?: string | null
          subject?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      curriculum_study_progress: {
        Row: {
          chapter: string
          completed_topics: string[] | null
          created_at: string
          current_topic_index: number
          curriculum: string
          id: string
          last_studied_at: string | null
          last_topic: string | null
          standard: string
          subject: string
          total_topics: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter: string
          completed_topics?: string[] | null
          created_at?: string
          current_topic_index?: number
          curriculum: string
          id?: string
          last_studied_at?: string | null
          last_topic?: string | null
          standard: string
          subject: string
          total_topics?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter?: string
          completed_topics?: string[] | null
          created_at?: string
          current_topic_index?: number
          curriculum?: string
          id?: string
          last_studied_at?: string | null
          last_topic?: string | null
          standard?: string
          subject?: string
          total_topics?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_preparations: {
        Row: {
          created_at: string | null
          exam_name: string
          id: string
          study_plan: Json | null
          subject: string
          target_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          exam_name: string
          id?: string
          study_plan?: Json | null
          subject: string
          target_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          exam_name?: string
          id?: string
          study_plan?: Json | null
          subject?: string
          target_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      homework_sessions: {
        Row: {
          concepts_to_revise: string[] | null
          created_at: string | null
          feedback: string | null
          file_url: string | null
          id: string
          subject: string
          topic: string | null
          user_id: string
        }
        Insert: {
          concepts_to_revise?: string[] | null
          created_at?: string | null
          feedback?: string | null
          file_url?: string | null
          id?: string
          subject: string
          topic?: string | null
          user_id: string
        }
        Update: {
          concepts_to_revise?: string[] | null
          created_at?: string | null
          feedback?: string | null
          file_url?: string | null
          id?: string
          subject?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invitation_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          inviter_role: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          inviter_role: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          inviter_role?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      learning_history: {
        Row: {
          created_at: string
          difficulty: string | null
          id: string
          mode: string
          question: string | null
          session_duration_seconds: number | null
          status: string
          subject: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          id?: string
          mode?: string
          question?: string | null
          session_duration_seconds?: number | null
          status?: string
          subject: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          id?: string
          mode?: string
          question?: string | null
          session_duration_seconds?: number | null
          status?: string
          subject?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_progress: {
        Row: {
          attempts: number | null
          created_at: string | null
          difficulty_level: number | null
          id: string
          last_studied_at: string | null
          mastered: boolean | null
          score: number | null
          subject_id: string | null
          topic: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          difficulty_level?: number | null
          id?: string
          last_studied_at?: string | null
          mastered?: boolean | null
          score?: number | null
          subject_id?: string | null
          topic: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          difficulty_level?: number | null
          id?: string
          last_studied_at?: string | null
          mastered?: boolean | null
          score?: number | null
          subject_id?: string | null
          topic?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_streaks: {
        Row: {
          created_at: string | null
          current_streak: number | null
          id: string
          last_activity_date: string | null
          longest_streak: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      peer_room_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          message_type: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          message_type?: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          message_type?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "peer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_room_participants: {
        Row: {
          id: string
          joined_at: string
          left_at: string | null
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "peer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_rooms: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          room_code: string
          subject: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          name: string
          room_code: string
          subject?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          name?: string
          room_code?: string
          subject?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      peer_voice_signals: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          room_id: string
          signal_data: Json
          signal_type: string
          to_user_id: string | null
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          room_id: string
          signal_data: Json
          signal_type: string
          to_user_id?: string | null
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          room_id?: string
          signal_data?: Json
          signal_type?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "peer_voice_signals_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "peer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_whiteboard_data: {
        Row: {
          data: Json
          id: string
          room_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data?: Json
          id?: string
          room_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data?: Json
          id?: string
          room_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "peer_whiteboard_data_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "peer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_tests: {
        Row: {
          answers: Json | null
          completed_at: string | null
          created_at: string | null
          exam_prep_id: string | null
          id: string
          questions: Json
          score: number | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string | null
          exam_prep_id?: string | null
          id?: string
          questions: Json
          score?: number | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string | null
          exam_prep_id?: string | null
          id?: string
          questions?: Json
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_tests_exam_prep_id_fkey"
            columns: ["exam_prep_id"]
            isOneToOne: false
            referencedRelation: "exam_preparations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          curriculum: string | null
          display_name: string | null
          grade_level: string | null
          id: string
          language_preference: string | null
          standard: string | null
          target_exam: string | null
          tutor_language: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          curriculum?: string | null
          display_name?: string | null
          grade_level?: string | null
          id?: string
          language_preference?: string | null
          standard?: string | null
          target_exam?: string | null
          tutor_language?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          curriculum?: string | null
          display_name?: string | null
          grade_level?: string | null
          id?: string
          language_preference?: string | null
          standard?: string | null
          target_exam?: string | null
          tutor_language?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pyq_questions: {
        Row: {
          correct_option: string
          created_at: string
          created_by: string | null
          difficulty: string | null
          exam_type: string
          explanation: string | null
          id: string
          options: Json
          question_text: string
          shift: string | null
          subject: string
          topic: string | null
          year: number
        }
        Insert: {
          correct_option: string
          created_at?: string
          created_by?: string | null
          difficulty?: string | null
          exam_type: string
          explanation?: string | null
          id?: string
          options?: Json
          question_text: string
          shift?: string | null
          subject: string
          topic?: string | null
          year: number
        }
        Update: {
          correct_option?: string
          created_at?: string
          created_by?: string | null
          difficulty?: string | null
          exam_type?: string
          explanation?: string | null
          id?: string
          options?: Json
          question_text?: string
          shift?: string | null
          subject?: string
          topic?: string | null
          year?: number
        }
        Relationships: []
      }
      pyq_uploads: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          exam_type: string
          file_name: string
          id: string
          questions_count: number | null
          shift: string | null
          status: string
          uploaded_by: string
          year: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          exam_type: string
          file_name: string
          id?: string
          questions_count?: number | null
          shift?: string | null
          status?: string
          uploaded_by: string
          year: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          exam_type?: string
          file_name?: string
          id?: string
          questions_count?: number | null
          shift?: string | null
          status?: string
          uploaded_by?: string
          year?: number
        }
        Relationships: []
      }
      reviews: {
        Row: {
          content: string
          created_at: string
          display_name: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          display_name: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          display_name?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      student_help_requests: {
        Row: {
          created_at: string
          id: string
          mode: string
          question: string
          subject: string
          topic: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode: string
          question: string
          subject: string
          topic?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          question?: string
          subject?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      student_teacher_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      study_pdfs: {
        Row: {
          chapter: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_name: string
          id: string
          processing_status: string
          questions_count: number | null
          subject: string
          teacher_id: string
        }
        Insert: {
          chapter: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          id?: string
          processing_status?: string
          questions_count?: number | null
          subject: string
          teacher_id: string
        }
        Update: {
          chapter?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          id?: string
          processing_status?: string
          questions_count?: number | null
          subject?: string
          teacher_id?: string
        }
        Relationships: []
      }
      study_questions: {
        Row: {
          created_at: string
          id: string
          pdf_id: string
          question_text: string
          solution_text: string | null
          topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pdf_id: string
          question_text: string
          solution_text?: string | null
          topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pdf_id?: string
          question_text?: string
          solution_text?: string | null
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_questions_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "study_pdfs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_topics: {
        Row: {
          created_at: string
          id: string
          name: string
          pdf_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          pdf_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          pdf_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_topics_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "study_pdfs"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      teacher_student_links: {
        Row: {
          created_at: string | null
          id: string
          invitation_code_id: string | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invitation_code_id?: string | null
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invitation_code_id?: string | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_links_invitation_code_id_fkey"
            columns: ["invitation_code_id"]
            isOneToOne: false
            referencedRelation: "invitation_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      badges_public: {
        Row: {
          category: string | null
          criteria_type: string | null
          description: string | null
          icon: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          category?: string | null
          criteria_type?: string | null
          description?: string | null
          icon?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          category?: string | null
          criteria_type?: string | null
          description?: string | null
          icon?: string | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      pyq_questions_public: {
        Row: {
          correct_option: string | null
          created_at: string | null
          difficulty: string | null
          exam_type: string | null
          explanation: string | null
          id: string | null
          options: Json | null
          question_text: string | null
          shift: string | null
          subject: string | null
          topic: string | null
          year: number | null
        }
        Insert: {
          correct_option?: string | null
          created_at?: string | null
          difficulty?: string | null
          exam_type?: string | null
          explanation?: string | null
          id?: string | null
          options?: Json | null
          question_text?: string | null
          shift?: string | null
          subject?: string | null
          topic?: string | null
          year?: number | null
        }
        Update: {
          correct_option?: string | null
          created_at?: string | null
          difficulty?: string | null
          exam_type?: string | null
          explanation?: string | null
          id?: string | null
          options?: Json | null
          question_text?: string | null
          shift?: string | null
          subject?: string | null
          topic?: string | null
          year?: number | null
        }
        Relationships: []
      }
      reviews_public: {
        Row: {
          content: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          rating: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          rating?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          rating?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_login_lockout: {
        Args: { check_email: string }
        Returns: {
          failed_attempts: number
          is_locked: boolean
          locked_until: string
        }[]
      }
      generate_invitation_code: { Args: never; Returns: string }
      generate_room_code: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_peer_room_participant: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      link_student_to_caregiver: { Args: { _code: string }; Returns: string }
      link_student_to_teacher: { Args: { _code: string }; Returns: string }
      record_login_attempt: {
        Args: {
          attempt_email: string
          attempt_ip?: string
          attempt_success: boolean
        }
        Returns: undefined
      }
      validate_invitation_code: {
        Args: { _code: string }
        Returns: {
          invitation_id: string
          inviter_id: string
          inviter_role: string
        }[]
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "caregiver" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "teacher", "caregiver", "admin"],
    },
  },
} as const
