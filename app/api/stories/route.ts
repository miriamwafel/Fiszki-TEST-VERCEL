import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateStory } from '@/lib/gemini'
import prisma from '@/lib/db'
import { getUnknownWords } from '@/lib/vocabulary-matcher'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stories = await prisma.story.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        sets: {
          select: {
            id: true,
            name: true,
            _count: { select: { flashcards: true } },
          },
        },
      },
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

    // Pobierz nieznane słowa z bazy słownictwa dla tego poziomu
    let targetWords: string[] = []
    try {
      const unknownWords = await getUnknownWords(
        session.user.id,
        language,
        10, // Max 10 słów do włączenia w historię
        difficulty // Filtruj po poziomie trudności
      )
      targetWords = unknownWords.map(w => `${w.word} (${w.translation})`)
    } catch (err) {
      console.error('Failed to get unknown words:', err)
      // Kontynuuj bez target words jeśli baza słownictwa jest pusta
    }

    // Rozszerz topic o słowa do nauczenia
    const enrichedTopic = targetWords.length > 0
      ? `${topic || 'dowolny temat'}. WAŻNE: Historia MUSI zawierać następujące słowa: ${targetWords.join(', ')}`
      : topic

    // Generuj historię RAZEM ze słowniczkiem (lepsza jakość!)
    const storyResult = await generateStory(languageName, wordCount, difficulty, enrichedTopic)

    const story = await prisma.story.create({
      data: {
        title: storyResult.title,
        content: storyResult.content,
        language,
        difficulty,
        wordCount,
        vocabulary: JSON.parse(JSON.stringify(storyResult.vocabularyMap)),
        userId: session.user.id,
      },
    })

    return NextResponse.json({
      ...story,
      vocabulary: storyResult.vocabulary, // Lista 10-15 najważniejszych słów
    })
  } catch (error) {
    console.error('Create story error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas generowania historii' },
      { status: 500 }
    )
  }
}
