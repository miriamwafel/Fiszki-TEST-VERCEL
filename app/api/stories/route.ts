import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateStoryFast, generateVocabularyForStory } from '@/lib/gemini'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stories = await prisma.story.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(stories)
  } catch (error) {
    console.error('Get stories error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { language, wordCount, difficulty, topic } = await request.json()

    if (!language || !wordCount || !difficulty) {
      return NextResponse.json(
        { error: 'Język, liczba słów i poziom trudności są wymagane' },
        { status: 400 }
      )
    }

    const languageNames: Record<string, string> = {
      en: 'angielskim',
      de: 'niemieckim',
      es: 'hiszpańskim',
      fr: 'francuskim',
      it: 'włoskim',
      pt: 'portugalskim',
      ru: 'rosyjskim',
      ja: 'japońskim',
      ko: 'koreańskim',
      zh: 'chińskim',
    }

    const languageName = languageNames[language] || language

    // KROK 1: Szybkie generowanie samej historii (3-5s zamiast 15-30s!)
    const quickStory = await generateStoryFast(languageName, wordCount, difficulty, topic)

    // Zapisz historię BEZ vocabulary (pokaż userowi od razu)
    const story = await prisma.story.create({
      data: {
        title: quickStory.title,
        content: quickStory.content,
        language,
        difficulty,
        wordCount,
        vocabulary: {}, // Puste - wygenerujemy w tle
        userId: session.user.id,
      },
    })

    // KROK 2: Generuj vocabulary W TLE (nie blokuje odpowiedzi!)
    // Używamy Promise bez await - odpowiedź idzie od razu
    generateVocabularyForStory(quickStory.content, languageName, difficulty)
      .then(async (vocabResult) => {
        // Zaktualizuj historię z vocabulary
        await prisma.story.update({
          where: { id: story.id },
          data: {
            vocabulary: JSON.parse(JSON.stringify(vocabResult.vocabularyMap)),
          },
        })
        console.log(`[Stories] Vocabulary generated for story ${story.id}`)
      })
      .catch((error) => {
        console.error(`[Stories] Failed to generate vocabulary for ${story.id}:`, error)
      })

    // Zwróć historię OD RAZU (bez czekania na vocabulary)
    return NextResponse.json({
      ...story,
      vocabulary: [], // Puste - frontend pokaże "Generuję słowniczek..."
      vocabularyLoading: true, // Flaga dla frontendu
    })
  } catch (error) {
    console.error('Create story error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas generowania historii' },
      { status: 500 }
    )
  }
}
