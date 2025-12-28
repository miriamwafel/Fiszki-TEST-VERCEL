import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { getModuleById } from '@/lib/grammar-modules'

// GET - pobierz powtórki dla modułu gramatycznego
export async function GET(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { moduleId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const progress = await prisma.userGrammarProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: session.user.id,
          moduleId,
        },
      },
    })

    if (!progress) {
      return NextResponse.json([])
    }

    const reviews = await prisma.grammarReviewSchedule.findMany({
      where: { progressId: progress.id },
      orderBy: { scheduledDate: 'asc' },
    })

    return NextResponse.json(reviews)
  } catch (error) {
    console.error('Get grammar reviews error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

// POST - utwórz harmonogram powtórek
export async function POST(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { moduleId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const moduleData = getModuleById(moduleId)
    if (!moduleData) {
      return NextResponse.json({ error: 'Moduł nie znaleziony' }, { status: 404 })
    }

    // Znajdź lub utwórz progress
    let progress = await prisma.userGrammarProgress.findUnique({
      where: {
        userId_moduleId: {
          userId: session.user.id,
          moduleId,
        },
      },
    })

    if (!progress) {
      progress = await prisma.userGrammarProgress.create({
        data: {
          userId: session.user.id,
          moduleId,
          language: moduleData.grammar.language,
          level: moduleData.level.level,
        },
      })
    }

    // Pobierz ustawienia użytkownika
    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    })
    const reviewDays = (settings?.defaultReviewDays as number[]) || [1, 5, 15, 35, 90]
    const maxReviewsPerDay = settings?.maxReviewsPerDay || 2

    // Usuń stare powtórki
    await prisma.grammarReviewSchedule.deleteMany({
      where: { progressId: progress.id },
    })

    // Pobierz istniejące powtórki dla tego języka (load balancing)
    const existingReviews = await prisma.grammarReviewSchedule.findMany({
      where: {
        userId: session.user.id,
        completed: false,
        progress: {
          language: moduleData.grammar.language,
        },
      },
      select: { scheduledDate: true },
    })

    // Policz powtórki na każdy dzień
    const reviewCountByDate: Record<string, number> = {}
    for (const review of existingReviews) {
      const dateKey = review.scheduledDate.toISOString().split('T')[0]
      reviewCountByDate[dateKey] = (reviewCountByDate[dateKey] || 0) + 1
    }

    // Utwórz nowe powtórki z load balancing
    const now = new Date()
    const reviews = []

    for (const dayOffset of reviewDays) {
      let scheduledDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000)
      scheduledDate.setHours(12, 0, 0, 0)

      // Load balancing - spróbuj przesunąć jeśli dzień jest przepełniony
      if (dayOffset > 1) {
        const dateKey = scheduledDate.toISOString().split('T')[0]
        const currentCount = reviewCountByDate[dateKey] || 0

        if (currentCount >= maxReviewsPerDay) {
          const dayBefore = new Date(scheduledDate)
          dayBefore.setDate(dayBefore.getDate() - 1)
          const dayAfter = new Date(scheduledDate)
          dayAfter.setDate(dayAfter.getDate() + 1)

          const dayBeforeKey = dayBefore.toISOString().split('T')[0]
          const dayAfterKey = dayAfter.toISOString().split('T')[0]

          const countBefore = reviewCountByDate[dayBeforeKey] || 0
          const countAfter = reviewCountByDate[dayAfterKey] || 0

          if (countBefore < maxReviewsPerDay && countBefore <= countAfter) {
            scheduledDate = dayBefore
          } else if (countAfter < maxReviewsPerDay) {
            scheduledDate = dayAfter
          }
        }
      }

      const finalDateKey = scheduledDate.toISOString().split('T')[0]
      reviewCountByDate[finalDateKey] = (reviewCountByDate[finalDateKey] || 0) + 1

      reviews.push({
        userId: session.user.id,
        progressId: progress.id,
        scheduledDate,
        dayOffset,
      })
    }

    await prisma.grammarReviewSchedule.createMany({
      data: reviews,
    })

    const createdReviews = await prisma.grammarReviewSchedule.findMany({
      where: { progressId: progress.id },
      orderBy: { scheduledDate: 'asc' },
    })

    return NextResponse.json(createdReviews)
  } catch (error) {
    console.error('Create grammar reviews error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

// PUT - aktualizuj powtórkę
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { moduleId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reviewId, completed, scheduledDate } = await request.json()

    // Sprawdź czy powtórka należy do użytkownika
    const review = await prisma.grammarReviewSchedule.findFirst({
      where: {
        id: reviewId,
        userId: session.user.id,
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Powtórka nie znaleziona' }, { status: 404 })
    }

    const updateData: {
      completed?: boolean
      completedAt?: Date | null
      scheduledDate?: Date
    } = {}

    if (completed !== undefined) {
      updateData.completed = completed
      updateData.completedAt = completed ? new Date() : null
    }

    if (scheduledDate) {
      updateData.scheduledDate = new Date(scheduledDate)
    }

    const updated = await prisma.grammarReviewSchedule.update({
      where: { id: reviewId },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update grammar review error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

// DELETE - usuń powtórkę
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { moduleId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reviewId = searchParams.get('reviewId')

    if (!reviewId) {
      return NextResponse.json({ error: 'Brak reviewId' }, { status: 400 })
    }

    // Sprawdź czy powtórka należy do użytkownika
    const review = await prisma.grammarReviewSchedule.findFirst({
      where: {
        id: reviewId,
        userId: session.user.id,
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Powtórka nie znaleziona' }, { status: 404 })
    }

    await prisma.grammarReviewSchedule.delete({
      where: { id: reviewId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete grammar review error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
