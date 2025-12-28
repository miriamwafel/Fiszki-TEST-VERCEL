import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

// GET - pobierz ustawienia użytkownika
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    })

    // Jeśli nie ma ustawień, zwróć domyślne
    if (!settings) {
      settings = {
        id: '',
        defaultReviewDays: [1, 5, 15, 35, 90],
        maxReviewsPerDay: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: session.user.id,
      }
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Get settings error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}

// POST - zapisz ustawienia użytkownika
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { defaultReviewDays, maxReviewsPerDay } = await request.json()

    // Walidacja
    if (!Array.isArray(defaultReviewDays) || defaultReviewDays.length === 0) {
      return NextResponse.json(
        { error: 'defaultReviewDays musi być niepustą tablicą' },
        { status: 400 }
      )
    }

    // Upewnij się że dzień 1 jest zawsze pierwszy
    const sortedDays = [...new Set(defaultReviewDays)].sort((a, b) => a - b)
    if (sortedDays[0] !== 1) {
      sortedDays.unshift(1)
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {
        defaultReviewDays: sortedDays,
        maxReviewsPerDay: maxReviewsPerDay || 2,
      },
      create: {
        userId: session.user.id,
        defaultReviewDays: sortedDays,
        maxReviewsPerDay: maxReviewsPerDay || 2,
      },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Save settings error:', error)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
