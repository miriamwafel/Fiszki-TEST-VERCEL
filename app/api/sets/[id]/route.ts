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
        story: {
          select: {
            id: true,
            title: true,
            language: true,
            difficulty: true,
          },
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
    const body = await request.json()
    const { name, description, storyId } = body

    // Buduj obiekt aktualizacji dynamicznie
    const updateData: { name?: string; description?: string; storyId?: string | null } = {}

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if ('storyId' in body) updateData.storyId = storyId // null = odepnij historyjkę

    const set = await prisma.flashcardSet.update({
      where: {
        id,
        userId: session.user.id,
      },
      data: updateData,
      include: {
        story: {
          select: {
            id: true,
            title: true,
            language: true,
            difficulty: true,
          },
        },
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
