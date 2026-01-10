# Rejestr Funkcji - Fiszki App

> **Cel:** Dokumentacja kluczowych funkcji, hooków i modułów aplikacji. Używaj tego pliku do:
> - Szybkiego znajdowania gdzie co jest
> - Sprawdzania co zmienić przy modyfikacji logiki
> - Unikania duplikacji funkcjonalności

---

## Hooki (lib/hooks/)

### useCache
**Lokalizacja:** `lib/hooks/useCache.ts`

**Zależności:** IndexedDB (lib/cache.ts)

**Logika:** Generyczny hook do cache'owania z wzorcem SWR (stale-while-revalidate). Obsługuje:
- Cache w pamięci + IndexedDB
- Deduplikację requestów
- Automatyczna rewalidacja

**Eksportowane hooki:**
- `useCache<T>()` - bazowy hook
- `useSets()` - lista zestawów fiszek
- `useSet(setId)` - pojedynczy zestaw z fiszkami
- `useStories()` - lista historyjek
- `useTranslation()` - tłumaczenia z pamięcią
- `usePrefetch()` - prefetching danych
- `useCacheInvalidation()` - czyszczenie cache

**Gdzie użyte:**
- `/app/(dashboard)/sets/page.tsx`
- `/app/(dashboard)/stories/page.tsx`
- `/components/StoryReader.tsx`

---

### useToast
**Lokalizacja:** `lib/hooks/useToast.ts`

**Zależności:** sonner

**Logika:** Wrapper na bibliotekę sonner do wyświetlania powiadomień toast.

**Metody:**
- `success(message, description?)` - zielony toast sukcesu
- `error(message, description?)` - czerwony toast błędu
- `info(message, description?)` - niebieski toast informacyjny
- `warning(message, description?)` - żółty toast ostrzeżenia
- `loading(message)` - toast ładowania (zwraca ID)
- `promise(promise, messages)` - automatyczne stany ładowania/sukcesu/błędu

**Gdzie użyte:**
- Formularze CRUD (zestawy, fiszki, historyjki)
- Akcje użytkownika (zapisz, usuń, etc.)

---

### useLiveAPI
**Lokalizacja:** `lib/useLiveAPI.ts`

**Zależności:** WebSocket, Gemini Live API

**Logika:** Hook do komunikacji głosowej z AI przez Gemini Live API (WebSocket).

**Metody:**
- `connect()` - połącz z WebSocket
- `disconnect()` - rozłącz
- `sendAudio(data)` - wyślij audio (PCM 16kHz)
- `sendText(text)` - wyślij tekst
- `clearAudioQueue()` - wyczyść kolejkę audio

**Stany:**
- `connectionState` - 'disconnected' | 'connecting' | 'connected' | 'error'
- `currentText` - tekst odpowiedzi AI
- `audioQueue` - ArrayBuffer[] do odtworzenia
- `isModelSpeaking` - czy AI mówi

**Gdzie użyte:**
- `/app/(dashboard)/ai-teacher/page.tsx`

---

## Komponenty (components/)

### Button
**Lokalizacja:** `components/Button.tsx`

**Props:**
- `variant` - 'primary' | 'secondary' | 'danger' | 'ghost'
- `size` - 'sm' | 'md' | 'lg'
- `loading` - boolean (pokazuje spinner)

**Gdzie użyte:** Wszędzie

---

### Modal
**Lokalizacja:** `components/Modal.tsx`

**Props:**
- `isOpen` - boolean
- `onClose` - callback
- `title` - string
- `children` - React.ReactNode

**Funkcjonalność:**
- Zamykanie przez Escape
- Zamykanie przez kliknięcie tła
- aria-modal, role="dialog"

**Gdzie użyte:**
- Formularze tworzenia/edycji
- Potwierdzenia usunięcia

---

### Navbar
**Lokalizacja:** `components/Navbar.tsx`

**Zależności:** next-auth, useSession

**Logika:**
- Menu główne aplikacji
- Responsywne (hamburger na mobile)
- Sprawdza czy user jest adminem

**Gdzie użyte:** `app/(dashboard)/layout.tsx`

---

### AIChatWidget
**Lokalizacja:** `components/AIChatWidget.tsx`

**Zależności:** Gemini API (przez /api/ai-chat)

**Logika:** Pływający widget czatu z AI na dole ekranu.

**Gdzie użyte:** `app/(dashboard)/layout.tsx`

---

### LiveAudioRecorder
**Lokalizacja:** `components/LiveAudioRecorder.tsx`

**Logika:**
- Nagrywanie audio z mikrofonu
- Resampling do 16kHz PCM
- Push-to-talk na mobile, toggle na desktop

**Gdzie użyte:** `/app/(dashboard)/ai-teacher/page.tsx`

---

### LiveAudioPlayer
**Lokalizacja:** `components/LiveAudioPlayer.tsx`

**Logika:**
- Odtwarzanie PCM audio z AI
- Kolejkowanie buforów
- Wizualizacja "AI mówi"

**Gdzie użyte:** `/app/(dashboard)/ai-teacher/page.tsx`

---

## Utilities (lib/)

### prisma (db.ts)
**Lokalizacja:** `lib/db.ts`

**Logika:** Singleton PrismaClient dla uniknięcia connection exhaustion.

