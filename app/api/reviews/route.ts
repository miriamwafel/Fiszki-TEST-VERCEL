import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - pobierz wszystkie zaplanowane powtórki użytkownika (do kalendarza)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Domyślnie pobierz powtórki z najbliższych 90 dni
    const fromDate = from ? new Date(from) : new Date()
    const toDate = to ? new Date(to) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

    fromDate.setHours(0, 0, 0, 0)
    toDate.setHours(23, 59, 59, 999)

    const reviews = await prisma.reviewSchedule.findMany({
      where: {
        set: { userId: session.user.id },
        scheduledDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        set: {
          select: {
            id: true,
            name: true,
            language: true,
            _count: { select: { flashcards: true } },
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    })

    // Grupuj po dacie
    const groupedByDate: Record<string, typeof reviews> = {}
    for (const review of reviews) {
      const dateKey = review.scheduledDate.toISOString().split('T')[0]
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = []
      }
      groupedByDate[dateKey].push(review)
    }

    // Policz ile powtórek na każdy dzień
    const reviewCounts: Record<string, number> = {}
    for (const [date, items] of Object.entries(groupedByDate)) {
      reviewCounts[date] = items.filter(r => !r.completed).length
    }

    return NextResponse.json({
      reviews,
      groupedByDate,
      reviewCounts,
    })
  } catch (error) {
    console.error('Get reviews error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
