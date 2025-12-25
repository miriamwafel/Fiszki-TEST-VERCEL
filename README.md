# Fiszki - Aplikacja do nauki języków z AI

Aplikacja do nauki języków obcych z wykorzystaniem sztucznej inteligencji (Gemini API).

## Funkcjonalności

- **Zestawy fiszek** - twórz zestawy fiszek z automatycznym tłumaczeniem AI
- **Inteligentne tłumaczenie** - AI rozpoznaje części mowy, sugeruje bezokoliczniki dla czasowników, pokazuje alternatywne znaczenia
- **Generator historyjek** - generuj historyjki na wybranym poziomie trudności (A1-C2), klikaj w słówka aby dodać je do fiszek
- **System powtórek** - ucz się w stylu Quizlet - widzisz tłumaczenie, wpisujesz słowo w nauczanym języku
- **Ćwiczenia** - uzupełnianie luk i układanie zdań z kontekstowymi słowami

## Technologie

- **Next.js 15** - React framework
- **TypeScript** - statyczne typowanie
- **Tailwind CSS** - stylowanie
- **Prisma** - ORM
- **Neon/Vercel Postgres** - baza danych
- **NextAuth.js** - autentykacja
- **Gemini API** - sztuczna inteligencja

## Instalacja

1. Sklonuj repozytorium
2. Zainstaluj zależności:
   ```bash
   npm install
   ```

3. Skonfiguruj zmienne środowiskowe (skopiuj `.env.example` do `.env`):
   ```bash
   cp .env.example .env
   ```

4. Wypełnij zmienne środowiskowe:
   - `DATABASE_URL` - URL do bazy Neon/Vercel Postgres
   - `NEXTAUTH_SECRET` - wygeneruj za pomocą `openssl rand -base64 32`
   - `NEXTAUTH_URL` - URL aplikacji (lokalnie: `http://localhost:3000`)
   - `GEMINI_API_KEY` - klucz API do Gemini

5. Zainicjalizuj bazę danych:
   ```bash
   npx prisma db push
   ```

6. Uruchom aplikację:
   ```bash
   npm run dev
   ```

## Deployment na Vercel

1. Połącz repozytorium z Vercel
2. Dodaj Vercel Postgres do projektu
3. Skonfiguruj zmienne środowiskowe w Vercel:
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (URL produkcyjny)
   - `GEMINI_API_KEY`
4. Vercel automatycznie uruchomi `prisma generate` podczas buildu

## Struktura projektu

```
├── app/
│   ├── (dashboard)/          # Strony chronione
│   │   ├── dashboard/        # Panel główny
│   │   ├── sets/             # Zarządzanie zestawami
│   │   ├── stories/          # Generator historyjek
│   │   └── exercises/        # Ćwiczenia
│   ├── api/                  # API endpoints
│   ├── login/                # Strona logowania
│   └── register/             # Strona rejestracji
├── components/               # Komponenty UI
├── lib/                      # Biblioteki (db, auth, gemini)
├── prisma/                   # Schema bazy danych
└── types/                    # Definicje typów
```