**Gdzie użyte:** Wszystkie API routes

---

### auth (auth.ts)
**Lokalizacja:** `lib/auth.ts`

**Logika:** Konfiguracja NextAuth z Credentials provider.

**Gdzie użyte:**
- `app/api/auth/[...nextauth]/route.ts`
- Wszystkie API routes (getServerSession)

---

### cache (cache.ts)
**Lokalizacja:** `lib/cache.ts`

**Logika:** System cache'owania w IndexedDB dla PWA offline.

**Eksporty:**
- `flashcardsCache` - cache dla fiszek i zestawów
- `CACHE_TTL` - czasy życia cache

**Gdzie użyte:** `lib/hooks/useCache.ts`

---

### gemini (gemini.ts)
**Lokalizacja:** `lib/gemini.ts`

**Logika:** Integracja z Gemini AI API.

**Funkcje:**
- `generateStory()` - generowanie historyjek
- `translateWord()` - tłumaczenie słów
- `generateExercises()` - generowanie ćwiczeń
- `chat()` - ogólny chat

**Gdzie użyte:** API routes

---

### grammar-modules (grammar-modules.ts)
**Lokalizacja:** `lib/grammar-modules.ts`

**Logika:** Definicje modułów gramatycznych dla różnych języków i poziomów.

**Funkcje:**
- `getModules(language, level)` - pobierz moduły
- `getModuleById(id)` - pobierz pojedynczy moduł

**Gdzie użyte:**
- `/app/(dashboard)/grammar/page.tsx`
- `/app/api/grammar/[moduleId]/route.ts`

---

## API Routes (app/api/)

### /api/sets
**Lokalizacja:** `app/api/sets/route.ts`

**Metody:** GET, POST

**Logika:**
- GET: pobierz zestawy użytkownika
- POST: utwórz nowy zestaw

---

### /api/sets/[id]
**Lokalizacja:** `app/api/sets/[id]/route.ts`

**Metody:** GET, PUT, DELETE

---

### /api/sets/[id]/reviews
**Lokalizacja:** `app/api/sets/[id]/reviews/route.ts`

**Metody:** GET, POST, PUT, DELETE

**Logika:** Harmonogram powtórek (spaced repetition)

**Optymalizacje:**
- Promise.all() dla równoległych zapytań
- Jedno zapytanie dla settings (nie duplikowane)

---

### /api/reviews
**Lokalizacja:** `app/api/reviews/route.ts`

**Metody:** GET

**Logika:** Pobiera wszystkie powtórki (zestawy + gramatyka) do kalendarza.

**Optymalizacje:**
- Promise.all() dla równoległych zapytań

---

### /api/stories
**Lokalizacja:** `app/api/stories/route.ts`

**Metody:** GET, POST

---

### /api/translate-word
**Lokalizacja:** `app/api/translate-word/route.ts`

**Metody:** POST

**Logika:**
- Sprawdza cache w vocabulary historyjki
- Fallback do Gemini AI

---

### /api/ai-chat
**Lokalizacja:** `app/api/ai-chat/route.ts`

**Metody:** POST

**Logika:** Chat z AI (widget)

---

### /api/grammar/[moduleId]
**Lokalizacja:** `app/api/grammar/[moduleId]/route.ts`

**Metody:** GET, POST

**Logika:**
- GET: pobierz postęp w module
- POST: generuj treść modułu przez AI

---

### /api/admin/users
**Lokalizacja:** `app/api/admin/users/route.ts`

**Metody:** GET, PUT

**Logika:** Zarządzanie użytkownikami (tylko admin)

---

## Baza Danych (prisma/)

### Modele
- `User` - użytkownicy
- `UserSettings` - ustawienia (dni powtórek, max/dzień)
- `FlashcardSet` - zestawy fiszek
- `Flashcard` - pojedyncze fiszki
- `ReviewSchedule` - harmonogram powtórek zestawów
- `Story` - historyjki do czytania
- `PracticeStats` - statystyki ćwiczeń
- `UserGrammarProgress` - postęp w gramatyce
- `GrammarReviewSchedule` - harmonogram powtórek gramatyki
- `StickyNote` - notatki

### Indeksy
Wszystkie tabele mają indeksy na `userId` i kluczowych kolumnach wyszukiwania.

---

## Checklist przy zmianach

### Zmiana logiki powtórek:
- [ ] `app/api/sets/[id]/reviews/route.ts`
- [ ] `app/api/reviews/route.ts`
- [ ] `app/api/grammar/[moduleId]/reviews/route.ts`
- [ ] `lib/hooks/useCache.ts` (jeśli cache)

### Zmiana modelu User:
- [ ] `prisma/schema.prisma`
- [ ] `app/api/auth/[...nextauth]/route.ts`
- [ ] `lib/auth.ts`
- [ ] `app/api/admin/users/route.ts`

### Nowy komponent UI:
- [ ] Dodaj aria-labels
- [ ] Dodaj stany hover/focus/disabled
- [ ] Responsive (mobile first)
- [ ] Dodaj do tego rejestru

### Nowe API route:
- [ ] Sprawdź autentykację
- [ ] Error handling (try/catch)
- [ ] Proper status codes
- [ ] Dodaj do tego rejestru
