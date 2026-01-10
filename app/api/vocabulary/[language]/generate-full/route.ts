import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { gemini } from '@/lib/gemini'

/**
 * Rozkład słów według CEFR (Common European Framework of Reference)
 *
 * A1: 300 słów - podstawowe przetrwanie (powitania, liczby, kolory, rodzina, jedzenie)
 * A2: 500 słów - codzienne sytuacje (zakupy, podróże, praca, hobby)
 * B1: 600 słów - wyrażanie opinii, uczuć, doświadczeń, planów
 * B2: 400 słów - abstrakcyjne tematy, idiomy, argumentacja
 * C1: 150 słów - specjalistyczne, formalne, niuanse
 * C2: 50 słów - rzadkie, literackie, subtelne różnice
 *
 * Razem: ~2000 słów z naciskiem na podstawy
 */
const CEFR_DISTRIBUTION: Record<string, number> = {
  A1: 300,
  A2: 500,
  B1: 600,
  B2: 400,
  C1: 150,
  C2: 50,
}

const BATCH_SIZE = 80 // AI generuje max ~80-100 słów na raz (bezpieczniej 80)

const languageNames: Record<string, string> = {
  en: 'angielski',
  de: 'niemiecki',
  es: 'hiszpański',
  fr: 'francuski',
  it: 'włoski',
}

