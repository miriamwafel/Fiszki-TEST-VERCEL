import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { findVocabularyMatch } from '@/lib/vocabulary-matcher'

// POST - Oznacz słowo jako znane (po słowie, nie ID)
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

    const body = await request.json()
    const { word } = body as { word: string }

    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    // Znajdź słowo w bazie
    const match = await findVocabularyMatch(word, language)

    if (!match) {
      return NextResponse.json({ error: 'Word not found in vocabulary base' }, { status: 404 })
    }

    // Upsert postępu jako "known"
    const progress = await prisma.userVocabularyProgress.upsert({
      where: {
        userId_vocabularyId: {
          userId: session.user.id,
          vocabularyId: match.vocabularyId,
        },
      },
      update: {
        status: 'known',
        source: 'manual',
        learnedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        vocabularyId: match.vocabularyId,
        status: 'known',
        source: 'manual',
        learnedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      word: match.word,
      progress,
    })
  } catch (error) {
    console.error('Mark known error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
