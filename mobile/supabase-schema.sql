-- ===========================================
-- SCHEMAT BAZY DANYCH DLA FISZKI APP
-- Uruchom ten skrypt w Supabase SQL Editor
-- ===========================================

-- Włącz UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- TABELA: users
-- Profil użytkownika (rozszerzenie auth.users)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger do automatycznego tworzenia profilu po rejestracji
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usuń istniejący trigger jeśli istnieje
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Utwórz trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- TABELA: flashcard_sets
-- Zestawy fiszek
-- ===========================================
CREATE TABLE IF NOT EXISTS public.flashcard_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index dla szybszego wyszukiwania po user_id
CREATE INDEX IF NOT EXISTS idx_flashcard_sets_user_id ON public.flashcard_sets(user_id);

-- ===========================================
-- TABELA: flashcards
-- Pojedyncze fiszki
-- ===========================================
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  context TEXT,
  part_of_speech TEXT,
  infinitive TEXT,
  set_id UUID NOT NULL REFERENCES public.flashcard_sets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index dla szybszego wyszukiwania po set_id
CREATE INDEX IF NOT EXISTS idx_flashcards_set_id ON public.flashcards(set_id);

-- ===========================================
-- TABELA: practice_stats
-- Statystyki nauki
-- ===========================================
CREATE TABLE IF NOT EXISTS public.practice_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  correct INTEGER DEFAULT 0,
  incorrect INTEGER DEFAULT 0,
  last_practice TIMESTAMPTZ,
  mastered BOOLEAN DEFAULT FALSE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, flashcard_id)
);

-- Indexy dla practice_stats
CREATE INDEX IF NOT EXISTS idx_practice_stats_user_id ON public.practice_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_stats_flashcard_id ON public.practice_stats(flashcard_id);

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- Każdy użytkownik widzi tylko swoje dane
-- ===========================================

-- Włącz RLS dla wszystkich tabel
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_stats ENABLE ROW LEVEL SECURITY;

-- Polityki dla users
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Polityki dla flashcard_sets
CREATE POLICY "Users can view own sets"
  ON public.flashcard_sets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sets"
  ON public.flashcard_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sets"
  ON public.flashcard_sets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sets"
  ON public.flashcard_sets FOR DELETE
  USING (auth.uid() = user_id);

-- Polityki dla flashcards
CREATE POLICY "Users can view flashcards from own sets"
  ON public.flashcards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets
      WHERE flashcard_sets.id = flashcards.set_id
      AND flashcard_sets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create flashcards in own sets"
  ON public.flashcards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets
      WHERE flashcard_sets.id = set_id
      AND flashcard_sets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update flashcards in own sets"
  ON public.flashcards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets
      WHERE flashcard_sets.id = flashcards.set_id
      AND flashcard_sets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete flashcards from own sets"
  ON public.flashcards FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets
      WHERE flashcard_sets.id = flashcards.set_id
      AND flashcard_sets.user_id = auth.uid()
    )
  );

-- Polityki dla practice_stats
CREATE POLICY "Users can view own stats"
  ON public.practice_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own stats"
  ON public.practice_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
  ON public.practice_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stats"
  ON public.practice_stats FOR DELETE
  USING (auth.uid() = user_id);

-- ===========================================
-- FUNKCJE POMOCNICZE
-- ===========================================

-- Funkcja do aktualizacji updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggery dla updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_flashcard_sets_updated_at
  BEFORE UPDATE ON public.flashcard_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_flashcards_updated_at
  BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_practice_stats_updated_at
  BEFORE UPDATE ON public.practice_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===========================================
-- WIDOKI POMOCNICZE
-- ===========================================

-- Widok: zestawy z liczbą fiszek
CREATE OR REPLACE VIEW public.flashcard_sets_with_count AS
SELECT
  fs.*,
  COUNT(f.id)::INTEGER as flashcard_count
FROM public.flashcard_sets fs
LEFT JOIN public.flashcards f ON f.set_id = fs.id
GROUP BY fs.id;

-- ===========================================
-- GOTOWE!
-- Teraz możesz używać Supabase Auth do rejestracji
-- i logowania użytkowników.
-- ===========================================
