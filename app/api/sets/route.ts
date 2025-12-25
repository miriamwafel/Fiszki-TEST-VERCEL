import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sets = await prisma.flashcardSet.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: { flashcards: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(sets)
  } catch (error) {
    console.error('Get sets error:', error)
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

    const { name, description, language } = await request.json()

    if (!name || !language) {
      return NextResponse.json(
        { error: 'Nazwa i język są wymagane' },
        { status: 400 }
      )
    }

    const set = await prisma.flashcardSet.create({
      data: {
        name,
        description,
        language,
        userId: session.user.id,
      },
    })

    return NextResponse.json(set)
  } catch (error) {
    console.error('Create set error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas tworzenia zestawu' },
      { status: 500 }
    )
  }
}
