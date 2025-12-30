import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const setId = searchParams.get('setId')

    if (!setId) {
      return NextResponse.json(
        { error: 'ID zestawu jest wymagane' },
        { status: 400 }
      )
    }

    // Verify user owns the set
    const set = await prisma.flashcardSet.findFirst({
      where: {
        id: setId,
        userId: session.user.id,
      },
      include: {
        flashcards: true,
      },
    })

    if (!set) {
      return NextResponse.json({ error: 'Nie znaleziono zestawu' }, { status: 404 })
    }

    // Get practice stats for flashcards
    const stats = await prisma.practiceStats.findMany({
      where: {
        userId: session.user.id,
        flashcardId: { in: set.flashcards.map((f) => f.id) },
      },
    })

    const statsMap = new Map(stats.map((s) => [s.flashcardId, s]))

    // Return flashcards with stats, prioritizing non-mastered ones
    const flashcardsWithStats = set.flashcards.map((flashcard) => ({
      ...flashcard,
      stats: statsMap.get(flashcard.id) || null,
    }))

    // Sort: not mastered first, then by incorrect count (descending)
    flashcardsWithStats.sort((a, b) => {
      const aMastered = a.stats?.mastered || false
      const bMastered = b.stats?.mastered || false

      if (aMastered !== bMastered) {
        return aMastered ? 1 : -1
      }

      const aIncorrect = a.stats?.incorrect || 0
      const bIncorrect = b.stats?.incorrect || 0

      return bIncorrect - aIncorrect
    })

    return NextResponse.json({
      set,
      flashcards: flashcardsWithStats,
    })
  } catch (error) {
    console.error('Get practice error:', error)
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

    const { flashcardId, correct, override } = await request.json()

    if (!flashcardId || correct === undefined) {
      return NextResponse.json(
        { error: 'ID fiszki i wynik są wymagane' },
        { status: 400 }
      )
    }

    // Verify user owns the flashcard through the set
    const flashcard = await prisma.flashcard.findFirst({
      where: { id: flashcardId },
      include: { set: true },
    })

    if (!flashcard || flashcard.set.userId !== session.user.id) {
      return NextResponse.json({ error: 'Nie znaleziono fiszki' }, { status: 404 })
    }

    // Update or create practice stats
    const existingStats = await prisma.practiceStats.findUnique({
      where: {
        userId_flashcardId: {
          userId: session.user.id,
          flashcardId,
        },
      },
    })

    let stats
    if (existingStats) {
      let newCorrect = existingStats.correct
      let newIncorrect = existingStats.incorrect

      if (override && correct) {
        // Korekta: cofnij błędną odpowiedź i dodaj poprawną
        newCorrect = existingStats.correct + 1
        newIncorrect = Math.max(0, existingStats.incorrect - 1)
      } else if (correct) {
        newCorrect = existingStats.correct + 1
      } else {
        newIncorrect = existingStats.incorrect + 1
      }

      // Mark as mastered if correct 3+ times in a row (simplified logic)
      const mastered = correct && newCorrect >= 3 && newIncorrect === 0

      stats = await prisma.practiceStats.update({
        where: { id: existingStats.id },
        data: {
          correct: newCorrect,
          incorrect: newIncorrect,
          lastPractice: new Date(),
          mastered,
        },
      })
    } else {
      stats = await prisma.practiceStats.create({
        data: {
          userId: session.user.id,
          flashcardId,
          correct: correct ? 1 : 0,
          incorrect: correct ? 0 : 1,
          lastPractice: new Date(),
          mastered: false,
        },
      })
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Update practice stats error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas aktualizacji statystyk' },
      { status: 500 }
    )
  }
}

// Reset practice stats for a set
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const setId = searchParams.get('setId')

    if (!setId) {
      return NextResponse.json(
        { error: 'ID zestawu jest wymagane' },
        { status: 400 }
      )
    }

    // Verify user owns the set
    const set = await prisma.flashcardSet.findFirst({
      where: {
        id: setId,
        userId: session.user.id,
      },
      include: {
        flashcards: true,
      },
    })

    if (!set) {
      return NextResponse.json({ error: 'Nie znaleziono zestawu' }, { status: 404 })
    }

    // Delete all practice stats for this set's flashcards
    await prisma.practiceStats.deleteMany({
      where: {
        userId: session.user.id,
        flashcardId: { in: set.flashcards.map((f) => f.id) },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset practice stats error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas resetowania statystyk' },
      { status: 500 }
    )
  }
}
