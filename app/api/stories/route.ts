import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateStory } from '@/lib/gemini'
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

    const storyResult = await generateStory(languageName, wordCount, difficulty, topic)

    const story = await prisma.story.create({
      data: {
        title: storyResult.title,
        content: storyResult.content,
        language,
        difficulty,
        wordCount,
        vocabulary: storyResult.vocabularyMap as unknown as Record<string, unknown>, // Zapisz pełny słowniczek
        userId: session.user.id,
      },
    })

    return NextResponse.json({
      ...story,
      vocabulary: storyResult.vocabulary, // Lista 10-15 najważniejszych (frontend oczekuje 'vocabulary')
    })
  } catch (error) {
    console.error('Create story error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas generowania historii' },
      { status: 500 }
    )
  }
}
