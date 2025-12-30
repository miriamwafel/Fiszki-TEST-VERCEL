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

    const notes = await prisma.stickyNote.findMany({
      where: { userId: session.user.id },
      orderBy: [
        { pinned: 'desc' },
        { createdAt: 'desc' }
      ],
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Get notes error:', error)
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

    const { content, color } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Treść notatki jest wymagana' },
        { status: 400 }
      )
    }

    const note = await prisma.stickyNote.create({
      data: {
        content: content.trim(),
        color: color || 'yellow',
        userId: session.user.id,
      },
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Create note error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas tworzenia notatki' },
      { status: 500 }
    )
  }
}
