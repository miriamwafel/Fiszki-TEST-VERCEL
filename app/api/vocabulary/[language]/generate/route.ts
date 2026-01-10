import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { gemini } from '@/lib/gemini'

// POST - Wygeneruj bazę słownictwa dla języka
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

    const body = await request.json()
    const { level, count = 100, startRank = 1 } = body as {
      level: string // A1, A2, B1, B2, C1, C2
      count?: number
      startRank?: number
    }

    if (!level) {
      return NextResponse.json({ error: 'Level is required' }, { status: 400 })
    }

    const languageNames: Record<string, string> = {
      en: 'angielski',
      de: 'niemiecki',
      es: 'hiszpański',
      fr: 'francuski',
      it: 'włoski',
    }

    const langName = languageNames[language] || language

    const prompt = `Wygeneruj listę ${count} najważniejszych słów w języku ${langName} dla poziomu ${level}.

Zwróć JSON array z obiektami w formacie:
[
  {
    "word": "słowo w języku obcym (forma podstawowa/bezokolicznik)",
    "translation": "polskie tłumaczenie",
    "partOfSpeech": "noun/verb/adjective/adverb/preposition/conjunction/pronoun/article/other",
    "category": "kategoria tematyczna (np. food, travel, work, family, emotions, time, numbers, colors, body, health, education, shopping, nature, weather, house, transport, communication, entertainment)",
    "example": "krótkie przykładowe zdanie z użyciem słowa"
  }
]

Ważne:
- Dla czasowników użyj bezokolicznika
- Dla rzeczowników użyj formy podstawowej (liczba pojedyncza)
- Słowa powinny być posortowane od najczęściej używanych do rzadziej używanych
- Uwzględnij słowa typowe dla poziomu ${level}
- Tłumaczenia mają być po polsku
- Każde słowo z innej kategorii jeśli możliwe, ale priorytet to częstotliwość użycia
- Przykłady powinny być proste i naturalne

Zwróć TYLKO JSON array, bez żadnego dodatkowego tekstu.`

    const result = await gemini.generateContent(prompt)
    const responseText = result.response.text()

    // Parse JSON
    let words: Array<{
      word: string
      translation: string
      partOfSpeech: string
      category: string
      example: string
    }>

    try {
      // Usuń markdown code blocks jeśli są
      const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      words = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse AI response:', responseText)
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // Zapisz słowa do bazy
    const created: string[] = []
    const skipped: string[] = []

    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      const rank = startRank + i

      try {
        await prisma.vocabularyBase.upsert({
          where: {
            language_word: {
              language,
              word: w.word.toLowerCase().trim(),
            },
          },
          update: {
            translation: w.translation,
            level,
            partOfSpeech: w.partOfSpeech,
            category: w.category,
            example: w.example,
          },
          create: {
            language,
            word: w.word.toLowerCase().trim(),
            translation: w.translation,
            frequencyRank: rank,
            level,
            partOfSpeech: w.partOfSpeech,
            category: w.category,
            example: w.example,
          },
        })
        created.push(w.word)
      } catch {
        skipped.push(w.word)
      }
    }

    return NextResponse.json({
      message: `Generated ${created.length} words, skipped ${skipped.length}`,
      count: created.length,
      created: created.length,
      skipped: skipped.length,
    })
  } catch (error) {
    console.error('Generate vocabulary error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