// POST - Wygeneruj bazę słownictwa dla języka
// Body: { level?: string } - opcjonalnie tylko jeden poziom
export async function POST(
  request: Request,
  { params }: { params: Promise<{ language: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { language } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Tylko admin może generować bazę
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    // Opcjonalnie: generuj tylko jeden poziom lub z custom targetCount
    let targetLevel: string | null = null
    let customTargetCount: number | null = null
    try {
      const body = await request.json()
      targetLevel = body?.level || null
      customTargetCount = body?.targetCount ? parseInt(body.targetCount) : null
    } catch {
      // Brak body = generuj wszystkie poziomy
    }

    const langName = languageNames[language] || language
    const levels = targetLevel
      ? [targetLevel.toUpperCase()]
      : ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

    const results = {
      totalCreated: 0,
      totalSkipped: 0,
      byLevel: {} as Record<string, { created: number; skipped: number; target: number }>,
    }

    // Znajdź najwyższy rank w bazie
    const maxRankRecord = await prisma.vocabularyBase.findFirst({
      where: { language },
      orderBy: { frequencyRank: 'desc' },
      select: { frequencyRank: true },
    })
    let globalRank = (maxRankRecord?.frequencyRank || 0) + 1

    for (const level of levels) {
      // Użyj custom targetCount jeśli podany (dla pojedynczego poziomu), lub domyślny CEFR
      const targetCount = (targetLevel && customTargetCount) ? customTargetCount : (CEFR_DISTRIBUTION[level] || 100)
      results.byLevel[level] = { created: 0, skipped: 0, target: targetCount }

      // Sprawdź ile słów już mamy dla tego poziomu
      const existingCount = await prisma.vocabularyBase.count({
        where: { language, level },
      })

      // Ile jeszcze potrzebujemy
      const neededCount = Math.max(0, targetCount - existingCount)
      if (neededCount === 0) {
        console.log(`Level ${level}: already has ${existingCount} words (target: ${targetCount})`)
        continue
      }

      console.log(`Level ${level}: need ${neededCount} more words (have ${existingCount}, target: ${targetCount})`)

      // Ile batch'y potrzebujemy
      const batches = Math.ceil(neededCount / BATCH_SIZE)

      for (let batch = 0; batch < batches; batch++) {
        const batchSize = Math.min(BATCH_SIZE, neededCount - batch * BATCH_SIZE)
        if (batchSize <= 0) break

        // Pobierz już istniejące słowa dla tego języka żeby ich nie powtarzać
        const existingWords = await prisma.vocabularyBase.findMany({
          where: { language },
          select: { word: true },
        })
        const existingSet = new Set(existingWords.map((w: { word: string }) => w.word.toLowerCase()))

        const prompt = `Wygeneruj listę ${batchSize} słów w języku ${langName} dla poziomu ${level}.

${batch > 0 ? `To jest część ${batch + 1} - wygeneruj INNE słowa niż wcześniej.` : ''}

Zwróć JSON array z obiektami:
[
  {
    "word": "słowo (forma podstawowa/bezokolicznik)",
    "translation": "polskie tłumaczenie",
    "partOfSpeech": "noun/verb/adjective/adverb/preposition/conjunction/pronoun/other",
    "category": "kategoria (food, travel, work, family, emotions, time, body, health, education, shopping, nature, house, transport, communication, entertainment, sport, technology)",
    "example": "krótkie przykładowe zdanie"
  }
]

WAŻNE dla poziomu ${level}:
${getLevelGuidelines(level)}

Zasady:
- Czasowniki w bezokoliczniku
- Rzeczowniki w liczbie pojedynczej
- Sortuj od najczęściej używanych
- Tłumaczenia po polsku
- NIE powtarzaj słów
- Przykłady naturalne dla poziomu ${level}

Zwróć TYLKO JSON array.`

        try {
          const result = await gemini.generateContent(prompt)
          const responseText = result.response.text()

          let words: Array<{
            word: string
            translation: string
            partOfSpeech: string
            category: string
            example: string
          }>

          try {
            const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
            words = JSON.parse(jsonStr)
          } catch {
            console.error(`Failed to parse AI response for ${level} batch ${batch}`)
            continue
          }

          // Zapisz słowa do bazy
          for (const w of words) {
            const wordLower = w.word.toLowerCase().trim()

            // Pomiń jeśli już istnieje
            if (existingSet.has(wordLower)) {
              results.byLevel[level].skipped++
              results.totalSkipped++
              continue
            }

            try {
              await prisma.vocabularyBase.create({
                data: {
                  language,
                  word: wordLower,
                  translation: w.translation,
                  frequencyRank: globalRank++,
                  level,
                  partOfSpeech: w.partOfSpeech,
                  category: w.category,
                  example: w.example,
                },
              })
              existingSet.add(wordLower)
              results.byLevel[level].created++
              results.totalCreated++
            } catch {
              results.byLevel[level].skipped++
              results.totalSkipped++
            }
          }

          // Delay między requestami (rate limiting)
          await new Promise(resolve => setTimeout(resolve, 1500))

        } catch (error) {
          console.error(`Error generating batch ${batch} for level ${level}:`, error)
        }
      }
    }

    return NextResponse.json({
      message: `Wygenerowano ${results.totalCreated} słów dla języka ${langName}`,
      ...results,
    })
  } catch (error) {
    console.error('Generate vocabulary error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

function getLevelGuidelines(level: string): string {
  const guidelines: Record<string, string> = {
    A1: `Poziom A1 (300 słów) - PODSTAWOWE PRZETRWANIE:
- Powitania i pożegnania (hola, adiós, buenos días)
- Liczby 1-100
- Kolory podstawowe
- Rodzina (mama, tata, brat, siostra)
- Jedzenie podstawowe (chleb, woda, mleko, jabłko)
- Dni tygodnia, miesiące
- Zaimki (ja, ty, on, ona)
- Czasowniki: być, mieć, chcieć, móc, robić, iść
- Przymiotniki: duży, mały, dobry, zły, ładny
- Przedmioty codzienne (dom, stół, krzesło)`,

    A2: `Poziom A2 (500 słów) - CODZIENNE SYTUACJE:
- Zakupy (sklep, cena, pieniądze, tani, drogi)
- Podróże (bilet, hotel, lotnisko, pociąg)
- Praca (biuro, szef, kolega, spotkanie)
- Hobby i czas wolny (film, muzyka, sport)
- Pogoda (słońce, deszcz, zimno, ciepło)
- Zdrowie podstawowe (lekarz, ból, chory)
- Emocje proste (szczęśliwy, smutny, zmęczony)
- Więcej czasowników: kupować, sprzedawać, pracować, grać`,

    B1: `Poziom B1 (600 słów) - WYRAŻANIE OPINII:
- Opinie (myślę że, uważam, zgadzam się)
- Uczucia złożone (rozczarowany, podekscytowany, zaskoczony)
- Doświadczenia (pamiętać, zapomnieć, doświadczyć)
- Plany i marzenia (planować, marzyć, zamierzać)
- Edukacja (uniwersytet, egzamin, kurs)
- Technologia (komputer, internet, aplikacja)
- Relacje (przyjaciel, znajomy, partner)
- Spójniki złożone (chociaż, podczas gdy, ponieważ)`,

    B2: `Poziom B2 (400 słów) - ABSTRAKCJA I ARGUMENTACJA:
- Idiomy i wyrażenia potoczne
- Słowa abstrakcyjne (wolność, sprawiedliwość, odpowiedzialność)
- Dyskusja (argument, dowód, wniosek)
- Polityka i społeczeństwo
- Ekonomia podstawowa
- Środowisko
- Synonimy i antonimy zaawansowane
- Czasowniki złożone (phrasal verbs)`,

    C1: `Poziom C1 (150 słów) - SPECJALISTYCZNE:
- Słownictwo formalne i akademickie
- Niuanse znaczeniowe
- Wyrażenia idiomatyczne zaawansowane
- Terminy prawne i biznesowe
- Stylistyka i rejestry języka
- Kolokacje zaawansowane`,

    C2: `Poziom C2 (50 słów) - BIEGŁOŚĆ:
- Słowa rzadkie i literackie
- Archaizmy używane w formalnym języku
- Subtelne różnice znaczeniowe
- Specjalistyczne terminy naukowe
- Wyrażenia o wysokim rejestrze`,
  }
  return guidelines[level] || level
}
