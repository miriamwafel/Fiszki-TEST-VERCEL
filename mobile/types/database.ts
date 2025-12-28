export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      flashcard_sets: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          language: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          language: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          language?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      flashcards: {
        Row: {
          id: string;
          word: string;
          translation: string;
          context: string | null;
          part_of_speech: string | null;
          infinitive: string | null;
          set_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          word: string;
          translation: string;
          context?: string | null;
          part_of_speech?: string | null;
          infinitive?: string | null;
          set_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          word?: string;
          translation?: string;
          context?: string | null;
          part_of_speech?: string | null;
          infinitive?: string | null;
          set_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      practice_stats: {
        Row: {
          id: string;
          correct: number;
          incorrect: number;
          last_practice: string | null;
          mastered: boolean;
          user_id: string;
          flashcard_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          correct?: number;
          incorrect?: number;
          last_practice?: string | null;
          mastered?: boolean;
          user_id: string;
          flashcard_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          correct?: number;
          incorrect?: number;
          last_practice?: string | null;
          mastered?: boolean;
          user_id?: string;
          flashcard_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types
export type User = Database['public']['Tables']['users']['Row'];
export type FlashcardSet = Database['public']['Tables']['flashcard_sets']['Row'];
export type Flashcard = Database['public']['Tables']['flashcards']['Row'];
export type PracticeStats = Database['public']['Tables']['practice_stats']['Row'];

// Extended types with relations
export type FlashcardSetWithCards = FlashcardSet & {
  flashcards: Flashcard[];
  flashcard_count?: number;
};

export type FlashcardWithStats = Flashcard & {
  practice_stats?: PracticeStats[];
};
