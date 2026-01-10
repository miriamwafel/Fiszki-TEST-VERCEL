import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { gemini } from '@/lib/gemini'

// Liczba słów per poziom (6 poziomów x 333 = ~2000 słów)
const WORDS_PER_LEVEL = 333
const BATCH_SIZE = 100 // AI generuje max 100 słów na raz

// POST - Wygeneruj pełną bazę słownictwa dla języka (wszystkie poziomy)
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

    const languageNames: Record<string, string> = {
      en: 'angielski',
      de: 'niemiecki',
      es: 'hiszpański',
      fr: 'francuski',
      it: 'włoski',
    }

    const langName = languageNames[language] || language
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

    const results = {
      totalCreated: 0,
      totalSkipped: 0,
      byLevel: {} as Record<string, { created: number; skipped: number }>,
    }

    let globalRank = 1

    for (const level of levels) {
      results.byLevel[level] = { created: 0, skipped: 0 }

      // Ile batch'y potrzebujemy dla tego poziomu
      const batches = Math.ceil(WORDS_PER_LEVEL / BATCH_SIZE)

      for (let batch = 0; batch < batches; batch++) {
        const batchSize = Math.min(BATCH_SIZE, WORDS_PER_LEVEL - batch * BATCH_SIZE)
        const batchOffset = batch * BATCH_SIZE

        // Pobierz już istniejące słowa dla tego języka żeby ich nie powtarzać
        const existingWords = await prisma.vocabularyBase.findMany({
          where: { language },
          select: { word: true },
        })
        const existingSet = new Set(existingWords.map(w => w.word.toLowerCase()))

        const prompt = `Wygeneruj listę ${batchSize} słów w języku ${langName} dla poziomu ${level}.

${batchOffset > 0 ? `To jest część ${batch + 1} - wygeneruj INNE słowa niż w poprzednich częściach.` : ''}

Zwróć JSON array z obiektami w formacie:
[
  {
    "word": "słowo w języku obcym (forma podstawowa/bezokolicznik)",
    "translation": "polskie tłumaczenie",
    "partOfSpeech": "noun/verb/adjective/adverb/preposition/conjunction/pronoun/article/other",
    "category": "kategoria tematyczna (np. food, travel, work, family, emotions, time, numbers, colors, body, health, education, shopping, nature, weather, house, transport, communication, entertainment, sport, music, art, technology, science, politics, business, law, medicine, religion, environment)",
    "example": "krótkie przykładowe zdanie z użyciem słowa"
  }
]

Ważne:
- Poziom ${level} oznacza: ${getLevelDescription(level)}
- Dla czasowników użyj bezokolicznika
- Dla rzeczowników użyj formy podstawowej (liczba pojedyncza)
- Słowa powinny być posortowane od najczęściej używanych do rzadziej używanych dla danego poziomu
- Tłumaczenia mają być po polsku
- Przykłady powinny być proste i naturalne dla poziomu ${level}
- WAŻNE: Wygeneruj unikalne słowa, nie powtarzaj się

Zwróć TYLKO JSON array, bez żadnego dodatkowego tekstu.`

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
            console.error(`Failed to parse AI response for ${level} batch ${batch}:`, responseText.substring(0, 200))
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

          // Mały delay między requestami żeby nie przekroczyć rate limit
          await new Promise(resolve => setTimeout(resolve, 1000))

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
    console.error('Generate full vocabulary error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

function getLevelDescription(level: string): string {
  const descriptions: Record<string, string> = {
    A1: 'podstawowe słowa codziennego użytku - powitania, liczby, kolory, rodzina, jedzenie, dni tygodnia',
    A2: 'proste słowa do opisywania codziennych sytuacji - zakupy, podróże, praca, hobby',
    B1: 'słowa do wyrażania opinii, uczuć, opisywania doświadczeń i planów',
    B2: 'słowa abstrakcyjne, idiomy, wyrażenia do dyskusji i argumentacji',
    C1: 'zaawansowane słownictwo specjalistyczne, niuanse językowe, wyrażenia formalne',
    C2: 'rzadkie słowa, wyrażenia literackie, specjalistyczne terminy, subtelne różnice znaczeniowe',
  }
  return descriptions[level] || level
}
