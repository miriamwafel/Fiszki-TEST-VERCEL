import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// Wymuś dynamiczne renderowanie
export const dynamic = 'force-dynamic'

// GET - Pobierz następne słowa do nauki (dla generowania historyjek)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ language: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { language } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const count = parseInt(searchParams.get('count') || '10')
    const level = searchParams.get('level') // Opcjonalny filtr po poziomie

    // Pobierz ID słówek, które użytkownik już zna lub uczy się
    const knownVocabIds = await prisma.userVocabularyProgress.findMany({
      where: {
        userId: session.user.id,
        vocabulary: { language },
        status: { in: ['learning', 'known'] },
      },
      select: { vocabularyId: true },
    })

    const knownIds = knownVocabIds.map(v => v.vocabularyId)

    // Pobierz następne słowa do nauki (nieznane, posortowane po częstotliwości)
    const whereClause: Record<string, unknown> = {
      language,
      id: { notIn: knownIds },
    }

    if (level) {
      whereClause.level = level
    }

    const nextWords = await prisma.vocabularyBase.findMany({
      where: whereClause,
      orderBy: { frequencyRank: 'asc' },
      take: count,
      select: {
        id: true,
        word: true,
        translation: true,
        frequencyRank: true,
        level: true,
        partOfSpeech: true,
        category: true,
        example: true,
      },
    })

    return NextResponse.json({
      words: nextWords,
      count: nextWords.length,
      totalUnknown: await prisma.vocabularyBase.count({
        where: {
          language,
          id: { notIn: knownIds },
        },
      }),
    })
  } catch (error) {
    console.error('Get next words error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
