# Fiszki Mobile

Aplikacja mobilna do nauki języków obcych z fiszkami.

## Wymagania

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app na telefonie (iOS/Android)

## Instalacja

```bash
cd mobile
npm install
```

## Konfiguracja Supabase

### 1. Utwórz tabele w Supabase

1. Zaloguj się do [Supabase Dashboard](https://app.supabase.com)
2. Przejdź do swojego projektu
3. Otwórz **SQL Editor**
4. Wklej zawartość pliku `supabase-schema.sql`
5. Kliknij **Run**

### 2. Skonfiguruj Authentication

1. W Supabase Dashboard przejdź do **Authentication** → **Providers**
2. Upewnij się, że **Email** provider jest włączony
3. (Opcjonalnie) Wyłącz **Confirm email** dla szybszego testowania

## Uruchamianie

```bash
# Uruchom serwer deweloperski
npm start

# Lub bezpośrednio na platformę:
npm run android  # Android
npm run ios      # iOS (wymaga Mac)
```

## Skanowanie QR

1. Zainstaluj **Expo Go** na telefonie
2. Zeskanuj QR kod z terminala
3. Aplikacja uruchomi się na telefonie

## Struktura projektu

```
mobile/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Ekrany autoryzacji
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/            # Główne zakładki
│   │   ├── index.tsx      # Lista zestawów
│   │   ├── profile.tsx    # Profil użytkownika
│   │   └── sets/          # Szczegóły zestawu i quiz
│   └── _layout.tsx        # Root layout
├── lib/
│   ├── supabase.ts        # Klient Supabase
│   └── auth.tsx           # Context autoryzacji
├── types/
│   └── database.ts        # TypeScript typy dla Supabase
├── assets/                 # Obrazy i ikony
└── supabase-schema.sql    # Schemat bazy danych
```

## Funkcje

- ✅ Logowanie i rejestracja
- ✅ Lista zestawów fiszek
- ✅ Przeglądanie fiszek w zestawie
- ✅ Quiz (tryb praktyki)
- ✅ Statystyki nauki
- ✅ Secure storage dla tokenów

## Technologie

- Expo SDK 52
- React Native
- Expo Router (file-based routing)
- Supabase (auth + database)
- TypeScript
