import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// Wymuś dynamiczne renderowanie
export const dynamic = 'force-dynamic'

// GET - Pobierz bazę słownictwa z postępem użytkownika
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
    const level = searchParams.get('level') // Opcjonalny filtr po poziomie
    const status = searchParams.get('status') // Opcjonalny filtr: unknown, learning, known
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Pobierz słownictwo z postępem użytkownika
    const whereClause: Record<string, unknown> = { language }
    if (level) {
      whereClause.level = level
    }

    const vocabulary = await prisma.vocabularyBase.findMany({
      where: whereClause,
      include: {
        userProgress: {
          where: { userId: session.user.id },
          select: {
            id: true,
            status: true,
            source: true,
            learnedAt: true,
          },
        },
      },
      orderBy: { frequencyRank: 'asc' },
      take: limit,
      skip: offset,
    })

    // Filtruj po statusie jeśli podano
    let filteredVocabulary = vocabulary.map(v => ({
      ...v,
      userStatus: v.userProgress[0]?.status || 'unknown',
      userSource: v.userProgress[0]?.source || null,
      learnedAt: v.userProgress[0]?.learnedAt || null,
    }))

    if (status) {
      filteredVocabulary = filteredVocabulary.filter(v => v.userStatus === status)
    }

    // Pobierz statystyki
    const totalCount = await prisma.vocabularyBase.count({
      where: { language },
    })

    const progressCounts = await prisma.userVocabularyProgress.groupBy({
      by: ['status'],
      where: {
        userId: session.user.id,
        vocabulary: { language },
      },
      _count: true,
    })

    const stats = {
      total: totalCount,
      unknown: totalCount - progressCounts.reduce((acc, p) => acc + p._count, 0),
      learning: progressCounts.find(p => p.status === 'learning')?._count || 0,
      known: progressCounts.find(p => p.status === 'known')?._count || 0,
    }

    return NextResponse.json({
      vocabulary: filteredVocabulary,
      stats,
      pagination: {
        total: totalCount,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('Get vocabulary error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

// PUT - Zaktualizuj status słówka
export async function PUT(
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
    const { vocabularyId, status, source, sourceId } = body as {
      vocabularyId: string
      status: 'unknown' | 'learning' | 'known'
      source?: string
      sourceId?: string
    }

    if (!vocabularyId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Sprawdź czy słówko istnieje i jest dla tego języka
    const vocab = await prisma.vocabularyBase.findFirst({
      where: { id: vocabularyId, language },
    })

    if (!vocab) {
      return NextResponse.json({ error: 'Vocabulary not found' }, { status: 404 })
    }

    // Upsert postępu
    const progress = await prisma.userVocabularyProgress.upsert({
      where: {
        userId_vocabularyId: {
          userId: session.user.id,
          vocabularyId,
        },
      },
      update: {
        status,
        source: source || undefined,
        sourceId: sourceId || undefined,
        learnedAt: status === 'known' ? new Date() : null,
      },
      create: {
        userId: session.user.id,
        vocabularyId,
        status,
        source: source || null,
        sourceId: sourceId || null,
        learnedAt: status === 'known' ? new Date() : null,
      },
    })

    return NextResponse.json({ progress })
  } catch (error) {
    console.error('Update vocabulary progress error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
