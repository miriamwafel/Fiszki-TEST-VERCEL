import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const set = await prisma.flashcardSet.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        flashcards: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!set) {
      return NextResponse.json({ error: 'Nie znaleziono zestawu' }, { status: 404 })
    }

    return NextResponse.json(set)
  } catch (error) {
    console.error('Get set error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    await prisma.flashcardSet.deleteMany({
      where: {
        id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete set error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas usuwania' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { name, description } = await request.json()

    const set = await prisma.flashcardSet.updateMany({
      where: {
        id,
        userId: session.user.id,
      },
      data: {
        name,
        description,
      },
    })

    return NextResponse.json(set)
  } catch (error) {
    console.error('Update set error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas aktualizacji' },
      { status: 500 }
    )
  }
}
