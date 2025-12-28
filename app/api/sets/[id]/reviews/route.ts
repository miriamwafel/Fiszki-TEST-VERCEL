import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - pobierz harmonogram powtórek dla zestawu
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id: setId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sprawdź czy zestaw należy do użytkownika
    const set = await prisma.flashcardSet.findFirst({
      where: { id: setId, userId: session.user.id },
    })

    if (!set) {
      return NextResponse.json({ error: 'Zestaw nie znaleziony' }, { status: 404 })
    }

    const reviews = await prisma.reviewSchedule.findMany({
      where: { setId },
      orderBy: { scheduledDate: 'asc' },
    })

    return NextResponse.json(reviews)
  } catch (error) {
    console.error('Get set reviews error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

// POST - utwórz harmonogram powtórek dla zestawu
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id: setId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sprawdź czy zestaw należy do użytkownika
    const set = await prisma.flashcardSet.findFirst({
      where: { id: setId, userId: session.user.id },
    })

    if (!set) {
      return NextResponse.json({ error: 'Zestaw nie znaleziony' }, { status: 404 })
    }

    const { reviewDays } = await request.json()

    // Pobierz ustawienia użytkownika lub użyj domyślnych
    let days: number[] = reviewDays
    if (!days || days.length === 0) {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: session.user.id },
      })
      days = (settings?.defaultReviewDays as number[]) || [1, 5, 15, 35, 90]
    }

    // Pobierz wszystkie istniejące powtórki użytkownika DLA TEGO SAMEGO JĘZYKA (do sprawdzenia obłożenia)
    const existingReviews = await prisma.reviewSchedule.findMany({
      where: {
        set: {
          userId: session.user.id,
          language: set.language, // Tylko zestawy w tym samym języku
        },
        completed: false,
      },
      select: { scheduledDate: true },
    })

    // Policz powtórki na każdy dzień
    const reviewCountByDate: Record<string, number> = {}
    for (const review of existingReviews) {
      const dateKey = review.scheduledDate.toISOString().split('T')[0]
      reviewCountByDate[dateKey] = (reviewCountByDate[dateKey] || 0) + 1
    }

    // Pobierz maxReviewsPerDay
    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    })
    const maxReviewsPerDay = settings?.maxReviewsPerDay || 2

    // Usuń stare harmonogramy dla tego zestawu
    await prisma.reviewSchedule.deleteMany({
      where: { setId },
    })

    // Stwórz nowe harmonogramy
    const baseDate = new Date(set.createdAt)
    baseDate.setHours(12, 0, 0, 0) // Ustaw na południe

    const schedulesToCreate = []

    for (const dayOffset of days) {
      let scheduledDate = new Date(baseDate)
      scheduledDate.setDate(scheduledDate.getDate() + dayOffset)

      // Dzień +1 jest stały, pozostałe mogą być przesunięte
      if (dayOffset !== 1) {
        const dateKey = scheduledDate.toISOString().split('T')[0]
        const currentCount = reviewCountByDate[dateKey] || 0

        // Jeśli za dużo powtórek na ten dzień, przesuń
        if (currentCount >= maxReviewsPerDay) {
          // Spróbuj dzień wcześniej
          const dayBefore = new Date(scheduledDate)
          dayBefore.setDate(dayBefore.getDate() - 1)
          const dayBeforeKey = dayBefore.toISOString().split('T')[0]

          // Spróbuj dzień później
          const dayAfter = new Date(scheduledDate)
          dayAfter.setDate(dayAfter.getDate() + 1)
          const dayAfterKey = dayAfter.toISOString().split('T')[0]

          const countBefore = reviewCountByDate[dayBeforeKey] || 0
          const countAfter = reviewCountByDate[dayAfterKey] || 0

          // Wybierz dzień z mniejszą liczbą powtórek
          if (countBefore < maxReviewsPerDay && countBefore <= countAfter) {
            scheduledDate = dayBefore
          } else if (countAfter < maxReviewsPerDay) {
            scheduledDate = dayAfter
          }
          // Jeśli oba pełne, zostaw oryginalny dzień
        }
      }

      // Aktualizuj licznik
      const finalDateKey = scheduledDate.toISOString().split('T')[0]
      reviewCountByDate[finalDateKey] = (reviewCountByDate[finalDateKey] || 0) + 1

      schedulesToCreate.push({
        setId,
        scheduledDate,
        dayOffset,
        completed: false,
      })
    }

    // Zapisz wszystkie harmonogramy
    await prisma.reviewSchedule.createMany({
      data: schedulesToCreate,
    })

    // Pobierz utworzone harmonogramy
    const createdReviews = await prisma.reviewSchedule.findMany({
      where: { setId },
      orderBy: { scheduledDate: 'asc' },
    })

    return NextResponse.json(createdReviews)
  } catch (error) {
    console.error('Create set reviews error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

// PUT - aktualizuj pojedynczą powtórkę (np. oznacz jako ukończoną lub zmień datę)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id: setId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reviewId, scheduledDate, completed } = await request.json()

    if (!reviewId) {
      return NextResponse.json({ error: 'reviewId jest wymagane' }, { status: 400 })
    }

    // Sprawdź czy powtórka należy do zestawu użytkownika
    const review = await prisma.reviewSchedule.findFirst({
      where: {
        id: reviewId,
        setId,
        set: { userId: session.user.id },
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Powtórka nie znaleziona' }, { status: 404 })
    }

    const updateData: { scheduledDate?: Date; completed?: boolean; completedAt?: Date | null } = {}

    if (scheduledDate) {
      updateData.scheduledDate = new Date(scheduledDate)
    }

    if (typeof completed === 'boolean') {
      updateData.completed = completed
      updateData.completedAt = completed ? new Date() : null
    }

    const updatedReview = await prisma.reviewSchedule.update({
      where: { id: reviewId },
      data: updateData,
    })

    return NextResponse.json(updatedReview)
  } catch (error) {
    console.error('Update review error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

// DELETE - usuń pojedynczą powtórkę
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id: setId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reviewId = searchParams.get('reviewId')

    if (!reviewId) {
      return NextResponse.json({ error: 'reviewId jest wymagane' }, { status: 400 })
    }

    // Sprawdź czy powtórka należy do zestawu użytkownika
    const review = await prisma.reviewSchedule.findFirst({
      where: {
        id: reviewId,
        setId,
        set: { userId: session.user.id },
      },
    })

    if (!review) {
      return NextResponse.json({ error: 'Powtórka nie znaleziona' }, { status: 404 })
    }

    await prisma.reviewSchedule.delete({
      where: { id: reviewId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete review error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
