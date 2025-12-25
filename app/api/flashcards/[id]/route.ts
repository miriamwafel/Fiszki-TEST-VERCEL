import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

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

    // Verify user owns the flashcard through the set
    const flashcard = await prisma.flashcard.findFirst({
      where: { id },
      include: { set: true },
    })

    if (!flashcard || flashcard.set.userId !== session.user.id) {
      return NextResponse.json({ error: 'Nie znaleziono fiszki' }, { status: 404 })
    }

    await prisma.flashcard.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete flashcard error:', error)
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
    const { word, translation, context, partOfSpeech, infinitive } = await request.json()

    // Verify user owns the flashcard through the set
    const flashcard = await prisma.flashcard.findFirst({
      where: { id },
      include: { set: true },
    })

    if (!flashcard || flashcard.set.userId !== session.user.id) {
      return NextResponse.json({ error: 'Nie znaleziono fiszki' }, { status: 404 })
    }

    const updated = await prisma.flashcard.update({
      where: { id },
      data: {
        word,
        translation,
        context,
        partOfSpeech,
        infinitive,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update flashcard error:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas aktualizacji' },
      { status: 500 }
    )
  }
}
