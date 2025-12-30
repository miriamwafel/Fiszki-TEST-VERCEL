import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { content, color, pinned } = await request.json()

    // Sprawdź czy notatka należy do użytkownika
    const existingNote = await prisma.stickyNote.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Notatka nie znaleziona' }, { status: 404 })
    }

    const note = await prisma.stickyNote.update({
      where: { id },
      data: {
        ...(content !== undefined && { content: content.trim() }),
        ...(color !== undefined && { color }),
        ...(pinned !== undefined && { pinned }),
      },
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Update note error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas aktualizacji notatki' },
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

    // Sprawdź czy notatka należy do użytkownika
    const existingNote = await prisma.stickyNote.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Notatka nie znaleziona' }, { status: 404 })
    }

    await prisma.stickyNote.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete note error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas usuwania notatki' },
      { status: 500 }
    )
  }
}
